import { getPayoutHoldDays } from './env';
import { buildPayPalLedgerPlan } from '../../../server/payments/paypalPayoutLedger';
import { mirrorOrderToLegacyFinance } from './legacy-finance-mirror';
import { resolveRecruiterInfluencerId } from './influencer-referrals';

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

const addDaysIso = (baseIso: string, days: number) => {
  const base = new Date(baseIso);
  const safeBase = Number.isNaN(base.getTime()) ? new Date() : base;
  return new Date(safeBase.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
};

const ensureMinimumHoldReleaseAt = (paidAt: string, holdReleaseAt: string, minimumDays: number) => {
  const paidAtMs = new Date(paidAt).getTime();
  const holdReleaseAtMs = new Date(holdReleaseAt).getTime();
  if (Number.isNaN(paidAtMs)) return holdReleaseAt;
  const minimumHoldReleaseAt = addDaysIso(paidAt, minimumDays);
  if (Number.isNaN(holdReleaseAtMs) || holdReleaseAtMs < new Date(minimumHoldReleaseAt).getTime()) {
    return minimumHoldReleaseAt;
  }
  return holdReleaseAt;
};

const sameProfileId = (left: string | null | undefined, right: string | null | undefined): boolean => {
  const normalizedLeft = String(left || '').trim();
  const normalizedRight = String(right || '').trim();
  return Boolean(normalizedLeft && normalizedRight && normalizedLeft === normalizedRight);
};

const stripBuyerCommissionRoles = (
  plan: ReturnType<typeof buildPayPalLedgerPlan>,
  buyerId: string | null
) => {
  if (!buyerId) return plan;

  if (sameProfileId(plan.aggregate.partnerId, buyerId)) {
    plan.aggregate.partnerId = null;
    plan.aggregate.partnerEarnings = 0;
    plan.payees = plan.payees.filter((row) => !(row.payeeRole === 'PARTNER' && sameProfileId(row.payeeUserId, buyerId)));
    plan.moneyEntries = plan.moneyEntries.filter((row) => !(row.payeeType === 'affiliate' && sameProfileId(row.payeeId, buyerId)));
  }

  if (sameProfileId(plan.aggregate.influencerId, buyerId)) {
    plan.aggregate.influencerId = null;
    plan.aggregate.influencerEarnings = 0;
    plan.payees = plan.payees.filter((row) => !(row.payeeRole === 'INFLUENCER' && sameProfileId(row.payeeUserId, buyerId)));
    plan.moneyEntries = plan.moneyEntries.filter((row) => !(row.payeeType === 'influencer' && sameProfileId(row.payeeId, buyerId)));
  }

  return plan;
};

const normalizePlanHoldReleaseAt = (
  plan: ReturnType<typeof buildPayPalLedgerPlan>,
  paidAt: string,
  holdReleaseAt: string
) => {
  const enforcedHoldReleaseAt = ensureMinimumHoldReleaseAt(paidAt, holdReleaseAt, 14);

  plan.aggregate.holdReleaseAt = enforcedHoldReleaseAt;
  plan.payees = plan.payees.map((payee) => ({
    ...payee,
    holdReleaseAt: enforcedHoldReleaseAt,
    snapshot: {
      ...(payee.snapshot || {}),
      paid_at: paidAt,
      hold_release_at: enforcedHoldReleaseAt,
    },
  }));
  plan.moneyEntries = plan.moneyEntries.map((entry) => ({
    ...entry,
    holdUntil: enforcedHoldReleaseAt,
  }));

  return plan;
};

const extractMissingColumnName = (message: string): string | null => {
  const msg = String(message || '');
  const pg = msg.match(/column\s+"([^"]+)"\s+of\s+relation\s+"[^"]+"\s+does\s+not\s+exist/i);
  if (pg?.[1]) return pg[1];
  const pgDot = msg.match(/column\s+([a-z0-9_]+\.[a-z0-9_]+)\s+does\s+not\s+exist/i);
  if (pgDot?.[1]) return pgDot[1].split('.').pop() || pgDot[1];
  const pgrst = msg.match(/Could not find the '([^']+)' column of '[^']+' in the schema cache/i);
  if (pgrst?.[1]) return pgrst[1];
  return null;
};

const isRefundedOrderStatusEnumError = (error: any): boolean => {
  const message = [
    String((error as any)?.message || ''),
    String((error as any)?.details || ''),
    String((error as any)?.hint || ''),
  ]
    .join(' ')
    .toLowerCase();

  return (
    message.includes('invalid input value for enum') &&
    message.includes('order_status') &&
    message.includes('refunded')
  );
};

async function selectOrderItems(supabaseAdmin: any, orderId: string) {
  let columns = [
    'id',
    'quantity',
    'product_id',
    'variant_id',
    'seller_ask_amount',
    'partner_rate',
    'computed_listing_price',
    'products:product_id(title)',
  ];

  let lastError: any = null;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const { data, error } = await supabaseAdmin.from('order_items').select(columns.join(',')).eq('order_id', orderId);
    if (!error) return (data as any[]) || [];
    lastError = error;
    const missing = extractMissingColumnName(String((error as any)?.message || ''));
    if (missing && columns.includes(missing)) {
      columns = columns.filter((column) => column !== missing);
      continue;
    }
    break;
  }

  throw new Error(String((lastError as any)?.message || 'Failed to load order items'));
}

async function isInfluencerProfile(supabaseAdmin: any, profileId: string | null): Promise<boolean> {
  if (!profileId) return false;
  const { data: profileRow } = await supabaseAdmin
    .from('profiles')
    .select('role,primary_role')
    .eq('id', profileId)
    .maybeSingle();

  const role = String((profileRow as any)?.role || '').toLowerCase();
  const primaryRole = String((profileRow as any)?.primary_role || '').toLowerCase();
  return role === 'influencer' || primaryRole === 'influencer';
}

