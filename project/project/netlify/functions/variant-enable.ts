import type { Handler } from '@netlify/functions';
import { createSupabaseAdmin } from './_lib/supabase';
import { json, assertPost } from './_lib/http';
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

    const supabaseAdmin = createSupabaseAdmin();
    const { data: variant, error } = await supabaseAdmin
      .from('product_variants')
      .select('id, product_id, inventory, inventory_policy')
      .eq('id', variantId)
      .maybeSingle();
    if (error) return json(500, { error: error.message });
    if (!variant?.id) return json(404, { error: 'Variant not found' });

    const inventory = Number(variant.inventory ?? 0);
    const policy = (variant.inventory_policy || 'deny') as 'deny' | 'continue';
    const inStock = deriveVariantInStock({
      is_active: true,
      inventory: Number.isFinite(inventory) ? Math.max(0, Math.floor(inventory)) : 0,
      inventory_policy: policy,
    });

    const { error: updateError } = await supabaseAdmin
      .from('product_variants')
      .update({ is_active: true, in_stock: inStock })
      .eq('id', variantId);
    if (updateError) return json(500, { error: updateError.message });

    await recomputeProductStock({ supabaseAdmin, productId: variant.product_id });
    await writeAuditLog({
      supabaseAdmin,
      actor_user_id: admin.userId,
      action: 'ENABLE_VARIANT',
      entity_type: 'variant',
      entity_id: variantId,
      details: { in_stock: inStock },
    });

    return json(200, { ok: true, in_stock: inStock });
  } catch (e: any) {
    const statusCode = Number(e?.statusCode) || 500;
    return json(statusCode, { error: e instanceof Error ? e.message : 'Unexpected error' });
  }
};

