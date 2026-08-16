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
    const profileId = await resolveOrCreateProfileId(supabaseAdmin, userData.user);

    // Affiliates are also recruiter/influencer eligible. Keep both roles active so
    // any affiliate can recruit sellers or affiliates and earn the lifetime slot.
    for (const businessRole of ['affiliate', 'influencer']) {
      try {
        const { error } = await supabaseAdmin
          .from('user_roles')
          .upsert(
            {
              user_id: userData.user.id,
              role: businessRole,
              is_active: true,
            },
            { onConflict: 'user_id,role' }
          );
        if (error) {
          console.warn(`affiliate-enable: ${businessRole} role upsert failed:`, error);
        }
      } catch {
        // Database trigger also enforces affiliate -> influencer eligibility.
      }
    }

    // Some schemas store role on profiles; do not override primary_role if set.
    try {
      const { data: existing } = await supabaseAdmin.from('profiles').select('role, primary_role').eq('id', profileId).maybeSingle();
      const primary = String((existing as any)?.primary_role || '').trim();
      if (!primary) {
        await supabaseAdmin.from('profiles').update({ primary_role: 'affiliate' }).eq('id', profileId);
      }
      const role = String((existing as any)?.role || '').trim();
      if (!role) {
        await supabaseAdmin.from('profiles').update({ role: 'affiliate' }).eq('id', profileId);
      }
    } catch {
      // ignore
    }

    return json(200, { ok: true, profileId, recruiterEligible: true });
  } catch (e) {
    return json(500, { error: 'Unexpected error', details: e instanceof Error ? e.message : String(e) });
  }
};
