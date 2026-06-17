#!/usr/bin/env node
/* eslint-disable no-console */
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

require('dotenv').config({ path: path.join(process.cwd(), '.env.local') });
require('dotenv').config({ path: path.join(process.cwd(), '.env') });

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE ||
  process.env.SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error('Missing SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const ORDER_NUMBER_PREFIX = 'BZO';
const pad = (value) => String(value).padStart(2, '0');
const toMoney = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
const cents = (value) => Math.round(toMoney(value) * 100);
const nowIso = () => new Date().toISOString();
const sanitizeSeed = (value) => String(value || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
const formatDatePart = (date) => {
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}`;
};
const createBeezioOrderNumber = (seed, createdAt = new Date()) => {
  const cleaned = sanitizeSeed(seed || '');
  const suffix = (cleaned || sanitizeSeed(`${Date.now()}${Math.random().toString(36)}`))
    .slice(-8)
    .padStart(8, '0');
  return `${ORDER_NUMBER_PREFIX}-${formatDatePart(createdAt)}-${suffix}`;
};

function parseMaybeJson(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function firstFinite(...values) {
  for (const value of values) {
    const num = Number(value);
    if (Number.isFinite(num)) return num;
  }
  return 0;
}

async function getBuyer(excludedSellerId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, role, primary_role')
    .neq('id', excludedSellerId)
    .or('role.eq.buyer,primary_role.eq.buyer')
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error('Could not find a buyer profile for the synthetic order');
  return data;
}

async function getMarketplaceProduct() {
  const explicitProductId = String(process.argv[2] || '').trim();
  let query = supabase
    .from('products')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1);

  if (explicitProductId) {
    query = supabase.from('products').select('*').eq('id', explicitProductId).limit(1);
  }

  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(explicitProductId ? `Product not found: ${explicitProductId}` : 'No active marketplace product found');
  return data;
}

async function main() {
  const product = await getMarketplaceProduct();
  const buyer = await getBuyer(String(product.seller_id || ''));

  const variants = parseMaybeJson(product.variants);
  const variant = variants[0] || null;
  const createdAt = new Date();
  const orderNumber = createBeezioOrderNumber(product.id, createdAt);
  const quantity = 1;
  const itemPrice = toMoney(firstFinite(product.price, product.calculated_customer_price, 0));
  const shippingCost = toMoney(firstFinite(product.shipping_cost, product.shipping_price, 0));
  const taxAmount = 0;
  const subtotal = toMoney(itemPrice * quantity);
  const total = toMoney(subtotal + shippingCost + taxAmount);

  const sellerAsk = toMoney(
    firstFinite(
      product.seller_ask,
      product.seller_ask_price,
      product.seller_amount,
      variant && variant.variantSellPrice ? variant.variantSellPrice : 0,
      itemPrice
    )
  );
  const sellerEarnings = toMoney(Math.min(subtotal, sellerAsk * quantity || subtotal));
  const beezioFee = toMoney(Math.max(0, total - sellerEarnings));
  const affiliateRate = toMoney(firstFinite(product.affiliate_commission_rate, product.commission_rate, 0));
  const paidAt = nowIso();
  const syntheticSuffix = `${Date.now()}`;
  const syntheticPi = `manual_test_pi_${syntheticSuffix}`;
  const syntheticCharge = `manual_test_ch_${syntheticSuffix}`;
  const platformPercent = subtotal > 0 ? toMoney((beezioFee / subtotal) * 100) : 0;
  const holdReleaseAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
  const sourcePlatform =
    variant?.pid || variant?.vid || String(product.sku || '').toUpperCase().startsWith('CJ')
      ? 'cj'
      : (product.source_platform || null);

  const orderInsert = {
    order_number: orderNumber,
    buyer_id: buyer.id,
    seller_id: product.seller_id,
    product_id: product.id,
    quantity,
    total_amount: total,
    subtotal_amount: subtotal,
    subtotal_listing: subtotal,
    total_charged: total,
    shipping_amount: shippingCost,
    shipping_total: shippingCost,
    tax_amount: taxAmount,
    items_subtotal: subtotal,
    commission_amount: 0,
    status: 'completed',
    payment_provider: 'manual_test',
    stripe_payment_intent_id: syntheticPi,
    stripe_charge_id: syntheticCharge,
    paid_at: paidAt,
    fulfillment_status: 'pending',
    seller_payout: sellerEarnings,
    platform_fee: beezioFee,
    affiliate_commission: 0,
    affiliate_fee_amount: 0,
    beezio_fee_amount: beezioFee,
    processing_fee_amount: 0,
    currency: String(product.currency || 'USD'),
    platform_percent_at_purchase: platformPercent,
    affiliate_commission_percent_at_purchase: affiliateRate,
    shipping_address: {
      name: buyer.full_name || 'Synthetic Buyer',
      email: buyer.email || 'synthetic-buyer@beezio.local',
      address1: '123 Test Lane',
      city: 'Chicago',
      state: 'IL',
      zip: '60601',
      country: 'US',
      note: 'Synthetic successful purchase created by admin script. No gateway charge and no supplier order placed.',
    },
    shipping_info: {
      method: shippingCost > 0 ? 'Standard Shipping' : 'No shipping charge',
      synthetic: true,
    },
  };

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert(orderInsert)
    .select('*')
    .single();

  if (orderError) throw orderError;

  const orderItemInsert = {
    order_id: order.id,
    product_id: product.id,
    quantity,
    price: itemPrice,
    final_sale_price_per_unit: itemPrice,
    seller_ask_price_per_unit: sellerAsk,
    affiliate_commission_percent_at_purchase: affiliateRate,
    platform_percent_at_purchase: platformPercent,
    variant_id: null,
    shipping_cost: shippingCost,
    seller_ask_amount: sellerEarnings,
    computed_listing_price: itemPrice,
    source_platform: sourcePlatform,
    cj_product_id: String(product.cj_product_id || variant?.pid || '').trim() || null,
    cj_variant_id: String(variant?.vid || '').trim() || null,
    sku: String(product.sku || variant?.variantSku || '').trim() || null,
  };

  const { data: orderItems, error: itemError } = await supabase
    .from('order_items')
    .insert(orderItemInsert)
    .select('*');

  if (itemError) throw itemError;

  const transactionInsert = {
    order_id: order.id,
    stripe_payment_intent_id: syntheticPi,
    stripe_charge_id: syntheticCharge,
    amount_total_cents: cents(total),
    total_amount: total,
    currency: String(product.currency || 'USD'),
    status: 'completed',
  };

  const { data: transaction, error: transactionError } = await supabase
    .from('transactions')
    .insert(transactionInsert)
    .select('*')
    .single();

  if (transactionError) throw transactionError;

  const distributionRows = [
    {
      transaction_id: transaction.id,
      order_id: order.id,
      recipient_type: 'seller',
      recipient_id: product.seller_id,
      amount: sellerEarnings,
      percentage: 0,
      status: 'held',
      available_at: holdReleaseAt,
    },
    {
      transaction_id: transaction.id,
      order_id: order.id,
      recipient_type: 'platform',
      recipient_id: null,
      amount: beezioFee,
      percentage: 0,
      status: 'completed',
      paid_at: paidAt,
    },
  ].filter((row) => row.amount > 0);

  const { data: distributions, error: distributionError } = await supabase
    .from('payment_distributions')
    .insert(distributionRows)
    .select('*');

  if (distributionError) throw distributionError;

  let platformRevenue = null;
  if (beezioFee > 0) {
    const { data, error } = await supabase
      .from('platform_revenue')
      .insert({
        transaction_id: transaction.id,
        order_id: order.id,
        amount: beezioFee,
        revenue_type: 'manual_test_beezio_fee',
        month_year: createdAt.toISOString().slice(0, 7),
      })
      .select('*')
      .single();

    if (error) throw error;
    platformRevenue = data;
  }

  const payoutLedgerInsert = {
    order_id: order.id,
    seller_id: product.seller_id,
    partner_id: null,
    influencer_id: null,
    gross_amount: total,
    seller_earnings: sellerEarnings,
    partner_earnings: 0,
    influencer_earnings: 0,
    beezio_fee: beezioFee,
    paypal_fee_estimate: 0,
    status: 'PENDING_HOLD',
    hold_release_at: holdReleaseAt,
    notes: `Synthetic successful purchase for validation. Product ${product.id}. No external charge.`,
  };

  const { data: payoutLedger, error: payoutLedgerError } = await supabase
    .from('payout_ledger')
    .insert(payoutLedgerInsert)
    .select('*')
    .single();

  if (payoutLedgerError) throw payoutLedgerError;

  console.log(JSON.stringify({
    order,
    order_items: orderItems || [],
    transaction,
    payment_distributions: distributions || [],
    platform_revenue: platformRevenue,
    payout_ledger: payoutLedger,
    product_summary: {
      id: product.id,
      title: product.title,
      seller_id: product.seller_id,
      sku: product.sku || null,
      cj_product_id: product.cj_product_id || variant?.pid || null,
      cj_variant_id: variant?.vid || null,
      selected_variant_label: variant?.variantNameEn || variant?.variantKey || null,
    },
    buyer_summary: buyer,
  }, null, 2));
}

main().catch((err) => {
  console.error(`Synthetic order creation failed: ${err.message || err}`);
  process.exit(1);
});