async function selectMaybeSingleWithFallback(
  supabaseAdmin: any,
  table: string,
  fields: string[],
  filterColumn: string,
  filterValue: string
) {
  let selected = [...fields];
  let lastError: any = null;

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const { data, error } = await supabaseAdmin.from(table).select(selected.join(',')).eq(filterColumn, filterValue).maybeSingle();
    if (!error) return { data: data || null, error: null, selected };
    lastError = error;
    const missing = extractMissingColumnName(String((error as any)?.message || ''));
    if (missing && selected.includes(missing)) {
      selected = selected.filter((field) => field !== missing);
      continue;
    }
    break;
  }

  return { data: null, error: lastError, selected };
}

async function writeOrderMoneyLedgerEntries(supabaseAdmin: any, entries: any[]) {
  if (!Array.isArray(entries) || entries.length === 0) {
    return { ok: true, inserted: 0 };
  }

  const rows = entries.map((entry) => ({
    source_key: entry.sourceKey,
    order_id: entry.orderId,
    order_item_id: entry.orderItemId,
    payee_type: entry.payeeType,
    payee_id: entry.payeeId,
    currency: entry.currency,
    gross_amount: entry.grossAmount,
    net_amount: entry.netAmount,
    status: entry.status,
    hold_until: entry.holdUntil,
    provider: entry.provider,
    provider_order_id: entry.providerOrderId,
    provider_capture_id: entry.providerCaptureId,
    metadata: entry.metadata || {},
  }));

  const query = supabaseAdmin.from('order_money_ledger');
  if (typeof query?.upsert !== 'function') {
    return { ok: false, skipped: true, reason: 'order_money_ledger_upsert_unavailable' };
  }

  const { error } = await query.upsert(rows, { onConflict: 'source_key' });

  if (error) {
    const message = String(error.message || '');
    if (
      message.includes('order_money_ledger') ||
      message.includes("Could not find the table") ||
      message.includes('schema cache')
    ) {
      console.warn('[paypal-order-finalization] order_money_ledger not available yet; skipping accounting mirror:', message);
      return { ok: false, skipped: true, reason: 'order_money_ledger_unavailable', error: message };
    }
    console.warn('[paypal-order-finalization] order_money_ledger write failed:', message);
    return { ok: false, skipped: true, reason: 'order_money_ledger_write_failed', error: message };
  }

  return { ok: true, inserted: rows.length };
}

