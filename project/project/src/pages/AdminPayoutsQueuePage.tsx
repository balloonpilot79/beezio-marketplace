import { Fragment, useEffect, useMemo, useState } from 'react';
import Papa from 'papaparse';
import { supabase } from '../lib/supabase';
import { buildFinanceBuckets } from '../utils/adminFinance';

type PayeeSummary = {
  user_id: string;
  role: string;
  name: string;
  contact_email: string;
  paypal_email: string;
  email: string;
  total: number;
  lineCount: number;
  nextPayoutDate?: string | null;
};

type AdminBatchRow = {
  id: string;
  status: string;
  provider_batch_id: string | null;
  total_amount: number;
  item_count: number;
  created_at: string;
  submitted_at: string | null;
  payout_date?: string | null;
};

type AdminStatsResponse = {
  ok: boolean;
  env: {
    payoutsPaused: boolean;
    payoutsEnabled: boolean;
    minimumPayout: number;
    scheduledEnabled: boolean;
  };
  counts: {
    pending_hold_total: number;
    pending_hold_matured: number;
    ready_to_pay: number;
    on_hold_dispute: number;
  };
  payees: PayeeSummary[];
  recent_batches: AdminBatchRow[];
  daily_sales?: Array<{
    date: string;
    orders: number;
    gross_amount: number;
    payout_total: number;
    beezio_profit: number;
  }>;
  daily_payouts?: Array<{
    date: string;
    orders: number;
    gross_amount: number;
    payout_total: number;
    beezio_profit: number;
  }>;
  weekly_sales?: Array<{
    date: string;
    orders: number;
    gross_amount: number;
    payout_total: number;
    beezio_profit: number;
  }>;
  monthly_sales?: Array<{
    date: string;
    orders: number;
    gross_amount: number;
    payout_total: number;
    beezio_profit: number;
  }>;
  weekly_payouts?: Array<{
    date: string;
    orders: number;
    gross_amount: number;
    payout_total: number;
    beezio_profit: number;
  }>;
  monthly_payouts?: Array<{
    date: string;
    orders: number;
    gross_amount: number;
    payout_total: number;
    beezio_profit: number;
  }>;
  recent_ledger?: Array<{
    id: string;
    order_id: string | null;
    status: string;
    created_at: string | null;
    paid_at: string | null;
    gross_amount: number;
    seller_earnings: number;
    partner_earnings: number;
    influencer_earnings: number;
    payout_total: number;
    beezio_profit: number;
  }>;
};

type PayPalAdminConfig = {
  ok: boolean;
  enabled: boolean;
  env: 'sandbox' | 'live';
  configured?: {
    clientId?: boolean;
    clientSecret?: boolean;
  };
  payoutsApi?: {
    auth_ok: boolean;
    access_ok: boolean;
    checked_at: string;
    message: string;
    status?: number;
  } | null;
  payoutsPrerequisites?: string[];
  links?: {
    requestAccess?: string;
    standardDocs?: string;
  };
};

type PaymentLogRow = {
  id: string;
  created_at: string;
  status?: string | null;
  payment_status?: string | null;
  currency?: string | null;
  total_amount?: number | null;
  total_charged?: number | null;
  provider_order_id?: string | null;
  provider_capture_id?: string | null;
  billing_email?: string | null;
};

type SalesLedgerSummary = {
  orders: number;
  gross_sales: number;
  seller_payouts: number;
  affiliate_payouts: number;
  influencer_payouts: number;
  beezio_fee: number;
  paypal_fee: number;
  sales_tax: number;
  shipping: number;
};

type SalesLedgerRow = {
  order_id: string;
  order_number: string | null;
  created_at: string | null;
  order_status: string;
  payment_status: string;
  fulfillment_status: string;
  buyer_name: string;
  buyer_email: string;
  currency: string;
  quantity: number;
  products: string[];
  seller: { id: string | null; name: string; email: string; paypal_email?: string; amount: number };
  affiliate: { id: string | null; name: string; email: string; paypal_email?: string; amount: number };
  influencer: { id: string | null; name: string; email: string; paypal_email?: string; amount: number };
  influencers?: Array<{ id: string | null; name: string; email: string; paypal_email?: string; amount: number; source?: string; slot?: 'seller_influencer' | 'affiliate_influencer' }>;
  influencer_slots?: Array<{ id: string | null; name: string; email: string; paypal_email?: string; amount: number; source?: string; slot?: 'seller_influencer' | 'affiliate_influencer' }>;
  beezio_fee: number;
  paypal_fee: number;
  sales_tax: number;
  shipping: number;
  gross_sales: number;
  matched_payout_batch_ids?: string[];
  matched_provider_batch_ids?: string[];
  payout_status: string;
  payout_created_at: string | null;
  payout_paid_at: string | null;
  hold_release_at: string | null;
};

type AdminSalesLedgerResponse = {
  ok: boolean;
  summary: SalesLedgerSummary;
  rows: SalesLedgerRow[];
};

type ReportPreviewState = {
  title: string;
  subtitle: string;
  headers: string[];
  rows: Array<Array<string | number | null | undefined>>;
  csvContent?: string;
  csvFilename?: string;
};

type ReviewLineItem = {
  orderId: string;
  orderNumber: string | null;
  createdAt: string | null;
  buyerName: string;
  buyerEmail: string;
  productLabel: string;
  role: 'seller' | 'affiliate' | 'influencer';
  payeeId: string | null;
  payeeName: string;
  contactEmail: string;
  paypalEmail: string;
  amount: number;
  scheduledPayDate: string;
  payoutStatus: string;
  holdReleaseAt: string | null;
};

type ReviewGroup = {
  key: string;
  payeeName: string;
  role: 'seller' | 'affiliate' | 'influencer';
  contactEmail: string;
  paypalEmail: string;
  scheduledPayDate: string;
  total: number;
  lineCount: number;
  orders: number;
  lines: ReviewLineItem[];
};

type UserHistoryLine = {
  orderId: string;
  orderNumber: string | null;
  createdAt: string | null;
  role: 'seller' | 'affiliate' | 'influencer';
  amount: number;
  payoutStatus: string;
  scheduledPayDate: string;
  holdReleaseAt: string | null;
  buyerName: string;
  buyerEmail: string;
  products: string[];
  sellerName: string;
  affiliateName: string;
  influencerNames: string[];
};

type UserHistoryGroup = {
  key: string;
  userId: string | null;
  displayName: string;
  contactEmail: string;
  paypalEmail: string;
  roles: Array<'seller' | 'affiliate' | 'influencer'>;
  roleTotals: Record<'seller' | 'affiliate' | 'influencer', number>;
  total: number;
  orders: number;
  lineCount: number;
  uniqueProducts: string[];
  lines: UserHistoryLine[];
};

type PayoutAccountSummary = {
  key: string;
  userId: string | null;
  displayName: string;
  contactEmail: string;
  paypalEmail: string;
  dueRoleTotals: Record<'seller' | 'affiliate' | 'influencer', number>;
  dueTotal: number;
  holdTotal: number;
  nextPayoutAmount: number;
  nextPayoutDate: string | null;
  lifetimeRoleTotals: Record<'seller' | 'affiliate' | 'influencer', number>;
  lifetimeTotal: number;
  orderCount: number;
};

type FinanceCloseoutRow = {
  orderId: string;
  orderNumber: string | null;
  createdAt: string | null;
  buyerName: string;
  buyerEmail: string;
  productsLabel: string;
  quantity: number;
  sellerName: string;
  sellerPaypal: string;
  sellerAmount: number;
  affiliateName: string;
  affiliatePaypal: string;
  affiliateAmount: number;
  influencerNames: string;
  influencerPaypals: string;
  influencerAmount: number;
  grossSales: number;
  totalPayoutAmount: number;
  beezioFee: number;
  paypalFee: number;
  beezioNet: number;
  salesTax: number;
  shipping: number;
  matchedInternalBatchIds: string[];
  matchedProviderBatchIds: string[];
  orderStatus: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  payoutStatus: string;
  scheduledPayDate: string;
  holdReleaseAt: string | null;
  payoutPaidAt: string | null;
  missingPayPalRoles: string[];
};

type PayoutPartyDisplay = {
  id: string | null;
  name: string;
  email: string;
  paypal_email?: string;
  amount: number;
  source?: string;
  slot?: 'seller_influencer' | 'affiliate_influencer';
};

type FinanceCloseoutSummary = {
  orders: number;
  grossSales: number;
  totalPayouts: number;
  sellerPayouts: number;
  affiliatePayouts: number;
  influencerPayouts: number;
  beezioFee: number;
  paypalFees: number;
  beezioNet: number;
  salesTax: number;
  shipping: number;
  paidOrders: number;
  readyOrders: number;
  heldOrders: number;
  missingPayPalOrders: number;
  batchedOrders: number;
};

type ContractorTaxSummaryRow = {
  userId: string;
  displayName: string;
  contactEmail: string;
  payoutEmail: string;
  legalName: string;
  deliveryEmail: string;
  taxFormStatus: string;
  taxFormType: string;
  adminReviewStatus: string;
  independentContractorAck: string;
  taxIdLast4: string;
  last1099TaxYear: string;
  sellerAmount: number;
  affiliateAmount: number;
  influencerAmount: number;
  totalAmount: number;
  orderCount: number;
  paidOrderCount: number;
  missingPayPal: boolean;
  existing1099Status: string;
  existing1099Amount: number;
  existing1099IssuedAt: string;
  eligibleFor1099: boolean;
};

type SavedFinanceCloseoutReport = {
  id: string;
  report_title: string;
  created_at: string;
  generated_at: string;
  closeout_start_date: string;
  closeout_end_date: string;
  order_search: string;
  tax_year: number | null;
  row_count: number;
  gross_sales: number;
  total_payouts: number;
  beezio_net: number;
  summary: Partial<FinanceCloseoutSummary>;
  created_by_user_id: string;
  created_by_name: string;
  created_by_email: string;
};

type OrderDetail = {
  order: {
    id: string;
    order_number: string | null;
    provider_order_id: string | null;
    total_amount: number;
    total_charged: number | null;
    status: string;
    payment_status: string | null;
    fulfillment_status: string | null;
    created_at: string;
    billing_email: string;
    billing_name: string;
    shipping_address: Record<string, unknown> | null;
    tracking_number: string | null;
    tracking_url: string | null;
    seller: {
      id: string | null;
      name: string;
      email: string | null;
    };
    buyer: {
      id: string | null;
      name: string;
      email: string;
    };
    items: Array<{
      id: string;
      product_id: string;
      variant_id: string | null;
      quantity: number;
      price: number;
      seller_ask_amount: number;
      line_total: number;
      title: string;
      description: string | null;
      images: string[];
      sku: string | null;
      variant_label: string | null;
      variant_sku: string | null;
      cj_variant_id: string | null;
      external_variant_id: string | null;
      configured_affiliate_commission_percent: number;
      configured_affiliate_commission_amount: number;
      applied_affiliate_rate: number;
      applied_affiliate_commission_amount: number;
      platform_percent_at_purchase: number;
    }>;
    fee_summary: {
      seller_earnings: number;
      configured_affiliate_commission_total: number;
      applied_affiliate_commission_total: number;
      influencer_earnings: number;
      beezio_fee_gross: number;
      beezio_fee_net: number;
      paypal_fee_estimate: number;
      hold_release_at: string | null;
      payout_status: string | null;
    };
  };
};

const normalizeError = (payload: any, fallback: string) => {
  const base = String(payload?.error || fallback).trim();
  const details = String(payload?.details || '').trim();
  return details ? `${base}: ${details}` : base;
};

const pad2 = (value: number) => String(value).padStart(2, '0');

const getLastDayOfMonth = (year: number, month: number) => new Date(year, month, 0).getDate();

const csvEscape = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;

const getScheduledPaydayOnOrAfter = (eligibleAt: string | null | undefined) => {
  const date = eligibleAt ? new Date(eligibleAt) : new Date();
  if (Number.isNaN(date.getTime())) return getNextPayday();
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const lastDay = getLastDayOfMonth(year, month);
  if (day <= 15) return `${year}-${pad2(month)}-15`;
  if (day <= lastDay) return `${year}-${pad2(month)}-${pad2(lastDay)}`;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  return `${nextYear}-${pad2(nextMonth)}-15`;
};

const isBlockedPayoutStatus = (status: string) => {
  const normalized = String(status || '').trim().toUpperCase();
  return normalized === 'PAID' || normalized === 'ON_HOLD_DISPUTE' || normalized === 'FAILED';
};

const isHeldPayoutStatus = (status: string) => {
  const normalized = String(status || '').trim().toUpperCase();
  return normalized === 'PENDING_HOLD' || normalized === 'ON_HOLD_DISPUTE';
};

const monthKeyFromDate = (value: string | null | undefined) => {
  const date = new Date(String(value || ''));
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;
};

const getNextPayday = (from = new Date()) => {
  const year = from.getFullYear();
  const month = from.getMonth() + 1;
  const day = from.getDate();
  const lastDay = getLastDayOfMonth(year, month);
  if (day <= 15) return `${year}-${pad2(month)}-15`;
  if (day <= lastDay) return `${year}-${pad2(month)}-${pad2(lastDay)}`;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  return `${nextYear}-${pad2(nextMonth)}-15`;
};

const formatDateInputValue = (value: Date | string | null | undefined) => {
  const date = value instanceof Date ? value : new Date(String(value || ''));
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
};

const getDateRange = (filter: 'month') => {
  const now = new Date();
  if (filter === 'month') {
    return {
      start: new Date(now.getFullYear(), now.getMonth(), 1),
      end: now,
    };
  }
  return {
    start: new Date(2000, 0, 1),
    end: now,
  };
};

const formatAdminRoleLabel = (role: string | null | undefined) => {
  const normalized = String(role || '').trim().toLowerCase();
  if (normalized === 'partner') return 'affiliate';
  return normalized || 'unknown';
};

const formatCurrency = (value: number | null | undefined) => `$${Number(value || 0).toFixed(2)}`;

const formatDateTime = (value: string | null | undefined) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString();
};

const getCurrentTaxYear = () => new Date().getFullYear();

const formatAddressLines = (value: Record<string, unknown> | null | undefined) => {
  if (!value) return [] as string[];
  const pick = (...keys: string[]) => {
    for (const key of keys) {
      const raw = value[key];
      const text = String(raw || '').trim();
      if (text) return text;
    }
    return '';
  };
  const name = pick('name', 'full_name', 'fullName');
  const line1 = pick('line1', 'address1', 'street', 'street1');
  const line2 = pick('line2', 'address2', 'street2');
  const city = pick('city');
  const state = pick('state', 'province', 'region');
  const postal = pick('postal_code', 'zip', 'zipcode');
  const country = pick('country', 'country_code');
  return [
    name,
    line1,
    line2,
    [city, state, postal].filter(Boolean).join(', '),
    country,
  ].filter(Boolean);
};

const hasPayoutPartyIdentity = (party: Partial<PayoutPartyDisplay> | null | undefined) => (
  Boolean(String(party?.id || '').trim())
  || Boolean(String(party?.name || '').trim())
  || Boolean(String(party?.email || '').trim())
  || Boolean(String(party?.paypal_email || '').trim())
);

const createBeezioParty = (amount = 0): PayoutPartyDisplay => ({
  id: null,
  name: 'Beezio',
  email: '',
  paypal_email: undefined,
  amount: Number(amount || 0),
  source: 'beezio-fallback',
});

const normalizePayoutParty = (
  party: Partial<PayoutPartyDisplay> | null | undefined,
  fallbackAmount = 0
): PayoutPartyDisplay => {
  if (!hasPayoutPartyIdentity(party)) return createBeezioParty(fallbackAmount);
  return {
    id: party?.id ? String(party.id) : null,
    name: String(party?.name || party?.email || party?.paypal_email || 'Beezio').trim() || 'Beezio',
    email: String(party?.email || '').trim(),
    paypal_email: String(party?.paypal_email || '').trim() || undefined,
    amount: Number(party?.amount || fallbackAmount || 0),
    source: party?.source,
    slot: party?.slot,
  };
};

const resolveInfluencerSlots = (row: SalesLedgerRow | null | undefined): [PayoutPartyDisplay, PayoutPartyDisplay] => {
  const slotCandidates = Array.isArray(row?.influencer_slots) && row.influencer_slots.length
    ? row.influencer_slots
    : (row?.influencers?.length ? row.influencers : row?.influencer ? [row.influencer] : []);
  const sellerSlot = slotCandidates.find((party) => party?.slot === 'seller_influencer');
  const affiliateSlot = slotCandidates.find((party) => party?.slot === 'affiliate_influencer');
  if (sellerSlot || affiliateSlot) {
    return [
      normalizePayoutParty(sellerSlot, sellerSlot?.amount || 0),
      normalizePayoutParty(affiliateSlot, affiliateSlot?.amount || 0),
    ];
  }
  const fallback = slotCandidates.slice(0, 2).map((party) => normalizePayoutParty(party, party.amount));
  while (fallback.length < 2) fallback.push(createBeezioParty());
  return [fallback[0], fallback[1]];
};

const formatPayoutPartyMeta = (party: PayoutPartyDisplay) => {
  if (party.paypal_email) return `PayPal: ${party.paypal_email}`;
  if (party.email) return party.email;
  return 'Beezio fallback';
};

const escapeHtml = (value: unknown) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

