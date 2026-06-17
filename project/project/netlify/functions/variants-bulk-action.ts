import type { Handler } from '@netlify/functions';
import { createSupabaseAdmin } from './_lib/supabase';
import { json, assertPost, parseJson } from './_lib/http';
import { requireAdmin } from './_lib/auth';
import { writeAuditLog } from './_lib/audit';
import { recomputeProductStock } from './_lib/cj-stock';
import { deriveVariantInStock } from './_lib/cj-import-utils';

type BulkAction = 'enable' | 'disable' | 'set_inventory' | 'set_inventory_zero';

export const handler: Handler = async (event) => {
  try {
    assertPost(event.httpMethod);
    const admin = await requireAdmin(event);
    const body = parseJson<any>(event.body);
    const action = String(body?.action || '').trim().toLowerCase() as BulkAction;
    const ids = Array.isArray(body?.ids) ? body.ids.map(String).filter(Boolean) : [];
    const inventoryValue = Number(body?.inventory);

    if (!ids.length) return json(400, { error: 'Missing variant ids' });
    if (!['enable', 'disable', 'set_inventory', 'set_inventory_zero'].includes(action)) {
      return json(400, { error: 'Invalid action' });
    }
    if (action === 'set_inventory' && (!Number.isFinite(inventoryValue) || inventoryValue < 0)) {
      return json(400, { error: 'Invalid inventory value' });
    }

    const supabaseAdmin = createSupabaseAdmin();
    const { data: variants, error } = await supabaseAdmin
      .from('product_variants')
      .select('id, product_id, inventory, inventory_policy, is_active')
      .in('id', ids);
    if (error) return json(500, { error: error.message });

    const touchedProducts = new Set<string>();
    for (const variant of variants as any[]) {
      const policy = (variant.inventory_policy || 'deny') as 'deny' | 'continue';
      const baseInventory = Number.isFinite(Number(variant.inventory)) ? Math.max(0, Math.floor(variant.inventory)) : 0;
      let inventory = baseInventory;
      let isActive = variant.is_active !== false;

      if (action === 'enable') isActive = true;
      if (action === 'disable') isActive = false;
      if (action === 'set_inventory') inventory = Math.floor(inventoryValue);
      if (action === 'set_inventory_zero') inventory = 0;

      const inStock = deriveVariantInStock({
        is_active: isActive,
        inventory,
        inventory_policy: policy,
      });

      const updatePayload: Record<string, unknown> = {
        is_active: isActive,
        in_stock: inStock,
      };

      if (action === 'set_inventory' || action === 'set_inventory_zero') {
        updatePayload.inventory = inventory;
        updatePayload.inventory_source = 'manual';
      }

      await supabaseAdmin.from('product_variants').update(updatePayload).eq('id', variant.id);
      touchedProducts.add(String(variant.product_id));

      await writeAuditLog({
        supabaseAdmin,
        actor_user_id: admin.userId,
        action: `BULK_${action.toUpperCase()}`,
        entity_type: 'variant',
        entity_id: variant.id,
        details: { inventory, in_stock: inStock },
      });
    }

    for (const productId of touchedProducts) {
      await recomputeProductStock({ supabaseAdmin, productId });
    }

    return json(200, { ok: true, count: ids.length });
  } catch (e: any) {
    const statusCode = Number(e?.statusCode) || 500;
    return json(statusCode, { error: e instanceof Error ? e.message : 'Unexpected error' });
  }
};

