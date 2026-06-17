#!/usr/bin/env node
/* eslint-disable no-console */
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

const cwd = process.cwd();
for (const file of ['.env.local', '.env']) {
  const full = path.join(cwd, file);
  if (fs.existsSync(full)) dotenv.config({ path: full, override: false });
}

const baseUrl = String(process.env.GO_LIVE_BASE_URL || 'https://beezio.co').replace(/\/$/, '');

async function fetchJson(url) {
  const res = await fetch(url);
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

async function fetchText(url) {
  const res = await fetch(url);
  const body = await res.text().catch(() => '');
  return { ok: res.ok, status: res.status, body };
}

async function main() {
  const checks = [];

  const health = await fetchJson(`${baseUrl}/api/health`);
  checks.push({
    name: 'API health endpoint',
    pass: health.ok && Boolean(health.body?.ok),
    detail: `status=${health.status}`,
  });

  const paypalStatus = await fetchJson(`${baseUrl}/api/paypal/status`);
  checks.push({
    name: 'PayPal status endpoint',
    pass: paypalStatus.ok && Boolean(paypalStatus.body?.ok),
    detail: `status=${paypalStatus.status}`,
  });

  checks.push({
    name: 'PayPal live mode',
    pass: String(paypalStatus.body?.env || '').toLowerCase() === 'live',
    detail: `env=${paypalStatus.body?.env || 'unknown'}`,
  });

  checks.push({
    name: 'PayPal credentials configured',
    pass: Boolean(paypalStatus.body?.configured?.clientId) && Boolean(paypalStatus.body?.configured?.clientSecret),
    detail: `clientId=${Boolean(paypalStatus.body?.configured?.clientId)} clientSecret=${Boolean(paypalStatus.body?.configured?.clientSecret)}`,
  });

  const marketplace = await fetchJson(`${baseUrl}/api/public/marketplace/products?limit=1`);
  checks.push({
    name: 'Marketplace product available',
    pass: marketplace.ok && Array.isArray(marketplace.body?.products) && marketplace.body.products.length > 0,
    detail: `status=${marketplace.status} products=${Array.isArray(marketplace.body?.products) ? marketplace.body.products.length : 0}`,
  });

  const firstProduct = Array.isArray(marketplace.body?.products) && marketplace.body.products.length > 0
    ? marketplace.body.products[0]
    : null;
  const sellerId = String(firstProduct?.seller_id || '').trim();
  const productId = String(firstProduct?.id || '').trim();

  if (sellerId) {
    const storefront = await fetchText(`${baseUrl}/store/${encodeURIComponent(sellerId)}`);
    checks.push({
      name: 'Public storefront route responds',
      pass: storefront.ok && storefront.status === 200,
      detail: `status=${storefront.status}`,
    });
  } else {
    checks.push({
      name: 'Public storefront route responds',
      pass: false,
      detail: 'missing seller_id from marketplace payload',
    });
  }

  if (sellerId && productId) {
    const productRoute = await fetchText(`${baseUrl}/store/${encodeURIComponent(sellerId)}/product/${encodeURIComponent(productId)}`);
    checks.push({
      name: 'Store product route responds',
      pass: productRoute.ok && productRoute.status === 200,
      detail: `status=${productRoute.status}`,
    });
  } else {
    checks.push({
      name: 'Store product route responds',
      pass: false,
      detail: 'missing seller_id or product_id from marketplace payload',
    });
  }

  console.log(`Go-live readiness for ${baseUrl}`);
  console.log('------------------------------------');
  for (const c of checks) {
    console.log(`${c.pass ? 'PASS' : 'FAIL'} | ${c.name} | ${c.detail}`);
  }

  const failed = checks.filter((c) => !c.pass);
  if (failed.length) {
    console.log('\nResult: NOT READY FOR LIVE');
    process.exit(1);
  }
  console.log('\nResult: READY FOR LIVE');
}

main().catch((err) => {
  console.error(`Readiness check failed: ${err.message || err}`);
  process.exit(1);
});