export default function AdminPayoutsQueuePage() {
  const [stats, setStats] = useState<AdminStatsResponse | null>(null);
  const [payees, setPayees] = useState<PayeeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [lastActionResult, setLastActionResult] = useState<any>(null);

  const [paypalConfig, setPaypalConfig] = useState<PayPalAdminConfig | null>(null);
  const [paypalConfigLoading, setPaypalConfigLoading] = useState(false);
  const [paypalConfigError, setPaypalConfigError] = useState<string | null>(null);
  const [paypalEnvSaving, setPaypalEnvSaving] = useState(false);

  const [paymentLogs, setPaymentLogs] = useState<PaymentLogRow[]>([]);
  const [paymentLogsLoading, setPaymentLogsLoading] = useState(false);
  const [paymentLogsError, setPaymentLogsError] = useState<string | null>(null);
  const [salesLedger, setSalesLedger] = useState<AdminSalesLedgerResponse | null>(null);
  const [salesLedgerLoading, setSalesLedgerLoading] = useState(false);
  const [salesLedgerError, setSalesLedgerError] = useState<string | null>(null);
  const [payoutDate, setPayoutDate] = useState<string>(() => getNextPayday());
  const [closeoutStartDate, setCloseoutStartDate] = useState<string>(() => formatDateInputValue(getDateRange('month').start));
  const [closeoutEndDate, setCloseoutEndDate] = useState<string>(() => formatDateInputValue(getDateRange('month').end));
  const [closeoutOrderSearch, setCloseoutOrderSearch] = useState('');
  const [taxYear, setTaxYear] = useState<string>(() => String(getCurrentTaxYear()));
  const [savedCloseoutReports, setSavedCloseoutReports] = useState<SavedFinanceCloseoutReport[]>([]);
  const [savedCloseoutReportsLoading, setSavedCloseoutReportsLoading] = useState(false);
  const [savedCloseoutReportsError, setSavedCloseoutReportsError] = useState<string | null>(null);
  const [batchReviewConfirmed, setBatchReviewConfirmed] = useState(false);
  const [ledgerSearch, setLedgerSearch] = useState('');
  const [ledgerPayoutDateFilter, setLedgerPayoutDateFilter] = useState<'all' | 'due_by_selected' | 'exact_selected'>('all');
  const [ledgerRoleFilter, setLedgerRoleFilter] = useState<'all' | 'seller' | 'affiliate' | 'influencer' | 'buyer'>('all');
  const [ledgerStatusFilter, setLedgerStatusFilter] = useState<'all' | 'ready' | 'paid' | 'held' | 'problem'>('all');
  const [approvalCandidate, setApprovalCandidate] = useState<{ batchId: string; totalAmount: number; itemCount: number; payoutDate: string } | null>(null);
  const [selectedPayoutOrderId, setSelectedPayoutOrderId] = useState<string | null>(null);
  const [selectedPayoutDetail, setSelectedPayoutDetail] = useState<OrderDetail | null>(null);
  const [selectedPayoutDetailLoading, setSelectedPayoutDetailLoading] = useState(false);
  const [selectedPayoutDetailError, setSelectedPayoutDetailError] = useState<string | null>(null);
  const [userHistorySearch, setUserHistorySearch] = useState('');
  const [selectedUserHistoryKey, setSelectedUserHistoryKey] = useState<string | null>(null);
  const [reportPreview, setReportPreview] = useState<ReportPreviewState | null>(null);

  const getSessionToken = async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) throw new Error('Not authenticated');
    return token;
  };

  const withAdminErrorHint = (message: string) => {
    const text = String(message || '');
    if (text.toLowerCase().includes('forbidden')) {
      return `${text}. Your account is authenticated but missing admin role mapping.`;
    }
    if (text.toLowerCase().includes('standard payouts access')) {
      return `${text}. Use the PayPal Standard Payouts request link below and verify the PayPal business account is fully set up.`;
    }
    return text;
  };

  const loadStats = async () => {
    const token = await getSessionToken();
    const res = await fetch('/api/payouts/admin-stats', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
        body: JSON.stringify({ payout_date: payoutDate }),
    });
    const payload = (await res.json().catch(() => ({}))) as AdminStatsResponse;
    if (!res.ok) throw new Error(withAdminErrorHint(normalizeError(payload, 'Failed to load payout stats')));
    setStats(payload);
    setPayees(Array.isArray(payload.payees) ? payload.payees : []);
  };

  const loadPayPalConfig = async () => {
    setPaypalConfigLoading(true);
    setPaypalConfigError(null);
    try {
      const token = await getSessionToken();
      const res = await fetch('/api/paypal-admin-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      });
      const payload = (await res.json().catch(() => ({}))) as PayPalAdminConfig;
      if (!res.ok) throw new Error(withAdminErrorHint(normalizeError(payload, 'Failed to load PayPal config')));
      setPaypalConfig(payload);
    } catch (err: any) {
      setPaypalConfigError(err?.message || 'Failed to load PayPal config.');
    } finally {
      setPaypalConfigLoading(false);
    }
  };

  const loadPaymentLogs = async () => {
    setPaymentLogsLoading(true);
    setPaymentLogsError(null);
    try {
      const token = await getSessionToken();
      const res = await fetch('/api/paypal-admin-transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ limit: 50 }),
      });
      const payload = (await res.json().catch(() => ({}))) as { rows?: PaymentLogRow[]; error?: string };
      if (!res.ok) throw new Error(withAdminErrorHint(normalizeError(payload, 'Failed to load payment logs')));
      setPaymentLogs(Array.isArray(payload?.rows) ? payload.rows : []);
    } catch (err: any) {
      setPaymentLogsError(err?.message || 'Failed to load payment logs.');
    } finally {
      setPaymentLogsLoading(false);
    }
  };

  const loadSalesLedger = async () => {
    setSalesLedgerLoading(true);
    setSalesLedgerError(null);
    try {
      const token = await getSessionToken();
      const res = await fetch('/api/admin/sales-ledger', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ limit: 20000 }),
      });
      const payload = (await res.json().catch(() => ({}))) as AdminSalesLedgerResponse & { error?: string; details?: string };
      if (!res.ok) throw new Error(withAdminErrorHint(normalizeError(payload, 'Failed to load sales ledger')));
      setSalesLedger(payload);
    } catch (err: any) {
      setSalesLedgerError(err?.message || 'Failed to load sales ledger.');
    } finally {
      setSalesLedgerLoading(false);
    }
  };

  const loadSavedCloseoutReports = async () => {
    setSavedCloseoutReportsLoading(true);
    setSavedCloseoutReportsError(null);
    try {
      const token = await getSessionToken();
      const res = await fetch('/api/admin-finance-closeouts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: 'list', limit: 12 }),
      });
      const payload = (await res.json().catch(() => ({}))) as { reports?: SavedFinanceCloseoutReport[]; error?: string; details?: string };
      if (!res.ok) throw new Error(withAdminErrorHint(normalizeError(payload, 'Failed to load saved finance closeouts')));
      setSavedCloseoutReports(Array.isArray(payload?.reports) ? payload.reports : []);
    } catch (err: any) {
      setSavedCloseoutReportsError(err?.message || 'Failed to load saved finance closeouts.');
    } finally {
      setSavedCloseoutReportsLoading(false);
    }
  };

  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      setError(null);
      setLastActionResult(null);
      try {
        await loadStats();
        await Promise.all([loadPayPalConfig(), loadPaymentLogs(), loadSalesLedger(), loadSavedCloseoutReports()]);
      } catch (err: any) {
        setError(err?.message || 'Failed to load payout queue.');
      } finally {
        setLoading(false);
      }
    };

    void loadAll();
  }, [payoutDate]);

  useEffect(() => {
    setBatchReviewConfirmed(false);
    setApprovalCandidate(null);
  }, [payoutDate, salesLedger?.rows?.length]);

  useEffect(() => {
    setBatchReviewConfirmed(false);
    setApprovalCandidate(null);
  }, [ledgerSearch, ledgerPayoutDateFilter, ledgerRoleFilter, ledgerStatusFilter]);

  const totalAmount = useMemo(() => payees.reduce((sum, item) => sum + item.total, 0), [payees]);
  const financeBuckets = useMemo(() => buildFinanceBuckets(salesLedger?.rows || []), [salesLedger]);
  const paidOutBuckets = useMemo(
    () =>
      buildFinanceBuckets(salesLedger?.rows || [], {
        getDate: (row) => (row as SalesLedgerRow & { payout_paid_at?: string | null }).payout_paid_at || null,
        includeRow: (row) => String((row as SalesLedgerRow & { payout_status?: string | null }).payout_status || '').toUpperCase() === 'PAID',
      }),
    [salesLedger]
  );
  const filteredSalesLedgerRows = useMemo(() => {
    const searchNeedle = ledgerSearch.trim().toLowerCase();

    return (salesLedger?.rows || []).filter((row) => {
      const scheduledPayDate = getScheduledPaydayOnOrAfter(row.hold_release_at || row.created_at);
      if (ledgerPayoutDateFilter === 'due_by_selected' && scheduledPayDate > payoutDate) return false;
      if (ledgerPayoutDateFilter === 'exact_selected' && scheduledPayDate !== payoutDate) return false;

      const payoutStatus = String(row.payout_status || '').trim().toUpperCase();
      if (ledgerStatusFilter === 'ready' && !['READY_TO_PAY', 'PENDING_HOLD', 'PREPARED'].includes(payoutStatus)) return false;
      if (ledgerStatusFilter === 'paid' && payoutStatus !== 'PAID') return false;
      if (ledgerStatusFilter === 'held' && !['PENDING_HOLD', 'ON_HOLD_DISPUTE'].includes(payoutStatus)) return false;
      if (ledgerStatusFilter === 'problem' && !['FAILED', 'ON_HOLD_DISPUTE'].includes(payoutStatus)) return false;

      if (ledgerRoleFilter !== 'all') {
        if (ledgerRoleFilter === 'buyer') {
          const buyerHaystack = [row.buyer_name, row.buyer_email].join(' ').toLowerCase();
          if (!buyerHaystack.includes(searchNeedle || buyerHaystack)) return false;
        } else if (ledgerRoleFilter === 'seller' && Number(row.seller.amount || 0) <= 0) {
          return false;
        } else if (ledgerRoleFilter === 'affiliate' && Number(row.affiliate.amount || 0) <= 0) {
          return false;
        } else if (
          ledgerRoleFilter === 'influencer' &&
          !(row.influencers && row.influencers.some((entry) => Number(entry?.amount || 0) > 0)) &&
          Number(row.influencer.amount || 0) <= 0
        ) {
          return false;
        }
      }

      if (!searchNeedle) return true;

      const influencerEntries = row.influencers && row.influencers.length ? row.influencers : [row.influencer];
      const haystack = [
        row.order_id,
        row.order_number,
        row.buyer_name,
        row.buyer_email,
        row.seller.name,
        row.seller.email,
        row.seller.paypal_email,
        row.affiliate.name,
        row.affiliate.email,
        row.affiliate.paypal_email,
        ...row.products,
        ...influencerEntries.flatMap((entry) => [entry?.name, entry?.email, entry?.paypal_email, entry?.id]),
      ]
        .map((value) => String(value || '').toLowerCase())
        .filter(Boolean);

      return haystack.some((value) => value.includes(searchNeedle));
    });
  }, [ledgerPayoutDateFilter, ledgerRoleFilter, ledgerSearch, ledgerStatusFilter, payoutDate, salesLedger]);
  const payoutReviewGroups = useMemo<ReviewGroup[]>(() => {
    const rows = salesLedger?.rows || [];
    const lines: ReviewLineItem[] = [];

    rows.forEach((row) => {
      const scheduledPayDate = getScheduledPaydayOnOrAfter(row.hold_release_at || row.created_at);
      if (scheduledPayDate > payoutDate) return;
      if (isBlockedPayoutStatus(row.payout_status)) return;

      const productLabel = row.products.length ? row.products.join(', ') : '-';

      if (Number(row.seller.amount || 0) > 0) {
        lines.push({
          orderId: row.order_id,
          orderNumber: row.order_number,
          createdAt: row.created_at,
          buyerName: row.buyer_name,
          buyerEmail: row.buyer_email,
          productLabel,
          role: 'seller',
          payeeId: row.seller.id,
          payeeName: row.seller.name,
          contactEmail: row.seller.email || '',
          paypalEmail: row.seller.paypal_email || '',
          amount: Number(row.seller.amount || 0),
          scheduledPayDate,
          payoutStatus: row.payout_status,
          holdReleaseAt: row.hold_release_at,
        });
      }

      if (Number(row.affiliate.amount || 0) > 0) {
        lines.push({
          orderId: row.order_id,
          orderNumber: row.order_number,
          createdAt: row.created_at,
          buyerName: row.buyer_name,
          buyerEmail: row.buyer_email,
          productLabel,
          role: 'affiliate',
          payeeId: row.affiliate.id,
          payeeName: row.affiliate.name,
          contactEmail: row.affiliate.email || '',
          paypalEmail: row.affiliate.paypal_email || '',
          amount: Number(row.affiliate.amount || 0),
          scheduledPayDate,
          payoutStatus: row.payout_status,
          holdReleaseAt: row.hold_release_at,
        });
      }

      const influencerEntries = (row.influencers && row.influencers.length ? row.influencers : [row.influencer]).filter(
        (entry) => Number(entry?.amount || 0) > 0
      );

      influencerEntries.forEach((entry) => {
        lines.push({
          orderId: row.order_id,
          orderNumber: row.order_number,
          createdAt: row.created_at,
          buyerName: row.buyer_name,
          buyerEmail: row.buyer_email,
          productLabel,
          role: 'influencer',
          payeeId: entry.id,
          payeeName: entry.name,
          contactEmail: entry.email || '',
          paypalEmail: entry.paypal_email || '',
          amount: Number(entry.amount || 0),
          scheduledPayDate,
          payoutStatus: row.payout_status,
          holdReleaseAt: row.hold_release_at,
        });
      });
    });

    const groups = new Map<string, ReviewGroup>();
    lines.forEach((line) => {
      const key = `${line.role}::${line.payeeId || line.paypalEmail || line.contactEmail || line.payeeName}`;
      const current = groups.get(key) || {
        key,
        payeeName: line.payeeName || line.paypalEmail || 'Unknown payee',
        role: line.role,
        contactEmail: line.contactEmail,
        paypalEmail: line.paypalEmail,
        scheduledPayDate: line.scheduledPayDate,
        total: 0,
        lineCount: 0,
        orders: 0,
        lines: [],
      };
      current.total += line.amount;
      current.lineCount += 1;
      current.lines.push(line);
      current.orders = new Set(current.lines.map((entry) => entry.orderId)).size;
      groups.set(key, current);
    });

    return Array.from(groups.values())
      .map((group) => ({
        ...group,
        total: Number(group.total.toFixed(2)),
        lines: [...group.lines].sort((a, b) => {
          const left = new Date(a.createdAt || 0).getTime();
          const right = new Date(b.createdAt || 0).getTime();
          return right - left;
        }),
      }))
      .sort((a, b) => b.total - a.total);
  }, [payoutDate, salesLedger]);

  const userHistoryGroups = useMemo<UserHistoryGroup[]>(() => {
    const groups = new Map<string, UserHistoryGroup>();

    const upsertLine = (
      role: 'seller' | 'affiliate' | 'influencer',
      row: SalesLedgerRow,
      payee: { id: string | null; name: string; email?: string; paypal_email?: string; amount: number }
    ) => {
      const amount = Number(payee.amount || 0);
      if (amount <= 0) return;

      const key = `${payee.id || payee.paypal_email || payee.email || payee.name}::history`;
      const current = groups.get(key) || {
        key,
        userId: payee.id || null,
        displayName: payee.name || payee.paypal_email || payee.email || 'Unknown user',
        contactEmail: payee.email || '',
        paypalEmail: payee.paypal_email || '',
        roles: [],
        roleTotals: { seller: 0, affiliate: 0, influencer: 0 },
        total: 0,
        orders: 0,
        lineCount: 0,
        uniqueProducts: [],
        lines: [],
      };

      current.total += amount;
      current.roleTotals[role] += amount;
      current.roles = Array.from(new Set([...current.roles, role]));
      current.lines.push({
        orderId: row.order_id,
        orderNumber: row.order_number,
        createdAt: row.created_at,
        role,
        amount,
        payoutStatus: row.payout_status,
        scheduledPayDate: getScheduledPaydayOnOrAfter(row.hold_release_at || row.created_at),
        holdReleaseAt: row.hold_release_at,
        buyerName: row.buyer_name,
        buyerEmail: row.buyer_email,
        products: row.products,
        sellerName: row.seller.name,
        affiliateName: row.affiliate.name,
        influencerNames: (row.influencers && row.influencers.length ? row.influencers : [row.influencer])
          .filter((entry) => Number(entry?.amount || 0) > 0)
          .map((entry) => entry.name || '-')
          .filter(Boolean),
      });
      current.uniqueProducts = Array.from(new Set([...current.uniqueProducts, ...row.products.filter(Boolean)])).sort();
      current.lineCount = current.lines.length;
      current.orders = new Set(current.lines.map((line) => line.orderId)).size;
      groups.set(key, current);
    };

    (salesLedger?.rows || []).forEach((row) => {
      upsertLine('seller', row, row.seller);
      upsertLine('affiliate', row, row.affiliate);
      (row.influencers && row.influencers.length ? row.influencers : [row.influencer])
        .filter((entry) => Number(entry?.amount || 0) > 0)
        .forEach((entry) => upsertLine('influencer', row, entry));
    });

    return Array.from(groups.values())
      .map((group) => ({
        ...group,
        total: Number(group.total.toFixed(2)),
        roleTotals: {
          seller: Number(group.roleTotals.seller.toFixed(2)),
          affiliate: Number(group.roleTotals.affiliate.toFixed(2)),
          influencer: Number(group.roleTotals.influencer.toFixed(2)),
        },
        lines: [...group.lines].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()),
      }))
      .sort((a, b) => b.total - a.total);
  }, [salesLedger]);

  const filteredUserHistoryGroups = useMemo(() => {
    const needle = userHistorySearch.trim().toLowerCase();
    if (!needle) return userHistoryGroups;
    return userHistoryGroups.filter((group) => {
      const haystack = [
        group.displayName,
        group.contactEmail,
        group.paypalEmail,
        ...group.roles,
        ...group.uniqueProducts,
        ...group.lines.flatMap((line) => [line.orderId, line.orderNumber, line.buyerName, line.buyerEmail, ...line.products]),
      ]
        .map((value) => String(value || '').toLowerCase())
        .filter(Boolean);
      return haystack.some((value) => value.includes(needle));
    });
  }, [userHistoryGroups, userHistorySearch]);

  useEffect(() => {
    if (!filteredUserHistoryGroups.length) {
      setSelectedUserHistoryKey(null);
      return;
    }
    if (!selectedUserHistoryKey || !filteredUserHistoryGroups.some((group) => group.key === selectedUserHistoryKey)) {
      setSelectedUserHistoryKey(filteredUserHistoryGroups[0].key);
    }
  }, [filteredUserHistoryGroups, selectedUserHistoryKey]);

  const selectedUserHistoryGroup = useMemo(
    () => filteredUserHistoryGroups.find((group) => group.key === selectedUserHistoryKey) || filteredUserHistoryGroups[0] || null,
    [filteredUserHistoryGroups, selectedUserHistoryKey]
  );

  const selectedUserCurrentPaydayLines = useMemo(() => {
    if (!selectedUserHistoryGroup) return [] as UserHistoryLine[];
    return selectedUserHistoryGroup.lines.filter((line) => line.scheduledPayDate <= payoutDate && !isBlockedPayoutStatus(line.payoutStatus));
  }, [payoutDate, selectedUserHistoryGroup]);

  const payoutAccountSummaries = useMemo<PayoutAccountSummary[]>(() => {
    return userHistoryGroups
      .map((group) => {
        const dueRoleTotals = { seller: 0, affiliate: 0, influencer: 0 };
        const futureBuckets = new Map<string, number>();
        let holdTotal = 0;

        group.lines.forEach((line) => {
          const amount = Number(line.amount || 0);
          const payoutStatus = String(line.payoutStatus || '').trim().toUpperCase();
          const isPaid = payoutStatus === 'PAID';

          if (amount <= 0 || isPaid) return;

          if (line.scheduledPayDate <= payoutDate && !isBlockedPayoutStatus(line.payoutStatus)) {
            dueRoleTotals[line.role] += amount;
          }

          if (isHeldPayoutStatus(line.payoutStatus)) {
            holdTotal += amount;
          }

          if (!isBlockedPayoutStatus(line.payoutStatus) && line.scheduledPayDate > payoutDate) {
            futureBuckets.set(line.scheduledPayDate, (futureBuckets.get(line.scheduledPayDate) || 0) + amount);
          }
        });

        const nextPayoutDate = Array.from(futureBuckets.keys()).sort()[0] || null;

        return {
          key: group.key,
          userId: group.userId,
          displayName: group.displayName,
          contactEmail: group.contactEmail,
          paypalEmail: group.paypalEmail,
          dueRoleTotals: {
            seller: Number(dueRoleTotals.seller.toFixed(2)),
            affiliate: Number(dueRoleTotals.affiliate.toFixed(2)),
            influencer: Number(dueRoleTotals.influencer.toFixed(2)),
          },
          dueTotal: Number((dueRoleTotals.seller + dueRoleTotals.affiliate + dueRoleTotals.influencer).toFixed(2)),
          holdTotal: Number(holdTotal.toFixed(2)),
          nextPayoutAmount: Number(((nextPayoutDate ? futureBuckets.get(nextPayoutDate) || 0 : 0)).toFixed(2)),
          nextPayoutDate,
          lifetimeRoleTotals: group.roleTotals,
          lifetimeTotal: group.total,
          orderCount: group.orders,
        };
      })
      .filter((group) => group.dueTotal > 0 || group.holdTotal > 0 || group.nextPayoutAmount > 0)
      .sort((a, b) => {
        if (b.dueTotal !== a.dueTotal) return b.dueTotal - a.dueTotal;
        if (b.holdTotal !== a.holdTotal) return b.holdTotal - a.holdTotal;
        return a.displayName.localeCompare(b.displayName);
      });
  }, [payoutDate, userHistoryGroups]);

  const duePayoutAccounts = useMemo(
    () => payoutAccountSummaries.filter((group) => group.dueTotal > 0),
    [payoutAccountSummaries]
  );

  const duePayoutAccountsPreview = useMemo(
    () => duePayoutAccounts.slice(0, 8),
    [duePayoutAccounts]
  );

  const openUserHistoryFromPayout = (groupKey: string) => {
    setSelectedUserHistoryKey(groupKey);
    window.requestAnimationFrame(() => {
      document.getElementById('admin-user-history')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const salesLedgerByOrderId = useMemo(() => {
    const entries = (salesLedger?.rows || []).map((row) => [row.order_id, row] as const);
    return new Map(entries);
  }, [salesLedger]);

  const selectedPayoutRow = useMemo(
    () => (selectedPayoutOrderId ? salesLedgerByOrderId.get(selectedPayoutOrderId) || null : null),
    [salesLedgerByOrderId, selectedPayoutOrderId]
  );

  const monthlyFinanceRows = useMemo(() => {
    const monthMap = new Map<string, ReturnType<typeof buildFinanceBuckets>['monthly']>();
    (salesLedger?.rows || []).forEach((row) => {
      const key = monthKeyFromDate(row.created_at);
      const current = monthMap.get(key) || {
        orders: 0,
        grossSales: 0,
        sellerPayouts: 0,
        affiliatePayouts: 0,
        influencerPayouts: 0,
        beezioProfit: 0,
        paypalFees: 0,
        salesTax: 0,
        shipping: 0,
      };
      current.orders += 1;
      current.grossSales += Number(row.gross_sales || 0);
      current.sellerPayouts += Number(row.seller.amount || 0);
      current.affiliatePayouts += Number(row.affiliate.amount || 0);
      current.influencerPayouts += Number(row.influencer.amount || 0);
      current.beezioProfit += Number(row.beezio_fee || 0);
      current.paypalFees += Number(row.paypal_fee || 0);
      current.salesTax += Number(row.sales_tax || 0);
      current.shipping += Number(row.shipping || 0);
      monthMap.set(key, current);
    });
    return Array.from(monthMap.entries())
      .map(([month, bucket]) => ({
        month,
        ...bucket,
      }))
      .sort((a, b) => b.month.localeCompare(a.month));
  }, [salesLedger]);

  const financeCloseoutRows = useMemo<FinanceCloseoutRow[]>(() => {
    const startTime = closeoutStartDate ? new Date(`${closeoutStartDate}T00:00:00.000Z`).getTime() : Number.NEGATIVE_INFINITY;
    const endTime = closeoutEndDate ? new Date(`${closeoutEndDate}T23:59:59.999Z`).getTime() : Number.POSITIVE_INFINITY;
    const orderNeedle = closeoutOrderSearch.trim().toLowerCase();

    return (salesLedger?.rows || [])
      .filter((row) => {
        const createdTime = row.created_at ? new Date(row.created_at).getTime() : Number.NaN;
        if (Number.isFinite(startTime) && Number.isFinite(createdTime) && createdTime < startTime) return false;
        if (Number.isFinite(endTime) && Number.isFinite(createdTime) && createdTime > endTime) return false;
        if (Number.isFinite(startTime) && !Number.isFinite(createdTime)) return false;

        if (!orderNeedle) return true;
        const haystack = [row.order_id, row.order_number, row.buyer_name, row.buyer_email]
          .map((value) => String(value || '').toLowerCase())
          .filter(Boolean);
        return haystack.some((value) => value.includes(orderNeedle));
      })
      .map((row) => {
        const influencers = (row.influencers && row.influencers.length ? row.influencers : [row.influencer]).filter(
          (entry) => Number(entry?.amount || 0) > 0
        );
        const influencerAmount = influencers.reduce((sum, entry) => sum + Number(entry?.amount || 0), 0);
        const sellerAmount = Number(row.seller.amount || 0);
        const affiliateAmount = Number(row.affiliate.amount || 0);
        const totalPayoutAmount = sellerAmount + affiliateAmount + influencerAmount;
        const scheduledPayDate = getScheduledPaydayOnOrAfter(row.hold_release_at || row.created_at);
        const matchedInternalBatchIds = Array.from(new Set((row.matched_payout_batch_ids || []).map((entry) => String(entry || '').trim()).filter(Boolean)));
        const matchedProviderBatchIds = Array.from(new Set((row.matched_provider_batch_ids || []).map((entry) => String(entry || '').trim()).filter(Boolean)));
        const missingPayPalRoles = [
          sellerAmount > 0 && !String(row.seller.paypal_email || '').trim() ? 'seller' : '',
          affiliateAmount > 0 && !String(row.affiliate.paypal_email || '').trim() ? 'affiliate' : '',
          influencerAmount > 0 && influencers.some((entry) => !String(entry?.paypal_email || '').trim()) ? 'influencer' : '',
        ].filter(Boolean);

        return {
          orderId: row.order_id,
          orderNumber: row.order_number,
          createdAt: row.created_at,
          buyerName: row.buyer_name,
          buyerEmail: row.buyer_email,
          productsLabel: row.products.join(' | '),
          quantity: Number(row.quantity || 0),
          sellerName: row.seller.name,
          sellerPaypal: String(row.seller.paypal_email || ''),
          sellerAmount,
          affiliateName: row.affiliate.name,
          affiliatePaypal: String(row.affiliate.paypal_email || ''),
          affiliateAmount,
          influencerNames: influencers.map((entry) => entry?.name || '-').join(' | '),
          influencerPaypals: influencers.map((entry) => entry?.paypal_email || '').filter(Boolean).join(' | '),
          influencerAmount,
          grossSales: Number(row.gross_sales || 0),
          totalPayoutAmount,
          beezioFee: Number(row.beezio_fee || 0),
          paypalFee: Number(row.paypal_fee || 0),
          beezioNet: Number(row.beezio_fee || 0) - Number(row.paypal_fee || 0),
          salesTax: Number(row.sales_tax || 0),
          shipping: Number(row.shipping || 0),
          matchedInternalBatchIds,
          matchedProviderBatchIds,
          orderStatus: row.order_status,
          paymentStatus: row.payment_status,
          fulfillmentStatus: row.fulfillment_status,
          payoutStatus: row.payout_status,
          scheduledPayDate,
          holdReleaseAt: row.hold_release_at,
          payoutPaidAt: row.payout_paid_at,
          missingPayPalRoles,
        };
      })
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  }, [closeoutEndDate, closeoutOrderSearch, closeoutStartDate, salesLedger]);

  const financeCloseoutSummary = useMemo<FinanceCloseoutSummary>(() => {
    return financeCloseoutRows.reduce<FinanceCloseoutSummary>((acc, row) => {
      acc.orders += 1;
      acc.grossSales += row.grossSales;
      acc.totalPayouts += row.totalPayoutAmount;
      acc.sellerPayouts += row.sellerAmount;
      acc.affiliatePayouts += row.affiliateAmount;
      acc.influencerPayouts += row.influencerAmount;
      acc.beezioFee += row.beezioFee;
      acc.paypalFees += row.paypalFee;
      acc.beezioNet += row.beezioNet;
      acc.salesTax += row.salesTax;
      acc.shipping += row.shipping;
      if (String(row.payoutStatus || '').trim().toUpperCase() === 'PAID') acc.paidOrders += 1;
      if (['READY_TO_PAY', 'PENDING_HOLD', 'PREPARED'].includes(String(row.payoutStatus || '').trim().toUpperCase())) acc.readyOrders += 1;
      if (['PENDING_HOLD', 'ON_HOLD_DISPUTE', 'FAILED'].includes(String(row.payoutStatus || '').trim().toUpperCase())) acc.heldOrders += 1;
      if (row.missingPayPalRoles.length) acc.missingPayPalOrders += 1;
      if (row.matchedInternalBatchIds.length || row.matchedProviderBatchIds.length) acc.batchedOrders += 1;
      return acc;
    }, {
      orders: 0,
      grossSales: 0,
      totalPayouts: 0,
      sellerPayouts: 0,
      affiliatePayouts: 0,
      influencerPayouts: 0,
      beezioFee: 0,
      paypalFees: 0,
      beezioNet: 0,
      salesTax: 0,
      shipping: 0,
      paidOrders: 0,
      readyOrders: 0,
      heldOrders: 0,
      missingPayPalOrders: 0,
      batchedOrders: 0,
    });
  }, [financeCloseoutRows]);

  const financeCloseoutExport = useMemo(() => {
    const headers = [
      'Created At',
      'Order Number',
      'Order ID',
      'Buyer Name',
      'Buyer Email',
      'Products',
      'Quantity',
      'Seller Name',
      'Seller PayPal',
      'Seller Amount',
      'Affiliate Name',
      'Affiliate PayPal',
      'Affiliate Amount',
      'Influencer Names',
      'Influencer PayPals',
      'Influencer Amount',
      'Gross Sales',
      'Total Payout Obligation',
      'Beezio Fee',
      'PayPal Fee',
      'Beezio Net',
      'Sales Tax',
      'Shipping',
      'Internal Batch IDs',
      'PayPal Batch IDs',
      'Order Status',
      'Payment Status',
      'Fulfillment Status',
      'Payout Status',
      'Scheduled Payday',
      'Hold Release',
      'Paid At',
      'Missing PayPal Roles',
    ];
    const rows = financeCloseoutRows.map((row) => [
      row.createdAt || '',
      row.orderNumber || '',
      row.orderId,
      row.buyerName,
      row.buyerEmail,
      row.productsLabel,
      row.quantity,
      row.sellerName,
      row.sellerPaypal || '',
      row.sellerAmount.toFixed(2),
      row.affiliateName || '',
      row.affiliatePaypal || '',
      row.affiliateAmount.toFixed(2),
      row.influencerNames || '',
      row.influencerPaypals || '',
      row.influencerAmount.toFixed(2),
      row.grossSales.toFixed(2),
      row.totalPayoutAmount.toFixed(2),
      row.beezioFee.toFixed(2),
      row.paypalFee.toFixed(2),
      row.beezioNet.toFixed(2),
      row.salesTax.toFixed(2),
      row.shipping.toFixed(2),
      row.matchedInternalBatchIds.join(' | '),
      row.matchedProviderBatchIds.join(' | '),
      row.orderStatus,
      row.paymentStatus,
      row.fulfillmentStatus,
      row.payoutStatus,
      row.scheduledPayDate,
      row.holdReleaseAt || '',
      row.payoutPaidAt || '',
      row.missingPayPalRoles.join(' | '),
    ]);
    const csv = [headers.map(csvEscape).join(','), ...rows.map((row) => row.map(csvEscape).join(','))].join('\n');
    return { headers, rows, csv };
  }, [financeCloseoutRows]);

  const printFinanceCloseoutReport = () => {
    if (!financeCloseoutRows.length) return;
    const reportWindow = window.open('', '_blank', 'noopener,noreferrer,width=1400,height=900');
    if (!reportWindow) {
      setError('Popup blocked. Allow popups for Beezio admin reports and try again.');
      return;
    }

    const summaryCards = [
      ['Orders', String(financeCloseoutSummary.orders)],
      ['Gross Sales', formatCurrency(financeCloseoutSummary.grossSales)],
      ['Payout Obligations', formatCurrency(financeCloseoutSummary.totalPayouts)],
      ['Beezio Net', formatCurrency(financeCloseoutSummary.beezioNet)],
      ['Missing PayPal', String(financeCloseoutSummary.missingPayPalOrders)],
      ['Matched To Batch', String(financeCloseoutSummary.batchedOrders)],
    ]
      .map(
        ([label, value]) => `
          <div class="card">
            <div class="label">${escapeHtml(label)}</div>
            <div class="value">${escapeHtml(value)}</div>
          </div>`
      )
      .join('');

    const rowsHtml = financeCloseoutRows
      .map(
        (row) => `
          <tr>
            <td>${escapeHtml(row.orderNumber || row.orderId)}<br/><span class="muted">${escapeHtml(row.orderId)}</span></td>
            <td>${escapeHtml(row.buyerName)}<br/><span class="muted">${escapeHtml(row.buyerEmail || '-')}</span></td>
            <td>${escapeHtml(row.productsLabel || '-')}</td>
            <td class="number">${escapeHtml(formatCurrency(row.grossSales))}</td>
            <td>
              Seller ${escapeHtml(formatCurrency(row.sellerAmount))}<br/>
              Affiliate ${escapeHtml(formatCurrency(row.affiliateAmount))}<br/>
              Influencer ${escapeHtml(formatCurrency(row.influencerAmount))}<br/>
              <strong>Total ${escapeHtml(formatCurrency(row.totalPayoutAmount))}</strong>
            </td>
            <td class="number">${escapeHtml(formatCurrency(row.beezioNet))}</td>
            <td>${escapeHtml(row.scheduledPayDate)}<br/><span class="muted">${escapeHtml(row.payoutStatus)}</span></td>
            <td>${escapeHtml(row.matchedProviderBatchIds.join(' | ') || row.matchedInternalBatchIds.join(' | ') || 'Not batched')}</td>
            <td>${escapeHtml(row.missingPayPalRoles.join(', ') || 'None')}</td>
          </tr>`
      )
      .join('');

    reportWindow.document.open();
    reportWindow.document.write(`<!doctype html>
      <html>
        <head>
          <title>Beezio Finance Closeout ${escapeHtml(closeoutStartDate || 'start')} to ${escapeHtml(closeoutEndDate || 'today')}</title>
          <style>
            body { font-family: Georgia, 'Times New Roman', serif; margin: 22px; color: #111827; }
            h1, h2 { margin: 0 0 8px; }
            p { margin: 0 0 14px; color: #475569; }
            .summary { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin: 18px 0 24px; }
            .card { border: 1px solid #dbeafe; background: #eff6ff; border-radius: 12px; padding: 12px; }
            .label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #475569; }
            .value { margin-top: 6px; font-size: 18px; font-weight: 700; color: #111827; }
            table { width: 100%; border-collapse: collapse; font-size: 11px; }
            th, td { border: 1px solid #cbd5e1; padding: 8px; vertical-align: top; text-align: left; }
            th { background: #f8fafc; }
            .number { text-align: right; white-space: nowrap; }
            .muted { color: #64748b; font-size: 10px; }
          </style>
        </head>
        <body>
          <h1>Beezio Finance Book Closeout</h1>
          <p>Generated ${escapeHtml(new Date().toLocaleString())} for ${escapeHtml(closeoutStartDate || 'start')} through ${escapeHtml(closeoutEndDate || 'today')}${closeoutOrderSearch.trim() ? ` with order lookup ${escapeHtml(closeoutOrderSearch.trim())}` : ''}.</p>
          <div class="summary">${summaryCards}</div>
          <h2>Closeout Ledger</h2>
          <table>
            <thead>
              <tr>
                <th>Order</th>
                <th>Buyer</th>
                <th>Products</th>
                <th>Gross</th>
                <th>Payouts</th>
                <th>Beezio Net</th>
                <th>Payday</th>
                <th>Matched Batch</th>
                <th>Missing PayPal</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
          <script>window.onload = () => window.print();</script>
        </body>
      </html>`);
    reportWindow.document.close();
    reportWindow.focus();
  };

  const openFinanceCloseoutReport = () => {
    if (!financeCloseoutExport.rows.length) return;
    openTabularPreview({
      title: 'Beezio Finance Closeout',
      subtitle: `Closeout window ${closeoutStartDate || 'start'} through ${closeoutEndDate || 'today'}${closeoutOrderSearch.trim() ? ` with lookup ${closeoutOrderSearch.trim()}` : ''}.`,
      headers: financeCloseoutExport.headers,
      rows: financeCloseoutExport.rows,
      csvContent: financeCloseoutExport.csv,
      csvFilename: `beezio-finance-closeout-${closeoutStartDate || 'start'}-${closeoutEndDate || 'today'}.csv`,
    });
  };

  const downloadFinanceCloseoutCsv = () => {
    if (!financeCloseoutExport.rows.length) return;
    downloadTextFile(
      financeCloseoutExport.csv,
      `beezio-finance-closeout-${closeoutStartDate || 'start'}-${closeoutEndDate || 'today'}.csv`
    );
    setLastActionResult({
      ok: true,
      report: 'finance-closeout-csv',
      row_count: financeCloseoutExport.rows.length,
      closeout_start_date: closeoutStartDate,
      closeout_end_date: closeoutEndDate,
    });
  };

  const saveFinanceCloseoutSnapshot = async () => {
    if (!financeCloseoutExport.rows.length) return;
    setActionLoading('save-closeout');
    setError(null);
    setLastActionResult(null);
    try {
      const token = await getSessionToken();
      const res = await fetch('/api/admin-finance-closeouts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: 'save',
          report: {
            closeout_start_date: closeoutStartDate,
            closeout_end_date: closeoutEndDate,
            order_search: closeoutOrderSearch.trim(),
            tax_year: taxYear ? Number(taxYear) : null,
            generated_at: new Date().toISOString(),
            summary: financeCloseoutSummary,
            headers: financeCloseoutExport.headers,
            rows: financeCloseoutExport.rows,
            csv_content: financeCloseoutExport.csv,
          },
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(normalizeError(payload, 'Failed to save finance closeout snapshot'));
      setLastActionResult(payload);
      await loadSavedCloseoutReports();
    } catch (err: any) {
      setError(err?.message || 'Failed to save finance closeout snapshot.');
    } finally {
      setActionLoading(null);
    }
  };

  const openSavedFinanceCloseoutReport = async (reportId: string) => {
    const normalizedReportId = String(reportId || '').trim();
    if (!normalizedReportId) return;
    setActionLoading(`open-saved-closeout:${normalizedReportId}`);
    setError(null);
    try {
      const token = await getSessionToken();
      const res = await fetch('/api/admin-finance-closeouts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: 'get', report_id: normalizedReportId, format: 'json' }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(normalizeError(payload, 'Failed to open saved finance closeout report'));
      const report = payload?.report || {};
      const headers = Array.isArray(report.headers) ? report.headers.map((entry: any) => String(entry || '')) : [];
      const rows = Array.isArray(report.rows)
        ? report.rows.map((row: any) => (Array.isArray(row) ? row.map((cell) => (cell == null ? '' : cell)) : []))
        : [];
      openTabularPreview({
        title: String(report.report_title || 'Saved Finance Closeout'),
        subtitle: `Saved ${formatDateTime(report.created_at)} for ${String(report.closeout_start_date || '').trim()} through ${String(report.closeout_end_date || '').trim()}${String(report.order_search || '').trim() ? ` with lookup ${String(report.order_search || '').trim()}` : ''}.`,
        headers,
        rows,
        csvContent: String(report.csv_content || ''),
        csvFilename: `${String(report.report_title || 'saved-finance-closeout').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'saved-finance-closeout'}.csv`,
      });
      setLastActionResult({ ok: true, report_id: normalizedReportId, opened: true });
    } catch (err: any) {
      setError(err?.message || 'Failed to open saved finance closeout report.');
    } finally {
      setActionLoading(null);
    }
  };

  const downloadSavedFinanceCloseoutCsv = async (reportId: string) => {
    const normalizedReportId = String(reportId || '').trim();
    if (!normalizedReportId) return;
    setActionLoading(`download-saved-closeout:${normalizedReportId}`);
    setError(null);
    try {
      const token = await getSessionToken();
      const res = await fetch('/api/admin-finance-closeouts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: 'get', report_id: normalizedReportId, format: 'csv' }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(normalizeError(payload, 'Failed to download saved finance closeout CSV'));
      }
      const csv = await res.text();
      if (!csv.trim()) throw new Error('Saved finance closeout CSV was empty.');
      const disposition = String(res.headers.get('content-disposition') || '');
      const filenameMatch = disposition.match(/filename="?([^";]+)"?/i);
      const filename = filenameMatch?.[1] || `saved-finance-closeout-${normalizedReportId}.csv`;
      downloadTextFile(csv, filename);
      setLastActionResult({ ok: true, report_id: normalizedReportId, downloaded: true, filename });
    } catch (err: any) {
      setError(err?.message || 'Failed to download saved finance closeout CSV.');
    } finally {
      setActionLoading(null);
    }
  };

  const exportCSV = () => {
    const header = ['Name', 'Beezio Email', 'PayPal Email', 'Seller Earnings Due', 'Affiliate Earnings Due', 'Influencer Earnings Due', 'Total Payout Due', 'On Hold', 'Next Payout Amount', 'Next Payout Date', 'Lifetime Earnings'];
    const rows = payoutAccountSummaries.map((group) => [
      group.displayName,
      group.contactEmail || '',
      group.paypalEmail || '',
      group.dueRoleTotals.seller.toFixed(2),
      group.dueRoleTotals.affiliate.toFixed(2),
      group.dueRoleTotals.influencer.toFixed(2),
      group.dueTotal.toFixed(2),
      group.holdTotal.toFixed(2),
      group.nextPayoutAmount.toFixed(2),
      group.nextPayoutDate ? new Date(group.nextPayoutDate).toLocaleDateString() : '',
      group.lifetimeTotal.toFixed(2),
    ]);
    const csv = [header.map(csvEscape).join(','), ...rows.map((row) => row.map(csvEscape).join(','))].join('\n');
    openTabularPreview({
      title: 'Beezio Payout Summary',
      subtitle: `Payday ${payoutDate}. Read in browser or download the CSV if needed.`,
      headers: header,
      rows,
      csvContent: csv,
      csvFilename: `beezio-payouts-${payoutDate}.csv`,
    });
  };

  const exportMonthlyFinanceCsv = () => {
    if (!monthlyFinanceRows.length) return;
    const headers = [
      'Month',
      'Orders',
      'Gross Sales',
      'Seller Payouts',
      'Affiliate Payouts',
      'Influencer Payouts',
      'Beezio Profit',
      'PayPal Fees',
      'Sales Tax',
      'Shipping',
    ];
    const rows = monthlyFinanceRows.map((row) => [
      row.month,
      row.orders,
      row.grossSales.toFixed(2),
      row.sellerPayouts.toFixed(2),
      row.affiliatePayouts.toFixed(2),
      row.influencerPayouts.toFixed(2),
      row.beezioProfit.toFixed(2),
      row.paypalFees.toFixed(2),
      row.salesTax.toFixed(2),
      row.shipping.toFixed(2),
    ]);
    const csv = [headers.map(csvEscape).join(','), ...rows.map((row) => row.map(csvEscape).join(','))].join('\n');
    openTabularPreview({
      title: 'Beezio Monthly Finance',
      subtitle: 'Monthly totals from the unified sales ledger.',
      headers,
      rows,
      csvContent: csv,
      csvFilename: `beezio-monthly-finance-${payoutDate}.csv`,
    });
  };

  const buildDelimitedTextFile = (rows: string[][], delimiter: string) => rows.map((row) => row.join(delimiter)).join('\r\n');

  const buildPlainTextTable = (headers: string[], rows: string[][]) => {
    const allRows = [headers, ...rows];
    const columnWidths = headers.map((_, columnIndex) =>
      allRows.reduce((width, row) => Math.max(width, String(row[columnIndex] ?? '').length), 0),
    );
    const formatRow = (row: string[]) =>
      row
        .map((value, columnIndex) => String(value ?? '').padEnd(columnWidths[columnIndex], ' '))
        .join(' | ')
        .trimEnd();
    const divider = columnWidths.map((width) => '-'.repeat(width)).join('-+-');
    return [formatRow(headers), divider, ...rows.map(formatRow)].join('\r\n');
  };

  const downloadTextFile = (content: string, filename: string, type = 'text/csv;charset=utf-8;') => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.rel = 'noopener';
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const openDownloadDeliveryWindow = (
    content: string,
    filename: string,
    type = 'text/csv;charset=utf-8;',
    targetWindow?: Window | null,
  ) => {
    if (!targetWindow) {
      downloadTextFile(content, filename, type);
      return;
    }

    targetWindow.document.open();
    targetWindow.document.write(`<!doctype html>
      <html>
        <head>
          <title>Beezio Download Ready</title>
          <style>
            body { font-family: Georgia, 'Times New Roman', serif; margin: 24px; color: #111827; background: #f8fafc; }
            .card { max-width: 720px; margin: 48px auto; padding: 24px; border: 1px solid #dbeafe; border-radius: 16px; background: #ffffff; }
            h1 { margin: 0 0 8px; }
            p { color: #475569; line-height: 1.5; }
            .download-link, button { display: inline-block; border: 0; border-radius: 10px; background: #065f46; color: white; font-weight: 700; padding: 12px 18px; cursor: pointer; text-decoration: none; }
            .download-link { margin-right: 12px; }
            code { background: #f1f5f9; padding: 2px 6px; border-radius: 6px; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>Download Ready</h1>
            <p>Your file is ready. Use the direct download link below. This window will stay open until you finish.</p>
            <p><strong>File:</strong> <code>${escapeHtml(filename)}</code></p>
            <p>
              <a id="download-link" class="download-link" href="#" download="${escapeHtml(filename)}">Direct Download Link</a>
              <button id="download-file">Download File</button>
            </p>
          </div>
          <script>
            const fileContent = ${JSON.stringify(content)};
            const fileName = ${JSON.stringify(filename)};
            const fileType = ${JSON.stringify(type)};
            let activeUrl = null;
            const ensureUrl = () => {
              if (activeUrl) return activeUrl;
              const blob = new Blob([fileContent], { type: fileType });
              activeUrl = URL.createObjectURL(blob);
              const link = document.getElementById('download-link');
              if (link) {
                link.href = activeUrl;
                link.setAttribute('download', fileName);
              }
              return activeUrl;
            };
            const startDownload = () => {
              const url = ensureUrl();
              const anchor = document.createElement('a');
              anchor.href = url;
              anchor.download = fileName;
              anchor.rel = 'noopener';
              document.body.appendChild(anchor);
              anchor.click();
              anchor.remove();
            };
            ensureUrl();
            document.getElementById('download-file')?.addEventListener('click', startDownload);
          </script>
        </body>
      </html>`);
    targetWindow.document.close();
    targetWindow.focus();
  };

  const openTabularPreview = (args: {
    title: string;
    subtitle: string;
    headers: string[];
    rows: Array<Array<string | number | null | undefined>>;
    csvContent?: string;
    csvFilename?: string;
    previewWindow?: Window | null;
  }) => {
    const preview = {
      title: args.title,
      subtitle: args.subtitle,
      headers: args.headers,
      rows: args.rows,
      csvContent: args.csvContent,
      csvFilename: args.csvFilename,
    };
    setReportPreview(preview);
    setError(null);
    if (args.previewWindow) {
      args.previewWindow.document.open();
      args.previewWindow.document.write(buildReportPreviewHtml(preview));
      args.previewWindow.document.close();
      args.previewWindow.focus();
    }
    window.requestAnimationFrame(() => {
      document.getElementById('admin-report-preview')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const buildReportPreviewHtml = (preview: ReportPreviewState) => {
    const csvButton = preview.csvContent && preview.csvFilename
      ? '<button id="downloadCsv" class="button secondary">Download CSV</button>'
      : '';
    const headerHtml = preview.headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('');
    const bodyHtml = preview.rows.length
      ? preview.rows
          .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`)
          .join('')
      : `<tr><td colspan="${preview.headers.length}" class="empty">No rows matched this report.</td></tr>`;

    return `<!doctype html>
      <html>
        <head>
          <title>${escapeHtml(preview.title)}</title>
          <style>
            body { font-family: Georgia, 'Times New Roman', serif; margin: 24px; color: #111827; background: #f8fafc; }
            .toolbar { display: flex; gap: 12px; align-items: center; justify-content: space-between; margin-bottom: 18px; }
            .button { border: 0; border-radius: 10px; padding: 10px 14px; font-weight: 700; cursor: pointer; }
            .button.primary { background: #111827; color: #fff; }
            .button.secondary { background: #fff; color: #111827; border: 1px solid #d1d5db; }
            .meta { color: #475569; font-size: 14px; }
            table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid #e5e7eb; }
            th, td { padding: 10px 12px; border-bottom: 1px solid #e5e7eb; vertical-align: top; text-align: left; font-size: 13px; }
            th { position: sticky; top: 0; background: #f8fafc; font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; color: #475569; }
            .table-wrap { max-height: calc(100vh - 180px); overflow: auto; border-radius: 14px; }
            .empty { text-align: center; color: #64748b; padding: 24px; }
          </style>
        </head>
        <body>
          <div class="toolbar">
            <div>
              <h1>${escapeHtml(preview.title)}</h1>
              <div class="meta">${escapeHtml(preview.subtitle)}</div>
            </div>
            <div style="display:flex; gap:12px;">${csvButton}<button onclick="window.print()" class="button primary">Print</button></div>
          </div>
          <div class="table-wrap">
            <table>
              <thead><tr>${headerHtml}</tr></thead>
              <tbody>${bodyHtml}</tbody>
            </table>
          </div>
          ${preview.csvContent && preview.csvFilename ? `<script>
            const csvContent = ${JSON.stringify(preview.csvContent)};
            const csvFilename = ${JSON.stringify(preview.csvFilename)};
            const button = document.getElementById('downloadCsv');
            if (button) {
              button.addEventListener('click', () => {
                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const anchor = document.createElement('a');
                anchor.href = url;
                anchor.download = csvFilename;
                document.body.appendChild(anchor);
                anchor.click();
                anchor.remove();
                URL.revokeObjectURL(url);
              });
            }
          </script>` : ''}
        </body>
      </html>`;
  };

  const openReportPreviewInWindow = () => {
    if (!reportPreview) return;
    const previewWindow = window.open('', '_blank', 'noopener,noreferrer,width=1400,height=900');
    if (!previewWindow) {
      setError('Popup blocked. Allow popups for Beezio admin previews and try again.');
      return;
    }
    previewWindow.document.open();
    previewWindow.document.write(buildReportPreviewHtml(reportPreview));
    previewWindow.document.close();
    previewWindow.focus();
  };

  const printReportPreview = () => {
    if (!reportPreview) return;
    const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=1400,height=900');
    if (!printWindow) {
      setError('Popup blocked. Allow popups for Beezio admin previews and try again.');
      return;
    }
    printWindow.document.write(buildReportPreviewHtml(reportPreview));
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const openPayoutOrderDetail = async (orderId: string | null | undefined) => {
    const normalizedOrderId = String(orderId || '').trim();
    if (!normalizedOrderId) {
      setSelectedPayoutDetailError('This payout row does not have an order reference to open.');
      return;
    }

    if (selectedPayoutOrderId === normalizedOrderId) {
      setSelectedPayoutOrderId(null);
      setSelectedPayoutDetail(null);
      setSelectedPayoutDetailError(null);
      setSelectedPayoutDetailLoading(false);
      return;
    }

    setSelectedPayoutOrderId(normalizedOrderId);
    setSelectedPayoutDetail(null);
    setSelectedPayoutDetailError(null);
    setSelectedPayoutDetailLoading(true);

    try {
      const token = await getSessionToken();
      const response = await fetch(`/api/order-details?id=${encodeURIComponent(normalizedOrderId)}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const payload = (await response.json().catch(() => ({}))) as OrderDetail & { error?: string };
      if (!response.ok) throw new Error(String(payload?.error || 'Failed to load payout order details'));
      setSelectedPayoutDetail(payload);
    } catch (detailError: any) {
      setSelectedPayoutDetailError(detailError?.message || 'Failed to load payout order details.');
    } finally {
      setSelectedPayoutDetailLoading(false);
    }
  };

  const exportFullSalesCsv = () => {
    if (!salesLedger?.rows?.length) return;
    const headers = [
      'Order ID',
      'Order Number',
      'Created At',
      'Buyer Name',
      'Buyer Email',
      'Products',
      'Quantity',
      'Seller Name',
      'Seller Contact Email',
      'Seller PayPal',
      'Seller Amount',
      'Affiliate Name',
      'Affiliate Contact Email',
      'Affiliate PayPal',
      'Affiliate Amount',
      'Influencer Names',
      'Influencer Contact Emails',
      'Influencer PayPals',
      'Influencer Amount',
      'Gross Sales',
      'Beezio Profit',
      'PayPal Fee',
      'Sales Tax',
      'Shipping',
      'Order Status',
      'Payment Status',
      'Fulfillment Status',
      'Payout Status',
      'Hold Release At',
      'Payout Paid At',
    ];
    const rows = salesLedger.rows.map((row) => {
      const influencers = (row.influencers && row.influencers.length ? row.influencers : [row.influencer]).filter(
        (entry) => Number(entry?.amount || 0) > 0
      );

      return [
        row.order_id,
        row.order_number || '',
        row.created_at || '',
        row.buyer_name || '',
        row.buyer_email || '',
        row.products.join(' | '),
        row.quantity,
        row.seller.name || '',
        row.seller.email || '',
        row.seller.paypal_email || '',
        Number(row.seller.amount || 0).toFixed(2),
        row.affiliate.name || '',
        row.affiliate.email || '',
        row.affiliate.paypal_email || '',
        Number(row.affiliate.amount || 0).toFixed(2),
        influencers.map((entry) => entry.name || '').filter(Boolean).join(' | '),
        influencers.map((entry) => entry.email || '').filter(Boolean).join(' | '),
        influencers.map((entry) => entry.paypal_email || '').filter(Boolean).join(' | '),
        influencers.reduce((sum, entry) => sum + Number(entry.amount || 0), 0).toFixed(2),
        Number(row.gross_sales || 0).toFixed(2),
        Number(row.beezio_fee || 0).toFixed(2),
        Number(row.paypal_fee || 0).toFixed(2),
        Number(row.sales_tax || 0).toFixed(2),
        Number(row.shipping || 0).toFixed(2),
        row.order_status || '',
        row.payment_status || '',
        row.fulfillment_status || '',
        row.payout_status || '',
        row.hold_release_at || '',
        row.payout_paid_at || '',
      ];
    });
    const csv = [headers.map(csvEscape).join(','), ...rows.map((row) => row.map(csvEscape).join(','))].join('\n');

    openTabularPreview({
      title: 'Beezio Full Sales Ledger',
      subtitle: `Full per-sale ledger for payday ${payoutDate}.`,
      headers,
      rows,
      csvContent: csv,
      csvFilename: `full-sales-ledger-${payoutDate}.csv`,
    });
  };

  const openTaxYearContractorSummary = async () => {
    setActionLoading('tax-year-summary');
    setError(null);
    try {
      const normalizedYear = Math.max(2024, Number(taxYear) || getCurrentTaxYear());
      const token = await getSessionToken();
      const res = await fetch('/api/admin/sales-ledger', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          start_date: `${normalizedYear}-01-01`,
          end_date: `${normalizedYear}-12-31`,
          limit: 20000,
        }),
      });
      const payload = (await res.json().catch(() => ({}))) as AdminSalesLedgerResponse & { error?: string; details?: string };
      if (!res.ok) throw new Error(withAdminErrorHint(normalizeError(payload, 'Failed to load tax-year ledger')));

      const yearRows = Array.isArray(payload?.rows) ? payload.rows : [];
      const aggregates = new Map<string, ContractorTaxSummaryRow>();
      const upsertTaxRow = (
        role: 'seller' | 'affiliate' | 'influencer',
        order: SalesLedgerRow,
        payee: { id: string | null; name: string; email?: string; paypal_email?: string; amount: number }
      ) => {
        const userId = String(payee.id || '').trim();
        const amount = Number(payee.amount || 0);
        if (!userId || amount <= 0) return;
        const current = aggregates.get(userId) || {
          userId,
          displayName: String(payee.name || payee.paypal_email || payee.email || userId).trim(),
          contactEmail: String(payee.email || '').trim(),
          payoutEmail: String(payee.paypal_email || '').trim(),
          legalName: '',
          deliveryEmail: '',
          taxFormStatus: 'missing',
          taxFormType: 'none',
          adminReviewStatus: 'not_reviewed',
          independentContractorAck: 'no',
          taxIdLast4: '',
          last1099TaxYear: '',
          sellerAmount: 0,
          affiliateAmount: 0,
          influencerAmount: 0,
          totalAmount: 0,
          orderCount: 0,
          paidOrderCount: 0,
          missingPayPal: false,
          existing1099Status: '',
          existing1099Amount: 0,
          existing1099IssuedAt: '',
          eligibleFor1099: false,
        };
        current.totalAmount += amount;
        if (role === 'seller') current.sellerAmount += amount;
        if (role === 'affiliate') current.affiliateAmount += amount;
        if (role === 'influencer') current.influencerAmount += amount;
        current.orderCount += 1;
        if (String(order.payout_status || '').trim().toUpperCase() === 'PAID') current.paidOrderCount += 1;
        if (!current.contactEmail) current.contactEmail = String(payee.email || '').trim();
        if (!current.payoutEmail) current.payoutEmail = String(payee.paypal_email || '').trim();
        current.missingPayPal = current.missingPayPal || !String(payee.paypal_email || '').trim();
        aggregates.set(userId, current);
      };

      yearRows.forEach((row) => {
        upsertTaxRow('seller', row, row.seller);
        upsertTaxRow('affiliate', row, row.affiliate);
        (row.influencers && row.influencers.length ? row.influencers : [row.influencer])
          .filter((entry) => Number(entry?.amount || 0) > 0)
          .forEach((entry) => upsertTaxRow('influencer', row, entry));
      });

      const userIds = Array.from(aggregates.keys());
      if (userIds.length) {
        const [{ data: taxProfiles, error: taxProfilesError }, { data: taxReports, error: taxReportsError }] = await Promise.all([
          supabase
            .from('tax_profiles')
            .select('user_id, legal_name, delivery_email, form_status, form_type, admin_review_status, independent_contractor_ack_at, tax_id_last4, last_1099_tax_year')
            .in('user_id', userIds),
          supabase
            .from('tax_1099_reports')
            .select('user_id, status, tax_year, gross_payout_cents, issued_at')
            .eq('tax_year', normalizedYear)
            .in('user_id', userIds),
        ]);
        if (taxProfilesError) throw taxProfilesError;
        if (taxReportsError) throw taxReportsError;

        const taxProfileMap = new Map<string, any>();
        ((taxProfiles as any[]) || []).forEach((row) => {
          const userId = String(row?.user_id || '').trim();
          if (userId) taxProfileMap.set(userId, row);
        });
        const taxReportMap = new Map<string, any>();
        ((taxReports as any[]) || []).forEach((row) => {
          const userId = String(row?.user_id || '').trim();
          if (userId) taxReportMap.set(userId, row);
        });

        userIds.forEach((userId) => {
          const current = aggregates.get(userId);
          if (!current) return;
          const profile = taxProfileMap.get(userId);
          const report = taxReportMap.get(userId);
          current.legalName = String(profile?.legal_name || '').trim();
          current.deliveryEmail = String(profile?.delivery_email || '').trim();
          current.taxFormStatus = String(profile?.form_status || 'missing').trim();
          current.taxFormType = String(profile?.form_type || 'none').trim();
          current.adminReviewStatus = String(profile?.admin_review_status || 'not_reviewed').trim();
          current.independentContractorAck = profile?.independent_contractor_ack_at ? 'yes' : 'no';
          current.taxIdLast4 = String(profile?.tax_id_last4 || '').trim();
          current.last1099TaxYear = String(profile?.last_1099_tax_year || '').trim();
          current.existing1099Status = String(report?.status || '').trim();
          current.existing1099Amount = Number(report?.gross_payout_cents || 0) / 100;
          current.existing1099IssuedAt = String(report?.issued_at || '').trim();
          current.eligibleFor1099 = current.totalAmount >= 600;
        });
      }

      const taxRows = Array.from(aggregates.values())
        .map((row) => ({
          ...row,
          sellerAmount: Number(row.sellerAmount.toFixed(2)),
          affiliateAmount: Number(row.affiliateAmount.toFixed(2)),
          influencerAmount: Number(row.influencerAmount.toFixed(2)),
          totalAmount: Number(row.totalAmount.toFixed(2)),
          existing1099Amount: Number(row.existing1099Amount.toFixed(2)),
        }))
        .sort((a, b) => b.totalAmount - a.totalAmount);

      const headers = [
        'User ID',
        'Display Name',
        'Contact Email',
        'PayPal Email',
        'Legal Name',
        'Delivery Email',
        'Tax Form Status',
        'Tax Form Type',
        'Admin Review Status',
        'Independent Contractor Ack',
        'Tax ID Last4',
        'Last 1099 Tax Year',
        'Seller Amount',
        'Affiliate Amount',
        'Influencer Amount',
        'Total Amount',
        'Order Count',
        'Paid Order Count',
        'Missing PayPal',
        'Existing 1099 Status',
        'Existing 1099 Amount',
        'Existing 1099 Issued At',
        'Eligible For 1099',
      ];
      const previewRows = taxRows.map((row) => [
        row.userId,
        row.displayName,
        row.contactEmail,
        row.payoutEmail,
        row.legalName,
        row.deliveryEmail,
        row.taxFormStatus,
        row.taxFormType,
        row.adminReviewStatus,
        row.independentContractorAck,
        row.taxIdLast4,
        row.last1099TaxYear,
        row.sellerAmount.toFixed(2),
        row.affiliateAmount.toFixed(2),
        row.influencerAmount.toFixed(2),
        row.totalAmount.toFixed(2),
        row.orderCount,
        row.paidOrderCount,
        row.missingPayPal ? 'yes' : 'no',
        row.existing1099Status,
        row.existing1099Amount.toFixed(2),
        row.existing1099IssuedAt,
        row.eligibleFor1099 ? 'yes' : 'no',
      ]);
      const csv = [headers.map(csvEscape).join(','), ...previewRows.map((row) => row.map(csvEscape).join(','))].join('\n');
      openTabularPreview({
        title: `Beezio ${normalizedYear} Contractor 1099 Summary`,
        subtitle: `Tax-year contractor totals from the unified ledger for ${normalizedYear}.`,
        headers,
        rows: previewRows,
        csvContent: csv,
        csvFilename: `beezio-contractor-1099-summary-${normalizedYear}.csv`,
      });
      setLastActionResult({ ok: true, tax_year: normalizedYear, contractor_count: taxRows.length, eligible_1099_count: taxRows.filter((row) => row.eligibleFor1099).length });
    } catch (err: any) {
      setError(err?.message || 'Failed to prepare contractor 1099 summary.');
    } finally {
      setActionLoading(null);
    }
  };

  const printFullReport = () => {
    if (!salesLedger) return;
    const reportWindow = window.open('', '_blank', 'noopener,noreferrer,width=1280,height=900');
    if (!reportWindow) {
      setError('Popup blocked. Allow popups for Beezio admin reports and try again.');
      return;
    }

    const financeRowsHtml = ([
      ['Last Hour', financeBuckets.hourly],
      ['Today', financeBuckets.daily],
      ['Last 7 Days', financeBuckets.weekly],
      ['This Month', financeBuckets.monthly],
      ['This Year', financeBuckets.yearly],
    ] as const)
      .map(
        ([label, bucket]) => `
          <tr>
            <td>${label}</td>
            <td>${bucket.orders}</td>
            <td>$${bucket.grossSales.toFixed(2)}</td>
            <td>$${bucket.sellerPayouts.toFixed(2)}</td>
            <td>$${bucket.affiliatePayouts.toFixed(2)}</td>
            <td>$${bucket.influencerPayouts.toFixed(2)}</td>
            <td>$${bucket.beezioProfit.toFixed(2)}</td>
            <td>$${bucket.paypalFees.toFixed(2)}</td>
            <td>$${bucket.salesTax.toFixed(2)}</td>
          </tr>`
      )
      .join('');

    const payeeRowsHtml = payoutReviewGroups
      .map(
        (group) => `
          <tr>
            <td>${group.payeeName}</td>
            <td>${group.role}</td>
            <td>${group.paypalEmail || '-'}</td>
            <td>${group.contactEmail || '-'}</td>
            <td>${group.orders}</td>
            <td>${group.lineCount}</td>
            <td>$${group.total.toFixed(2)}</td>
            <td>${group.scheduledPayDate}</td>
          </tr>`
      )
      .join('');

    const salesRowsHtml = salesLedger.rows
      .map((row) => {
        const influencers = (row.influencers && row.influencers.length ? row.influencers : [row.influencer])
          .filter((entry) => Number(entry?.amount || 0) > 0)
          .map((entry) => `${entry.name || '-'} ($${Number(entry.amount || 0).toFixed(2)})`)
          .join('<br/>');
        return `
          <tr>
            <td>${row.order_number || row.order_id}</td>
            <td>${new Date(String(row.created_at || '')).toLocaleString() || '-'}</td>
            <td>${row.buyer_name}<br/><span class="muted">${row.buyer_email || '-'}</span></td>
            <td>${row.products.join(', ') || '-'}</td>
            <td>${row.seller.name}<br/><span class="muted">${row.seller.paypal_email || row.seller.email || '-'}</span></td>
            <td>${Number(row.seller.amount || 0).toFixed(2)}</td>
            <td>${row.affiliate.amount > 0 ? `${row.affiliate.name}<br/><span class="muted">${row.affiliate.paypal_email || row.affiliate.email || '-'}</span>` : '-'}</td>
            <td>${Number(row.affiliate.amount || 0).toFixed(2)}</td>
            <td>${influencers || '-'}</td>
            <td>${Number(row.influencer.amount || 0).toFixed(2)}</td>
            <td>${Number(row.gross_sales || 0).toFixed(2)}</td>
            <td>${Number(row.beezio_fee || 0).toFixed(2)}</td>
            <td>${Number(row.paypal_fee || 0).toFixed(2)}</td>
            <td>${Number(row.sales_tax || 0).toFixed(2)}</td>
            <td>${row.order_status} / ${row.payment_status} / ${row.payout_status}</td>
          </tr>`;
      })
      .join('');

    reportWindow.document.write(`<!doctype html>
      <html>
        <head>
          <title>Beezio Admin Finance Report ${payoutDate}</title>
          <style>
            body { font-family: Georgia, 'Times New Roman', serif; margin: 24px; color: #111827; }
            h1, h2 { margin: 0 0 8px; }
            p { margin: 0 0 16px; color: #4b5563; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 12px; }
            th, td { border: 1px solid #d1d5db; padding: 8px; vertical-align: top; }
            th { background: #f3f4f6; text-align: left; }
            .muted { color: #6b7280; font-size: 11px; }
            .section { margin-bottom: 28px; }
          </style>
        </head>
        <body>
          <div class="section">
            <h1>Beezio Admin Finance Report</h1>
            <p>Generated ${new Date().toLocaleString()} for payout date ${payoutDate}. This report includes finance buckets, pay-run review, and a full per-sale ledger snapshot.</p>
          </div>
          <div class="section">
            <h2>Finance Summary</h2>
            <table>
              <thead>
                <tr><th>Window</th><th>Orders</th><th>Gross</th><th>Seller</th><th>Affiliate</th><th>Influencer</th><th>Beezio</th><th>PayPal</th><th>Tax</th></tr>
              </thead>
              <tbody>${financeRowsHtml}</tbody>
            </table>
          </div>
          <div class="section">
            <h2>Pay Run Review</h2>
            <table>
              <thead>
                <tr><th>Payee</th><th>Role</th><th>PayPal</th><th>Contact</th><th>Orders</th><th>Lines</th><th>Total</th><th>Scheduled Date</th></tr>
              </thead>
              <tbody>${payeeRowsHtml || '<tr><td colspan="8">No payout lines due for this selected payday.</td></tr>'}</tbody>
            </table>
          </div>
          <div class="section">
            <h2>Full Sales Ledger</h2>
            <table>
              <thead>
                <tr><th>Order</th><th>Created</th><th>Buyer</th><th>Products</th><th>Seller</th><th>Seller $</th><th>Affiliate</th><th>Affiliate $</th><th>Influencer</th><th>Influencer $</th><th>Gross</th><th>Beezio</th><th>PayPal</th><th>Tax</th><th>Status</th></tr>
              </thead>
              <tbody>${salesRowsHtml}</tbody>
            </table>
          </div>
        </body>
      </html>`);
    reportWindow.document.close();
    reportWindow.focus();
    reportWindow.print();
  };

  const downloadManualPayoutExport = async (
    format: 'paypal' | 'audit',
    mode: 'preview' | 'download' = 'preview',
    output: 'csv' | 'tsv' | 'txt' = 'csv',
  ) => {
    setActionLoading(`export:${format}`);
    setError(null);
    setLastActionResult(null);
    const previewWindow = mode === 'preview' ? window.open('', '_blank', 'width=1400,height=900') : null;
    const downloadWindow = mode === 'download' ? window.open('', '_blank', 'width=720,height=520') : null;
    if ((mode === 'preview' && !previewWindow) || (mode === 'download' && !downloadWindow)) {
      setActionLoading(null);
      setError(`Popup blocked. Allow popups for Beezio admin ${mode === 'preview' ? 'previews' : 'downloads'} and try again.`);
      return;
    }
    if (previewWindow) {
      previewWindow.document.open();
      previewWindow.document.write(`<!doctype html>
        <html>
          <head>
            <title>Preparing payout preview</title>
            <style>
              body { font-family: Georgia, 'Times New Roman', serif; margin: 24px; color: #111827; background: #f8fafc; }
              .card { max-width: 720px; margin: 48px auto; padding: 24px; border: 1px solid #dbeafe; border-radius: 16px; background: #ffffff; }
              h1 { margin: 0 0 8px; }
              p { margin: 0; color: #475569; }
            </style>
          </head>
          <body>
            <div class="card">
              <h1>Preparing preview</h1>
              <p>Loading the latest ${format === 'paypal' ? 'PayPal upload' : 'audit'} export for payday ${payoutDate}.</p>
            </div>
          </body>
        </html>`);
      previewWindow.document.close();
    }
    if (downloadWindow) {
      downloadWindow.document.open();
      downloadWindow.document.write(`<!doctype html>
        <html>
          <head>
            <title>Preparing download</title>
            <style>
              body { font-family: Georgia, 'Times New Roman', serif; margin: 24px; color: #111827; background: #f8fafc; }
              .card { max-width: 720px; margin: 48px auto; padding: 24px; border: 1px solid #dbeafe; border-radius: 16px; background: #ffffff; }
              h1 { margin: 0 0 8px; }
              p { margin: 0; color: #475569; }
            </style>
          </head>
          <body>
            <div class="card">
              <h1>Preparing download</h1>
              <p>Building the latest ${format === 'paypal' ? 'PayPal upload' : 'audit'} export for payday ${payoutDate}.</p>
            </div>
          </body>
        </html>`);
      downloadWindow.document.close();
    }
    try {
      const token = await getSessionToken();
      const res = await fetch('/api/payouts/export-manual', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          format,
          payout_date: payoutDate,
          include_pending_hold: format === 'audit',
        }),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(normalizeError(payload, 'Failed to export payout file'));
      }

      const baseFilename =
        format === 'paypal'
          ? `beezio-paypal-manual-payout-${payoutDate}`
          : `beezio-payday-audit-${payoutDate}`;
      const contentType = String(res.headers.get('content-type') || '').toLowerCase();
      if (contentType.includes('application/json')) {
        const payload = await res.json().catch(() => ({}));
        if (payload?.ok && payload?.message) {
          const message = String(payload.message);
          setLastActionResult({ ...payload, format, payout_date: payoutDate, filename: `${baseFilename}-status.txt` });
          if (mode === 'download') {
            openDownloadDeliveryWindow(`${message}\r\n`, `${baseFilename}-status.txt`, 'text/plain;charset=utf-8;', downloadWindow);
            return;
          }
          openTabularPreview({
            title: format === 'paypal' ? 'PayPal Upload Status' : 'Payout Audit Status',
            subtitle: `Export status for payday ${payoutDate}.`,
            headers: ['Message'],
            rows: [[message]],
            csvContent: `Message\n${csvEscape(message)}`,
            csvFilename: `${baseFilename}-status.csv`,
            previewWindow,
          });
          return;
        }
        throw new Error(normalizeError(payload, 'Export did not produce a CSV file'));
      }

      const csv = await res.text();
      if (!csv.trim()) throw new Error('Export returned an empty file.');

      const parsed = Papa.parse<string[]>(csv, { skipEmptyLines: true });
      const previewRows = (parsed.data || []) as string[][];
      if (!previewRows.length) throw new Error('Export returned an unreadable CSV file.');
      const [headers, ...rows] = previewRows;
      if (mode === 'download') {
        const fileContent =
          output === 'tsv'
            ? buildDelimitedTextFile(previewRows, '\t')
            : output === 'txt'
              ? buildPlainTextTable(headers, rows)
              : csv;
        const fileType =
          output === 'tsv'
            ? 'text/tab-separated-values;charset=utf-8;'
            : output === 'txt'
              ? 'text/plain;charset=utf-8;'
              : 'text/csv;charset=utf-8;';
        const fileName = `${baseFilename}.${output}`;
        openDownloadDeliveryWindow(fileContent, fileName, fileType, downloadWindow);
        setReportPreview({
          title: format === 'paypal' ? 'PayPal Upload Ready' : 'Payout Audit Ready',
          subtitle: `The file was prepared for payday ${payoutDate}. Use the download window or the in-page download button below.`,
          headers,
          rows,
          csvContent: csv,
          csvFilename: `${baseFilename}.csv`,
        });
        setLastActionResult({ ok: true, format, payout_date: payoutDate, filename: fileName, downloaded: true });
        return;
      }
      openTabularPreview({
        title: format === 'paypal' ? 'PayPal Upload Preview' : 'Payout Audit Preview',
        subtitle:
          format === 'paypal'
            ? `Review the PayPal upload rows for payday ${payoutDate}.`
            : `Review due and held payout audit rows for payday ${payoutDate}.`,
        headers,
        rows,
        csvContent: csv,
        csvFilename: `${baseFilename}.csv`,
        previewWindow,
      });
      setLastActionResult({ ok: true, format, payout_date: payoutDate, filename: `${baseFilename}.csv`, preview_row_count: rows.length });
    } catch (err: any) {
      previewWindow?.close();
      downloadWindow?.close();
      setError(err?.message || 'Failed to export manual payout file.');
    } finally {
      setActionLoading(null);
    }
  };

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      await loadStats();
      await Promise.all([loadPayPalConfig(), loadPaymentLogs(), loadSalesLedger(), loadSavedCloseoutReports()]);
    } catch (err: any) {
      setError(err?.message || 'Failed to refresh payout stats');
    } finally {
      setLoading(false);
    }
  };

  const setPayPalEnv = async (nextEnv: 'sandbox' | 'live') => {
    setPaypalEnvSaving(true);
    setPaypalConfigError(null);
    try {
      const token = await getSessionToken();
      const res = await fetch('/api/paypal-admin-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ paypal_env: nextEnv }),
      });
      const payload = (await res.json().catch(() => ({}))) as PayPalAdminConfig;
      if (!res.ok) throw new Error(withAdminErrorHint(normalizeError(payload, 'Failed to update PayPal environment')));
      setPaypalConfig(payload);
    } catch (err: any) {
      setPaypalConfigError(err?.message || 'Failed to update PayPal environment.');
    } finally {
      setPaypalEnvSaving(false);
    }
  };

  const runBatch = async (dryRun: boolean) => {
    setActionLoading(dryRun ? 'dry-run' : 'prepare');
    setError(null);
    setLastActionResult(null);
    try {
      const token = await getSessionToken();

      const res = await fetch('/api/payouts/run-batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ dry_run: dryRun, payout_date: payoutDate }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(normalizeError(payload, 'Failed to run payout batch'));
      setLastActionResult(payload);
      await refresh();
      return payload;
    } catch (err: any) {
      setError(err?.message || 'Failed to run payout batch');
      return null;
    } finally {
      setActionLoading(null);
    }
  };

  const approveBatch = async (batchId: string) => {
    setActionLoading(`approve:${batchId}`);
    setError(null);
    setLastActionResult(null);
    try {
      const token = await getSessionToken();

      const res = await fetch('/api/payouts/approve-batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ batch_id: batchId }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(withAdminErrorHint(normalizeError(payload, 'Failed to approve payout batch')));
      setLastActionResult(payload);
      setApprovalCandidate(null);
      await refresh();
    } catch (err: any) {
      setError(err?.message || 'Failed to approve payout batch');
    } finally {
      setActionLoading(null);
    }
  };

  const payAllDueNow = async () => {
    if (!batchReviewConfirmed) {
      setError('Confirm the manual review before running Pay All Due Now.');
      return;
    }
    const payload = await runBatch(false);
    if (!payload?.batch_id) return;
    setApprovalCandidate({
      batchId: String(payload.batch_id),
      totalAmount: Number(payload.total_amount || 0),
      itemCount: Number(payload.item_count || 0),
      payoutDate: String(payload.payout_date || payoutDate),
    });
  };

  const openApprovalCandidate = (batch: AdminBatchRow) => {
    setApprovalCandidate({
      batchId: batch.id,
      totalAmount: Number(batch.total_amount || 0),
      itemCount: Number(batch.item_count || 0),
      payoutDate: String(batch.payout_date || payoutDate),
    });
  };

  const syncStatus = async (batchId?: string) => {
    setActionLoading(batchId ? `sync:${batchId}` : 'sync');
    setError(null);
    setLastActionResult(null);
    try {
      const token = await getSessionToken();

      const res = await fetch('/api/payouts/sync-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(batchId ? { batch_id: batchId } : {}),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(normalizeError(payload, 'Failed to sync payout status'));
      setLastActionResult(payload);
      await refresh();
    } catch (err: any) {
      setError(err?.message || 'Failed to sync payout status');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-5">
        <h2 className="text-lg font-semibold text-gray-900">Beezio payout rules</h2>
        <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-4">
          <div className="rounded-lg border border-white/80 bg-white p-4 text-sm text-gray-700">
            Sellers keep <strong>100% of their seller ask</strong> after the order clears.
          </div>
          <div className="rounded-lg border border-white/80 bg-white p-4 text-sm text-gray-700">
            Affiliates receive the full commission amount configured on the product.
          </div>
          <div className="rounded-lg border border-white/80 bg-white p-4 text-sm text-gray-700">
            Influencers are paid only from Beezio platform fees, never from seller or affiliate funds.
          </div>
          <div className="rounded-lg border border-white/80 bg-white p-4 text-sm text-gray-700">
            Refunded, canceled, or disputed orders should not move into a live payout batch until they clear.
          </div>
        </div>
      </div>

      <div className="mb-6 space-y-3">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div>
          <h1 className="text-3xl font-bold text-gray-900">PayPal Payouts Queue</h1>
          <p className="text-sm text-gray-600 mt-1">Manual approval workflow: review who is ready, prepare a locked batch, approve it after verification, then sync PayPal status.</p>
          </div>
          <div className="text-xs text-gray-500 xl:max-w-xl">
            Preview actions open a dedicated report window and also keep an inline copy on the page. Download actions save the CSV directly.
          </div>
        </div>
        <div className="grid gap-4 xl:grid-cols-[1.25fr_0.95fr]">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <div className="text-sm font-semibold text-gray-900">How you pay people</div>
            <div className="mt-2 space-y-2 text-sm text-gray-700">
              <div>1. Review the due list below and confirm the payout emails are correct.</div>
              <div>2. Click <strong>Prepare PayPal Batch</strong> to lock the current payout set.</div>
              <div>3. Open the final review and click <strong>Confirm And Submit To PayPal</strong>.</div>
              <div>4. Click <strong>Sync Status</strong> after PayPal processes the batch.</div>
            </div>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="text-sm font-semibold text-gray-900">Current run snapshot</div>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg border border-white/80 bg-white px-3 py-3">
                <div className="text-xs uppercase tracking-wide text-gray-500">Ready payees</div>
                <div className="mt-1 text-xl font-semibold text-gray-900">{duePayoutAccounts.length}</div>
              </div>
              <div className="rounded-lg border border-white/80 bg-white px-3 py-3">
                <div className="text-xs uppercase tracking-wide text-gray-500">Due total</div>
                <div className="mt-1 text-xl font-semibold text-emerald-700">{formatCurrency(totalAmount)}</div>
              </div>
              <div className="rounded-lg border border-white/80 bg-white px-3 py-3">
                <div className="text-xs uppercase tracking-wide text-gray-500">Next payday</div>
                <div className="mt-1 text-base font-semibold text-gray-900">{payoutDate}</div>
              </div>
              <div className="rounded-lg border border-white/80 bg-white px-3 py-3">
                <div className="text-xs uppercase tracking-wide text-gray-500">Minimum</div>
                <div className="mt-1 text-base font-semibold text-gray-900">{formatCurrency(Number(stats?.env?.minimumPayout || 0))}</div>
              </div>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto pb-2">
          <div className="flex min-w-max flex-wrap items-center gap-2 xl:min-w-0">
            <label className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700">
            <span>Payday</span>
            <input
              type="date"
              value={payoutDate}
              onChange={(event) => setPayoutDate(event.target.value)}
              className="rounded border border-gray-300 px-2 py-1 text-sm"
            />
            </label>
            <button
            type="button"
            onClick={exportCSV}
            disabled={!payees.length}
            className="px-4 py-2 rounded-lg bg-green-700 text-white font-semibold disabled:opacity-50"
          >
            Open Summary Table
            </button>
            <button
            type="button"
            onClick={exportFullSalesCsv}
            disabled={!salesLedger?.rows?.length}
            className="px-4 py-2 rounded-lg bg-slate-900 text-white font-semibold disabled:opacity-50"
          >
            Open Full Sales Table
            </button>
            <button
            type="button"
            onClick={exportMonthlyFinanceCsv}
            disabled={!monthlyFinanceRows.length}
            className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-800 font-semibold disabled:opacity-50"
          >
            Open Monthly Finance Table
            </button>
            <button
            type="button"
            onClick={printFullReport}
            disabled={!salesLedger?.rows?.length}
            className="px-4 py-2 rounded-lg bg-amber-700 text-white font-semibold disabled:opacity-50"
          >
            Print Full Report PDF
            </button>
            <button
            type="button"
            onClick={() => downloadManualPayoutExport('paypal', 'download')}
            disabled={Boolean(actionLoading)}
            className="px-4 py-2 rounded-lg bg-emerald-700 text-white font-semibold disabled:opacity-50"
          >
            {actionLoading === 'export:paypal' ? 'Preparing...' : 'Download PayPal Upload CSV'}
            </button>
            <button
            type="button"
            onClick={() => downloadManualPayoutExport('paypal', 'download', 'tsv')}
            disabled={Boolean(actionLoading)}
            className="px-4 py-2 rounded-lg border border-emerald-300 bg-white text-emerald-900 font-semibold disabled:opacity-50"
          >
            {actionLoading === 'export:paypal' ? 'Preparing...' : 'Download PayPal TSV'}
            </button>
            <button
            type="button"
            onClick={() => downloadManualPayoutExport('paypal', 'download', 'txt')}
            disabled={Boolean(actionLoading)}
            className="px-4 py-2 rounded-lg border border-emerald-300 bg-white text-emerald-900 font-semibold disabled:opacity-50"
          >
            {actionLoading === 'export:paypal' ? 'Preparing...' : 'Download PayPal Text'}
            </button>
            <button
            type="button"
            onClick={() => downloadManualPayoutExport('paypal', 'preview')}
            disabled={Boolean(actionLoading)}
            className="px-4 py-2 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-900 font-semibold disabled:opacity-50"
          >
            {actionLoading === 'export:paypal' ? 'Preparing...' : 'Preview PayPal Upload'}
          </button>
            <button
            type="button"
            onClick={() => downloadManualPayoutExport('audit', 'preview')}
            disabled={Boolean(actionLoading)}
            className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-800 font-semibold disabled:opacity-50"
          >
            {actionLoading === 'export:audit' ? 'Preparing...' : 'Preview Audit CSV (Due + Held)'}
            </button>
            <div className="w-full text-xs text-gray-500">
              CSV and TSV open in OpenOffice, LibreOffice, and Google Sheets. The text download opens directly in Notepad if you only need a readable copy.
            </div>
            <button
            type="button"
            onClick={() => refresh()}
            disabled={loading}
            className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-800 font-semibold disabled:opacity-50"
          >
            {loading ? 'Refreshing...' : 'Refresh Data'}
            </button>
            <button
            type="button"
            onClick={() => runBatch(true)}
            disabled={Boolean(actionLoading) || !payees.length}
            className="px-4 py-2 rounded-lg bg-gray-900 text-white font-semibold disabled:opacity-50"
          >
            {actionLoading === 'dry-run' ? 'Running...' : 'Dry Run Batch'}
            </button>
            <button
            type="button"
            onClick={() => runBatch(false)}
            disabled={Boolean(actionLoading) || !payees.length || Boolean(stats?.env?.payoutsPaused) || !batchReviewConfirmed}
            className="px-4 py-2 rounded-lg bg-amber-600 text-white font-semibold disabled:opacity-50"
            title={
              stats?.env?.payoutsPaused
                ? 'Payouts are paused by PAYOUTS_PAUSED'
                : !batchReviewConfirmed
                  ? 'Confirm manual review before preparing the payout batch'
                  : undefined
            }
          >
            {actionLoading === 'prepare' ? 'Preparing...' : 'Prepare PayPal Batch'}
            </button>
            <button
            type="button"
            onClick={() => payAllDueNow()}
            disabled={Boolean(actionLoading) || !payees.length || Boolean(stats?.env?.payoutsPaused) || !batchReviewConfirmed}
            className="px-4 py-2 rounded-lg bg-rose-700 text-white font-semibold disabled:opacity-50"
            title={!batchReviewConfirmed ? 'Confirm manual review before paying all due recipients' : `Prepare and submit all due payouts for ${payoutDate}`}
          >
            {actionLoading === 'prepare' ? 'Preparing...' : `Prepare And Open Final Send Review`}
            </button>
            <button
            type="button"
            onClick={() => syncStatus()}
            disabled={Boolean(actionLoading)}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold disabled:opacity-50"
          >
            {actionLoading === 'sync' ? 'Syncing...' : 'Sync Status'}
            </button>
          </div>
        </div>
        <div className="mt-3 text-xs text-gray-500">
          These report buttons open browser-readable tables now. If a button is gray, that report has no loaded rows yet for the current payday and filters.
        </div>
      </div>

      {reportPreview ? (
        <div id="admin-report-preview" className="mb-6 rounded-2xl border border-sky-200 bg-sky-50/70 p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">Report Workspace</div>
              <h2 className="mt-2 text-xl font-semibold text-slate-900">{reportPreview.title}</h2>
              <p className="mt-1 max-w-3xl text-sm text-slate-700">{reportPreview.subtitle}</p>
              <div className="mt-2 text-xs text-slate-500">{reportPreview.rows.length} row{reportPreview.rows.length === 1 ? '' : 's'} loaded.</div>
            </div>
            <div className="flex flex-wrap gap-2">
              {reportPreview.csvContent && reportPreview.csvFilename ? (
                <button
                  type="button"
                  onClick={() => downloadTextFile(reportPreview.csvContent || '', reportPreview.csvFilename || 'beezio-report.csv')}
                  className="rounded-lg bg-sky-700 px-4 py-2 text-sm font-semibold text-white"
                >
                  Download CSV
                </button>
              ) : null}
              <button
                type="button"
                onClick={printReportPreview}
                className="rounded-lg border border-sky-300 bg-white px-4 py-2 text-sm font-semibold text-sky-900"
              >
                Print / Save PDF
              </button>
              <button
                type="button"
                onClick={openReportPreviewInWindow}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800"
              >
                Open In New Window
              </button>
              <button
                type="button"
                onClick={() => setReportPreview(null)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800"
              >
                Close Preview
              </button>
            </div>
          </div>
          <div className="mt-4 overflow-x-auto rounded-xl border border-sky-100 bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  {reportPreview.headers.map((header) => (
                    <th key={header} className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reportPreview.rows.length ? reportPreview.rows.map((row, rowIndex) => (
                  <tr key={`${reportPreview.title}-${rowIndex}`} className="border-t border-slate-100 align-top">
                    {row.map((cell, cellIndex) => (
                      <td key={`${reportPreview.title}-${rowIndex}-${cellIndex}`} className="px-4 py-3 text-slate-700">
                        {String(cell ?? '') || '-'}
                      </td>
                    ))}
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={Math.max(reportPreview.headers.length, 1)} className="px-4 py-8 text-center text-sm text-slate-500">
                      No rows matched this report.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-4xl">
            <h2 className="text-lg font-semibold text-gray-900">How Beezio Payouts Work</h2>
            <p className="mt-1 text-sm text-gray-700">
              Seller payouts, affiliate payouts, and influencer payouts are recorded on every paid order, held until the release date,
              then grouped into the selected payday batch.
            </p>
          </div>
          <div className="rounded-lg border border-white/80 bg-white px-4 py-3 text-sm text-gray-700 lg:min-w-[240px]">
            <div className="text-xs uppercase tracking-wide text-gray-500">Selected Payday</div>
            <div className="mt-1 text-lg font-semibold text-gray-900">{payoutDate}</div>
            <div className="mt-1 text-xs text-gray-500">Runs are scheduled for the 15th and the last day of the month.</div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
          <div className="rounded-xl border border-white/80 bg-white p-4">
            <div className="text-sm font-semibold text-gray-900">Pricing and fee rules</div>
            <div className="mt-2 space-y-2 text-sm text-gray-700">
              <p>Seller sets the product price basis and keeps 100% of the ask amount they entered.</p>
              <p>Seller also chooses the affiliate commission for that product, and the affiliate receives 100% of that configured commission.</p>
              <p>For asks under $25, Beezio uses a flat $2 platform fee and PayPal is baked into the customer price.</p>
              <p>For asks at $25 and above, Beezio uses 15% and PayPal comes out of Beezio&apos;s fee pool, not the seller or affiliate payout.</p>
              <p>Influencer payout amounts are added to the product price and are never deducted from the seller payout or the affiliate payout.</p>
            </div>
          </div>

          <div className="rounded-xl border border-white/80 bg-white p-4">
            <div className="text-sm font-semibold text-gray-900">Influencer lifetime payout rules</div>
            <div className="mt-2 space-y-2 text-sm text-gray-700">
              <p>There are two lifetime influencer referral paths: one for a recruited seller and one for a recruited affiliate.</p>
              <p>If a seller signed up through an influencer, that influencer keeps earning on that seller&apos;s sales.</p>
              <p>If an affiliate signed up through an influencer, that influencer keeps earning on that affiliate&apos;s sales.</p>
              <p>Each qualifying influencer payout is $0.50 for products under $20 and $1.00 for products at $20 and above.</p>
              <p>If one influencer slot is missing, Beezio keeps that unused slot amount as profit. If both slots are missing, Beezio keeps both unused slot amounts.</p>
            </div>
          </div>
        </div>
      </div>

      {stats ? (
        <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white border rounded-xl p-4">
            <div className="text-sm text-gray-600">Ready to Pay</div>
            <div className="text-2xl font-semibold text-gray-900">{stats.counts.ready_to_pay}</div>
          </div>
          <div className="bg-white border rounded-xl p-4">
            <div className="text-sm text-gray-600">Pending Hold (Matured)</div>
            <div className="text-2xl font-semibold text-gray-900">{stats.counts.pending_hold_matured}</div>
          </div>
          <div className="bg-white border rounded-xl p-4">
            <div className="text-sm text-gray-600">On Hold (Dispute)</div>
            <div className="text-2xl font-semibold text-gray-900">{stats.counts.on_hold_dispute}</div>
          </div>
          <div className="bg-white border rounded-xl p-4">
            <div className="text-sm text-gray-600">Env</div>
            <div className="text-sm text-gray-900 mt-1">Min: ${Number(stats.env.minimumPayout).toFixed(2)}</div>
            <div className={`text-sm mt-1 ${stats.env.payoutsPaused ? 'text-red-700' : 'text-emerald-700'}`}>
              {stats.env.payoutsPaused ? 'Paused' : 'Not paused'}
            </div>
          </div>
        </div>
      ) : null}

      {!loading ? (
        <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Payday Run</h2>
              <p className="mt-1 text-sm text-gray-700">
                This page is the payout source of truth. Review who is ready, prepare a payout batch to lock those lines, approve it only after verification, then sync status back into Beezio.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm lg:min-w-[360px]">
              <div className="rounded-lg border border-white/80 bg-white px-4 py-3">
                <div className="text-xs uppercase text-gray-500">Pay Date</div>
                <div className="mt-1 text-sm font-semibold text-gray-900">{payoutDate}</div>
              </div>
              <div className="rounded-lg border border-white/80 bg-white px-4 py-3">
                <div className="text-xs uppercase text-gray-500">Payees</div>
                <div className="mt-1 text-sm font-semibold text-gray-900">{payees.length}</div>
              </div>
              <div className="rounded-lg border border-white/80 bg-white px-4 py-3">
                <div className="text-xs uppercase text-gray-500">Ready Amount</div>
                <div className="mt-1 text-sm font-semibold text-gray-900">${totalAmount.toFixed(2)}</div>
              </div>
              <div className="rounded-lg border border-white/80 bg-white px-4 py-3">
                <div className="text-xs uppercase text-gray-500">Next Step</div>
                <div className="mt-1 text-sm font-semibold text-gray-900">
                  {payees.length ? 'Prepare Batch' : 'Wait for holds'}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {!loading ? (
        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-gray-900">Payday checklist</h2>
          <ol className="mt-3 space-y-2 text-sm text-gray-700">
            <li>1. Review ready-to-pay counts, dispute holds, and the selected pay date.</li>
            <li>2. Download the PayPal upload CSV and the line audit CSV for the same pay date if you want an external review copy.</li>
            <li>3. Prepare the payout batch to lock the exact recipients and amounts under review.</li>
            <li>4. Approve the prepared batch to submit it to PayPal.</li>
            <li>5. Return here and run <strong>Sync Status</strong> so Beezio marks those ledger lines as paid.</li>
          </ol>
        </div>
      ) : null}

      {!loading ? (
        <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Batch Review Confirmation</h2>
              <p className="mt-1 text-sm text-gray-700">Prepare Batch stays locked until the pay run has been manually inspected for the selected payday.</p>
            </div>
            <label className="flex max-w-2xl items-start gap-3 rounded-lg border border-white/80 bg-white px-4 py-3 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={batchReviewConfirmed}
                onChange={(event) => setBatchReviewConfirmed(event.target.checked)}
                className="mt-1 h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span>
                I reviewed the payees, sale lines, payout emails, due dates, and totals for <strong>{payoutDate}</strong>, and the batch is ready to prepare.
              </span>
            </label>
          </div>
        </div>
      ) : null}

      {!loading ? (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Pay Now Review</h2>
              <p className="mt-1 text-sm text-gray-700">Manual inspection layer before the batch runs. Every line below is due on or before the selected payday and is grouped by payee so nothing is missed.</p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm sm:w-[320px]">
              <div className="rounded-lg border border-white/80 bg-white px-4 py-3">
                <div className="text-xs uppercase text-gray-500">Payees Due</div>
                <div className="mt-1 font-semibold text-gray-900">{payoutReviewGroups.length}</div>
              </div>
              <div className="rounded-lg border border-white/80 bg-white px-4 py-3">
                <div className="text-xs uppercase text-gray-500">Line Items Due</div>
                <div className="mt-1 font-semibold text-gray-900">{payoutReviewGroups.reduce((sum, group) => sum + group.lineCount, 0)}</div>
              </div>
            </div>
          </div>

          {payoutReviewGroups.length === 0 ? (
            <div className="mt-4 rounded-lg border border-white/80 bg-white p-4 text-sm text-gray-600">
              No payable sale lines are due for {payoutDate}. Keep this page open and rerun after the next hold release or selected payday.
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              {payoutReviewGroups.map((group) => (
                <div key={group.key} className="rounded-xl border border-amber-200 bg-white overflow-hidden">
                  <div className="flex flex-col gap-3 border-b border-amber-100 px-4 py-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="text-lg font-semibold text-gray-900">{group.payeeName}</div>
                      <div className="text-sm text-gray-500">{formatAdminRoleLabel(group.role)} payout</div>
                      <div className="mt-1 text-sm text-gray-600">PayPal: {group.paypalEmail || 'Missing PayPal email'}</div>
                      <div className="text-sm text-gray-500">Contact: {group.contactEmail || 'No contact email'}</div>
                      <div className="mt-2 text-xs text-gray-500">Paper trail: every line below is part of this payday receipt.</div>
                    </div>
                    <div className="space-y-3 lg:min-w-[420px]">
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                          <div className="text-xs uppercase text-gray-500">Due Date</div>
                          <div className="mt-1 font-semibold text-gray-900">{group.scheduledPayDate}</div>
                        </div>
                        <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                          <div className="text-xs uppercase text-gray-500">Total</div>
                          <div className="mt-1 font-semibold text-emerald-700">${group.total.toFixed(2)}</div>
                        </div>
                        <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                          <div className="text-xs uppercase text-gray-500">Orders</div>
                          <div className="mt-1 font-semibold text-gray-900">{group.orders}</div>
                        </div>
                        <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                          <div className="text-xs uppercase text-gray-500">Lines</div>
                          <div className="mt-1 font-semibold text-gray-900">{group.lineCount}</div>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedUserHistoryKey(`${group.lines[0]?.payeeId || group.paypalEmail || group.contactEmail || group.payeeName}::history`)}
                          className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100"
                        >
                          Open Full User History
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-gray-600">
                        <tr>
                          <th className="text-left px-4 py-3">Order</th>
                          <th className="text-left px-4 py-3">Buyer</th>
                          <th className="text-left px-4 py-3">Products</th>
                          <th className="text-left px-4 py-3">Payday</th>
                          <th className="text-left px-4 py-3">Hold Release</th>
                          <th className="text-left px-4 py-3">Payout Status</th>
                          <th className="text-right px-4 py-3">Amount</th>
                          <th className="text-right px-4 py-3">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.lines.map((line) => (
                          <tr key={`${group.key}-${line.orderId}-${line.role}`} className="border-t">
                            <td className="px-4 py-3 text-xs">
                              <div className="font-semibold text-gray-900">{line.orderNumber || line.orderId}</div>
                              <div className="font-mono text-gray-500">{line.orderId}</div>
                              <div className="text-gray-500">{line.createdAt ? new Date(line.createdAt).toLocaleString() : '-'}</div>
                            </td>
                            <td className="px-4 py-3 text-xs">
                              <div>{line.buyerName || '-'}</div>
                              <div className="text-gray-500">{line.buyerEmail || '-'}</div>
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-700">{line.productLabel}</td>
                            <td className="px-4 py-3 text-xs text-gray-700">{line.scheduledPayDate}</td>
                            <td className="px-4 py-3 text-xs text-gray-700">{line.holdReleaseAt ? new Date(line.holdReleaseAt).toLocaleDateString() : '-'}</td>
                            <td className="px-4 py-3 text-xs text-gray-700">{line.payoutStatus}</td>
                            <td className="px-4 py-3 text-right font-semibold text-gray-900">${line.amount.toFixed(2)}</td>
                            <td className="px-4 py-3 text-right">
                              <button
                                type="button"
                                onClick={() => void openPayoutOrderDetail(line.orderId)}
                                className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-800 hover:bg-gray-50"
                              >
                                Open Order
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {!loading && salesLedger ? (
        <div id="admin-user-history" className="mb-6 rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Admin User History</h2>
              <p className="mt-1 text-sm text-gray-600">
                Search every recorded seller, affiliate, and influencer payee. Open a user to inspect their payout receipt for the selected payday and their full recorded history.
              </p>
            </div>
            <label className="text-sm text-gray-700 lg:w-[380px]">
              <div className="mb-1 font-medium">Search User, Email, Product, Or Order</div>
              <input
                type="text"
                value={userHistorySearch}
                onChange={(event) => setUserHistorySearch(event.target.value)}
                placeholder="Name, PayPal, contact email, product, order"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </label>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-3">
            {filteredUserHistoryGroups.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-300 p-4 text-sm text-gray-500 xl:col-span-3">
                No recorded users match this search.
              </div>
            ) : (
              filteredUserHistoryGroups.slice(0, 24).map((group) => (
                <button
                  key={group.key}
                  type="button"
                  onClick={() => setSelectedUserHistoryKey(group.key)}
                  className={`rounded-xl border p-4 text-left transition ${selectedUserHistoryGroup?.key === group.key ? 'border-amber-300 bg-amber-50' : 'border-gray-200 bg-white hover:bg-gray-50'}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-gray-900">{group.displayName}</div>
                      <div className="mt-1 text-xs text-gray-500">{group.contactEmail || 'No contact email'}</div>
                      <div className="text-xs text-gray-500">PayPal: {group.paypalEmail || 'Missing PayPal email'}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs uppercase tracking-wide text-gray-500">Total</div>
                      <div className="text-sm font-semibold text-emerald-700">{formatCurrency(group.total)}</div>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {group.roles.map((role) => (
                      <span key={`${group.key}-${role}`} className="rounded-full border border-gray-200 bg-white px-2 py-1 text-xs font-semibold text-gray-700">
                        {formatAdminRoleLabel(role)} {formatCurrency(group.roleTotals[role])}
                      </span>
                    ))}
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-gray-600">
                    <div>
                      <div className="uppercase tracking-wide text-gray-500">Orders</div>
                      <div className="mt-1 font-semibold text-gray-900">{group.orders}</div>
                    </div>
                    <div>
                      <div className="uppercase tracking-wide text-gray-500">Lines</div>
                      <div className="mt-1 font-semibold text-gray-900">{group.lineCount}</div>
                    </div>
                    <div>
                      <div className="uppercase tracking-wide text-gray-500">Products</div>
                      <div className="mt-1 font-semibold text-gray-900">{group.uniqueProducts.length}</div>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>

          {selectedUserHistoryGroup ? (
            <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{selectedUserHistoryGroup.displayName}</h3>
                  <p className="mt-1 text-sm text-gray-700">
                    Full paper trail for everything this user has sold, promoted, or earned as an influencer in the recorded Beezio ledger.
                  </p>
                  <div className="mt-2 text-sm text-gray-600">Contact: {selectedUserHistoryGroup.contactEmail || 'No contact email'} | PayPal: {selectedUserHistoryGroup.paypalEmail || 'Missing PayPal email'}</div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm lg:min-w-[420px]">
                  <div className="rounded-lg border border-white bg-white px-4 py-3">
                    <div className="text-xs uppercase tracking-wide text-gray-500">Total Recorded</div>
                    <div className="mt-1 font-semibold text-emerald-700">{formatCurrency(selectedUserHistoryGroup.total)}</div>
                  </div>
                  <div className="rounded-lg border border-white bg-white px-4 py-3">
                    <div className="text-xs uppercase tracking-wide text-gray-500">Orders</div>
                    <div className="mt-1 font-semibold text-gray-900">{selectedUserHistoryGroup.orders}</div>
                  </div>
                  <div className="rounded-lg border border-white bg-white px-4 py-3">
                    <div className="text-xs uppercase tracking-wide text-gray-500">Seller</div>
                    <div className="mt-1 font-semibold text-gray-900">{formatCurrency(selectedUserHistoryGroup.roleTotals.seller)}</div>
                  </div>
                  <div className="rounded-lg border border-white bg-white px-4 py-3">
                    <div className="text-xs uppercase tracking-wide text-gray-500">Affiliate</div>
                    <div className="mt-1 font-semibold text-gray-900">{formatCurrency(selectedUserHistoryGroup.roleTotals.affiliate)}</div>
                  </div>
                  <div className="rounded-lg border border-white bg-white px-4 py-3">
                    <div className="text-xs uppercase tracking-wide text-gray-500">Influencer</div>
                    <div className="mt-1 font-semibold text-gray-900">{formatCurrency(selectedUserHistoryGroup.roleTotals.influencer)}</div>
                  </div>
                  <div className="rounded-lg border border-white bg-white px-4 py-3">
                    <div className="text-xs uppercase tracking-wide text-gray-500">Products Touched</div>
                    <div className="mt-1 font-semibold text-gray-900">{selectedUserHistoryGroup.uniqueProducts.length}</div>
                  </div>
                </div>
              </div>

              <div className="mt-5 rounded-xl border border-white bg-white overflow-hidden">
                <div className="border-b bg-gray-50 px-4 py-3">
                  <div className="font-semibold text-gray-900">Selected Payday Receipt</div>
                  <div className="mt-1 text-sm text-gray-600">Every payable line for {selectedUserHistoryGroup.displayName} due on or before {payoutDate}.</div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-600">
                      <tr>
                        <th className="text-left px-4 py-3">Role</th>
                        <th className="text-left px-4 py-3">Order</th>
                        <th className="text-left px-4 py-3">Buyer</th>
                        <th className="text-left px-4 py-3">Products</th>
                        <th className="text-left px-4 py-3">Payday</th>
                        <th className="text-left px-4 py-3">Status</th>
                        <th className="text-right px-4 py-3">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedUserCurrentPaydayLines.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-4 text-sm text-gray-500">No active receipt lines for this user on or before {payoutDate}.</td>
                        </tr>
                      ) : (
                        selectedUserCurrentPaydayLines.map((line) => (
                          <tr key={`current-${selectedUserHistoryGroup.key}-${line.role}-${line.orderId}`} className="border-t">
                            <td className="px-4 py-3 text-xs font-semibold text-gray-700">{formatAdminRoleLabel(line.role)}</td>
                            <td className="px-4 py-3 text-xs">
                              <div className="font-semibold text-gray-900">{line.orderNumber || line.orderId}</div>
                              <div className="font-mono text-gray-500">{line.orderId}</div>
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-700">
                              <div>{line.buyerName || '-'}</div>
                              <div className="text-gray-500">{line.buyerEmail || '-'}</div>
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-700">{line.products.join(', ') || '-'}</td>
                            <td className="px-4 py-3 text-xs text-gray-700">{line.scheduledPayDate}</td>
                            <td className="px-4 py-3 text-xs text-gray-700">{line.payoutStatus}</td>
                            <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatCurrency(line.amount)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="mt-5 rounded-xl border border-white bg-white overflow-hidden">
                <div className="border-b bg-gray-50 px-4 py-3">
                  <div className="font-semibold text-gray-900">Full Recorded History</div>
                  <div className="mt-1 text-sm text-gray-600">All recorded order lines for this user across seller, affiliate, and influencer roles.</div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-600">
                      <tr>
                        <th className="text-left px-4 py-3">Created</th>
                        <th className="text-left px-4 py-3">Role</th>
                        <th className="text-left px-4 py-3">Order</th>
                        <th className="text-left px-4 py-3">Buyer</th>
                        <th className="text-left px-4 py-3">Products</th>
                        <th className="text-left px-4 py-3">Related People</th>
                        <th className="text-left px-4 py-3">Payout</th>
                        <th className="text-right px-4 py-3">Amount</th>
                        <th className="text-right px-4 py-3">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedUserHistoryGroup.lines.map((line) => (
                        <tr key={`history-${selectedUserHistoryGroup.key}-${line.role}-${line.orderId}-${line.createdAt || 'na'}`} className="border-t align-top">
                          <td className="px-4 py-3 text-xs text-gray-700">{formatDateTime(line.createdAt)}</td>
                          <td className="px-4 py-3 text-xs font-semibold text-gray-700">{formatAdminRoleLabel(line.role)}</td>
                          <td className="px-4 py-3 text-xs">
                            <div className="font-semibold text-gray-900">{line.orderNumber || line.orderId}</div>
                            <div className="font-mono text-gray-500">{line.orderId}</div>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-700">
                            <div>{line.buyerName || '-'}</div>
                            <div className="text-gray-500">{line.buyerEmail || '-'}</div>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-700">{line.products.join(', ') || '-'}</td>
                          <td className="px-4 py-3 text-xs text-gray-700">
                            <div>Seller: {line.sellerName || '-'}</div>
                            <div>Affiliate: {line.affiliateName || '-'}</div>
                            <div>Influencer: {line.influencerNames.join(', ') || '-'}</div>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-700">
                            <div>Payday: {line.scheduledPayDate}</div>
                            <div>Hold: {line.holdReleaseAt ? new Date(line.holdReleaseAt).toLocaleDateString() : '-'}</div>
                            <div>Status: {line.payoutStatus}</div>
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatCurrency(line.amount)}</td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => void openPayoutOrderDetail(line.orderId)}
                              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-800 hover:bg-gray-50"
                            >
                              Open Order
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="mb-6 bg-white border rounded-xl p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm text-gray-600">PayPal Checkout Environment</div>
            <div className="text-lg font-semibold text-gray-900">
              {paypalConfigLoading ? 'Loading...' : paypalConfig?.env === 'live' ? 'Live' : 'Sandbox'}
            </div>
            <div className="text-xs text-gray-600 mt-1">
              Client ID: {paypalConfig?.configured?.clientId ? 'set' : 'missing'} | Secret: {paypalConfig?.configured?.clientSecret ? 'set' : 'missing'}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPayPalEnv('sandbox')}
              disabled={paypalEnvSaving || paypalConfigLoading}
              className="px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-800 text-sm font-semibold disabled:opacity-50"
            >
              Use Sandbox
            </button>
            <button
              type="button"
              onClick={() => setPayPalEnv('live')}
              disabled={paypalEnvSaving || paypalConfigLoading}
              className="px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold disabled:opacity-50"
            >
              Use Live
            </button>
          </div>
        </div>
        {paypalConfigError ? <div className="mt-3 text-sm text-red-600">{paypalConfigError}</div> : null}

        <div className="mt-4 grid gap-4 xl:grid-cols-[1.1fr_1fr]">
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <div className="text-sm font-semibold text-gray-900">PayPal Standard Payouts Readiness</div>
            <div className="mt-2 text-sm text-gray-700">
              {paypalConfig?.payoutsApi
                ? paypalConfig.payoutsApi.access_ok
                  ? 'Beezio can reach the PayPal Standard Payouts API with the current account.'
                  : 'Beezio authenticated, but this account still needs Standard Payouts setup or approval.'
                : 'Readiness check is unavailable until PayPal credentials are configured.'}
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3 text-sm">
              <div className="rounded-lg border border-white bg-white px-3 py-3">
                <div className="text-xs uppercase tracking-wide text-gray-500">Auth</div>
                <div className={`mt-1 font-semibold ${paypalConfig?.payoutsApi?.auth_ok ? 'text-emerald-700' : 'text-red-700'}`}>
                  {paypalConfig?.payoutsApi?.auth_ok ? 'OK' : 'Not ready'}
                </div>
              </div>
              <div className="rounded-lg border border-white bg-white px-3 py-3">
                <div className="text-xs uppercase tracking-wide text-gray-500">Payouts Access</div>
                <div className={`mt-1 font-semibold ${paypalConfig?.payoutsApi?.access_ok ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {paypalConfig?.payoutsApi?.access_ok ? 'Enabled' : 'Needs attention'}
                </div>
              </div>
              <div className="rounded-lg border border-white bg-white px-3 py-3">
                <div className="text-xs uppercase tracking-wide text-gray-500">Probe</div>
                <div className="mt-1 font-semibold text-gray-900">{paypalConfig?.payoutsApi?.status || '-'}</div>
              </div>
            </div>
            <div className="mt-3 text-xs text-gray-600">
              {paypalConfig?.payoutsApi?.message || 'No PayPal readiness probe has run yet.'}
            </div>
            <div className="mt-1 text-xs text-gray-500">
              Checked: {paypalConfig?.payoutsApi?.checked_at ? new Date(paypalConfig.payoutsApi.checked_at).toLocaleString() : '-'}
            </div>
          </div>

          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
            <div className="text-sm font-semibold text-gray-900">Standard Payouts Checklist</div>
            <ol className="mt-3 space-y-2 text-sm text-gray-700">
              {(paypalConfig?.payoutsPrerequisites || []).map((entry, index) => (
                <li key={entry}>{index + 1}. {entry}</li>
              ))}
            </ol>
            <div className="mt-4 flex flex-wrap gap-2">
              {paypalConfig?.links?.requestAccess ? (
                <a
                  href={paypalConfig.links.requestAccess}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white"
                >
                  Request Payouts Access
                </a>
              ) : null}
              {paypalConfig?.links?.standardDocs ? (
                <a
                  href={paypalConfig.links.standardDocs}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-800"
                >
                  Open Standard Payouts Docs
                </a>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {error && <div className="mb-4 text-red-600 text-sm">{error}</div>}
      {loading && <div className="text-gray-500">Loading payout queue...</div>}

      {lastActionResult ? (
        <div className="mb-6 bg-white border rounded-xl p-4">
          <div className="text-sm text-gray-600 mb-2">Last action result</div>
          <pre className="text-xs bg-gray-50 border rounded-lg p-3 overflow-auto">{JSON.stringify(lastActionResult, null, 2)}</pre>
        </div>
      ) : null}

      {approvalCandidate ? (
        <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Final PayPal Submission Review</h2>
              <p className="mt-1 text-sm text-gray-700">This is the last confirmation before the prepared batch is sent to PayPal.</p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm lg:min-w-[340px]">
              <div className="rounded-lg border border-white/80 bg-white px-4 py-3">
                <div className="text-xs uppercase text-gray-500">Batch</div>
                <div className="mt-1 font-mono text-xs text-gray-900">{approvalCandidate.batchId}</div>
              </div>
              <div className="rounded-lg border border-white/80 bg-white px-4 py-3">
                <div className="text-xs uppercase text-gray-500">Payday</div>
                <div className="mt-1 font-semibold text-gray-900">{approvalCandidate.payoutDate}</div>
              </div>
              <div className="rounded-lg border border-white/80 bg-white px-4 py-3">
                <div className="text-xs uppercase text-gray-500">Recipients</div>
                <div className="mt-1 font-semibold text-gray-900">{approvalCandidate.itemCount}</div>
              </div>
              <div className="rounded-lg border border-white/80 bg-white px-4 py-3">
                <div className="text-xs uppercase text-gray-500">Total</div>
                <div className="mt-1 font-semibold text-rose-700">${approvalCandidate.totalAmount.toFixed(2)}</div>
              </div>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => approveBatch(approvalCandidate.batchId)}
              disabled={Boolean(actionLoading) || Boolean(stats?.env?.payoutsPaused)}
              className="px-4 py-2 rounded-lg bg-rose-700 text-white font-semibold disabled:opacity-50"
            >
              {actionLoading === `approve:${approvalCandidate.batchId}` ? 'Submitting...' : 'Confirm And Submit To PayPal'}
            </button>
            <button
              type="button"
              onClick={() => setApprovalCandidate(null)}
              disabled={Boolean(actionLoading)}
              className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-800 font-semibold disabled:opacity-50"
            >
              Cancel Final Approval
            </button>
          </div>
          <div className="mt-5 overflow-x-auto rounded-xl border border-white/80 bg-white">
            <div className="px-4 py-3 text-sm font-semibold text-gray-900">Recipients in this payout run</div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-4 py-3 text-left">Payee</th>
                  <th className="px-4 py-3 text-left">Beezio email</th>
                  <th className="px-4 py-3 text-left">PayPal payout email</th>
                  <th className="px-4 py-3 text-right">Seller</th>
                  <th className="px-4 py-3 text-right">Affiliate</th>
                  <th className="px-4 py-3 text-right">Influencer</th>
                  <th className="px-4 py-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {duePayoutAccountsPreview.map((payee) => (
                  <tr key={`approval-${payee.key}`} className="border-t">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{payee.displayName || 'Unknown payee'}</div>
                      <div className="text-xs text-gray-500">{payee.userId || '-'}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-700">{payee.contactEmail || '-'}</td>
                    <td className="px-4 py-3 text-xs text-gray-700">{payee.paypalEmail || 'Missing PayPal email'}</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(payee.dueRoleTotals.seller)}</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(payee.dueRoleTotals.affiliate)}</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(payee.dueRoleTotals.influencer)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-rose-700">{formatCurrency(payee.dueTotal)}</td>
                  </tr>
                ))}
                {duePayoutAccountsPreview.length === 0 ? (
                  <tr className="border-t">
                    <td colSpan={7} className="px-4 py-4 text-center text-sm text-gray-500">No due payees are loaded for this payday.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
            {duePayoutAccounts.length > duePayoutAccountsPreview.length ? (
              <div className="border-t bg-gray-50 px-4 py-3 text-xs text-gray-600">
                Showing the first {duePayoutAccountsPreview.length} payees in the final review. Full due list remains visible in <strong>Who Gets Paid This Run</strong>.
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {!loading && salesLedger ? (
        <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Finance Command Center</h2>
              <p className="text-sm text-gray-600">Gross sales, payout obligations, Beezio profit, PayPal fees, and tax holdbacks from the recorded sales ledger.</p>
            </div>
            <div className="text-xs text-gray-500">Source: unified sales ledger</div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="text-left px-4 py-3">Window</th>
                  <th className="text-right px-4 py-3">Orders</th>
                  <th className="text-right px-4 py-3">Gross</th>
                  <th className="text-right px-4 py-3">Seller</th>
                  <th className="text-right px-4 py-3">Affiliate</th>
                  <th className="text-right px-4 py-3">Influencer</th>
                  <th className="text-right px-4 py-3">Beezio</th>
                  <th className="text-right px-4 py-3">PayPal</th>
                  <th className="text-right px-4 py-3">Tax</th>
                </tr>
              </thead>
              <tbody>
                {([
                  ['lifetime', 'Lifetime'],
                  ['daily', 'Today'],
                  ['weekly', 'Last 7 Days'],
                  ['monthly', 'This Month'],
                  ['yearly', 'This Year'],
                ] as const).map(([key, label]) => {
                  const bucket = financeBuckets[key];
                  return (
                    <tr key={key} className="border-t">
                      <td className="px-4 py-3 font-medium text-gray-900">{label}</td>
                      <td className="px-4 py-3 text-right">{bucket.orders}</td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900">${bucket.grossSales.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right">${bucket.sellerPayouts.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right">${bucket.affiliatePayouts.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right">${bucket.influencerPayouts.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-emerald-700">${bucket.beezioProfit.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right">${bucket.paypalFees.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right">${bucket.salesTax.toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {!loading && salesLedger ? (
        <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Finance Book Closeout</h2>
              <p className="mt-1 text-sm text-gray-700">
                Reconcile sales, payout obligations, platform profit, taxes, and shipping by closeout window. Use the order lookup to audit a specific order number or order ID before closing the books.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={openFinanceCloseoutReport}
                disabled={!financeCloseoutExport.rows.length}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                Open Closeout Report
              </button>
              <button
                type="button"
                onClick={downloadFinanceCloseoutCsv}
                disabled={!financeCloseoutExport.rows.length}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 disabled:opacity-50"
              >
                Download Closeout CSV
              </button>
              <button
                type="button"
                onClick={() => void saveFinanceCloseoutSnapshot()}
                disabled={!financeCloseoutExport.rows.length || Boolean(actionLoading)}
                className="rounded-lg border border-blue-300 bg-white px-4 py-2 text-sm font-semibold text-blue-700 disabled:opacity-50"
              >
                {actionLoading === 'save-closeout' ? 'Saving...' : 'Save Official Closeout'}
              </button>
            </div>
          </div>

          <div className="mt-3 rounded-xl border border-blue-100 bg-white/90 p-4 text-sm text-gray-700">
            Saving a closeout stores the exact report window, summary, rows, and CSV on the server so finance can reopen the same period-close record later instead of relying on the live ledger after more orders, payouts, or corrections land.
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-4">
            <label className="text-sm text-gray-700">
              <div className="mb-1 font-medium">Start Date</div>
              <input
                type="date"
                value={closeoutStartDate}
                onChange={(event) => setCloseoutStartDate(event.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="text-sm text-gray-700">
              <div className="mb-1 font-medium">End Date</div>
              <input
                type="date"
                value={closeoutEndDate}
                onChange={(event) => setCloseoutEndDate(event.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="text-sm text-gray-700 xl:col-span-2">
              <div className="mb-1 font-medium">Order Lookup</div>
              <input
                type="text"
                value={closeoutOrderSearch}
                onChange={(event) => setCloseoutOrderSearch(event.target.value)}
                placeholder="Order number, order ID, buyer name, or buyer email"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </label>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-5">
            <div className="rounded-lg border border-white/80 bg-white px-4 py-3">
              <div className="text-xs uppercase tracking-wide text-gray-500">Orders</div>
              <div className="mt-1 text-lg font-semibold text-gray-900">{financeCloseoutSummary.orders}</div>
            </div>
            <div className="rounded-lg border border-white/80 bg-white px-4 py-3">
              <div className="text-xs uppercase tracking-wide text-gray-500">Gross Sales</div>
              <div className="mt-1 text-lg font-semibold text-gray-900">{formatCurrency(financeCloseoutSummary.grossSales)}</div>
            </div>
            <div className="rounded-lg border border-white/80 bg-white px-4 py-3">
              <div className="text-xs uppercase tracking-wide text-gray-500">Payout Obligations</div>
              <div className="mt-1 text-lg font-semibold text-gray-900">{formatCurrency(financeCloseoutSummary.totalPayouts)}</div>
            </div>
            <div className="rounded-lg border border-white/80 bg-white px-4 py-3">
              <div className="text-xs uppercase tracking-wide text-gray-500">Beezio Net</div>
              <div className="mt-1 text-lg font-semibold text-emerald-700">{formatCurrency(financeCloseoutSummary.beezioNet)}</div>
            </div>
            <div className="rounded-lg border border-white/80 bg-white px-4 py-3">
              <div className="text-xs uppercase tracking-wide text-gray-500">Missing PayPal</div>
              <div className="mt-1 text-lg font-semibold text-amber-700">{financeCloseoutSummary.missingPayPalOrders}</div>
            </div>
            <div className="rounded-lg border border-white/80 bg-white px-4 py-3">
              <div className="text-xs uppercase tracking-wide text-gray-500">Matched To Batch</div>
              <div className="mt-1 text-lg font-semibold text-gray-900">{financeCloseoutSummary.batchedOrders}</div>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3 xl:grid-cols-6">
            <div className="rounded-lg border border-white/80 bg-white px-4 py-3 text-sm">
              <div className="text-xs uppercase tracking-wide text-gray-500">Seller</div>
              <div className="mt-1 font-semibold text-gray-900">{formatCurrency(financeCloseoutSummary.sellerPayouts)}</div>
            </div>
            <div className="rounded-lg border border-white/80 bg-white px-4 py-3 text-sm">
              <div className="text-xs uppercase tracking-wide text-gray-500">Affiliate</div>
              <div className="mt-1 font-semibold text-gray-900">{formatCurrency(financeCloseoutSummary.affiliatePayouts)}</div>
            </div>
            <div className="rounded-lg border border-white/80 bg-white px-4 py-3 text-sm">
              <div className="text-xs uppercase tracking-wide text-gray-500">Influencer</div>
              <div className="mt-1 font-semibold text-gray-900">{formatCurrency(financeCloseoutSummary.influencerPayouts)}</div>
            </div>
            <div className="rounded-lg border border-white/80 bg-white px-4 py-3 text-sm">
              <div className="text-xs uppercase tracking-wide text-gray-500">PayPal Fees</div>
              <div className="mt-1 font-semibold text-gray-900">{formatCurrency(financeCloseoutSummary.paypalFees)}</div>
            </div>
            <div className="rounded-lg border border-white/80 bg-white px-4 py-3 text-sm">
              <div className="text-xs uppercase tracking-wide text-gray-500">Tax + Shipping</div>
              <div className="mt-1 font-semibold text-gray-900">{formatCurrency(financeCloseoutSummary.salesTax + financeCloseoutSummary.shipping)}</div>
            </div>
            <div className="rounded-lg border border-white/80 bg-white px-4 py-3 text-sm">
              <div className="text-xs uppercase tracking-wide text-gray-500">Paid / Ready / Held</div>
              <div className="mt-1 font-semibold text-gray-900">{financeCloseoutSummary.paidOrders} / {financeCloseoutSummary.readyOrders} / {financeCloseoutSummary.heldOrders}</div>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3 rounded-xl border border-white/80 bg-white p-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <label className="text-sm text-gray-700">
                <div className="mb-1 font-medium">Tax Year</div>
                <input
                  type="number"
                  min={2024}
                  max={2100}
                  value={taxYear}
                  onChange={(event) => setTaxYear(event.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={printFinanceCloseoutReport}
                disabled={!financeCloseoutRows.length}
                className="rounded-lg bg-amber-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                Print Closeout PDF
              </button>
              <button
                type="button"
                onClick={() => void openTaxYearContractorSummary()}
                disabled={Boolean(actionLoading)}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 disabled:opacity-50"
              >
                {actionLoading === 'tax-year-summary' ? 'Preparing...' : 'Open 1099 Contractor Summary'}
              </button>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto rounded-xl border border-blue-100 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-4 py-3 text-left">Order</th>
                  <th className="px-4 py-3 text-left">Buyer</th>
                  <th className="px-4 py-3 text-left">Products</th>
                  <th className="px-4 py-3 text-right">Gross</th>
                  <th className="px-4 py-3 text-right">Payouts</th>
                  <th className="px-4 py-3 text-right">Beezio Net</th>
                  <th className="px-4 py-3 text-left">Payday</th>
                  <th className="px-4 py-3 text-left">Matched Batch</th>
                  <th className="px-4 py-3 text-left">Missing PayPal</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {financeCloseoutRows.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-6 text-center text-sm text-gray-500">
                      No ledger rows match the selected closeout dates and order lookup.
                    </td>
                  </tr>
                ) : (
                  financeCloseoutRows.map((row) => (
                    <tr key={`closeout-${row.orderId}`} className="border-t align-top">
                      <td className="px-4 py-3 text-xs">
                        <div className="font-semibold text-gray-900">{row.orderNumber || row.orderId}</div>
                        <div className="font-mono text-gray-500">{row.orderId}</div>
                        <div className="text-gray-500">{formatDateTime(row.createdAt)}</div>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-700">
                        <div>{row.buyerName || '-'}</div>
                        <div className="text-gray-500">{row.buyerEmail || '-'}</div>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-700">{row.productsLabel || '-'}</td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatCurrency(row.grossSales)}</td>
                      <td className="px-4 py-3 text-right text-xs text-gray-700">
                        <div>Seller {formatCurrency(row.sellerAmount)}</div>
                        <div>Affiliate {formatCurrency(row.affiliateAmount)}</div>
                        <div>Influencer {formatCurrency(row.influencerAmount)}</div>
                        <div className="font-semibold text-gray-900">Total {formatCurrency(row.totalPayoutAmount)}</div>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-emerald-700">{formatCurrency(row.beezioNet)}</td>
                      <td className="px-4 py-3 text-xs text-gray-700">
                        <div>{row.scheduledPayDate}</div>
                        <div className="text-gray-500">{row.payoutStatus}</div>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-700">
                        {row.matchedProviderBatchIds.length ? row.matchedProviderBatchIds.join(', ') : row.matchedInternalBatchIds.length ? row.matchedInternalBatchIds.join(', ') : 'Not batched'}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-700">{row.missingPayPalRoles.length ? row.missingPayPalRoles.join(', ') : 'None'}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => void openPayoutOrderDetail(row.orderId)}
                          className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-800 hover:bg-gray-50"
                        >
                          Open Order
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 rounded-xl border border-blue-100 bg-white p-4">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h3 className="text-base font-semibold text-gray-900">Saved Closeout Records</h3>
                <p className="mt-1 text-sm text-gray-600">Official saved finance closeouts for reopening, printing, and CSV export.</p>
              </div>
              <button
                type="button"
                onClick={() => void loadSavedCloseoutReports()}
                disabled={savedCloseoutReportsLoading}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 disabled:opacity-50"
              >
                {savedCloseoutReportsLoading ? 'Refreshing...' : 'Refresh Saved Records'}
              </button>
            </div>

            {savedCloseoutReportsError ? (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{savedCloseoutReportsError}</div>
            ) : null}

            <div className="mt-4 overflow-x-auto rounded-xl border border-gray-100">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="px-4 py-3 text-left">Saved</th>
                    <th className="px-4 py-3 text-left">Window</th>
                    <th className="px-4 py-3 text-right">Rows</th>
                    <th className="px-4 py-3 text-right">Gross</th>
                    <th className="px-4 py-3 text-right">Payouts</th>
                    <th className="px-4 py-3 text-right">Beezio Net</th>
                    <th className="px-4 py-3 text-left">Filters</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {savedCloseoutReportsLoading && !savedCloseoutReports.length ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-6 text-center text-sm text-gray-500">Loading saved closeout reports...</td>
                    </tr>
                  ) : !savedCloseoutReports.length ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-6 text-center text-sm text-gray-500">No closeout records have been saved yet.</td>
                    </tr>
                  ) : (
                    savedCloseoutReports.map((report) => (
                      <tr key={report.id} className="border-t align-top">
                        <td className="px-4 py-3 text-xs text-gray-700">
                          <div className="font-semibold text-gray-900">{formatDateTime(report.created_at)}</div>
                          <div>{report.created_by_name || report.created_by_email || report.created_by_user_id}</div>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-700">
                          <div className="font-semibold text-gray-900">{report.closeout_start_date} to {report.closeout_end_date}</div>
                          <div>{formatDateTime(report.generated_at)}</div>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-900">{report.row_count}</td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatCurrency(report.gross_sales)}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{formatCurrency(report.total_payouts)}</td>
                        <td className="px-4 py-3 text-right font-semibold text-emerald-700">{formatCurrency(report.beezio_net)}</td>
                        <td className="px-4 py-3 text-xs text-gray-700">
                          <div>{report.order_search ? `Lookup: ${report.order_search}` : 'Full window'}</div>
                          <div>Missing PayPal {Number(report.summary?.missingPayPalOrders || 0)} • Batched {Number(report.summary?.batchedOrders || 0)}</div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex flex-wrap justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => void openSavedFinanceCloseoutReport(report.id)}
                              disabled={Boolean(actionLoading)}
                              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-800 disabled:opacity-50"
                            >
                              {actionLoading === `open-saved-closeout:${report.id}` ? 'Opening...' : 'Open'}
                            </button>
                            <button
                              type="button"
                              onClick={() => void downloadSavedFinanceCloseoutCsv(report.id)}
                              disabled={Boolean(actionLoading)}
                              className="rounded-lg border border-blue-300 bg-white px-3 py-1.5 text-xs font-semibold text-blue-700 disabled:opacity-50"
                            >
                              {actionLoading === `download-saved-closeout:${report.id}` ? 'Downloading...' : 'CSV'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      {!loading && (
        <>
          <div className="bg-white border rounded-xl p-4 mb-6">
            <div className="text-sm text-gray-600">Total Payees</div>
            <div className="text-2xl font-semibold text-gray-900">{payees.length}</div>
            <div className="text-sm text-gray-600 mt-2">Total Amount</div>
            <div className="text-xl font-semibold text-gray-900">${totalAmount.toFixed(2)}</div>
          </div>

          <div className="bg-white border rounded-xl overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 text-gray-700 font-semibold">Who Gets Paid This Run</div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="text-left px-4 py-3">Payee</th>
                  <th className="text-left px-4 py-3">Beezio And PayPal</th>
                  <th className="text-left px-4 py-3">Payout Breakdown</th>
                  <th className="text-left px-4 py-3">Hold And Next Run</th>
                  <th className="text-right px-4 py-3">Lifetime</th>
                </tr>
              </thead>
              <tbody>
                {payoutAccountSummaries.length === 0 && (
                  <tr>
                    <td className="px-4 py-6 text-center text-gray-500" colSpan={5}>
                      No payouts ready.
                    </td>
                  </tr>
                )}
                {payoutAccountSummaries.map((payee) => (
                  <tr key={payee.key} className="border-t align-top">
                    <td className="px-4 py-3">
                      <button type="button" onClick={() => openUserHistoryFromPayout(payee.key)} className="text-left">
                        <div className="font-medium text-amber-700 hover:text-amber-900">{payee.displayName || 'Unknown payee'}</div>
                        <div className="text-xs text-gray-500">{payee.userId || '-'}</div>
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-gray-900">{payee.contactEmail || '-'}</div>
                      <div className="text-xs text-gray-500">Beezio email</div>
                      <div className="mt-2 text-sm text-gray-900">{payee.paypalEmail || 'Missing PayPal email'}</div>
                      <div className="text-xs text-gray-500">PayPal payout email</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="grid gap-2 text-xs">
                        <div className="flex items-center justify-between gap-3"><span className="text-gray-500">Seller earnings</span><span className="font-semibold text-gray-900">{formatCurrency(payee.dueRoleTotals.seller)}</span></div>
                        <div className="flex items-center justify-between gap-3"><span className="text-gray-500">Affiliate earnings</span><span className="font-semibold text-gray-900">{formatCurrency(payee.dueRoleTotals.affiliate)}</span></div>
                        <div className="flex items-center justify-between gap-3"><span className="text-gray-500">Influencer earnings</span><span className="font-semibold text-gray-900">{formatCurrency(payee.dueRoleTotals.influencer)}</span></div>
                        <div className="border-t border-gray-200 pt-2 flex items-center justify-between gap-3"><span className="font-semibold text-gray-700">Total payout</span><span className="font-semibold text-emerald-700">{formatCurrency(payee.dueTotal)}</span></div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="grid gap-2 text-xs">
                        <div className="flex items-center justify-between gap-3"><span className="text-gray-500">On hold</span><span className="font-semibold text-amber-700">{formatCurrency(payee.holdTotal)}</span></div>
                        <div className="flex items-center justify-between gap-3"><span className="text-gray-500">Next payout</span><span className="font-semibold text-gray-900">{formatCurrency(payee.nextPayoutAmount)}</span></div>
                        <div className="flex items-center justify-between gap-3"><span className="text-gray-500">Next date</span><span className="font-semibold text-gray-900">{payee.nextPayoutDate ? new Date(payee.nextPayoutDate).toLocaleDateString() : '-'}</span></div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="font-semibold text-emerald-700">{formatCurrency(payee.lifetimeTotal)}</div>
                      <div className="text-xs text-gray-500">Lifetime earnings</div>
                      <div className="mt-2 text-xs text-gray-500">Orders: {payee.orderCount}</div>
                      <button
                        type="button"
                        onClick={() => openUserHistoryFromPayout(payee.key)}
                        className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100"
                      >
                        Open full user history
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 rounded-xl border border-sky-200 bg-sky-50 p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Beezio Platform Fee Earnings</h2>
                <p className="mt-1 text-sm text-gray-700">
                  This is the platform-side earnings view so accounting can separate Beezio fee revenue from seller, affiliate, and influencer payout obligations.
                </p>
              </div>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <div className="rounded-xl border border-white bg-white px-4 py-4">
                <div className="text-xs uppercase tracking-wide text-gray-500">Lifetime Beezio Net</div>
                <div className="mt-2 text-2xl font-semibold text-gray-900">{formatCurrency(financeBuckets.lifetime.beezioProfit - financeBuckets.lifetime.paypalFees)}</div>
                <div className="mt-1 text-xs text-gray-500">Platform fee earnings after PayPal costs across the full ledger.</div>
              </div>
              <div className="rounded-xl border border-white bg-white px-4 py-4">
                <div className="text-xs uppercase tracking-wide text-gray-500">This Year Beezio Net</div>
                <div className="mt-2 text-2xl font-semibold text-sky-700">{formatCurrency(financeBuckets.yearly.beezioProfit - financeBuckets.yearly.paypalFees)}</div>
                <div className="mt-1 text-xs text-gray-500">Year-to-date profit after processor costs.</div>
              </div>
              <div className="rounded-xl border border-white bg-white px-4 py-4">
                <div className="text-xs uppercase tracking-wide text-gray-500">This Month Net To Beezio</div>
                <div className="mt-2 text-2xl font-semibold text-emerald-700">{formatCurrency(financeBuckets.monthly.beezioProfit - financeBuckets.monthly.paypalFees)}</div>
                <div className="mt-1 text-xs text-gray-500">Monthly profit after PayPal costs.</div>
              </div>
              <div className="rounded-xl border border-white bg-white px-4 py-4">
                <div className="text-xs uppercase tracking-wide text-gray-500">Last 7 Days Net To Beezio</div>
                <div className="mt-2 text-2xl font-semibold text-amber-700">{formatCurrency(financeBuckets.weekly.beezioProfit - financeBuckets.weekly.paypalFees)}</div>
                <div className="mt-1 text-xs text-gray-500">Weekly profit after PayPal costs.</div>
              </div>
              <div className="rounded-xl border border-white bg-white px-4 py-4">
                <div className="text-xs uppercase tracking-wide text-gray-500">Today Net To Beezio</div>
                <div className="mt-2 text-2xl font-semibold text-gray-900">{formatCurrency(financeBuckets.daily.beezioProfit - financeBuckets.daily.paypalFees)}</div>
                <div className="mt-1 text-xs text-gray-500">Daily profit after PayPal costs.</div>
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Paid Out From Beezio PayPal</h2>
                <p className="mt-1 text-sm text-gray-700">
                  These totals only count ledger rows already marked paid, so you can see how much has actually left the Beezio PayPal balance.
                </p>
              </div>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <div className="rounded-xl border border-white bg-white px-4 py-4">
                <div className="text-xs uppercase tracking-wide text-gray-500">Lifetime Paid Out</div>
                <div className="mt-2 text-2xl font-semibold text-gray-900">{formatCurrency(paidOutBuckets.lifetime.sellerPayouts + paidOutBuckets.lifetime.affiliatePayouts + paidOutBuckets.lifetime.influencerPayouts)}</div>
              </div>
              <div className="rounded-xl border border-white bg-white px-4 py-4">
                <div className="text-xs uppercase tracking-wide text-gray-500">This Year Paid Out</div>
                <div className="mt-2 text-2xl font-semibold text-sky-700">{formatCurrency(paidOutBuckets.yearly.sellerPayouts + paidOutBuckets.yearly.affiliatePayouts + paidOutBuckets.yearly.influencerPayouts)}</div>
              </div>
              <div className="rounded-xl border border-white bg-white px-4 py-4">
                <div className="text-xs uppercase tracking-wide text-gray-500">This Month Paid Out</div>
                <div className="mt-2 text-2xl font-semibold text-emerald-700">{formatCurrency(paidOutBuckets.monthly.sellerPayouts + paidOutBuckets.monthly.affiliatePayouts + paidOutBuckets.monthly.influencerPayouts)}</div>
              </div>
              <div className="rounded-xl border border-white bg-white px-4 py-4">
                <div className="text-xs uppercase tracking-wide text-gray-500">Last 7 Days Paid Out</div>
                <div className="mt-2 text-2xl font-semibold text-amber-700">{formatCurrency(paidOutBuckets.weekly.sellerPayouts + paidOutBuckets.weekly.affiliatePayouts + paidOutBuckets.weekly.influencerPayouts)}</div>
              </div>
              <div className="rounded-xl border border-white bg-white px-4 py-4">
                <div className="text-xs uppercase tracking-wide text-gray-500">Today Paid Out</div>
                <div className="mt-2 text-2xl font-semibold text-gray-900">{formatCurrency(paidOutBuckets.daily.sellerPayouts + paidOutBuckets.daily.affiliatePayouts + paidOutBuckets.daily.influencerPayouts)}</div>
              </div>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="bg-white border rounded-xl overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 text-sm font-semibold text-gray-800">Daily Sales Snapshot</div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600 border-t">
                  <tr>
                    <th className="text-left px-4 py-3">Date</th>
                    <th className="text-right px-4 py-3">Orders</th>
                    <th className="text-right px-4 py-3">Gross</th>
                    <th className="text-right px-4 py-3">Payouts</th>
                    <th className="text-right px-4 py-3">Beezio Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {(stats?.daily_sales || []).slice(0, 14).map((d) => (
                    <tr key={`sales-${d.date}`} className="border-t">
                      <td className="px-4 py-2">{d.date}</td>
                      <td className="px-4 py-2 text-right">{d.orders}</td>
                      <td className="px-4 py-2 text-right">${Number(d.gross_amount || 0).toFixed(2)}</td>
                      <td className="px-4 py-2 text-right">${Number(d.payout_total || 0).toFixed(2)}</td>
                      <td className="px-4 py-2 text-right">${Number(d.beezio_profit || 0).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="bg-white border rounded-xl overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 text-sm font-semibold text-gray-800">Daily Payday Snapshot</div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600 border-t">
                  <tr>
                    <th className="text-left px-4 py-3">Pay Date</th>
                    <th className="text-right px-4 py-3">Orders</th>
                    <th className="text-right px-4 py-3">Gross</th>
                    <th className="text-right px-4 py-3">Payouts</th>
                    <th className="text-right px-4 py-3">Beezio Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {(stats?.daily_payouts || []).slice(0, 14).map((d) => (
                    <tr key={`payout-${d.date}`} className="border-t">
                      <td className="px-4 py-2">{d.date}</td>
                      <td className="px-4 py-2 text-right">{d.orders}</td>
                      <td className="px-4 py-2 text-right">${Number(d.gross_amount || 0).toFixed(2)}</td>
                      <td className="px-4 py-2 text-right">${Number(d.payout_total || 0).toFixed(2)}</td>
                      <td className="px-4 py-2 text-right">${Number(d.beezio_profit || 0).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="bg-white border rounded-xl overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 text-sm font-semibold text-gray-800">Weekly Sales Snapshot</div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600 border-t">
                  <tr>
                    <th className="text-left px-4 py-3">Week Starting</th>
                    <th className="text-right px-4 py-3">Orders</th>
                    <th className="text-right px-4 py-3">Gross</th>
                    <th className="text-right px-4 py-3">Payouts</th>
                    <th className="text-right px-4 py-3">Beezio Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {(stats?.weekly_sales || []).slice(0, 12).map((d) => (
                    <tr key={`weekly-sales-${d.date}`} className="border-t">
                      <td className="px-4 py-2">{d.date}</td>
                      <td className="px-4 py-2 text-right">{d.orders}</td>
                      <td className="px-4 py-2 text-right">${Number(d.gross_amount || 0).toFixed(2)}</td>
                      <td className="px-4 py-2 text-right">${Number(d.payout_total || 0).toFixed(2)}</td>
                      <td className="px-4 py-2 text-right">${Number(d.beezio_profit || 0).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="bg-white border rounded-xl overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 text-sm font-semibold text-gray-800">Monthly Sales Snapshot</div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600 border-t">
                  <tr>
                    <th className="text-left px-4 py-3">Month</th>
                    <th className="text-right px-4 py-3">Orders</th>
                    <th className="text-right px-4 py-3">Gross</th>
                    <th className="text-right px-4 py-3">Payouts</th>
                    <th className="text-right px-4 py-3">Beezio Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {(stats?.monthly_sales || []).slice(0, 12).map((d) => (
                    <tr key={`monthly-sales-${d.date}`} className="border-t">
                      <td className="px-4 py-2">{d.date}</td>
                      <td className="px-4 py-2 text-right">{d.orders}</td>
                      <td className="px-4 py-2 text-right">${Number(d.gross_amount || 0).toFixed(2)}</td>
                      <td className="px-4 py-2 text-right">${Number(d.payout_total || 0).toFixed(2)}</td>
                      <td className="px-4 py-2 text-right">${Number(d.beezio_profit || 0).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-6 bg-white border rounded-xl overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 text-gray-700 font-semibold">Line-by-Line Payout Ledger</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600 border-t">
                  <tr>
                    <th className="text-left px-4 py-3">Order</th>
                    <th className="text-left px-4 py-3">Status</th>
                    <th className="text-left px-4 py-3">Created</th>
                    <th className="text-left px-4 py-3">Paid</th>
                    <th className="text-left px-4 py-3">Seller Payee</th>
                    <th className="text-left px-4 py-3">Affiliate Payee</th>
                    <th className="text-left px-4 py-3">Influencer Slot 1</th>
                    <th className="text-left px-4 py-3">Influencer Slot 2</th>
                    <th className="text-right px-4 py-3">Gross</th>
                    <th className="text-right px-4 py-3">Seller</th>
                    <th className="text-right px-4 py-3">Affiliate</th>
                    <th className="text-right px-4 py-3">Influencer</th>
                    <th className="text-right px-4 py-3">Total Payout</th>
                    <th className="text-right px-4 py-3">Beezio Profit</th>
                    <th className="text-right px-4 py-3">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {(stats?.recent_ledger || []).slice(0, 100).map((row) => {
                    const payoutRow = row.order_id ? salesLedgerByOrderId.get(row.order_id) || null : null;
                    const sellerParty = normalizePayoutParty(payoutRow?.seller, row.seller_earnings);
                    const affiliateParty = normalizePayoutParty(payoutRow?.affiliate, row.partner_earnings);
                    const [influencerSlotOne, influencerSlotTwo] = resolveInfluencerSlots(payoutRow);
                    const isSelected = Boolean(row.order_id && selectedPayoutOrderId === row.order_id);

                    return (
                      <Fragment key={row.id}>
                        <tr className={`border-t ${isSelected ? 'bg-amber-50/70' : 'bg-white'}`}>
                          <td className="px-4 py-2 text-xs">
                            <button
                              type="button"
                              onClick={() => void openPayoutOrderDetail(row.order_id)}
                              disabled={!row.order_id}
                              className="font-mono text-left text-amber-700 hover:text-amber-900 disabled:text-gray-400 disabled:cursor-not-allowed"
                            >
                              {row.order_id || row.id}
                            </button>
                          </td>
                          <td className="px-4 py-2">{row.status}</td>
                          <td className="px-4 py-2">{row.created_at ? new Date(row.created_at).toLocaleString() : '-'}</td>
                          <td className="px-4 py-2">{row.paid_at ? new Date(row.paid_at).toLocaleString() : '-'}</td>
                          <td className="px-4 py-2 min-w-[190px] align-top">
                            <div className="font-medium text-gray-900">{sellerParty.name}</div>
                            <div className="text-xs text-gray-500">{formatPayoutPartyMeta(sellerParty)}</div>
                          </td>
                          <td className="px-4 py-2 min-w-[190px] align-top">
                            <div className="font-medium text-gray-900">{affiliateParty.name}</div>
                            <div className="text-xs text-gray-500">{formatPayoutPartyMeta(affiliateParty)}</div>
                          </td>
                          <td className="px-4 py-2 min-w-[190px] align-top">
                            <div className="font-medium text-gray-900">{influencerSlotOne.name}</div>
                            <div className="text-xs text-gray-500">{formatPayoutPartyMeta(influencerSlotOne)}</div>
                          </td>
                          <td className="px-4 py-2 min-w-[190px] align-top">
                            <div className="font-medium text-gray-900">{influencerSlotTwo.name}</div>
                            <div className="text-xs text-gray-500">{formatPayoutPartyMeta(influencerSlotTwo)}</div>
                          </td>
                          <td className="px-4 py-2 text-right">${Number(row.gross_amount || 0).toFixed(2)}</td>
                          <td className="px-4 py-2 text-right">${Number(row.seller_earnings || 0).toFixed(2)}</td>
                          <td className="px-4 py-2 text-right">${Number(row.partner_earnings || 0).toFixed(2)}</td>
                          <td className="px-4 py-2 text-right">${Number(row.influencer_earnings || 0).toFixed(2)}</td>
                          <td className="px-4 py-2 text-right">${Number(row.payout_total || 0).toFixed(2)}</td>
                          <td className="px-4 py-2 text-right">${Number(row.beezio_profit || 0).toFixed(2)}</td>
                          <td className="px-4 py-2 text-right">
                            <button
                              type="button"
                              onClick={() => void openPayoutOrderDetail(row.order_id)}
                              disabled={!row.order_id}
                              className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {isSelected ? (selectedPayoutDetailLoading ? 'Opening...' : 'Viewing') : 'View Detail'}
                            </button>
                          </td>
                        </tr>
                        {isSelected ? (
                          <tr className="border-t border-amber-100 bg-amber-50/40">
                            <td colSpan={15} className="px-4 py-4">
                              {selectedPayoutDetailError ? (
                                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                                  {selectedPayoutDetailError}
                                </div>
                              ) : null}

                              {selectedPayoutDetailLoading ? <div className="text-sm text-gray-600">Loading order detail...</div> : null}

                              {selectedPayoutRow ? (
                                (() => {
                                  const sellerPartyDetail = normalizePayoutParty(selectedPayoutRow.seller, selectedPayoutRow.seller.amount);
                                  const affiliatePartyDetail = normalizePayoutParty(selectedPayoutRow.affiliate, selectedPayoutRow.affiliate.amount);
                                  const [influencerSlotOneDetail, influencerSlotTwoDetail] = resolveInfluencerSlots(selectedPayoutRow);

                                  return (
                                    <div className="space-y-6">
                                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                        <div>
                                          <h2 className="text-lg font-semibold text-gray-900">
                                            Payout Order Detail {selectedPayoutRow.order_number ? `for ${selectedPayoutRow.order_number}` : ''}
                                          </h2>
                                          <p className="mt-1 text-sm text-gray-700">
                                            Buyer, seller, affiliate, influencer, PayPal routing, hold date, and payout amounts for this captured order.
                                          </p>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setSelectedPayoutOrderId(null);
                                            setSelectedPayoutDetail(null);
                                            setSelectedPayoutDetailError(null);
                                          }}
                                          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800"
                                        >
                                          Close Detail
                                        </button>
                                      </div>

                                      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
                                        <div className="rounded-lg border border-white/80 bg-white p-4">
                                          <div className="text-xs uppercase tracking-wide text-gray-500">Order Created</div>
                                          <div className="mt-2 text-sm font-semibold text-gray-900">{formatDateTime(selectedPayoutRow.created_at)}</div>
                                        </div>
                                        <div className="rounded-lg border border-white/80 bg-white p-4">
                                          <div className="text-xs uppercase tracking-wide text-gray-500">Hold Release</div>
                                          <div className="mt-2 text-sm font-semibold text-gray-900">{formatDateTime(selectedPayoutRow.hold_release_at)}</div>
                                        </div>
                                        <div className="rounded-lg border border-white/80 bg-white p-4">
                                          <div className="text-xs uppercase tracking-wide text-gray-500">Payout Status</div>
                                          <div className="mt-2 text-sm font-semibold text-gray-900">{selectedPayoutRow.payout_status}</div>
                                        </div>
                                        <div className="rounded-lg border border-white/80 bg-white p-4">
                                          <div className="text-xs uppercase tracking-wide text-gray-500">Gross Sale</div>
                                          <div className="mt-2 text-sm font-semibold text-gray-900">{formatCurrency(selectedPayoutRow.gross_sales)}</div>
                                        </div>
                                      </div>

                                      <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
                                        <div className="space-y-6">
                                          <div className="rounded-lg border border-white/80 bg-white p-4">
                                            <h3 className="font-semibold text-gray-900">Payout Parties</h3>
                                            <div className="mt-4 grid gap-4 md:grid-cols-2">
                                              <div>
                                                <div className="text-xs uppercase tracking-wide text-gray-500">Buyer</div>
                                                <div className="mt-1 font-medium text-gray-900">{selectedPayoutDetail?.order?.buyer?.name || selectedPayoutRow.buyer_name || '-'}</div>
                                                <div className="text-sm text-gray-600">{selectedPayoutDetail?.order?.buyer?.email || selectedPayoutRow.buyer_email || 'No buyer email'}</div>
                                              </div>
                                              <div>
                                                <div className="text-xs uppercase tracking-wide text-gray-500">Seller</div>
                                                <div className="mt-1 font-medium text-gray-900">{sellerPartyDetail.name}</div>
                                                <div className="text-sm text-gray-600">Contact: {selectedPayoutDetail?.order?.seller?.email || sellerPartyDetail.email || 'Beezio fallback'}</div>
                                                <div className="text-sm text-gray-600">PayPal: {sellerPartyDetail.paypal_email || 'Beezio fallback'}</div>
                                                <div className="mt-1 text-sm font-semibold text-blue-700">{formatCurrency(sellerPartyDetail.amount)}</div>
                                              </div>
                                              <div>
                                                <div className="text-xs uppercase tracking-wide text-gray-500">Affiliate</div>
                                                <div className="mt-1 font-medium text-gray-900">{affiliatePartyDetail.name}</div>
                                                <div className="text-sm text-gray-600">Contact: {affiliatePartyDetail.email || 'Beezio fallback'}</div>
                                                <div className="text-sm text-gray-600">PayPal: {affiliatePartyDetail.paypal_email || 'Beezio fallback'}</div>
                                                <div className="mt-1 text-sm font-semibold text-emerald-700">{formatCurrency(affiliatePartyDetail.amount)}</div>
                                              </div>
                                              <div>
                                                <div className="text-xs uppercase tracking-wide text-gray-500">Seller Influencer</div>
                                                <div className="mt-1 font-medium text-gray-900">{influencerSlotOneDetail.name}</div>
                                                <div className="text-sm text-gray-600">Contact: {influencerSlotOneDetail.email || 'Beezio fallback'}</div>
                                                <div className="text-sm text-gray-600">PayPal: {influencerSlotOneDetail.paypal_email || 'Beezio fallback'}</div>
                                                <div className="mt-1 text-sm font-semibold text-violet-700">{formatCurrency(influencerSlotOneDetail.amount)}</div>
                                              </div>
                                              <div>
                                                <div className="text-xs uppercase tracking-wide text-gray-500">Affiliate Influencer</div>
                                                <div className="mt-1 font-medium text-gray-900">{influencerSlotTwoDetail.name}</div>
                                                <div className="text-sm text-gray-600">Contact: {influencerSlotTwoDetail.email || 'Beezio fallback'}</div>
                                                <div className="text-sm text-gray-600">PayPal: {influencerSlotTwoDetail.paypal_email || 'Beezio fallback'}</div>
                                                <div className="mt-1 text-sm font-semibold text-violet-700">{formatCurrency(influencerSlotTwoDetail.amount)}</div>
                                              </div>
                                            </div>

                                            {selectedPayoutRow.influencers && selectedPayoutRow.influencers.length > 1 ? (
                                              <div className="mt-4 rounded-lg bg-gray-50 p-3">
                                                <div className="text-sm font-semibold text-gray-900">All influencer payees</div>
                                                <div className="mt-3 space-y-2">
                                                  {selectedPayoutRow.influencers.map((payee) => (
                                                    <div key={`${payee.id}-${payee.source || 'row'}`} className="flex items-start justify-between gap-3 text-sm">
                                                      <div>
                                                        <div className="font-medium text-gray-900">{payee.name || '-'}</div>
                                                        <div className="text-gray-500">{payee.email || 'No email'}{payee.paypal_email ? ` | PayPal: ${payee.paypal_email}` : ''}</div>
                                                      </div>
                                                      <div className="font-semibold text-gray-900">{formatCurrency(payee.amount)}</div>
                                                    </div>
                                                  ))}
                                                </div>
                                              </div>
                                            ) : null}
                                          </div>

                                          {selectedPayoutDetail?.order?.items?.length ? (
                                            <div className="rounded-lg border border-white/80 bg-white p-4">
                                              <h3 className="font-semibold text-gray-900">Order Items</h3>
                                              <div className="mt-4 space-y-3">
                                                {selectedPayoutDetail.order.items.map((item) => (
                                                  <div key={item.id} className="rounded-lg border border-gray-100 p-4">
                                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                                      <div>
                                                        <div className="font-semibold text-gray-900">{item.title}</div>
                                                        <div className="mt-1 text-sm text-gray-600">Qty {item.quantity} | Seller ask {formatCurrency(item.seller_ask_amount)} | Line total {formatCurrency(item.line_total)}</div>
                                                        <div className="mt-1 text-sm text-gray-500">Affiliate applied: {formatCurrency(item.applied_affiliate_commission_amount)}</div>
                                                      </div>
                                                      <div className="text-sm text-gray-500">SKU: {item.sku || item.variant_sku || 'N/A'}</div>
                                                    </div>
                                                  </div>
                                                ))}
                                              </div>
                                            </div>
                                          ) : null}
                                        </div>

                                        <div className="space-y-6">
                                          <div className="rounded-lg border border-white/80 bg-white p-4">
                                            <h3 className="font-semibold text-gray-900">Payout Breakdown</h3>
                                            <div className="mt-4 space-y-3 text-sm">
                                              <div className="flex items-center justify-between"><span className="text-gray-600">Seller payout</span><span className="font-semibold text-gray-900">{formatCurrency(selectedPayoutRow.seller.amount)}</span></div>
                                              <div className="flex items-center justify-between"><span className="text-gray-600">Affiliate payout</span><span className="font-semibold text-gray-900">{formatCurrency(selectedPayoutRow.affiliate.amount)}</span></div>
                                              <div className="flex items-center justify-between"><span className="text-gray-600">Influencer payout</span><span className="font-semibold text-gray-900">{formatCurrency(selectedPayoutRow.influencer.amount)}</span></div>
                                              <div className="flex items-center justify-between"><span className="text-gray-600">Beezio profit</span><span className="font-semibold text-amber-700">{formatCurrency(selectedPayoutRow.beezio_fee)}</span></div>
                                              <div className="flex items-center justify-between"><span className="text-gray-600">PayPal fee</span><span className="font-semibold text-rose-700">{formatCurrency(selectedPayoutRow.paypal_fee)}</span></div>
                                              <div className="flex items-center justify-between"><span className="text-gray-600">Sales tax</span><span className="font-semibold text-gray-900">{formatCurrency(selectedPayoutRow.sales_tax)}</span></div>
                                              <div className="flex items-center justify-between"><span className="text-gray-600">Shipping</span><span className="font-semibold text-gray-900">{formatCurrency(selectedPayoutRow.shipping)}</span></div>
                                              <div className="border-t border-gray-200 pt-3 flex items-center justify-between"><span className="text-gray-700">Total payout obligation</span><span className="font-semibold text-emerald-700">{formatCurrency(selectedPayoutRow.seller.amount + selectedPayoutRow.affiliate.amount + selectedPayoutRow.influencer.amount)}</span></div>
                                            </div>
                                          </div>

                                          <div className="rounded-lg border border-white/80 bg-white p-4">
                                            <h3 className="font-semibold text-gray-900">Tracking And Addresses</h3>
                                            <div className="mt-4 space-y-2 text-sm text-gray-700">
                                              <div>Order ID: <span className="font-mono">{selectedPayoutRow.order_id}</span></div>
                                              <div>Order Number: {selectedPayoutRow.order_number || '-'}</div>
                                              <div>Payment status: {selectedPayoutRow.payment_status}</div>
                                              <div>Fulfillment status: {selectedPayoutRow.fulfillment_status}</div>
                                              <div>Tracking number: {selectedPayoutDetail?.order?.tracking_number || '-'}</div>
                                              <div>Tracking URL: {selectedPayoutDetail?.order?.tracking_url || '-'}</div>
                                            </div>
                                            {formatAddressLines(selectedPayoutDetail?.order?.shipping_address || null).length ? (
                                              <div className="mt-4 rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
                                                <div className="font-semibold text-gray-900">Shipping Address</div>
                                                <div className="mt-2 space-y-1">
                                                  {formatAddressLines(selectedPayoutDetail?.order?.shipping_address || null).map((line) => (
                                                    <div key={line}>{line}</div>
                                                  ))}
                                                </div>
                                              </div>
                                            ) : null}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })()
                              ) : selectedPayoutDetail ? (
                                <div className="rounded-lg border border-white/80 bg-white p-4 text-sm text-gray-700">
                                  <div className="font-semibold text-gray-900">Order loaded, but the cached sales ledger row is outside the current filter set.</div>
                                  <div className="mt-2">Order ID: <span className="font-mono">{selectedPayoutDetail.order.id}</span></div>
                                  <div>Buyer: {selectedPayoutDetail.order.buyer?.name || '-'} ({selectedPayoutDetail.order.buyer?.email || 'No buyer email'})</div>
                                  <div>Seller: {selectedPayoutDetail.order.seller?.name || '-'} ({selectedPayoutDetail.order.seller?.email || 'No seller email'})</div>
                                  <div>Created: {formatDateTime(selectedPayoutDetail.order.created_at)}</div>
                                  <div className="mt-3 text-gray-500">Change the current ledger filters if you need the payout ledger row and payout totals beside this order detail.</div>
                                </div>
                              ) : null}
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-6 bg-white border rounded-xl overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 text-gray-700 font-semibold">Unified Sales Ledger</div>
            {salesLedgerLoading ? <div className="px-4 py-4 text-sm text-gray-500">Loading sales ledger...</div> : null}
            {salesLedgerError ? <div className="px-4 py-4 text-sm text-red-600">{salesLedgerError}</div> : null}
            {!salesLedgerLoading && !salesLedgerError && salesLedger ? (
              <>
                <div className="border-b bg-white px-4 py-4">
                  <div className="grid grid-cols-1 gap-3 xl:grid-cols-4">
                    <label className="text-sm text-gray-700">
                      <div className="mb-1 font-medium">Search Order Or Person</div>
                      <input
                        type="text"
                        value={ledgerSearch}
                        onChange={(event) => setLedgerSearch(event.target.value)}
                        placeholder="Order, buyer, seller, affiliate, influencer, email"
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      />
                    </label>
                    <label className="text-sm text-gray-700">
                      <div className="mb-1 font-medium">Scheduled Payday Filter</div>
                      <select
                        value={ledgerPayoutDateFilter}
                        onChange={(event) => setLedgerPayoutDateFilter(event.target.value as 'all' | 'due_by_selected' | 'exact_selected')}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      >
                        <option value="all">All ledger rows</option>
                        <option value="due_by_selected">Due on or before {payoutDate}</option>
                        <option value="exact_selected">Due exactly on {payoutDate}</option>
                      </select>
                    </label>
                    <label className="text-sm text-gray-700">
                      <div className="mb-1 font-medium">Role Focus</div>
                      <select
                        value={ledgerRoleFilter}
                        onChange={(event) => setLedgerRoleFilter(event.target.value as 'all' | 'seller' | 'affiliate' | 'influencer' | 'buyer')}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      >
                        <option value="all">All roles</option>
                        <option value="buyer">Buyer</option>
                        <option value="seller">Seller</option>
                        <option value="affiliate">Affiliate</option>
                        <option value="influencer">Influencer</option>
                      </select>
                    </label>
                    <label className="text-sm text-gray-700">
                      <div className="mb-1 font-medium">Payout Status</div>
                      <select
                        value={ledgerStatusFilter}
                        onChange={(event) => setLedgerStatusFilter(event.target.value as 'all' | 'ready' | 'paid' | 'held' | 'problem')}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      >
                        <option value="all">All statuses</option>
                        <option value="ready">Ready / pending</option>
                        <option value="paid">Paid</option>
                        <option value="held">Held</option>
                        <option value="problem">Problem rows</option>
                      </select>
                    </label>
                  </div>
                  <div className="mt-3 text-xs text-gray-500">
                    Showing {filteredSalesLedgerRows.length} of {salesLedger.rows.length} ledger rows.
                  </div>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-3 p-4 border-b bg-gray-50/60">
                  <div>
                    <div className="text-xs text-gray-500 uppercase tracking-wide">Orders</div>
                    <div className="text-lg font-semibold text-gray-900">{salesLedger.summary.orders}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 uppercase tracking-wide">Gross</div>
                    <div className="text-lg font-semibold text-gray-900">${Number(salesLedger.summary.gross_sales || 0).toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 uppercase tracking-wide">Seller</div>
                    <div className="text-lg font-semibold text-gray-900">${Number(salesLedger.summary.seller_payouts || 0).toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 uppercase tracking-wide">Affiliate</div>
                    <div className="text-lg font-semibold text-gray-900">${Number(salesLedger.summary.affiliate_payouts || 0).toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 uppercase tracking-wide">Influencer</div>
                    <div className="text-lg font-semibold text-gray-900">${Number(salesLedger.summary.influencer_payouts || 0).toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 uppercase tracking-wide">Beezio</div>
                    <div className="text-lg font-semibold text-gray-900">${Number(salesLedger.summary.beezio_fee || 0).toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 uppercase tracking-wide">PayPal Fee</div>
                    <div className="text-lg font-semibold text-gray-900">${Number(salesLedger.summary.paypal_fee || 0).toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 uppercase tracking-wide">Sales Tax</div>
                    <div className="text-lg font-semibold text-gray-900">${Number(salesLedger.summary.sales_tax || 0).toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 uppercase tracking-wide">Shipping</div>
                    <div className="text-lg font-semibold text-gray-900">${Number(salesLedger.summary.shipping || 0).toFixed(2)}</div>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-600 border-t">
                      <tr>
                        <th className="text-left px-4 py-3">Order</th>
                        <th className="text-left px-4 py-3">Products</th>
                        <th className="text-left px-4 py-3">Buyer</th>
                        <th className="text-left px-4 py-3">Seller</th>
                        <th className="text-left px-4 py-3">Affiliate</th>
                        <th className="text-left px-4 py-3">Influencer</th>
                        <th className="text-right px-4 py-3">Gross</th>
                        <th className="text-right px-4 py-3">Seller</th>
                        <th className="text-right px-4 py-3">Affiliate</th>
                        <th className="text-right px-4 py-3">Influencer</th>
                        <th className="text-right px-4 py-3">Beezio</th>
                        <th className="text-right px-4 py-3">PayPal</th>
                        <th className="text-right px-4 py-3">Tax</th>
                        <th className="text-left px-4 py-3">Statuses</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSalesLedgerRows.length === 0 ? (
                        <tr className="border-t">
                          <td className="px-4 py-5 text-sm text-gray-500 text-center" colSpan={14}>
                            No ledger rows match the current filters.
                          </td>
                        </tr>
                      ) : (
                        filteredSalesLedgerRows.map((row) => (
                          <tr key={row.order_id} className="border-t align-top">
                            <td className="px-4 py-3 text-xs">
                              <div className="font-semibold text-gray-900">{row.order_number || row.order_id}</div>
                              <div className="font-mono text-gray-500">{row.order_id}</div>
                              <div className="text-gray-500">{row.created_at ? new Date(row.created_at).toLocaleString() : '-'}</div>
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-700">
                              <div>{row.products.slice(0, 2).join(', ') || '-'}</div>
                              <div className="text-gray-500 mt-1">Qty {row.quantity}</div>
                              {row.products.length > 2 ? <div className="text-gray-500">+{row.products.length - 2} more</div> : null}
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-700">
                              <div>{row.buyer_name || '-'}</div>
                              <div className="text-gray-500">{row.buyer_email || '-'}</div>
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-700">
                              <div>{row.seller.name}</div>
                              <div className="text-gray-500">{row.seller.email || row.seller.id || '-'}</div>
                              <div className="text-gray-400">PayPal: {row.seller.paypal_email || '-'}</div>
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-700">
                              <div>{row.affiliate.amount > 0 ? row.affiliate.name : '-'}</div>
                              <div className="text-gray-500">{row.affiliate.amount > 0 ? (row.affiliate.email || row.affiliate.id || '-') : ''}</div>
                              {row.affiliate.amount > 0 ? <div className="text-gray-400">PayPal: {row.affiliate.paypal_email || '-'}</div> : null}
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-700">
                              {(row.influencers && row.influencers.length > 0 ? row.influencers : [row.influencer]).filter((entry) => Number(entry?.amount || 0) > 0).length > 0 ? (
                                <div className="space-y-2">
                                  {(row.influencers && row.influencers.length > 0 ? row.influencers : [row.influencer])
                                    .filter((entry) => Number(entry?.amount || 0) > 0)
                                    .map((entry, index) => (
                                      <div key={`${row.order_id}-influencer-${entry.id || index}`}>
                                        <div>{entry.name || '-'}</div>
                                        <div className="text-gray-500">{entry.email || entry.id || '-'}</div>
                                        <div className="text-gray-400">PayPal: {entry.paypal_email || '-'}</div>
                                        <div className="text-gray-500">${Number(entry.amount || 0).toFixed(2)}</div>
                                      </div>
                                    ))}
                                </div>
                              ) : (
                                <div>-</div>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right">${Number(row.gross_sales || 0).toFixed(2)}</td>
                            <td className="px-4 py-3 text-right">${Number(row.seller.amount || 0).toFixed(2)}</td>
                            <td className="px-4 py-3 text-right">${Number(row.affiliate.amount || 0).toFixed(2)}</td>
                            <td className="px-4 py-3 text-right">${Number(row.influencer.amount || 0).toFixed(2)}</td>
                            <td className="px-4 py-3 text-right">${Number(row.beezio_fee || 0).toFixed(2)}</td>
                            <td className="px-4 py-3 text-right">${Number(row.paypal_fee || 0).toFixed(2)}</td>
                            <td className="px-4 py-3 text-right">
                              <div>${Number(row.sales_tax || 0).toFixed(2)}</div>
                              <div className="text-xs text-gray-500">Ship ${Number(row.shipping || 0).toFixed(2)}</div>
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-700">
                              <div>Order: {row.order_status}</div>
                              <div>Payment: {row.payment_status}</div>
                              <div>Fulfillment: {row.fulfillment_status}</div>
                              <div>Payout: {row.payout_status}</div>
                              <div>Hold: {row.hold_release_at ? new Date(row.hold_release_at).toLocaleDateString() : '-'}</div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            ) : null}
          </div>

          <div className="mt-6 bg-white border rounded-xl overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 text-gray-700 font-semibold">Recent PayPal Transaction Logs</div>
            {paymentLogsLoading ? <div className="px-4 py-4 text-sm text-gray-500">Loading payment logs...</div> : null}
            {paymentLogsError ? <div className="px-4 py-4 text-sm text-red-600">{paymentLogsError}</div> : null}
            {!paymentLogsLoading && !paymentLogsError ? (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600 border-t">
                  <tr>
                    <th className="text-left px-4 py-3">Created</th>
                    <th className="text-left px-4 py-3">Order</th>
                    <th className="text-left px-4 py-3">Payment</th>
                    <th className="text-right px-4 py-3">Total</th>
                    <th className="text-left px-4 py-3">Provider IDs</th>
                    <th className="text-left px-4 py-3">Buyer Email</th>
                  </tr>
                </thead>
                <tbody>
                  {paymentLogs.length === 0 ? (
                    <tr className="border-t">
                      <td className="px-4 py-5 text-sm text-gray-500 text-center" colSpan={6}>
                        No PayPal transactions logged yet.
                      </td>
                    </tr>
                  ) : (
                    paymentLogs.map((row) => (
                      <tr key={row.id} className="border-t">
                        <td className="px-4 py-3 text-xs text-gray-600">{row.created_at ? new Date(row.created_at).toLocaleString() : ''}</td>
                        <td className="px-4 py-3">{row.status || '-'}</td>
                        <td className="px-4 py-3">{row.payment_status || '-'}</td>
                        <td className="px-4 py-3 text-right">
                          $
                          {Number(
                            row.total_charged != null
                              ? row.total_charged
                              : row.total_amount != null
                                ? row.total_amount
                                : 0
                          ).toFixed(2)}{' '}
                          {row.currency || 'USD'}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          <div>Order: {row.provider_order_id || '-'}</div>
                          <div>Capture: {row.provider_capture_id || '-'}</div>
                        </td>
                        <td className="px-4 py-3 text-xs">{row.billing_email || '-'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            ) : null}
          </div>

          {stats?.recent_batches?.length ? (
            <div className="mt-6 bg-white border rounded-xl overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 text-gray-700 font-semibold">Recent Batches</div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600 border-t">
                  <tr>
                    <th className="text-left px-4 py-3">Batch</th>
                    <th className="text-left px-4 py-3">Status</th>
                    <th className="text-right px-4 py-3">Items</th>
                    <th className="text-right px-4 py-3">Total</th>
                    <th className="text-left px-4 py-3">Created</th>
                    <th className="text-right px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recent_batches.map((b) => (
                    <tr key={b.id} className="border-t">
                      <td className="px-4 py-3">
                        <div className="font-mono text-xs">{b.id}</div>
                        {b.provider_batch_id ? <div className="text-xs text-gray-500">{b.provider_batch_id}</div> : null}
                      </td>
                      <td className="px-4 py-3">{b.status}</td>
                      <td className="px-4 py-3 text-right">{b.item_count}</td>
                      <td className="px-4 py-3 text-right">${Number(b.total_amount || 0).toFixed(2)}</td>
                      <td className="px-4 py-3 text-xs text-gray-600">{new Date(b.created_at).toLocaleString()}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          {String(b.status).toUpperCase() === 'PREPARED' ? (
                            <button
                              type="button"
                              onClick={() => openApprovalCandidate(b)}
                              disabled={Boolean(actionLoading) || Boolean(stats?.env?.payoutsPaused)}
                              className="px-3 py-1 rounded-md bg-amber-600 text-white text-xs font-semibold disabled:opacity-50"
                              title={stats?.env?.payoutsPaused ? 'Payouts are paused by PAYOUTS_PAUSED' : 'Open final confirmation before submitting this prepared batch to PayPal'}
                            >
                              Review Submit
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => syncStatus(b.id)}
                            disabled={Boolean(actionLoading) || !['SUBMITTED', 'PARTIAL', 'PAID', 'FAILED'].includes(String(b.status).toUpperCase())}
                            className="px-3 py-1 rounded-md bg-blue-600 text-white text-xs font-semibold disabled:opacity-50"
                          >
                            Sync
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
