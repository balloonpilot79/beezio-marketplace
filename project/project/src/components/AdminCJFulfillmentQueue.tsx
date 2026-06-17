import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, Package, RefreshCw, Send, Truck } from 'lucide-react';
import { supabase } from '../lib/supabase';

type QueueItem = {
  orderId: string;
  cjOrderNumber: string | null;
  cjOrderId: string | null;
  cjStatus: string | null;
  cjTrackingNumber: string | null;
  cjTrackingUrl: string | null;
  cjLogisticName: string | null;
  cjCost: number | null;
  errorMessage: string | null;
  processAfter: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  paidAt: string | null;
  orderStatus: string | null;
  paymentStatus: string | null;
  fulfillmentStatus: string | null;
  totalCharged: number | null;
  customerName: string | null;
  customerEmail: string | null;
  shippingAddress: Record<string, unknown> | null;
  items: Array<{
    id: string;
    productId: string | null;
    title: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    sku: string | null;
    cjProductId: string | null;
    cjVariantId: string | null;
    imageUrl: string | null;
  }>;
};

type QueueResponse = {
  ok: boolean;
  summary: {
    total: number;
    waitingFunds: number;
    pending: number;
    shipped: number;
    delivered: number;
    errors: number;
  };
  items: QueueItem[];
  error?: string;
};

const formatMoney = (value: number | null | undefined) =>
  typeof value === 'number' && Number.isFinite(value) ? `$${value.toFixed(2)}` : 'N/A';

const formatDateTime = (value: string | null | undefined) => {
  const raw = String(value || '').trim();
  if (!raw) return 'N/A';
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  return parsed.toLocaleString();
};

const formatAddress = (value: Record<string, unknown> | null | undefined) => {
  if (!value || typeof value !== 'object') return 'No shipping address saved';
  const lines = [
    value.name,
    value.address,
    value.address1,
    value.street,
    value.address2,
    [value.city, value.state, value.zip || value.postal_code].filter(Boolean).join(', '),
    value.country,
  ]
    .map((part) => String(part || '').trim())
    .filter(Boolean);

  return lines.join(' | ') || 'No shipping address saved';
};

const getStatusTone = (item: QueueItem) => {
  if (item.errorMessage) return 'border-red-200 bg-red-50 text-red-800';
  const status = String(item.cjStatus || '').toLowerCase();
  if (status === 'waiting_funds') return 'border-amber-200 bg-amber-50 text-amber-900';
  if (status === 'pending' || status === 'processing') return 'border-blue-200 bg-blue-50 text-blue-900';
  if (status === 'shipped') return 'border-indigo-200 bg-indigo-50 text-indigo-900';
  if (status === 'delivered') return 'border-emerald-200 bg-emerald-50 text-emerald-900';
  return 'border-gray-200 bg-gray-50 text-gray-800';
};

