import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, ClipboardCopy, ExternalLink, Loader2, Package, Printer, RefreshCw, ShoppingCart, Truck } from 'lucide-react';
import { supabase } from '../lib/supabase';

type QueueScope = 'admin' | 'seller';
type QueueBucket = 'needs_ordering' | 'ordered' | 'shipped';

type QueueItem = {
  orderId: string;
  orderNumber: string;
  orderStatus: string | null;
  paymentStatus: string | null;
  fulfillmentStatus: string | null;
  createdAt: string | null;
  paidAt: string | null;
  totalCharged: number | null;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  shippingAddress: Record<string, unknown> | null;
  trackingNumber: string | null;
  carrier: string | null;
  shippedAt: string | null;
  manualVendorId: string | null;
  vendorStatus: string | null;
  manualOrderReference: string | null;
  manualOrderedAt: string | null;
  manualNote: string | null;
  cjStatus: string | null;
  cjOrderNumber: string | null;
  cjOrderId: string | null;
  cjTrackingNumber: string | null;
  cjTrackingUrl: string | null;
  cjCarrier: string | null;
  cjError: string | null;
  affiliateId: string | null;
  affiliateName: string | null;
  affiliateEmail: string | null;
  items: Array<{
    id: string;
    productId: string | null;
    title: string;
    description: string | null;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    sku: string | null;
    cjProductId: string | null;
    cjVariantId: string | null;
    cjProductSku: string | null;
    cjSpu: string | null;
    sourcePlatform: string | null;
    imageUrl: string | null;
    sourceUrl: string | null;
  }>;
};

type QueueResponse = {
  ok: boolean;
  summary: {
    total: number;
    needsOrdering: number;
    ordered: number;
    shipped: number;
  };
  items: QueueItem[];
  error?: string;
};

const PRODUCT_IMAGE_FALLBACK = 'https://placehold.co/160x160?text=No+Image';

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
  const line = [
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
  return line.join(' | ') || 'No shipping address saved';
};

const addressLines = (value: Record<string, unknown> | null | undefined) => {
  if (!value || typeof value !== 'object') return ['No shipping address saved'];
  const lines = [
    value.name,
    value.address || value.address1 || value.street,
    value.address2,
    [value.city, value.state, value.zip || value.postal_code].filter(Boolean).join(', '),
    value.country,
  ]
    .map((part) => String(part || '').trim())
    .filter(Boolean);
  return lines.length ? lines : ['No shipping address saved'];
};

const buildFulfillmentSheet = (item: QueueItem) => {
  const lines = [
    `ORDER FULFILLMENT SHEET`,
    `Order: #${item.orderNumber}`,
    `Created: ${formatDateTime(item.createdAt)}`,
    `Paid: ${formatDateTime(item.paidAt)}`,
    `Customer: ${item.customerName || 'N/A'}`,
    `Email: ${item.customerEmail || 'N/A'}`,
    `Status: ${item.orderStatus || 'unknown'} / ${item.paymentStatus || 'unknown'}`,
    `Total Charged: ${formatMoney(item.totalCharged)}`,
    ``,
    `SHIP TO`,
    ...addressLines(item.shippingAddress),
    ``,
    `ITEMS TO PICK`,
    ...item.items.flatMap((orderItem, index) => [
      `${index + 1}. ${orderItem.title}`,
      `   Qty: ${orderItem.quantity}`,
      `   SKU: ${orderItem.sku || 'N/A'}`,
      `   CJ SKU: ${orderItem.cjProductSku || 'N/A'}`,
      `   Variant ID: ${orderItem.cjVariantId || 'N/A'}`,
      `   Unit: ${formatMoney(orderItem.unitPrice)} | Line: ${formatMoney(orderItem.totalPrice)}`,
    ]),
    ``,
    `FULFILLMENT NOTES`,
    item.manualNote || '',
    ``,
    `PACKER CHECKLIST`,
    `[ ] Pick all items`,
    `[ ] Confirm quantities`,
    `[ ] Inspect item condition`,
    `[ ] Pack securely`,
    `[ ] Apply shipping label`,
    `[ ] Add tracking in Beezio`,
  ];
  return lines.join('\n');
};

