import type { Handler } from '@netlify/functions';
import { createSupabaseAdmin } from './_lib/supabase';
import { getEnvBool, getEnvNumber } from './_lib/env';
import { getPayPalAccessToken, getPayPalBaseUrl, paypalRequestId } from './_lib/paypal';
import { round2, toAmountString } from './_lib/money';
import { getTimeZoneDateString, isTodayScheduledPayday, resolveRequestedPayoutDate } from './_lib/payoutSchedule';

type LedgerRow = {
  id: string;
  order_id: string | null;
  insurance_lead_id: string | null;
  seller_id: string | null;
  partner_id: string | null;
  influencer_id: string | null;
  seller_earnings: number;
  partner_earnings: number;
  influencer_earnings: number;
  status: string;
};

type PayeeRole = 'SELLER' | 'PARTNER' | 'INFLUENCER';

type Entry = {
  ledgerId: string | null;
  orderMoneyLedgerId?: string | null;
  orderId: string | null;
  userId: string;
  role: PayeeRole;
  amount: number;
};

const roleToMoneyPayeeType = (role: PayeeRole) =>
  role === 'SELLER' ? 'seller' : role === 'PARTNER' ? 'affiliate' : 'influencer';

const hasShippingAddress = (value: unknown) =>
  Boolean(value && typeof value === 'object' && Object.keys(value as Record<string, unknown>).length);

const getEligibleLedgerIds = async (supabaseAdmin: ReturnType<typeof createSupabaseAdmin>, rows: LedgerRow[]) => {
  const candidateOrderIds = Array.from(new Set(rows.map((r) => String(r?.order_id || '')).filter(Boolean)));
  const candidateLeadIds = Array.from(new Set(rows.map((r) => String(r?.insurance_lead_id || '')).filter(Boolean)));

  const eligibleLedgerIds = new Set<string>();

  if (candidateOrderIds.length) {
    const { data: orders } = await supabaseAdmin
      .from('orders')
      .select('id, dispute_status, status, payment_status, shipping_address, tracking_number')
      .in('id', candidateOrderIds);

    const eligibleOrderIds = new Set(
      ((orders as any[]) || [])
        .filter((o) => {
          const dispute = String(o?.dispute_status || 'NONE').toUpperCase();
          const status = String(o?.status || '').toLowerCase();
          const payStatus = String(o?.payment_status || '').toLowerCase();
          const trackingNumber = String(o?.tracking_number || '').trim();
          if (dispute !== 'NONE') return false;
          if (status.includes('refund')) return false;
          if (status.includes('cancel')) return false;
          if (payStatus.includes('refund')) return false;
          if (hasShippingAddress(o?.shipping_address) && !trackingNumber) return false;
          return true;
        })
        .map((o) => String(o.id))
    );

    for (const row of rows) {
      if (row?.order_id && eligibleOrderIds.has(String(row.order_id))) {
        eligibleLedgerIds.add(String(row.id));
      }
    }
  }

  if (candidateLeadIds.length) {
    const [leadResult, disputeResult] = await Promise.all([
      supabaseAdmin
        .from('insurance_leads')
        .select('id, status')
        .in('id', candidateLeadIds),
      supabaseAdmin
        .from('insurance_lead_disputes')
        .select('lead_id, status')
        .in('lead_id', candidateLeadIds)
        .eq('status', 'open'),
    ]);

    const openDisputeLeadIds = new Set(
      ((disputeResult.data as any[]) || []).map((row) => String(row?.lead_id || '')).filter(Boolean)
    );

    const eligibleLeadIds = new Set(
      ((leadResult.data as any[]) || [])
        .filter((lead) => {
          const status = String(lead?.status || '').toLowerCase();
          if (openDisputeLeadIds.has(String(lead?.id || ''))) return false;
          return status === 'delivered' || status === 'dispute_denied';
        })
        .map((lead) => String(lead.id))
    );

    for (const row of rows) {
      if (row?.insurance_lead_id && eligibleLeadIds.has(String(row.insurance_lead_id))) {
        eligibleLedgerIds.add(String(row.id));
      }
    }
  }

  return eligibleLedgerIds;
};

