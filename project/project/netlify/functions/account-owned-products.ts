import type { Handler } from '@netlify/functions';
import { createSupabaseAdmin } from './_lib/supabase';
import { json } from './_lib/http';
import { extractAuthHeader, getAuthedUser } from './_lib/auth';
import { resolveOwnedProfileIdsForUser } from './_lib/owned-profiles';

export const handler: Handler = async (event) => {
  try {
    const authHeader = extractAuthHeader(event);
    if (!authHeader) return json(401, { error: 'Unauthorized' });

    const { user, error: authError } = await getAuthedUser(authHeader);
    if (!user) return json(401, { error: authError || 'Unauthorized' });

    const supabaseAdmin = createSupabaseAdmin();
    const ownerIds = await resolveOwnedProfileIdsForUser({ supabaseAdmin, user });

    if (ownerIds.length === 0) {
      return json(200, { ok: true, ownerIds: [], products: [] });
    }

    const { data, error } = await supabaseAdmin
      .from('products')
      .select('*')
      .in('seller_id', ownerIds)
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) {
      return json(500, { ok: false, error: error.message });
    }

    return json(200, {
      ok: true,
      ownerIds,
      products: Array.isArray(data) ? data : [],
    });
  } catch (e) {
    return json(500, {
      ok: false,
      error: e instanceof Error ? e.message : 'Unexpected error',
    });
  }
};