import type { Handler } from '@netlify/functions';
import { createSupabaseAdmin } from './_lib/supabase';
import { json, assertPost, parseJson } from './_lib/http';
import { requireAdmin } from './_lib/auth';
import { writeAuditLog } from './_lib/audit';
import { deriveVariantInStock } from './_lib/cj-import-utils';
import { recomputeProductStock } from './_lib/cj-stock';
import { getCJInventory } from './_lib/cj-api';

type InventoryOverride = { cj_variant_id: string; inventory: number };
type RunCjInventorySyncInput = {
  supabaseAdmin: any;
  cjProductIds?: string[];
  cjVariantIds?: string[];
  overrides?: InventoryOverride[];
  actorUserId?: string | null;
};

type RunCjInventorySyncResult = {
  ok: boolean;
  updated_products: number;
  updated_variants: number;
  failed_variants: number;
  unique_cj_inventory_lookups: number;
  skipped?: string;
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function runCjInventorySync(input: RunCjInventorySyncInput): Promise<RunCjInventorySyncResult> {
  const supabaseAdmin = input.supabaseAdmin;
  const cjProductIds = (input.cjProductIds || []).map(String);
  const cjVariantIds = (input.cjVariantIds || []).map(String);
  const overrides = (input.overrides || []).filter((entry) => entry.cj_variant_id && Number.isFinite(entry.inventory));

  const pageSize = 1000;
  const variants: any[] = [];
  for (let offset = 0; ; offset += pageSize) {
    let pageQuery = supabaseAdmin
      .from('product_variants')
      .select('id, product_id, cj_variant_id, cj_product_id, inventory_policy, is_active, inventory_source, provider')
      .order('id', { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (cjProductIds.length) pageQuery = pageQuery.in('cj_product_id', cjProductIds);
    if (cjVariantIds.length) pageQuery = pageQuery.in('cj_variant_id', cjVariantIds);
    if (!cjProductIds.length && !cjVariantIds.length && overrides.length) {
      pageQuery = pageQuery.in('cj_variant_id', overrides.map((o) => o.cj_variant_id));
    }

    const { data: pageRows, error } = await pageQuery;
    if (error) throw new Error(error.message);
    const rows = (pageRows as any[]) || [];
    if (rows.length === 0) break;
    variants.push(...rows);
    if (rows.length < pageSize) break;
  }

  if (variants.length === 0) {
    return { ok: true, updated_products: 0, updated_variants: 0, failed_variants: 0, unique_cj_inventory_lookups: 0, skipped: 'No matching variants found' };
  }

  const eligibleVariants = variants.filter((variant) => {
    const inventorySource = String(variant.inventory_source || '').trim().toLowerCase();
    const provider = String(variant.provider || '').trim().toUpperCase();
    const cjProductId = String(variant.cj_product_id || '').trim();
    const cjVariantId = String(variant.cj_variant_id || '').trim();
    return inventorySource === 'cj' || provider === 'CJ' || Boolean(cjProductId || cjVariantId);
  });

  if (eligibleVariants.length === 0) {
    return { ok: true, updated_products: 0, updated_variants: 0, failed_variants: 0, unique_cj_inventory_lookups: 0, skipped: 'No variants with inventory_source=cj' };
  }

  const overrideMap = new Map<string, number>();
  overrides.forEach((entry) => overrideMap.set(entry.cj_variant_id, Math.max(0, Math.floor(entry.inventory))));
  const inventoryCache = new Map<string, number | null>();

  const touchedProducts = new Set<string>();
  let updatedVariants = 0;
  let failedVariants = 0;

  for (const variant of eligibleVariants) {
    const override = overrideMap.get(String(variant.cj_variant_id || ''));
    let inventory: number | null = null;
    if (override != null) {
      inventory = override;
    } else {
      const candidateIds = [variant.cj_product_id, variant.cj_variant_id].map((value: unknown) => String(value || '').trim());

      const cjProductId = candidateIds[0] && !UUID_REGEX.test(candidateIds[0]) ? candidateIds[0] : '';
      const cjVariantId = candidateIds[1] && !UUID_REGEX.test(candidateIds[1]) ? candidateIds[1] : '';
      if (!cjProductId) {
        failedVariants += 1;
        continue;
      }

      const cacheKey = `${cjProductId}::${cjVariantId}`;
      if (inventoryCache.has(cacheKey)) {
        inventory = inventoryCache.get(cacheKey) ?? null;
      } else {
        try {
          inventory = await getCJInventory(cjProductId, cjVariantId || undefined);
          inventoryCache.set(cacheKey, inventory);
        } catch {
          inventoryCache.set(cacheKey, null);
          failedVariants += 1;
          continue;
        }
      }
    }

    if (inventory == null) {
      failedVariants += 1;
      continue;
    }

    const policy = (variant.inventory_policy || 'deny') as 'deny' | 'continue';
    const isActive = variant.is_active !== false;
    const inStock = deriveVariantInStock({ is_active: isActive, inventory, inventory_policy: policy });
    await supabaseAdmin.from('product_variants').update({ inventory, in_stock: inStock }).eq('id', variant.id);
    touchedProducts.add(String(variant.product_id));
    updatedVariants += 1;
  }

  for (const productId of touchedProducts) {
    await recomputeProductStock({ supabaseAdmin, productId });
    if (input.actorUserId) {
      await writeAuditLog({
        supabaseAdmin,
        actor_user_id: input.actorUserId,
        action: 'SYNC_INVENTORY',
        entity_type: 'product',
        entity_id: productId,
        details: { source: 'cj_api', updated_variants: updatedVariants, failed_variants: failedVariants },
      });
    }
  }

  return {
    ok: true,
    updated_products: touchedProducts.size,
    updated_variants: updatedVariants,
    failed_variants: failedVariants,
    unique_cj_inventory_lookups: inventoryCache.size,
  };
}

export const handler: Handler = async (event) => {
  try {
    assertPost(event.httpMethod);
    const admin = await requireAdmin(event);
    const body = parseJson<any>(event.body);
    const supabaseAdmin = createSupabaseAdmin();

    const cjProductIds = Array.isArray(body?.cj_product_ids) ? body.cj_product_ids.map(String) : [];
    const cjVariantIds = Array.isArray(body?.cj_variant_ids) ? body.cj_variant_ids.map(String) : [];
    const overrides: InventoryOverride[] = Array.isArray(body?.inventory)
      ? body.inventory
          .map((entry: any) => ({
            cj_variant_id: String(entry?.cj_variant_id || '').trim(),
            inventory: Number(entry?.inventory),
          }))
          .filter((entry: InventoryOverride) => entry.cj_variant_id && Number.isFinite(entry.inventory))
      : [];

    const result = await runCjInventorySync({
      supabaseAdmin,
      cjProductIds,
      cjVariantIds,
      overrides,
      actorUserId: admin.userId,
    });

    return json(200, result);
  } catch (e: any) {
    const statusCode = Number(e?.statusCode) || 500;
    return json(statusCode, { error: e instanceof Error ? e.message : 'Unexpected error' });
  }
};
