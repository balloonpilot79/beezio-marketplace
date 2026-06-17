import path from 'path';
import { spawnSync } from 'child_process';
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });
dotenv.config({ path: path.join(process.cwd(), '.env') });

const SITE_BASE_URL = String(process.env.E2E_SITE_BASE_URL || 'https://beezio.co').trim().replace(/\/$/, '');
const SUPABASE_URL = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
const SUPABASE_SERVICE_ROLE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const PAYPAL_ENV = String(process.env.PAYPAL_ENV || 'sandbox').trim().toLowerCase() === 'live' ? 'live' : 'sandbox';
const HEADLESS = String(process.env.E2E_HEADLESS || 'true').trim().toLowerCase() !== 'false';
const PAYPAL_AUTOMATION_MODE = String(process.env.PAYPAL_AUTOMATION_MODE || 'buyer-login').trim().toLowerCase();

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function requirePayPalCredential(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function hasPayPalCredential(name) {
  return String(process.env[name] || '').trim().length > 0;
}

function nowStamp() {
  return `${Date.now()}`.slice(-10);
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || '').trim());
}

async function createAuthUser({ email, password, fullName }) {
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error) throw error;
  const userId = String(data?.user?.id || '').trim();
  if (!isUuid(userId)) throw new Error(`Admin createUser returned invalid id for ${email}`);
  return data.user;
}

async function insertProfileResilient(payload) {
  const variants = [
    payload,
    Object.fromEntries(
      Object.entries(payload).filter(([key]) => !['subdomain', 'custom_domain', 'social_links'].includes(key))
    ),
  ];

  let lastError = null;
  for (const variant of variants) {
    const { error } = await supabaseAdmin.from('profiles').insert(variant);
    if (!error) return;
    lastError = error;
  }
  throw lastError;
}

async function insertStoreSettingsResilient(payload) {
  const variants = [
    payload,
    Object.fromEntries(Object.entries(payload).filter(([key]) => !['custom_domain', 'social_links', 'color_scheme'].includes(key))),
  ];

  let lastError = null;
  for (const variant of variants) {
    const { error } = await supabaseAdmin.from('store_settings').upsert(variant, { onConflict: 'seller_id' });
    if (!error) return;
    lastError = error;
  }
  throw lastError;
}

async function insertProductResilient(payload) {
  const variants = [
    payload,
    Object.fromEntries(Object.entries(payload).filter(([key]) => key !== 'status')),
  ];

  let lastResult = null;
  for (const variant of variants) {
    const result = await supabaseAdmin.from('products').insert(variant).select('id').single();
    if (!result.error) return result.data;
    lastResult = result;
  }
  throw lastResult?.error || new Error('Failed to create product');
}

async function ensureSellerProductOrderRow(payload) {
  const { error } = await supabaseAdmin.from('seller_product_order').insert(payload);
  if (error && String(error.code || '').trim() !== '23505') {
    throw error;
  }
}

