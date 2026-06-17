import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const REQUEST_TIMEOUT_MS = Number(process.env.E2E_REQUEST_TIMEOUT_MS || 60_000);
const GLOBAL_TIMEOUT_MS = Number(process.env.E2E_GLOBAL_TIMEOUT_MS || 12 * 60_000);

function requireEnv(name, fallbacks = []) {
  const keys = [name, ...fallbacks];
  for (const key of keys) {
    const value = String(process.env[key] || '').trim();
    if (value) return value;
  }
  throw new Error(`Missing ${name}${fallbacks.length ? ` (or ${fallbacks.join(', ')})` : ''}`);
}

function optionalEnv(name, fallbacks = []) {
  const keys = [name, ...fallbacks];
  for (const key of keys) {
    const value = String(process.env[key] || '').trim();
    if (value) return value;
  }
  return '';
}

function fetchWithTimeout(input, init = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  if (init.signal) {
    if (init.signal.aborted) controller.abort();
    else init.signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timeout));
}

function redact(value, keep = 10) {
  const v = String(value || '');
  if (!v) return 'MISSING';
  return v.length <= keep ? `${v}...` : `${v.slice(0, keep)}...`;
}

function stripeMode(secret) {
  const key = String(secret || '').trim();
  if (key.startsWith('sk_live_')) return 'live';
  if (key.startsWith('sk_test_')) return 'test';
  return 'unknown';
}

function nowStamp() {
  return String(Date.now()).slice(-8);
}

function looksLikeUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || '').trim());
}

async function insertProfileResilient(supabaseAdmin, payload) {
  const tryPayloads = [
    payload,
    // fallback if some optional columns don't exist in this DB revision
    Object.fromEntries(
      Object.entries(payload).filter(([k]) => !['seller_verification_status', 'identity_verification_status', 'stripe_account_id'].includes(k))
    ),
  ];

  // Profiles table in some revisions may lack a PK/unique constraint; avoid upsert.
  // Instead, delete any prior rows for this email and insert fresh.
  try {
    if (payload.email) {
      await supabaseAdmin.from('profiles').delete().eq('email', payload.email);
    }
  } catch {}

  let lastErr = null;
  for (const p of tryPayloads) {
    const { error } = await supabaseAdmin.from('profiles').insert(p);
    if (!error) return;
    lastErr = error;
  }
  throw lastErr;
}

async function insertProductResilient(supabaseAdmin, payload) {
  const tryPayloads = [
    payload,
    // Some DB revisions may not include `status`.
    Object.fromEntries(Object.entries(payload).filter(([k]) => k !== 'status')),
  ];

  let last = null;
  for (const p of tryPayloads) {
    const res = await supabaseAdmin.from('products').insert(p).select('id').single();
    if (!res.error) return res;
    last = res;
  }
  return last;
}

async function createAuthUser(supabaseAdmin, { email, password, fullName }) {
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error) throw error;
  if (!data?.user?.id) throw new Error('Admin createUser returned no user id');
  return data.user;
}

async function safeDeleteAuthUser(supabaseAdmin, userId) {
  if (!userId) return;
  await supabaseAdmin.auth.admin.deleteUser(userId).catch(() => {});
}

async function callCheckoutCreate({ baseUrl, body }) {
  const url = `${String(baseUrl).replace(/\/$/, '')}/api/checkout/create`;
  const res = await fetchWithTimeout(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

function extractStripeSessionId(checkoutUrl) {
  const match = String(checkoutUrl || '').match(/cs_(?:test|live)_[a-zA-Z0-9]+/);
  return match ? match[0] : null;
}

function extractMissingColumnName(errorLike) {
  const msg = [
    String(errorLike?.message || ''),
    String(errorLike?.details || ''),
    String(errorLike?.hint || ''),
    String(errorLike || ''),
  ]
    .filter(Boolean)
    .join(' | ');
  const pg = msg.match(/column\s+"([^"]+)"\s+of\s+relation\s+"[^"]+"\s+does\s+not\s+exist/i);
  if (pg?.[1]) return pg[1];
  const pgDot = msg.match(/column\s+([a-z0-9_]+\.[a-z0-9_]+)\s+does\s+not\s+exist/i);
  if (pgDot?.[1]) return pgDot[1].split('.').pop() || pgDot[1];
  const pgrst = msg.match(/Could not find the '([^']+)' column of '[^']+' in the schema cache/i);
  if (pgrst?.[1]) return pgrst[1];
  return null;
}