function applyLegacyLedgerFallbacks(params: {
  plan: ReturnType<typeof buildPayPalLedgerPlan>;
  existingLedger: any;
  orderRow?: any;
}) {
  const { plan, existingLedger, orderRow } = params;
  if (!existingLedger && !orderRow) return plan;

  const roundAmount = (value: unknown) => round2(Number(value || 0));
  const existingPartner = roundAmount(existingLedger?.partner_earnings);
  const existingInfluencer = roundAmount(existingLedger?.influencer_earnings);
  const existingBeezioGross = roundAmount(existingLedger?.beezio_fee_gross ?? existingLedger?.platform_fee_gross);
  const existingBeezioNet = roundAmount(existingLedger?.beezio_fee_net ?? existingLedger?.beezio_fee);
  const existingBeezioProfit = roundAmount(existingLedger?.beezio_profit ?? existingLedger?.beezio_fee_net ?? existingLedger?.beezio_fee);
  const existingPayPalFee = roundAmount(existingLedger?.paypal_fee_estimate);
  const legacyPartner = roundAmount((orderRow as any)?.affiliate_commission ?? (orderRow as any)?.affiliate_fee_amount);
  const legacyInfluencer = roundAmount((orderRow as any)?.ref_or_fundraiser_fee_amount);
  const legacySeller = roundAmount((orderRow as any)?.seller_payout);
  const legacyBeezioProfit = roundAmount((orderRow as any)?.beezio_fee_amount ?? (orderRow as any)?.platform_fee);
  const legacyPayPalFee = roundAmount((orderRow as any)?.processing_fee_amount);

  const useSellerFallback = plan.aggregate.sellerId && plan.aggregate.sellerEarnings <= 0 && legacySeller > 0;
  const usePartnerFallback =
    plan.aggregate.partnerId &&
    plan.aggregate.partnerEarnings <= 0 &&
    (existingPartner > 0 || legacyPartner > 0);
  const useInfluencerFallback =
    plan.aggregate.influencerId &&
    plan.aggregate.influencerEarnings <= 0 &&
    (existingInfluencer > 0 || legacyInfluencer > 0);

  if (!useSellerFallback && !usePartnerFallback && !useInfluencerFallback) return plan;

  const sellerAmount = useSellerFallback ? legacySeller : plan.aggregate.sellerEarnings;
  const partnerAmount = usePartnerFallback ? (existingPartner > 0 ? existingPartner : legacyPartner) : plan.aggregate.partnerEarnings;
  const influencerAmount = useInfluencerFallback ? (existingInfluencer > 0 ? existingInfluencer : legacyInfluencer) : plan.aggregate.influencerEarnings;
  const beezioGross =
    existingBeezioGross > 0
      ? existingBeezioGross
      : legacyBeezioProfit > 0
        ? round2(Math.max(plan.aggregate.grossAmount - sellerAmount - partnerAmount - influencerAmount, 0))
        : plan.aggregate.beezioFeeGross;
  const beezioNet = existingBeezioNet > 0 ? existingBeezioNet : legacyBeezioProfit > 0 ? legacyBeezioProfit : plan.aggregate.beezioFeeNet;
  const beezioProfit = existingBeezioProfit > 0 ? existingBeezioProfit : legacyBeezioProfit > 0 ? legacyBeezioProfit : plan.aggregate.beezioProfit;
  const paypalFee = existingPayPalFee > 0 ? existingPayPalFee : legacyPayPalFee > 0 ? legacyPayPalFee : plan.aggregate.paypalFeeEstimate;
  const providerOrderId = plan.payees[0]?.providerOrderId || plan.moneyEntries[0]?.providerOrderId || '';
  const providerCaptureId = plan.payees[0]?.providerCaptureId || plan.moneyEntries[0]?.providerCaptureId || null;
  const currency = plan.payees[0]?.currency || plan.moneyEntries[0]?.currency || 'USD';

  const upsertPayee = (role: 'PARTNER' | 'INFLUENCER', payeeUserId: string | null, amount: number) => {
    if (!payeeUserId || amount <= 0) return;
    const existingIndex = plan.payees.findIndex(
      (row) => row.payeeRole === role && String(row.payeeUserId || '').trim() === String(payeeUserId || '').trim()
    );
    const nextSnapshot = {
      order_id: plan.aggregate.orderId,
      order_number: null,
      provider_order_id: providerOrderId,
      provider_capture_id: providerCaptureId,
      amount,
      payee_breakdown: {
        seller_amount: round2(sellerAmount),
        partner_amount: round2(partnerAmount),
        influencer_amount: round2(influencerAmount),
        beezio_fee_gross: round2(beezioGross),
        beezio_fee_net: round2(beezioNet),
        paypal_fee_estimate: round2(paypalFee),
      },
    };

    if (existingIndex >= 0) {
      plan.payees[existingIndex] = {
        ...plan.payees[existingIndex],
        amount,
        snapshot: {
          ...(plan.payees[existingIndex].snapshot || {}),
          amount,
          payee_breakdown: {
            ...(((plan.payees[existingIndex].snapshot || {}) as any)?.payee_breakdown || {}),
            seller_amount: round2(sellerAmount),
            partner_amount: round2(partnerAmount),
            influencer_amount: round2(influencerAmount),
            beezio_fee_gross: round2(beezioGross),
            beezio_fee_net: round2(beezioNet),
            paypal_fee_estimate: round2(paypalFee),
          },
        },
      };
      return;
    }

    plan.payees.push({
      payeeUserId,
      payeeRole: role,
      amount,
      currency,
      status: plan.aggregate.status,
      holdReleaseAt: plan.aggregate.holdReleaseAt,
      providerOrderId,
      providerCaptureId,
      snapshot: nextSnapshot,
    });
  };

  const upsertMoneyEntry = (payeeType: 'affiliate' | 'influencer', payeeId: string | null, amount: number) => {
    if (!payeeId || amount <= 0) return;
    const existingIndex = plan.moneyEntries.findIndex(
      (row) => row.payeeType === payeeType && String(row.payeeId || '').trim() === String(payeeId || '').trim()
    );
    if (existingIndex >= 0) {
      plan.moneyEntries[existingIndex] = {
        ...plan.moneyEntries[existingIndex],
        grossAmount: amount,
        netAmount: amount,
      };
      return;
    }

    plan.moneyEntries.push({
      sourceKey: `${plan.aggregate.orderId}:legacy:${payeeType}:${payeeId}`,
      orderId: plan.aggregate.orderId,
      orderItemId: null,
      payeeType,
      payeeId,
      currency,
      grossAmount: amount,
      netAmount: amount,
      status: 'held',
      holdUntil: plan.aggregate.holdReleaseAt,
      provider: 'paypal',
      providerOrderId,
      providerCaptureId,
      metadata: { source: 'legacy_ledger_fallback' },
    });
  };

  const upsertSellerMoney = (amount: number) => {
    if (!plan.aggregate.sellerId || amount <= 0) return;
    const sellerEntries = plan.moneyEntries.filter((row) => row.payeeType === 'seller');
    if (!sellerEntries.length) return;
    const total = round2(sellerEntries.reduce((sum, row) => sum + Number(row.netAmount || row.grossAmount || 0), 0));
    if (Math.abs(total - amount) <= 0.01) return;
    const firstEntry = sellerEntries[0];
    plan.moneyEntries = plan.moneyEntries.filter((row) => row.payeeType !== 'seller');
    plan.moneyEntries.push({
      ...firstEntry,
      sourceKey: `${plan.aggregate.orderId}:legacy:seller:${plan.aggregate.sellerId}`,
      orderItemId: null,
      grossAmount: amount,
      netAmount: amount,
      metadata: { ...(firstEntry.metadata || {}), source: 'legacy_ledger_fallback' },
    });
  };

  plan.aggregate.sellerEarnings = sellerAmount;
  plan.aggregate.partnerEarnings = partnerAmount;
  plan.aggregate.influencerEarnings = influencerAmount;
  plan.aggregate.beezioFeeGross = beezioGross;
  plan.aggregate.beezioFeeNet = beezioNet;
  plan.aggregate.beezioProfit = beezioProfit;
  plan.aggregate.paypalFeeEstimate = paypalFee;
  plan.aggregate.notes = [plan.aggregate.notes, 'legacy_ledger_fallback=applied'].filter(Boolean).join(' | ');

  upsertSellerMoney(sellerAmount);
  upsertPayee('PARTNER', plan.aggregate.partnerId, partnerAmount);
  upsertPayee('INFLUENCER', plan.aggregate.influencerId, influencerAmount);
  upsertMoneyEntry('affiliate', plan.aggregate.partnerId, partnerAmount);
  upsertMoneyEntry('influencer', plan.aggregate.influencerId, influencerAmount);

  const beezioIndex = plan.moneyEntries.findIndex((row) => row.payeeType === 'beezio');
  if (beezioIndex >= 0) {
    plan.moneyEntries[beezioIndex] = {
      ...plan.moneyEntries[beezioIndex],
      grossAmount: beezioGross,
      netAmount: beezioProfit,
      metadata: {
        ...(plan.moneyEntries[beezioIndex].metadata || {}),
        beezio_fee_gross: beezioGross,
        beezio_fee_net: beezioNet,
        beezio_profit: beezioProfit,
        source: 'legacy_ledger_fallback',
      },
    };
  }

  const processorFeeIndex = plan.moneyEntries.findIndex((row) => row.payeeType === 'processor_fee');
  if (processorFeeIndex >= 0) {
    plan.moneyEntries[processorFeeIndex] = {
      ...plan.moneyEntries[processorFeeIndex],
      grossAmount: paypalFee,
      netAmount: paypalFee,
    };
  }

  return plan;
}

