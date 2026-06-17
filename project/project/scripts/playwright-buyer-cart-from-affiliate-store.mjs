import { chromium } from 'playwright';
import fs from 'fs';

const storageFile = process.argv[2];
const affiliateLink = process.argv[3];
const baseUrl = process.argv[4] || 'http://localhost:5173';

if (!storageFile || !affiliateLink) {
  console.error('Usage: node scripts/playwright-buyer-cart-from-affiliate-store.mjs <storage-file.json> <affiliateLink> [baseUrl]');
  process.exit(2);
}
if (!fs.existsSync(storageFile)) {
  console.error('Storage file not found:', storageFile);
  process.exit(3);
}

function normalizeOrigin(url) {
  const u = new URL(url);
  return `${u.protocol}//${u.host}`;
}

function normalizeAffiliateUrl(link) {
  try {
    const url = new URL(link);
    url.host = new URL(baseUrl).host;
    url.protocol = new URL(baseUrl).protocol;
    return url.toString();
  } catch {
    if (link.startsWith('/')) return `${baseUrl}${link}`;
    return `${baseUrl}/`;
  }
}

async function run() {
  const storage = JSON.parse(fs.readFileSync(storageFile, 'utf8'));
  const desiredOrigin = normalizeOrigin(baseUrl);
  if (Array.isArray(storage.origins)) {
    storage.origins = storage.origins.map((o) => ({ ...o, origin: desiredOrigin }));
  }
  const browser = await chromium.launch();
  const context = await browser.newContext({ storageState: storage });
  const page = await context.newPage();
  page.on('console', (m) => console.log('[page]', m.type(), m.text()));
  page.on('pageerror', (e) => console.error('[page error]', e?.message || e));

  try {
    const url = normalizeAffiliateUrl(affiliateLink);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });

    const addToCart = page.locator('button:has-text("Add to Cart")').first();
    await addToCart.waitFor({ state: 'visible', timeout: 60000 });
    await addToCart.click();

    await page.goto(`${baseUrl}/cart`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    const checkout = page.locator('text=Checkout').first();
    await checkout.waitFor({ state: 'visible', timeout: 60000 });

    console.log('Buyer can add affiliate-store product to cart.');
    await browser.close();
    process.exit(0);
  } catch (err) {
    console.error('Buyer cart flow failed:', err?.message || err);
    await page.screenshot({ path: 'playwright-buyer-cart-fail.png' }).catch(() => {});
    await browser.close();
    process.exit(5);
  }
}

run();
