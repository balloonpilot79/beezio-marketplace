import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { getAuthedUser, isAdminUser, json, requireEnv } from './_sharedAuth';

type Body = { email: string; subject?: string; body: string };

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

    const isAdmin = await isAdminUser({ supabaseUrl, serviceRoleKey, userId: user.id });
    if (!isAdmin) return json(403, { error: 'Admin only' });

    const payload = (event.body ? JSON.parse(event.body) : {}) as Partial<Body>;
    const email = String(payload.email || '').trim().toLowerCase();
    const subject = String(payload.subject || 'Message from Beezio').trim();
    const body = String(payload.body || '').trim();
    if (!email || !body) return json(400, { error: 'Missing email/body' });

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Resolve auth user by email (best-effort).
    const { data: profile } = await supabaseAdmin.from('profiles').select('user_id').eq('email', email).limit(1).maybeSingle();
    const recipientUserId = String((profile as any)?.user_id || '').trim();
    if (!recipientUserId) return json(404, { error: 'Recipient not found' });

    // Create a support thread and drop the message in. This keeps admin comms in the same inbox UI.
    const now = new Date().toISOString();
    const { data: thread, error: threadError } = await supabaseAdmin
      .from('support_threads')
      .insert({ customer_id: recipientUserId, subject, status: 'open', created_at: now, updated_at: now } as any)
      .select('id')
      .single();
    if (threadError) return json(500, { error: threadError.message || 'Failed to create thread' });

    await supabaseAdmin.from('support_messages').insert({ thread_id: (thread as any).id, sender_id: user.id, body, created_at: now } as any);

    return json(200, { ok: true, threadId: String((thread as any).id) });
  } catch (e) {
    return json(500, { error: 'Unexpected error', details: e instanceof Error ? e.message : String(e) });
  }
};

