import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { getAuthedUser, json, requireEnv } from './_sharedAuth';

type Body = { subject?: string | null; message: string };

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
    const subject = payload.subject == null ? null : String(payload.subject || '').trim() || null;
    const message = String(payload.message || '').trim();
    if (!message) return json(400, { error: 'Missing message' });
    if (message.length > 4000) return json(400, { error: 'Message too long' });

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    const now = new Date().toISOString();

    const { data: thread, error: threadError } = await supabaseAdmin
      .from('support_threads')
      .insert({
        customer_id: user.id,
        subject,
        status: 'open',
        created_at: now,
        updated_at: now,
      } as any)
      .select('id, customer_id, subject, status, created_at, updated_at')
      .single();
    if (threadError || !thread?.id) return json(500, { error: threadError?.message || 'Failed to create thread' });

    await supabaseAdmin.from('support_messages').insert({
      thread_id: (thread as any).id,
      sender_id: user.id,
      body: message,
      created_at: now,
    } as any);

    return json(200, { thread });
  } catch (e) {
    return json(500, { error: 'Unexpected error', details: e instanceof Error ? e.message : String(e) });
  }
};