const buildShippingLabel = (item: QueueItem) => {
  const lines = [
    `SHIP TO`,
    ...addressLines(item.shippingAddress),
    ``,
    `ORDER #${item.orderNumber}`,
    item.customerEmail ? `Customer email: ${item.customerEmail}` : '',
    item.carrier || item.trackingNumber ? `Carrier/Tracking: ${[item.carrier, item.trackingNumber].filter(Boolean).join(' ')}` : '',
  ].filter((line) => line !== '');
  return lines.join('\n');
};

const printTextDocument = (title: string, contents: string, labelMode = false) => {
  const popup = window.open('', '_blank', 'noopener,noreferrer,width=820,height=900');
  if (!popup) return;
  const escapedTitle = title.replace(/[<>&]/g, (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[char] || char));
  const normalizedContents = String(contents || '').trim() || 'No label data available';
  const escapedContents = normalizedContents.replace(/[<>&]/g, (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[char] || char));
  popup.document.open();
  popup.document.write(`<!doctype html>
<html>
  <head>
    <title>${escapedTitle}</title>
    <style>
      html, body { background: #ffffff; }
      body {
        font-family: Arial, sans-serif;
        color: #111827;
        margin: ${labelMode ? '0.25in' : '0.5in'};
      }
      .sheet {
        border: ${labelMode ? '2px solid #111827' : '0'};
        border-radius: ${labelMode ? '12px' : '0'};
        padding: ${labelMode ? '0.18in' : '0'};
        min-height: ${labelMode ? '5.2in' : 'auto'};
        box-sizing: border-box;
      }
      .sheet-title {
        font-size: ${labelMode ? '14px' : '16px'};
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        margin-bottom: ${labelMode ? '0.12in' : '0.18in'};
      }
      pre {
        white-space: pre-wrap;
        font-size: ${labelMode ? '18px' : '13px'};
        line-height: 1.45;
        margin: 0;
      }
      ${labelMode ? '@page { size: 4in 6in; margin: 0.25in; }' : '@page { size: auto; margin: 0.5in; }'}
    </style>
  </head>
  <body>
    <div class="sheet">
      <div class="sheet-title">${labelMode ? 'Shipping Label' : escapedTitle}</div>
      <pre>${escapedContents}</pre>
    </div>
  </body>
</html>`);
  popup.document.close();
  popup.onload = () => {
    popup.focus();
    popup.setTimeout(() => {
      popup.print();
    }, 150);
  };
};

const copyDocument = async (contents: string) => {
  if (navigator?.clipboard?.writeText) {
    await navigator.clipboard.writeText(contents);
    return;
  }
  const textarea = document.createElement('textarea');
  textarea.value = contents;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
};

const queueBucket = (item: QueueItem): QueueBucket => {
  const vendorStatus = String(item.vendorStatus || '').toLowerCase();
  const fulfillmentStatus = String(item.fulfillmentStatus || '').toLowerCase();
  const orderStatus = String(item.orderStatus || '').toLowerCase();
  if (vendorStatus === 'shipped' || fulfillmentStatus === 'shipped' || orderStatus === 'shipped' || orderStatus === 'delivered') {
    return 'shipped';
  }
  if (vendorStatus === 'ordered' || vendorStatus === 'processing') {
    return 'ordered';
  }
  return 'needs_ordering';
};

const statusTone = (bucket: QueueBucket) => {
  if (bucket === 'needs_ordering') return 'bg-amber-100 text-amber-900 border-amber-200';
  if (bucket === 'ordered') return 'bg-blue-100 text-blue-900 border-blue-200';
  return 'bg-emerald-100 text-emerald-900 border-emerald-200';
};

const statusDotTone = (bucket: QueueBucket) => {
  if (bucket === 'needs_ordering') return 'bg-red-500';
  if (bucket === 'ordered') return 'bg-amber-500';
  return 'bg-emerald-500';
};

