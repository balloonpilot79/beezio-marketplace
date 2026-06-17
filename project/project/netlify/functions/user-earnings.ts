import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { summarizePayeeSnapshots, type PayeeRole } from '../../server/payments/paypalPayoutLedger';

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
    const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

    let body: any = {};
    try {
      body = event.body ? JSON.parse(event.body) : {};
    } catch {
      body = {};
    }

    const bodyToken = String(body?._access_token || body?.access_token || '').trim();
    const headerToken = String(event.headers.authorization || event.headers.Authorization || '').trim();
    const authHeader = headerToken || (bodyToken ? (bodyToken.startsWith('Bearer ') ? bodyToken : `Bearer ${bodyToken}`) : '');
    const supabaseHost = (() => {
      try {
        const url = requireEnv('SUPABASE_URL', ['VITE_SUPABASE_URL']);
        return new URL(url).host;
      } catch {
        return 'unknown';
      }
    })();
    if (!authHeader) {
      return json(401, {
        error: 'Missing authorization header',
        debug: { hasBodyToken: Boolean(bodyToken), hasAuthHeader: Boolean(headerToken), supabaseHost },
      });
    }

    // Validate JWT with the service role key to avoid anon-key mismatches in Netlify.
    const { user, error: authErr } = await getAuthedUser({ supabaseUrl, anonKey: serviceRoleKey, authHeader });
    if (!user) return json(401, { error: 'Unauthorized', details: authErr, debug: { supabaseHost } });
    const userId = String(user.id || '');
    const requestedRole = String(body?.role || '').toLowerCase().trim();
    if (requestedRole !== 'seller' && requestedRole !== 'affiliate' && requestedRole !== 'influencer') {
      return json(400, { error: 'Invalid role' });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { data: profileRows, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, user_id')
      .or(`id.eq.${userId},user_id.eq.${userId}`)
      .limit(10);
    if (profileError) return json(500, { error: 'Failed to load profile', details: profileError.message });
    const rows = Array.isArray(profileRows) ? profileRows : (profileRows ? [profileRows] : []);
    const matched =
      rows.find((r: any) => String(r?.user_id || '') === String(userId)) ||
      rows.find((r: any) => String(r?.id || '') === String(userId)) ||
      rows[0];
    const profileId = matched?.id ? String(matched.id) : null;
    if (!profileId) return json(400, { error: 'Missing profile for user' });

    const payeeRole: PayeeRole =
      requestedRole === 'seller'
        ? 'SELLER'
        : requestedRole === 'influencer'
          ? 'INFLUENCER'
          : 'PARTNER';
    const { data: snapshotRows, error: snapshotError } = await supabaseAdmin
      .from('payout_snapshots')
      .select('payee_user_id, payee_role, amount, status, hold_release_at, paid_at, updated_at, created_at')
      .eq('payee_user_id', profileId)
      .eq('payee_role', payeeRole)
      .order('created_at', { ascending: false })
      .limit(500);

    if (snapshotError) return json(500, { error: 'Failed to load payout snapshots', details: snapshotError.message });

    const summary = summarizePayeeSnapshots((snapshotRows as any[]) || [], profileId, payeeRole);
    const latestRow = Array.isArray(snapshotRows) && snapshotRows.length > 0 ? snapshotRows[0] : null;

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

    const earnings = {
      user_id: profileId,
      role: requestedRole,
      total_earned: summary.total,
      pending_payout: summary.available,
      paid_out: summary.paid,
      current_balance: summary.available,
      held_balance: summary.pending + summary.onHold,
      pending_hold_balance: summary.pending,
      dispute_hold_balance: summary.onHold,
      last_payout_at: (latestRow as any)?.paid_at || null,
      updated_at: (latestRow as any)?.updated_at || null,
      next_release_at: summary.nextReleaseAt,
    };

    return json(200, { profileId, earnings, payout_requests: requests || [] });
  } catch (e) {
    return json(500, { error: 'Unexpected error', details: e instanceof Error ? e.message : String(e) });
  }
};

export { handler };