async function fetchPayPalAccessToken() {
  const clientId =
    PAYPAL_ENV === 'live'
      ? String(process.env.PAYPAL_LIVE_CLIENT_ID || process.env.PAYPAL_CLIENT_ID || '').trim()
      : String(process.env.PAYPAL_SANDBOX_CLIENT_ID || process.env.PAYPAL_CLIENT_ID || '').trim();
  const secret =
    PAYPAL_ENV === 'live'
      ? String(process.env.PAYPAL_LIVE_CLIENT_SECRET || process.env.PAYPAL_CLIENT_SECRET || '').trim()
      : String(process.env.PAYPAL_SANDBOX_CLIENT_SECRET || process.env.PAYPAL_CLIENT_SECRET || '').trim();

  if (!clientId || !secret) {
    throw new Error('Missing PayPal API credentials.');
  }

  const auth = Buffer.from(`${clientId}:${secret}`).toString('base64');
  const apiBase = PAYPAL_ENV === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
  const response = await fetch(`${apiBase}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body?.access_token) {
    throw new Error(`Failed to fetch PayPal access token (${response.status}).`);
  }
  return { accessToken: String(body.access_token), apiBase };
}

async function fetchPayerActionUrl(orderID) {
  const { accessToken, apiBase } = await fetchPayPalAccessToken();
  const response = await fetch(`${apiBase}/v2/checkout/orders/${encodeURIComponent(orderID)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Failed to inspect PayPal order ${orderID} (${response.status}).`);
  }
  const payerActionUrl = (body?.links || []).find((entry) => entry?.rel === 'payer-action')?.href || null;
  return { status: String(body?.status || ''), payerActionUrl: String(payerActionUrl || '').trim() || null };
}

async function runStorefrontUiCheck({ buyerEmail, buyerPassword, storeUrl, productTitle }) {
  const browser = await chromium.launch({ headless: HEADLESS });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  const failedResponses = [];
  const consoleErrors = [];

  const completeBuyerLogin = async (nextPath) => {
    const loginUrl = `${SITE_BASE_URL}/account/login?next=${encodeURIComponent(nextPath)}`;
    await page.goto(loginUrl, { waitUntil: 'domcontentloaded', timeout: 120000 });

    const emailInput = page.locator('input[type="email"], input[name="email"], input[autocomplete="email"]').first();
    const passwordInput = page.locator('input[type="password"], input[name="password"], input[autocomplete="current-password"]').first();
    const submitButton = page.locator('button[type="submit"]').first();

    await emailInput.waitFor({ state: 'visible', timeout: 30000 });
    await emailInput.fill(buyerEmail);
    await passwordInput.fill(buyerPassword);
    await submitButton.click();

    await page.waitForFunction(
      () => !window.location.pathname.startsWith('/account/login'),
      { timeout: 60000 }
    );
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
  };

  const waitForPurchaseNavigation = async (expectedPattern) => {
    await page.waitForFunction(
      () => {
        const path = window.location.pathname;
        return path === '/cart' || path === '/checkout' || path.startsWith('/account/login');
      },
      { timeout: 60000 }
    );

    if (page.url().includes('/account/login')) {
      const nextTarget = expectedPattern.source.includes('checkout') ? '/checkout' : '/cart';
      await completeBuyerLogin(nextTarget);
    }

    await page.waitForURL(expectedPattern, { timeout: 60000 });
  };

  try {
    page.on('response', (response) => {
      const status = response.status();
      if (status >= 400) {
        failedResponses.push({
          status,
          url: response.url(),
          method: response.request().method(),
        });
      }
    });
    page.on('console', (message) => {
      if (message.type() === 'error') {
        consoleErrors.push(message.text());
      }
    });

    await completeBuyerLogin(new URL(storeUrl).pathname);
    await page.goto(storeUrl, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});

    await page.locator(`text=${productTitle}`).first().waitFor({ state: 'visible', timeout: 60000 });
    await page.locator('button:has-text("Add to Cart")').first().click();
    await waitForPurchaseNavigation(/\/cart(?:\?|$)/);
    await page.locator(`text=${productTitle}`).first().waitFor({ state: 'visible', timeout: 60000 });

    await page.locator('button:has-text("Checkout with PayPal"), button:has-text("Checkout")').first().click();
    await waitForPurchaseNavigation(/\/checkout(?:\?|$)/);

    await page.locator('input[name="name"]').first().fill('Sandbox Buyer');
    await page.locator('input[name="email"]').first().fill(buyerEmail);
    await page.locator('input[name="address-line1"]').first().fill('123 Sandbox St');
    await page.locator('input[name="address-level2"]').first().fill('Austin');
    await page.locator('input[name="address-level1"]').first().fill('TX');
    await page.locator('input[name="postal-code"]').first().fill('78701');

    return {
      ok: true,
      failedResponses,
      consoleErrors,
    };
  } finally {
    await browser.close();
  }
}

async function createSandboxOrder({ sellerId, buyerId, buyerEmail, productId, unitPrice }) {
  const payload = {
    cart: {
      line_items: [{ product_id: productId, variant_id: null, qty: 1, unit_price: unitPrice }],
      shipping_amount: 0,
      tax_amount: 0,
      currency: 'USD',
    },
    context: {
      seller_id: sellerId,
      buyer_id: buyerId,
      affiliate_id: null,
      storefront_id: sellerId,
      store_id: sellerId,
      source: 'seller_storefront',
    },
    customer: {
      email: buyerEmail,
      name: 'Sandbox Buyer',
    },
    shipping_info: {
      firstName: 'Sandbox',
      lastName: 'Buyer',
      address: '123 Sandbox St',
      address2: '',
      city: 'Austin',
      state: 'TX',
      zip: '78701',
      country: 'US',
      phone: '',
      email: buyerEmail,
      name: 'Sandbox Buyer',
    },
    success_url: `${SITE_BASE_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${SITE_BASE_URL}/checkout/cancel`,
  };

  const response = await fetch(`${SITE_BASE_URL}/api/paypal/create-order`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`create-order failed (${response.status}): ${String(body?.error || 'unknown error')}`);
  }
  const orderID = String(body?.orderID || '').trim();
  const beezioOrderId = String(body?.beezioOrderId || '').trim();
  if (!orderID || !beezioOrderId) {
    throw new Error('create-order returned no orderID/beezioOrderId');
  }
  return { orderID, beezioOrderId };
}

function runAutomationScript(scriptName, env) {
  const scriptPath = path.join(process.cwd(), 'scripts', scriptName);
  const result = spawnSync(process.execPath, [scriptPath], {
    cwd: process.cwd(),
    env: { ...process.env, ...env },
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    throw new Error(`${scriptName} failed with exit code ${result.status ?? 'unknown'}`);
  }
}

function isPayPalApprovalPending(body) {
  const text = `${String(body?.error || '')} ${String(body?.details || '')} ${String(body?.status || '')}`.toLowerCase();
  return (
    text.includes('approve') ||
    text.includes('approval') ||
    text.includes('payer_action_required') ||
    text.includes('payer action required') ||
    text.includes('payer')
  );
}

function resolveAutomationMode() {
  if (PAYPAL_AUTOMATION_MODE !== 'buyer-login') return PAYPAL_AUTOMATION_MODE;
  if (hasPayPalCredential('PAYPAL_SANDBOX_BUYER_EMAIL') && hasPayPalCredential('PAYPAL_SANDBOX_BUYER_PASSWORD')) {
    return 'buyer-login';
  }
  console.warn('PAYPAL_AUTOMATION_MODE=buyer-login requested, but sandbox buyer credentials are missing. Falling back to manual approval mode.');
  return 'none';
}

async function captureSandboxOrder(orderID) {
  const maxAttempts = 7;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetch(`${SITE_BASE_URL}/api/paypal/capture-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderID }),
      });
      const body = await response.json().catch(() => ({}));
      if (response.ok) {
        return body;
      }
      if (attempt < maxAttempts && isPayPalApprovalPending(body)) {
        console.log(`Capture still waiting on PayPal approval propagation (attempt ${attempt}/${maxAttempts}). Retrying...`);
        await new Promise((resolve) => setTimeout(resolve, 5000));
        continue;
      }
      throw new Error(`capture-order failed (${response.status}): ${String(body?.error || 'unknown error')}`);
    } catch (error) {
      if (attempt < maxAttempts) {
        console.log(`Capture request failed (attempt ${attempt}/${maxAttempts}): ${String(error?.message || error)}. Retrying...`);
        await new Promise((resolve) => setTimeout(resolve, 5000));
        continue;
      }
      throw error;
    }
  }
  throw new Error('capture-order failed: approval did not propagate in time');
}

