import { chromium } from 'playwright';
import fs from 'fs';

const storageFile = process.argv[2];
const baseUrl = process.argv[3] || 'http://localhost:5173';
if (!storageFile) {
  console.error('Usage: node scripts/playwright-affiliate-add-product.mjs <storage-file.json> [baseUrl]');
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
    // Vite dev server can spend time optimizing deps on first load; allow extra time.
    await page.goto(`${baseUrl}/marketplace`, { waitUntil: 'commit', timeout: 120000 });

    const addButton = page.locator('button:has-text("Add to My Store")').first();
    await addButton.waitFor({ state: 'visible', timeout: 60000 });
    await addButton.click();

    const modalTitle = page.locator('text=Add Product to Your Store').first();
    await modalTitle.waitFor({ state: 'visible', timeout: 60000 });

    const modalRoot = page.locator('div.fixed:has-text("Add Product to Your Store")').first();
    const confirm = modalRoot.locator('button:has-text("Add to My Store")').first();
    await confirm.click({ timeout: 60000 });

    await page.locator('text=Product Added!').first().waitFor({ state: 'visible', timeout: 60000 });

    const linkInput = page.locator('text=Your Affiliate Link').locator('..').locator('input').first();
    const affiliateLink = await linkInput.inputValue().catch(() => '');
    if (!affiliateLink) {
      throw new Error('Affiliate link not found after adding product');
    }

    console.log('AFFILIATE_LINK=' + affiliateLink);
    await browser.close();
    process.exit(0);
  } catch (err) {
    console.error('Affiliate add-product flow failed:', err?.message || err);
    await page.screenshot({ path: 'playwright-affiliate-add-product-fail.png' }).catch(() => {});
    await browser.close();
    process.exit(5);
  }
}

run();
