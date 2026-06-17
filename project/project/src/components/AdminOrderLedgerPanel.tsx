import { useEffect, useMemo, useState } from 'react';
import { Calendar, Download, Eye, Mail, RefreshCcw, Search } from 'lucide-react';
import { supabase } from '../lib/supabase';

type TimeFilter = 'day' | 'week' | 'month' | '3mo' | '6mo' | 'year';
type LedgerRangePreset = TimeFilter | 'custom';
type GroupGranularity = 'day' | 'week' | 'month' | 'year';

type Party = {
  id: string | null;
  name: string;
  email: string;
  paypal_email?: string;
  amount: number;
};

type InfluencerPayee = Party & {
  source: 'order_money_ledger' | 'payout_snapshots' | 'legacy';
};

type LedgerRow = {
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
  seller: Party;
  affiliate: Party;
  influencer: Party;
  influencers: InfluencerPayee[];
  beezio_fee: number;
  paypal_fee: number;
  beezio_gross_revenue: number;
  beezio_net_revenue: number;
  sales_tax: number;
  shipping: number;
  gross_sales: number;
  gross_amount?: number;
  payout_status: string;
  payout_created_at: string | null;
  payout_paid_at: string | null;
  hold_release_at: string | null;
  latest_dispute?: {
    id: string;
    dispute_type: string;
    status: string;
    resolution_type: string | null;
    refund_amount: number;
    created_at: string | null;
    updated_at: string | null;
    resolved_at: string | null;
  } | null;
  disputes?: Array<{
    id: string;
    dispute_type: string;
    status: string;
    resolution_type: string | null;
    refund_amount: number;
    created_at: string | null;
    updated_at: string | null;
    resolved_at: string | null;
  }>;
};

type LedgerSummary = {
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

type OrderDetail = {
  order: {
    id: string;
    order_number: string | null;
    provider_order_id: string | null;
    provider_capture_id: string | null;
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
      beezio_operating_profit: number;
      paypal_fee_estimate: number;
      influencer_bonus_pool_total: number;
      influencer_bonus_paid_total: number;
      influencer_bonus_retained_total: number;
      hold_release_at: string | null;
      payout_status: string | null;
    };
    disputes?: Array<{
      id: string;
      dispute_type: string | null;
      status: string | null;
      resolution_type: string | null;
      resolution: string | null;
      refund_amount: number;
      created_at: string | null;
      updated_at: string | null;
      resolved_at: string | null;
    }>;
  };
};

type LedgerResponse = {
  ok?: boolean;
  summary?: LedgerSummary;
  rows?: LedgerRow[];
};

const emptySummary: LedgerSummary = {
  orders: 0,
  real_sales: 0,
  gross_sales: 0,
  seller_payouts: 0,
  affiliate_payouts: 0,
  influencer_payouts: 0,
  beezio_fee: 0,
  paypal_fee: 0,
  beezio_gross_revenue: 0,
  beezio_net_revenue: 0,
  sales_tax: 0,
  shipping: 0,
  refunded_orders: 0,
  refunded_amount: 0,
  disputed_orders: 0,
  open_disputes: 0,
};

const getDateRange = (filter: TimeFilter) => {
  const now = new Date();
  let start: Date;

  switch (filter) {
    case 'day':
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case 'week':
      start = new Date(now);
      start.setDate(now.getDate() - 6);
      break;
    case 'month':
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case '3mo':
      start = new Date(now);
      start.setMonth(now.getMonth() - 2);
      start.setDate(1);
      break;
    case '6mo':
      start = new Date(now);
      start.setMonth(now.getMonth() - 5);
      start.setDate(1);
      break;
    case 'year':
      start = new Date(now.getFullYear(), 0, 1);
      break;
    default:
      start = new Date(2000, 0, 1);
  }

  return { start, end: now };
};

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(Number(amount || 0));
};

const formatDateTime = (value: string | null | undefined) => {
  if (!value) return 'Not available';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not available';
  return date.toLocaleString();
};

const formatDateInputValue = (value: Date) => value.toISOString().slice(0, 10);

const csvEscape = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;

const createBeezioParty = (): Party => ({
  id: null,
  name: 'Beezio',
  email: '',
  paypal_email: undefined,
  amount: 0,
});

const resolveInfluencerSlots = (row: LedgerRow | null | undefined): [InfluencerPayee | Party, InfluencerPayee | Party] => {
  const slots = (row?.influencers?.length ? row.influencers : row?.influencer ? [row.influencer] : []).slice(0, 2);
  while (slots.length < 2) slots.push(createBeezioParty());
  return [slots[0], slots[1]];
};

