#!/usr/bin/env node
/* eslint-disable no-console */
const { chromium } = require('playwright');

const approvalUrl = String(process.env.PAYPAL_APPROVAL_URL || '').trim();
const email = String(process.env.PAYPAL_SANDBOX_BUYER_EMAIL || '').trim();
const password = String(process.env.PAYPAL_SANDBOX_BUYER_PASSWORD || '').trim();

if (!approvalUrl || !email || !password) {
  console.error('Missing PAYPAL_APPROVAL_URL, PAYPAL_SANDBOX_BUYER_EMAIL, or PAYPAL_SANDBOX_BUYER_PASSWORD');
  process.exit(1);
}

async function clickAny(page, candidates, timeout = 8000) {
  for (const candidate of candidates) {
    const locator = page.locator(candidate).first();
    try {
      await locator.waitFor({ state: 'visible', timeout });
      await locator.click();
      return candidate;
    } catch {
      // Try the next candidate.
    }
  }
  return null;
}

async function fillAny(page, candidates, value, timeout = 8000) {
  for (const candidate of candidates) {
    const locator = page.locator(candidate).first();
    try {
      await locator.waitFor({ state: 'visible', timeout });
      await locator.fill(value);
      return candidate;
    } catch {
      // Try the next candidate.
    }
  }
  return null;
}

async function visibleText(page) {
  return (await page.locator('body').innerText().catch(() => '')).slice(0, 2000);
}

async function enterLoginFlow(page) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const clicked = await clickAny(page, [
      'a:has-text("Log In")',
      'button:has-text("Log In")',
      'button:has-text("Log in")',
      'a:has-text("Already have an account? Log In")',
    ], 5000);

    if (!clicked) return;

    await page.waitForLoadState('domcontentloaded').catch(() => {});
    await page.waitForTimeout(1500);

    const passwordVisible = await page.locator('input#password, input[name="login_password"], input[type="password"]').first().isVisible().catch(() => false);
    if (passwordVisible) return;
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  page.setDefaultNavigationTimeout(45000);

  try {
    console.log('Opening PayPal sandbox approval page...');
    await page.goto(approvalUrl, { waitUntil: 'domcontentloaded' });

    await enterLoginFlow(page);

    const emailField = await fillAny(page, [
      'input#email',
      'input[name="login_email"]',
      'input[name="email"]',
      'input[type="email"]',
    ], email);
    if (emailField) {
      await clickAny(page, ['button#btnNext', 'button[name="btnNext"]', 'button:has-text("Next")'], 5000);
      await page.waitForLoadState('domcontentloaded').catch(() => {});
      await page.waitForTimeout(1500);
      await enterLoginFlow(page);
    }

    const passwordField = await fillAny(page, [
      'input#password',
      'input[name="login_password"]',
      'input[name="password"]',
      'input[type="password"]',
    ], password);
    if (passwordField) {
      await clickAny(page, ['button#btnLogin', 'button[name="btnLogin"]', 'button:has-text("Log In")', 'button:has-text("Log in")'], 5000);
    }

    await page.waitForLoadState('domcontentloaded').catch(() => {});
    await page.waitForTimeout(4000);

    const approveButton = await clickAny(page, [
      'button#payment-submit-btn',
      'button[data-testid="submit-button-initial"]',
      'button:has-text("Complete Purchase")',
      'button:has-text("Pay Now")',
      'button:has-text("Agree & Pay")',
      'button:has-text("Continue")',
      'input[type="submit"]',
    ], 12000);

    if (!approveButton) {
      const bodyText = await visibleText(page);
      const diagnostics = await page.evaluate(() => {
        const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim();
        const buttons = Array.from(document.querySelectorAll('button, input[type="submit"]')).map((node) => ({
          text: clean(node.textContent || node.value),
          id: node.id || null,
          type: node.getAttribute('type'),
          disabled: Boolean(node.disabled),
        })).slice(0, 20);
        const inputs = Array.from(document.querySelectorAll('input')).map((node) => ({
          id: node.id || null,
          name: node.getAttribute('name'),
          type: node.getAttribute('type'),
          value: node.type === 'password' ? '[redacted]' : String(node.value || ''),
          visible: Boolean(node.offsetWidth || node.offsetHeight || node.getClientRects().length),
        })).slice(0, 20);
        return { buttons, inputs };
      }).catch(() => null);
      throw new Error(`Could not find PayPal approval button. Page text: ${bodyText}. Diagnostics: ${JSON.stringify(diagnostics)}`);
    }

    await page.waitForLoadState('domcontentloaded').catch(() => {});
    await page.waitForTimeout(5000);
    console.log(`Approval attempted. Final URL: ${page.url()}`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(`PayPal sandbox approval failed: ${error.message || error}`);
  process.exit(1);
});
