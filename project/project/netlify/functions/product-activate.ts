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
    const productId = String(event.queryStringParameters?.id || '').trim();
    if (!productId) return json(400, { error: 'Missing product id' });

    const supabaseAdmin = createSupabaseAdmin();
    const { error } = await supabaseAdmin
      .from('products')
      .update({ status: 'active', is_active: true, is_promotable: true })
      .eq('id', productId);
    if (error) return json(500, { error: error.message });

    await recomputeProductStock({ supabaseAdmin, productId, status: 'active' });
    await writeAuditLog({
      supabaseAdmin,
      actor_user_id: admin.userId,
      action: 'ACTIVATE_PRODUCT',
      entity_type: 'product',
      entity_id: productId,
      details: {},
    });

    return json(200, { ok: true });
  } catch (e: any) {
    const statusCode = Number(e?.statusCode) || 500;
    return json(statusCode, { error: e instanceof Error ? e.message : 'Unexpected error' });
  }
};
