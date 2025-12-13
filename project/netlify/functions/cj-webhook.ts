// Netlify Function: CJ Dropshipping Webhook Handler
// Receives tracking updates and order status changes from CJ

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.warn(
    'cj-webhook: Missing SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY. ' +
      'Set these in Netlify environment variables.'
  );
}

const supabase = createClient(
  SUPABASE_URL || 'http://localhost:54321',
  SUPABASE_SERVICE_ROLE_KEY || 'missing-service-role-key'
);

// Unified pricing constants (match frontend)
const STRIPE_PERCENT = 0.029;
const STRIPE_FIXED = 0.60;
const PLATFORM_PERCENT = 0.15;
const PLATFORM_FEE_UNDER_20_THRESHOLD = 20;
const PLATFORM_FEE_UNDER_20_SURCHARGE = 1;

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

const platformSurchargePerUnit = (sellerAskPerUnit: number): number =>
  Number.isFinite(sellerAskPerUnit) && sellerAskPerUnit > 0 && sellerAskPerUnit <= PLATFORM_FEE_UNDER_20_THRESHOLD
    ? PLATFORM_FEE_UNDER_20_SURCHARGE
    : 0;

const calculateFinalPrice = (sellerAskPerUnit: number, affiliatePercent: number): number => {
  const pAff = Math.max(0, affiliatePercent) / 100;
  const feePortion = pAff + PLATFORM_PERCENT + STRIPE_PERCENT;
  const denominator = 1 - feePortion;
  if (denominator <= 0) throw new Error('CJ_WEBHOOK_PRICING: invalid fee config; denominator <= 0');
  const surcharge = platformSurchargePerUnit(sellerAskPerUnit);
  return round2((sellerAskPerUnit + STRIPE_FIXED + surcharge) / denominator);
};