export default function AdminCJFulfillmentQueue() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<QueueResponse['summary']>({
    total: 0,
    waitingFunds: 0,
    pending: 0,
    shipped: 0,
    delivered: 0,
    errors: 0,
  });
  const [items, setItems] = useState<QueueItem[]>([]);
  const [dispatchingOrderId, setDispatchingOrderId] = useState<string | null>(null);

  const loadQueue = async (mode: 'initial' | 'refresh' = 'initial') => {
    try {
      if (mode === 'initial') setLoading(true);
      else setRefreshing(true);
      setError(null);

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const response = await fetch('/.netlify/functions/admin-cj-queue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: 'list' }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(String(payload?.error || 'Failed to load CJ queue'));

      setSummary(payload.summary || summary);
      setItems(Array.isArray(payload.items) ? payload.items : []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load CJ queue');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadQueue('initial');
  }, []);

  const handleDispatch = async (orderId: string) => {
    try {
      setDispatchingOrderId(orderId);
      setError(null);
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const response = await fetch('/.netlify/functions/admin-cj-queue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: 'dispatch', orderId }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(String(payload?.error || 'Failed to send order to CJ'));

      setSummary(payload.summary || summary);
      setItems(Array.isArray(payload.items) ? payload.items : items);
    } catch (err: any) {
      setError(err?.message || 'Failed to send order to CJ');
    } finally {
      setDispatchingOrderId(null);
    }
  };

  const attentionCount = useMemo(
    () =>
      items.filter((item) => {
        const status = String(item.cjStatus || '').toLowerCase();
        return Boolean(item.errorMessage) || status === 'waiting_funds' || status === 'pending' || status === 'processing';
      }).length,
    [items]
  );

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-gray-500" />
        <p className="mt-3 text-sm text-gray-600">Loading CJ fulfillment queue...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-semibold text-gray-900">CJ Fulfillment Queue</h3>
            <p className="mt-1 text-sm text-gray-600">
              Sold CJ items land here so admin can confirm payment, push orders to CJ, and monitor tracking.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadQueue('refresh')}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50 disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-6">
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <div className="text-xs uppercase text-gray-500">Total</div>
            <div className="mt-1 text-lg font-semibold text-gray-900">{summary.total}</div>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <div className="text-xs uppercase text-amber-700">Waiting</div>
            <div className="mt-1 text-lg font-semibold text-amber-900">{summary.waitingFunds}</div>
          </div>
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
            <div className="text-xs uppercase text-blue-700">Pending</div>
            <div className="mt-1 text-lg font-semibold text-blue-900">{summary.pending}</div>
          </div>
          <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3">
            <div className="text-xs uppercase text-indigo-700">Shipped</div>
            <div className="mt-1 text-lg font-semibold text-indigo-900">{summary.shipped}</div>
          </div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
            <div className="text-xs uppercase text-emerald-700">Delivered</div>
            <div className="mt-1 text-lg font-semibold text-emerald-900">{summary.delivered}</div>
          </div>
          <div className="rounded-lg border border-red-200 bg-red-50 p-3">
            <div className="text-xs uppercase text-red-700">Errors</div>
            <div className="mt-1 text-lg font-semibold text-red-900">{summary.errors}</div>
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          {attentionCount} CJ order{attentionCount === 1 ? '' : 's'} currently need admin attention.
        </div>

        {error ? (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center">
          <Package className="mx-auto h-10 w-10 text-gray-400" />
          <p className="mt-3 text-sm text-gray-600">No CJ orders have entered the fulfillment queue yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item) => {
            const status = String(item.cjStatus || 'unknown').toUpperCase();
            const canDispatch =
              !item.cjOrderId &&
              (String(item.cjStatus || '').toLowerCase() === 'waiting_funds' || Boolean(item.errorMessage));

            return (
              <div key={item.orderId} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-base font-semibold text-gray-900">Order #{item.orderId.slice(-8)}</span>
                      <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${getStatusTone(item)}`}>
                        {item.errorMessage ? 'ERROR' : status}
                      </span>
                      {item.cjTrackingNumber ? (
                        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
                          Tracking ready
                        </span>
                      ) : null}
                    </div>
                    <div className="text-sm text-gray-600">
                      Customer: <span className="font-medium text-gray-900">{item.customerName || 'N/A'}</span>
                      {item.customerEmail ? ` | ${item.customerEmail}` : ''}
                    </div>
                    <div className="text-sm text-gray-600">
                      Paid: {item.paymentStatus || 'unknown'} | Fulfillment: {item.fulfillmentStatus || 'unknown'} | Total charged:{' '}
                      <span className="font-medium text-gray-900">{formatMoney(item.totalCharged)}</span>
                    </div>
                    <div className="text-sm text-gray-600">
                      CJ order: <span className="font-medium text-gray-900">{item.cjOrderNumber || 'Not created yet'}</span>
                      {item.cjOrderId ? ` | CJ ID ${item.cjOrderId}` : ''}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {canDispatch ? (
                      <button
                        type="button"
                        onClick={() => void handleDispatch(item.orderId)}
                        disabled={dispatchingOrderId === item.orderId}
                        className="inline-flex items-center gap-2 rounded-lg bg-[#101820] px-4 py-2 text-sm font-semibold text-[#ffcb05] hover:bg-black disabled:opacity-60"
                      >
                        {dispatchingOrderId === item.orderId ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                        Send to CJ now
                      </button>
                    ) : null}

                    <button
                      type="button"
                      onClick={() => void loadQueue('refresh')}
                      className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50"
                    >
                      <RefreshCw className="h-4 w-4" />
                      Refresh
                    </button>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-[2fr,1fr]">
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                    <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900">
                      <Package className="h-4 w-4" />
                      Items
                    </div>
                    <div className="space-y-3">
                      {item.items.map((orderItem) => (
                        <div key={orderItem.id} className="flex gap-3 rounded-lg border border-gray-200 bg-white p-3">
                          {orderItem.imageUrl ? (
                            <img
                              src={orderItem.imageUrl}
                              alt={orderItem.title}
                              className="h-16 w-16 rounded-lg object-cover"
                            />
                          ) : (
                            <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-gray-100">
                              <Package className="h-5 w-5 text-gray-400" />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="font-medium text-gray-900">{orderItem.title}</div>
                            <div className="mt-1 text-xs text-gray-600">
                              Qty {orderItem.quantity} | Unit {formatMoney(orderItem.unitPrice)} | Total {formatMoney(orderItem.totalPrice)}
                            </div>
                            <div className="mt-1 text-xs text-gray-500">
                              SKU {orderItem.sku || 'N/A'} | CJ PID {orderItem.cjProductId || 'N/A'} | CJ VID {orderItem.cjVariantId || 'N/A'}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-900">
                        <Truck className="h-4 w-4" />
                        Shipping
                      </div>
                      <div className="text-sm text-gray-700">{formatAddress(item.shippingAddress)}</div>
                      <div className="mt-3 text-xs text-gray-500">
                        CJ cost: {formatMoney(item.cjCost)}<br />
                        Paid at: {formatDateTime(item.paidAt)}<br />
                        Updated: {formatDateTime(item.updatedAt)}
                      </div>
                    </div>

                    {item.processAfter ? (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                        <div className="font-semibold">Hold window</div>
                        <div>Eligible to process after {formatDateTime(item.processAfter)}</div>
                      </div>
                    ) : null}

                    {item.cjTrackingNumber ? (
                      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                        <div className="mb-2 flex items-center gap-2 font-semibold">
                          <CheckCircle2 className="h-4 w-4" />
                          Tracking
                        </div>
                        <div>{item.cjTrackingNumber}</div>
                        <div className="text-xs">{item.cjLogisticName || 'Carrier pending'}</div>
                        {item.cjTrackingUrl ? (
                          <a
                            href={item.cjTrackingUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-2 inline-block text-sm font-medium text-emerald-800 underline"
                          >
                            Open tracking
                          </a>
                        ) : null}
                      </div>
                    ) : null}

                    {item.errorMessage ? (
                      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                        <div className="mb-2 flex items-center gap-2 font-semibold">
                          <AlertCircle className="h-4 w-4" />
                          CJ error
                        </div>
                        <div>{item.errorMessage}</div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
