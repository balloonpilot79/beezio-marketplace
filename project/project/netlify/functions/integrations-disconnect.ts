import type { Handler } from '@netlify/functions';
import { json, assertPost, parseJson } from './_lib/http';
import { createSupabaseAdmin } from './_lib/supabase';
import { extractAuthHeader, getAuthedUser } from './_lib/auth';

type DisconnectBody = {
  platform?: string;
};

export const handler: Handler = async (event) => {
  try {
    assertPost(event.httpMethod);

    const authHeader = extractAuthHeader(event);
    if (!authHeader) return json(401, { error: 'Missing authorization header' });

    const { user, error: authError } = await getAuthedUser(authHeader);
    if (!user) return json(401, { error: 'Unauthorized', details: authError });

    const authUserId = String(user?.id || '').trim();
    if (!authUserId) return json(400, { error: 'Missing auth user id' });

    const body = parseJson<DisconnectBody>(event.body);
    const platform = String(body?.platform || '').trim().toLowerCase();
    if (!platform) return json(400, { error: 'Missing platform' });

    const supabaseAdmin = createSupabaseAdmin();
    const { error } = await supabaseAdmin
      .from('user_integrations')
      .update({ is_active: false, status: 'inactive' })
      .eq('user_id', authUserId)
      .eq('platform', platform);

    if (error) return json(500, { error: error.message });

    return json(200, { ok: true });
  } catch (e: any) {
    const statusCode = Number(e?.statusCode) || 500;
    return json(statusCode, { error: e instanceof Error ? e.message : 'Unexpected error' });
  }
};

export default handler;