export const config = {
  // Daily payout run (uses service role key). Disable via PAYOUTS_SCHEDULED_ENABLED=false.
  schedule: '0 8 * * *',
};

const releaseMaturedHolds = async (supabaseAdmin: ReturnType<typeof createSupabaseAdmin>, nowIso: string) => {
  try {
    const { data: pendingLedgers } = await supabaseAdmin
      .from('payout_ledger')
      .select('id, order_id, insurance_lead_id, status, hold_release_at')
      .eq('status', 'PENDING_HOLD')
      .lte('hold_release_at', nowIso)
      .limit(2000);

    const candidates = (pendingLedgers as any as LedgerRow[]) || [];
    const eligibleLedgerIds = Array.from(await getEligibleLedgerIds(supabaseAdmin, candidates));

    if (!eligibleLedgerIds.length) {
      return { released: 0 };
    }

    await supabaseAdmin
      .from('payout_ledger')
      .update({ status: 'READY_TO_PAY', updated_at: new Date().toISOString() } as any)
      .in('id', eligibleLedgerIds)
      .eq('status', 'PENDING_HOLD');

    await supabaseAdmin
      .from('payout_snapshots')
      .update({ status: 'READY_TO_PAY', updated_at: new Date().toISOString() } as any)
      .in('ledger_id', eligibleLedgerIds)
      .eq('status', 'PENDING_HOLD');

    const insuranceLeadIds = candidates
      .filter((row) => eligibleLedgerIds.includes(String(row.id)))
      .map((row) => String(row.insurance_lead_id || ''))
      .filter(Boolean);

    if (insuranceLeadIds.length) {
      await Promise.all([
        supabaseAdmin
          .from('insurance_affiliate_earnings')
          .update({ status: 'ready_to_pay', updated_at: new Date().toISOString() } as any)
          .in('lead_id', insuranceLeadIds)
          .not('status', 'in', '(paid,canceled,on_hold_dispute)'),
        supabaseAdmin
          .from('insurance_influencer_earnings')
          .update({ status: 'ready_to_pay', updated_at: new Date().toISOString() } as any)
          .in('lead_id', insuranceLeadIds)
          .not('status', 'in', '(paid,canceled,on_hold_dispute)'),
      ]);
    }

    return { released: eligibleLedgerIds.length };
  } catch {
    return { released: 0 };
  }
};

