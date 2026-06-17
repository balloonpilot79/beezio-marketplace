import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!supabaseUrl || !serviceRoleKey) return json(500, { error: 'Missing Supabase env vars' });

    const authHeader = req.headers.get('authorization') || '';
    if (!authHeader) return json(401, { error: 'Missing authorization header' });

    const supabaseAuthed = createClient(supabaseUrl, anonKey || serviceRoleKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await supabaseAuthed.auth.getUser();
    if (userError || !userData?.user) return json(401, { error: 'Unauthorized' });

    const body = await req.json().catch(() => ({}));
    const connectionId = String(body?.connection_id || '').trim();
    if (!connectionId) return json(400, { error: 'Missing connection_id' });

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { data: profileRow } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('user_id', userData.user.id)
      .maybeSingle();
    const sellerId = String(profileRow?.id || userData.user.id);

    const { data: connection } = await supabaseAdmin
      .from('api_connections')
      .select('id, seller_id, provider')
      .eq('id', connectionId)
      .maybeSingle();
    if (!connection) return json(404, { error: 'Connection not found' });
    if (String(connection.seller_id) !== sellerId) {
      return json(403, { error: 'Forbidden' });
    }

    // Placeholder sync: provider-specific sync hooks can be implemented here.
    const syncedCount = 0;

    return json(200, {
      success: true,
      provider: connection.provider,
      synced_count: syncedCount,
    });
  } catch (error) {
    return json(500, {
      error: 'Unexpected error',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});
