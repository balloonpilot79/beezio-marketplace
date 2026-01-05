import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { getAuthedUser, json, requireEnv } from './_sharedAuth';

type Body = { conversationId: string };

export const handler: Handler = async (event) => {
  try {
    if (event.httpMethod === 'OPTIONS') return json(200, {});
    if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

    const supabaseUrl = requireEnv('SUPABASE_URL', ['VITE_SUPABASE_URL']);
    const anonKey = requireEnv('SUPABASE_ANON_KEY', ['VITE_SUPABASE_ANON_KEY']);
    const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

    const authHeader = String(event.headers.authorization || event.headers.Authorization || '').trim();
    if (!authHeader) return json(401, { error: 'Missing authorization header' });

    const { user, error: authErr } = await getAuthedUser({ supabaseUrl, anonKey, authHeader });
    if (!user) return json(401, { error: 'Unauthorized', details: authErr });

    const payload = (event.body ? JSON.parse(event.body) : {}) as Partial<Body>;
    const conversationId = String(payload.conversationId || '').trim();
    if (!conversationId) return json(400, { error: 'Missing conversationId' });

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    const now = new Date().toISOString();

    // Best-effort marker row.
    try {
      await supabaseAdmin
        .from('store_conversation_participants')
        .upsert({ conversation_id: conversationId, user_id: user.id, last_read_at: now } as any, {
          onConflict: 'conversation_id,user_id',
        } as any);
    } catch {
      // ignore
    }

    return json(200, { ok: true });
  } catch (e) {
    return json(500, { error: 'Unexpected error', details: e instanceof Error ? e.message : String(e) });
  }
};

