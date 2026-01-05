import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { getAuthedUser, json, requireEnv } from './_sharedAuth';

type Body = {
  ownerId: string;
  ownerType: 'seller' | 'affiliate' | 'fundraiser';
  storeName?: string | null;
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

    const body = (event.body ? JSON.parse(event.body) : {}) as Partial<Body>;
    const ownerId = String(body.ownerId || '').trim();
    const ownerType = String(body.ownerType || '').trim().toLowerCase() as Body['ownerType'];
    const storeName = body.storeName == null ? null : String(body.storeName || '').trim() || null;

    if (!ownerId) return json(400, { error: 'Missing ownerId' });
    if (ownerId === user.id) return json(400, { error: 'Cannot message yourself' });
    if (ownerType !== 'seller' && ownerType !== 'affiliate' && ownerType !== 'fundraiser') {
      return json(400, { error: 'Invalid ownerType' });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Find existing conversation (best-effort uniqueness).
    const { data: existing } = await supabaseAdmin
      .from('store_conversations')
      .select('id, owner_id, owner_type, customer_id, store_name, created_at, updated_at')
      .eq('owner_id', ownerId)
      .eq('customer_id', user.id)
      .limit(1)
      .maybeSingle();

    const now = new Date().toISOString();
    const conversation =
      existing ||
      (await (async () => {
        const { data, error } = await supabaseAdmin
          .from('store_conversations')
          .insert({
            owner_id: ownerId,
            owner_type: ownerType,
            customer_id: user.id,
            store_name: storeName,
            created_at: now,
            updated_at: now,
          } as any)
          .select('id, owner_id, owner_type, customer_id, store_name, created_at, updated_at')
          .single();
        if (error) throw error;
        return data as any;
      })());

    // Ensure participant rows exist (best-effort).
    try {
      await supabaseAdmin.from('store_conversation_participants').upsert(
        [
          { conversation_id: (conversation as any).id, user_id: ownerId, last_read_at: now },
          { conversation_id: (conversation as any).id, user_id: user.id, last_read_at: now },
        ] as any,
        { onConflict: 'conversation_id,user_id' } as any
      );
    } catch {
      // ignore
    }

    return json(200, { conversation });
  } catch (e) {
    return json(500, { error: 'Unexpected error', details: e instanceof Error ? e.message : String(e) });
  }
};