const buildPeriodKey = (value: string | null | undefined, granularity: GroupGranularity) => {
  if (!value) return 'Unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';

  if (granularity === 'day') return date.toISOString().slice(0, 10);

  if (granularity === 'month') {
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
  }

  if (granularity === 'year') return String(date.getUTCFullYear());

  const utcDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil((((utcDate.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${utcDate.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
};

const summarizeRows = (rows: LedgerRow[]): LedgerSummary => {
  return rows.reduce<LedgerSummary>((acc, row) => {
    acc.orders += 1;
    acc.real_sales += row.is_refunded ? 0 : 1;
    acc.gross_sales += Number(row.gross_sales || row.gross_amount || 0);
    acc.seller_payouts += Number(row.seller?.amount || 0);
    acc.affiliate_payouts += Number(row.affiliate?.amount || 0);
    acc.influencer_payouts += Number(row.influencer?.amount || 0);
    acc.beezio_fee += Number(row.beezio_fee || 0);
    acc.paypal_fee += Number(row.paypal_fee || 0);
    acc.beezio_gross_revenue += Number(row.beezio_gross_revenue || 0);
    acc.beezio_net_revenue += Number(row.beezio_net_revenue || 0);
    acc.sales_tax += Number(row.sales_tax || 0);
    acc.shipping += Number(row.shipping || 0);
    acc.refunded_orders += row.is_refunded ? 1 : 0;
    acc.refunded_amount += Number(row.refunded_amount || 0);
    acc.disputed_orders += row.dispute_status && row.dispute_status !== 'NONE' ? 1 : 0;
    acc.open_disputes += row.dispute_status === 'OPEN' ? 1 : 0;
    return acc;
  }, { ...emptySummary });
};

const getDisputeTone = (status: string | null | undefined) => {
  const normalized = String(status || '').toUpperCase();
  if (normalized === 'OPEN' || normalized === 'INVESTIGATING' || normalized === 'AWAITING_RESPONSE') {
    return 'border-amber-200 bg-amber-50 text-amber-800';
  }
  if (normalized === 'WON' || normalized === 'LOST' || normalized === 'RESOLVED' || normalized === 'CLOSED') {
    return 'border-slate-200 bg-slate-50 text-slate-700';
  }
  return 'border-gray-200 bg-gray-50 text-gray-600';
};

const formatAddressLines = (address: Record<string, unknown> | null | undefined) => {
  if (!address || typeof address !== 'object') return [] as string[];

  const candidates = [
    address.name,
    [address.address1, address.address2].filter(Boolean).join(' '),
    [address.city, address.state, address.postalCode || address.zip].filter(Boolean).join(', '),
    address.country,
    address.phone,
  ];

  return candidates
    .map((value) => String(value || '').trim())
    .filter(Boolean);
};

export default function AdminOrderLedgerPanel({ defaultPreset = 'month' }: { defaultPreset?: TimeFilter }) {
  const [preset, setPreset] = useState<LedgerRangePreset>(defaultPreset);
  const [customStart, setCustomStart] = useState(() => formatDateInputValue(getDateRange(defaultPreset).start));
  const [customEnd, setCustomEnd] = useState(() => formatDateInputValue(getDateRange(defaultPreset).end));
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [summary, setSummary] = useState<LedgerSummary>(emptySummary);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<OrderDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [refundAmountInput, setRefundAmountInput] = useState('');
  const [refundReason, setRefundReason] = useState('Admin refund');
  const [refundLoading, setRefundLoading] = useState(false);
  const [refundStatus, setRefundStatus] = useState<string | null>(null);
  const [groupGranularity, setGroupGranularity] = useState<GroupGranularity>('day');
  const [page, setPage] = useState(1);
  const pageSize = 25;

  useEffect(() => {
    setCustomStart(formatDateInputValue(getDateRange(defaultPreset).start));
    setCustomEnd(formatDateInputValue(getDateRange(defaultPreset).end));
    setPreset((current) => (current === 'custom' ? current : defaultPreset));
  }, [defaultPreset]);

  const resolvedRange = useMemo(() => {
    if (preset === 'custom') {
      return {
        start: customStart ? new Date(`${customStart}T00:00:00.000Z`) : null,
        end: customEnd ? new Date(`${customEnd}T23:59:59.999Z`) : null,
      };
    }

    const { start, end } = getDateRange(preset);
    return { start, end };
  }, [customEnd, customStart, preset]);

  const fetchLedger = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: sessionData } = await supabase.auth.getSession();
      const token = String(sessionData?.session?.access_token || '').trim();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch('/api/admin-sales-ledger', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          limit: 5000,
          start_date: resolvedRange.start?.toISOString() || null,
          end_date: resolvedRange.end?.toISOString() || null,
          search,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as LedgerResponse & { error?: string };
      if (!response.ok) throw new Error(String(payload?.error || 'Failed to load admin order ledger'));

      const nextRows = Array.isArray(payload?.rows) ? payload.rows : [];
      setRows(nextRows);
      setSummary(payload?.summary || summarizeRows(nextRows));
      setPage(1);

      if (selectedOrderId && !nextRows.some((row) => row.order_id === selectedOrderId)) {
        setSelectedOrderId(null);
        setSelectedDetail(null);
        setDetailError(null);
        setRefundStatus(null);
      }
    } catch (fetchError: any) {
      setRows([]);
      setSummary(emptySummary);
      setError(fetchError?.message || 'Failed to load admin order ledger.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchLedger();
  }, [resolvedRange.end, resolvedRange.start, search]);

  const selectedRow = useMemo(
    () => rows.find((row) => row.order_id === selectedOrderId) || null,
    [rows, selectedOrderId]
  );

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedRows = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return rows.slice(startIndex, startIndex + pageSize);
  }, [currentPage, rows]);

  const groupedRows = useMemo(() => {
    const bucketMap = new Map<string, LedgerSummary>();

    rows.forEach((row) => {
      const key = buildPeriodKey(row.created_at, groupGranularity);
      const current = bucketMap.get(key) || { ...emptySummary };
      current.orders += 1;
      current.real_sales += row.is_refunded ? 0 : 1;
      current.gross_sales += Number(row.gross_sales || row.gross_amount || 0);
      current.seller_payouts += Number(row.seller?.amount || 0);
      current.affiliate_payouts += Number(row.affiliate?.amount || 0);
      current.influencer_payouts += Number(row.influencer?.amount || 0);
      current.beezio_fee += Number(row.beezio_fee || 0);
      current.paypal_fee += Number(row.paypal_fee || 0);
      current.beezio_gross_revenue += Number(row.beezio_gross_revenue || 0);
      current.beezio_net_revenue += Number(row.beezio_net_revenue || 0);
      current.sales_tax += Number(row.sales_tax || 0);
      current.shipping += Number(row.shipping || 0);
      current.refunded_orders += row.is_refunded ? 1 : 0;
      current.refunded_amount += Number(row.refunded_amount || 0);
      current.disputed_orders += row.dispute_status && row.dispute_status !== 'NONE' ? 1 : 0;
      current.open_disputes += row.dispute_status === 'OPEN' ? 1 : 0;
      bucketMap.set(key, current);
    });

    return Array.from(bucketMap.entries())
      .sort((left, right) => left[0].localeCompare(right[0]))
      .map(([period, totals]) => ({ period, ...totals }));
  }, [groupGranularity, rows]);

  const exportCsv = () => {
    const exportRows = rows.map((row) => {
      const [influencerOne, influencerTwo] = resolveInfluencerSlots(row);
      return { row, influencerOne, influencerTwo };
    });
    const headers = [
      'order_id',
      'order_number',
      'provider_order_id',
      'created_at',
      'buyer_name',
      'buyer_email',
      'seller_name',
      'seller_email',
      'affiliate_name',
      'affiliate_email',
      'influencer_1_name',
      'influencer_1_email',
      'influencer_2_name',
      'influencer_2_email',
      'gross_sales',
      'seller_payout',
      'affiliate_payout',
      'influencer_payout',
      'beezio_fee',
      'paypal_fee',
      'beezio_gross_revenue',
      'beezio_net_revenue',
      'sales_tax',
      'shipping',
      'dispute_status',
      'refunded_amount',
      'order_status',
      'payment_status',
      'fulfillment_status',
      'payout_status',
    ];

    const lines = [
      headers.join(','),
      ...exportRows.map(({ row, influencerOne, influencerTwo }) => [
        row.order_id,
        row.order_number || '',
        row.provider_order_id || '',
        row.created_at || '',
        row.buyer_name,
        row.buyer_email,
        row.seller?.name || '',
        row.seller?.email || '',
        row.affiliate?.name || '',
        row.affiliate?.email || '',
        influencerOne?.name || '',
        influencerOne?.email || '',
        influencerTwo?.name || '',
        influencerTwo?.email || '',
        row.gross_sales,
        row.seller?.amount || 0,
        row.affiliate?.amount || 0,
        row.influencer?.amount || 0,
        row.beezio_fee,
        row.paypal_fee,
        row.beezio_gross_revenue || 0,
        row.beezio_net_revenue || 0,
        row.sales_tax,
        row.shipping,
        row.dispute_status,
        row.refunded_amount,
        row.order_status,
        row.payment_status,
        row.fulfillment_status,
        row.payout_status,
      ].map(csvEscape).join(',')),
    ];

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const downloadUrl = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = downloadUrl;
    anchor.download = `beezio-admin-order-ledger-${preset}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.URL.revokeObjectURL(downloadUrl);
  };

  const loadOrderDetail = async (row: LedgerRow) => {
    try {
      setSelectedOrderId(row.order_id);
      setSelectedDetail(null);
      setDetailError(null);
      setDetailLoading(true);

      const { data: sessionData } = await supabase.auth.getSession();
      const token = String(sessionData?.session?.access_token || '').trim();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`/api/order-details?id=${encodeURIComponent(row.order_id)}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const payload = (await response.json().catch(() => ({}))) as OrderDetail & { error?: string };
      if (!response.ok) throw new Error(String(payload?.error || 'Failed to load order details'));
      setSelectedDetail(payload);
      setRefundStatus(null);
      setRefundAmountInput('');
    } catch (loadError: any) {
      setDetailError(loadError?.message || 'Failed to load order details.');
    } finally {
      setDetailLoading(false);
    }
  };

  const issueRefund = async () => {
    if (!selectedRow) return;

    const referenceId =
      String(selectedDetail?.order?.provider_capture_id || '').trim() ||
      String(selectedDetail?.order?.provider_order_id || '').trim() ||
      String(selectedRow.provider_order_id || '').trim() ||
      String(selectedRow.order_id || '').trim();

    if (!referenceId) {
      setRefundStatus('No PayPal capture, PayPal order, or Beezio order reference is available for this refund.');
      return;
    }

    const enteredAmount = Number(refundAmountInput || 0);
    const amount = Number.isFinite(enteredAmount) && enteredAmount > 0 ? enteredAmount : undefined;
    const reason = String(refundReason || '').trim() || 'Admin refund';
    const confirmed = window.confirm(
      `Refund ${selectedRow.order_number || selectedRow.order_id} using ${referenceId}${amount ? ` for ${formatCurrency(amount)}` : ' for the full amount'}?`
    );

    if (!confirmed) return;

    try {
      setRefundLoading(true);
      setRefundStatus('Processing refund...');

      const { data: sessionData } = await supabase.auth.getSession();
      const token = String(sessionData?.session?.access_token || '').trim();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch('/.netlify/functions/refund-payment-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          orderId: String(selectedRow.order_id || '').trim() || undefined,
          providerCaptureId: String(selectedDetail?.order?.provider_capture_id || '').trim() || undefined,
          providerOrderId:
            String(selectedDetail?.order?.provider_order_id || '').trim() ||
            String(selectedRow.provider_order_id || '').trim() ||
            undefined,
          referenceId,
          amount,
          reason,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as { ok?: boolean; refundId?: string; error?: string; details?: string };
      if (!response.ok) throw new Error(String(payload?.error || payload?.details || 'Refund failed'));

      setRefundStatus(`Refund submitted${payload?.refundId ? ` (${payload.refundId})` : ''}.`);
      await Promise.all([fetchLedger(), loadOrderDetail(selectedRow)]);
    } catch (refundError: any) {
      setRefundStatus(refundError?.message || 'Refund failed.');
    } finally {
      setRefundLoading(false);
    }
  };

  const applySearch = () => {
    setSearch(searchInput.trim());
  };

  const mailActions = [
    {
      key: 'buyer',
      label: 'Email Buyer',
      email: selectedDetail?.order?.buyer?.email || selectedRow?.buyer_email || '',
    },
    {
      key: 'seller',
      label: 'Email Seller',
      email: selectedDetail?.order?.seller?.email || selectedRow?.seller?.email || '',
    },
    {
      key: 'affiliate',
      label: 'Email Affiliate',
      email: selectedRow?.affiliate?.email || '',
    },
    {
      key: 'influencer-1',
      label: 'Email Influencer 1',
      email: resolveInfluencerSlots(selectedRow)[0]?.email || '',
    },
    {
      key: 'influencer-2',
      label: 'Email Influencer 2',
      email: resolveInfluencerSlots(selectedRow)[1]?.email || '',
    },
  ].filter((entry) => entry.email);

  const addressLines = formatAddressLines(selectedDetail?.order?.shipping_address || selectedRow?.shipping_address);

  return (
    <div className="space-y-6">
      <section className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-semibold text-gray-900">Order Ledger</h3>
            <p className="mt-1 text-sm text-gray-600">
              Search every recorded sale by order number, buyer email, seller email, customer name, or seller name. Review payouts, fees, profit, statuses, and click into the full order record.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => void fetchLedger()}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              <RefreshCcw className="h-4 w-4" />
              Refresh
            </button>
            <button
              onClick={exportCsv}
              disabled={rows.length === 0}
              className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </button>
          </div>
        </div>

        <div className="mt-6 space-y-4 rounded-xl border border-amber-100 bg-amber-50/50 p-4">
          <div className="flex flex-wrap gap-2">
            {(['day', 'week', 'month', '3mo', '6mo', 'year', 'custom'] as LedgerRangePreset[]).map((option) => (
              <button
                key={option}
                onClick={() => setPreset(option)}
                className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                  preset === option
                    ? 'bg-amber-600 text-white'
                    : 'bg-white text-gray-700 border border-amber-200 hover:bg-amber-100'
                }`}
              >
                {option === '3mo' ? '3 Months' : option === '6mo' ? '6 Months' : option === 'custom' ? 'Custom' : option.charAt(0).toUpperCase() + option.slice(1)}
              </button>
            ))}
          </div>

          {preset === 'custom' && (
            <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
              <label className="text-sm text-gray-700">
                <span className="mb-1 block font-medium">Start date</span>
                <input
                  type="date"
                  value={customStart}
                  onChange={(event) => setCustomStart(event.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                />
              </label>
              <label className="text-sm text-gray-700">
                <span className="mb-1 block font-medium">End date</span>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(event) => setCustomEnd(event.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                />
              </label>
              <div className="flex items-end">
                <div className="inline-flex w-full items-center gap-2 rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm text-gray-600">
                  <Calendar className="h-4 w-4" />
                  {customStart || 'Start'} to {customEnd || 'End'}
                </div>
              </div>
            </div>
          )}

          <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
            <label className="text-sm text-gray-700">
              <span className="mb-1 block font-medium">Search orders</span>
              <div className="flex items-center rounded-lg border border-gray-300 bg-white px-3 py-2">
                <Search className="mr-2 h-4 w-4 text-gray-400" />
                <input
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') applySearch();
                  }}
                  placeholder="Order number, seller email, customer email, seller name, customer name"
                  className="w-full bg-transparent text-sm text-gray-900 outline-none"
                />
              </div>
            </label>
            <div className="flex items-end gap-2">
              <button
                onClick={applySearch}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Apply Search
              </button>
              {search && (
                <button
                  onClick={() => {
                    setSearchInput('');
                    setSearch('');
                  }}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-white"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-lg bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Orders</div>
          <div className="mt-2 text-2xl font-bold text-gray-900">{summary.orders}</div>
          <div className="mt-1 text-sm text-gray-500">Records in the selected range</div>
        </div>
        <div className="rounded-lg bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Real Sales</div>
          <div className="mt-2 text-2xl font-bold text-emerald-800">{summary.real_sales}</div>
          <div className="mt-1 text-sm text-gray-500">Paid sales not later refunded</div>
        </div>
        <div className="rounded-lg bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Gross Sales</div>
          <div className="mt-2 text-2xl font-bold text-emerald-700">{formatCurrency(summary.gross_sales)}</div>
          <div className="mt-1 text-sm text-gray-500">Total customer charges</div>
        </div>
        <div className="rounded-lg bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Seller Payouts</div>
          <div className="mt-2 text-2xl font-bold text-blue-700">{formatCurrency(summary.seller_payouts)}</div>
          <div className="mt-1 text-sm text-gray-500">What sellers earned</div>
        </div>
        <div className="rounded-lg bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Affiliate + Influencer</div>
          <div className="mt-2 text-2xl font-bold text-violet-700">
            {formatCurrency(summary.affiliate_payouts + summary.influencer_payouts)}
          </div>
          <div className="mt-1 text-sm text-gray-500">Partner payouts and creator payouts</div>
        </div>
        <div className="rounded-lg bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Beezio Profit</div>
          <div className="mt-2 text-2xl font-bold text-amber-700">{formatCurrency(summary.beezio_fee)}</div>
          <div className="mt-1 text-sm text-gray-500">Platform margin before PayPal fees</div>
        </div>
        <div className="rounded-lg bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Beezio Gross Revenue</div>
          <div className="mt-2 text-2xl font-bold text-sky-800">{formatCurrency(summary.beezio_gross_revenue)}</div>
          <div className="mt-1 text-sm text-gray-500">Customer charge share after non-Beezio money is removed</div>
        </div>
        <div className="rounded-lg bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">PayPal Fees</div>
          <div className="mt-2 text-2xl font-bold text-rose-700">{formatCurrency(summary.paypal_fee)}</div>
          <div className="mt-1 text-sm text-gray-500">Processor costs</div>
        </div>
        <div className="rounded-lg bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Sales Tax</div>
          <div className="mt-2 text-2xl font-bold text-slate-900">{formatCurrency(summary.sales_tax)}</div>
          <div className="mt-1 text-sm text-gray-500">Tax collected</div>
        </div>
        <div className="rounded-lg bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Shipping</div>
          <div className="mt-2 text-2xl font-bold text-slate-900">{formatCurrency(summary.shipping)}</div>
          <div className="mt-1 text-sm text-gray-500">Shipping charged</div>
        </div>
        <div className="rounded-lg bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Net After PayPal</div>
          <div className="mt-2 text-2xl font-bold text-emerald-800">{formatCurrency(summary.beezio_net_revenue)}</div>
          <div className="mt-1 text-sm text-gray-500">Beezio gross revenue less PayPal fees</div>
        </div>
        <div className="rounded-lg bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Average Order</div>
          <div className="mt-2 text-2xl font-bold text-gray-900">
            {formatCurrency(summary.orders ? summary.gross_sales / summary.orders : 0)}
          </div>
          <div className="mt-1 text-sm text-gray-500">Gross sales divided by orders</div>
        </div>
        <div className="rounded-lg bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Refunded Orders</div>
          <div className="mt-2 text-2xl font-bold text-rose-700">{summary.refunded_orders}</div>
          <div className="mt-1 text-sm text-gray-500">Orders with refund outcomes</div>
        </div>
        <div className="rounded-lg bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Refund Amount</div>
          <div className="mt-2 text-2xl font-bold text-rose-700">{formatCurrency(summary.refunded_amount)}</div>
          <div className="mt-1 text-sm text-gray-500">Resolved dispute refunds</div>
        </div>
        <div className="rounded-lg bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Disputed Orders</div>
          <div className="mt-2 text-2xl font-bold text-amber-700">{summary.disputed_orders}</div>
          <div className="mt-1 text-sm text-gray-500">Orders with dispute activity</div>
        </div>
        <div className="rounded-lg bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Open Disputes</div>
          <div className="mt-2 text-2xl font-bold text-amber-700">{summary.open_disputes}</div>
          <div className="mt-1 text-sm text-gray-500">Cases still active</div>
        </div>
      </section>

      <section className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="text-lg font-semibold text-gray-900">Grouped Metrics</h4>
            <p className="text-sm text-gray-600">Study performance by day, week, month, or year inside the active range.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(['day', 'week', 'month', 'year'] as GroupGranularity[]).map((option) => (
              <button
                key={option}
                onClick={() => setGroupGranularity(option)}
                className={`rounded-lg px-3 py-2 text-sm font-semibold ${
                  groupGranularity === option
                    ? 'bg-slate-900 text-white'
                    : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                {option.charAt(0).toUpperCase() + option.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="px-3 py-3">Period</th>
                <th className="px-3 py-3">Orders</th>
                <th className="px-3 py-3">Real Sales</th>
                <th className="px-3 py-3">Gross</th>
                <th className="px-3 py-3">Seller</th>
                <th className="px-3 py-3">Affiliate</th>
                <th className="px-3 py-3">Influencer</th>
                <th className="px-3 py-3">Beezio Gross</th>
                <th className="px-3 py-3">PayPal</th>
                <th className="px-3 py-3">Beezio Net</th>
                <th className="px-3 py-3">Refunds</th>
                <th className="px-3 py-3">Disputes</th>
              </tr>
            </thead>
            <tbody>
              {groupedRows.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-3 py-8 text-center text-gray-500">
                    {loading ? 'Loading grouped metrics...' : 'No orders in this range.'}
                  </td>
                </tr>
              ) : (
                groupedRows.map((bucket) => (
                  <tr key={bucket.period} className="border-b border-gray-100 align-top">
                    <td className="px-3 py-3 font-medium text-gray-900">{bucket.period}</td>
                    <td className="px-3 py-3 text-gray-700">{bucket.orders}</td>
                    <td className="px-3 py-3 text-emerald-700">{bucket.real_sales}</td>
                    <td className="px-3 py-3 font-medium text-gray-900">{formatCurrency(bucket.gross_sales)}</td>
                    <td className="px-3 py-3 text-gray-700">{formatCurrency(bucket.seller_payouts)}</td>
                    <td className="px-3 py-3 text-gray-700">{formatCurrency(bucket.affiliate_payouts)}</td>
                    <td className="px-3 py-3 text-gray-700">{formatCurrency(bucket.influencer_payouts)}</td>
                    <td className="px-3 py-3 text-sky-700">{formatCurrency(bucket.beezio_gross_revenue)}</td>
                    <td className="px-3 py-3 text-rose-700">{formatCurrency(bucket.paypal_fee)}</td>
                    <td className="px-3 py-3 text-emerald-700">{formatCurrency(bucket.beezio_net_revenue)}</td>
                    <td className="px-3 py-3 text-rose-700">{formatCurrency(bucket.refunded_amount)}</td>
                    <td className="px-3 py-3 text-amber-700">{bucket.open_disputes} open / {bucket.disputed_orders} total</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="text-lg font-semibold text-gray-900">Order Records</h4>
            <p className="text-sm text-gray-600">{rows.length} orders matched the active filters. Showing page {currentPage} of {totalPages}.</p>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <button
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={currentPage <= 1}
              className="rounded-lg border border-gray-300 px-3 py-2 font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>
            <span className="rounded-lg border border-gray-200 px-3 py-2 text-gray-600">{currentPage} / {totalPages}</span>
            <button
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              disabled={currentPage >= totalPages}
              className="rounded-lg border border-gray-300 px-3 py-2 font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="px-3 py-3">Order</th>
                <th className="px-3 py-3">Buyer</th>
                <th className="px-3 py-3">Seller</th>
                <th className="px-3 py-3">Gross</th>
                <th className="px-3 py-3">Payouts</th>
                <th className="px-3 py-3">Platform</th>
                <th className="px-3 py-3">Dates</th>
                <th className="px-3 py-3">Statuses</th>
                <th className="px-3 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-10 text-center text-gray-500">
                    {loading ? 'Loading orders...' : 'No orders found for this range and search.'}
                  </td>
                </tr>
              ) : (
                pagedRows.map((row) => {
                  const [influencerOne, influencerTwo] = resolveInfluencerSlots(row);
                  return (
                  <tr key={row.order_id} className="border-b border-gray-100 align-top">
                    <td className="px-3 py-3">
                      <div className="font-semibold text-gray-900">{row.order_number || row.order_id.slice(0, 8)}</div>
                      {row.provider_order_id && <div className="text-xs text-gray-500">PayPal: {row.provider_order_id}</div>}
                      <div className="mt-1 text-xs text-gray-500 line-clamp-2">{row.products.join(', ') || 'No items recorded'}</div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="font-medium text-gray-900">{row.buyer_name}</div>
                      <div className="text-xs text-gray-500">{row.buyer_email}</div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="font-medium text-gray-900">{row.seller?.name || '-'}</div>
                      <div className="text-xs text-gray-500">{row.seller?.email || 'No seller email'}</div>
                    </td>
                    <td className="px-3 py-3 font-semibold text-gray-900">{formatCurrency(row.gross_sales || row.gross_amount || 0)}</td>
                    <td className="px-3 py-3 text-xs text-gray-700">
                      <div>Seller: {formatCurrency(row.seller?.amount || 0)}</div>
                      <div>Affiliate: {formatCurrency(row.affiliate?.amount || 0)}</div>
                      <div>Influencer 1: {influencerOne.name} {formatCurrency(Number(influencerOne.amount || 0))}</div>
                      <div>Influencer 2: {influencerTwo.name} {formatCurrency(Number(influencerTwo.amount || 0))}</div>
                    </td>
                    <td className="px-3 py-3 text-xs text-gray-700">
                      <div>Beezio fee: {formatCurrency(row.beezio_fee || 0)}</div>
                      <div>Beezio gross: {formatCurrency(row.beezio_gross_revenue || 0)}</div>
                      <div>PayPal: {formatCurrency(row.paypal_fee || 0)}</div>
                      <div>Beezio net: {formatCurrency(row.beezio_net_revenue || 0)}</div>
                    </td>
                    <td className="px-3 py-3 text-xs text-gray-700">
                      <div>Order: {formatDateTime(row.created_at)}</div>
                      <div>Paid: {formatDateTime(row.paid_at || row.payout_paid_at)}</div>
                      <div>Hold release: {formatDateTime(row.hold_release_at)}</div>
                    </td>
                    <td className="px-3 py-3 text-xs text-gray-700">
                      <div>Order: {row.order_status}</div>
                      <div>Payment: {row.payment_status}</div>
                      <div>Payout: {row.payout_status}</div>
                      {row.is_refunded && <div className="font-semibold text-rose-700">Refunded: {formatCurrency(row.refunded_amount || 0)}</div>}
                      {row.dispute_status && row.dispute_status !== 'NONE' && (
                        <div className="mt-1">
                          <span className={`inline-flex rounded-full border px-2 py-1 font-semibold ${getDisputeTone(row.dispute_status)}`}>
                            Dispute: {row.dispute_status}
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <button
                        onClick={() => void loadOrderDetail(row)}
                        className="inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100"
                      >
                        <Eye className="h-4 w-4" />
                        View Order
                      </button>
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {(selectedRow || detailLoading || detailError) && (
        <section className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h4 className="text-lg font-semibold text-gray-900">
                Order Detail {selectedRow?.order_number ? `for ${selectedRow.order_number}` : ''}
              </h4>
              <p className="text-sm text-gray-600">Full order picture, all tracked dates, party contacts, and fee breakdown.</p>
            </div>
            {mailActions.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {mailActions.map((action) => (
                  <a
                    key={action.key}
                    href={`mailto:${encodeURIComponent(action.email)}`}
                    className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    <Mail className="h-4 w-4" />
                    {action.label}
                  </a>
                ))}
              </div>
            )}
          </div>

          {detailError && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {detailError}
            </div>
          )}

          {detailLoading && <div className="mt-4 text-sm text-gray-500">Loading order detail...</div>}

          {selectedRow && (() => {
            const [influencerOne, influencerTwo] = resolveInfluencerSlots(selectedRow);
            const configuredAffiliateTotal = Number(selectedDetail?.order?.fee_summary?.configured_affiliate_commission_total || 0);
            const appliedAffiliateTotal = Number(selectedDetail?.order?.fee_summary?.applied_affiliate_commission_total || selectedRow.affiliate.amount || 0);
            const retainedAffiliateTotal = Math.max(0, configuredAffiliateTotal - appliedAffiliateTotal);
            const retainedInfluencerTotal = Number(selectedDetail?.order?.fee_summary?.influencer_bonus_retained_total || 0);
            const refundReference =
              String(selectedDetail?.order?.provider_capture_id || '').trim() ||
              String(selectedDetail?.order?.provider_order_id || '').trim() ||
              String(selectedRow.provider_order_id || '').trim() ||
              String(selectedRow.order_id || '').trim();
            const affiliateDisplay = selectedRow.affiliate.id || selectedRow.affiliate.email || selectedRow.affiliate.name
              ? selectedRow.affiliate
              : {
                  id: null,
                  name: 'Beezio',
                  email: 'Beezio retained this amount',
                  paypal_email: 'Beezio',
                  amount: retainedAffiliateTotal,
                };
            const influencerOneDisplay = influencerOne.name !== 'Beezio' || Number(influencerOne.amount || 0) > 0
              ? influencerOne
              : {
                  ...influencerOne,
                  name: 'Beezio',
                  email: retainedInfluencerTotal > 0 ? 'Beezio retained this amount' : 'Beezio',
                  paypal_email: 'Beezio',
                  amount: retainedInfluencerTotal > 0 ? retainedInfluencerTotal : Number(influencerOne.amount || 0),
                };
            const influencerTwoDisplay = influencerTwo.name !== 'Beezio' || Number(influencerTwo.amount || 0) > 0 || retainedInfluencerTotal <= 0 || influencerOneDisplay.name === 'Beezio'
              ? influencerTwo
              : {
                  ...influencerTwo,
                  name: 'Beezio',
                  email: 'Beezio retained this amount',
                  paypal_email: 'Beezio',
                  amount: retainedInfluencerTotal,
                };
            return (
            <div className="mt-6 space-y-6">
              <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-lg border border-gray-200 p-4">
                  <div className="text-xs uppercase tracking-wide text-gray-500">Order Created</div>
                  <div className="mt-2 text-sm font-semibold text-gray-900">{formatDateTime(selectedRow.created_at)}</div>
                </div>
                <div className="rounded-lg border border-gray-200 p-4">
                  <div className="text-xs uppercase tracking-wide text-gray-500">Updated</div>
                  <div className="mt-2 text-sm font-semibold text-gray-900">{formatDateTime(selectedRow.updated_at)}</div>
                </div>
                <div className="rounded-lg border border-gray-200 p-4">
                  <div className="text-xs uppercase tracking-wide text-gray-500">Paid</div>
                  <div className="mt-2 text-sm font-semibold text-gray-900">{formatDateTime(selectedRow.paid_at || selectedRow.payout_paid_at)}</div>
                </div>
                <div className="rounded-lg border border-gray-200 p-4">
                  <div className="text-xs uppercase tracking-wide text-gray-500">Hold Release</div>
                  <div className="mt-2 text-sm font-semibold text-gray-900">{formatDateTime(selectedRow.hold_release_at)}</div>
                </div>
              </div>

              <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
                <div className="space-y-6">
                  <div className="rounded-lg border border-rose-200 bg-rose-50 p-4">
                    <div className="space-y-4">
                      <div>
                        <h5 className="font-semibold text-gray-900">Refund This Order</h5>
                        <p className="mt-1 text-sm text-gray-700">
                          Beezio will refund the PayPal capture and cancel unpaid payout lines tied to this order.
                        </p>
                        <div className="mt-2 text-xs text-gray-600">
                          PayPal reference: <span className="font-mono text-gray-900">{refundReference || 'Not available'}</span>
                        </div>
                      </div>
                      <div className="grid gap-4 lg:grid-cols-[180px_minmax(0,1fr)]">
                        <label className="text-sm text-gray-700">
                          <div className="mb-1 font-medium">Amount</div>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={refundAmountInput}
                            onChange={(event) => setRefundAmountInput(event.target.value)}
                            placeholder="Full refund"
                            className="w-full rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm"
                          />
                        </label>
                        <label className="text-sm text-gray-700">
                          <div className="mb-1 font-medium">Refund notes</div>
                          <textarea
                            value={refundReason}
                            onChange={(event) => setRefundReason(event.target.value)}
                            rows={7}
                            placeholder="Explain why this refund is being issued. These notes help with disputes and audit history."
                            className="min-h-[180px] w-full rounded-lg border border-rose-200 bg-white px-3 py-3 text-sm leading-6 text-gray-900"
                          />
                        </label>
                        <div className="lg:col-span-2">
                          <button
                            type="button"
                            onClick={() => void issueRefund()}
                            disabled={refundLoading || !refundReference || String(selectedRow.payment_status || '').toLowerCase().includes('refund')}
                            className="inline-flex min-h-[56px] w-full items-center justify-center rounded-lg border border-rose-700 bg-rose-700 px-5 py-3 text-base font-bold text-white shadow-sm transition hover:bg-rose-800 focus:outline-none focus:ring-2 focus:ring-rose-300 disabled:cursor-not-allowed disabled:border-rose-300 disabled:bg-rose-100 disabled:text-rose-500"
                          >
                            {refundLoading ? 'Refunding...' : 'Issue Refund'}
                          </button>
                        </div>
                      </div>
                    </div>
                    {refundStatus ? <div className="mt-3 text-sm text-gray-700">{refundStatus}</div> : null}
                  </div>

                  <div className="rounded-lg border border-gray-200 p-4">
                    <h5 className="font-semibold text-gray-900">Parties</h5>
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <div>
                        <div className="text-xs uppercase tracking-wide text-gray-500">Buyer</div>
                        <div className="mt-1 font-medium text-gray-900">{selectedDetail?.order?.buyer?.name || selectedRow.buyer_name}</div>
                        <div className="text-sm text-gray-600">{selectedDetail?.order?.buyer?.email || selectedRow.buyer_email}</div>
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-wide text-gray-500">Seller</div>
                        <div className="mt-1 font-medium text-gray-900">{selectedDetail?.order?.seller?.name || selectedRow.seller.name}</div>
                        <div className="text-sm text-gray-600">{selectedDetail?.order?.seller?.email || selectedRow.seller.email || 'No seller email'}</div>
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-wide text-gray-500">Affiliate</div>
                        <div className="mt-1 font-medium text-gray-900">{affiliateDisplay.name || 'Beezio'}</div>
                        <div className="text-sm text-gray-600">{affiliateDisplay.email || 'Beezio'}</div>
                        <div className="text-sm text-gray-500">{affiliateDisplay.paypal_email || 'Beezio'}</div>
                        <div className="mt-1 text-sm font-semibold text-blue-700">{formatCurrency(Number(affiliateDisplay.amount || 0))}</div>
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-wide text-gray-500">Influencer 1</div>
                        <div className="mt-1 font-medium text-gray-900">{influencerOneDisplay.name || 'Beezio'}</div>
                        <div className="text-sm text-gray-600">{influencerOneDisplay.email || 'Beezio'}</div>
                        <div className="text-sm text-gray-500">{influencerOneDisplay.paypal_email || 'Beezio'}</div>
                        <div className="mt-1 text-sm font-semibold text-violet-700">{formatCurrency(Number(influencerOneDisplay.amount || 0))}</div>
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-wide text-gray-500">Influencer 2</div>
                        <div className="mt-1 font-medium text-gray-900">{influencerTwoDisplay.name || 'Beezio'}</div>
                        <div className="text-sm text-gray-600">{influencerTwoDisplay.email || 'Beezio'}</div>
                        <div className="text-sm text-gray-500">{influencerTwoDisplay.paypal_email || 'Beezio'}</div>
                        <div className="mt-1 text-sm font-semibold text-violet-700">{formatCurrency(Number(influencerTwoDisplay.amount || 0))}</div>
                      </div>
                    </div>
                    {selectedRow.influencers.length > 0 && (
                      <div className="mt-4 rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
                        <div className="font-semibold text-gray-900">All influencer payees</div>
                        <div className="mt-2 space-y-2">
                          {selectedRow.influencers.map((payee) => (
                            <div key={`${payee.id}-${payee.source}`} className="flex items-center justify-between gap-3">
                              <div>
                                <div className="font-medium text-gray-900">{payee.name}</div>
                                <div className="text-xs text-gray-500">{payee.email || 'No email'} | {payee.paypal_email || 'No PayPal'} | {payee.source}</div>
                              </div>
                              <div className="font-semibold text-gray-900">{formatCurrency(payee.amount)}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="rounded-lg border border-gray-200 p-4">
                    <h5 className="font-semibold text-gray-900">Items</h5>
                    <div className="mt-4 space-y-4">
                      {(selectedDetail?.order?.items || []).map((item) => (
                        <div key={item.id} className="grid gap-4 rounded-lg border border-gray-100 p-4 md:grid-cols-[88px_1fr]">
                          <div className="h-24 w-24 overflow-hidden rounded-lg bg-gray-100">
                            {item.images?.[0] ? (
                              <img src={item.images[0]} alt={item.title} className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-xs text-gray-400">No image</div>
                            )}
                          </div>
                          <div>
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <div className="font-semibold text-gray-900">{item.title}</div>
                                {item.description && <div className="mt-1 text-sm text-gray-600 line-clamp-2">{item.description}</div>}
                              </div>
                              <div className="text-right">
                                <div className="text-sm font-semibold text-gray-900">{formatCurrency(item.line_total)}</div>
                                <div className="text-xs text-gray-500">Qty {item.quantity} at {formatCurrency(item.price)}</div>
                              </div>
                            </div>
                            <div className="mt-3 grid gap-2 text-xs text-gray-600 md:grid-cols-2 xl:grid-cols-3">
                              <div>SKU: {item.sku || 'N/A'}</div>
                              <div>Variant: {item.variant_label || item.variant_sku || 'N/A'}</div>
                              <div>CJ Variant: {item.cj_variant_id || 'N/A'}</div>
                              <div>Seller ask: {formatCurrency(item.seller_ask_amount || 0)}</div>
                              <div>Configured affiliate: {formatCurrency(item.configured_affiliate_commission_amount || 0)}</div>
                              <div>Applied affiliate: {formatCurrency(item.applied_affiliate_commission_amount || 0)}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="rounded-lg border border-gray-200 p-4">
                    <h5 className="font-semibold text-gray-900">Fee Summary</h5>
                    <div className="mt-4 space-y-3 text-sm">
                      <div className="flex items-center justify-between"><span className="text-gray-600">Gross sale</span><span className="font-semibold text-gray-900">{formatCurrency(selectedRow.gross_sales || selectedRow.gross_amount || 0)}</span></div>
                      <div className="flex items-center justify-between"><span className="text-gray-600">Seller payout</span><span className="font-semibold text-gray-900">{formatCurrency(selectedDetail?.order?.fee_summary?.seller_earnings || selectedRow.seller.amount || 0)}</span></div>
                      <div className="flex items-center justify-between"><span className="text-gray-600">Affiliate payout</span><span className="font-semibold text-gray-900">{formatCurrency(selectedDetail?.order?.fee_summary?.applied_affiliate_commission_total || selectedRow.affiliate.amount || 0)}</span></div>
                      <div className="flex items-center justify-between"><span className="text-gray-600">Affiliate retained by Beezio</span><span className="font-semibold text-amber-700">{formatCurrency(retainedAffiliateTotal)}</span></div>
                      <div className="flex items-center justify-between"><span className="text-gray-600">Influencer payout</span><span className="font-semibold text-gray-900">{formatCurrency(selectedDetail?.order?.fee_summary?.influencer_earnings || selectedRow.influencer.amount || 0)}</span></div>
                      <div className="flex items-center justify-between"><span className="text-gray-600">Influencer reserve pool</span><span className="font-semibold text-gray-900">{formatCurrency(selectedDetail?.order?.fee_summary?.influencer_bonus_pool_total || 0)}</span></div>
                      <div className="flex items-center justify-between"><span className="text-gray-600">Unassigned influencer reserve retained</span><span className="font-semibold text-violet-700">{formatCurrency(selectedDetail?.order?.fee_summary?.influencer_bonus_retained_total || 0)}</span></div>
                      <div className="flex items-center justify-between"><span className="text-gray-600">Beezio fee</span><span className="font-semibold text-amber-700">{formatCurrency(selectedDetail?.order?.fee_summary?.beezio_fee_net || selectedRow.beezio_fee || 0)}</span></div>
                      <div className="flex items-center justify-between"><span className="text-gray-600">Beezio gross revenue</span><span className="font-semibold text-sky-700">{formatCurrency(selectedRow.beezio_gross_revenue || 0)}</span></div>
                      <div className="flex items-center justify-between"><span className="text-gray-600">Beezio operating profit</span><span className="font-semibold text-amber-700">{formatCurrency(selectedDetail?.order?.fee_summary?.beezio_operating_profit || 0)}</span></div>
                      <div className="flex items-center justify-between"><span className="text-gray-600">PayPal fee</span><span className="font-semibold text-rose-700">{formatCurrency(selectedRow.paypal_fee || selectedDetail?.order?.fee_summary?.paypal_fee_estimate || 0)}</span></div>
                      <div className="flex items-center justify-between"><span className="text-gray-600">Beezio net after PayPal</span><span className="font-semibold text-emerald-700">{formatCurrency(selectedRow.beezio_net_revenue || 0)}</span></div>
                      <div className="flex items-center justify-between"><span className="text-gray-600">Sales tax</span><span className="font-semibold text-gray-900">{formatCurrency(selectedRow.sales_tax || 0)}</span></div>
                      <div className="flex items-center justify-between"><span className="text-gray-600">Shipping</span><span className="font-semibold text-gray-900">{formatCurrency(selectedRow.shipping || 0)}</span></div>
                      <div className="flex items-center justify-between"><span className="text-gray-600">Refund amount</span><span className="font-semibold text-rose-700">{formatCurrency(selectedRow.refunded_amount || 0)}</span></div>
                      <div className="border-t border-gray-200 pt-3 flex items-center justify-between"><span className="text-gray-700">Assigned influencer payout total</span><span className="font-semibold text-emerald-700">{formatCurrency(selectedDetail?.order?.fee_summary?.influencer_bonus_paid_total || selectedDetail?.order?.fee_summary?.influencer_earnings || 0)}</span></div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-gray-200 p-4">
                    <h5 className="font-semibold text-gray-900">Disputes and Refunds</h5>
                    {((selectedDetail?.order?.disputes || selectedRow.disputes || []).length === 0) ? (
                      <div className="mt-4 text-sm text-gray-500">No disputes recorded for this order.</div>
                    ) : (
                      <div className="mt-4 space-y-3 text-sm">
                        {(selectedDetail?.order?.disputes || selectedRow.disputes || []).map((dispute) => (
                          <div key={dispute.id} className="rounded-lg border border-gray-100 p-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="font-semibold text-gray-900">{dispute.dispute_type || 'Dispute'}</div>
                              <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${getDisputeTone(dispute.status)}`}>
                                {dispute.status || 'unknown'}
                              </span>
                            </div>
                            <div className="mt-2 space-y-1 text-gray-600">
                              <div>Opened: {formatDateTime(dispute.created_at)}</div>
                              <div>Updated: {formatDateTime(dispute.updated_at)}</div>
                              <div>Resolved: {formatDateTime(dispute.resolved_at)}</div>
                              <div>Resolution: {dispute.resolution_type || 'Not resolved'}</div>
                              <div>Refund amount: {formatCurrency(dispute.refund_amount || 0)}</div>
                              {'resolution' in dispute && dispute.resolution ? <div>Notes: {dispute.resolution}</div> : null}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="rounded-lg border border-gray-200 p-4">
                    <h5 className="font-semibold text-gray-900">Shipping and Tracking</h5>
                    <div className="mt-4 space-y-3 text-sm text-gray-700">
                      <div>
                        <div className="text-xs uppercase tracking-wide text-gray-500">Tracking</div>
                        {selectedDetail?.order?.tracking_url || selectedRow.tracking_url ? (
                          <a
                            href={selectedDetail?.order?.tracking_url || selectedRow.tracking_url || '#'}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-1 inline-block font-semibold text-amber-700 hover:text-amber-800"
                          >
                            {selectedDetail?.order?.tracking_number || selectedRow.tracking_number || 'Open tracking'}
                          </a>
                        ) : (
                          <div className="mt-1 text-gray-500">No tracking attached yet.</div>
                        )}
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-wide text-gray-500">Shipping address</div>
                        {addressLines.length === 0 ? (
                          <div className="mt-1 text-gray-500">No shipping address stored.</div>
                        ) : (
                          <div className="mt-1 space-y-1">
                            {addressLines.map((line) => (
                              <div key={line}>{line}</div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            );
          })()}
        </section>
      )}
    </div>
  );
}