export default function ManualFulfillmentQueue({
  scope,
  title,
  subtitle,
}: {
  scope: QueueScope;
  title: string;
  subtitle: string;
}) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<QueueItem[]>([]);
  const [summary, setSummary] = useState<QueueResponse['summary']>({
    total: 0,
    needsOrdering: 0,
    ordered: 0,
    shipped: 0,
  });
  const [activeBucket, setActiveBucket] = useState<QueueBucket>('needs_ordering');
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [orderRefs, setOrderRefs] = useState<Record<string, string>>({});
  const [orderNotes, setOrderNotes] = useState<Record<string, string>>({});
  const [trackingNumbers, setTrackingNumbers] = useState<Record<string, string>>({});
  const [carriers, setCarriers] = useState<Record<string, string>>({});
  const [submittingOrderId, setSubmittingOrderId] = useState<string | null>(null);
  const [copiedDocKey, setCopiedDocKey] = useState<string | null>(null);

  const normalizeBucketForScope = (bucket: QueueBucket): QueueBucket => {
    if (scope === 'seller') {
      return bucket === 'shipped' ? 'shipped' : 'needs_ordering';
    }
    return bucket;
  };

  const loadQueue = async (mode: 'initial' | 'refresh' = 'initial') => {
    try {
      if (mode === 'initial') setLoading(true);
      else setRefreshing(true);
      setError(null);

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const response = await fetch('/.netlify/functions/manual-fulfillment-queue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: 'list', scope }),
      });

      const payload = (await response.json().catch(() => ({}))) as QueueResponse;
      if (!response.ok) throw new Error(String((payload as any)?.error || 'Failed to load fulfillment queue'));

      setItems(Array.isArray(payload.items) ? payload.items : []);
      setSummary(payload.summary || summary);
      setOrderRefs((prev) => {
        const next = { ...prev };
        (payload.items || []).forEach((item) => {
          if (!next[item.orderId]) next[item.orderId] = item.manualOrderReference || item.orderNumber || '';
        });
        return next;
      });
      setOrderNotes((prev) => {
        const next = { ...prev };
        (payload.items || []).forEach((item) => {
          if (!next[item.orderId] && item.manualNote) next[item.orderId] = item.manualNote;
        });
        return next;
      });
      setTrackingNumbers((prev) => {
        const next = { ...prev };
        (payload.items || []).forEach((item) => {
          if (!next[item.orderId] && item.trackingNumber) next[item.orderId] = item.trackingNumber;
        });
        return next;
      });
      setCarriers((prev) => {
        const next = { ...prev };
        (payload.items || []).forEach((item) => {
          if (!next[item.orderId] && item.carrier) next[item.orderId] = item.carrier;
        });
        return next;
      });
    } catch (err: any) {
      setError(err?.message || 'Failed to load fulfillment queue');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadQueue('initial');
  }, [scope]);

  const filteredItems = useMemo(
    () => items.filter((item) => normalizeBucketForScope(queueBucket(item)) === activeBucket),
    [activeBucket, items, scope]
  );

  const sellerReadyToShipCount = summary.needsOrdering + summary.ordered;

  const submitAction = async (action: 'mark_ordered' | 'mark_shipped', item: QueueItem) => {
    try {
      setSubmittingOrderId(item.orderId);
      setError(null);
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const payload: Record<string, unknown> = {
        action,
        scope,
        orderId: item.orderId,
        orderReference: orderRefs[item.orderId] || item.orderNumber,
        note: orderNotes[item.orderId] || '',
      };

      if (action === 'mark_shipped') {
        const trackingNumber = String(trackingNumbers[item.orderId] || '').trim();
        if (!trackingNumber) {
          throw new Error('A tracking number is required before this order can be marked shipped.');
        }
        payload.trackingNumber = trackingNumber;
        payload.carrier = String(carriers[item.orderId] || '').trim();
      }

      const response = await fetch('/.netlify/functions/manual-fulfillment-queue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const result = (await response.json().catch(() => ({}))) as QueueResponse;
      if (!response.ok) throw new Error(String((result as any)?.error || 'Failed to update fulfillment status'));

      setItems(Array.isArray(result.items) ? result.items : []);
      setSummary(result.summary || summary);
      if (action === 'mark_ordered') setActiveBucket('ordered');
      if (action === 'mark_shipped') setActiveBucket('shipped');
    } catch (err: any) {
      setError(err?.message || 'Failed to update fulfillment status');
    } finally {
      setSubmittingOrderId(null);
    }
  };

  const handleCopyDocument = async (key: string, contents: string) => {
    await copyDocument(contents);
    setCopiedDocKey(key);
    window.setTimeout(() => setCopiedDocKey((current) => (current === key ? null : current)), 1800);
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-gray-500" />
        <p className="mt-3 text-sm text-gray-600">Loading fulfillment queue...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-semibold text-gray-900">{title}</h3>
            <p className="mt-1 text-sm text-gray-600">{subtitle}</p>
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

        <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <div className="text-xs uppercase text-gray-500">Total</div>
            <div className="mt-1 text-lg font-semibold text-gray-900">{summary.total}</div>
          </div>
          {scope === 'seller' ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <div className="text-xs uppercase text-amber-700">Ready To Ship</div>
              <div className="mt-1 text-lg font-semibold text-amber-900">{sellerReadyToShipCount}</div>
            </div>
          ) : (
            <>
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <div className="text-xs uppercase text-amber-700">Needs Ordering</div>
                <div className="mt-1 text-lg font-semibold text-amber-900">{summary.needsOrdering}</div>
              </div>
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                <div className="text-xs uppercase text-blue-700">Ordered</div>
                <div className="mt-1 text-lg font-semibold text-blue-900">{summary.ordered}</div>
              </div>
            </>
          )}
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
            <div className="text-xs uppercase text-emerald-700">Shipped</div>
            <div className="mt-1 text-lg font-semibold text-emerald-900">{summary.shipped}</div>
          </div>
        </div>

        {error ? (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => setActiveBucket('needs_ordering')}
          className={`rounded-lg px-4 py-2 text-sm font-semibold ${
            activeBucket === 'needs_ordering' ? 'bg-amber-600 text-white' : 'bg-gray-100 text-gray-700'
          }`}
        >
          {scope === 'seller' ? 'Ready To Ship' : 'Needs Ordering'}
        </button>
        {scope !== 'seller' ? (
          <button
            type="button"
            onClick={() => setActiveBucket('ordered')}
            className={`rounded-lg px-4 py-2 text-sm font-semibold ${
              activeBucket === 'ordered' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'
            }`}
          >
            Ordered
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => setActiveBucket('shipped')}
          className={`rounded-lg px-4 py-2 text-sm font-semibold ${
            activeBucket === 'shipped' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-700'
          }`}
        >
          Shipped
        </button>
      </div>

      {filteredItems.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center">
          <Package className="mx-auto h-10 w-10 text-gray-400" />
          <p className="mt-3 text-sm text-gray-600">No orders in this bucket.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredItems.map((item) => {
            const rawBucket = queueBucket(item);
            const bucket = normalizeBucketForScope(rawBucket);
            const expanded = expandedOrderId === item.orderId;
            return (
              <div key={item.orderId} className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                <button
                  type="button"
                  onClick={() => setExpandedOrderId(expanded ? null : item.orderId)}
                  className="grid w-full grid-cols-[auto,1fr] gap-4 px-4 py-4 text-left hover:bg-gray-50"
                >
                  <div className="flex items-start pt-1">
                    <span className={`mt-1 h-3 w-3 rounded-full ${statusDotTone(bucket)}`} />
                  </div>
                  <div className="grid gap-3 lg:grid-cols-[1.1fr,0.95fr,0.65fr,0.7fr,auto] lg:items-center">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-base font-semibold text-gray-900">
                        {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        <span className="truncate">Order #{item.orderNumber}</span>
                      </div>
                      <div className="mt-1 text-sm text-gray-600">
                        {item.customerName || 'Customer unavailable'}
                        {item.customerEmail ? ` | ${item.customerEmail}` : ''}
                      </div>
                    </div>
                    <div className="text-sm text-gray-600">
                      <div className="font-medium text-gray-900">{item.items.length} item{item.items.length === 1 ? '' : 's'}</div>
                      <div className="mt-1 truncate">{item.items.map((orderItem) => orderItem.title).filter(Boolean).slice(0, 2).join(', ') || 'Order items'}</div>
                    </div>
                    <div className="text-sm">
                      <div className="font-medium text-gray-900">{formatMoney(item.totalCharged)}</div>
                      <div className="mt-1 text-gray-500">{formatDateTime(item.createdAt)}</div>
                    </div>
                    <div className="text-sm text-gray-600">
                      <div>Payment: {item.paymentStatus || 'unknown'}</div>
                      <div className="mt-1">Tracking: {item.trackingNumber || item.cjTrackingNumber || 'Pending'}</div>
                    </div>
                    <div className="flex justify-start lg:justify-end">
                      <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusTone(bucket)}`}>
                        {scope === 'seller'
                          ? bucket === 'shipped'
                            ? 'Shipped'
                            : 'Ready To Ship'
                          : bucket === 'needs_ordering'
                          ? 'New Order'
                          : bucket === 'ordered'
                          ? 'Ordered'
                          : 'Shipped'}
                      </span>
                    </div>
                  </div>
                </button>

                {expanded ? (
                  <div className="border-t border-gray-200 bg-gray-50/50 px-5 py-5">
                    <div className="mb-4 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-900">
                      {scope === 'seller'
                        ? 'Open the order details below to review the customer information, verify the item, print labels, add tracking, and mark it shipped.'
                        : 'Open order details below to review the purchase history, shipping address, and fulfillment controls for this order.'}
                    </div>
                    <div className="grid gap-4 lg:grid-cols-[2fr,1fr]">
                    <div className="space-y-4">
                      <div className="rounded-lg border border-gray-200 bg-white p-4">
                        <div className="mb-3 text-sm font-semibold text-gray-900">Print And Copy</div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <button
                            type="button"
                            onClick={() => printTextDocument(`Fulfillment ${item.orderNumber}`, buildFulfillmentSheet(item))}
                            className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50"
                          >
                            <Printer className="h-4 w-4" />
                            Print fulfillment sheet
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleCopyDocument(`fulfillment-${item.orderId}`, buildFulfillmentSheet(item))}
                            className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50"
                          >
                            <ClipboardCopy className="h-4 w-4" />
                            {copiedDocKey === `fulfillment-${item.orderId}` ? 'Copied sheet' : 'Copy fulfillment sheet'}
                          </button>
                          <button
                            type="button"
                            onClick={() => printTextDocument(`Shipping Label ${item.orderNumber}`, buildShippingLabel(item), true)}
                            className="inline-flex items-center justify-center gap-2 rounded-lg bg-gray-900 px-3 py-2 text-sm font-semibold text-white hover:bg-gray-800"
                          >
                            <Printer className="h-4 w-4" />
                            Print shipping label
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleCopyDocument(`label-${item.orderId}`, buildShippingLabel(item))}
                            className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50"
                          >
                            <ClipboardCopy className="h-4 w-4" />
                            {copiedDocKey === `label-${item.orderId}` ? 'Copied label' : 'Copy shipping label'}
                          </button>
                        </div>
                      </div>

                      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                        <div className="mb-3 text-sm font-semibold text-gray-900">Items</div>
                        <div className="space-y-3">
                          {item.items.map((orderItem) => (
                            <div key={orderItem.id} className="rounded-lg border border-gray-200 bg-white p-3">
                              <div className="flex gap-3">
                                {orderItem.imageUrl ? (
                                  <img
                                    src={orderItem.imageUrl}
                                    alt={orderItem.title}
                                    className="h-16 w-16 rounded-lg object-cover"
                                    onError={(event) => {
                                      const target = event.currentTarget;
                                      if (target.src !== PRODUCT_IMAGE_FALLBACK) {
                                        target.src = PRODUCT_IMAGE_FALLBACK;
                                      }
                                    }}
                                  />
                                ) : (
                                  <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-gray-100">
                                    <Package className="h-5 w-5 text-gray-400" />
                                  </div>
                                )}
                                <div className="min-w-0 flex-1">
                                  <div className="font-medium text-gray-900">{orderItem.title}</div>
                                  {orderItem.description ? (
                                    <div className="mt-1 text-xs text-gray-600">{orderItem.description}</div>
                                  ) : null}
                                  <div className="mt-2 text-xs text-gray-600">
                                    Qty {orderItem.quantity} | Unit {formatMoney(orderItem.unitPrice)} | Total {formatMoney(orderItem.totalPrice)}
                                  </div>
                                  <div className="mt-1 text-xs text-gray-500">
                                    SKU {orderItem.sku || 'N/A'} | CJ SKU {orderItem.cjProductSku || 'N/A'} | SPU {orderItem.cjSpu || 'N/A'}
                                  </div>
                                  <div className="mt-1 text-xs text-gray-500">
                                    CJ PID {orderItem.cjProductId || 'N/A'} | CJ VID {orderItem.cjVariantId || 'N/A'}
                                  </div>
                                  {orderItem.sourceUrl ? (
                                    <a
                                      href={orderItem.sourceUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:text-blue-800"
                                    >
                                      <ExternalLink className="h-3 w-3" />
                                      Open source listing
                                    </a>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                        <div className="mb-3 text-sm font-semibold text-gray-900">Manual Fulfillment</div>
                        <div className="grid gap-3 md:grid-cols-2">
                          <label className="text-sm text-gray-700">
                            Supplier order reference
                            <input
                              type="text"
                              value={orderRefs[item.orderId] || ''}
                              onChange={(e) => setOrderRefs((prev) => ({ ...prev, [item.orderId]: e.target.value }))}
                              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                              placeholder="Paste supplier or fulfillment order number"
                            />
                          </label>
                          <label className="text-sm text-gray-700">
                            Carrier
                            <input
                              type="text"
                              value={carriers[item.orderId] || ''}
                              onChange={(e) => setCarriers((prev) => ({ ...prev, [item.orderId]: e.target.value }))}
                              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                              placeholder="USPS, UPS, FedEx"
                            />
                          </label>
                          <label className="text-sm text-gray-700 md:col-span-2">
                            Fulfillment note
                            <textarea
                              value={orderNotes[item.orderId] || ''}
                              onChange={(e) => setOrderNotes((prev) => ({ ...prev, [item.orderId]: e.target.value }))}
                              className="mt-1 h-24 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                              placeholder="Any notes for this order"
                            />
                          </label>
                          <label className="text-sm text-gray-700 md:col-span-2">
                            Tracking number
                            <input
                              type="text"
                              value={trackingNumbers[item.orderId] || ''}
                              onChange={(e) => setTrackingNumbers((prev) => ({ ...prev, [item.orderId]: e.target.value }))}
                              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                              placeholder="Enter tracking number before marking shipped"
                            />
                          </label>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-3">
                          {scope !== 'seller' && rawBucket === 'needs_ordering' ? (
                            <button
                              type="button"
                              onClick={() => void submitAction('mark_ordered', item)}
                              disabled={submittingOrderId === item.orderId}
                              className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
                            >
                              {submittingOrderId === item.orderId ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingCart className="h-4 w-4" />}
                              Mark Ordered
                            </button>
                          ) : null}
                          {bucket !== 'shipped' ? (
                            <button
                              type="button"
                              onClick={() => void submitAction('mark_shipped', item)}
                              disabled={submittingOrderId === item.orderId}
                              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                            >
                              {submittingOrderId === item.orderId ? <Loader2 className="h-4 w-4 animate-spin" /> : <Truck className="h-4 w-4" />}
                              Mark Shipped
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                        <div className="mb-2 text-sm font-semibold text-gray-900">Customer And Shipping</div>
                        <div className="space-y-2 text-sm text-gray-700">
                          <div><span className="font-semibold text-gray-900">Customer:</span> {item.customerName || 'N/A'}</div>
                          <div><span className="font-semibold text-gray-900">Email:</span> {item.customerEmail || 'N/A'}</div>
                          <div><span className="font-semibold text-gray-900">Phone:</span> {item.customerPhone || 'N/A'}</div>
                        </div>
                        <div className="mt-3 text-sm text-gray-700">{formatAddress(item.shippingAddress)}</div>
                      </div>

                      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
                        <div><span className="font-semibold text-gray-900">Created:</span> {formatDateTime(item.createdAt)}</div>
                        <div className="mt-2"><span className="font-semibold text-gray-900">Paid:</span> {formatDateTime(item.paidAt)}</div>
                        <div className="mt-2"><span className="font-semibold text-gray-900">Manual Ref:</span> {item.manualOrderReference || 'Not set'}</div>
                        <div className="mt-2"><span className="font-semibold text-gray-900">Ordered At:</span> {formatDateTime(item.manualOrderedAt)}</div>
                        <div className="mt-2"><span className="font-semibold text-gray-900">Tracking:</span> {item.trackingNumber || item.cjTrackingNumber || 'Not set'}</div>
                        <div className="mt-2"><span className="font-semibold text-gray-900">Carrier:</span> {item.carrier || item.cjCarrier || 'Not set'}</div>
                      </div>

                      {(item.cjStatus || item.cjOrderNumber || item.cjError) ? (
                        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-900">
                          <div className="font-semibold">Historical Supplier Data</div>
                          <div className="mt-2">Status: {item.cjStatus || 'N/A'}</div>
                          <div className="mt-2">Order: {item.cjOrderNumber || item.cjOrderId || 'N/A'}</div>
                          <div className="mt-2">Tracking: {item.cjTrackingNumber || 'N/A'}</div>
                          {item.cjTrackingUrl ? (
                            <a href={item.cjTrackingUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-blue-700">
                              <ExternalLink className="h-3 w-3" />
                              Open historical tracking
                            </a>
                          ) : null}
                          {item.cjError ? <div className="mt-2 text-red-700">Error: {item.cjError}</div> : null}
                        </div>
                      ) : null}
                    </div>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