async function main() {
  const stamp = nowStamp();
  const sellerEmail = `sandbox-seller-${stamp}@test.beezio.co`;
  const buyerEmail = `sandbox-buyer-${stamp}@test.beezio.co`;
  const password = `Testpass123!`;
  const slug = `sandbox-e2e-${stamp}`.slice(0, 26);
  const productTitle = `[SANDBOX E2E] Custom Store Product ${stamp}`;

  console.log('Custom-store sandbox flow');
  console.log('- Site:', SITE_BASE_URL);
  console.log('- PayPal env:', PAYPAL_ENV);
  const automationMode = resolveAutomationMode();
  console.log('- Automation mode:', automationMode);

  const sellerUser = await createAuthUser({ email: sellerEmail, password, fullName: `Sandbox Seller ${stamp}` });
  const buyerUser = await createAuthUser({ email: buyerEmail, password, fullName: `Sandbox Buyer ${stamp}` });

  await insertProfileResilient({
    id: sellerUser.id,
    user_id: sellerUser.id,
    email: sellerEmail,
    full_name: `Sandbox Seller ${stamp}`,
    role: 'seller',
    primary_role: 'seller',
    subdomain: slug,
  });
  await insertProfileResilient({
    id: buyerUser.id,
    user_id: buyerUser.id,
    email: buyerEmail,
    full_name: `Sandbox Buyer ${stamp}`,
    role: 'buyer',
    primary_role: 'buyer',
  });

  await insertStoreSettingsResilient({
    seller_id: sellerUser.id,
    subdomain: slug,
    store_name: `Sandbox Seller ${stamp}`,
    store_description: 'Automated custom-store sandbox flow for go-live verification.',
    store_theme: 'modern',
    social_links: {},
    color_scheme: {
      primary: '#0f172a',
      secondary: '#e2e8f0',
      accent: '#f59e0b',
      background: '#f8fafc',
      text: '#0f172a',
    },
  });

  const product = await insertProductResilient({
    title: productTitle,
    description: 'Automated physical-product checkout probe for seller custom-store launch.',
    seller_id: sellerUser.id,
    price: 21.5,
    seller_ask: 15,
    seller_amount: 15,
    seller_ask_price: 15,
    is_active: true,
    is_promotable: true,
    status: 'active',
    is_digital: false,
    requires_shipping: false,
    track_inventory: false,
    in_stock: true,
    stock_quantity: 10,
    total_inventory: 10,
    shipping_cost: 0,
    commission_rate: 20,
    commission_type: 'percentage',
    images: ['https://images.unsplash.com/photo-1513708927688-2f8c4412ff33?auto=format&fit=crop&w=900&q=80'],
  });

  await ensureSellerProductOrderRow({
    seller_id: sellerUser.id,
    product_id: product.id,
    display_order: 0,
    is_featured: true,
  });

  const storeUrl = `${SITE_BASE_URL}/store/${encodeURIComponent(slug)}`;
  console.log('- Store URL:', storeUrl);
  console.log('- Seller email:', sellerEmail);
  console.log('- Buyer email:', buyerEmail);
  console.log('- Product ID:', product.id);

  const uiCheck = await runStorefrontUiCheck({
    buyerEmail,
    buyerPassword: password,
    storeUrl,
    productTitle,
  });
  console.log('Storefront UI check passed: buyer login, add-to-cart, cart, and checkout route all loaded.');
  if (uiCheck.failedResponses.length) {
    console.log('- Browser 4xx/5xx responses during UI flow:', JSON.stringify(uiCheck.failedResponses, null, 2));
  }
  if (uiCheck.consoleErrors.length) {
    console.log('- Browser console errors during UI flow:', JSON.stringify(uiCheck.consoleErrors, null, 2));
  }

  const { orderID, beezioOrderId } = await createSandboxOrder({
    sellerId: sellerUser.id,
    buyerId: buyerUser.id,
    buyerEmail,
    productId: String(product.id),
    unitPrice: 21.5,
  });
  console.log('- PayPal order ID:', orderID);
  console.log('- Beezio order ID:', beezioOrderId);

  const { status, payerActionUrl } = await fetchPayerActionUrl(orderID);
  console.log('- PayPal status:', status || 'unknown');
  if (!payerActionUrl) {
    throw new Error('PayPal order was created without a payer-action URL.');
  }
  console.log('- Payer action URL:', payerActionUrl);

  if (automationMode === 'buyer-login') {
    requirePayPalCredential('PAYPAL_SANDBOX_BUYER_EMAIL');
    requirePayPalCredential('PAYPAL_SANDBOX_BUYER_PASSWORD');
    runAutomationScript('paypal-sandbox-approve.cjs', {
      PAYPAL_APPROVAL_URL: payerActionUrl,
    });
  } else if (automationMode === 'guest-card') {
    runAutomationScript('paypal-sandbox-guest-pay.cjs', {
      PAYPAL_APPROVAL_URL: payerActionUrl,
    });
  } else {
    console.log('Skipping automated approval. Open the payer-action URL, approve it, then rerun with PAYPAL_AUTOMATION_MODE=buyer-login or guest-card.');
    return;
  }

  const capture = await captureSandboxOrder(orderID);
  console.log('Capture response:', JSON.stringify(capture, null, 2));
}

main().catch((error) => {
  console.error(`Custom-store sandbox flow failed: ${error.message || error}`);
  process.exit(1);
});
