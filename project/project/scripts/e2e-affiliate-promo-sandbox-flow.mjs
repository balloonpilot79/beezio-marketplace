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

function nowStamp() {
  return `${Date.now()}`.slice(-10);
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || '').trim());
}

function hasPayPalCredential(name) {
  return String(process.env[name] || '').trim().length > 0;
}

function requirePayPalCredential(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
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

function extractMissingColumnName(error) {
  const msg = [String(error?.message || ''), String(error?.details || '')].filter(Boolean).join(' | ');
  const pg = msg.match(/column\s+"([^"]+)"\s+of\s+relation\s+"[^"]+"\s+does\s+not\s+exist/i);
  if (pg?.[1]) return pg[1];
  const pgDot = msg.match(/column\s+([a-z0-9_]+\.[a-z0-9_]+)\s+does\s+not\s+exist/i);
  if (pgDot?.[1]) return pgDot[1].split('.').pop() || pgDot[1];
  const pgrst = msg.match(/Could not find the '([^']+)' column of '[^']+' in the schema cache/i);
  if (pgrst?.[1]) return pgrst[1];
  return null;
}

async function insertAffiliateLinkResilient(payload) {
  let working = { ...payload };
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const { data, error } = await supabaseAdmin
      .from('affiliate_links')
      .insert(working)
      .select('*')
      .maybeSingle();
    if (!error) return { data, error: null };
    const code = String(error?.code || '').trim();
    if (code === '23505') return { data: null, error: null };
    const missing = extractMissingColumnName(error);
    if (missing && Object.prototype.hasOwnProperty.call(working, missing)) {
      delete working[missing];
      continue;
    }
    return { data: null, error };
  }
  return { data: null, error: new Error('Failed to insert affiliate_links row') };
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

function resolveAutomationMode() {
  if (PAYPAL_AUTOMATION_MODE !== 'buyer-login') return PAYPAL_AUTOMATION_MODE;
  if (hasPayPalCredential('PAYPAL_SANDBOX_BUYER_EMAIL') && hasPayPalCredential('PAYPAL_SANDBOX_BUYER_PASSWORD')) {
    return 'buyer-login';
  }
  console.warn('PAYPAL_AUTOMATION_MODE=buyer-login requested, but sandbox buyer credentials are missing. Falling back to guest-card mode.');
  return 'guest-card';
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

async function runPromoUiCheck({ buyerEmail, buyerPassword, affiliateLink, productTitle }) {
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

    await page.waitForFunction(() => !window.location.pathname.startsWith('/account/login'), { timeout: 60000 });
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
  };

  try {
    page.on('dialog', (dialog) => dialog.accept().catch(() => {}));
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

    const affiliateUrl = new URL(affiliateLink);
    await completeBuyerLogin(`${affiliateUrl.pathname}${affiliateUrl.search}`);
    await page.goto(affiliateLink, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});

    await page.locator(`text=${productTitle}`).first().waitFor({ state: 'visible', timeout: 60000 });
    await page.locator('button:has-text("Add to Cart")').first().click();
    await page.waitForURL(/\/cart(?:\?|$)/, { timeout: 60000 });
    await page.locator(`text=${productTitle}`).first().waitFor({ state: 'visible', timeout: 60000 });

    await page.locator('button:has-text("Checkout with PayPal"), button:has-text("Checkout")').first().click();
    await page.waitForURL(/\/checkout(?:\?|$)/, { timeout: 60000 });
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});

    const fillIfVisible = async (selector, value) => {
      const locator = page.locator(selector).first();
      if (await locator.isVisible().catch(() => false)) {
        await locator.fill(value);
      }
    };

    await fillIfVisible('input[name="name"]', 'Affiliate Promo Buyer');
    await fillIfVisible('input[name="email"]', buyerEmail);
    await fillIfVisible('input[name="address-line1"]', '123 Promo St');
    await fillIfVisible('input[name="address-level2"]', 'Austin');
    await fillIfVisible('input[name="address-level1"]', 'TX');
    await fillIfVisible('input[name="postal-code"]', '78701');

    return { ok: true, failedResponses, consoleErrors };
  } finally {
    await browser.close();
  }
}

