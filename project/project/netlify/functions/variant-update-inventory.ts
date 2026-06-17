import type { Handler } from '@netlify/functions';
import { createSupabaseAdmin } from './_lib/supabase';
import { json, assertPost, parseJson } from './_lib/http';
import { requireAdmin } from './_lib/auth';
import { writeAuditLog } from './_lib/audit';
import { recomputeProductStock } from './_lib/cj-stock';
import { deriveVariantInStock } from './_lib/cj-import-utils';

export const handler: Handler = async (event) => {
  try {
    assertPost(event.httpMethod);
    const admin = await requireAdmin(event);
    const variantId = String(event.queryStringParameters?.id || '').trim();
    if (!variantId) return json(400, { error: 'Missing variant id' });

    const body = parseJson<any>(event.body);
    const inventoryRaw = Number(body?.inventory);
    if (!Number.isFinite(inventoryRaw) || inventoryRaw < 0) {
      return json(400, { error: 'Invalid inventory value' });
    }
    const inventory = Math.floor(inventoryRaw);

    const supabaseAdmin = createSupabaseAdmin();
    const { data: variant, error } = await supabaseAdmin
      .from('product_variants')
      .select('id, product_id, inventory_policy, is_active')
      .eq('id', variantId)
      .maybeSingle();
    if (error) return json(500, { error: error.message });
    if (!variant?.id) return json(404, { error: 'Variant not found' });

    const policy = (variant.inventory_policy || 'deny') as 'deny' | 'continue';
    const isActive = variant.is_active !== false;
    const inStock = deriveVariantInStock({ is_active: isActive, inventory, inventory_policy: policy });

    const { error: updateError } = await supabaseAdmin
      .from('product_variants')
      .update({ inventory, in_stock: inStock, inventory_source: 'manual' })
      .eq('id', variantId);
    if (updateError) return json(500, { error: updateError.message });

    await recomputeProductStock({ supabaseAdmin, productId: variant.product_id });
    await writeAuditLog({
      supabaseAdmin,
      actor_user_id: admin.userId,
      action: 'UPDATE_INVENTORY',
      entity_type: 'variant',
      entity_id: variantId,
      details: { inventory, in_stock: inStock },
    });

    return json(200, { ok: true, inventory, in_stock: inStock });
  } catch (e: any) {
    const statusCode = Number(e?.statusCode) || 500;
    return json(statusCode, { error: e instanceof Error ? e.message : 'Unexpected error' });
  }
};