export const handler: Handler = async () => {
  const scheduledEnabled = getEnvBool('PAYOUTS_SCHEDULED_ENABLED', false);
  if (!scheduledEnabled) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, skipped: true, reason: 'PAYOUTS_SCHEDULED_ENABLED=false' }),
    };
  }

  const supabaseAdmin = createSupabaseAdmin();
  const nowIso = new Date().toISOString();
  const releaseResult = await releaseMaturedHolds(supabaseAdmin, nowIso);

  const autoApproveEnabled = getEnvBool('PAYOUTS_AUTO_APPROVE', false);
  if (!autoApproveEnabled) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ok: true,
        skipped: true,
        released_holds: releaseResult.released,
        reason: 'PAYOUTS_AUTO_APPROVE=false (manual approval required)',
      }),
    };
  }

  const payoutsPaused = getEnvBool('PAYOUTS_PAUSED', false);
  if (payoutsPaused) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, skipped: true, released_holds: releaseResult.released, reason: 'PAYOUTS_PAUSED=true' }),
    };
  }

  const usePaypalApi = getEnvBool('PAYOUTS_ENABLED', getEnvBool('PAYPAL_PAYOUTS_API_ENABLED', false));
  if (!usePaypalApi) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, skipped: true, released_holds: releaseResult.released, reason: 'PAYOUTS_ENABLED=false' }),
    };
  }

  if (!isTodayScheduledPayday()) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ok: true,
        skipped: true,
        released_holds: releaseResult.released,
        reason: `Not a scheduled payday (${getTimeZoneDateString(new Date())})`,
      }),
    };
  }
  const { payoutDate, cutoffIso } = resolveRequestedPayoutDate(getTimeZoneDateString(new Date()));
  const batchCutoffIso = cutoffIso;

  try {
    await supabaseAdmin.rpc('release_order_money_ledger_holds', { p_now: batchCutoffIso });
  } catch {
    // The itemized ledger migration may not be installed in older environments yet.
  }

  const { data: ledgerRows, error: ledgerError } = await supabaseAdmin
    .from('payout_ledger')
    .select('id, order_id, insurance_lead_id, seller_id, partner_id, influencer_id, seller_earnings, partner_earnings, influencer_earnings, status')
    .eq('status', 'READY_TO_PAY')
    .lte('hold_release_at', batchCutoffIso)
    .limit(1000);

  if (ledgerError) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: ledgerError.message }),
    };
  }

  const rows = (ledgerRows as any as LedgerRow[]) || [];
  if (!rows.length) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, message: 'No payouts eligible' }),
    };
  }

  const eligibleLedgerIds = await getEligibleLedgerIds(supabaseAdmin, rows);
  const eligibleRows = rows.filter((row) => eligibleLedgerIds.has(String(row.id)));
  if (!eligibleRows.length) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, message: 'No payouts eligible after insurance/order checks' }),
    };
  }

  const minimumPayout = getEnvNumber('PAYOUTS_MINIMUM', getEnvNumber('PAYPAL_MIN_PAYOUT', 25));

  const legacyLedgerIdByOrderId = new Map<string, string>();
  for (const row of eligibleRows) {
    if (row.order_id) legacyLedgerIdByOrderId.set(String(row.order_id), String(row.id));
  }

  const moneyLedgerEntries: Entry[] = [];
  const moneyLedgerOrderIds = new Set<string>();
  try {
    const candidateOrderIds = Array.from(legacyLedgerIdByOrderId.keys());
    if (candidateOrderIds.length) {
      const { data: moneyRows } = await supabaseAdmin
        .from('order_money_ledger')
        .select('id, order_id, payee_type, payee_id, net_amount, status, payout_batch_id')
        .in('order_id', candidateOrderIds)
        .in('payee_type', ['seller', 'affiliate', 'influencer'])
        .eq('status', 'ready')
        .is('payout_batch_id', null);

      for (const row of ((moneyRows as any[]) || [])) {
        const orderId = String(row?.order_id || '').trim();
        const payeeId = String(row?.payee_id || '').trim();
        const amount = round2(Number(row?.net_amount || 0));
        if (!orderId || !payeeId || amount <= 0) continue;
        const payeeType = String(row?.payee_type || '').toLowerCase();
        const role: PayeeRole | null =
          payeeType === 'seller' ? 'SELLER' :
          payeeType === 'affiliate' ? 'PARTNER' :
          payeeType === 'influencer' ? 'INFLUENCER' :
          null;
        if (!role) continue;
        moneyLedgerOrderIds.add(orderId);
        moneyLedgerEntries.push({
          ledgerId: legacyLedgerIdByOrderId.get(orderId) || null,
          orderMoneyLedgerId: String(row.id),
          orderId,
          userId: payeeId,
          role,
          amount,
        });
      }
    }
  } catch {
    // Keep the legacy payout path working if the itemized ledger is not deployed yet.
  }

  const entries: Entry[] = [...moneyLedgerEntries];
  for (const row of eligibleRows) {
    if (row.order_id && moneyLedgerOrderIds.has(String(row.order_id))) continue;
    if (row.seller_id && row.seller_earnings > 0) entries.push({ ledgerId: row.id, orderId: row.order_id, userId: row.seller_id, role: 'SELLER', amount: round2(row.seller_earnings) });
    if (row.partner_id && row.partner_earnings > 0) entries.push({ ledgerId: row.id, orderId: row.order_id, userId: row.partner_id, role: 'PARTNER', amount: round2(row.partner_earnings) });
    if (row.influencer_id && row.influencer_earnings > 0) entries.push({ ledgerId: row.id, orderId: row.order_id, userId: row.influencer_id, role: 'INFLUENCER', amount: round2(row.influencer_earnings) });
  }

  if (!entries.length) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, message: 'No positive payout entries found' }),
    };
  }

  const userIds = Array.from(new Set(entries.map((e) => e.userId)));
  const { data: paypalAccounts, error: paypalError } = await supabaseAdmin
    .from('paypal_accounts')
    .select('user_id, role, paypal_email')
    .in('user_id', userIds);

  if (paypalError) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: paypalError.message }),
    };
  }

  const accountMap = new Map<string, { email: string }>();
  for (const row of (paypalAccounts as any[]) || []) {
    const key = `${row.user_id}::${row.role}`;
    accountMap.set(key, { email: String(row.paypal_email || '') });
  }

  // Totals per payee (enforce minimum payout)
  const totals = new Map<string, number>();
  for (const entry of entries) {
    const key = `${entry.userId}::${entry.role}`;
    const account = accountMap.get(key);
    if (!account?.email) continue;
    totals.set(key, round2((totals.get(key) || 0) + entry.amount));
  }

  const eligiblePayeeKeys = new Set<string>();
  for (const [key, total] of totals.entries()) {
    if (total >= minimumPayout) eligiblePayeeKeys.add(key);
  }

  let payoutEntries = entries.filter((e) => eligiblePayeeKeys.has(`${e.userId}::${e.role}`));
  if (!payoutEntries.length) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, message: `No payees met minimum threshold ($${minimumPayout})` }),
    };
  }

  // Prevent duplicate payout items for the same ledger/payee/role.
  try {
    const ledgerIds = Array.from(new Set(payoutEntries.map((e) => e.ledgerId).filter(Boolean))) as string[];
    const moneyLedgerIds = Array.from(new Set(payoutEntries.map((e) => e.orderMoneyLedgerId).filter(Boolean))) as string[];
    const existingItems: any[] = [];
    if (ledgerIds.length) {
      const { data } = await supabaseAdmin
        .from('payout_items')
        .select('ledger_id, payee_user_id, payee_role, status')
        .in('ledger_id', ledgerIds)
        .in('status', ['PREPARED', 'CREATED', 'SENT']);
      existingItems.push(...((data as any[]) || []));
    }
    if (moneyLedgerIds.length) {
      const { data } = await supabaseAdmin
        .from('payout_items')
        .select('order_money_ledger_id, payee_user_id, payee_role, status')
        .in('order_money_ledger_id', moneyLedgerIds)
        .in('status', ['PREPARED', 'CREATED', 'SENT']);
      existingItems.push(...((data as any[]) || []));
    }

    const existingSet = new Set<string>();
    for (const it of (existingItems as any[]) || []) {
      const ledgerId = it?.ledger_id ? String(it.ledger_id) : '';
      const moneyLedgerId = it?.order_money_ledger_id ? String(it.order_money_ledger_id) : '';
      const payeeUserId = it?.payee_user_id ? String(it.payee_user_id) : '';
      const payeeRole = it?.payee_role ? String(it.payee_role) : '';
      if (ledgerId && payeeUserId && payeeRole) existingSet.add(`${ledgerId}::${payeeUserId}::${payeeRole}`);
      if (moneyLedgerId && payeeUserId && payeeRole) existingSet.add(`money:${moneyLedgerId}::${payeeUserId}::${payeeRole}`);
    }

    payoutEntries = payoutEntries.filter((e) => {
      if (e.orderMoneyLedgerId && existingSet.has(`money:${e.orderMoneyLedgerId}::${e.userId}::${e.role}`)) return false;
      if (e.ledgerId && existingSet.has(`${e.ledgerId}::${e.userId}::${e.role}`)) return false;
      return true;
    });
  } catch {
    // non-fatal
  }

  if (!payoutEntries.length) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, message: 'No payouts eligible (all already queued/sent).' }),
    };
  }

  const batchId = crypto.randomUUID();

  const payoutItemRows: any[] = [];
  for (const entry of payoutEntries) {
    const account = accountMap.get(`${entry.userId}::${entry.role}`);
    if (!account?.email) continue;
    payoutItemRows.push({
      payout_batch_id: batchId,
      ledger_id: entry.ledgerId,
      order_money_ledger_id: entry.orderMoneyLedgerId || null,
      payee_user_id: entry.userId,
      payee_role: entry.role,
      recipient: account.email.toLowerCase(),
      amount: entry.amount,
      status: 'CREATED',
    });
  }

  // Create batch first so items can reference it
  const { error: batchError } = await supabaseAdmin
    .from('payout_batches')
    .insert({
      id: batchId,
      provider: 'paypal',
      status: 'CREATED',
      total_amount: round2(payoutItemRows.reduce((acc, e) => acc + Number(e.amount || 0), 0)),
      item_count: payoutItemRows.length,
    } as any);

  if (batchError) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: batchError.message }),
    };
  }

  const { data: createdItems, error: itemsError } = await supabaseAdmin
    .from('payout_items')
    .insert(payoutItemRows as any)
    .select('id, recipient, amount');

  if (itemsError) {
    await supabaseAdmin.from('payout_batches').update({ status: 'FAILED' } as any).eq('id', batchId);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: itemsError.message }),
    };
  }

  try {
    for (const entry of payoutEntries) {
      if (!entry.orderId) continue;
      await supabaseAdmin
        .from('order_money_ledger')
        .update({ payout_batch_id: batchId, updated_at: new Date().toISOString() } as any)
        .eq('order_id', entry.orderId)
        .eq('payee_id', entry.userId)
        .eq('payee_type', roleToMoneyPayeeType(entry.role))
        .eq('status', 'ready')
        .is('payout_batch_id', null);
    }
  } catch {
    // Keep payouts working if the itemized ledger is not deployed yet.
  }

  const payPalItems = (createdItems as any[]).map((row) => ({
    recipient_type: 'EMAIL',
    receiver: String(row.recipient),
    amount: { value: toAmountString(Number(row.amount)), currency: 'USD' },
    note: `Beezio payout for ${payoutDate}`,
    sender_item_id: String(row.id),
  }));

  const token = await getPayPalAccessToken();
  const baseUrl = await getPayPalBaseUrl();

  const res = await fetch(`${baseUrl}/v1/payments/payouts`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'PayPal-Request-Id': paypalRequestId(`bzo_payout_${batchId}`),
    },
    body: JSON.stringify({
      sender_batch_header: {
        sender_batch_id: `BZO_${batchId}`,
        email_subject: `Your Beezio payout for ${payoutDate}`,
        email_message: `Your Beezio payout for ${payoutDate} has been issued.`,
      },
      items: payPalItems,
    }),
  });

  const apiData = await res.json().catch(() => ({}));
  if (!res.ok) {
    // Allow retry: mark items FAILED (unique index only blocks CREATED/SENT)
    await supabaseAdmin
      .from('payout_items')
      .update({ status: 'FAILED', error_message: 'PAYPAL_BATCH_FAILED' } as any)
      .eq('payout_batch_id', batchId)
      .eq('status', 'CREATED');

    await supabaseAdmin.from('payout_batches').update({ status: 'FAILED' } as any).eq('id', batchId);

    try {
      await supabaseAdmin
        .from('order_money_ledger')
        .update({ payout_batch_id: null, updated_at: new Date().toISOString() } as any)
        .eq('payout_batch_id', batchId)
        .eq('status', 'ready');
    } catch {
      // non-fatal
    }

    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'PayPal payout batch failed', batch_id: batchId, details: apiData }),
    };
  }

  const providerBatchId = String((apiData as any)?.batch_header?.payout_batch_id || '').trim() || null;

  await supabaseAdmin
    .from('payout_batches')
    .update({
      status: 'SUBMITTED',
      provider_batch_id: providerBatchId,
      submitted_at: new Date().toISOString(),
    } as any)
    .eq('id', batchId);

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ok: true, batch_id: batchId, payout_date: payoutDate, cutoff_iso: cutoffIso, provider_batch_id: providerBatchId, item_count: payPalItems.length }),
  };
};

export default handler;
