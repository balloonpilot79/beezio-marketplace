// Netlify Function: Fulfill CJ Dropshipping Orders
// Triggered after Stripe payment succeeds
// Creates order in CJ system and stores tracking info

import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.warn(
    'cj-fulfill-order: Missing SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY. ' +
      'Set these in Netlify environment variables.'
  );
}

const supabase = createClient(
  SUPABASE_URL || 'http://localhost:54321',
  SUPABASE_SERVICE_ROLE_KEY || 'missing-service-role-key'
);

const CJ_API_KEY = process.env.CJ_API_KEY;
const CJ_API_BASE_URL = process.env.CJ_API_BASE_URL || 'https://developers.cjdropshipping.com/api2.0/v1/';
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

// In-memory token cache (resets on cold starts; tokens last days)
let cachedAccessToken: string | null = null;
let tokenExpiryDate: string | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedAccessToken && tokenExpiryDate) {
    const expiry = new Date(tokenExpiryDate).getTime();
    if (Number.isFinite(expiry) && expiry > Date.now()) {
      return cachedAccessToken;
    }
  }

  if (!CJ_API_KEY) {
    throw new Error('CJ_API_KEY missing (needed to fetch CJ access token)');
  }

  const response = await fetch(`${CJ_API_BASE_URL}authentication/getAccessToken`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey: CJ_API_KEY }),
  });

  const result = await response.json();
  if (!response.ok || !result?.result) {
    throw new Error(`CJ token error: ${response.status} ${result?.message || response.statusText}`);
  }

  cachedAccessToken = result.data.accessToken;
  tokenExpiryDate = result.data.accessTokenExpiryDate;
  if (!cachedAccessToken) {
    throw new Error('CJ access token was missing in response');
  }
  return cachedAccessToken;
}

interface CJOrderItem {
  pid: string;
  vid?: string;
  quantity: number;
}

interface CJShippingAddress {
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

  if (!response.ok) {
    throw new Error(`CJ API error: ${response.status} ${response.statusText}`);
  }

  const result = await response.json();
  
  if (!result.result) {
    throw new Error(`CJ API error: ${result.message}`);
  }

  return result.data;
}

