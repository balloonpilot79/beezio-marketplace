import type { Handler } from '@netlify/functions';
import { requireAdmin, requireSellerOrAdmin as requireSellerOrAdminShared } from './_lib/auth';
import { json, parseJson } from './_lib/http';
import { createSupabaseAdmin } from './_lib/supabase';

type QueueScope = 'admin' | 'seller';
type QueueAction = 'list' | 'mark_ordered' | 'mark_shipped';

type QueueRequestBody = {
  action?: QueueAction;
  scope?: QueueScope;
  orderId?: string;
  orderReference?: string;
  note?: string;
  trackingNumber?: string;
  carrier?: string;
};

const MANUAL_VENDOR_PREFIX: Record<QueueScope, string> = {
  admin: 'manual_admin',
  seller: 'manual_seller',
};

const toSafeString = (value: unknown): string | null => {
  const normalized = String(value || '').trim();
  return normalized || null;
};

const toMoney = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseImages = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.map((item) => String(item || '').trim()).filter(Boolean);
  if (typeof value !== 'string') return [];
  const raw = value.trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map((item) => String(item || '').trim()).filter(Boolean) : [];
  } catch {
    return [raw];
  }
};

const queueBucket = (item: any): 'needs_ordering' | 'ordered' | 'shipped' => {
  const vendorStatus = String(item?.vendorStatus || '').toLowerCase();
  const fulfillmentStatus = String(item?.fulfillmentStatus || '').toLowerCase();
  const orderStatus = String(item?.orderStatus || '').toLowerCase();
  if (vendorStatus === 'shipped' || fulfillmentStatus === 'shipped' || orderStatus === 'shipped' || orderStatus === 'delivered') {
    return 'shipped';
  }
  if (vendorStatus === 'ordered' || vendorStatus === 'processing') {
    return 'ordered';
  }
  return 'needs_ordering';
};

async function requireSellerOrAdmin(event: Parameters<Handler>[0], scope: QueueScope) {
  return scope === 'admin' ? requireAdmin(event as any) : requireSellerOrAdminShared(event as any);
}

async function resolveSellerScopeIds(profileId: string, scope: QueueScope): Promise<string[]> {
  if (scope === 'seller') return [profileId];
  return [];
}

function extractMissingColumnName(message: string): string | null {
  const msg = String(message || '');
  const pg = msg.match(/column\s+\"([^\"]+)\"\s+of\s+relation\s+\"[^\"]+\"\s+does\s+not\s+exist/i);
  if (pg?.[1]) return pg[1];
  const pgDot = msg.match(/column\s+([a-z0-9_]+\.[a-z0-9_]+)\s+does\s+not\s+exist/i);
  if (pgDot?.[1]) return pgDot[1].split('.').pop() || pgDot[1];
  const pgrst = msg.match(/Could not find the '([^']+)' column of '[^']+' in the schema cache/i);
  if (pgrst?.[1]) return pgrst[1];
  return null;
}

async function resolveSellerAliases(supabaseAdmin: any, rawProfileId: string): Promise<string[]> {
  const aliases = new Set<string>([String(rawProfileId || '').trim()].filter(Boolean));
  const profileId = String(rawProfileId || '').trim();
  if (!profileId) return [];

  try {
    const { data } = await supabaseAdmin
      .from('profiles')
      .select('id,user_id')
      .or(`id.eq.${profileId},user_id.eq.${profileId}`);

    ((data as any[]) || []).forEach((row) => {
      const id = String((row as any)?.id || '').trim();
      const userId = String((row as any)?.user_id || '').trim();
      if (id) aliases.add(id);
      if (userId) aliases.add(userId);
    });
  } catch {
    // Ignore alias lookup failure and fall back to the raw id.
  }

  return Array.from(aliases);
}

