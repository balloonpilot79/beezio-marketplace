import { createClient } from '@supabase/supabase-js';
import type { Handler } from '@netlify/functions';
import { validateCjOrderVariant } from './_lib/order-guards';

const json = (statusCode: number, body: unknown) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CJ_API_KEY = String(process.env.CJ_API_KEY || '').trim();
const CJ_API_BASE_URL = String(process.env.CJ_API_BASE_URL || 'https://developers.cjdropshipping.com/api2.0/v1/').replace(/\/?$/, '/');
const CJ_FULFILLMENT_DELAY_HOURS = Math.max(0, Number(process.env.CJ_FULFILLMENT_DELAY_HOURS || 24));

const supabase = createClient(
  SUPABASE_URL || 'http://localhost:54321',
  SUPABASE_SERVICE_ROLE_KEY || 'missing-service-role-key'
);

let cachedAccessToken: string | null = null;
let tokenExpiryDate: string | null = null;

type CJOrderItem = { pid: string; vid?: string; quantity: number };
type CJShippingAddress = {
  firstName: string;
  lastName: string;
  address: string;
  address2?: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  phone: string;
  email: string;
};

async function getAccessToken(): Promise<string> {
  if (cachedAccessToken && tokenExpiryDate) {
    const expiry = new Date(tokenExpiryDate).getTime();
    if (Number.isFinite(expiry) && expiry > Date.now()) {
      return cachedAccessToken;
    }
  }

  if (!CJ_API_KEY) throw new Error('Missing CJ_API_KEY');

  const response = await fetch(`${CJ_API_BASE_URL}authentication/getAccessToken`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey: CJ_API_KEY }),
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result?.result) {
    throw new Error(`CJ token error: ${response.status} ${String(result?.message || response.statusText)}`);
  }

  cachedAccessToken = String(result?.data?.accessToken || '').trim();
  tokenExpiryDate = String(result?.data?.accessTokenExpiryDate || '').trim() || null;
  if (!cachedAccessToken) throw new Error('CJ access token missing');
  return cachedAccessToken;
}

