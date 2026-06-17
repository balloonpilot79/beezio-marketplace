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

const siteUrl = String(
  process.env.URL ||
  process.env.DEPLOY_PRIME_URL ||
  process.env.SITE_URL ||
  'https://beezio.co'
).replace(/\/$/, '');

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const round2 = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
const roundRate = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 1000000) / 1000000;

const pickPositiveNumber = (...values) => {
  for (const value of values) {
    const num = Number(value);
    if (Number.isFinite(num) && num > 0) return num;
  }
  return 0;
};

const resolveAffiliateCommissionRate = (product, sellerAsk) => {
  const legacyPercent = Number(product?.partner_commission_percent);
  if (Number.isFinite(legacyPercent) && legacyPercent > 0) {
    return Math.max(0, legacyPercent) / 100;
  }

  const affiliateCommissionType = String(product?.affiliate_commission_type || '').trim().toLowerCase();
  const commissionType = String(product?.commission_type || '').trim().toLowerCase();
  const flatCommissionAmount = Number(product?.flat_commission_amount ?? 0);
  const hasFlatAmount = Number.isFinite(flatCommissionAmount) && flatCommissionAmount > 0;
  const hasExplicitAffiliateType = affiliateCommissionType === 'flat' || affiliateCommissionType === 'percent';
  const isFlatCommission =
    affiliateCommissionType === 'flat' ||
    (!hasExplicitAffiliateType && (
      commissionType === 'flat_rate' ||
      commissionType === 'fixed' ||
      hasFlatAmount
    ));

  if (isFlatCommission) {
    const flatValue = affiliateCommissionType === 'flat'
      ? pickPositiveNumber(product?.affiliate_commission_value, product?.affiliate_commission_rate)
      : pickPositiveNumber(
          product?.flat_commission_amount,
          !hasExplicitAffiliateType && (commissionType === 'flat_rate' || commissionType === 'fixed')
            ? pickPositiveNumber(product?.affiliate_commission_value, product?.affiliate_commission_rate, product?.commission_rate)
            : 0
        );
    if (!(flatValue > 0) || !(sellerAsk > 0)) return 0;
    return roundRate(Math.min(flatValue / sellerAsk, 1));
  }

  const rawPercent = pickPositiveNumber(
    product?.affiliate_commission_value,
    product?.affiliate_commission_rate,
    product?.commission_rate
  );
  if (!(rawPercent > 0)) return 0;
  return roundRate(rawPercent > 1 ? rawPercent / 100 : rawPercent);
};

async function repairOrder(order, productMap) {
  const { data: items, error: itemError } = await supabase
    .from('order_items')
    .select('id, product_id, price, computed_listing_price, partner_rate')
    .eq('order_id', order.id);

  if (itemError) throw itemError;
  if (!Array.isArray(items) || items.length === 0) return { updatedItems: 0, repaired: false };

  let updatedItems = 0;
  for (const item of items) {
    const existingRate = Number(item?.partner_rate || 0);
    if (existingRate > 0) continue;

    const product = productMap.get(String(item?.product_id || '').trim());
    if (!product) continue;

    const sellerAsk = Number(product?.seller_ask ?? product?.seller_amount ?? product?.seller_ask_price ?? 0);
    const partnerRate = resolveAffiliateCommissionRate(product, sellerAsk);
    if (!(partnerRate > 0)) continue;

    const { error: updateError } = await supabase
      .from('order_items')
      .update({ partner_rate: partnerRate })
      .eq('id', item.id);

    if (updateError) throw updateError;
    updatedItems += 1;
  }

  if (updatedItems === 0) return { updatedItems: 0, repaired: false };

  const response = await fetch(`${siteUrl}/.netlify/functions/paypal-capture-order`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderID: order.provider_order_id, forceRepair: true }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`${order.order_number || order.id}: ${payload?.error || response.statusText}`);
  }

  return { updatedItems, repaired: true, payload };
}

async function run() {
  const { data: orders, error: orderError } = await supabase
    .from('orders')
    .select('id,order_number,provider_order_id,payment_status,status,affiliate_id,partner_id')
    .eq('payment_status', 'paid')
    .not('provider_order_id', 'is', null)
    .or('affiliate_id.not.is.null,partner_id.not.is.null')
    .order('created_at', { ascending: false })
    .limit(500);

  if (orderError) throw orderError;
  if (!Array.isArray(orders) || orders.length === 0) {
    console.log('No paid affiliate-attributed PayPal orders found.');
    return;
  }

  const orderIds = orders.map((order) => order.id);
  const { data: itemRows, error: itemsError } = await supabase
    .from('order_items')
    .select('id,order_id,product_id,price,computed_listing_price,partner_rate')
    .in('order_id', orderIds);

  if (itemsError) throw itemsError;

  const candidateItems = (itemRows || []).filter((item) => !(Number(item?.partner_rate || 0) > 0));
  const productIds = Array.from(new Set(candidateItems.map((item) => String(item?.product_id || '').trim()).filter(Boolean)));
  if (productIds.length === 0) {
    console.log('No affiliate-attributed paid orders need partner_rate repair.');
    return;
  }

  const { data: products, error: productError } = await supabase
    .from('products')
    .select('id,price,commission_rate,commission_type,flat_commission_amount,affiliate_commission_rate,affiliate_commission_type,affiliate_commission_value,partner_commission_percent')
    .in('id', productIds);

  if (productError) throw productError;

  const productMap = new Map((products || []).map((product) => [String(product.id || '').trim(), product]));
  const candidateOrders = (orders || []).filter((order) =>
    candidateItems.some((item) => {
      const product = productMap.get(String(item.product_id || '').trim());
      const sellerAsk = Number(product?.seller_ask ?? product?.seller_amount ?? product?.seller_ask_price ?? 0);
      return resolveAffiliateCommissionRate(product, sellerAsk) > 0;
    })
  );

  if (candidateOrders.length === 0) {
    console.log('No paid affiliate-attributed orders could be repaired from product commission settings.');
    return;
  }

  let repairedOrders = 0;
  for (const order of candidateOrders) {
    const result = await repairOrder(order, productMap);
    if (!result.repaired) continue;
    repairedOrders += 1;
    console.log(`repaired ${order.order_number || order.id}: updated_items=${result.updatedItems}`);
  }

  console.log(`affiliate commission repair complete: ${repairedOrders} order(s) repaired`);
}

run().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});
