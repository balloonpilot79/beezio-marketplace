import type { Handler } from '@netlify/functions';
import { extractAuthHeader, getAuthedUser } from './_lib/auth';
import { json } from './_lib/http';
import { createSupabaseAdmin } from './_lib/supabase';
import { resolveOwnedProfileIdsForUser } from './_lib/owned-profiles';

const toText = (value: unknown): string | null => {
  const text = String(value || '').trim();
  return text || null;
};

const toMoney = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Number(parsed.toFixed(2)) : 0;
};

const extractMissingColumnName = (message: string): string | null => {
  const pg = String(message || '').match(/column\s+"([^"]+)"\s+of\s+relation\s+"[^"]+"\s+does\s+not\s+exist/i);
  if (pg?.[1]) return pg[1];
  const pgrst = String(message || '').match(/Could not find the '([^']+)' column of '[^']+' in the schema cache/i);
  return pgrst?.[1] || null;
};

const selectRows = async (supabaseAdmin: any, table: string, fields: string[], build: (query: any) => any) => {
  let selected = [...fields];
  let lastError: any = null;

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const { data, error } = await build(supabaseAdmin.from(table).select(selected.join(',')));
    if (!error) return { data: (data as any[]) || [], error: null };
    lastError = error;
    const missing = extractMissingColumnName(String((error as any)?.message || ''));
    if (missing && selected.includes(missing)) {
      selected = selected.filter((field) => field !== missing);
      continue;
    }
    break;
  }

  return { data: [], error: lastError };
};