async function updateRowWithFallback(
  supabaseAdmin: any,
  table: string,
  filterColumn: string,
  filterValue: string,
  payload: Record<string, any>
) {
  let attemptPayload = { ...payload };
  let lastError: any = null;

  for (let attempt = 0; attempt < 16; attempt += 1) {
    const { error } = await supabaseAdmin.from(table).update(attemptPayload as any).eq(filterColumn, filterValue);
    if (!error) return { error: null, payload: attemptPayload };
    lastError = error;

    const missing = extractMissingColumnName(String((error as any)?.message || ''));
    if (missing && Object.prototype.hasOwnProperty.call(attemptPayload, missing)) {
      delete attemptPayload[missing];
      continue;
    }

    const message = String((error as any)?.message || '').toLowerCase();
    if (message.includes('invalid input value for enum')) {
      const clone = { ...attemptPayload };
      let removed = false;
      for (const field of ['status', 'payment_status']) {
        if (Object.prototype.hasOwnProperty.call(clone, field)) {
          delete clone[field];
          removed = true;
        }
      }
      if (removed) {
        attemptPayload = clone;
        continue;
      }
    }
    break;
  }

  return { error: lastError, payload: attemptPayload };
}

async function syncOrderPayeeAttribution(params: {
  supabaseAdmin: any;
  orderId: string;
  sellerId: string | null;
  partnerId: string | null;
  influencerId: string | null;
}) {
  const payload: Record<string, any> = {};
  if (params.sellerId) payload.seller_id = params.sellerId;
  if (params.partnerId) payload.partner_id = params.partnerId;
  if (params.influencerId) payload.influencer_id = params.influencerId;
  if (Object.keys(payload).length === 0) {
    return { error: null, payload };
  }

  return updateRowWithFallback(params.supabaseAdmin, 'orders', 'id', params.orderId, payload);
}

async function insertRowWithFallback(supabaseAdmin: any, table: string, payload: Record<string, any>) {
  let attemptPayload = { ...payload };
  let lastError: any = null;

  for (let attempt = 0; attempt < 16; attempt += 1) {
    const { data, error } = await supabaseAdmin.from(table).insert(attemptPayload as any).select().maybeSingle();
    if (!error) return { data, error: null, payload: attemptPayload };
    lastError = error;
    const missing = extractMissingColumnName(String((error as any)?.message || ''));
    if (missing && Object.prototype.hasOwnProperty.call(attemptPayload, missing)) {
      delete attemptPayload[missing];
      continue;
    }
    break;
  }

  return { data: null, error: lastError, payload: attemptPayload };
}

async function repairOrderAccounting(params: {
  supabaseAdmin: any;
  orderId: string;
  providerOrderId: string;
  providerCaptureId: string | null;
  paidAt: string;
  holdReleaseAt: string;
  plan: ReturnType<typeof buildPayPalLedgerPlan>;
}) {
  const { supabaseAdmin, orderId, providerOrderId, providerCaptureId, paidAt, holdReleaseAt, plan } = params;

  const orderUpdate = await updateRowWithFallback(supabaseAdmin, 'orders', 'id', orderId, {
    status: 'completed',
    payment_status: 'paid',
    payment_provider: 'PAYPAL',
    provider_order_id: providerOrderId,
    provider_capture_id: providerCaptureId,
    seller_id: plan.aggregate.sellerId,
    partner_id: plan.aggregate.partnerId,
    influencer_id: plan.aggregate.influencerId,
    paid_at: paidAt,
    payment_finalized_at: paidAt,
    subtotal_listing: plan.aggregate.grossAmount,
    total_charged: round2(plan.aggregate.grossAmount + plan.moneyEntries
      .filter((entry) => entry.payeeType === 'shipping' || entry.payeeType === 'tax')
      .reduce((sum, entry) => sum + Number(entry.grossAmount || 0), 0)),
    updated_at: new Date().toISOString(),
  });
  if (orderUpdate.error) throw new Error(orderUpdate.error.message);

  const ledgerPayload: Record<string, any> = {
    seller_id: plan.aggregate.sellerId,
    partner_id: plan.aggregate.partnerId,
    influencer_id: plan.aggregate.influencerId,
    gross_amount: plan.aggregate.grossAmount,
    seller_earnings: plan.aggregate.sellerEarnings,
    partner_earnings: plan.aggregate.partnerEarnings,
    influencer_earnings: plan.aggregate.influencerEarnings,
    beezio_fee: plan.aggregate.beezioFeeNet,
    beezio_fee_gross: plan.aggregate.beezioFeeGross,
    beezio_fee_net: plan.aggregate.beezioFeeNet,
    platform_fee_gross: plan.aggregate.beezioFeeGross,
    platform_fee_net: plan.aggregate.beezioFeeNet,
    beezio_profit: plan.aggregate.beezioProfit,
    paypal_fee_estimate: plan.aggregate.paypalFeeEstimate,
    status: plan.aggregate.status,
    hold_release_at: holdReleaseAt,
    notes: plan.aggregate.notes,
    updated_at: new Date().toISOString(),
  };

  const { data: existingLedger, error: existingLedgerError } = await supabaseAdmin
    .from('payout_ledger')
    .select('id')
    .eq('order_id', orderId)
    .limit(1)
    .maybeSingle();
  if (existingLedgerError) throw new Error(existingLedgerError.message);

  let ledgerId = String((existingLedger as any)?.id || '').trim() || null;
  if (ledgerId) {
    const ledgerUpdate = await updateRowWithFallback(supabaseAdmin, 'payout_ledger', 'id', ledgerId, ledgerPayload);
    if (ledgerUpdate.error) throw new Error(ledgerUpdate.error.message);
  } else {
    const ledgerInsert = await insertRowWithFallback(supabaseAdmin, 'payout_ledger', {
      order_id: orderId,
      provider_order_id: providerOrderId,
      provider_capture_id: providerCaptureId,
      created_at: paidAt,
      ...ledgerPayload,
    });
    if (ledgerInsert.error) throw new Error(ledgerInsert.error.message);
    ledgerId = String((ledgerInsert.data as any)?.id || '').trim() || null;
  }

  const snapshotRows = plan.payees.map((snapshot) => ({
    order_id: orderId,
    ledger_id: ledgerId,
    payee_user_id: snapshot.payeeUserId,
    payee_role: snapshot.payeeRole,
    provider: 'paypal',
    provider_order_id: snapshot.providerOrderId,
    provider_capture_id: snapshot.providerCaptureId,
    currency: snapshot.currency,
    amount: snapshot.amount,
    status: snapshot.status,
    hold_release_at: snapshot.holdReleaseAt,
    snapshot_json: snapshot.snapshot,
  }));

  if (snapshotRows.length > 0) {
    const { error: snapshotError } = await supabaseAdmin
      .from('payout_snapshots')
      .upsert(snapshotRows, { onConflict: 'order_id,payee_user_id,payee_role' });
    if (snapshotError) throw new Error(snapshotError.message);
  }

  const moneyLedger = await writeOrderMoneyLedgerEntries(supabaseAdmin, plan.moneyEntries);

  return {
    ledgerId,
    moneyLedger,
    snapshotCount: snapshotRows.length,
  };
}

