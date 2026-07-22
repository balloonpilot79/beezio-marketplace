import type { Handler } from '@netlify/functions';
import { createSupabaseAdmin } from './_lib/supabase';
import { assertEmailVerified, extractAuthHeader, getAuthedUser, resolveProfileId } from './_lib/auth';

const json = (statusCode: number, body: unknown) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

const handler: Handler = async (event) => {
  try {
    if (event.httpMethod === 'OPTIONS') return json(200, {});
    if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

    const authHeader = extractAuthHeader(event as any);
    if (!authHeader) return json(401, { error: 'Missing authorization header' });

    const { user, error: authError } = await getAuthedUser(authHeader);
    if (!user) return json(401, { error: 'Unauthorized', details: authError });
    assertEmailVerified(user as any);

    let body: any = {};
    try {
      body = event.body ? JSON.parse(event.body) : {};
    } catch {
      body = {};
    }

    const productId = String(body?.product_id || '').trim();
    if (!productId) return json(400, { error: 'Missing product_id' });

    const supabaseAdmin = createSupabaseAdmin();
    const profileId = (await resolveProfileId(user as any)) || String((user as any)?.id || '').trim();
    if (!profileId) return json(401, { error: 'Unauthorized' });

    const { data: existing, error: loadError } = await supabaseAdmin
      .from('products')
      .select('id,seller_id,status,is_active,is_promotable,affiliate_enabled')
      .eq('id', productId)
      .maybeSingle();

    if (loadError) return json(500, { error: 'Failed to load product', details: loadError.message });
    if (!existing?.id) return json(404, { error: 'Product not found' });
    if (String(existing.seller_id || '') !== profileId) return json(403, { error: 'Forbidden' });

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('products')
      .update({
        status: 'active',
        is_active: true,
        is_promotable: true,
        affiliate_enabled: true,
        updated_at: new Date().toISOString(),
      } as any)
      .eq('id', productId)
      .select('id,status,is_active,is_promotable,affiliate_enabled')
      .single();

    if (updateError) return json(500, { error: 'Failed to activate product', details: updateError.message });

    return json(200, { ok: true, product: updated });
  } catch (e) {
    return json(500, { error: 'Unexpected error', details: e instanceof Error ? e.message : String(e) });
  }
};

export { handler };
