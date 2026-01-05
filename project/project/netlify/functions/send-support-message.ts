import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { getAuthedUser, json, requireEnv } from './_sharedAuth';

type Body = { threadId: string; body: string };

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
    const threadId = String(payload.threadId || '').trim();
    const body = String(payload.body || '').trim();
    if (!threadId) return json(400, { error: 'Missing threadId' });
    if (!body) return json(400, { error: 'Missing body' });
    if (body.length > 4000) return json(400, { error: 'Message too long' });

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    const { data: thread } = await supabaseAdmin.from('support_threads').select('id, customer_id').eq('id', threadId).maybeSingle();
    if (!thread) return json(404, { error: 'Thread not found' });
    if (String((thread as any).customer_id) !== user.id) return json(403, { error: 'Not your thread' });

    const now = new Date().toISOString();
    const { error: insertErr } = await supabaseAdmin.from('support_messages').insert({
      thread_id: threadId,
      sender_id: user.id,
      body,
      created_at: now,
    } as any);
    if (insertErr) return json(500, { error: insertErr.message || 'Failed to send' });

    try {
      await supabaseAdmin.from('support_threads').update({ updated_at: now }).eq('id', threadId);
    } catch {
      // ignore
    }

    return json(200, { ok: true });
  } catch (e) {
    return json(500, { error: 'Unexpected error', details: e instanceof Error ? e.message : String(e) });
  }
};

