import { readAccountingPages } from './_lib/accounting-pagination';
import { annotateReversedEarnings, summarizeEarningActivity } from '../../shared/accountingStatus';
import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { summarizePayeeSnapshots, type PayeeRole } from '../../server/payments/paypalPayoutLedger';

function json(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
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
    const ownerIds = [...new Set([userId, ...rows.map((row: any) => String(row.id))])];
    let snapshotRows = await readAccountingPages((from, to) => supabaseAdmin
      .from('payout_snapshots')
      .select('id, order_id, ledger_id, payee_user_id, payee_role, amount, status, hold_release_at, paid_at, updated_at, created_at, snapshot_json')
      .in('payee_user_id', ownerIds)
      .eq('payee_role', payeeRole)
      .order('created_at', { ascending: false }).order('id', { ascending: false })
      .range(from, to));


    const orderIds = [...new Set(snapshotRows.map(row => row.order_id).filter(Boolean))];
    const orderStates: any[] = [];
    for (let offset = 0; offset < orderIds.length; offset += 200) {
      orderStates.push(...await readAccountingPages((from, to) => supabaseAdmin.from('orders')
        .select('id,status,payment_status').in('id', orderIds.slice(offset, offset + 200)).order('id').range(from, to)));
    }
    snapshotRows = annotateReversedEarnings(snapshotRows, orderStates);
    const historicalPaid = snapshotRows.filter(row => row.status === 'PAID').reduce((sum, row) => sum + Math.round(Number(row.amount || 0) * 100), 0) / 100;
    const refundedAfterPayout = snapshotRows.filter(row => row.status === 'PAID' && row.accounting_reversed).reduce((sum, row) => sum + Math.round(Number(row.amount || 0) * 100), 0) / 100;
    const summary = summarizePayeeSnapshots(snapshotRows, null, payeeRole);
    const latestRow = Array.isArray(snapshotRows) && snapshotRows.length > 0 ? snapshotRows[0] : null;
    const lastPaidRow = ((snapshotRows as any[]) || []).find((row: any) => String(row?.status || '').toUpperCase() === 'PAID' && Boolean(row?.paid_at));

    let requests: any[] = [];
    try {
      const data = await readAccountingPages((from, to) => supabaseAdmin
        .from('payout_requests')
        .select('id, amount, status, requested_at, processed_at, rejection_reason, created_at')
        .in('user_id', ownerIds)
        .eq('role', requestedRole)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false }).range(from, to));
      requests = (data as any[]) || [];
    } catch {
      requests = [];
    }

    const earnings = {
      user_id: profileId,
      role: requestedRole,
      total_earned: summary.total,
      pending_payout: summary.available,
      paid_out: historicalPaid,
      refunded_after_payout: refundedAfterPayout,
      current_balance: summary.available,
      held_balance: summary.pending + summary.onHold,
      pending_hold_balance: summary.pending,
      dispute_hold_balance: summary.onHold,
      last_payout_at: (lastPaidRow as any)?.paid_at || null,
      updated_at: (latestRow as any)?.updated_at || null,
      next_release_at: summary.nextReleaseAt,
    };

    const payoutItems = await readAccountingPages((from, to) => supabaseAdmin
      .from('payout_items')
      .select('id, ledger_id, recipient, amount, status, payee_role, provider_item_id, error_message, created_at, updated_at')
      .in('payee_user_id', ownerIds)
      .eq('payee_role', payeeRole)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false }).range(from, to));

    return json(200, {
      profileId,
      earnings,
      activity: summarizeEarningActivity(snapshotRows),
      earnings_history: snapshotRows,
      payout_history: (payoutItems as any[]) || [],
      payout_requests: requests || [],
    });
  } catch (e) {
    return json(500, { error: 'Unexpected error', details: e instanceof Error ? e.message : String(e) });
  }
};

export { handler };
