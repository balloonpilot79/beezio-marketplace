#!/usr/bin/env node
/* eslint-disable no-console */
const path = require('path');
const { randomUUID } = require('crypto');

require('dotenv').config({ path: path.join(process.cwd(), '.env.local') });
require('dotenv').config({ path: path.join(process.cwd(), '.env') });

const BASE_URL = (process.env.PAYPAL_SMOKE_BASE_URL || 'https://beezio.co').replace(/\/$/, '');
const BUYER_EMAIL = process.env.PAYPAL_SMOKE_BUYER_EMAIL || 'paypal-checkout-smoke@beezio.co';
const BUYER_NAME = process.env.PAYPAL_SMOKE_BUYER_NAME || 'PayPal Smoke Buyer';
const AFFILIATE_ID = String(process.env.PAYPAL_SMOKE_AFFILIATE_ID || '').trim() || null;
const PRODUCT_ID_OVERRIDE = String(process.env.PAYPAL_SMOKE_PRODUCT_ID || '').trim() || null;
const TRY_DIRECT_CAPTURE = String(process.env.PAYPAL_SMOKE_TRY_CAPTURE_DIRECT || '').trim().toLowerCase() === 'true';
let detectedPayPalEnv = null;

async function fetchJson(url, init = {}) {
  const res = await fetch(url, init);
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

function getPayPalBaseUrl() {
  const runtimeEnv = String(detectedPayPalEnv || process.env.PAYPAL_ENV || 'sandbox').trim().toLowerCase();
  return runtimeEnv === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';
}

async function getPayPalAccessToken() {
  const runtimeEnv = String(detectedPayPalEnv || process.env.PAYPAL_ENV || 'sandbox').trim().toLowerCase();
  const clientId = runtimeEnv === 'live'
    ? String(process.env.PAYPAL_LIVE_CLIENT_ID || process.env.PAYPAL_CLIENT_ID || '').trim()
    : String(process.env.PAYPAL_SANDBOX_CLIENT_ID || process.env.PAYPAL_CLIENT_ID || '').trim();
  const secret = runtimeEnv === 'live'
    ? String(process.env.PAYPAL_LIVE_CLIENT_SECRET || process.env.PAYPAL_CLIENT_SECRET || '').trim()
    : String(process.env.PAYPAL_SANDBOX_CLIENT_SECRET || process.env.PAYPAL_CLIENT_SECRET || '').trim();
  if (!clientId || !secret) {
    throw new Error('Missing PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET');
  }

  const auth = Buffer.from(`${clientId}:${secret}`).toString('base64');
  const tokenRes = await fetch(`${getPayPalBaseUrl()}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  const tokenBody = await tokenRes.json().catch(() => ({}));
  if (!tokenRes.ok || !tokenBody?.access_token) {
    throw new Error(`PayPal token fetch failed (${tokenRes.status})`);
  }
  return tokenBody.access_token;
}

async function getPayerActionUrl(orderId) {
  const token = await getPayPalAccessToken();
  const orderRes = await fetch(`${getPayPalBaseUrl()}/v2/checkout/orders/${encodeURIComponent(orderId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const orderBody = await orderRes.json().catch(() => ({}));
  if (!orderRes.ok) {
    throw new Error(`PayPal order lookup failed (${orderRes.status})`);
  }
  const payerActionUrl = (orderBody?.links || []).find((l) => l.rel === 'payer-action')?.href || null;
  return { status: orderBody?.status || null, payerActionUrl };
}

function isExpectedApprovalPending(captureBody) {
  const text = `${String(captureBody?.error || '')} ${String(captureBody?.details || '')}`.toLowerCase();
  return (
    text.includes('approve') ||
    text.includes('approval') ||
    text.includes('payer') ||
    text.includes('not approved') ||
    text.includes('order_not_approved')
  );
}

function hasSellableInventory(product) {
  const tracked = product?.track_inventory === true;
  if (!tracked) return true;
  const rawInventory =
    typeof product?.stock_quantity === 'number' && Number.isFinite(product.stock_quantity)
      ? product.stock_quantity
      : typeof product?.total_inventory === 'number' && Number.isFinite(product.total_inventory)
      ? product.total_inventory
      : null;
  if (typeof rawInventory === 'number') return rawInventory > 0;
  if (typeof product?.in_stock === 'boolean') return product.in_stock === true;
  return true;
}

async function main() {
  console.log(`PayPal smoke base URL: ${BASE_URL}`);
  console.log(`Affiliate mode: ${AFFILIATE_ID ? `ON (${AFFILIATE_ID})` : 'OFF'}`);

  const status = await fetchJson(`${BASE_URL}/api/paypal/status`);
  if (!status.ok) {
    throw new Error(`paypal/status failed (${status.status})`);
  }
  detectedPayPalEnv = String(status.body?.env || '').trim().toLowerCase() || null;
  console.log(`PayPal status: ok=${status.body?.ok} env=${status.body?.env}`);

  const products = await fetchJson(`${BASE_URL}/api/public/marketplace/products?limit=200`);
  if (!products.ok || !Array.isArray(products.body?.products) || products.body.products.length === 0) {
    throw new Error('No marketplace product available for smoke test');
  }

  const list = products.body.products;
  const selected = PRODUCT_ID_OVERRIDE
    ? list.find((item) => String(item?.id || '').trim() === PRODUCT_ID_OVERRIDE)
    : list.find((item) => hasSellableInventory(item)) || list[0];
  if (!selected) {
    throw new Error(`Requested PAYPAL_SMOKE_PRODUCT_ID not found in marketplace list: ${PRODUCT_ID_OVERRIDE}`);
  }

  const p = selected;
  const productId = String(p.id);
  const sellerId = String(p.seller_id);
  const unitPrice = Number(p.price || 0);
  if (!productId || !sellerId || !(unitPrice > 0)) {
    throw new Error('Marketplace product missing id/seller/price');
  }
  console.log(`Using product: id=${productId} seller=${sellerId} price=${unitPrice.toFixed(2)}`);

  const trace = randomUUID();
  const createPayload = {
    cart: {
      line_items: [{ product_id: productId, variant_id: null, qty: 1, unit_price: unitPrice }],
      shipping_amount: 0,
      tax_amount: 0,
      currency: 'USD',
    },
    context: {
      seller_id: sellerId,
      buyer_id: null,
      affiliate_id: AFFILIATE_ID,
    },
    customer: {
      email: BUYER_EMAIL,
      name: BUYER_NAME,
    },
    shipping_info: {
      firstName: 'PayPal',
      lastName: 'Smoke',
      address: '123 Test St',
      address2: '',
      city: 'Austin',
      state: 'TX',
      zip: '78701',
      country: 'US',
      phone: '',
      email: BUYER_EMAIL,
      name: BUYER_NAME,
    },
    shipping_option: null,
    success_url: `${BASE_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${BASE_URL}/checkout/cancel`,
    trace,
  };

  const created = await fetchJson(`${BASE_URL}/api/paypal/create-order`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(createPayload),
  });
  if (!created.ok) {
    throw new Error(`paypal/create-order failed (${created.status}): ${String(created.body?.error || 'unknown')}`);
  }

  const orderID = String(created.body?.orderID || '');
  const beezioOrderId = String(created.body?.beezioOrderId || '');
  if (!orderID || !beezioOrderId) {
    throw new Error('create-order missing orderID or beezioOrderId');
  }

  console.log(`Created order: orderID=${orderID} beezioOrderId=${beezioOrderId}`);

  try {
    const payerAction = await getPayerActionUrl(orderID);
    if (!payerAction.status) throw new Error('empty status');
    console.log(`PayPal order status: ${payerAction.status}`);
    if (payerAction.payerActionUrl) {
      console.log('Payer action URL:');
      console.log(payerAction.payerActionUrl);
      console.log('Open URL, approve payment, then run:');
      console.log(`curl -X POST ${BASE_URL}/api/paypal/capture-order -H "Content-Type: application/json" -d "{\"orderID\":\"${orderID}\"}"`);
    }
  } catch (err) {
    console.log(`PayPal direct status lookup unavailable (${String(err?.message || err)}). Continuing with backend capture probe.`);
  }

  const capture = await fetchJson(`${BASE_URL}/api/paypal/capture-order`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderID }),
  });
  const state = String(capture.body?.status || capture.body?.state || 'unknown');
  console.log(`Capture probe: status=${capture.status} ok=${capture.ok} state=${state}`);
  if (capture.ok) {
    console.log('Capture succeeded.');
  } else if (isExpectedApprovalPending(capture.body)) {
    console.log('Capture blocked pending payer approval (expected for smoke run without interactive approval).');
  } else if (TRY_DIRECT_CAPTURE) {
    throw new Error(`capture-order failed (${capture.status}): ${String(capture.body?.error || 'unknown')}`);
  } else {
    console.log('Capture probe returned non-approved status outside interactive flow.');
  }
}

main().catch((err) => {
  console.error(`Smoke test failed: ${err.message}`);
  process.exit(1);
});
