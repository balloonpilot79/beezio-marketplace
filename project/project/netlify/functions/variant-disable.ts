import type { Handler } from '@netlify/functions';
import { createSupabaseAdmin } from './_lib/supabase';
import { json, assertPost } from './_lib/http';
import { requireAdmin } from './_lib/auth';
import { writeAuditLog } from './_lib/audit';
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

    const { error: updateError } = await supabaseAdmin
      .from('product_variants')
      .update({ is_active: false, in_stock: false })
      .eq('id', variantId);
    if (updateError) return json(500, { error: updateError.message });

    await recomputeProductStock({ supabaseAdmin, productId: variant.product_id });
    await writeAuditLog({
      supabaseAdmin,
      actor_user_id: admin.userId,
      action: 'DISABLE_VARIANT',
      entity_type: 'variant',
      entity_id: variantId,
      details: {},
    });

    return json(200, { ok: true });
  } catch (e: any) {
    const statusCode = Number(e?.statusCode) || 500;
    return json(statusCode, { error: e instanceof Error ? e.message : 'Unexpected error' });
  }
};

