import type { Handler } from '@netlify/functions';
import { createSupabaseAdmin } from './_lib/supabase';
import { json, assertPost, parseJson } from './_lib/http';
import { requireAdmin } from './_lib/auth';
import { getEnvBool, getEnvNumber } from './_lib/env';
import { getScheduledPaydayOnOrAfter, resolveRequestedPayoutDate } from './_lib/payoutSchedule';

type Body = {
  payout_date?: string;
};

type LedgerRow = {
  id: string;
  status: string;
  order_id?: string | null;
  seller_id: string | null;
  partner_id: string | null;
  influencer_id: string | null;
  seller_earnings: number;
  partner_earnings: number;
  influencer_earnings: number;
  gross_amount?: number | null;
  beezio_profit?: number | null;
  hold_release_at: string;
  created_at?: string | null;
  paid_at?: string | null;
};

type SnapshotRow = {
  id: string;
  order_id: string | null;
  payee_user_id: string | null;
  payee_role: 'SELLER' | 'PARTNER' | 'INFLUENCER';
  amount: number;
  status: string;
  hold_release_at: string | null;
  paid_at?: string | null;
  created_at?: string | null;
};

type PaypalAccountRow = {
  user_id: string;
  role: 'SELLER' | 'PARTNER' | 'INFLUENCER';
  paypal_email: string;
  is_verified: boolean;
};

type PayeeSummary = {
  user_id: string;
  role: 'SELLER' | 'PARTNER' | 'INFLUENCER';
  name: string;
  contact_email: string;
  paypal_email: string;
  email: string;
  total: number;
  lineCount: number;
  nextPayoutDate?: string | null;
};

type DailySummary = {
  date: string;
  orders: number;
  gross_amount: number;
  payout_total: number;
  beezio_profit: number;
};