async function selectOrdersResilient(supabaseAdmin: any, sellerIds: string[], scope: QueueScope) {
  const baseFields = [
    'id',
    'order_number',
    'created_at',
    'updated_at',
    'paid_at',
    'status',
    'payment_status',
    'fulfillment_status',
    'total_amount',
    'total_charged',
    'seller_id',
    'affiliate_id',
    'storefront_id',
    'billing_name',
    'billing_email',
    'customer_email',
    'shipping_address',
    'tracking_number',
    'carrier',
    'shipped_at',
  ];

  let selectedFields = [...baseFields];
  let lastError: any = null;

  for (let attempt = 0; attempt < 12; attempt += 1) {
    let query = supabaseAdmin
      .from('orders')
      .select(selectedFields.join(','))
      .order('created_at', { ascending: false })
      .limit(200);

    if (scope === 'seller' && sellerIds.length) {
      query = query.in('seller_id', sellerIds);
    }

    const { data, error } = await query;
    if (!error) {
      return { data: (data as any[]) || [], error: null };
    }

    lastError = error;
    const missing = extractMissingColumnName(String((error as any)?.message || ''));
    if (missing) {
      const nextFields = selectedFields.filter((field) => field !== missing);
      if (nextFields.length !== selectedFields.length) {
        selectedFields = nextFields;
        continue;
      }
    }

    break;
  }

  return { data: [], error: lastError };
}

async function selectRowsResilient(
  supabaseAdmin: any,
  table: string,
  fields: string[],
  buildQuery: (query: any) => any
) {
  let selectedFields = [...fields];
  let lastError: any = null;

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const query = buildQuery(
      supabaseAdmin
        .from(table)
        .select(selectedFields.join(','))
    );

    const { data, error } = await query;
    if (!error) {
      return { data: (data as any[]) || [], error: null };
    }

    lastError = error;
    const missing = extractMissingColumnName(String((error as any)?.message || ''));
    if (missing) {
      const nextFields = selectedFields.filter((field) => field !== missing);
      if (nextFields.length !== selectedFields.length) {
        selectedFields = nextFields;
        continue;
      }
    }

    break;
  }

  return { data: [], error: lastError };
}

