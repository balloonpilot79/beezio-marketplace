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

const LOW_PRICE_THRESHOLD = 25;
const LOW_PRICE_TOTAL_FEE = 2;
const DEFAULT_BEEZIO_PLATFORM_RATE = 0.15;
const DEFAULT_BEEZIO_UNDER_THRESHOLD_FLAT_FEE = 2;
const DEFAULT_BEEZIO_PERCENT_RATE_THRESHOLD = 25;
const DEFAULT_BEEZIO_PLATFORM_FEE_MIN = 0;
const DEFAULT_BEEZIO_PLATFORM_FEE_CAP = Number.MAX_SAFE_INTEGER;
const DEFAULT_BEEZIO_LARGE_ORDER_THRESHOLD = Number.MAX_SAFE_INTEGER;
const DEFAULT_BEEZIO_LARGE_ORDER_FLAT_FEE = 0;
const DEFAULT_PAYPAL_PERCENT = 0.0399;
const DEFAULT_PAYPAL_FIXED = 0.6;
const TEST_ITEM_PREFIX = 'test item';
const TEST_ITEM_BEEZIO_FEE = 0.1;
const TEST_ITEM_INFLUENCER_FEE = 0.05;
const JSON_FLAG = '--json';

const args = process.argv.slice(2);
const jsonOutput = args.includes(JSON_FLAG);
const identifier = String(args.find((arg) => arg && arg !== JSON_FLAG) || '').trim();

