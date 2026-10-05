import type { Handler } from '@netlify/functions';
import { createSupabaseAdmin } from './_lib/supabase';
import { json, assertPost } from './_lib/http';
import { extractAuthHeader, getAuthedUser } from './_lib/auth';
import { resolveOwnedProfileIdsForUser } from './_lib/owned-profiles';
import { removeStoreProducts } from './_lib/store-product-removal';

export const handler: Handler = async (event) => {
  try {
    assertPost(event.httpMethod);
    const authHeader = extractAuthHeader(event);
    if (!authHeader) return json(401, { ok: false, error: 'Unauthorized' });
    const { user } = await getAuthedUser(authHeader);
    if (!user) return json(401, { ok: false, error: 'Unauthorized' });
    let body: any;
    try { body = JSON.parse(event.body || '{}'); }
    catch { return json(400, { ok: false, error: 'Invalid JSON' }); }
    if (!['affiliate', 'seller'].includes(body.role)) return json(400, { ok: false, error: 'Invalid store role' });
    const productIds = Array.from(new Set((Array.isArray(body.product_ids) ? body.product_ids : []).map((id: any) => String(id || '').trim()))) as string[];
    if (!productIds.length || productIds.length > 200 || productIds.some((id) => !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))) {
      return json(400, { ok: false, error: 'Invalid product ids' });
    }
    const db = createSupabaseAdmin();
    // Scope comes exclusively from the authenticated account, never browser ids.
    const ownerIds = await resolveOwnedProfileIdsForUser({ supabaseAdmin: db, user });
    await removeStoreProducts(db, ownerIds, productIds, body.role);
    return json(200, { ok: true, product_ids: productIds });
  } catch (error: any) {
    return json(Number(error?.statusCode) || 500, { ok: false, error: error instanceof Error ? error.message : 'Removal failed' });
  }
};