async function cjRequest(endpoint: string, data: any) {
  const accessToken = await getAccessToken();
  const response = await fetch(`${CJ_API_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'CJ-Access-Token': accessToken,
    },
    body: JSON.stringify(data),
  });

  const raw = await response.text();
  let result: any = {};
  try {
    result = raw ? JSON.parse(raw) : {};
  } catch {
    throw new Error(`CJ API non-JSON response (${response.status})`);
  }

  if (!response.ok || !result?.result) {
    throw new Error(`CJ API error: ${response.status} ${String(result?.message || response.statusText)}`);
  }

  return result.data;
}

function splitName(name: string) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { first: 'Customer', last: 'Order' };
  return {
    first: parts[0],
    last: parts.length > 1 ? parts.slice(1).join(' ') : parts[0],
  };
}

function toIsoFromHours(hours: number) {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return json(500, { error: 'Missing Supabase server credentials' });

  try {
    const body = JSON.parse(event.body || '{}');
    const orderId = String(body?.orderId || '').trim();
    const force = Boolean(body?.force === true || body?.force === 'true');
    if (!orderId) return json(400, { error: 'Order ID required' });

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*, order_items:order_items(*)')
      .eq('id', orderId)
      .maybeSingle();

    if (orderError || !order) throw new Error('Order not found');

    const paid =
      String((order as any)?.payment_status || '').toLowerCase() === 'paid' ||
      String((order as any)?.status || '').toLowerCase() === 'completed';
    if (!paid) {
      await supabase.from('cj_orders').upsert(
        {
          beezio_order_id: orderId,
          cj_order_number: `BZ-${orderId}`,
          cj_status: 'waiting_funds',
          order_data: { reason: 'order_not_paid', process_after: toIsoFromHours(CJ_FULFILLMENT_DELAY_HOURS) },
        },
        { onConflict: 'beezio_order_id' }
      );
      await supabase.from('orders').update({ fulfillment_status: 'waiting_funds', updated_at: new Date().toISOString() }).eq('id', orderId);
      return json(202, { message: 'Order is not paid yet', orderId });
    }

    const { data: existingCJOrder } = await supabase
      .from('cj_orders')
      .select('*')
      .eq('beezio_order_id', orderId)
      .maybeSingle();

    if ((existingCJOrder as any)?.cj_order_id) {
      return json(200, {
        message: 'Order already fulfilled',
        cjOrderNumber: (existingCJOrder as any)?.cj_order_number,
        cjOrderId: (existingCJOrder as any)?.cj_order_id,
      });
    }

    const createdAtMs = Date.parse(String((order as any)?.paid_at || (order as any)?.created_at || ''));
    const holdUntilMs = Number.isFinite(createdAtMs)
      ? createdAtMs + CJ_FULFILLMENT_DELAY_HOURS * 60 * 60 * 1000
      : Date.now() + CJ_FULFILLMENT_DELAY_HOURS * 60 * 60 * 1000;
    if (!force && Date.now() < holdUntilMs) {
      const processAfter = new Date(holdUntilMs).toISOString();
      await supabase.from('cj_orders').upsert(
        {
          beezio_order_id: orderId,
          cj_order_number: `BZ-${orderId}`,
          cj_status: 'waiting_funds',
          order_data: { reason: 'hold_window', process_after: processAfter },
        },
        { onConflict: 'beezio_order_id' }
      );
      await supabase.from('orders').update({ fulfillment_status: 'waiting_funds', updated_at: new Date().toISOString() }).eq('id', orderId);
      return json(202, { message: 'CJ fulfillment delayed until hold window ends', process_after: processAfter });
    }

    const items = Array.isArray((order as any)?.order_items) ? (order as any).order_items : [];
    const productIds = Array.from(new Set(items.map((it: any) => String(it?.product_id || '').trim()).filter(Boolean)));
    const variantIds = Array.from(new Set(items.map((it: any) => String(it?.variant_id || '').trim()).filter(Boolean)));

    const mappingByProductId = new Map<string, any>();
    if (productIds.length > 0) {
      const { data: rows } = await supabase
        .from('cj_product_mappings')
        .select('beezio_product_id,cj_product_id,cj_variant_id,cj_cost')
        .in('beezio_product_id', productIds);
      (rows || []).forEach((row: any) => {
        if (row?.beezio_product_id) mappingByProductId.set(String(row.beezio_product_id), row);
      });
    }

    const variantById = new Map<string, any>();
    if (variantIds.length > 0) {
      const { data: rows } = await supabase
        .from('product_variants')
        .select('id,product_id,source,source_platform,cj_product_id,cj_variant_id,cj_vid,variant_display_sku,searchable_codes,is_orderable,order_reference_type,price')
        .in('id', variantIds);
      (rows || []).forEach((row: any) => {
        if (row?.id) variantById.set(String(row.id), row);
      });
    }

    const cjOrderItems: CJOrderItem[] = [];
    let totalCJCost = 0;
    const missingMappings: Array<{ product_id?: string; variant_id?: string; cj_variant_id?: string }> = [];

    for (const item of items) {
      const qty = Math.max(0, Math.floor(Number(item?.quantity || 0)));
      if (!qty) continue;

      const variant = item?.variant_id ? variantById.get(String(item.variant_id)) : null;
      const mapping = mappingByProductId.get(String(item?.product_id || ''));
      const variantValidation =
        item?.variant_id
          ? await validateCjOrderVariant({
              supabaseAdmin: supabase,
              productId: String(item?.product_id || '').trim() || undefined,
              variantId: String(item?.variant_id || '').trim() || undefined,
            })
          : { ok: false, reason: 'No CJ variant was selected for this order item.' };
      const pid = String(item?.cj_product_id || variant?.cj_product_id || mapping?.cj_product_id || '').trim();
      const vid = String(
        variantValidation.ok
          ? variantValidation.orderReference
          : item?.cj_variant_id || variant?.cj_vid || variant?.cj_variant_id || mapping?.cj_variant_id || ''
      ).trim() || undefined;
      const hasCjHints = Boolean(
        mapping ||
        variant ||
        String(item?.cj_product_id || '').trim() ||
        String(item?.cj_variant_id || '').trim()
      );
      if (!variantValidation.ok && hasCjHints) {
        missingMappings.push({
          product_id: String(item?.product_id || '').trim() || undefined,
          variant_id: String(item?.variant_id || '').trim() || undefined,
          cj_variant_id: vid,
        });
        continue;
      }
      if (!pid) {
        if (hasCjHints) {
          missingMappings.push({
            product_id: String(item?.product_id || '').trim() || undefined,
            variant_id: String(item?.variant_id || '').trim() || undefined,
            cj_variant_id: vid,
          });
        }
        continue;
      }

      cjOrderItems.push({ pid, vid, quantity: qty });

      const unitCost = Number(item?.unit_price ?? variant?.price ?? mapping?.cj_cost ?? 0);
      if (Number.isFinite(unitCost) && unitCost > 0) totalCJCost += unitCost * qty;
    }

    if (missingMappings.length > 0) {
      throw new Error(`Missing CJ fulfillment mapping for ${missingMappings.length} item(s).`);
    }

    if (!cjOrderItems.length) return json(200, { message: 'No dropship products to fulfill' });

    const shippingRaw = (order as any)?.shipping_address || (order as any)?.shipping_info || {};
    const name = splitName(String((order as any)?.billing_name || shippingRaw?.name || '').trim());
    const shippingAddress: CJShippingAddress = {
      firstName: String(shippingRaw?.firstName || name.first || 'Customer'),
      lastName: String(shippingRaw?.lastName || name.last || 'Order'),
      address: String(shippingRaw?.address || shippingRaw?.address1 || shippingRaw?.street || ''),
      address2: String(shippingRaw?.address2 || ''),
      city: String(shippingRaw?.city || ''),
      state: String(shippingRaw?.state || ''),
      zip: String(shippingRaw?.zip || shippingRaw?.postal_code || shippingRaw?.zipCode || ''),
      country: String(shippingRaw?.country || 'US'),
      phone: String(shippingRaw?.phone || ''),
      email: String((order as any)?.billing_email || ''),
    };

    const cjOrderNumber = `BZ-${orderId}`;
    const cjOrderData = {
      orderNumber: cjOrderNumber,
      products: cjOrderItems,
      shippingAddress,
      logisticName: String((order as any)?.shipping_logistic_name || 'Standard Shipping'),
    };

    const cjOrderResponse = await cjRequest('shopping/order/createOrder', cjOrderData);

    const { error: insertError } = await supabase.from('cj_orders').upsert(
      {
        beezio_order_id: orderId,
        cj_order_number: cjOrderNumber,
        cj_order_id: cjOrderResponse?.cjOrderId || cjOrderResponse?.orderNumber || null,
        cj_status: 'pending',
        cj_cost: totalCJCost,
        order_data: cjOrderData,
        error_message: null,
      },
      { onConflict: 'beezio_order_id' }
    );
    if (insertError) throw insertError;

    await supabase
      .from('orders')
      .update({ fulfillment_status: 'processing', updated_at: new Date().toISOString() })
      .eq('id', orderId);

    return json(200, {
      message: 'Order sent to CJ for fulfillment',
      cjOrderNumber,
      cjOrderId: cjOrderResponse?.cjOrderId,
      totalCJCost,
    });
  } catch (err: any) {
    const message = err?.message || String(err);
    console.error('CJ fulfill error:', message);
    return json(500, { error: message });
  }
};

export default handler;
