// Netlify Function: Fulfill CJ Dropshipping Orders
// Triggered after Stripe payment succeeds
// Creates order in CJ system and stores tracking info

import { createClient } from '@supabase/supabase-js';

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

export async function handler(event: any) {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const { orderId } = JSON.parse(event.body);

    if (!orderId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Order ID required' }),
      };
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

    // Check if order is already fulfilled
    const { data: existingCJOrder } = await supabase
      .from('cj_orders')
      .select('*')
      .eq('beezio_order_id', orderId)
      .maybeSingle();

    if (existingCJOrder) {
      console.log('Order already sent to CJ:', existingCJOrder.cj_order_number);
      return {
        statusCode: 200,
        body: JSON.stringify({
          message: 'Order already fulfilled',
          cjOrderNumber: existingCJOrder.cj_order_number,
        }),
      };
    }

    // Get CJ product mappings for order items
    const productIds = order.order_items.map((item: any) => item.product_id);
    
    const { data: cjMappings, error: mappingError } = await supabase
      .from('cj_product_mappings')
      .select('*')
      .in('beezio_product_id', productIds);

    if (mappingError || !cjMappings || cjMappings.length === 0) {
      console.log('No CJ mappings found for order items');
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'No dropship products in order' }),
      };
    }

    // Build CJ order items
    const cjOrderItems: CJOrderItem[] = [];
    let totalCJCost = 0;

    for (const item of order.order_items) {
      const mapping = cjMappings.find(m => m.beezio_product_id === item.product_id);
      if (mapping) {
        cjOrderItems.push({
          pid: mapping.cj_product_id,
          vid: mapping.cj_variant_id || undefined,
          quantity: item.quantity,
        });
        totalCJCost += mapping.cj_cost * item.quantity;
      }
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
      address: shippingInfo.address || order.billing_address || '',
      address2: shippingInfo.address2 || '',
      city: shippingInfo.city || '',
      state: shippingInfo.state || '',
      zip: shippingInfo.zip || shippingInfo.zipCode || '',
      country: shippingInfo.country || 'US',
      phone: shippingInfo.phone || '',
      email: order.billing_email || order.user_email || '',
    };

    // Create unique order number
    const cjOrderNumber = `BZ-${orderId.substring(0, 8)}-${Date.now()}`;

    // Create order in CJ system
    const cjOrderData = {
      orderNumber: cjOrderNumber,
      products: cjOrderItems,
      shippingAddress,
      logisticName: 'Standard Shipping',
    };

    console.log('Creating CJ order:', JSON.stringify(cjOrderData, null, 2));

    const cjOrderResponse = await cjRequest('shopping/order/createOrder', cjOrderData);

    console.log('CJ order created:', cjOrderResponse);

    // Store CJ order in database
    const { error: insertError } = await supabase
      .from('cj_orders')
      .insert({
        beezio_order_id: orderId,
        cj_order_number: cjOrderNumber,
        cj_order_id: cjOrderResponse.cjOrderId || cjOrderResponse.orderNumber,
        cj_status: 'pending',
        cj_cost: totalCJCost,
        order_data: cjOrderData,
      });

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

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Order sent to CJ for fulfillment',
        cjOrderNumber,
        cjOrderId: cjOrderResponse.cjOrderId,
        totalCJCost,
      }),
    };

  } catch (error: any) {
    console.error('CJ fulfillment error:', error);
    
    // Log error to database if order ID exists
    try {
      const { orderId } = JSON.parse(event.body);
      if (orderId) {
        await supabase
          .from('cj_orders')
          .insert({
            beezio_order_id: orderId,
            cj_order_number: `ERROR-${orderId}`,
            cj_status: 'failed',
            error_message: error.message,
            order_data: { error: error.message },
          });
      }
    } catch (e) {
      console.error('Failed to log error:', e);
    }

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Fulfillment failed',
        message: error.message,
      }),
    };
  }
}