async function assertFinalizationState(params: {
  supabaseAdmin: any;
  orderId: string;
  paidAt: string;
  holdReleaseAt: string;
  expectedSnapshotCount: number;
  requireMoneyLedger: boolean;
}) {
  const { supabaseAdmin, orderId, paidAt, holdReleaseAt, expectedSnapshotCount, requireMoneyLedger } = params;

  const [{ data: ledgerRow, error: ledgerError }, { data: snapshotRows, error: snapshotError }, { data: moneyRows, error: moneyError }] = await Promise.all([
    supabaseAdmin
      .from('payout_ledger')
      .select('id, status, hold_release_at')
      .eq('order_id', orderId)
      .limit(1)
      .maybeSingle(),
    supabaseAdmin
      .from('payout_snapshots')
      .select('id, hold_release_at')
      .eq('order_id', orderId),
    supabaseAdmin
      .from('order_money_ledger')
      .select('id')
      .eq('order_id', orderId)
      .limit(200),
  ]);

  if (ledgerError) throw new Error(`Finalization verification failed to load payout ledger: ${ledgerError.message}`);
  if (snapshotError) throw new Error(`Finalization verification failed to load payout snapshots: ${snapshotError.message}`);
  if (moneyError && requireMoneyLedger) {
    throw new Error(`Finalization verification failed to load money ledger: ${moneyError.message}`);
  }

  if (!(ledgerRow as any)?.id) {
    throw new Error('Finalization verification failed: payout_ledger row missing');
  }

  const snapshotCount = Array.isArray(snapshotRows) ? snapshotRows.length : 0;
  if (snapshotCount < expectedSnapshotCount) {
    throw new Error(`Finalization verification failed: expected ${expectedSnapshotCount} payout snapshots, found ${snapshotCount}`);
  }

  if (requireMoneyLedger) {
    const moneyCount = Array.isArray(moneyRows) ? moneyRows.length : 0;
    if (moneyCount === 0) {
      throw new Error('Finalization verification failed: order_money_ledger rows missing');
    }
  }

  const enforcedLedgerHoldReleaseAt = ensureMinimumHoldReleaseAt(paidAt, String((ledgerRow as any)?.hold_release_at || ''), 14);
  if (String((ledgerRow as any)?.hold_release_at || '') !== enforcedLedgerHoldReleaseAt) {
    throw new Error('Finalization verification failed: payout_ledger hold_release_at is earlier than the 14-day minimum');
  }

  for (const snapshot of (snapshotRows as any[]) || []) {
    const snapshotHoldReleaseAt = ensureMinimumHoldReleaseAt(paidAt, String(snapshot?.hold_release_at || ''), 14);
    if (String(snapshot?.hold_release_at || '') !== snapshotHoldReleaseAt) {
      throw new Error('Finalization verification failed: payout_snapshots hold_release_at is earlier than the 14-day minimum');
    }
  }
}

