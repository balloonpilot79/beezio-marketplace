import type { Handler } from '@netlify/functions';
import { json, assertPost } from './_lib/http';
import { createSupabaseAdmin } from './_lib/supabase';
import { extractAuthHeader, getAuthedUser } from './_lib/auth';
import { maskSecret } from './_lib/crypto';

export const handler: Handler = async (event) => {
  try {
    assertPost(event.httpMethod);

    const authHeader = extractAuthHeader(event);
    if (!authHeader) return json(401, { error: 'Missing authorization header' });

    const { user, error: authError } = await getAuthedUser(authHeader);
    if (!user) return json(401, { error: 'Unauthorized', details: authError });

    const authUserId = String(user?.id || '').trim();
    if (!authUserId) return json(400, { error: 'Missing auth user id' });

    const supabaseAdmin = createSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from('user_integrations')
      .select('*')
      .eq('user_id', authUserId)
      .order('connected_at', { ascending: false });

    if (error) return json(500, { error: error.message });

    const integrations = (data as any[] | null)?.map((row) => ({
      ...row,
      api_key: row?.api_key ? maskSecret(row.api_key) : null,
    })) || [];

    return json(200, { ok: true, integrations });
  } catch (e: any) {
    const statusCode = Number(e?.statusCode) || 500;
    return json(statusCode, { error: e instanceof Error ? e.message : 'Unexpected error' });
  }
};

export default handler;
