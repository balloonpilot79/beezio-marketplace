import { createSupabaseAdmin } from './supabase';

export type LedgerRequest = {
  limit?: number;
  startDate?: string;
  start_date?: string;
  endDate?: string;
  end_date?: string;
  search?: string;
};

type MoneyLedgerBreakdown = {
  seller: number;
  affiliate: number;
  influencer: number;
  beezio: number;
  tax: number;
  shipping: number;
  processorFee: number;
};

type DisputeSnapshot = {
  id: string;
  dispute_type: string;
  status: string;
  resolution_type: string | null;
  refund_amount: number;
  created_at: string | null;
  updated_at: string | null;
  resolved_at: string | null;
};

type PartySummary = {
  id: string | null;
  name: string;
  email: string;
  paypal_email: string;
  amount: number;
};

type InfluencerPayee = PartySummary & {
  source: 'order_money_ledger' | 'payout_snapshots' | 'legacy';
  slot?: 'seller_influencer' | 'affiliate_influencer';
};

type MoneyLedgerBatchRef = {
  internal_batch_id: string;
  provider_batch_id: string | null;
};

export type AdminSalesLedgerRow = {
  order_id: string;
  order_number: string | null;
  provider_order_id: string | null;
  created_at: string | null;
  updated_at: string | null;
  paid_at: string | null;
  order_status: string;
  payment_status: string;
  fulfillment_status: string;
  dispute_status: string;
  is_counted_sale: boolean;
  is_refunded: boolean;
  refunded_amount: number;
  buyer_id: string | null;
  buyer_name: string;
  buyer_email: string;
  currency: string;
  quantity: number;
  products: string[];
  tracking_number: string | null;
  tracking_url: string | null;
  shipping_address: Record<string, unknown> | null;
  seller: PartySummary;
  affiliate: PartySummary;
  influencer: PartySummary;
  influencers: InfluencerPayee[];
  influencer_slots?: InfluencerPayee[];
  beezio_fee: number;
  paypal_fee: number;
  beezio_gross_revenue: number;
  beezio_net_revenue: number;
  sales_tax: number;
  shipping: number;
  gross_sales: number;
  gross_amount: number;
  matched_payout_batch_ids: string[];
  matched_provider_batch_ids: string[];
  payout_status: string;
  payout_created_at: string | null;
  payout_paid_at: string | null;
  hold_release_at: string | null;
  latest_dispute: DisputeSnapshot | null;
  disputes: DisputeSnapshot[];
};

export type AdminSalesLedgerSummary = {
  orders: number;
  real_sales: number;
  gross_sales: number;
  seller_payouts: number;
  affiliate_payouts: number;
  influencer_payouts: number;
  beezio_fee: number;
  paypal_fee: number;
  beezio_gross_revenue: number;
  beezio_net_revenue: number;
  sales_tax: number;
  shipping: number;
  refunded_orders: number;
  refunded_amount: number;
  disputed_orders: number;
  open_disputes: number;
};

const round2 = (value: number) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
const asMoney = (value: unknown) => {
  const num = Number(value || 0);
  return Number.isFinite(num) ? round2(num) : 0;
};
const asText = (value: unknown) => String(value ?? '').trim();

const isCompletedSale = (orderStatus: string, paymentStatus: string) => {
  const status = asText(orderStatus).toLowerCase();
  const payment = asText(paymentStatus).toLowerCase();
  return payment === 'paid' || status === 'completed' || status === 'processing' || status === 'paid';
};

const isRefundedOrder = (orderStatus: string, paymentStatus: string, refundedAmount: number) => {
  const status = asText(orderStatus).toLowerCase();
  const payment = asText(paymentStatus).toLowerCase();
  return status.includes('refund') || payment.includes('refund') || refundedAmount > 0;
};