if (!identifier) {
  console.error('Usage: node scripts/verify-order-ledger.cjs <order_id|provider_order_id|order_number> [--json]');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const round2 = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

const asNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const isTestItemTitle = (value) => String(value || '').trim().toLowerCase().startsWith(TEST_ITEM_PREFIX);

const getReferrerBonusTotal = (amount, quantity) => {
  const normalizedAmount = Number.isFinite(amount) ? Math.max(0, amount) : 0;
  const normalizedQuantity = Number.isFinite(quantity) ? Math.max(0, Math.floor(quantity)) : 0;
  const perItem = normalizedAmount < LOW_PRICE_THRESHOLD ? 0.5 : 1;
  return round2(perItem * normalizedQuantity);
};

const getInfluencerReserveTotal = (amount, quantity) => round2(getReferrerBonusTotal(amount, quantity) * 2);

const isLowPriceAmount = (amount) => Number.isFinite(amount) && Number(amount) > 0 && Number(amount) < LOW_PRICE_THRESHOLD;

const getLowPriceFlatFeeTotal = (quantity) => round2(LOW_PRICE_TOTAL_FEE * Math.max(1, Math.floor(Number(quantity || 0) || 1)));

const computeBeezioPlatformFee = (sellerAsk, options = {}) => {
  const ask = Number.isFinite(sellerAsk) ? Math.max(0, sellerAsk) : 0;
  if (ask <= 0) return 0;

  const rate = Number.isFinite(options.rate) ? Math.max(0, Number(options.rate)) : DEFAULT_BEEZIO_PLATFORM_RATE;
  const underThresholdFlatFee = Number.isFinite(options.underThresholdFlatFee)
    ? Math.max(0, Number(options.underThresholdFlatFee))
    : DEFAULT_BEEZIO_UNDER_THRESHOLD_FLAT_FEE;
  const percentRateThreshold = Number.isFinite(options.percentRateThreshold)
    ? Math.max(0, Number(options.percentRateThreshold))
    : DEFAULT_BEEZIO_PERCENT_RATE_THRESHOLD;
  const minimum = Number.isFinite(options.minimum) ? Math.max(0, Number(options.minimum)) : DEFAULT_BEEZIO_PLATFORM_FEE_MIN;
  const cap = Number.isFinite(options.cap) ? Math.max(minimum, Number(options.cap)) : DEFAULT_BEEZIO_PLATFORM_FEE_CAP;
  const largeOrderThreshold = Number.isFinite(options.largeOrderThreshold)
    ? Math.max(0, Number(options.largeOrderThreshold))
    : DEFAULT_BEEZIO_LARGE_ORDER_THRESHOLD;
  const largeOrderFlatFee = Number.isFinite(options.largeOrderFlatFee)
    ? Math.max(0, Number(options.largeOrderFlatFee))
    : DEFAULT_BEEZIO_LARGE_ORDER_FLAT_FEE;

  if (largeOrderFlatFee > 0 && ask > largeOrderThreshold) {
    return round2(largeOrderFlatFee);
  }

  if (ask < percentRateThreshold) {
    return round2(underThresholdFlatFee);
  }

  return round2(Math.min(Math.max(ask * rate, minimum), cap));
};

const allocatePayPalFeeToLowPrice = (paypalFeeEstimate, lowPriceListingSubtotal, listingSubtotal) => {
  const paypal = Math.max(0, Number(paypalFeeEstimate) || 0);
  const lowSubtotal = Math.max(0, Number(lowPriceListingSubtotal) || 0);
  const totalSubtotal = Math.max(0, Number(listingSubtotal) || 0);
  if (paypal <= 0 || lowSubtotal <= 0 || totalSubtotal <= 0) return 0;
  return round2(paypal * Math.min(1, lowSubtotal / totalSubtotal));
};

const moneyEqual = (left, right, tolerance = 0.01) => Math.abs(round2(left) - round2(right)) <= tolerance;

const formatMoney = (value) => `$${round2(value).toFixed(2)}`;

const formatValue = (value) => {
  if (typeof value === 'number') return formatMoney(value);
  if (value === null || value === undefined || value === '') return 'none';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

const resolveLegacyPartnerLineTotal = (product, ask, quantity) => {
  const commissionType = String(product?.affiliate_commission_type || product?.commission_type || '').trim().toLowerCase();
  const flatCommission = round2(asNumber(product?.affiliate_commission_value, product?.flat_commission_amount));
  const useFlatPartnerCommission = (
    (commissionType === 'flat' || commissionType === 'flat_rate' || commissionType === 'fixed') &&
    flatCommission > 0
  );

  if (useFlatPartnerCommission) {
    return round2(flatCommission * quantity);
  }

  const legacyConfiguredPercent = Math.max(0, asNumber(product?.affiliate_commission_value, product?.commission_rate, 0));
  const legacyRate = legacyConfiguredPercent > 1 ? legacyConfiguredPercent / 100 : legacyConfiguredPercent;
  return round2(ask * quantity * legacyRate);
};

async function findOrder(identifierValue) {
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const matchers = [
    ...(uuidPattern.test(identifierValue) ? [{ field: 'id', value: identifierValue }] : []),
    { field: 'provider_order_id', value: identifierValue },
    { field: 'order_number', value: identifierValue },
  ];

  for (const matcher of matchers) {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq(matcher.field, matcher.value)
      .maybeSingle();
    if (error) throw error;
    if (data) return data;
  }

  return null;
}

function buildExpectedTotals(order, items, productMap, ledger, snapshotTotals) {
  let sellerAskTotal = 0;
  let partnerTotal = 0;
  let listingSubtotal = 0;
  let platformFeeGrossTotal = 0;
  let lowPriceFlatFeeTotal = 0;
  let lowPriceListingSubtotal = 0;
  let influencerReserveTotal = 0;

  for (const item of items) {
    const quantity = Math.max(1, Math.floor(asNumber(item.quantity, 1)));
    const ask = round2(Math.max(0, asNumber(item.seller_ask_amount, item.unit_price)));
    const listingUnit = round2(Math.max(0, asNumber(item.computed_listing_price, item.price)));
    const partnerRate = Math.max(0, asNumber(item.partner_rate, 0));
    const configuredPercentAtPurchase = Math.max(0, asNumber(item.affiliate_commission_percent_at_purchase, 0));
    const product = productMap.get(String(item.product_id || '').trim()) || null;
    const title = String(item.product_title || product?.title || product?.name || '').trim();
    const hasPartnerContext = (
      Boolean(String(order?.partner_id || order?.affiliate_id || ledger?.partner_id || '').trim()) ||
      partnerRate > 0 ||
      round2(asNumber(snapshotTotals.PARTNER, 0)) > 0
    );
    const isTestItem = isTestItemTitle(title);
    const isLowPriceItem = isLowPriceAmount(ask);

    const sellerLine = round2(ask * quantity);
    let partnerLine = 0;
    if (!hasPartnerContext) {
      partnerLine = 0;
    } else if (partnerRate > 0) {
      partnerLine = round2(ask * quantity * partnerRate);
    } else if (configuredPercentAtPurchase > 0) {
      const configuredRate = configuredPercentAtPurchase > 1
        ? configuredPercentAtPurchase / 100
        : configuredPercentAtPurchase;
      partnerLine = round2(ask * quantity * configuredRate);
    } else {
      partnerLine = resolveLegacyPartnerLineTotal(product, ask, quantity);
    }
    const influencerReserveLine = round2(
      isTestItem ? (TEST_ITEM_INFLUENCER_FEE * quantity * 2) : getInfluencerReserveTotal(ask, quantity)
    );
    const beezioFeeGrossLine = round2(
      isTestItem ? (TEST_ITEM_BEEZIO_FEE * quantity) : computeBeezioPlatformFee(sellerLine)
    );

    sellerAskTotal = round2(sellerAskTotal + sellerLine);
    partnerTotal = round2(partnerTotal + partnerLine);
    listingSubtotal = round2(listingSubtotal + (listingUnit * quantity));
    platformFeeGrossTotal = round2(platformFeeGrossTotal + beezioFeeGrossLine);
    influencerReserveTotal = round2(influencerReserveTotal + influencerReserveLine);

    if (isLowPriceItem) {
      lowPriceFlatFeeTotal = round2(lowPriceFlatFeeTotal + getLowPriceFlatFeeTotal(quantity));
      lowPriceListingSubtotal = round2(lowPriceListingSubtotal + (listingUnit * quantity));
    }
  }

  if (!listingSubtotal) {
    listingSubtotal = round2(asNumber(order.subtotal_listing, 0));
  }

  const influencerTotal = round2(asNumber(snapshotTotals.INFLUENCER, 0));
  const unusedInfluencerReserveTotal = round2(Math.max(influencerReserveTotal - influencerTotal, 0));
  const paypalFeeEstimate = round2(
    Number.isFinite(Number(ledger?.paypal_fee_estimate))
      ? Number(ledger.paypal_fee_estimate)
      : ((listingSubtotal * DEFAULT_PAYPAL_PERCENT) + DEFAULT_PAYPAL_FIXED)
  );
  const lowPricePayPalAllocated = allocatePayPalFeeToLowPrice(
    paypalFeeEstimate,
    lowPriceListingSubtotal,
    listingSubtotal
  );
  const lowPriceBeezioFeeGrossTotal = round2(Math.max(lowPriceFlatFeeTotal - lowPricePayPalAllocated, 0));
  const expectedBeezioRetainedTotal = round2(Math.max(
    listingSubtotal - sellerAskTotal - partnerTotal - influencerTotal - paypalFeeEstimate,
    0
  ));
  const baseBeezioFeeGrossTotal = round2(platformFeeGrossTotal + unusedInfluencerReserveTotal);
  const pricingRoundingRemainder = round2(expectedBeezioRetainedTotal - baseBeezioFeeGrossTotal);

  return {
    sellerAskTotal,
    partnerTotal,
    listingSubtotal,
    influencerTotal,
    influencerReserveTotal,
    unusedInfluencerReserveTotal,
    platformFeeGrossTotal,
    lowPriceFlatFeeTotal,
    lowPriceListingSubtotal,
    lowPricePayPalAllocated,
    lowPriceBeezioFeeGrossTotal,
    beezioFeeGrossTotal: platformFeeGrossTotal,
    expectedBeezioRetainedTotal,
    pricingRoundingRemainder,
    paypalFeeEstimate,
    totalCharged: round2(listingSubtotal + asNumber(order.shipping_amount, 0) + asNumber(order.tax_amount, 0)),
  };
}

function buildChecks(order, items, ledger, snapshots, products) {
  const productMap = new Map(products.map((product) => [String(product.id || '').trim(), product]));
  const snapshotTotals = snapshots.reduce((acc, row) => {
    const role = String(row.payee_role || '').trim().toUpperCase();
    acc[role] = round2((acc[role] || 0) + asNumber(row.amount, 0));
    return acc;
  }, {});
  const expected = buildExpectedTotals(order, items, productMap, ledger, snapshotTotals);

  const physicalItems = items.filter((item) => {
    const product = productMap.get(String(item.product_id || '').trim()) || null;
    const isDigital = product?.is_digital === true;
    const requiresShipping = product?.requires_shipping !== false;
    return !isDigital && requiresShipping;
  });

  const ledgerBeezioGross = round2(asNumber(ledger?.beezio_fee_gross, ledger?.platform_fee_gross));
  const ledgerBeezioNet = round2(asNumber(ledger?.beezio_fee_net, ledger?.beezio_fee));
  const retainedInfluencerReserve = round2(expected.unusedInfluencerReserveTotal);
  const distributedSubtotal = round2(
    asNumber(ledger?.seller_earnings, 0) +
    asNumber(ledger?.partner_earnings, 0) +
    asNumber(ledger?.influencer_earnings, 0) +
    ledgerBeezioNet +
    asNumber(ledger?.paypal_fee_estimate, 0) +
    retainedInfluencerReserve
  );
  const snapshotsWithHoldMismatch = snapshots.filter((row) => {
    const holdReleaseAt = String(row?.hold_release_at || '').trim();
    const jsonHoldReleaseAt = String(row?.snapshot_json?.hold_release_at || '').trim();
    return Boolean(holdReleaseAt && jsonHoldReleaseAt && holdReleaseAt !== jsonHoldReleaseAt);
  });

  const checks = [
    {
      name: 'Order finalized',
      pass: String(order.status || '').toLowerCase() === 'completed',
      actual: order.status,
      expected: 'completed',
    },
    {
      name: 'Payment marked paid',
      pass: String(order.payment_status || '').toLowerCase() === 'paid',
      actual: order.payment_status,
      expected: 'paid',
    },
    {
      name: 'Provider IDs recorded',
      pass: Boolean(String(order.provider_order_id || '').trim()) && Boolean(String(order.provider_capture_id || '').trim()),
      actual: { provider_order_id: order.provider_order_id || null, provider_capture_id: order.provider_capture_id || null },
      expected: 'provider_order_id + provider_capture_id',
    },
    {
      name: 'Order items logged',
      pass: items.length > 0,
      actual: items.length,
      expected: '> 0',
    },
    {
      name: 'Ledger row created',
      pass: Boolean(ledger?.id),
      actual: ledger?.id || null,
      expected: 'payout_ledger row',
    },
    {
      name: 'Payout snapshots created',
      pass: snapshots.length > 0,
      actual: snapshots.length,
      expected: '> 0',
    },
    {
      name: 'Subtotal matches order items',
      pass: moneyEqual(order.subtotal_listing, expected.listingSubtotal),
      actual: round2(asNumber(order.subtotal_listing, 0)),
      expected: expected.listingSubtotal,
    },
    {
      name: 'Seller split matches line items',
      pass: moneyEqual(ledger?.seller_earnings, expected.sellerAskTotal),
      actual: round2(asNumber(ledger?.seller_earnings, 0)),
      expected: expected.sellerAskTotal,
    },
    {
      name: 'Affiliate split matches line items',
      pass: moneyEqual(ledger?.partner_earnings, expected.partnerTotal),
      actual: round2(asNumber(ledger?.partner_earnings, 0)),
      expected: expected.partnerTotal,
    },
    {
      name: 'Beezio gross fee matches pricing rules',
      pass: moneyEqual(ledgerBeezioGross, expected.beezioFeeGrossTotal, 0.02),
      actual: ledgerBeezioGross,
      expected: expected.beezioFeeGrossTotal,
    },
    {
      name: 'PayPal fee estimate matches locked formula',
      pass: moneyEqual(ledger?.paypal_fee_estimate, expected.paypalFeeEstimate),
      actual: round2(asNumber(ledger?.paypal_fee_estimate, 0)),
      expected: expected.paypalFeeEstimate,
    },
    {
      name: 'Gross amount equals subtotal listing',
      pass: moneyEqual(ledger?.gross_amount, expected.listingSubtotal),
      actual: round2(asNumber(ledger?.gross_amount, 0)),
      expected: expected.listingSubtotal,
    },
    {
      name: 'Snapshots match ledger seller amount',
      pass: moneyEqual(snapshotTotals.SELLER || 0, ledger?.seller_earnings || 0),
      actual: round2(snapshotTotals.SELLER || 0),
      expected: round2(asNumber(ledger?.seller_earnings, 0)),
    },
    {
      name: 'Snapshots match ledger affiliate amount',
      pass: moneyEqual(snapshotTotals.PARTNER || 0, ledger?.partner_earnings || 0),
      actual: round2(snapshotTotals.PARTNER || 0),
      expected: round2(asNumber(ledger?.partner_earnings, 0)),
    },
    {
      name: 'Snapshots match ledger influencer amount',
      pass: moneyEqual(snapshotTotals.INFLUENCER || 0, ledger?.influencer_earnings || 0),
      actual: round2(snapshotTotals.INFLUENCER || 0),
      expected: round2(asNumber(ledger?.influencer_earnings, 0)),
    },
    {
      name: 'Total charged includes subtotal + shipping + tax',
      pass: moneyEqual(order.total_charged, expected.totalCharged),
      actual: round2(asNumber(order.total_charged, 0)),
      expected: expected.totalCharged,
    },
    {
      name: 'Subtotal is fully allocated across payees + PayPal',
      pass: moneyEqual(distributedSubtotal, expected.listingSubtotal),
      actual: distributedSubtotal,
      expected: expected.listingSubtotal,
    },
    {
      name: 'Unused influencer reserve is retained by Beezio',
      pass: moneyEqual(retainedInfluencerReserve, expected.unusedInfluencerReserveTotal),
      actual: retainedInfluencerReserve,
      expected: expected.unusedInfluencerReserveTotal,
    },
    {
      name: 'Seller can ship physical items',
      pass: physicalItems.length === 0 || (Boolean(order.seller_id) && Boolean(order.shipping_address)),
      actual: {
        physical_items: physicalItems.length,
        seller_id: order.seller_id || null,
        has_shipping_address: Boolean(order.shipping_address),
      },
      expected: 'seller_id + shipping_address for physical orders',
    },
    {
      name: 'Payout hold status recorded',
      pass: Boolean(ledger?.hold_release_at) && String(ledger?.status || '').trim().length > 0,
      actual: { status: ledger?.status || null, hold_release_at: ledger?.hold_release_at || null },
      expected: 'status + hold_release_at',
    },
    {
      name: 'Snapshot JSON hold dates match snapshot rows',
      pass: snapshotsWithHoldMismatch.length === 0,
      actual: snapshotsWithHoldMismatch.map((row) => ({
        id: row.id,
        hold_release_at: row.hold_release_at || null,
        snapshot_json_hold_release_at: row.snapshot_json?.hold_release_at || null,
      })),
      expected: [],
    },
  ];

  return {
    expected,
    checks,
    snapshotTotals: {
      seller: round2(snapshotTotals.SELLER || 0),
      partner: round2(snapshotTotals.PARTNER || 0),
      influencer: round2(snapshotTotals.INFLUENCER || 0),
    },
    physicalItems,
    ledgerBeezioGross,
    ledgerBeezioNet,
    retainedInfluencerReserve,
  };
}

function printReport(result) {
  const {
    order,
    items,
    payout_ledger: ledger,
    payout_snapshots: snapshots,
    products,
    analysis,
  } = result;
  const failed = analysis.checks.filter((check) => !check.pass);

  console.log('PayPal Order Audit');
  console.log('------------------');
  console.log(`Order ID: ${order.id}`);
  console.log(`Order Number: ${order.order_number || 'none'}`);
  console.log(`Provider Order ID: ${order.provider_order_id || 'none'}`);
  console.log(`Provider Capture ID: ${order.provider_capture_id || 'none'}`);
  console.log(`Status: ${order.status || 'none'} / ${order.payment_status || 'none'}`);
  console.log(`Items: ${items.length}`);
  console.log(`Products loaded: ${products.length}`);
  console.log(`Snapshots: ${snapshots.length}`);
  console.log();

  console.log('Money');
  console.log('-----');
  console.log(`Subtotal listing: ${formatMoney(order.subtotal_listing || 0)}`);
  console.log(`Shipping: ${formatMoney(order.shipping_amount || 0)}`);
  console.log(`Tax: ${formatMoney(order.tax_amount || 0)}`);
  console.log(`Total charged: ${formatMoney(order.total_charged || 0)}`);
  console.log(`Seller earnings: ${formatMoney(ledger?.seller_earnings || 0)}`);
  console.log(`Affiliate earnings: ${formatMoney(ledger?.partner_earnings || 0)}`);
  console.log(`Influencer earnings: ${formatMoney(ledger?.influencer_earnings || 0)}`);
  console.log(`Beezio fee gross: ${formatMoney(analysis.ledgerBeezioGross)}`);
  console.log(`Beezio fee net: ${formatMoney(analysis.ledgerBeezioNet)}`);
  console.log(`Beezio retained influencer reserve: ${formatMoney(analysis.retainedInfluencerReserve || 0)}`);
  console.log(`PayPal fee estimate: ${formatMoney(ledger?.paypal_fee_estimate || 0)}`);
  console.log();

  console.log('Checks');
  console.log('------');
  for (const check of analysis.checks) {
    const status = check.pass ? 'PASS' : 'FAIL';
    console.log(`${status} ${check.name}`);
    if (!check.pass) {
      console.log(`  actual:   ${formatValue(check.actual)}`);
      console.log(`  expected: ${formatValue(check.expected)}`);
    }
  }

  console.log();
  console.log(`Result: ${failed.length === 0 ? 'PASS' : `FAIL (${failed.length} issue${failed.length === 1 ? '' : 's'})`}`);
}

async function main() {
  const order = await findOrder(identifier);
  if (!order) {
    console.error(`Order not found: ${identifier}`);
    process.exit(2);
  }

  const { data: items, error: itemsError } = await supabase
    .from('order_items')
    .select('*')
    .eq('order_id', order.id);
  if (itemsError) throw itemsError;

  const { data: ledger, error: ledgerError } = await supabase
    .from('payout_ledger')
    .select('*')
    .eq('order_id', order.id)
    .maybeSingle();
  if (ledgerError) throw ledgerError;

  const { data: snapshots, error: snapshotsError } = await supabase
    .from('payout_snapshots')
    .select('*')
    .eq('order_id', order.id)
    .order('created_at', { ascending: true });
  if (snapshotsError) throw snapshotsError;

  const productIds = Array.from(new Set(((items || [])
    .map((item) => String(item?.product_id || '').trim())
    .filter(Boolean))));

  let products = [];
  if (productIds.length > 0) {
    const { data: productRows, error: productsError } = await supabase
      .from('products')
      .select('*')
      .in('id', productIds);
    if (productsError) throw productsError;
    products = productRows || [];
  }

  const analysis = buildChecks(order, items || [], ledger || null, snapshots || [], products);

  const result = {
    order,
    items: items || [],
    products,
    payout_ledger: ledger || null,
    payout_snapshots: snapshots || [],
    analysis,
  };

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  printReport(result);

  const failedCount = analysis.checks.filter((check) => !check.pass).length;
  if (failedCount > 0) {
    process.exitCode = 3;
  }
}

main().catch((err) => {
  console.error(`Verification failed: ${err.message || err}`);
  process.exit(1);
});
