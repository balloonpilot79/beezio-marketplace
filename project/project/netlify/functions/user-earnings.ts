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

async function getAuthedUser(params: { supabaseUrl: string; anonKey: string; authHeader: string }) {
  const supabaseAuthed = createClient(params.supabaseUrl, params.anonKey, {
    global: { headers: { Authorization: params.authHeader } },
  });
  const { data, error } = await supabaseAuthed.auth.getUser();
  if (error || !data?.user) return { user: null, error: error?.message || 'Unauthorized' };
  return { user: data.user, error: null };
}

const handler: Handler = async (event) => {
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

    const body = event.body ? JSON.parse(event.body) : {};
    const requestedRole = String(body?.role || '').toLowerCase().trim();
    if (requestedRole !== 'seller' && requestedRole !== 'affiliate') {
      return json(400, { error: 'Invalid role' });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { data: profileRows, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, user_id')
      .or(`id.eq.${user.id},user_id.eq.${user.id}`)
      .limit(10);
    if (profileError) return json(500, { error: 'Failed to load profile', details: profileError.message });
    const rows = Array.isArray(profileRows) ? profileRows : (profileRows ? [profileRows] : []);
    const matched =
      rows.find((r: any) => String(r?.user_id || '') === String(user.id)) ||
      rows.find((r: any) => String(r?.id || '') === String(user.id)) ||
      rows[0];
    const profileId = matched?.id ? String(matched.id) : null;
    if (!profileId) return json(400, { error: 'Missing profile for user' });

    const safe = (n: unknown) => {
      const v = Number(n);
      return Number.isFinite(v) ? v : 0;
    };

    const trySelect = async (select: string) => {
      const { data, error } = await supabaseAdmin
        .from('user_earnings')
        .select(select)
        .eq('user_id', profileId)
        .eq('role', requestedRole)
        .maybeSingle();
      if (error) throw error;
      return data;
    };

    let earningsRow: any = null;
    try {
      earningsRow = await trySelect('user_id, role, total_earned, pending_payout, paid_out, current_balance, held_balance, last_payout_at, updated_at');
    } catch {
      try {
        earningsRow = await trySelect('user_id, role, total_earned, pending_payout, paid_out, current_balance, last_payout_at, updated_at');
      } catch {
        earningsRow = null;
      }
    }

    let requests: any[] = [];
    try {
      const { data } = await supabaseAdmin
        .from('payout_requests')
        .select('id, amount, status, requested_at, processed_at, rejection_reason, created_at')
        .eq('user_id', profileId)
        .eq('role', requestedRole)
        .order('created_at', { ascending: false })
        .limit(10);
      requests = (data as any[]) || [];
    } catch {
      requests = [];
    }

    const earnings = earningsRow
      ? {
          user_id: String((earningsRow as any).user_id),
          role: String((earningsRow as any).role),
          total_earned: safe((earningsRow as any).total_earned),
          pending_payout: safe((earningsRow as any).pending_payout),
          paid_out: safe((earningsRow as any).paid_out),
          current_balance: safe((earningsRow as any).current_balance),
          held_balance: safe((earningsRow as any).held_balance),
          last_payout_at: (earningsRow as any).last_payout_at || null,
          updated_at: (earningsRow as any).updated_at || null,
        }
      : {
          user_id: profileId,
          role: requestedRole,
          total_earned: 0,
          pending_payout: 0,
          paid_out: 0,
          current_balance: 0,
          held_balance: 0,
          last_payout_at: null,
          updated_at: null,
        };

    return json(200, { profileId, earnings, payout_requests: requests || [] });
  } catch (e) {
    return json(500, { error: 'Unexpected error', details: e instanceof Error ? e.message : String(e) });
  }
};

export { handler };