export async function handler(event: any) {
  // Allow OPTIONS for CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const payload = JSON.parse(event.body);
    console.log('CJ Webhook received:', JSON.stringify(payload, null, 2));

    const { eventType, data } = payload;

    switch (eventType) {
      case 'ORDER_STATUS_UPDATE':
        await handleOrderStatusUpdate(data);
        break;

      case 'TRACKING_NUMBER_UPDATE':
        await handleTrackingUpdate(data);
        break;

      case 'INVENTORY_UPDATE':
        await handleInventoryUpdate(data);
        break;

      case 'PRICE_UPDATE':
        await handlePriceUpdate(data);
        break;

      default:
        console.log('Unknown event type:', eventType);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ received: true }),
    };

  } catch (error: any) {
    console.error('CJ webhook error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
}

async function handleOrderStatusUpdate(data: any) {
  const { orderNumber, status, cjOrderId } = data;

  console.log(`Order status update: ${orderNumber} -> ${status}`);

  // Update CJ order record
  const { error: updateError } = await supabase
    .from('cj_orders')
    .update({
      cj_status: status.toLowerCase(),
      updated_at: new Date().toISOString(),
    })
    .eq('cj_order_number', orderNumber);

  if (updateError) {
    console.error('Failed to update CJ order status:', updateError);
    throw updateError;
  }

  // Update corresponding Beezio order
  const { data: cjOrder } = await supabase
    .from('cj_orders')
    .select('beezio_order_id')
    .eq('cj_order_number', orderNumber)
    .single();

  if (cjOrder) {
    let fulfillmentStatus = 'processing';
    
    if (status === 'SHIPPED' || status === 'DELIVERED') {
      fulfillmentStatus = 'shipped';
    } else if (status === 'CANCELLED' || status === 'FAILED') {
      fulfillmentStatus = 'failed';
    }

    await supabase
      .from('orders')
      .update({
        fulfillment_status: fulfillmentStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', cjOrder.beezio_order_id);
  }
}

async function handleTrackingUpdate(data: any) {
  const { orderNumber, trackingNumber, logisticName, trackingUrl } = data;

  console.log(`Tracking update for ${orderNumber}: ${trackingNumber}`);

  // Update CJ order with tracking info
  const { error: updateError } = await supabase
    .from('cj_orders')
    .update({
      cj_tracking_number: trackingNumber,
      cj_logistic_name: logisticName,
      cj_tracking_url: trackingUrl,
      updated_at: new Date().toISOString(),
      fulfilled_at: new Date().toISOString(),
    })
    .eq('cj_order_number', orderNumber);

  if (updateError) {
    console.error('Failed to update tracking info:', updateError);
    throw updateError;
  }

  // Update Beezio order with tracking
  const { data: cjOrder } = await supabase
    .from('cj_orders')
    .select('beezio_order_id')
    .eq('cj_order_number', orderNumber)
    .single();

  if (cjOrder) {
    await supabase
      .from('orders')
      .update({
        tracking_number: trackingNumber,
        tracking_url: trackingUrl,
        fulfillment_status: 'shipped',
        updated_at: new Date().toISOString(),
      })
      .eq('id', cjOrder.beezio_order_id);

    // TODO: Send tracking email to customer
    console.log(`Tracking number ${trackingNumber} added to order ${cjOrder.beezio_order_id}`);
  }
}

async function handleInventoryUpdate(data: any) {
  const { pid, vid, stock } = data;

  console.log(`Inventory update: Product ${pid}${vid ? ` Variant ${vid}` : ''} -> ${stock} units`);

  // Find corresponding Beezio product
  const query = supabase
    .from('cj_product_mappings')
    .select('beezio_product_id')
    .eq('cj_product_id', pid);

  if (vid) {
    query.eq('cj_variant_id', vid);
  }

  const { data: mapping } = await query.maybeSingle();

  if (mapping) {
    // Update Beezio product stock
    await supabase
      .from('products')
      .update({
        stock_quantity: stock,
        updated_at: new Date().toISOString(),
      })
      .eq('id', mapping.beezio_product_id);

    console.log(`Updated stock for Beezio product ${mapping.beezio_product_id}: ${stock} units`);
  }
}

async function handlePriceUpdate(data: any) {
  const { pid, vid, newPrice } = data;

  console.log(`Price update: Product ${pid}${vid ? ` Variant ${vid}` : ''} -> $${newPrice}`);

  // Find corresponding Beezio product
  const query = supabase
    .from('cj_product_mappings')
    .select('*')
    .eq('cj_product_id', pid);

  if (vid) {
    query.eq('cj_variant_id', vid);
  }

  const { data: mapping } = await query.maybeSingle();

  if (mapping) {
    // Recalculate Beezio price with new CJ cost
    const cjCost = Number(newPrice);
    const markupPercent = Number(mapping.markup_percent) || 0;
    const affiliatePercent = Number(mapping.affiliate_commission_percent) || 0;

    // Seller ask = CJ cost + seller profit markup
    const sellerAskPerUnit = round2(cjCost * (1 + markupPercent / 100));
    const finalPrice = calculateFinalPrice(sellerAskPerUnit, affiliatePercent);

    const surcharge = platformSurchargePerUnit(sellerAskPerUnit);
    const affiliateAmount = round2(finalPrice * (affiliatePercent / 100));
    const platformGross = round2(finalPrice * PLATFORM_PERCENT + surcharge);
    const stripeFee = round2(finalPrice * STRIPE_PERCENT + STRIPE_FIXED);

    // Update mapping
    await supabase
      .from('cj_product_mappings')
      .update({
        cj_cost: cjCost,
        price_breakdown: {
          cjCost,
          markupPercent,
          sellerAsk: sellerAskPerUnit,
          affiliatePercent,
          affiliateAmount,
          platformPercent: PLATFORM_PERCENT * 100,
          platformSurcharge: surcharge,
          platformGross,
          stripePercent: STRIPE_PERCENT * 100,
          stripeFixed: STRIPE_FIXED,
          stripeFee,
          finalPrice,
        },
        last_synced: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', mapping.id);

    // Update Beezio product price
    await supabase
      .from('products')
      .update({
        price: finalPrice,
        updated_at: new Date().toISOString(),
      })
      .eq('id', mapping.beezio_product_id);

    console.log(`Updated price for Beezio product ${mapping.beezio_product_id}: $${finalPrice}`);
  }
}
