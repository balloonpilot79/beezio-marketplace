const { chromium } = require('playwright');
const { spawn } = require('node:child_process');

const baseUrl = String(process.env.E2E_BASE_URL || '').trim() || 'http://127.0.0.1:4173';
let server = null;

async function waitForApp(url) {
  for (let i = 0; i < 30; i += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`Beezio preview did not become available at ${url}`);
}

async function main() {
  if (!process.env.E2E_BASE_URL) {
    server = spawn('npm', ['run', 'preview', '--', '--host', '127.0.0.1', '--port', '4173'], {
      stdio: 'inherit',
      shell: process.platform === 'win32',
      env: process.env,
    });
  }

  await waitForApp(baseUrl);
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.setDefaultTimeout(30000);

  try {
    await page.goto(`${baseUrl}/marketplace`, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});

    const productLinks = page.locator('a[href*="/product/"]');
    const count = await productLinks.count();
    if (count < 1) throw new Error('Marketplace has no real product links.');

    const href = await productLinks.first().getAttribute('href');
    if (!href || !/^\/product\/[^/?#]+/.test(href)) {
      throw new Error(`Marketplace product link is invalid: ${href || '(missing)'}`);
    }

    const firstImage = page.locator('img').first();
    if (await firstImage.count()) {
      await firstImage.evaluate((img) => img.complete || new Promise((resolve) => {
        img.addEventListener('load', resolve, { once: true });
        img.addEventListener('error', resolve, { once: true });
      }));
    }

    await productLinks.first().click();
    await page.waitForLoadState('domcontentloaded').catch(() => {});
    await page.waitForTimeout(500);

    const productPath = new URL(page.url()).pathname;
    if (!/^\/product\/[^/]+/.test(productPath)) {
      throw new Error(`Clicking a marketplace product did not open its product page: ${page.url()}`);
    }

    const body = (await page.locator('body').innerText()).toLowerCase();
    if (!body.includes('back to marketplace') && !body.includes('add to cart') && !body.includes('product')) {
      throw new Error('Product detail page rendered without expected product controls/content.');
    }

    console.log(`PASS: marketplace product link opened ${productPath}`);
  } finally {
    await browser.close();
    if (server) server.kill('SIGTERM');
  }
}

main().catch((error) => {
  console.error(`FAIL: ${error.message}`);
  if (server) server.kill('SIGTERM');
  process.exit(1);
});