export async function finalizePayPalOrderPayment(params: {
  supabaseAdmin: any;
  orderId: string;
  providerOrderId: string;
  providerCaptureId: string | null;
  paypalFeeAmount?: number | null;
  paidAt?: string;
  forceRepair?: boolean;
}) {
  const { supabaseAdmin, orderId, providerOrderId, providerCaptureId } = params;

  const { data: existingSnapshots } = await supabaseAdmin
    .from('payout_snapshots')
    .select('id, payee_user_id, payee_role, amount, status, hold_release_at')
    .eq('order_id', orderId)
    .limit(10);

  if (!params.forceRepair && Array.isArray(existingSnapshots) && existingSnapshots.length > 0) {
    try {
      const { data: existingMoneyRows } = await supabaseAdmin
        .from('order_money_ledger')
        .select('id')
        .eq('order_id', orderId)
        .limit(1);

      if (Array.isArray(existingMoneyRows) && existingMoneyRows.length > 0) {
        const existingPaidAt = params.paidAt || new Date().toISOString();
        const existingHoldReleaseAt = ensureMinimumHoldReleaseAt(
          existingPaidAt,
          String((existingSnapshots[0] as any)?.hold_release_at || ''),
          14
        );
        if (String((existingSnapshots[0] as any)?.hold_release_at || '') !== existingHoldReleaseAt) {
          throw new Error('Existing payout snapshots have an invalid hold_release_at and require repair');
        }

        return {
          ok: true,
          idempotent: true,
          order_id: orderId,
          provider_order_id: providerOrderId,
          provider_capture_id: providerCaptureId,
          snapshots: existingSnapshots,
        };
      }
    } catch {
      return {
        ok: true,
        idempotent: true,
        order_id: orderId,
        provider_order_id: providerOrderId,
        provider_capture_id: providerCaptureId,
        snapshots: existingSnapshots,
      };
    }
  }

  const { data: orderRow, error: orderError } = await selectMaybeSingleWithFallback(
    supabaseAdmin,
    'orders',
    [
      'id',
      'order_number',
      'seller_id',
      'partner_id',
      'influencer_id',
      'currency',
      'subtotal_listing',
      'shipping_amount',
      'tax_amount',
      'total_charged',
      'billing_email',
      'buyer_id',
      'paid_at',
      'affiliate_commission',
      'affiliate_fee_amount',
      'ref_or_fundraiser_fee_amount',
      'seller_payout',
      'beezio_fee_amount',
      'platform_fee',
      'processing_fee_amount',
    ],
    'id',
    orderId
  );

  if (orderError) throw new Error(orderError.message);
  if (!orderRow?.id) throw new Error('Order not found for finalization');

  const rows = await selectOrderItems(supabaseAdmin, orderId);
  if (!rows.length) throw new Error('Order has no line items');

  const buyerId = String((orderRow as any)?.buyer_id || '').trim() || null;
  const sellerId = String((orderRow as any)?.seller_id || '').trim() || null;
  const rawPartnerId = String((orderRow as any)?.partner_id || '').trim() || null;
  const partnerId = sameProfileId(rawPartnerId, buyerId) ? null : rawPartnerId;
  const sellerRecruiterInfluencerIdRaw = await resolveRecruiterInfluencerId(supabaseAdmin, sellerId, 'seller');
  const partnerRecruiterInfluencerIdRaw = await resolveRecruiterInfluencerId(supabaseAdmin, partnerId, 'affiliate');
  const sellerRecruiterInfluencerId = sameProfileId(sellerRecruiterInfluencerIdRaw, buyerId) ? null : sellerRecruiterInfluencerIdRaw;
  const partnerRecruiterInfluencerId = sameProfileId(partnerRecruiterInfluencerIdRaw, buyerId) ? null : partnerRecruiterInfluencerIdRaw;
  const partnerIsInfluencer = await isInfluencerProfile(supabaseAdmin, partnerId);
  const explicitInfluencerIdRaw = String((orderRow as any)?.influencer_id || '').trim() || null;
  const explicitInfluencerId = sameProfileId(explicitInfluencerIdRaw, buyerId) ? null : explicitInfluencerIdRaw;
  let sellerInfluencerId: string | null = null;
  let partnerInfluencerId: string | null = null;

  if (explicitInfluencerId) {
    if (partnerId) {
      partnerInfluencerId = explicitInfluencerId;
    } else {
      sellerInfluencerId = explicitInfluencerId;
    }
  } else {
    sellerInfluencerId = sellerRecruiterInfluencerId || null;
    partnerInfluencerId = partnerRecruiterInfluencerId || (partnerIsInfluencer ? partnerId : null) || null;
  }

  const paidAt = params.paidAt || String((orderRow as any)?.paid_at || '').trim() || new Date().toISOString();
  const holdDays = getPayoutHoldDays(14);
  const holdReleaseAt = ensureMinimumHoldReleaseAt(paidAt, addDaysIso(paidAt, holdDays), 14);
  const { data: existingLedger } = await supabaseAdmin
    .from('payout_ledger')
    .select('id, seller_earnings, partner_earnings, influencer_earnings, beezio_fee_gross, beezio_fee_net, beezio_fee, beezio_profit, platform_fee_gross, paypal_fee_estimate')
    .eq('order_id', orderId)
    .limit(1)
    .maybeSingle();

  const plan = normalizePlanHoldReleaseAt(stripBuyerCommissionRoles(applyLegacyLedgerFallbacks({
    plan: buildPayPalLedgerPlan({
      orderId,
      orderNumber: String((orderRow as any)?.order_number || '').trim() || null,
      currency: String((orderRow as any)?.currency || 'USD').toUpperCase(),
      providerOrderId,
      providerCaptureId,
      paidAt,
      holdReleaseAt,
      sellerId,
      partnerId,
      sellerInfluencerId,
      partnerInfluencerId,
      subtotalListing: Number((orderRow as any)?.subtotal_listing || 0),
      shippingAmount: Number((orderRow as any)?.shipping_amount || 0),
      taxAmount: Number((orderRow as any)?.tax_amount || 0),
      paypalFeeAmount: params.paypalFeeAmount,
      items: rows.map((row: any) => ({
        id: row?.id ? String(row.id) : null,
        quantity: Number(row?.quantity || 0) || 1,
        seller_ask_amount: Number(row?.seller_ask_amount || 0),
        partner_rate: Number(row?.partner_rate || 0),
        computed_listing_price: Number(row?.computed_listing_price || 0),
        product_title: String(row?.products?.title || '').trim() || null,
        product_id: row?.product_id ? String(row.product_id) : null,
        variant_id: row?.variant_id ? String(row.variant_id) : null,
      })),
    }),
    existingLedger,
    orderRow,
  }), buyerId), paidAt, holdReleaseAt);

  const runLegacyFinanceMirror = async () => {
    try {
      return await mirrorOrderToLegacyFinance({
        supabaseAdmin,
        orderId,
        sellerId: plan.aggregate.sellerId,
        partnerId: plan.aggregate.partnerId,
        influencerTotal: plan.aggregate.influencerEarnings,
        influencerPayeeIds: plan.payees
          .filter((snapshot) => snapshot.payeeRole === 'INFLUENCER')
          .map((snapshot) => String(snapshot.payeeUserId || '').trim())
          .filter(Boolean),
        subtotalListing: plan.aggregate.grossAmount,
        totalCharged: round2(Number((orderRow as any)?.total_charged || plan.aggregate.grossAmount || 0)),
        sellerEarnings: plan.aggregate.sellerEarnings,
        partnerEarnings: plan.aggregate.partnerEarnings,
        beezioProfit: plan.aggregate.beezioProfit,
        currency: String((orderRow as any)?.currency || 'USD').toUpperCase(),
        holdReleaseAt,
        paidAt,
        providerCaptureId,
      });
    } catch (error: any) {
      console.warn('[paypal-order-finalization] legacy finance mirror failed:', error);
      return {
        ok: false,
        skipped: true,
        reason: 'legacy_finance_mirror_failed',
        error: error instanceof Error ? error.message : String(error || 'unknown_error'),
      };
    }
  };

  const rpcPayload = {
    p_order_id: orderId,
    p_provider_order_id: providerOrderId,
    p_provider_capture_id: providerCaptureId,
    p_paid_at: paidAt,
    p_currency: String((orderRow as any)?.currency || 'USD').toUpperCase(),
    p_hold_release_at: holdReleaseAt,
    p_order_totals: {
      subtotal_listing: round2(Number((orderRow as any)?.subtotal_listing || plan.aggregate.grossAmount || 0)),
      shipping_amount: round2(Number((orderRow as any)?.shipping_amount || 0)),
      tax_amount: round2(Number((orderRow as any)?.tax_amount || 0)),
      total_charged: round2(Number((orderRow as any)?.total_charged || plan.aggregate.grossAmount || 0)),
    },
    p_ledger_totals: {
      seller_id: plan.aggregate.sellerId,
      partner_id: plan.aggregate.partnerId,
      influencer_id: plan.aggregate.influencerId,
      gross_amount: plan.aggregate.grossAmount,
      seller_earnings: plan.aggregate.sellerEarnings,
      partner_earnings: plan.aggregate.partnerEarnings,
      influencer_earnings: plan.aggregate.influencerEarnings,
      beezio_fee_gross: plan.aggregate.beezioFeeGross,
      beezio_fee_net: plan.aggregate.beezioFeeNet,
      beezio_profit: plan.aggregate.beezioProfit,
      paypal_fee_estimate: plan.aggregate.paypalFeeEstimate,
      status: plan.aggregate.status,
      notes: plan.aggregate.notes,
    },
    p_snapshots: plan.payees.map((snapshot) => ({
      payee_user_id: snapshot.payeeUserId,
      payee_role: snapshot.payeeRole,
      provider_order_id: snapshot.providerOrderId,
      provider_capture_id: snapshot.providerCaptureId,
      currency: snapshot.currency,
      amount: snapshot.amount,
      status: snapshot.status,
      hold_release_at: snapshot.holdReleaseAt,
      snapshot_json: snapshot.snapshot,
    })),
  };

  if (!params.forceRepair && Array.isArray(existingSnapshots) && existingSnapshots.length > 0) {
    try {
      const { data: existingMoneyRows } = await supabaseAdmin
        .from('order_money_ledger')
        .select('id')
        .eq('order_id', orderId)
        .limit(1);

      if (Array.isArray(existingMoneyRows) && existingMoneyRows.length > 0) {
        const repaired = await repairOrderAccounting({
          supabaseAdmin,
          orderId,
          providerOrderId,
          providerCaptureId,
          paidAt,
          holdReleaseAt,
          plan,
        });
        const legacyFinance = await runLegacyFinanceMirror();
        await assertFinalizationState({
          supabaseAdmin,
          orderId,
          paidAt,
          holdReleaseAt,
          expectedSnapshotCount: plan.payees.length,
          requireMoneyLedger: true,
        });
        return {
          ok: true,
          idempotent: true,
          repaired: true,
          order_id: orderId,
          provider_order_id: providerOrderId,
          provider_capture_id: providerCaptureId,
          hold_release_at: holdReleaseAt,
          snapshots: existingSnapshots,
          payout: {
            subtotal_listing: plan.aggregate.grossAmount,
            seller_ask_total: plan.aggregate.sellerEarnings,
            partner_total: plan.aggregate.partnerEarnings,
            influencer_total: plan.aggregate.influencerEarnings,
            beezio_fee_gross: plan.aggregate.beezioFeeGross,
            beezio_fee_net: plan.aggregate.beezioFeeNet,
            beezio_profit: plan.aggregate.beezioProfit,
            paypal_fee_estimate: plan.aggregate.paypalFeeEstimate,
          },
          ledger: {
            order_id: orderId,
            ledger_id: repaired.ledgerId,
            snapshot_count: repaired.snapshotCount,
          },
          money_ledger: repaired.moneyLedger,
          legacy_finance: legacyFinance,
        };
      }
    } catch {
      const repaired = await repairOrderAccounting({
        supabaseAdmin,
        orderId,
        providerOrderId,
        providerCaptureId,
        paidAt,
        holdReleaseAt,
        plan,
      });
      const legacyFinance = await runLegacyFinanceMirror();
      await assertFinalizationState({
        supabaseAdmin,
        orderId,
        paidAt,
        holdReleaseAt,
        expectedSnapshotCount: plan.payees.length,
        requireMoneyLedger: true,
      });
      return {
        ok: true,
        idempotent: true,
        repaired: true,
        order_id: orderId,
        provider_order_id: providerOrderId,
        provider_capture_id: providerCaptureId,
        hold_release_at: holdReleaseAt,
        snapshots: existingSnapshots,
        payout: {
          subtotal_listing: plan.aggregate.grossAmount,
          seller_ask_total: plan.aggregate.sellerEarnings,
          partner_total: plan.aggregate.partnerEarnings,
          influencer_total: plan.aggregate.influencerEarnings,
          beezio_fee_gross: plan.aggregate.beezioFeeGross,
          beezio_fee_net: plan.aggregate.beezioFeeNet,
          beezio_profit: plan.aggregate.beezioProfit,
          paypal_fee_estimate: plan.aggregate.paypalFeeEstimate,
        },
        ledger: {
          order_id: orderId,
          ledger_id: repaired.ledgerId,
          snapshot_count: repaired.snapshotCount,
        },
        money_ledger: repaired.moneyLedger,
        legacy_finance: legacyFinance,
      };
    }
  }

  const { data: rpcResult, error: rpcError } = await supabaseAdmin.rpc('record_paypal_order_finalization', rpcPayload);
  if (rpcError) {
    if (!isRefundedOrderStatusEnumError(rpcError)) {
      throw new Error(rpcError.message);
    }

    const { data: ledgerRow, error: ledgerError } = await supabaseAdmin
      .from('payout_ledger')
      .select('id')
      .eq('order_id', orderId)
      .limit(1)
      .maybeSingle();

    if (ledgerError) throw new Error(ledgerError.message);

    const repaired = await repairOrderAccounting({
      supabaseAdmin,
      orderId,
      providerOrderId,
      providerCaptureId,
      paidAt,
      holdReleaseAt,
      plan,
    });
    const legacyFinance = await runLegacyFinanceMirror();
    await syncOrderPayeeAttribution({
      supabaseAdmin,
      orderId,
      sellerId: plan.aggregate.sellerId,
      partnerId: plan.aggregate.partnerId,
      influencerId: plan.aggregate.influencerId,
    });

    await assertFinalizationState({
      supabaseAdmin,
      orderId,
      paidAt,
      holdReleaseAt,
      expectedSnapshotCount: plan.payees.length,
      requireMoneyLedger: true,
    });
    return {
      ok: true,
      idempotent: false,
      fallback: 'rpc_refunded_enum_compat',
      order_id: orderId,
      provider_order_id: providerOrderId,
      provider_capture_id: providerCaptureId,
      hold_release_at: holdReleaseAt,
      payout: {
        subtotal_listing: plan.aggregate.grossAmount,
        seller_ask_total: plan.aggregate.sellerEarnings,
        partner_total: plan.aggregate.partnerEarnings,
        influencer_total: plan.aggregate.influencerEarnings,
        beezio_fee_gross: plan.aggregate.beezioFeeGross,
        beezio_fee_net: plan.aggregate.beezioFeeNet,
        beezio_profit: plan.aggregate.beezioProfit,
        paypal_fee_estimate: plan.aggregate.paypalFeeEstimate,
      },
      ledger: {
        order_id: orderId,
        ledger_id: repaired.ledgerId || (ledgerRow as any)?.id || null,
        provider_order_id: providerOrderId,
        provider_capture_id: providerCaptureId,
        snapshot_count: repaired.snapshotCount,
      },
      money_ledger: repaired.moneyLedger,
      legacy_finance: legacyFinance,
    };
  }

  const moneyLedger = await writeOrderMoneyLedgerEntries(supabaseAdmin, plan.moneyEntries);
  const legacyFinance = await runLegacyFinanceMirror();
  await syncOrderPayeeAttribution({
    supabaseAdmin,
    orderId,
    sellerId: plan.aggregate.sellerId,
    partnerId: plan.aggregate.partnerId,
    influencerId: plan.aggregate.influencerId,
  });

  if (!moneyLedger.ok || moneyLedger.inserted === 0) {
    throw new Error(`Finalization failed to write order_money_ledger: ${moneyLedger.error || moneyLedger.reason || 'no rows inserted'}`);
  }

  await assertFinalizationState({
    supabaseAdmin,
    orderId,
    paidAt,
    holdReleaseAt,
    expectedSnapshotCount: plan.payees.length,
    requireMoneyLedger: true,
  });

  return {
    ok: true,
    idempotent: false,
    order_id: orderId,
    provider_order_id: providerOrderId,
    provider_capture_id: providerCaptureId,
    hold_release_at: holdReleaseAt,
    payout: {
      subtotal_listing: plan.aggregate.grossAmount,
      seller_ask_total: plan.aggregate.sellerEarnings,
      partner_total: plan.aggregate.partnerEarnings,
      influencer_total: plan.aggregate.influencerEarnings,
      beezio_fee_gross: plan.aggregate.beezioFeeGross,
      beezio_fee_net: plan.aggregate.beezioFeeNet,
      beezio_profit: plan.aggregate.beezioProfit,
      paypal_fee_estimate: plan.aggregate.paypalFeeEstimate,
    },
    ledger: rpcResult,
    money_ledger: moneyLedger,
    legacy_finance: legacyFinance,
  };
}