const parseOptions = (value: unknown): any[] => {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const maxDaysFromText = (value: unknown, fallback: number): number => {
  const matches = String(value || '').match(/\d+/g);
  if (!matches?.length) return fallback;
  return Math.max(...matches.map((item) => Number(item)).filter(Number.isFinite), fallback);
};

const addDays = (value: unknown, days: number): string | null => {
  const base = new Date(String(value || ''));
  if (!Number.isFinite(base.getTime())) return null;
  base.setDate(base.getDate() + Math.max(0, days));
  return base.toISOString();
};

export const handler: Handler = async (event) => {
  try {
    if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });

    const authHeader = extractAuthHeader(event as any);
    if (!authHeader) return json(401, { error: 'Unauthorized' });

    const { user, error: authError } = await getAuthedUser(authHeader);
    if (!user || authError) return json(401, { error: authError || 'Unauthorized' });

    const supabaseAdmin = createSupabaseAdmin();
    const ownerIds = await resolveOwnedProfileIdsForUser({ supabaseAdmin, user });
    const email = String((user as any)?.email || '').trim();

    const orderFields = [
      'id',
      'order_number',
      'buyer_id',
      'user_id',
      'seller_id',
      'provider_order_id',
      'status',
      'payment_status',
      'fulfillment_status',
      'dispute_status',
      'created_at',
      'updated_at',
      'paid_at',
      'billing_name',
      'billing_email',
      'customer_email',
      'shipping_address',
      'total_amount',
      'total_charged',
      'shipping_amount',
      'tracking_number',
      'tracking_url',
      'carrier',
      'shipped_at',
    ];

    const queries: Promise<{ data: any[]; error: any }>[] = [];
    if (ownerIds.length) {
      queries.push(selectRows(supabaseAdmin, 'orders', orderFields, (query) => query.in('buyer_id', ownerIds)));
      queries.push(selectRows(supabaseAdmin, 'orders', orderFields, (query) => query.in('user_id', ownerIds)));
    }
    if (email) {
      queries.push(selectRows(supabaseAdmin, 'orders', orderFields, (query) => query.eq('billing_email', email)));
      queries.push(selectRows(supabaseAdmin, 'orders', orderFields, (query) => query.eq('customer_email', email)));
    }

    const results = await Promise.all(queries);
    const byId = new Map<string, any>();
    for (const result of results) {
      if (result.error) {
        const message = String((result.error as any)?.message || '');
        if (!message.toLowerCase().includes('does not exist') && !message.toLowerCase().includes('schema cache')) {
          return json(500, { error: message || 'Failed to load buyer orders' });
        }
      }
      for (const row of result.data || []) {
        const id = String(row?.id || '').trim();
        if (id) byId.set(id, row);
      }
    }

    const orders = Array.from(byId.values())
      .sort((a, b) => new Date(String(b?.created_at || '')).getTime() - new Date(String(a?.created_at || '')).getTime())
      .slice(0, 100);
    const orderIds = orders.map((row) => String(row?.id || '').trim()).filter(Boolean);

    const [itemsResult, cjResult, vendorResult] = await Promise.all([
      orderIds.length
        ? selectRows(
            supabaseAdmin,
            'order_items',
            ['id', 'order_id', 'product_id', 'quantity', 'price', 'total_price', 'final_sale_price_per_unit', 'product_title', 'title_snapshot', 'sku'],
            (query) => query.in('order_id', orderIds)
          )
        : Promise.resolve({ data: [], error: null } as any),
      orderIds.length
        ? selectRows(
            supabaseAdmin,
            'cj_orders',
            ['beezio_order_id', 'cj_status', 'cj_tracking_number', 'cj_tracking_url', 'cj_logistic_name'],
            (query) => query.in('beezio_order_id', orderIds)
          )
        : Promise.resolve({ data: [], error: null } as any),
      orderIds.length
        ? selectRows(
            supabaseAdmin,
            'vendor_orders',
            ['order_id', 'vendor_id', 'vendor_order_id', 'status', 'vendor_response', 'updated_at'],
            (query) => query.in('order_id', orderIds).order('updated_at', { ascending: false })
          )
        : Promise.resolve({ data: [], error: null } as any),
    ]);

    if (itemsResult.error) return json(500, { error: String((itemsResult.error as any)?.message || 'Failed to load order items') });

    const itemsByOrderId = new Map<string, any[]>();
    for (const item of itemsResult.data || []) {
      const orderId = String(item?.order_id || '').trim();
      if (!orderId) continue;
      itemsByOrderId.set(orderId, [...(itemsByOrderId.get(orderId) || []), item]);
    }

    const productIds = Array.from(new Set((itemsResult.data || []).map((item) => String(item?.product_id || '').trim()).filter(Boolean)));
    const sellerIds = Array.from(new Set(orders.map((order) => String(order?.seller_id || '').trim()).filter(Boolean)));

    const [productsResult, sellersResult] = await Promise.all([
      productIds.length
        ? selectRows(
            supabaseAdmin,
            'products',
            ['id', 'title', 'seller_id', 'shipping_options', 'requires_shipping', 'shipping_price', 'shipping_cost'],
            (query) => query.in('id', productIds)
          )
        : Promise.resolve({ data: [], error: null } as any),
      sellerIds.length
        ? selectRows(supabaseAdmin, 'profiles', ['id', 'full_name', 'email'], (query) => query.in('id', sellerIds))
        : Promise.resolve({ data: [], error: null } as any),
    ]);

    const productById = new Map((productsResult.data || []).map((row: any) => [String(row?.id || ''), row]));
    const sellerById = new Map((sellersResult.data || []).map((row: any) => [String(row?.id || ''), row]));
    const cjByOrderId = new Map((cjResult.data || []).map((row: any) => [String(row?.beezio_order_id || ''), row]));
    const vendorByOrderId = new Map<string, any>();
    for (const row of vendorResult.data || []) {
      const orderId = String(row?.order_id || '').trim();
      if (orderId && !vendorByOrderId.has(orderId)) vendorByOrderId.set(orderId, row);
    }

    return json(200, {
      ok: true,
      orders: orders.map((order) => {
        const orderId = String(order?.id || '').trim();
        const orderItems = itemsByOrderId.get(orderId) || [];
        const firstProduct = productById.get(String(orderItems[0]?.product_id || '').trim()) || null;
        const seller = sellerById.get(String(order?.seller_id || firstProduct?.seller_id || '').trim()) || null;
        const cj = cjByOrderId.get(orderId) || null;
        const vendor = vendorByOrderId.get(orderId) || null;
        const vendorResponse = vendor?.vendor_response && typeof vendor.vendor_response === 'object' ? vendor.vendor_response : {};
        const shippingOptions = parseOptions(firstProduct?.shipping_options);
        const shippingOption = shippingOptions[0] || {};
        const processingDays = maxDaysFromText(shippingOption?.processing_time, 2);
        const transitDays = maxDaysFromText(shippingOption?.estimated_days ?? shippingOption?.days ?? shippingOption?.estimatedDays, 5);
        const shippedAt = toText(order?.shipped_at) || toText((vendorResponse as any)?.shipped_at);
        const shipBase = shippedAt || order?.created_at;

        return {
          id: orderId,
          order_number: toText(order?.order_number),
          status: toText(order?.status) || 'completed',
          payment_status: toText(order?.payment_status),
          fulfillment_status: toText(order?.fulfillment_status),
          dispute_status: toText(order?.dispute_status),
          ordered_at: toText(order?.created_at),
          paid_at: toText(order?.paid_at),
          buyer_name: toText(order?.billing_name) || toText((order?.shipping_address as any)?.name),
          buyer_email: toText(order?.billing_email) || toText(order?.customer_email),
          seller_id: toText(order?.seller_id) || toText(firstProduct?.seller_id),
          seller_name: toText(seller?.full_name) || 'Seller',
          total_amount: toMoney(order?.total_charged ?? order?.total_amount),
          shipping_amount: toMoney(order?.shipping_amount),
          tracking_number: toText(order?.tracking_number) || toText(cj?.cj_tracking_number) || toText((vendorResponse as any)?.tracking_number),
          tracking_url: toText(order?.tracking_url) || toText(cj?.cj_tracking_url),
          shipping_carrier: toText(order?.carrier) || toText(cj?.cj_logistic_name) || toText((vendorResponse as any)?.carrier),
          shipped_at: shippedAt,
          expected_ship_date: shippedAt || addDays(order?.created_at, processingDays),
          expected_arrival_date: addDays(shipBase, transitDays),
          seller_notes: toText((vendorResponse as any)?.note),
          items: orderItems.map((item) => {
            const product = productById.get(String(item?.product_id || '').trim()) || {};
            const quantity = Math.max(1, Number(item?.quantity || 1));
            const unitPrice = toMoney(item?.final_sale_price_per_unit ?? item?.price);
            return {
              id: String(item?.id || ''),
              title: toText(item?.product_title) || toText(item?.title_snapshot) || toText(product?.title) || 'Product',
              quantity,
              unit_price: unitPrice,
              line_total: toMoney(item?.total_price) || Number((unitPrice * quantity).toFixed(2)),
              sku: toText(item?.sku),
            };
          }),
        };
      }),
    });
  } catch (e: any) {
    return json(Number(e?.statusCode) || 500, { error: e instanceof Error ? e.message : 'Unexpected error' });
  }
};

export default handler;