async function createSandboxOrder({ sellerId, affiliateId, buyerId, buyerEmail, productId, unitPrice }) {
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
      affiliate_id: affiliateId,
      source: 'affiliate_single_product_promo',
    },
    customer: {
      email: buyerEmail,
      name: 'Affiliate Promo Buyer',
    },
    shipping_info: {
      firstName: 'Affiliate',
      lastName: 'Buyer',
      address: '123 Promo St',
      address2: '',
      city: 'Austin',
      state: 'TX',
      zip: '78701',
      country: 'US',
      phone: '',
      email: buyerEmail,
      name: 'Affiliate Promo Buyer',
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

async function main() {
  const stamp = nowStamp();
  const sellerEmail = `affiliate-seller-${stamp}@test.beezio.co`;
  const affiliateEmail = `affiliate-partner-${stamp}@test.beezio.co`;
  const buyerEmail = `affiliate-buyer-${stamp}@test.beezio.co`;
  const password = 'Testpass123!';
  const productTitle = `[AFFILIATE E2E] Promo Product ${stamp}`;

  console.log('Affiliate promo sandbox flow');
  console.log('- Site:', SITE_BASE_URL);
  console.log('- PayPal env:', PAYPAL_ENV);
  const automationMode = resolveAutomationMode();
  console.log('- Automation mode:', automationMode);

  const sellerUser = await createAuthUser({ email: sellerEmail, password, fullName: `Affiliate Seller ${stamp}` });
  const affiliateUser = await createAuthUser({ email: affiliateEmail, password, fullName: `Affiliate Partner ${stamp}` });
  const buyerUser = await createAuthUser({ email: buyerEmail, password, fullName: `Affiliate Buyer ${stamp}` });

  await insertProfileResilient({
    id: sellerUser.id,
    user_id: sellerUser.id,
    email: sellerEmail,
    full_name: `Affiliate Seller ${stamp}`,
    role: 'seller',
    primary_role: 'seller',
  });
  await insertProfileResilient({
    id: affiliateUser.id,
    user_id: affiliateUser.id,
    email: affiliateEmail,
    full_name: `Affiliate Partner ${stamp}`,
    role: 'affiliate',
    primary_role: 'affiliate',
  });
  await insertProfileResilient({
    id: buyerUser.id,
    user_id: buyerUser.id,
    email: buyerEmail,
    full_name: `Affiliate Buyer ${stamp}`,
    role: 'buyer',
    primary_role: 'buyer',
  });

  const product = await insertProductResilient({
    title: productTitle,
    description: 'Automated affiliate single-product promo checkout probe.',
    seller_id: sellerUser.id,
    price: 18,
    seller_ask: 15,
    seller_amount: 15,
    seller_ask_price: 15,
    is_active: true,
    is_promotable: true,
    affiliate_enabled: true,
    status: 'active',
    is_digital: false,
    requires_shipping: false,
    track_inventory: false,
    in_stock: true,
    stock_quantity: 10,
    total_inventory: 10,
    shipping_cost: 0,
    commission_rate: 10,
    commission_type: 'percentage',
    images: ['https://images.unsplash.com/photo-1513708927688-2f8c4412ff33?auto=format&fit=crop&w=900&q=80'],
  });

  await ensureSellerProductOrderRow({
    seller_id: sellerUser.id,
    product_id: product.id,
    display_order: 0,
    is_featured: true,
  });

  const { error: affiliateProductError } = await supabaseAdmin
    .from('affiliate_products')
    .insert({ affiliate_id: affiliateUser.id, product_id: product.id, display_order: 0, is_featured: true });
  if (affiliateProductError && String(affiliateProductError.code || '').trim() !== '23505') {
    throw affiliateProductError;
  }

  const affiliateLinkCode = `AFF${stamp}`.toUpperCase();
  const affiliateFullUrl = `${SITE_BASE_URL}/product/${product.id}?ref=${affiliateUser.id}&code=${affiliateLinkCode}`;
  const { error: linkError } = await insertAffiliateLinkResilient({
    affiliate_id: affiliateUser.id,
    product_id: String(product.id),
    link_code: affiliateLinkCode,
    full_url: affiliateFullUrl,
    is_active: true,
  });
  if (linkError) throw linkError;

  console.log('- Affiliate promo URL:', affiliateFullUrl);
  console.log('- Seller email:', sellerEmail);
  console.log('- Affiliate email:', affiliateEmail);
  console.log('- Buyer email:', buyerEmail);
  console.log('- Product ID:', product.id);

  const uiCheck = await runPromoUiCheck({
    buyerEmail,
    buyerPassword: password,
    affiliateLink: affiliateFullUrl,
    productTitle,
  });
  console.log('Affiliate promo UI check passed: buyer login, promo page, cart, and checkout route all loaded.');
  if (uiCheck.failedResponses.length) {
    console.log('- Browser 4xx/5xx responses during UI flow:', JSON.stringify(uiCheck.failedResponses, null, 2));
  }
  if (uiCheck.consoleErrors.length) {
    console.log('- Browser console errors during UI flow:', JSON.stringify(uiCheck.consoleErrors, null, 2));
  }

  const { orderID, beezioOrderId } = await createSandboxOrder({
    sellerId: sellerUser.id,
    affiliateId: affiliateUser.id,
    buyerId: buyerUser.id,
    buyerEmail,
    productId: String(product.id),
    unitPrice: 18,
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
      PAYPAL_SANDBOX_GUEST_EMAIL: buyerEmail,
      PAYPAL_SANDBOX_GUEST_PASSWORD: 'Beezio123!',
    });
  } else {
    console.log('Skipping automated approval. Open the payer-action URL, approve it, then rerun with PAYPAL_AUTOMATION_MODE=buyer-login or guest-card.');
    return;
  }

  const capture = await captureSandboxOrder(orderID);
  console.log('Capture response:', JSON.stringify(capture, null, 2));
}

main().catch((error) => {
  console.error(`Affiliate promo sandbox flow failed: ${error.message || error}`);
  process.exit(1);
});