async function selectWithFallback(
  execute: (selected: string[]) => Promise<{ data: any; error: any }>,
  fields: string[]
) {
  let selected = [...fields];
  let lastError: any = null;

  const extractMissingColumnName = (message: string): string | null => {
    const pg = message.match(/column\s+"([^"]+)"\s+of\s+relation\s+"[^"]+"\s+does\s+not\s+exist/i);
    if (pg?.[1]) return pg[1];
    const pgDot = message.match(/column\s+([a-z0-9_]+\.[a-z0-9_]+)\s+does\s+not\s+exist/i);
    if (pgDot?.[1]) return pgDot[1].split('.').pop() || pgDot[1];
    const pgrst = message.match(/Could not find the '([^']+)' column of '[^']+' in the schema cache/i);
    if (pgrst?.[1]) return pgrst[1];
    return null;
  };

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const { data, error } = await execute(selected);
    if (!error) return { data: (data as any[]) || [], error: null };
    lastError = error;
    const missing = extractMissingColumnName(String(error?.message || ''));
    if (missing && selected.includes(missing)) {
      selected = selected.filter((field) => field !== missing);
      continue;
    }
    break;
  }

  return { data: [], error: lastError };
}

const roundSummary = (summary: AdminSalesLedgerSummary): AdminSalesLedgerSummary => ({
  orders: summary.orders,
  real_sales: summary.real_sales,
  gross_sales: round2(summary.gross_sales),
  seller_payouts: round2(summary.seller_payouts),
  affiliate_payouts: round2(summary.affiliate_payouts),
  influencer_payouts: round2(summary.influencer_payouts),
  beezio_fee: round2(summary.beezio_fee),
  paypal_fee: round2(summary.paypal_fee),
  beezio_gross_revenue: round2(summary.beezio_gross_revenue),
  beezio_net_revenue: round2(summary.beezio_net_revenue),
  sales_tax: round2(summary.sales_tax),
  shipping: round2(summary.shipping),
  refunded_orders: summary.refunded_orders,
  refunded_amount: round2(summary.refunded_amount),
  disputed_orders: summary.disputed_orders,
  open_disputes: summary.open_disputes,
});

