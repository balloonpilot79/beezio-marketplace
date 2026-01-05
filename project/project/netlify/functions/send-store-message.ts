import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { getAuthedUser, json, requireEnv } from './_sharedAuth';

type Body = {
  conversationId: string;
  body: string;
};

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
    const messageBody = String(payload.body || '').trim();
    if (!conversationId) return json(400, { error: 'Missing conversationId' });
    if (!messageBody) return json(400, { error: 'Missing body' });
    if (messageBody.length > 2000) return json(400, { error: 'Message too long' });

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { data: convo, error: convoErr } = await supabaseAdmin
      .from('store_conversations')
      .select('id, owner_id, customer_id')
      .eq('id', conversationId)
      .maybeSingle();
    if (convoErr) return json(500, { error: 'Failed to load conversation', details: convoErr.message });
    if (!convo) return json(404, { error: 'Conversation not found' });

    const allowed = String((convo as any).owner_id) === user.id || String((convo as any).customer_id) === user.id;
    if (!allowed) return json(403, { error: 'Not a participant' });

    const now = new Date().toISOString();
    const { error: insertErr } = await supabaseAdmin.from('store_messages').insert({
      conversation_id: conversationId,
      sender_id: user.id,
      body: messageBody,
      created_at: now,
    } as any);
    if (insertErr) return json(500, { error: 'Failed to send', details: insertErr.message });

    // Bump conversation updated_at.
    try {
      await supabaseAdmin.from('store_conversations').update({ updated_at: now }).eq('id', conversationId);
    } catch {
      // ignore
    }

    return json(200, { ok: true });
  } catch (e) {
    return json(500, { error: 'Unexpected error', details: e instanceof Error ? e.message : String(e) });
  }
};