async function loadQueue(profileId: string, scope: QueueScope) {
  const supabaseAdmin = createSupabaseAdmin();
  const baseSellerIds = await resolveSellerScopeIds(profileId, scope);
  const sellerIds = scope === 'seller'
    ? Array.from(new Set((await Promise.all(baseSellerIds.map((id) => resolveSellerAliases(supabaseAdmin, id)))).flat()))
    : baseSellerIds;
  const { data: ordersRows, error: ordersError } = await selectOrdersResilient(supabaseAdmin, sellerIds, scope);
  if (ordersError) throw new Error(ordersError.message);

  const orders = (ordersRows as any[]) || [];
  const orderIds = orders.map((row) => String(row?.id || '').trim()).filter(Boolean);
  const affiliateIds = Array.from(new Set(orders.map((row) => String(row?.affiliate_id || '').trim()).filter(Boolean)));
  const storefrontIds = Array.from(new Set(orders.map((row) => String(row?.storefront_id || '').trim()).filter(Boolean)));

  const orderItemResult = orderIds.length
    ? await selectRowsResilient(
        supabaseAdmin,
        'order_items',
        [
          'id',
          'order_id',
          'product_id',
          'quantity',
          'price',
          'final_sale_price_per_unit',
          'seller_ask_price_per_unit',
          'sku',
          'cj_product_id',
          'cj_variant_id',
          'variant_id',
          'source_platform',
          'shipping_cost',
          'product_title_snapshot',
          'product_description_snapshot',
          'product_sku_snapshot',
          'brand_name_snapshot',
          'storefront_id_snapshot',
          'image_url_snapshot',
          'source_url_snapshot',
        ],
        (query) => query.in('order_id', orderIds)
      )
    : { data: [], error: null } as any;

  if (orderItemResult.error) throw new Error(orderItemResult.error.message);
  const orderItemRows = (orderItemResult.data as any[]) || [];
  const productIds = Array.from(new Set(orderItemRows.map((row) => String(row?.product_id || '').trim()).filter(Boolean)));
  orderItemRows.forEach((row) => {
    const snapshotStorefrontId = String(row?.storefront_id_snapshot || '').trim();
    if (snapshotStorefrontId && !storefrontIds.includes(snapshotStorefrontId)) storefrontIds.push(snapshotStorefrontId);
  });

  const [vendorResult, cjResult, affiliateResult, productResult, storefrontResult] = await Promise.all([
    orderIds.length
      ? selectRowsResilient(
          supabaseAdmin,
          'vendor_orders',
          ['id', 'order_id', 'vendor_id', 'vendor_order_id', 'status', 'vendor_response', 'created_at', 'updated_at'],
          (query) => query.in('order_id', orderIds).order('updated_at', { ascending: false })
        )
      : Promise.resolve({ data: [], error: null } as any),
    orderIds.length
      ? selectRowsResilient(
          supabaseAdmin,
          'cj_orders',
          ['beezio_order_id', 'cj_status', 'cj_order_number', 'cj_order_id', 'cj_tracking_number', 'cj_tracking_url', 'cj_logistic_name', 'error_message'],
          (query) => query.in('beezio_order_id', orderIds)
        )
      : Promise.resolve({ data: [], error: null } as any),
    affiliateIds.length
      ? selectRowsResilient(
          supabaseAdmin,
          'profiles',
          ['id', 'full_name', 'email'],
          (query) => query.in('id', affiliateIds)
        )
      : Promise.resolve({ data: [], error: null } as any),
    productIds.length
      ? selectRowsResilient(
          supabaseAdmin,
          'products',
          ['id', 'title', 'description', 'images', 'primary_image_url', 'vendor_sku', 'source_url'],
          (query) => query.in('id', productIds)
        )
      : Promise.resolve({ data: [], error: null } as any),
    storefrontIds.length
      ? selectRowsResilient(
          supabaseAdmin,
          'storefronts',
          ['id', 'name', 'slug'],
          (query) => query.in('id', storefrontIds)
        )
      : Promise.resolve({ data: [], error: null } as any),
  ]);

  if (vendorResult.error) throw new Error(vendorResult.error.message);
  if (cjResult.error) throw new Error(cjResult.error.message);
  if (affiliateResult.error) throw new Error(affiliateResult.error.message);
  if (productResult.error) throw new Error(productResult.error.message);
  if (storefrontResult.error) throw new Error(storefrontResult.error.message);

  const manualVendorByOrderId = new Map<string, any>();
  ((vendorResult.data as any[]) || []).forEach((row) => {
    const orderId = String(row?.order_id || '').trim();
    const vendorId = String(row?.vendor_id || '').trim().toLowerCase();
    if (!orderId || !vendorId.startsWith('manual_')) return;
    if (!manualVendorByOrderId.has(orderId)) manualVendorByOrderId.set(orderId, row);
  });

  const cjByOrderId = new Map<string, any>();
  ((cjResult.data as any[]) || []).forEach((row) => {
    const orderId = String(row?.beezio_order_id || '').trim();
    if (orderId) cjByOrderId.set(orderId, row);
  });

  const affiliateById = new Map<string, any>();
  ((affiliateResult.data as any[]) || []).forEach((row) => {
    const id = String(row?.id || '').trim();
    if (id) affiliateById.set(id, row);
  });

  const productById = new Map<string, any>();
  ((productResult.data as any[]) || []).forEach((row) => {
    const id = String(row?.id || '').trim();
    if (id) productById.set(id, row);
  });

  const storefrontById = new Map<string, any>();
  ((storefrontResult.data as any[]) || []).forEach((row) => {
    const id = String(row?.id || '').trim();
    if (id) storefrontById.set(id, row);
  });

  const itemsByOrderId = new Map<string, any[]>();
  orderItemRows.forEach((row) => {
    const orderId = String(row?.order_id || '').trim();
    if (!orderId) return;
    const current = itemsByOrderId.get(orderId) || [];
    current.push(row);
    itemsByOrderId.set(orderId, current);
  });

  const items = orders.map((order) => {
    const orderId = String(order?.id || '').trim();
    const vendorRow = manualVendorByOrderId.get(orderId) || null;
    const cjRow = cjByOrderId.get(orderId) || null;
    const affiliateRow = affiliateById.get(String(order?.affiliate_id || '').trim()) || null;
    const vendorResponse = vendorRow?.vendor_response && typeof vendorRow.vendor_response === 'object' ? vendorRow.vendor_response : {};

    const orderItems = itemsByOrderId.get(orderId) || [];
    const normalizedItems = orderItems.map((item: any) => {
      const product = productById.get(String(item?.product_id || '').trim()) || {};
      const images = parseImages(product?.images);
      const snapshotStorefrontId = toSafeString(item?.storefront_id_snapshot) || toSafeString(order?.storefront_id);
      const storefront = snapshotStorefrontId ? storefrontById.get(snapshotStorefrontId) : null;
      return {
        id: String(item?.id || ''),
        productId: toSafeString(item?.product_id),
        title: String(item?.product_title_snapshot || product?.title || 'Product'),
        description: toSafeString(item?.product_description_snapshot || product?.description),
        quantity: Math.max(1, Number(item?.quantity || 1)),
        unitPrice: toMoney(item?.final_sale_price_per_unit ?? item?.price) || 0,
        totalPrice: (toMoney(item?.final_sale_price_per_unit ?? item?.price) || 0) * Math.max(1, Number(item?.quantity || 1)),
        sku: toSafeString(item?.product_sku_snapshot || item?.sku || product?.vendor_sku),
        cjProductId: toSafeString(item?.cj_product_id),
        cjVariantId: toSafeString(item?.cj_variant_id),
        cjProductSku: null,
        cjSpu: null,
        sourcePlatform: toSafeString(item?.source_platform),
        imageUrl: toSafeString(item?.image_url_snapshot || images[0] || product?.primary_image_url),
        sourceUrl: toSafeString(item?.source_url_snapshot || product?.source_url),
        brandName: toSafeString(item?.brand_name_snapshot || storefront?.name),
      };
    });

    const orderStorefront = storefrontById.get(String(order?.storefront_id || '').trim()) || null;
    const brandName = toSafeString(orderStorefront?.name)
      || normalizedItems.map((item) => toSafeString(item?.brandName)).find(Boolean)
      || 'Unassigned storefront';

    return {
      orderId,
      orderNumber: toSafeString(order?.order_number) || orderId,
      orderStatus: toSafeString(order?.status),
      paymentStatus: toSafeString(order?.payment_status),
      fulfillmentStatus: toSafeString(order?.fulfillment_status),
      createdAt: toSafeString(order?.created_at),
      paidAt: toSafeString(order?.paid_at),
      totalCharged: toMoney(order?.total_charged ?? order?.total_amount),
      storefrontId: toSafeString(order?.storefront_id),
      brandName,
      customerName: toSafeString(order?.billing_name) || toSafeString(order?.shipping_address?.name),
      customerEmail: toSafeString(order?.billing_email) || toSafeString(order?.customer_email),
      customerPhone: toSafeString(order?.shipping_address?.phone),
      shippingAddress: order?.shipping_address && typeof order.shipping_address === 'object' ? order.shipping_address : null,
      trackingNumber: toSafeString(order?.tracking_number),
      carrier: toSafeString(order?.carrier),
      shippedAt: toSafeString(order?.shipped_at),
      manualVendorId: toSafeString(vendorRow?.id),
      vendorStatus: toSafeString(vendorRow?.status),
      manualOrderReference: toSafeString(vendorRow?.vendor_order_id),
      manualOrderedAt: toSafeString((vendorResponse as any)?.ordered_at || vendorRow?.updated_at),
      manualNote: toSafeString((vendorResponse as any)?.note),
      cjStatus: toSafeString(cjRow?.cj_status),
      cjOrderNumber: toSafeString(cjRow?.cj_order_number),
      cjOrderId: toSafeString(cjRow?.cj_order_id),
      cjTrackingNumber: toSafeString(cjRow?.cj_tracking_number),
      cjTrackingUrl: toSafeString(cjRow?.cj_tracking_url),
      cjCarrier: toSafeString(cjRow?.cj_logistic_name),
      cjError: toSafeString(cjRow?.error_message),
      affiliateId: toSafeString(order?.affiliate_id),
      affiliateName: toSafeString(affiliateRow?.full_name),
      affiliateEmail: toSafeString(affiliateRow?.email),
      items: normalizedItems,
    };
  });

  const summary = {
    total: items.length,
    needsOrdering: items.filter((item) => queueBucket(item) === 'needs_ordering').length,
    ordered: items.filter((item) => queueBucket(item) === 'ordered').length,
    shipped: items.filter((item) => queueBucket(item) === 'shipped').length,
  };

  return { summary, items };
}

