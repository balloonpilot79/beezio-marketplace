import { chromium } from 'playwright';
import fs from 'fs';

const URL = 'https://beezio.co/';

async function run() {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  const logs = [];
  page.on('console', msg => logs.push({ type: msg.type(), text: msg.text() }));
  page.on('pageerror', err => logs.push({ type: 'pageerror', text: err.stack || err.message }));

  try {
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    // Attempt to click a header sign-in button using locator (more robust)
    const headerSelectors = ['text=Sign In', 'text=Sign in', 'button:has-text("Sign In")', 'a:has-text("Sign In")'];
    let clicked = false;
    for (const s of headerSelectors) {
      const locator = page.locator(s).first();
      if (await locator.count() > 0) {
        try {
          await locator.waitFor({ state: 'visible', timeout: 5000 });
          await locator.click({ timeout: 10000 });
          clicked = true;
          break;
        } catch (e) {
          logs.push({ type: 'click-error', text: `failed to click ${s}: ${e.message}` });
        }
      }
    }

    // If no header button clicked, try opening the mobile menu and clicking
    if (!clicked) {
      const menuBtn = page.locator('button[aria-label="Open menu"], button:has-text("Menu")').first();
      if (await menuBtn.count() > 0) {
        await menuBtn.click({ timeout: 5000 });
        await page.waitForTimeout(700);
        const mobileSign = page.locator('text=Sign In').first();
        if (await mobileSign.count() > 0) { await mobileSign.click({ timeout: 5000 }); }
      }
    }

    // Wait for modal container
    await page.waitForTimeout(2000);

    // Capture the first modal-like container in the DOM
    const modal = await page.$('div[role="dialog"], div[class*="modal"], div[class*="AuthModal"], div[class*="auth"]');
    let modalHtml = '';
    if (modal) {
      modalHtml = await modal.innerHTML();
    } else {
      // fallback: dump root innerHTML for inspection
      const root = await page.$('#root');
      modalHtml = root ? await root.innerHTML() : await page.content();
    }

    // Save outputs
    fs.writeFileSync('auth-debug-modal.html', modalHtml, 'utf8');
    await page.screenshot({ path: 'auth-debug-screenshot.png', fullPage: true });
    fs.writeFileSync('auth-debug-console.json', JSON.stringify(logs, null, 2), 'utf8');

    console.log('Debug artifacts saved: auth-debug-modal.html, auth-debug-screenshot.png, auth-debug-console.json');

    await browser.close();
    process.exit(0);
  } catch (err) {
    console.error('UI debug error:', err);
    try { await page.screenshot({ path: 'auth-debug-error.png', fullPage: true }); } catch (e) {}
    fs.writeFileSync('auth-debug-console.json', JSON.stringify(logs, null, 2), 'utf8');
    await browser.close();
    process.exit(1);
  }
}

run();
