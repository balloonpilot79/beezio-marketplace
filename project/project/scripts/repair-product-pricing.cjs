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

const DEFAULT_ZERO_AFFILIATE_PERCENT = 30;
const LOW_PRICE_THRESHOLD = 25;
const LOW_PRICE_TOTAL_FEE = 2;
const DEFAULT_BEEZIO_PLATFORM_RATE = 0.15;
const PAYPAL_PERCENT = 0.0399;
const PAYPAL_FIXED = 0.6;

const round2 = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
const ceil2 = (value) => Math.ceil((Number(value || 0) + Number.EPSILON) * 100) / 100;

const pickPositiveNumber = (...values) => {
  for (const value of values) {
    const num = Number(value);
    if (Number.isFinite(num) && num > 0) return num;
  }
  return 0;
};

const isLowPriceAmount = (amount) => Number.isFinite(amount) && Number(amount) > 0 && Number(amount) < LOW_PRICE_THRESHOLD;

const computeBeezioPlatformFee = (sellerAsk) => {
  const ask = Number.isFinite(sellerAsk) ? Math.max(0, sellerAsk) : 0;
  if (ask <= 0) return 0;
  if (isLowPriceAmount(ask)) return LOW_PRICE_TOTAL_FEE;
  return round2(ask * DEFAULT_BEEZIO_PLATFORM_RATE);
};

const getInfluencerReserveTotal = (amount) => {
  const ask = Number.isFinite(amount) ? Math.max(0, amount) : 0;
  if (ask <= 0) return 0;
  return ask < 20 ? 1 : 2;
};

const resolveStoredAffiliateCommission = (product) => {
  const affiliateCommissionType = String(product?.affiliate_commission_type || '').trim().toLowerCase();
  const commissionType = String(product?.commission_type || '').trim().toLowerCase();
  const flatCommissionAmount = Number(product?.flat_commission_amount ?? 0);
  const hasFlatAmount = Number.isFinite(flatCommissionAmount) && flatCommissionAmount > 0;
  const normalizedType =
    affiliateCommissionType === 'flat' ||
    commissionType === 'flat_rate' ||
    commissionType === 'fixed' ||
    hasFlatAmount
      ? 'flat'
      : 'percent';

  if (normalizedType === 'flat') {
    const flatValue = pickPositiveNumber(
      product?.flat_commission_amount,
      affiliateCommissionType === 'flat' || commissionType === 'flat_rate' || commissionType === 'fixed'
        ? pickPositiveNumber(product?.affiliate_commission_value, product?.affiliate_commission_rate, product?.commission_rate)
        : 0,
    );
    if (!(flatValue > 0)) {
      return { type: 'percent', value: DEFAULT_ZERO_AFFILIATE_PERCENT };
    }
    return { type: 'flat', value: round2(flatValue) };
  }

  const rawPercent = pickPositiveNumber(
    product?.affiliate_commission_value,
    product?.affiliate_commission_rate,
    product?.commission_rate,
    DEFAULT_ZERO_AFFILIATE_PERCENT,
  );
  const percent = rawPercent > 1 ? rawPercent : rawPercent * 100;
  return { type: 'percent', value: round2(percent) };
};

const computeAffiliateAmount = (sellerAsk, type, value) => {
  const ask = Number.isFinite(sellerAsk) ? Math.max(0, sellerAsk) : 0;
  const amount = Number.isFinite(value) ? Math.max(0, value) : 0;
  if (ask <= 0 || amount <= 0) return 0;
  if (type === 'flat') return round2(amount);
  return round2(ask * (amount > 1 ? amount / 100 : amount));
};

const computeCustomerListingPrice = (sellerAsk, affiliateType, affiliateValue) => {
  const ask = Number.isFinite(sellerAsk) ? Math.max(0, sellerAsk) : 0;
  const affiliateAmount = computeAffiliateAmount(ask, affiliateType, affiliateValue);
  const platformFee = computeBeezioPlatformFee(ask);
  const influencerReserve = getInfluencerReserveTotal(ask);
  const subtotalBeforeProcessor = ask + affiliateAmount + platformFee + influencerReserve;
  if (!isLowPriceAmount(ask)) return ceil2(subtotalBeforeProcessor);
  return ceil2((subtotalBeforeProcessor + PAYPAL_FIXED) / (1 - PAYPAL_PERCENT));
};

async function main() {
  const onlyProductId = String(process.argv[2] || '').trim() || null;
  const selectFields = 'id,title,price,calculated_customer_price,seller_ask,seller_amount,seller_ask_price,platform_fee,commission_rate,affiliate_commission_rate,commission_type,flat_commission_amount,affiliate_commission_type,affiliate_commission_value,is_active,updated_at';
  const rows = [];
  const pageSize = 500;

  if (onlyProductId) {
    const { data: products, error } = await supabase
      .from('products')
      .select(selectFields)
      .eq('id', onlyProductId)
      .limit(1);
    if (error) throw error;
    rows.push(...(Array.isArray(products) ? products : []));
  } else {
    for (let offset = 0; ; offset += pageSize) {
      const { data: products, error } = await supabase
        .from('products')
        .select(selectFields)
        .order('id', { ascending: true })
        .range(offset, offset + pageSize - 1);
      if (error) throw error;

      const pageRows = Array.isArray(products) ? products : [];
      if (!pageRows.length) break;
      rows.push(...pageRows);
      if (pageRows.length < pageSize) break;
    }
  }

  const updates = [];

  for (const product of rows) {
    const sellerAsk = round2(
      pickPositiveNumber(product?.seller_ask, product?.seller_amount, product?.seller_ask_price)
    );
    if (!(sellerAsk > 0)) continue;

    const affiliate = resolveStoredAffiliateCommission(product);
    const nextPrice = round2(computeCustomerListingPrice(sellerAsk, affiliate.type, affiliate.value));
    const nextPlatformFee = round2(computeBeezioPlatformFee(sellerAsk));
    const currentPrice = round2(Number(product?.price || 0));
    const currentCalculated = round2(Number(product?.calculated_customer_price || 0));
    const currentPlatformFee = round2(Number(product?.platform_fee || 0));

    if (currentPrice === nextPrice && currentCalculated === nextPrice && currentPlatformFee === nextPlatformFee) {
      continue;
    }

    updates.push({
      id: product.id,
      title: product.title,
      before_price: currentPrice,
      after_price: nextPrice,
      before_calculated_customer_price: currentCalculated,
      after_calculated_customer_price: nextPrice,
      before_platform_fee: currentPlatformFee,
      after_platform_fee: nextPlatformFee,
      affiliate_type: affiliate.type,
      affiliate_value: affiliate.value,
    });

    const { error: updateError } = await supabase
      .from('products')
      .update({
        price: nextPrice,
        calculated_customer_price: nextPrice,
        platform_fee: nextPlatformFee,
        updated_at: new Date().toISOString(),
      })
      .eq('id', product.id);
    if (updateError) throw updateError;
  }

  console.log(JSON.stringify({
    repaired_count: updates.length,
    repairs: updates,
  }, null, 2));
}

main().catch((err) => {
  console.error(`Product pricing repair failed: ${err.message || err}`);
  process.exit(1);
});
