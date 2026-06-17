import type { Handler } from '@netlify/functions';
import { createSupabaseAdmin } from './_lib/supabase';
import { json, assertPost, parseJson } from './_lib/http';
import { requireAdmin } from './_lib/auth';
import { writeAuditLog } from './_lib/audit';
import { recomputeProductStock } from './_lib/cj-stock';

type BulkAction = 'activate' | 'archive';

export const handler: Handler = async (event) => {
  try {
    assertPost(event.httpMethod);
    const admin = await requireAdmin(event);
    const body = parseJson<any>(event.body);
    const action = String(body?.action || '').trim().toLowerCase() as BulkAction;
    const ids = Array.isArray(body?.ids) ? body.ids.map(String).filter(Boolean) : [];

    if (!ids.length) return json(400, { error: 'Missing product ids' });
    if (action !== 'activate' && action !== 'archive') return json(400, { error: 'Invalid action' });

    const supabaseAdmin = createSupabaseAdmin();
    const updatePayload =
      action === 'activate'
        ? { status: 'active', is_active: true }
        : { status: 'archived', is_active: false, in_stock: false };

    const { error } = await supabaseAdmin.from('products').update(updatePayload).in('id', ids);
    if (error) return json(500, { error: error.message });

    for (const id of ids) {
      await recomputeProductStock({ supabaseAdmin, productId: id, status: action === 'activate' ? 'active' : 'archived' });
      await writeAuditLog({
        supabaseAdmin,
        actor_user_id: admin.userId,
        action: action === 'activate' ? 'BULK_ACTIVATE_PRODUCT' : 'BULK_ARCHIVE_PRODUCT',
        entity_type: 'product',
        entity_id: id,
        details: {},
      });
    }

    return json(200, { ok: true, count: ids.length });
  } catch (e: any) {
    const statusCode = Number(e?.statusCode) || 500;
    return json(statusCode, { error: e instanceof Error ? e.message : 'Unexpected error' });
  }
};

