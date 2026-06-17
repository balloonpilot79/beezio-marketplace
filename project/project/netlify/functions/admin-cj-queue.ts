import type { Handler } from '@netlify/functions';
import { requireAdmin } from './_lib/auth';
import { json, parseJson } from './_lib/http';
import { createSupabaseAdmin } from './_lib/supabase';
import { getSiteUrl } from './_lib/site';

type QueueAction = 'list' | 'dispatch';

type QueueRequestBody = {
  action?: QueueAction;
  orderId?: string;
};

type QueueItem = {
  orderId: string;
  cjOrderRowId: string | null;
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

const toMoney = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toSafeString = (value: unknown): string | null => {
  const normalized = String(value || '').trim();
  return normalized || null;
};

const toImageUrl = (product: any): string | null => {
  const images = product?.images;
  if (Array.isArray(images) && images.length > 0) {
    return toSafeString(images[0]);
  }
  if (typeof images === 'string') {
    try {
      const parsed = JSON.parse(images);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return toSafeString(parsed[0]);
      }
    } catch {
      // ignore malformed JSON
    }
  }
  return toSafeString(product?.image_url);
};

const compareQueueItems = (left: QueueItem, right: QueueItem): number => {
  const statusRank = (item: QueueItem) => {
    const status = String(item.cjStatus || '').toLowerCase();
    if (item.errorMessage) return 0;
    if (status === 'waiting_funds') return 1;
    if (status === 'pending' || status === 'processing') return 2;
    if (status === 'shipped') return 3;
    if (status === 'delivered') return 4;
    return 5;
  };

  const rankDiff = statusRank(left) - statusRank(right);
  if (rankDiff !== 0) return rankDiff;

  const leftTime = Date.parse(String(left.updatedAt || left.createdAt || '')) || 0;
  const rightTime = Date.parse(String(right.updatedAt || right.createdAt || '')) || 0;
  return rightTime - leftTime;
};