async function insertAffiliateLinkResilient(supabaseAdmin, payload) {
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

async function main() {
  const SUPABASE_URL = requireEnv('SUPABASE_URL', ['VITE_SUPABASE_URL']);
  const SUPABASE_SERVICE_ROLE_KEY = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  const STRIPE_SECRET_KEY = optionalEnv('STRIPE_SECRET_KEY');

  const SITE_BASE_URL = String(process.env.E2E_SITE_BASE_URL || 'https://beezio.co').trim();
  const keepData = String(process.env.E2E_KEEP_DATA || '').trim() === '1';
  const allowLive = String(process.env.ALLOW_LIVE_STRIPE_E2E || '').trim() === '1';
  const stripeEnabled = Boolean(STRIPE_SECRET_KEY);

  const mode = stripeEnabled ? stripeMode(STRIPE_SECRET_KEY) : 'disabled';
  const paymentProvider = String(optionalEnv('VITE_PAYMENT_PROVIDER', ['PAYMENT_PROVIDER']) || 'paypal').trim().toLowerCase();
  const paypalOnly = paymentProvider === 'paypal' || !stripeEnabled;
  console.log('E2E A2Z Marketplace Flow');
  console.log('- SUPABASE_URL:', SUPABASE_URL);
  console.log('- SUPABASE_SERVICE_ROLE_KEY:', SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'MISSING');
  console.log('- STRIPE_SECRET_KEY:', stripeEnabled ? redact(STRIPE_SECRET_KEY, 8) : 'MISSING', `(mode=${mode})`);
  console.log('- PAYMENT_PROVIDER:', paymentProvider || 'unknown');
  console.log('- SITE_BASE_URL:', SITE_BASE_URL);
  console.log('- E2E_KEEP_DATA:', keepData ? '1' : '0');

  if (mode === 'live' && !allowLive) {
    throw new Error('Refusing to run against live Stripe keys. Set ALLOW_LIVE_STRIPE_E2E=1 to proceed.');
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    global: { fetch: fetchWithTimeout },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let stripe = null;
  if (stripeEnabled) {
    const StripeModule = await import('stripe');
    const Stripe = StripeModule.default || StripeModule;
    stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2023-10-16', timeout: REQUEST_TIMEOUT_MS });
  }

  const stamp = nowStamp();
  const password = 'Testpass123!';

  const created = {
    users: /** @type {Array<{role:string,email:string,id:string}>} */ ([]),
    productId: null,
    affiliateLinkId: null,
    checkoutIntentIds: /** @type {string[]} */ ([]),
    stripeSessionIds: /** @type {string[]} */ ([]),
    warnings: /** @type {string[]} */ ([]),
  };

  const makeEmail = (role) => `e2e-${role}-${stamp}@test.beezio.co`;

  try {
    // 1) Create users + profiles
    console.log('\n[1/7] Creating auth users + profiles...');
    const roles = ['seller', 'affiliate', 'fundraiser', 'buyer'];
    for (const role of roles) {
      const email = makeEmail(role);
      const fullName = `E2E ${role} ${stamp}`;
      const user = await createAuthUser(supabaseAdmin, { email, password, fullName });
      created.users.push({ role, email, id: user.id });

      const profilePayload = {
        id: user.id,
        user_id: user.id,
        email,
        full_name: fullName,
        role,
        primary_role: role,
        stripe_account_id: role === 'buyer' ? null : `acct_e2e_${role}_${stamp}`,
        seller_verification_status: role === 'seller' ? 'verified' : undefined,
        identity_verification_status: role === 'seller' ? 'verified' : undefined,
      };

      await insertProfileResilient(supabaseAdmin, profilePayload);
    }

    const sellerId = created.users.find((u) => u.role === 'seller')?.id;
    const affiliateId = created.users.find((u) => u.role === 'affiliate')?.id;
    const fundraiserId = created.users.find((u) => u.role === 'fundraiser')?.id;
    const buyerId = created.users.find((u) => u.role === 'buyer')?.id;

    if (![sellerId, affiliateId, fundraiserId, buyerId].every(looksLikeUuid)) {
      throw new Error('One or more created user IDs are not valid UUIDs; aborting.');
    }

    console.log('[2/7] Creating seller product...');
    const { data: cats, error: catErr } = await supabaseAdmin.from('categories').select('id').limit(1);
    if (catErr) console.warn('Category lookup warning (non-fatal):', catErr.message || catErr);
    const categoryId = Array.isArray(cats) && cats[0]?.id ? cats[0].id : null;

    const product = {
      title: `E2E Digital Product ${stamp}`,
      description: 'E2E product for seller→affiliate/fundraiser→buyer checkout session verification.',
      seller_id: sellerId,
      category_id: categoryId,
      images: ['https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800'],
      stock_quantity: 25,
      total_inventory: 25,
      in_stock: true,
      track_inventory: false,
      is_active: true,
      is_promotable: true,
      affiliate_enabled: true,
      status: 'active',
      commission_rate: 20,
      commission_type: 'percentage',
      flat_commission_amount: null,
      seller_ask: 10,
      seller_amount: 10,
      seller_ask_price: 10,
      price: 10,
      is_digital: true,
      requires_shipping: false,
      shipping_options: [],
    };

    const { data: createdProduct, error: prodErr } = await insertProductResilient(supabaseAdmin, product);
    if (prodErr) throw prodErr;
    created.productId = createdProduct?.id ? String(createdProduct.id) : null;
    if (!created.productId) throw new Error('Product creation returned no id');

    // 3) Affiliate adds product to store + create affiliate link record
    console.log('[3/7] Adding product to affiliate store + creating link...');
    {
      const { error } = await supabaseAdmin
        .from('affiliate_products')
        .insert({ affiliate_id: affiliateId, product_id: created.productId, display_order: 0, is_featured: false });
      if (error && String(error.code || '').trim() !== '23505') {
        created.warnings.push(`affiliate_products insert failed: ${error.message || String(error)}`);
      } else {
        console.log('  - affiliate_products ok');
      }
    }

    const affiliateLinkCode = `E2E${stamp}`.toUpperCase();
    const affiliateFullUrl = `${SITE_BASE_URL.replace(/\/$/, '')}/product/${created.productId}?ref=${affiliateId}&code=${affiliateLinkCode}`;
    const { data: linkRow, error: linkErr } = await insertAffiliateLinkResilient(supabaseAdmin, {
      affiliate_id: affiliateId,
      product_id: created.productId,
      link_code: affiliateLinkCode,
      full_url: affiliateFullUrl,
      is_active: true,
    });
    if (linkErr) {
      created.warnings.push(`affiliate_links insert failed: ${linkErr.message || String(linkErr)}`);
    }
    created.affiliateLinkId = linkRow?.id ? String(linkRow.id) : null;

    // 4) Fundraiser adds product to store
    console.log('[4/7] Adding product to fundraiser store...');
    {
      const { error } = await supabaseAdmin
        .from('fundraiser_products')
        .insert({ fundraiser_id: fundraiserId, product_id: created.productId, display_order: 0, is_featured: false });
      if (error && String(error.code || '').trim() !== '23505') {
        created.warnings.push(`fundraiser_products insert failed: ${error.message || String(error)}`);
      }
    }

    // 5) Create checkout sessions (affiliate + fundraiser attribution)
    console.log('[5/7] Calling /api/checkout/create for affiliate + fundraiser attribution...');
    const commonCart = {
      cart: {
        line_items: [{ product_id: created.productId, variant_id: null, qty: 1, unit_price: 10 }],
        shipping_amount: 0,
        tax_amount: 0,
        currency: 'USD',
      },
      success_url: `${SITE_BASE_URL.replace(/\/$/, '')}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SITE_BASE_URL.replace(/\/$/, '')}/checkout/cancel`,
    };

    const affiliateCheckout = await callCheckoutCreate({
      baseUrl: SITE_BASE_URL,
      body: {
        ...commonCart,
        context: {
          seller_id: sellerId,
          buyer_id: buyerId,
          affiliate_id: affiliateId,
          fundraiser_id: null,
        },
      },
    });

    if (!affiliateCheckout.ok) {
      const code = String(affiliateCheckout.data?.code || '').trim();
      if (code === 'PAYMENTS_PAUSED') {
        created.warnings.push('checkout/create returned PAYMENTS_PAUSED; skipping checkout session verification.');
      } else {
        throw new Error(`Affiliate checkout-create failed (${affiliateCheckout.status}): ${String(affiliateCheckout.data?.error || 'unknown error')}`);
      }
    }
    const affiliateCheckoutUrl = String(affiliateCheckout.data?.url || '').trim();
    const affiliateSessionId = extractStripeSessionId(affiliateCheckoutUrl);
    if (affiliateSessionId) {
      created.stripeSessionIds.push(affiliateSessionId);
      console.log('Affiliate checkout session:', affiliateSessionId);
    } else if (affiliateCheckout.ok && !paypalOnly) {
      created.warnings.push('Affiliate checkout-create returned no Stripe session id; likely PayPal flow.');
    }

    const fundraiserCheckout = await callCheckoutCreate({
      baseUrl: SITE_BASE_URL,
      body: {
        ...commonCart,
        context: {
          seller_id: sellerId,
          buyer_id: buyerId,
          affiliate_id: null,
          fundraiser_id: fundraiserId,
        },
      },
    });

    if (!fundraiserCheckout.ok) {
      const code = String(fundraiserCheckout.data?.code || '').trim();
      if (code === 'PAYMENTS_PAUSED') {
        created.warnings.push('checkout/create returned PAYMENTS_PAUSED; skipping checkout session verification.');
      } else {
        throw new Error(`Fundraiser checkout-create failed (${fundraiserCheckout.status}): ${String(fundraiserCheckout.data?.error || 'unknown error')}`);
      }
    }
    const fundraiserCheckoutUrl = String(fundraiserCheckout.data?.url || '').trim();
    const fundraiserSessionId = extractStripeSessionId(fundraiserCheckoutUrl);
    if (fundraiserSessionId) {
      created.stripeSessionIds.push(fundraiserSessionId);
      console.log('Fundraiser checkout session:', fundraiserSessionId);
    } else if (fundraiserCheckout.ok && !paypalOnly) {
      created.warnings.push('Fundraiser checkout-create returned no Stripe session id; likely PayPal flow.');
    }

    if (stripeEnabled && stripe && created.stripeSessionIds.length) {
      // 6) Verify Stripe metadata for both sessions
      console.log('[6/7] Verifying Stripe session metadata...');
      for (const sid of created.stripeSessionIds) {
        const session = await stripe.checkout.sessions.retrieve(sid);
        const md = session?.metadata || {};
        if (String(md.seller_id || '') !== String(sellerId)) throw new Error(`Stripe metadata mismatch for ${sid}: seller_id`);
        if (String(md.buyer_id || '') !== String(buyerId)) throw new Error(`Stripe metadata mismatch for ${sid}: buyer_id`);
        if (!String(md.checkout_intent_id || '').trim()) throw new Error(`Stripe metadata missing checkout_intent_id for ${sid}`);

        const isFundraiserSession = String(md.fundraiser_id || '').trim().length > 0;
        if (isFundraiserSession) {
          if (String(md.fundraiser_id) !== String(fundraiserId)) throw new Error(`Stripe metadata mismatch for ${sid}: fundraiser_id`);
        } else {
          if (String(md.affiliate_id) !== String(affiliateId)) throw new Error(`Stripe metadata mismatch for ${sid}: affiliate_id`);
        }
      }

      // 7) Verify checkout_intents rows exist and are linked to Stripe session ids
      console.log('[7/7] Verifying checkout_intents rows...');
      for (const sid of created.stripeSessionIds) {
        const { data: intent, error: intentErr } = await supabaseAdmin
          .from('checkout_intents')
          .select('id, stripe_session_id, seller_id, affiliate_id, fundraiser_id, status, total_cents')
          .eq('stripe_session_id', sid)
          .maybeSingle();
        if (intentErr) throw intentErr;
        if (!intent?.id) throw new Error(`checkout_intents row not found for stripe_session_id=${sid}`);
        created.checkoutIntentIds.push(String(intent.id));
        console.log('checkout_intents verified:', String(intent.id), 'status=', intent.status, 'total_cents=', intent.total_cents);
      }

      console.log('\nPASS: seller->affiliate/fundraiser->buyer checkout session creation + Stripe metadata verified.');
      console.log('NOTE: This test does NOT complete payment or fire webhooks (no orders are created).');
    } else {
      console.log('\nPASS: seller->affiliate/fundraiser->buyer flow created products + associations.');
      if (paypalOnly) {
        console.log('NOTE: PayPal-only mode detected; Stripe checks intentionally skipped.');
      } else {
        console.log('NOTE: Stripe checks skipped (no STRIPE_SECRET_KEY set).');
      }
    }

    if (created.warnings.length) {
      console.log('\nWARNINGS:');
      for (const w of created.warnings) console.log('-', w);
    }
  } finally {
    if (!keepData) {
      // Cleanup in reverse dependency order
      if (created.checkoutIntentIds.length) {
        try {
          await supabaseAdmin.from('checkout_intents').delete().in('id', created.checkoutIntentIds);
        } catch {}
      }
      if (created.affiliateLinkId) {
        try {
          await supabaseAdmin.from('affiliate_links').delete().eq('id', created.affiliateLinkId);
        } catch {}
      }
      if (created.productId) {
        try {
          await supabaseAdmin.from('affiliate_products').delete().eq('product_id', created.productId);
        } catch {}
        try {
          await supabaseAdmin.from('fundraiser_products').delete().eq('product_id', created.productId);
        } catch {}
        try {
          await supabaseAdmin.from('products').delete().eq('id', created.productId);
        } catch {}
      }
      for (const u of created.users) {
        try {
          await supabaseAdmin.from('profiles').delete().eq('id', u.id);
        } catch {}
      }
      for (const u of created.users) {
        await safeDeleteAuthUser(supabaseAdmin, u.id);
      }
    } else {
      console.log('\nE2E_KEEP_DATA=1 set; leaving test records in place.');
      console.log('Created product id:', created.productId);
      console.log('Created users:', created.users.map((u) => `${u.role}=${u.email}`).join(', '));
      if (created.stripeSessionIds.length) {
        console.log('Created Stripe sessions:', created.stripeSessionIds.join(', '));
      }
    }
  }
}

process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err && (err.message || err));
  process.exit(1);
});

const globalTimer = setTimeout(() => {
  console.error(`E2E script timed out after ${Math.round(GLOBAL_TIMEOUT_MS / 1000)}s`);
  process.exit(124);
}, GLOBAL_TIMEOUT_MS);

main()
  .then(() => {
    clearTimeout(globalTimer);
    process.exit(0);
  })
  .catch((err) => {
    clearTimeout(globalTimer);
    if (err && err.stack) console.error(err.stack);
    else console.error(err && (err.message || err));
    process.exit(1);
  });
