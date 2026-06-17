import type { Handler } from '@netlify/functions';
import { createSupabaseAdmin } from './_lib/supabase';
import { json, assertPost } from './_lib/http';
import { requireAdmin } from './_lib/auth';
import { writeAuditLog } from './_lib/audit';
import { checkOrderItemReferences } from './_lib/order-guards';
import { recomputeProductStock } from './_lib/cj-stock';

export const handler: Handler = async (event) => {
  try {
    assertPost(event.httpMethod);
    const admin = await requireAdmin(event);
    const variantId = String(event.queryStringParameters?.id || '').trim();
    if (!variantId) return json(400, { error: 'Missing variant id' });

    const supabaseAdmin = createSupabaseAdmin();
    const { data: variant, error } = await supabaseAdmin
      .from('product_variants')
      .select('id, product_id')
      .eq('id', variantId)
      .maybeSingle();
    if (error) return json(500, { error: error.message });
    if (!variant?.id) return json(404, { error: 'Variant not found' });

    const guard = await checkOrderItemReferences({ supabaseAdmin, variantId });
    if (!guard.ok) return json(409, { error: guard.reason || 'Cannot delete variant with orders' });

    const { error: deleteError } = await supabaseAdmin.from('product_variants').delete().eq('id', variantId);
    if (deleteError) return json(500, { error: deleteError.message });

    const { data: remainingVariants } = await supabaseAdmin
      .from('product_variants')
      .select('id')
      .eq('product_id', variant.product_id)
      .limit(1);

    if (!remainingVariants || remainingVariants.length === 0) {
      await supabaseAdmin
        .from('products')
        .update({ status: 'archived', is_active: false, in_stock: false })
        .eq('id', variant.product_id);
    } else {
      await recomputeProductStock({ supabaseAdmin, productId: variant.product_id });
    }

    await writeAuditLog({
      supabaseAdmin,
      actor_user_id: admin.userId,
      action: 'DELETE_VARIANT',
      entity_type: 'variant',
      entity_id: variantId,
      details: guard.warning ? { warning: guard.warning } : {},
    });

    return json(200, { ok: true, warning: guard.warning || null });
  } catch (e: any) {
    const statusCode = Number(e?.statusCode) || 500;
    return json(statusCode, { error: e instanceof Error ? e.message : 'Unexpected error' });
  }
};