export const handler: Handler = async (event) => {
  try {
    assertPost(event.httpMethod);
    await requireAdmin(event);

    const body = parseJson<Body>(event.body);
    const { payoutDate, cutoffIso } = resolveRequestedPayoutDate(body?.payout_date);

    const supabaseAdmin = createSupabaseAdmin();
    const nowIso = cutoffIso;

    const payoutsPaused = getEnvBool('PAYOUTS_PAUSED', false);
    const payoutsEnabled = getEnvBool('PAYOUTS_ENABLED', getEnvBool('PAYPAL_PAYOUTS_API_ENABLED', false));
    const minimumPayout = getEnvNumber('PAYOUTS_MINIMUM', getEnvNumber('PAYPAL_MIN_PAYOUT', 0.01));
    const scheduledEnabled = getEnvBool('PAYOUTS_SCHEDULED_ENABLED', false);

    const { data: snapshotRows, error: snapshotError } = await supabaseAdmin
      .from('payout_snapshots')
      .select('id, order_id, payee_user_id, payee_role, amount, status, hold_release_at, paid_at, created_at')
      .in('status', ['READY_TO_PAY', 'PENDING_HOLD', 'ON_HOLD_DISPUTE', 'PAID'])
      .limit(2000);

    if (snapshotError) return json(500, { error: snapshotError.message });

    const rows = (snapshotRows as any as SnapshotRow[]) || [];

    const counts = {
      pending_hold_total: rows.filter((r) => r.status === 'PENDING_HOLD').length,
      pending_hold_matured: rows.filter((r) => r.status === 'PENDING_HOLD' && String(r.hold_release_at) <= nowIso).length,
      ready_to_pay: rows.filter((r) => (r.status === 'READY_TO_PAY' || (r.status === 'PENDING_HOLD' && String(r.hold_release_at) <= nowIso)) && getScheduledPaydayOnOrAfter(r.hold_release_at) <= payoutDate).length,
      on_hold_dispute: rows.filter((r) => r.status === 'ON_HOLD_DISPUTE').length,
    };

    // Find next eligible payout date for each payee (even if not yet matured)
    const userIds = new Set<string>(rows.map((r) => String(r.payee_user_id || '')).filter(Boolean));

    const payees: PayeeSummary[] = [];
    const payableRows = rows.filter((r) => {
      const status = String(r.status || '').toUpperCase();
      if (status !== 'READY_TO_PAY' && status !== 'PENDING_HOLD') return false;
      if (String(r.hold_release_at || '') > nowIso) return false;
      return getScheduledPaydayOnOrAfter(r.hold_release_at) <= payoutDate;
    });
    if (userIds.size) {
      const { data: profiles, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('id, user_id, full_name, email')
        .or(Array.from(userIds).map((id) => `id.eq.${id},user_id.eq.${id}`).join(','));

      if (profileError) return json(500, { error: profileError.message });

      const { data: accounts, error: accountError } = await supabaseAdmin
        .from('paypal_accounts')
        .select('user_id, role, paypal_email, is_verified')
        .in('user_id', Array.from(userIds));

      if (accountError) return json(500, { error: accountError.message });

      const accountMap = new Map<string, PaypalAccountRow>();
      for (const a of (accounts as any[]) || []) {
        if (a?.is_verified === true) {
          accountMap.set(`${a.user_id}::${a.role}`, a as PaypalAccountRow);
        }
      }

      const profileMap = new Map<string, { name: string; contact_email: string }>();
      for (const profile of (profiles as any[]) || []) {
        const id = String((profile as any)?.id || '').trim();
        const userId = String((profile as any)?.user_id || '').trim();
        const payload = {
          name: String((profile as any)?.full_name || (profile as any)?.email || '').trim(),
          contact_email: String((profile as any)?.email || '').trim(),
        };
        if (id) profileMap.set(id, payload);
        if (userId) profileMap.set(userId, payload);
      }

      // Map: payee+role -> { total, lineCount, nextPayoutDate }
      const totals = new Map<string, PayeeSummary>();
      const add = (profileId: string, role: PaypalAccountRow['role'], amount: number, holdReleaseAt: string | null) => {
        const acct = accountMap.get(`${profileId}::${role}`);
        const profile = profileMap.get(profileId);
        const paypalEmail = String(acct?.paypal_email || '').trim();
        const contactEmail = String(profile?.contact_email || '').trim();
        const key = `${String(profileId).trim()}::${String(role).trim().toUpperCase()}`;
        const current = totals.get(key) || {
          user_id: profileId,
          role,
          name: String(profile?.name || paypalEmail || contactEmail || profileId).trim(),
          contact_email: contactEmail,
          paypal_email: paypalEmail,
          email: paypalEmail || contactEmail,
          total: 0,
          lineCount: 0,
          nextPayoutDate: null,
        };
        current.total += Number(amount) || 0;
        current.lineCount += 1;
        const scheduledPayday = getScheduledPaydayOnOrAfter(holdReleaseAt);
        if (!current.nextPayoutDate || scheduledPayday < current.nextPayoutDate) {
          current.nextPayoutDate = scheduledPayday;
        }
        totals.set(key, current);
      };

      for (const r of payableRows) {
        if (!r.payee_user_id) continue;
        add(String(r.payee_user_id), String(r.payee_role || 'SELLER') as PaypalAccountRow['role'], Number(r.amount || 0), r.hold_release_at);
      }

      for (const v of totals.values()) payees.push(v);
      payees.sort((a, b) => b.total - a.total);
    }

    const { data: ledgerAnalyticsRows, error: analyticsError } = await supabaseAdmin
      .from('payout_ledger')
      .select('id, order_id, status, gross_amount, seller_earnings, partner_earnings, influencer_earnings, beezio_profit, created_at, paid_at')
      .order('created_at', { ascending: false })
      .limit(1000);

    if (analyticsError) return json(500, { error: analyticsError.message });

    const analyticsRows = (ledgerAnalyticsRows as any as LedgerRow[]) || [];
    const byCreatedDate = new Map<string, DailySummary>();
    const byPaidDate = new Map<string, DailySummary>();
    const byCreatedWeek = new Map<string, DailySummary>();
    const byCreatedMonth = new Map<string, DailySummary>();
    const byPaidWeek = new Map<string, DailySummary>();
    const byPaidMonth = new Map<string, DailySummary>();

    const toDay = (value: string | null | undefined): string | null => {
      if (!value) return null;
      const day = String(value).slice(0, 10);
      return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null;
    };

    const toMonth = (day: string | null): string | null => {
      if (!day) return null;
      return day.slice(0, 7);
    };

    const toWeek = (day: string | null): string | null => {
      if (!day) return null;
      const date = new Date(`${day}T00:00:00.000Z`);
      if (Number.isNaN(date.getTime())) return null;
      const utcDay = date.getUTCDay() || 7;
      date.setUTCDate(date.getUTCDate() - utcDay + 1);
      return date.toISOString().slice(0, 10);
    };

    const addSummary = (
      map: Map<string, DailySummary>,
      key: string | null,
      gross: number,
      payoutTotal: number,
      profit: number
    ) => {
      if (!key) return;
      const current = map.get(key) || {
        date: key,
        orders: 0,
        gross_amount: 0,
        payout_total: 0,
        beezio_profit: 0,
      };
      current.orders += 1;
      current.gross_amount += gross;
      current.payout_total += payoutTotal;
      current.beezio_profit += profit;
      map.set(key, current);
    };

    for (const row of analyticsRows) {
      const gross = Number(row.gross_amount || 0);
      const payoutTotal =
        Number(row.seller_earnings || 0) +
        Number(row.partner_earnings || 0) +
        Number(row.influencer_earnings || 0);
      const profit = Number(row.beezio_profit || 0);

      const createdDay = toDay(row.created_at);
      if (createdDay) {
        addSummary(byCreatedDate, createdDay, gross, payoutTotal, profit);
        addSummary(byCreatedWeek, toWeek(createdDay), gross, payoutTotal, profit);
        addSummary(byCreatedMonth, toMonth(createdDay), gross, payoutTotal, profit);
      }

      const paidDay = toDay(row.paid_at);
      if (paidDay) {
        addSummary(byPaidDate, paidDay, gross, payoutTotal, profit);
        addSummary(byPaidWeek, toWeek(paidDay), gross, payoutTotal, profit);
        addSummary(byPaidMonth, toMonth(paidDay), gross, payoutTotal, profit);
      }
    }

    const normalizeSummary = (items: DailySummary[]) =>
      items.map((item) => ({
        ...item,
        gross_amount: Math.round((item.gross_amount + Number.EPSILON) * 100) / 100,
        payout_total: Math.round((item.payout_total + Number.EPSILON) * 100) / 100,
        beezio_profit: Math.round((item.beezio_profit + Number.EPSILON) * 100) / 100,
      }));

    const dailySales = normalizeSummary(Array.from(byCreatedDate.values())).sort((a, b) => b.date.localeCompare(a.date));
    const dailyPayouts = normalizeSummary(Array.from(byPaidDate.values())).sort((a, b) => b.date.localeCompare(a.date));
    const weeklySales = normalizeSummary(Array.from(byCreatedWeek.values())).sort((a, b) => b.date.localeCompare(a.date));
    const monthlySales = normalizeSummary(Array.from(byCreatedMonth.values())).sort((a, b) => b.date.localeCompare(a.date));
    const weeklyPayouts = normalizeSummary(Array.from(byPaidWeek.values())).sort((a, b) => b.date.localeCompare(a.date));
    const monthlyPayouts = normalizeSummary(Array.from(byPaidMonth.values())).sort((a, b) => b.date.localeCompare(a.date));

    const recentLedger = analyticsRows.slice(0, 100).map((row) => ({
      id: row.id,
      order_id: row.order_id ?? null,
      status: row.status,
      created_at: row.created_at ?? null,
      paid_at: row.paid_at ?? null,
      gross_amount: Number(row.gross_amount || 0),
      seller_earnings: Number(row.seller_earnings || 0),
      partner_earnings: Number(row.partner_earnings || 0),
      influencer_earnings: Number(row.influencer_earnings || 0),
      payout_total: Math.round((
        Number(row.seller_earnings || 0) +
        Number(row.partner_earnings || 0) +
        Number(row.influencer_earnings || 0) +
        Number.EPSILON
      ) * 100) / 100,
      beezio_profit: Number(row.beezio_profit || 0),
    }));

    const { data: batches, error: batchError } = await supabaseAdmin
      .from('payout_batches')
      .select('id, status, provider_batch_id, total_amount, item_count, created_at, submitted_at')
      .order('created_at', { ascending: false })
      .limit(20);

    if (batchError) return json(500, { error: batchError.message });

    return json(200, {
      ok: true,
      env: {
        payoutsPaused,
        payoutsEnabled,
        minimumPayout,
        scheduledEnabled,
      },
      counts,
      payees,
      recent_batches: batches || [],
      daily_sales: dailySales,
      daily_payouts: dailyPayouts,
      weekly_sales: weeklySales,
      monthly_sales: monthlySales,
      weekly_payouts: weeklyPayouts,
      monthly_payouts: monthlyPayouts,
      recent_ledger: recentLedger,
      pending_snapshot_total: rows
        .filter((row) => row.status === 'PENDING_HOLD' || row.status === 'READY_TO_PAY' || row.status === 'ON_HOLD_DISPUTE')
        .reduce((sum, row) => sum + Number(row.amount || 0), 0),
      payout_date: payoutDate,
      cutoff_iso: cutoffIso,
    });
  } catch (e: any) {
    const statusCode = Number(e?.statusCode) || 500;
    return json(statusCode, { error: e instanceof Error ? e.message : 'Unexpected error' });
  }
};

export default handler;