async function loadAuthorizedOrder(profileId: string, scope: QueueScope, orderId: string) {
  const supabaseAdmin = createSupabaseAdmin();
  const baseSellerIds = await resolveSellerScopeIds(profileId, scope);
  const sellerIds = scope === 'seller'
    ? Array.from(new Set((await Promise.all(baseSellerIds.map((id) => resolveSellerAliases(supabaseAdmin, id)))).flat()))
    : baseSellerIds;
  const { data: order, error } = await supabaseAdmin
    .from('orders')
    .select('id,order_number,seller_id,shipping_address,status,fulfillment_status,order_items(*)')
    .eq('id', orderId)
    .in('seller_id', sellerIds.length ? sellerIds : ['__never__'])
    .maybeSingle();
  if (error || !order) {
    const err: any = new Error('Order not found');
    err.statusCode = 404;
    throw err;
  }
  return order as any;
}

async function upsertManualVendorOrder(params: {
  scope: QueueScope;
  order: any;
  actorProfileId: string;
  status: 'ordered' | 'shipped';
  orderReference?: string | null;
  note?: string | null;
  trackingNumber?: string | null;
  carrier?: string | null;
}) {
  const supabaseAdmin = createSupabaseAdmin();
  const vendorId = MANUAL_VENDOR_PREFIX[params.scope];
  const orderId = String(params.order?.id || '').trim();
  const defaultReference = String(params.order?.order_number || params.order?.id || '').trim();
  const vendorOrderId = String(params.orderReference || defaultReference || `manual-${orderId}`).trim();

  const { data: existing } = await supabaseAdmin
    .from('vendor_orders')
    .select('*')
    .eq('order_id', orderId)
    .eq('vendor_id', vendorId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const existingResponse =
    existing?.vendor_response && typeof existing.vendor_response === 'object' ? existing.vendor_response : {};
  const nextResponse = {
    ...existingResponse,
    manual: true,
    ordered_at: params.status === 'ordered' ? new Date().toISOString() : (existingResponse as any)?.ordered_at || null,
    shipped_at: params.status === 'shipped' ? new Date().toISOString() : (existingResponse as any)?.shipped_at || null,
    ordered_by_profile_id: params.actorProfileId,
    note: params.note || (existingResponse as any)?.note || null,
    tracking_number: params.trackingNumber || (existingResponse as any)?.tracking_number || null,
    carrier: params.carrier || (existingResponse as any)?.carrier || null,
  };

  const items = Array.isArray(params.order?.order_items) ? params.order.order_items : [];
  const primaryItem = items[0] && typeof items[0] === 'object' ? items[0] : null;
  const productId = toSafeString((primaryItem as any)?.product_id) || toSafeString((params.order as any)?.product_id);
  const totalQuantity = items.length
    ? items.reduce((sum, item) => sum + Math.max(1, Number((item as any)?.quantity || 1)), 0)
    : Math.max(1, Number((params.order as any)?.quantity || 1));
  let payload: Record<string, any> = {
    order_id: orderId,
    vendor_id: vendorId,
    vendor_name: 'Manual Fulfillment',
    vendor_order_id: vendorOrderId,
    product_id: productId,
    quantity: totalQuantity,
    items,
    shipping_address: params.order?.shipping_address || {},
    status: params.status,
    vendor_response: nextResponse,
  };

  for (let attempt = 0; attempt < 8; attempt += 1) {
    if (existing?.id) {
      const { error } = await supabaseAdmin.from('vendor_orders').update(payload).eq('id', existing.id);
      if (!error) return;
      const missing = extractMissingColumnName(String((error as any)?.message || ''));
      if (missing && Object.prototype.hasOwnProperty.call(payload, missing)) {
        delete payload[missing];
        continue;
      }
      throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin.from('vendor_orders').insert(payload);
      if (!error) return;
      const missing = extractMissingColumnName(String((error as any)?.message || ''));
      if (missing && Object.prototype.hasOwnProperty.call(payload, missing)) {
        delete payload[missing];
        continue;
      }
      throw new Error(error.message);
    }
  }

  throw new Error('Unable to save manual vendor order');
}

async function markOrdered(profileId: string, scope: QueueScope, body: QueueRequestBody) {
  const orderId = String(body.orderId || '').trim();
  if (!orderId) throw new Error('Missing orderId');
  const order = await loadAuthorizedOrder(profileId, scope, orderId);
  await upsertManualVendorOrder({
    scope,
    order,
    actorProfileId: profileId,
    status: 'ordered',
    orderReference: body.orderReference || null,
    note: body.note || null,
  });

  const supabaseAdmin = createSupabaseAdmin();
  const { error } = await supabaseAdmin
    .from('orders')
    .update({
      fulfillment_status: 'processing',
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderId);
  if (error) throw new Error(error.message);
}

async function markShipped(profileId: string, scope: QueueScope, body: QueueRequestBody) {
  const orderId = String(body.orderId || '').trim();
  const trackingNumber = String(body.trackingNumber || '').trim();
  if (!orderId) throw new Error('Missing orderId');
  if (!trackingNumber) throw new Error('Tracking number is required before an order can be marked shipped.');
  const order = await loadAuthorizedOrder(profileId, scope, orderId);
  await upsertManualVendorOrder({
    scope,
    order,
    actorProfileId: profileId,
    status: 'shipped',
    orderReference: body.orderReference || null,
    note: body.note || null,
    trackingNumber,
    carrier: body.carrier || null,
  });

  const supabaseAdmin = createSupabaseAdmin();
  const { error } = await supabaseAdmin
    .from('orders')
    .update({
      tracking_number: toSafeString(trackingNumber),
      carrier: toSafeString(body.carrier),
      shipped_at: new Date().toISOString(),
      status: 'shipped',
      fulfillment_status: 'shipped',
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderId);
  if (error) throw new Error(error.message);
}

export const handler: Handler = async (event) => {
  try {
    if (event.httpMethod === 'OPTIONS') return json(200, {});
    if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

    const body = parseJson<QueueRequestBody>(event.body);
    const scope = String(body?.scope || 'seller').trim().toLowerCase() as QueueScope;
    if (scope !== 'admin' && scope !== 'seller') return json(400, { error: 'Invalid scope' });

    const auth = await requireSellerOrAdmin(event, scope);
    const action = String(body?.action || 'list').trim().toLowerCase() as QueueAction;

    if (action === 'mark_ordered') {
      await markOrdered(auth.profileId, scope, body);
    } else if (action === 'mark_shipped') {
      await markShipped(auth.profileId, scope, body);
    } else if (action !== 'list') {
      return json(400, { error: 'Invalid action' });
    }

    const queue = await loadQueue(auth.profileId, scope);
    return json(200, { ok: true, action, scope, ...queue });
  } catch (e: any) {
    const statusCode = Number(e?.statusCode) || 500;
    return json(statusCode, { error: e instanceof Error ? e.message : 'Unexpected error' });
  }
};

export default handler;