async function loadQueue(): Promise<{ summary: Record<string, number>; items: QueueItem[] }> {
  const supabaseAdmin = createSupabaseAdmin();

  const { data: cjRows, error: cjError } = await supabaseAdmin
    .from('cj_orders')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(200);

  if (cjError) {
    throw new Error(cjError.message);
  }

  const queueRows = (cjRows as any[]) || [];
  const orderIds = queueRows
    .map((row) => String(row?.beezio_order_id || '').trim())
    .filter(Boolean);

  const [ordersResult, orderItemsResult] = await Promise.all([
    orderIds.length
      ? supabaseAdmin
          .from('orders')
          .select('id,created_at,updated_at,paid_at,status,payment_status,fulfillment_status,total_charged,billing_name,billing_email,shipping_address')
          .in('id', orderIds)
      : Promise.resolve({ data: [], error: null } as any),
    orderIds.length
      ? supabaseAdmin
          .from('order_items')
          .select('id,order_id,product_id,quantity,unit_price,total_price,sku,cj_product_id,cj_variant_id,products(title,images,image_url)')
          .in('order_id', orderIds)
      : Promise.resolve({ data: [], error: null } as any),
  ]);

  if (ordersResult.error) throw new Error(ordersResult.error.message);
  if (orderItemsResult.error) throw new Error(orderItemsResult.error.message);

  const ordersById = new Map<string, any>();
  ((ordersResult.data as any[]) || []).forEach((row) => {
    const id = String(row?.id || '').trim();
    if (id) ordersById.set(id, row);
  });

  const orderItemsByOrderId = new Map<string, QueueItem['items']>();
  ((orderItemsResult.data as any[]) || []).forEach((row) => {
    const orderId = String(row?.order_id || '').trim();
    if (!orderId) return;
    const current = orderItemsByOrderId.get(orderId) || [];
    current.push({
      id: String(row?.id || ''),
      productId: toSafeString(row?.product_id),
      title: String(row?.products?.title || 'CJ item'),
      quantity: Math.max(1, Number(row?.quantity || 1)),
      unitPrice: Number(row?.unit_price || 0),
      totalPrice: Number(row?.total_price || 0),
      sku: toSafeString(row?.sku),
      cjProductId: toSafeString(row?.cj_product_id),
      cjVariantId: toSafeString(row?.cj_variant_id),
      imageUrl: toImageUrl(row?.products),
    });
    orderItemsByOrderId.set(orderId, current);
  });

  const items: QueueItem[] = queueRows.map((row) => {
    const orderId = String(row?.beezio_order_id || '').trim();
    const order = ordersById.get(orderId);
    const orderData = (row?.order_data && typeof row.order_data === 'object') ? row.order_data : {};

    return {
      orderId,
      cjOrderRowId: toSafeString(row?.id),
      cjOrderNumber: toSafeString(row?.cj_order_number),
      cjOrderId: toSafeString(row?.cj_order_id),
      cjStatus: toSafeString(row?.cj_status),
      cjTrackingNumber: toSafeString(row?.cj_tracking_number),
      cjTrackingUrl: toSafeString(row?.cj_tracking_url),
      cjLogisticName: toSafeString(row?.cj_logistic_name),
      cjCost: toMoney(row?.cj_cost),
      errorMessage: toSafeString(row?.error_message),
      processAfter: toSafeString((orderData as any)?.process_after),
      createdAt: toSafeString(row?.created_at),
      updatedAt: toSafeString(row?.updated_at),
      paidAt: toSafeString(order?.paid_at),
      orderStatus: toSafeString(order?.status),
      paymentStatus: toSafeString(order?.payment_status),
      fulfillmentStatus: toSafeString(order?.fulfillment_status),
      totalCharged: toMoney(order?.total_charged),
      customerName: toSafeString(order?.billing_name),
      customerEmail: toSafeString(order?.billing_email),
      shippingAddress: (order?.shipping_address && typeof order.shipping_address === 'object')
        ? order.shipping_address
        : null,
      items: orderItemsByOrderId.get(orderId) || [],
    };
  }).sort(compareQueueItems);

  const summary = {
    total: items.length,
    waitingFunds: items.filter((item) => item.cjStatus === 'waiting_funds').length,
    pending: items.filter((item) => item.cjStatus === 'pending' || item.cjStatus === 'processing').length,
    shipped: items.filter((item) => item.cjStatus === 'shipped').length,
    delivered: items.filter((item) => item.cjStatus === 'delivered').length,
    errors: items.filter((item) => Boolean(item.errorMessage)).length,
  };

  return { summary, items };
}

async function dispatchOrder(orderId: string) {
  const siteUrl = getSiteUrl();
  if (!siteUrl) throw new Error('Missing site URL');

  const response = await fetch(`${siteUrl.replace(/\/$/, '')}/.netlify/functions/cj-fulfill-order`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderId, force: true }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(String(payload?.error || payload?.message || 'Failed to dispatch CJ order'));
  }

  return payload;
}

export const handler: Handler = async (event) => {
  try {
    if (event.httpMethod === 'OPTIONS') return json(200, {});
    await requireAdmin(event as any);

    if (event.httpMethod !== 'POST') {
      return json(405, { error: 'Method not allowed' });
    }

    const body = parseJson<QueueRequestBody>(event.body);
    const action = String(body?.action || 'list').trim().toLowerCase() as QueueAction;

    if (action === 'dispatch') {
      const orderId = String(body?.orderId || '').trim();
      if (!orderId) return json(400, { error: 'Missing orderId' });
      const result = await dispatchOrder(orderId);
      const queue = await loadQueue();
      return json(200, { ok: true, action, result, ...queue });
    }

    const queue = await loadQueue();
    return json(200, { ok: true, action: 'list', ...queue });
  } catch (e: any) {
    const statusCode = Number(e?.statusCode) || 500;
    return json(statusCode, { error: e instanceof Error ? e.message : 'Unexpected error' });
  }
};

export default handler;
