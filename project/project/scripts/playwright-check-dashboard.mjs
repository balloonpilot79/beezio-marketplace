import { chromium } from 'playwright';
import fs from 'fs';

const storageFile = process.argv[2];
const expectedRole = process.argv[3] || 'buyer';
if (!storageFile) {
  console.error('Usage: node playwright-check-dashboard.mjs <storage-file.json> [role]');
  process.exit(2);
}

if (!fs.existsSync(storageFile)) {
  console.error('Storage file not found:', storageFile);
  process.exit(3);
}

async function run() {
  const storage = JSON.parse(fs.readFileSync(storageFile, 'utf8'));
  const browser = await chromium.launch();
  const context = await browser.newContext({ storageState: storage });
  const page = await context.newPage();
  page.on('console', m => console.log('[page]', m.text()));

  try {
    await page.goto('http://localhost:5173/dashboard', { waitUntil: 'domcontentloaded', timeout: 30000 });
    // Look for role-specific dashboard headings
    const roleTexts = {
      buyer: 'Buyer Dashboard',
      seller: 'Seller Dashboard',
      affiliate: 'Affiliate Dashboard',
      fundraiser: 'Fundraiser Dashboard'
    };

    const expected = roleTexts[expectedRole] || 'Buyer Dashboard';
    const found = await page.locator(`text=${expected}`).first().isVisible().catch(() => false);
    if (found) {
      console.log('Dashboard verified for role:', expectedRole);
      await browser.close();
      process.exit(0);
    } else {
      console.error('Dashboard verification failed for role:', expectedRole);
      await page.screenshot({ path: `dashboard-check-fail-${expectedRole}.png` }).catch(() => {});
      await browser.close();
      process.exit(4);
    }
  } catch (err) {
    console.error('Playwright error:', err);
    await page.screenshot({ path: `dashboard-check-error-${expectedRole}.png` }).catch(() => {});
    await browser.close();
    process.exit(5);
  }
}

run();
