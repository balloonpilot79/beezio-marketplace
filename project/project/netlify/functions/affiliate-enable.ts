import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

function json(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

function requireEnv(name: string, fallbacks: string[] = []): string {
  const keys = [name, ...fallbacks];
  for (const key of keys) {
    const value = String(process.env[key] || '').trim();
    if (value) return value;
  }
  throw new Error(`Missing ${name}${fallbacks.length ? ` (or ${fallbacks.join(', ')})` : ''}`);
}

async function resolveOrCreateProfileId(supabaseAdmin: any, user: any): Promise<string> {
  const userId = String(user.id);

  try {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .or(`id.eq.${userId},user_id.eq.${userId}`)
      .maybeSingle();
    if (!error && (data as any)?.id) return String((data as any).id);
  } catch {
    // ignore
  }

  // Best-effort create minimal profile
  const email = user.email || null;
  const metadata: any = user.user_metadata || {};
  const fullName = metadata.full_name || metadata.name || null;

  const insertPayload: any = {
    id: userId,
    user_id: userId,
    email,
    full_name: fullName,
  };

  try {
    const { data, error } = await supabaseAdmin.from('profiles').upsert(insertPayload, { onConflict: 'id' }).select('id').maybeSingle();
    if (error) throw error;
    if ((data as any)?.id) return String((data as any).id);
  } catch (e: any) {
    throw new Error(e?.message || 'Failed to create profile');
  }

  return userId;
}

export const handler: Handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
    const authHeader = String(event.headers.authorization || event.headers.Authorization || '').trim();
    if (!authHeader) return json(401, { error: 'Missing Authorization header' });

    const supabaseUrl = requireEnv('SUPABASE_URL', ['VITE_SUPABASE_URL']);
    const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
    const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

    const supabaseAuthed = createClient(supabaseUrl, anonKey || serviceRoleKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await supabaseAuthed.auth.getUser();
    if (userError || !userData?.user) return json(401, { error: 'Unauthorized', details: userError?.message });

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    const { data: roles, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', userData.user.id)
      .eq('is_active', true)
      .in('role', ['affiliate', 'influencer']);
    if (roleError) return json(500, { error: 'Could not check business account access' });
    if (!roles?.some((row) => row.role === 'affiliate')) {
      return json(403, { error: 'Affiliate tools require a business account.' });
    }
    const profileId = await resolveOrCreateProfileId(supabaseAdmin, userData.user);
    return json(200, { ok: true, profileId, recruiterEligible: roles.some((row) => row.role === 'influencer') });
  } catch (e) {
    return json(500, { error: 'Unexpected error', details: e instanceof Error ? e.message : String(e) });
  }
};