function json(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

function stripe(): Stripe {
  const key = String(STRIPE_SECRET_KEY || '').trim();
  if (!key) {
    throw new Error('Missing STRIPE_SECRET_KEY (required to gate CJ fulfillment until funds clear)');
  }
  return new Stripe(key, { apiVersion: '2023-10-16' });
}

async function getFundsAvailableOnMs(paymentIntentId: string): Promise<number | null> {
  const stripeClient = stripe();
  const pi = await stripeClient.paymentIntents.retrieve(paymentIntentId, {
    expand: ['latest_charge.balance_transaction'],
  });

  if (pi.status !== 'succeeded') {
    return null;
  }

  const latestCharge = pi.latest_charge;
  if (!latestCharge) return null;

  const charge =
    typeof latestCharge === 'string'
      ? await stripeClient.charges.retrieve(latestCharge, { expand: ['balance_transaction'] })
      : latestCharge;

  const bt =
    typeof charge.balance_transaction === 'string'
      ? await stripeClient.balanceTransactions.retrieve(charge.balance_transaction)
      : charge.balance_transaction;

  const availableOnSec = (bt as any)?.available_on;
  if (typeof availableOnSec === 'number' && Number.isFinite(availableOnSec) && availableOnSec > 0) {
    return availableOnSec * 1000;
  }

  return null;
}

function extractCjStockNumber(payload: any): number | null {
  if (!payload) return null;
  const obj = Array.isArray(payload) ? payload[0] : payload;
  if (!obj || typeof obj !== 'object') return null;

  const candidates = [
    (obj as any).stockNumber,
    (obj as any).stock,
    (obj as any).inventory,
    (obj as any).qty,
    (obj as any).quantity,
    (obj as any).availableStock,
    (obj as any).available,
    (obj as any).onHand,
  ];

  for (const v of candidates) {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }

  return null;
}

function extractCjBackorderFlag(payload: any): boolean {
  if (!payload) return false;
  const obj = Array.isArray(payload) ? payload[0] : payload;
  if (!obj || typeof obj !== 'object') return false;
  const v =
    (obj as any).backorder ??
    (obj as any).isBackOrder ??
    (obj as any).isBackorder ??
    (obj as any).backOrder ??
    (obj as any).allowBackorder;
  return v === true || v === 1 || v === '1' || String(v).toLowerCase() === 'true';
}

async function checkCjInventoryOrThrow(item: CJOrderItem) {
  const data = await cjRequest('product/inventory/query', { pid: item.pid, vid: item.vid || undefined });
  const backorder = extractCjBackorderFlag(data);
  const stock = extractCjStockNumber(data);

  if (backorder) {
    throw new Error(`CJ item backorder: pid=${item.pid} vid=${item.vid || ''}`);
  }
  if (stock != null && stock <= 0) {
    throw new Error(`CJ item out of stock: pid=${item.pid} vid=${item.vid || ''} stock=${stock}`);
  }
  if (stock != null && item.quantity > stock) {
    throw new Error(`CJ item insufficient stock: pid=${item.pid} vid=${item.vid || ''} qty=${item.quantity} stock=${stock}`);
  }
}

export const handler: Handler = async (event) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  try {
    const { orderId } = JSON.parse(event.body);

    if (!orderId) {
      return json(400, { error: 'Order ID required' });
    }

    console.log(`Processing CJ fulfillment for order: ${orderId}`);

    // Get order details from Supabase
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        *,
        order_items:order_items(*)
      `)
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      throw new Error('Order not found');
    }

    let logisticName = order.shipping_logistic_name || 'CJ shipping';
    let shippingOptionRow: any = null;
    if (order.shipping_option_id) {
      const { data: optionRow, error: optionError } = await supabase
        .from('shipping_options')
        .select('id, method_name, method_code, cost, destination_country')
        .eq('id', order.shipping_option_id)
        .maybeSingle();

      if (optionError) {
        console.warn('Failed to fetch shipping option metadata:', optionError);
      } else if (optionRow) {
        shippingOptionRow = optionRow;
        if (optionRow.method_name) {
          logisticName = optionRow.method_name;
        }
      }
    }

    // Check if order is already fulfilled (or in progress)
    const { data: existingCJOrder } = await supabase
      .from('cj_orders')
      .select('*')
      .eq('beezio_order_id', orderId)
      .maybeSingle();

    if (existingCJOrder?.cj_order_id) {
      console.log('Order already sent to CJ:', existingCJOrder.cj_order_number);
      return json(200, {
        message: 'Order already fulfilled',
        cjOrderNumber: existingCJOrder.cj_order_number,
        cjOrderId: existingCJOrder.cj_order_id,
        cjStatus: existingCJOrder.cj_status,
      });
    }

    if (existingCJOrder && existingCJOrder.cj_status === 'pending') {
      return json(202, {
        message: 'CJ fulfillment already started',
        cjOrderNumber: existingCJOrder.cj_order_number,
        cjStatus: existingCJOrder.cj_status,
      });
    }

    // Get CJ product mappings for order items
    const productIds = order.order_items.map((item: any) => item.product_id);
    
    const { data: cjMappings, error: mappingError } = await supabase
      .from('cj_product_mappings')
      .select('*')
      .in('beezio_product_id', productIds);

    if (mappingError) {
      console.warn('cj-fulfill-order: mapping lookup warning', mappingError);
    }

    const mappingByProductId = new Map<string, any>();
    (cjMappings || []).forEach((row: any) => {
      if (row?.beezio_product_id) {
        mappingByProductId.set(row.beezio_product_id, row);
      }
    });

    const variantIds = Array.from(new Set(order.order_items.map((item: any) => item.variant_id).filter(Boolean)));
    const variantById = new Map<string, any>();

    if (variantIds.length) {
      const { data: variantRows, error: variantError } = await supabase
        .from('product_variants')
        .select('id, product_id, cj_product_id, cj_variant_id, price')
        .in('id', variantIds);

      if (variantError) {
        console.warn('cj-fulfill-order: variant lookup warning', variantError);
      }

      (variantRows || []).forEach((variant: any) => {
        if (variant?.id) {
          variantById.set(variant.id, variant);
        }
      });
    }

    // Build CJ order items
    const cjOrderItems: CJOrderItem[] = [];
    let totalCJCost = 0;

    for (const item of order.order_items) {
      const quantity = Number.isFinite(item.quantity) ? item.quantity : 0;
      if (quantity <= 0) continue;

      const variantRow = item.variant_id ? variantById.get(item.variant_id) : null;
      const fallbackMapping = mappingByProductId.get(item.product_id);
      let mapping: any = null;
      let variantCost = 0;

      if (variantRow && variantRow.cj_product_id) {
        mapping = {
          cj_product_id: variantRow.cj_product_id,
          cj_variant_id: variantRow.cj_variant_id,
        };
        variantCost = Number.isFinite(Number(variantRow.price)) ? Number(variantRow.price) : 0;
      } else if (fallbackMapping) {
        mapping = fallbackMapping;
        variantCost = Number.isFinite(Number(fallbackMapping.cj_cost)) ? Number(fallbackMapping.cj_cost) : 0;
      }

      if (!mapping?.cj_product_id) {
        continue;
      }

      cjOrderItems.push({
        pid: mapping.cj_product_id,
        vid: mapping.cj_variant_id || undefined,
        quantity,
      });

      totalCJCost += variantCost * quantity;
    }

    if (cjOrderItems.length === 0) {
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'No dropship products to fulfill' }),
      };
    }

    // Parse shipping address
    const shippingInfo = order.shipping_info || {};
    const billingName = order.billing_name || '';
    const [firstName, ...lastNameParts] = billingName.split(' ');
    const lastName = lastNameParts.join(' ') || firstName;

    const shippingAddress: CJShippingAddress = {
      firstName: shippingInfo.firstName || firstName || 'Customer',
      lastName: shippingInfo.lastName || lastName || 'Order',
      address: shippingInfo.address || '',
      address2: shippingInfo.address2 || '',
      city: shippingInfo.city || '',
      state: shippingInfo.state || '',
      zip: shippingInfo.zip || shippingInfo.zipCode || '',
      country: shippingInfo.country || 'US',
      phone: shippingInfo.phone || '',
      email: order.billing_email || order.user_email || '',
    };

    // Stable order number (cj_orders requires NOT NULL + UNIQUE; keep deterministic for idempotency)
    const cjOrderNumber = existingCJOrder?.cj_order_number || `BZ-${orderId}`;

    // Gate fulfillment until Stripe funds clear into the platform/admin Stripe balance.
    const paymentIntentId = String(order.stripe_payment_intent_id || '').trim();
    if (!paymentIntentId) {
      await supabase
        .from('cj_orders')
        .upsert(
          {
            beezio_order_id: orderId,
            cj_order_number: cjOrderNumber,
            cj_status: 'waiting_funds',
            cj_cost: totalCJCost,
            error_message: 'Missing orders.stripe_payment_intent_id; cannot verify funds availability',
            order_data: { reason: 'missing_payment_intent' },
          },
          { onConflict: 'beezio_order_id' }
        );

      await supabase.from('orders').update({ fulfillment_status: 'waiting_funds', updated_at: new Date().toISOString() }).eq('id', orderId);

      return json(202, { message: 'Waiting for Stripe payment intent ID to be recorded', cjOrderNumber });
    }

    const availableOnMs = await getFundsAvailableOnMs(paymentIntentId);
    if (availableOnMs && availableOnMs > Date.now()) {
      await supabase
        .from('cj_orders')
        .upsert(
          {
            beezio_order_id: orderId,
            cj_order_number: cjOrderNumber,
            cj_status: 'waiting_funds',
            cj_cost: totalCJCost,
            order_data: { paymentIntentId, availableOn: new Date(availableOnMs).toISOString() },
          },
          { onConflict: 'beezio_order_id' }
        );

      await supabase.from('orders').update({ fulfillment_status: 'waiting_funds', updated_at: new Date().toISOString() }).eq('id', orderId);

      return json(202, {
        message: 'Waiting for Stripe funds to clear into platform balance before ordering from CJ',
        cjOrderNumber,
        availableOn: new Date(availableOnMs).toISOString(),
      });
    }

    // Optional safety: ensure the platform balance has enough *available* USD to cover the CJ cost before ordering.
    // This doesn't perfectly "earmark" the exact charge, but it guarantees we're only purchasing once funds are available.
    try {
      const stripeClient = stripe();
      const balance = await stripeClient.balance.retrieve();
      const availableUsdCents =
        balance.available?.find((b) => b.currency === 'usd')?.amount ?? 0;
      const requiredUsdCents = Math.ceil(Number(totalCJCost || 0) * 100);

      if (requiredUsdCents > 0 && availableUsdCents < requiredUsdCents) {
        await supabase
          .from('cj_orders')
          .upsert(
            {
              beezio_order_id: orderId,
              cj_order_number: cjOrderNumber,
              cj_status: 'waiting_funds',
              cj_cost: totalCJCost,
              order_data: {
                paymentIntentId,
                requiredUsdCents,
                availableUsdCents,
              },
            },
            { onConflict: 'beezio_order_id' }
          );

        await supabase
          .from('orders')
          .update({ fulfillment_status: 'waiting_funds', updated_at: new Date().toISOString() })
          .eq('id', orderId);

        return json(202, {
          message: 'Waiting for sufficient available Stripe balance before ordering from CJ',
          cjOrderNumber,
          requiredUsdCents,
          availableUsdCents,
        });
      }
    } catch (e) {
      console.warn('Stripe balance check failed (continuing):', e instanceof Error ? e.message : e);
    }

    // Final inventory/backorder guard at fulfillment time (prevents ordering if stock changed post-checkout).
    for (const item of cjOrderItems) {
      await checkCjInventoryOrThrow(item);
    }

    // Create order in CJ system
    const cjOrderData = {
      orderNumber: cjOrderNumber,
      products: cjOrderItems,
      shippingAddress,
      logisticName,
      logisticCode: shippingOptionRow?.method_code ?? null,
      shippingOptionId: order.shipping_option_id ?? null,
    };

    console.log('Creating CJ order:', JSON.stringify(cjOrderData, null, 2));

    const cjOrderResponse = await cjRequest('shopping/order/createOrder', cjOrderData);

    console.log('CJ order created:', cjOrderResponse);

    // Store CJ order in database
    const orderDataPayload = {
      ...cjOrderData,
      shippingOption: shippingOptionRow
        ? {
            id: shippingOptionRow.id,
            methodName: shippingOptionRow.method_name,
            methodCode: shippingOptionRow.method_code,
            cost: Number(shippingOptionRow.cost ?? 0),
            destinationCountry: shippingOptionRow.destination_country,
          }
        : null,
    };

    const { error: insertError } = await supabase.from('cj_orders').upsert(
      {
        beezio_order_id: orderId,
        cj_order_number: cjOrderNumber,
        cj_order_id: cjOrderResponse.cjOrderId || cjOrderResponse.orderNumber,
        cj_status: 'pending',
        cj_cost: totalCJCost,
        order_data: orderDataPayload,
        error_message: null,
      },
      { onConflict: 'beezio_order_id' }
    );

    if (insertError) {
      console.error('Failed to store CJ order:', insertError);
      throw insertError;
    }

    // Update order status
    await supabase
      .from('orders')
      .update({
        fulfillment_status: 'processing',
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId);

    return json(200, {
      message: 'Order sent to CJ for fulfillment',
      cjOrderNumber,
      cjOrderId: cjOrderResponse.cjOrderId,
      totalCJCost,
    });

  } catch (error: any) {
    console.error('CJ fulfillment error:', error);
    const errorMessage = error?.message || String(error);
    const looksLikeInventoryBlock = /out of stock|backorder|insufficient stock/i.test(errorMessage);
    
    // Log error to database if order ID exists
    try {
      const { orderId } = JSON.parse(event.body || '{}');
      if (orderId) {
        const cjOrderNumber = `BZ-${orderId}`;
        await supabase.from('cj_orders').upsert(
          {
            beezio_order_id: orderId,
            cj_order_number: cjOrderNumber,
            cj_status: looksLikeInventoryBlock ? 'blocked_inventory' : 'failed',
            error_message: errorMessage,
            order_data: { error: errorMessage },
          },
          { onConflict: 'beezio_order_id' }
        );

        await supabase
          .from('orders')
          .update({
            fulfillment_status: looksLikeInventoryBlock ? 'blocked_inventory' : 'failed',
            updated_at: new Date().toISOString(),
          })
          .eq('id', orderId);
      }
    } catch (e) {
      console.error('Failed to log error:', e);
    }

    return json(500, {
      error: 'Fulfillment failed',
      message: errorMessage,
    });
  }
};
