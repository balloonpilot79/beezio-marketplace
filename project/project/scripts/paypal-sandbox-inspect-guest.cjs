#!/usr/bin/env node
/* eslint-disable no-console */
const { chromium } = require('playwright');

const approvalUrl = String(process.env.PAYPAL_APPROVAL_URL || '').trim();
if (!approvalUrl) {
  console.error('Missing PAYPAL_APPROVAL_URL');
  process.exit(1);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.setDefaultTimeout(20000);
  await page.goto(approvalUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  for (const selector of [
    'button:has-text("Pay with Debit or Credit Card")',
    'a:has-text("Pay with Debit or Credit Card")',
    'button:has-text("Debit or Credit Card")',
    'a:has-text("Debit or Credit Card")',
  ]) {
    try {
      const button = page.locator(selector).first();
      await button.waitFor({ state: 'visible', timeout: 5000 });
      await button.click();
      console.log(`Clicked guest/card option: ${selector}`);
      break;
    } catch {
      // try next
    }
  }

  await page.waitForTimeout(6000);
  const frames = page.frames().map((frame) => frame.url()).filter(Boolean);
  const inputs = await page.locator('input, select, button').evaluateAll((nodes) =>
    nodes.slice(0, 80).map((node) => ({
      tag: node.tagName,
      type: node.getAttribute('type'),
      name: node.getAttribute('name'),
      id: node.getAttribute('id'),
      placeholder: node.getAttribute('placeholder'),
      text: (node.textContent || '').trim().slice(0, 80),
      aria: node.getAttribute('aria-label'),
    }))
  ).catch(() => []);
  const text = (await page.locator('body').innerText().catch(() => '')).slice(0, 2000);
  console.log(JSON.stringify({ finalUrl: page.url(), frames, inputs, text }, null, 2));
  await browser.close();
}

main().catch((error) => {
  console.error(`Inspect failed: ${error.message || error}`);
  process.exit(1);
});
