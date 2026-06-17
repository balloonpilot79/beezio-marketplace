// Netlify Function: CJ Dropshipping Webhook Handler
// Receives tracking updates and order status changes from CJ

import { createClient } from '@supabase/supabase-js';
import { buildShipmentEmail, sendTransactionalEmail } from './_lib/email';

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

// Unified pricing constants (match frontend ask-based model)
const PLATFORM_PERCENT = 0.15;
const PROCESSING_PERCENT = 0.029;
const PROCESSING_FIXED = 0.30;

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

const calculateFinalPrice = (sellerAskPerUnit: number, affiliatePercent: number): number => {
  const pAff = Math.max(0, affiliatePercent) / 100;
  const affiliateAmount = sellerAskPerUnit * pAff;
  const platformFee = (sellerAskPerUnit + affiliateAmount) * PLATFORM_PERCENT;
  return round2(sellerAskPerUnit + affiliateAmount + platformFee);
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
        cj_tracking_number: trackingNumber,
        cj_tracking_url: trackingUrl,
        fulfillment_status: 'shipped',
        updated_at: new Date().toISOString(),
      })
      .eq('id', cjOrder.beezio_order_id);

    try {
      const { data: orderRow } = await supabase
        .from('orders')
        .select('id, billing_email, billing_name')
        .eq('id', cjOrder.beezio_order_id)
        .maybeSingle();
      const recipient = String((orderRow as any)?.billing_email || '').trim();
      if (recipient) {
        const template = buildShipmentEmail({
          orderId: String((orderRow as any)?.id || cjOrder.beezio_order_id),
          buyerName: String((orderRow as any)?.billing_name || '').trim() || null,
          trackingNumber,
          trackingUrl,
          carrier: logisticName,
        });
        const emailResult = await sendTransactionalEmail({
          to: recipient,
          subject: template.subject,
          html: template.html,
        });
        if (!emailResult.sent) {
          console.warn('Shipment email skipped:', emailResult.reason);
        }
      }
    } catch (emailError) {
      console.warn('Shipment email failed (non-fatal):', emailError);
    }

    console.log(`Tracking number ${trackingNumber} added to order ${cjOrder.beezio_order_id}`);
  }
}

async function handleInventoryUpdate(data: any) {
  const { pid, vid, stock } = data;

  const normalizedPid = String(pid || '').trim();
  if (!normalizedPid) {
    console.warn('Inventory update skipped: missing pid');
    return;
  }

  const parsedStock = Number(stock);
  const hasValidStock = Number.isFinite(parsedStock);
  const normalizedStock = hasValidStock ? Math.max(0, Math.floor(parsedStock)) : null;

  console.log(
    `Inventory update: Product ${normalizedPid}${vid ? ` Variant ${vid}` : ''} -> ${hasValidStock ? normalizedStock : 'N/A'} units`
  );

  // Find corresponding Beezio product (same product id across all variants)
  const { data: mapping } = await supabase
    .from('cj_product_mappings')
    .select('beezio_product_id')
    .eq('cj_product_id', normalizedPid)
    .limit(1)
    .maybeSingle();

  if (mapping) {
    // If this update includes a CJ variant id, update the variant inventory too.
    if (vid && normalizedStock !== null) {
      const { error: variantError } = await supabase
        .from('product_variants')
        .update({
          inventory: normalizedStock,
          in_stock: normalizedStock > 0,
          updated_at: new Date().toISOString(),
        })
        .eq('provider', 'CJ')
        .eq('cj_product_id', normalizedPid)
        .eq('cj_variant_id', vid);

      if (variantError) {
        console.warn('Failed to update product_variants inventory:', variantError);
      }
    }

    // Prefer product stock to be the sum of variant inventories when variants exist.
    let nextProductStock: number | null = normalizedStock;
    try {
      const { data: variants } = await supabase
        .from('product_variants')
        .select('inventory')
        .eq('product_id', mapping.beezio_product_id)
        .eq('provider', 'CJ');

      const inventories = (variants || [])
        .map((v: any) => Number(v?.inventory))
        .filter((n: any) => Number.isFinite(n) && n >= 0) as number[];

      if (inventories.length > 0) {
        nextProductStock = inventories.reduce((acc, n) => acc + n, 0);
      }
    } catch (e) {
      // Ignore and fall back to webhook stock
    }

    if (nextProductStock === null) {
      console.warn(`Inventory update skipped for product ${mapping.beezio_product_id}: missing/invalid stock payload`);
      return;
    }

    // Update Beezio product stock
    await supabase
      .from('products')
      .update({
        stock_quantity: nextProductStock,
        total_inventory: nextProductStock,
        in_stock: nextProductStock > 0,
        updated_at: new Date().toISOString(),
      })
      .eq('id', mapping.beezio_product_id);

    console.log(`Updated stock for Beezio product ${mapping.beezio_product_id}: ${nextProductStock} units`);
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
    const rawMarkup = cjCost * (markupPercent / 100);
    const sellerAskPerUnit = round2(cjCost + Math.max(rawMarkup, 3));
    const finalPrice = calculateFinalPrice(sellerAskPerUnit, affiliatePercent);

    const affiliateAmount = round2(sellerAskPerUnit * (affiliatePercent / 100));
    const baseAmount = sellerAskPerUnit + affiliateAmount;
    const platformGross = round2(baseAmount * PLATFORM_PERCENT);
    const processingFee = round2(finalPrice * PROCESSING_PERCENT + PROCESSING_FIXED);

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
          platformSurcharge: 0,
          platformGross,
          processingPercent: PROCESSING_PERCENT * 100,
          processingFixed: PROCESSING_FIXED,
          processingFee,
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