export async function buildAdminSalesLedgerReport(request: LedgerRequest) {
  const supabaseAdmin = createSupabaseAdmin();
  const limit = Math.max(1, Math.min(20000, Number(request?.limit || 500) || 500));
  const startDate = asText(request?.startDate || request?.start_date);
  const endDate = asText(request?.endDate || request?.end_date);
  const search = asText(request?.search).toLowerCase();

  const orderFields = [
    'id','order_number','provider_order_id','created_at','updated_at','paid_at','status','payment_status','fulfillment_status','dispute_status',
    'buyer_id','user_id','seller_id','partner_id','affiliate_id','influencer_id','billing_name','billing_email','currency',
    'shipping_amount','tax_amount','subtotal_listing','total_amount','total_charged','tracking_number','tracking_url','shipping_address'
  ];

  const { data: orderRows, error: ordersError } = await selectWithFallback((selected) => {
    let query = supabaseAdmin
      .from('orders')
      .select(selected.join(','))
      .order('created_at', { ascending: false })
      .limit(limit);

    if (startDate) query = query.gte('created_at', `${startDate}T00:00:00.000Z`);
    if (endDate) query = query.lte('created_at', `${endDate}T23:59:59.999Z`);
    return query;
  }, orderFields);
  if (ordersError) throw new Error(ordersError.message);

  const orders = (orderRows as any[]) || [];
  const orderIds = orders.map((row) => asText(row?.id)).filter(Boolean);
  if (!orderIds.length) {
    return {
      summary: roundSummary({ orders: 0, real_sales: 0, gross_sales: 0, seller_payouts: 0, affiliate_payouts: 0, influencer_payouts: 0, beezio_fee: 0, paypal_fee: 0, beezio_gross_revenue: 0, beezio_net_revenue: 0, sales_tax: 0, shipping: 0, refunded_orders: 0, refunded_amount: 0, disputed_orders: 0, open_disputes: 0 }),
      filters: { limit, startDate: startDate || null, endDate: endDate || null, search: search || null },
      rows: [] as AdminSalesLedgerRow[],
    };
  }

  const [itemsResult, ledgerResult, moneyLedgerResult, snapshotResult, disputesResult] = await Promise.all([
    selectWithFallback((selected) => supabaseAdmin.from('order_items').select(selected.join(',')).in('order_id', orderIds), ['id', 'order_id', 'quantity', 'price', 'computed_listing_price', 'product_title', 'title_snapshot', 'sku']),
    selectWithFallback((selected) => supabaseAdmin.from('payout_ledger').select(selected.join(',')).in('order_id', orderIds), ['id', 'order_id', 'seller_id', 'partner_id', 'influencer_id', 'seller_earnings', 'partner_earnings', 'influencer_earnings', 'beezio_profit', 'paypal_fee_estimate', 'status', 'hold_release_at', 'created_at', 'paid_at']),
    selectWithFallback((selected) => supabaseAdmin.from('order_money_ledger').select(selected.join(',')).in('order_id', orderIds), ['id', 'order_id', 'payee_type', 'payee_id', 'gross_amount', 'net_amount', 'status', 'payout_batch_id', 'hold_until', 'metadata']),
    selectWithFallback((selected) => supabaseAdmin.from('payout_snapshots').select(selected.join(',')).in('order_id', orderIds), ['id', 'order_id', 'payee_user_id', 'payee_role', 'amount', 'status', 'hold_release_at', 'snapshot_json']),
    selectWithFallback((selected) => supabaseAdmin.from('disputes').select(selected.join(',')).in('order_id', orderIds), ['id', 'order_id', 'dispute_type', 'status', 'resolution_type', 'refund_amount', 'created_at', 'updated_at', 'resolved_at']),
  ]);

  if (itemsResult.error) throw new Error(String(itemsResult.error?.message || 'Failed to load order items'));
  if (ledgerResult.error) throw new Error(String(ledgerResult.error?.message || 'Failed to load payout ledger'));
  if (moneyLedgerResult.error) throw new Error(String(moneyLedgerResult.error?.message || 'Failed to load order money ledger'));
  if (snapshotResult.error) throw new Error(String(snapshotResult.error?.message || 'Failed to load payout snapshots'));
  if (disputesResult.error) throw new Error(String(disputesResult.error?.message || 'Failed to load disputes'));

  const itemsByOrder = new Map<string, any[]>();
  for (const row of itemsResult.data as any[]) {
    const orderId = asText(row?.order_id);
    if (!orderId) continue;
    const current = itemsByOrder.get(orderId) || [];
    current.push(row);
    itemsByOrder.set(orderId, current);
  }

  const ledgerByOrder = new Map<string, any>();
  for (const row of ledgerResult.data as any[]) {
    const orderId = asText(row?.order_id);
    if (orderId && !ledgerByOrder.has(orderId)) ledgerByOrder.set(orderId, row);
  }

  const moneyLedgerByOrder = new Map<string, MoneyLedgerBreakdown>();
  const moneyLedgerPayeesByOrder = new Map<string, { sellerId: string | null; affiliateId: string | null; influencers: Array<{ id: string; amount: number }> }>();
  const moneyLedgerBatchRefsByOrder = new Map<string, MoneyLedgerBatchRef[]>();
  for (const row of moneyLedgerResult.data as any[]) {
    const orderId = asText(row?.order_id);
    if (!orderId) continue;
    const payeeType = asText(row?.payee_type).toLowerCase();
    const payeeId = asText(row?.payee_id) || null;
    const grossAmount = asMoney(row?.gross_amount);
    const netAmount = asMoney(row?.net_amount);
    const breakdown = moneyLedgerByOrder.get(orderId) || { seller: 0, affiliate: 0, influencer: 0, beezio: 0, tax: 0, shipping: 0, processorFee: 0 };
    const payees = moneyLedgerPayeesByOrder.get(orderId) || { sellerId: null, affiliateId: null, influencers: [] as Array<{ id: string; amount: number }> };
    const batchRefs = moneyLedgerBatchRefsByOrder.get(orderId) || [];

    if (payeeType === 'seller') {
      breakdown.seller += netAmount || grossAmount;
      if (!payees.sellerId && payeeId) payees.sellerId = payeeId;
    } else if (payeeType === 'affiliate') {
      breakdown.affiliate += netAmount || grossAmount;
      if (!payees.affiliateId && payeeId) payees.affiliateId = payeeId;
    } else if (payeeType === 'influencer') {
      const amount = netAmount || grossAmount;
      breakdown.influencer += amount;
      if (payeeId) {
        const existing = payees.influencers.find((entry) => entry.id === payeeId);
        if (existing) existing.amount = round2(existing.amount + amount);
        else payees.influencers.push({ id: payeeId, amount });
      }
    } else if (payeeType === 'beezio') {
      breakdown.beezio += netAmount || grossAmount;
    } else if (payeeType === 'tax') {
      breakdown.tax += grossAmount || netAmount;
    } else if (payeeType === 'shipping') {
      breakdown.shipping += grossAmount || netAmount;
    } else if (payeeType === 'processor_fee') {
      breakdown.processorFee += grossAmount || netAmount;
    }

    const payoutBatchId = asText(row?.payout_batch_id);
    if (payoutBatchId && !batchRefs.some((entry) => entry.internal_batch_id === payoutBatchId)) {
      const providerBatchId = asText((row?.metadata as any)?.provider_batch_id) || null;
      batchRefs.push({ internal_batch_id: payoutBatchId, provider_batch_id: providerBatchId });
    }

    moneyLedgerByOrder.set(orderId, breakdown);
    moneyLedgerPayeesByOrder.set(orderId, payees);
    moneyLedgerBatchRefsByOrder.set(orderId, batchRefs);
  }

  const snapshotPayeesByOrder = new Map<string, { sellerId: string | null; affiliateId: string | null; influencers: Array<{ id: string; amount: number }> }>();
  const influencerSlotIdsByOrder = new Map<string, { sellerInfluencerId: string | null; affiliateInfluencerId: string | null }>();
  for (const row of snapshotResult.data as any[]) {
    const orderId = asText(row?.order_id);
    if (!orderId) continue;
    const payees = snapshotPayeesByOrder.get(orderId) || { sellerId: null, affiliateId: null, influencers: [] as Array<{ id: string; amount: number }> };
    const payeeRole = asText(row?.payee_role).toUpperCase();
    const payeeId = asText(row?.payee_user_id) || null;
    const amount = asMoney(row?.amount);
    const snapshotJson = row?.snapshot_json && typeof row.snapshot_json === 'object' ? row.snapshot_json as Record<string, unknown> : null;
    const slotIds = influencerSlotIdsByOrder.get(orderId) || { sellerInfluencerId: null, affiliateInfluencerId: null };
    if (!slotIds.sellerInfluencerId) slotIds.sellerInfluencerId = asText(snapshotJson?.seller_influencer_id) || null;
    if (!slotIds.affiliateInfluencerId) slotIds.affiliateInfluencerId = asText(snapshotJson?.partner_influencer_id) || null;
    influencerSlotIdsByOrder.set(orderId, slotIds);

    if (payeeRole === 'SELLER' && !payees.sellerId && payeeId) payees.sellerId = payeeId;
    if (payeeRole === 'PARTNER' && !payees.affiliateId && payeeId) payees.affiliateId = payeeId;
    if (payeeRole === 'INFLUENCER' && payeeId) {
      const existing = payees.influencers.find((entry) => entry.id === payeeId);
      if (existing) existing.amount = round2(existing.amount + amount);
      else payees.influencers.push({ id: payeeId, amount });
    }
    snapshotPayeesByOrder.set(orderId, payees);
  }

  const disputesByOrder = new Map<string, DisputeSnapshot[]>();
  for (const row of disputesResult.data as any[]) {
    const orderId = asText(row?.order_id);
    if (!orderId) continue;
    const current = disputesByOrder.get(orderId) || [];
    current.push({
      id: asText(row?.id),
      dispute_type: asText(row?.dispute_type) || '-',
      status: asText(row?.status) || '-',
      resolution_type: asText(row?.resolution_type) || null,
      refund_amount: asMoney(row?.refund_amount),
      created_at: asText(row?.created_at) || null,
      updated_at: asText(row?.updated_at) || null,
      resolved_at: asText(row?.resolved_at) || null,
    });
    disputesByOrder.set(orderId, current);
  }

  const profileIds = new Set<string>();
  for (const order of orders) {
    for (const id of [order?.buyer_id, order?.user_id, order?.seller_id, order?.partner_id, order?.affiliate_id, order?.influencer_id]) {
      const value = asText(id);
      if (value) profileIds.add(value);
    }
  }
  for (const row of moneyLedgerResult.data as any[]) {
    const payeeId = asText(row?.payee_id);
    if (payeeId) profileIds.add(payeeId);
  }
  for (const row of snapshotResult.data as any[]) {
    const payeeId = asText(row?.payee_user_id);
    if (payeeId) profileIds.add(payeeId);
  }

  const [profilesRes, paypalRes] = await Promise.all([
    profileIds.size ? supabaseAdmin.from('profiles').select('id, full_name, email').in('id', Array.from(profileIds)) : Promise.resolve({ data: [], error: null }),
    profileIds.size ? supabaseAdmin.from('paypal_accounts').select('user_id, role, paypal_email').in('user_id', Array.from(profileIds)) : Promise.resolve({ data: [], error: null }),
  ]);
  if ((profilesRes as any).error) throw new Error((profilesRes as any).error.message);
  if ((paypalRes as any).error) throw new Error((paypalRes as any).error.message);

  const profileMap = new Map<string, { name: string; email: string }>();
  for (const row of ((profilesRes as any).data as any[]) || []) {
    const id = asText(row?.id);
    if (!id) continue;
    profileMap.set(id, { name: asText(row?.full_name) || asText(row?.email) || id, email: asText(row?.email) });
  }

  const paypalByRoleMap = new Map<string, string>();
  const paypalMap = new Map<string, string>();
  for (const row of ((paypalRes as any).data as any[]) || []) {
    const userId = asText(row?.user_id);
    const role = asText(row?.role).toUpperCase();
    const email = asText(row?.paypal_email);
    if (!userId || !email) continue;
    paypalMap.set(userId, email);
    paypalByRoleMap.set(`${userId}::${role}`, email);
  }

  const rows = orders.map((order): AdminSalesLedgerRow => {
    const orderId = asText(order?.id);
    const orderItems = itemsByOrder.get(orderId) || [];
    const ledger = ledgerByOrder.get(orderId) || null;
    const moneyBreakdown = moneyLedgerByOrder.get(orderId) || null;
    const moneyPayees = moneyLedgerPayeesByOrder.get(orderId) || { sellerId: null, affiliateId: null, influencers: [] as Array<{ id: string; amount: number }> };
    const snapshotPayees = snapshotPayeesByOrder.get(orderId) || { sellerId: null, affiliateId: null, influencers: [] as Array<{ id: string; amount: number }> };
    const slotIds = influencerSlotIdsByOrder.get(orderId) || { sellerInfluencerId: null, affiliateInfluencerId: null };
    const moneyBatchRefs = moneyLedgerBatchRefsByOrder.get(orderId) || [];
    const disputes = (disputesByOrder.get(orderId) || []).sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
    const latestDispute = disputes[0] || null;
    const refundedAmount = round2(disputes.reduce((sum, dispute) => sum + asMoney(dispute.refund_amount), 0));

    const sellerId = asText(order?.seller_id) || asText(ledger?.seller_id) || snapshotPayees.sellerId || moneyPayees.sellerId || '';
    const affiliateId = asText(order?.affiliate_id) || asText(order?.partner_id) || asText(ledger?.partner_id) || snapshotPayees.affiliateId || moneyPayees.affiliateId || '';
    const legacyInfluencerId = asText(order?.influencer_id) || asText(ledger?.influencer_id) || '';
    const currency = asText(order?.currency) || 'USD';
    const quantity = orderItems.reduce((sum, item) => sum + Math.max(1, Number(item?.quantity || 1)), 0);
    const products = orderItems.map((item) => asText(item?.product_title) || asText(item?.title_snapshot) || asText(item?.sku)).filter(Boolean);
    const itemsSubtotal = round2(orderItems.reduce((sum, item) => {
      const qty = Math.max(1, Number(item?.quantity || 1));
      const unit = Number(item?.computed_listing_price ?? item?.price ?? 0) || 0;
      return sum + unit * qty;
    }, 0));
    const sellerAmount = asMoney(moneyBreakdown?.seller || ledger?.seller_earnings);
    const affiliateAmount = asMoney(moneyBreakdown?.affiliate || ledger?.partner_earnings);
    const influencerAmount = asMoney(moneyBreakdown?.influencer || ledger?.influencer_earnings);
    const paypalFee = asMoney(moneyBreakdown?.processorFee || ledger?.paypal_fee_estimate);
    const salesTax = asMoney(moneyBreakdown?.tax || order?.tax_amount);
    const shipping = asMoney(moneyBreakdown?.shipping || order?.shipping_amount);
    const grossSales = asMoney(itemsSubtotal > 0 ? itemsSubtotal + shipping + salesTax : Number(order?.total_charged ?? order?.total_amount ?? order?.subtotal_listing ?? 0));
    const beezioFee = asMoney(moneyBreakdown?.beezio || ledger?.beezio_profit || Math.max(grossSales - sellerAmount - affiliateAmount - influencerAmount - salesTax - shipping - paypalFee, 0));
    const beezioGrossRevenue = asMoney(Math.max(grossSales - sellerAmount - affiliateAmount - influencerAmount - salesTax - shipping, 0));
    const beezioNetRevenue = asMoney(Math.max(beezioGrossRevenue - paypalFee, 0));
    const sellerProfile = profileMap.get(sellerId);
    const affiliateProfile = profileMap.get(affiliateId);

    const getInfluencerSlot = (payeeId: string | null | undefined) => {
      const normalized = asText(payeeId);
      if (!normalized) return undefined;
      if (slotIds.sellerInfluencerId && normalized === slotIds.sellerInfluencerId) return 'seller_influencer' as const;
      if (slotIds.affiliateInfluencerId && normalized === slotIds.affiliateInfluencerId) return 'affiliate_influencer' as const;
      return undefined;
    };

    const moneyInfluencers: InfluencerPayee[] = moneyPayees.influencers.map((entry) => {
      const profile = profileMap.get(entry.id);
      return {
        id: entry.id,
        name: profile?.name || paypalMap.get(entry.id) || entry.id || '-',
        email: profile?.email || '',
        paypal_email: paypalByRoleMap.get(`${entry.id}::INFLUENCER`) || paypalMap.get(entry.id) || '',
        amount: round2(entry.amount),
        source: 'order_money_ledger',
        slot: getInfluencerSlot(entry.id),
      };
    });
    const snapshotInfluencers: InfluencerPayee[] = !moneyInfluencers.length ? snapshotPayees.influencers.map((entry) => {
      const profile = profileMap.get(entry.id);
      return {
        id: entry.id,
        name: profile?.name || paypalMap.get(entry.id) || entry.id || '-',
        email: profile?.email || '',
        paypal_email: paypalByRoleMap.get(`${entry.id}::INFLUENCER`) || paypalMap.get(entry.id) || '',
        amount: round2(entry.amount),
        source: 'payout_snapshots',
        slot: getInfluencerSlot(entry.id),
      };
    }) : [];
    const fallbackInfluencers: InfluencerPayee[] = !moneyInfluencers.length && !snapshotInfluencers.length && legacyInfluencerId && influencerAmount > 0 ? [{
      id: legacyInfluencerId,
      name: profileMap.get(legacyInfluencerId)?.name || paypalMap.get(legacyInfluencerId) || legacyInfluencerId || '-',
      email: profileMap.get(legacyInfluencerId)?.email || '',
      paypal_email: paypalByRoleMap.get(`${legacyInfluencerId}::INFLUENCER`) || paypalMap.get(legacyInfluencerId) || '',
      amount: influencerAmount,
      source: 'legacy',
      slot: getInfluencerSlot(legacyInfluencerId),
    }] : [];
    const influencers = [...moneyInfluencers, ...snapshotInfluencers, ...fallbackInfluencers];
    const primaryInfluencer = influencers[0] || { id: legacyInfluencerId || null, name: '-', email: '', paypal_email: '', amount: influencerAmount, source: 'legacy' as const };

    return {
      order_id: orderId,
      order_number: asText(order?.order_number) || null,
      provider_order_id: asText(order?.provider_order_id) || null,
      created_at: asText(order?.created_at) || null,
      updated_at: asText(order?.updated_at) || null,
      paid_at: asText(order?.paid_at) || null,
      order_status: asText(order?.status) || '-',
      payment_status: asText(order?.payment_status) || '-',
      fulfillment_status: asText(order?.fulfillment_status) || '-',
      dispute_status: asText(order?.dispute_status) || asText(latestDispute?.status) || 'NONE',
      is_counted_sale: isCompletedSale(asText(order?.status), asText(order?.payment_status)),
      is_refunded: isRefundedOrder(asText(order?.status), asText(order?.payment_status), refundedAmount),
      refunded_amount: refundedAmount,
      buyer_id: asText(order?.buyer_id || order?.user_id) || null,
      buyer_name: asText(order?.billing_name) || profileMap.get(asText(order?.buyer_id || order?.user_id))?.name || '-',
      buyer_email: asText(order?.billing_email) || profileMap.get(asText(order?.buyer_id || order?.user_id))?.email || '-',
      currency,
      quantity,
      products,
      tracking_number: asText(order?.tracking_number) || null,
      tracking_url: asText(order?.tracking_url) || null,
      shipping_address: order?.shipping_address || null,
      seller: {
        id: sellerId || null,
        name: sellerProfile?.name || paypalMap.get(sellerId) || sellerId || '-',
        email: sellerProfile?.email || '',
        paypal_email: paypalByRoleMap.get(`${sellerId}::SELLER`) || paypalMap.get(sellerId) || '',
        amount: sellerAmount,
      },
      affiliate: {
        id: affiliateId || null,
        name: affiliateProfile?.name || paypalMap.get(affiliateId) || affiliateId || '-',
        email: affiliateProfile?.email || '',
        paypal_email: paypalByRoleMap.get(`${affiliateId}::PARTNER`) || paypalByRoleMap.get(`${affiliateId}::AFFILIATE`) || paypalMap.get(affiliateId) || '',
        amount: affiliateAmount,
      },
      influencer: {
        id: primaryInfluencer.id || null,
        name: primaryInfluencer.name,
        email: primaryInfluencer.email || '',
        paypal_email: primaryInfluencer.paypal_email || '',
        amount: influencerAmount,
      },
      influencers,
      influencer_slots: influencers.filter((entry) => entry.slot === 'seller_influencer' || entry.slot === 'affiliate_influencer'),
      beezio_fee: beezioFee,
      paypal_fee: paypalFee,
      beezio_gross_revenue: beezioGrossRevenue,
      beezio_net_revenue: beezioNetRevenue,
      sales_tax: salesTax,
      shipping,
      gross_sales: grossSales,
      gross_amount: grossSales,
      matched_payout_batch_ids: moneyBatchRefs.map((entry) => entry.internal_batch_id).filter(Boolean),
      matched_provider_batch_ids: moneyBatchRefs.map((entry) => entry.provider_batch_id).filter(Boolean) as string[],
      payout_status: asText(ledger?.status) || '-',
      payout_created_at: asText(ledger?.created_at) || null,
      payout_paid_at: asText(ledger?.paid_at) || null,
      hold_release_at: asText(ledger?.hold_release_at) || null,
      latest_dispute: latestDispute,
      disputes,
    };
  });

  const filteredRows = search ? rows.filter((row) => {
    const haystack = [
      row.order_id, row.order_number, row.provider_order_id, row.buyer_name, row.buyer_email,
      row.seller.name, row.seller.email, row.affiliate.name, row.affiliate.email, row.influencer.name, row.influencer.email,
      ...row.products,
      ...row.influencers.map((entry) => `${entry.name} ${entry.email} ${entry.paypal_email}`),
    ].map((value) => asText(value).toLowerCase()).filter(Boolean);
    return haystack.some((value) => value.includes(search));
  }) : rows;

  const summary = roundSummary(filteredRows.reduce<AdminSalesLedgerSummary>((acc, row) => {
    if (!row.is_counted_sale) return acc;
    acc.orders += 1;
    acc.real_sales += row.is_refunded ? 0 : 1;
    acc.gross_sales += row.gross_sales;
    acc.seller_payouts += row.seller.amount;
    acc.affiliate_payouts += row.affiliate.amount;
    acc.influencer_payouts += row.influencer.amount;
    acc.beezio_fee += row.beezio_fee;
    acc.paypal_fee += row.paypal_fee;
    acc.beezio_gross_revenue += row.beezio_gross_revenue;
    acc.beezio_net_revenue += row.beezio_net_revenue;
    acc.sales_tax += row.sales_tax;
    acc.shipping += row.shipping;
    acc.refunded_orders += row.is_refunded ? 1 : 0;
    acc.refunded_amount += row.refunded_amount;
    acc.disputed_orders += row.dispute_status !== 'NONE' ? 1 : 0;
    acc.open_disputes += row.dispute_status === 'OPEN' ? 1 : 0;
    return acc;
  }, { orders: 0, real_sales: 0, gross_sales: 0, seller_payouts: 0, affiliate_payouts: 0, influencer_payouts: 0, beezio_fee: 0, paypal_fee: 0, beezio_gross_revenue: 0, beezio_net_revenue: 0, sales_tax: 0, shipping: 0, refunded_orders: 0, refunded_amount: 0, disputed_orders: 0, open_disputes: 0 }));

  return {
    summary,
    filters: { limit, startDate: startDate || null, endDate: endDate || null, search: search || null },
    rows: filteredRows,
  };
}
