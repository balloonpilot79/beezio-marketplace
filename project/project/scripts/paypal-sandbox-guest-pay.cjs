#!/usr/bin/env node
/* eslint-disable no-console */
const { chromium } = require('playwright');

const approvalUrl = String(process.env.PAYPAL_APPROVAL_URL || '').trim();
const guestEmail = String(process.env.PAYPAL_SANDBOX_GUEST_EMAIL || 'b8@beezio.co').trim();
const guestPassword = String(process.env.PAYPAL_SANDBOX_GUEST_PASSWORD || 'Beezio123!').trim();
const guestFirstName = String(process.env.PAYPAL_SANDBOX_GUEST_FIRST_NAME || 'Beezio').trim();
const guestLastName = String(process.env.PAYPAL_SANDBOX_GUEST_LAST_NAME || 'Eight').trim();
const guestPhone = String(process.env.PAYPAL_SANDBOX_GUEST_PHONE || '2128675309').trim();
const guestAddress1 = String(process.env.PAYPAL_SANDBOX_GUEST_ADDRESS1 || '123 Maple St').trim();
const guestCity = String(process.env.PAYPAL_SANDBOX_GUEST_CITY || 'Ottumwa').trim();
const guestState = String(process.env.PAYPAL_SANDBOX_GUEST_STATE || 'IA').trim();
const guestPostalCode = String(process.env.PAYPAL_SANDBOX_GUEST_POSTAL_CODE || '52501').trim();
if (!approvalUrl) {
  console.error('Missing PAYPAL_APPROVAL_URL');
  process.exit(1);
}

async function clickAny(page, selectors, timeout = 8000) {
  for (const selector of selectors) {
    try {
      const locator = page.locator(selector).first();
      await locator.waitFor({ state: 'visible', timeout });
      await locator.click();
      return selector;
    } catch {
      // try next
    }
  }
  return null;
}

async function fillAny(page, selectors, value, timeout = 8000) {
  for (const selector of selectors) {
    try {
      const locator = page.locator(selector).first();
      await locator.waitFor({ state: 'visible', timeout });
      await locator.fill(value);
      return selector;
    } catch {
      // try next
    }
  }
  return null;
}

async function typeAny(page, selectors, value, timeout = 8000) {
  for (const selector of selectors) {
    try {
      const locator = page.locator(selector).first();
      await locator.waitFor({ state: 'visible', timeout });
      await locator.click();
      await locator.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A').catch(() => {});
      await locator.press('Delete').catch(() => {});
      await locator.type(value, { delay: 40 });
      return selector;
    } catch {
      // try next
    }
  }
  return null;
}

async function setValueAny(page, selectors, value, timeout = 8000) {
  for (const selector of selectors) {
    try {
      const locator = page.locator(selector).first();
      await locator.waitFor({ state: 'visible', timeout });
      await locator.evaluate((node, nextValue) => {
        node.focus();
        node.value = '';
        node.dispatchEvent(new Event('input', { bubbles: true }));
        node.value = nextValue;
        node.dispatchEvent(new Event('input', { bubbles: true }));
        node.dispatchEvent(new Event('change', { bubbles: true }));
        node.blur();
      }, value);
      return selector;
    } catch {
      // try next
    }
  }
  return null;
}

async function relaxValidationAny(page, selectors) {
  for (const selector of selectors) {
    try {
      const locator = page.locator(selector).first();
      const visible = await locator.isVisible().catch(() => false);
      if (!visible) continue;
      await locator.evaluate((node) => {
        node.removeAttribute('pattern');
        node.removeAttribute('minlength');
        node.setCustomValidity('');
      });
      return selector;
    } catch {
      // try next
    }
  }
  return null;
}

async function setPhoneValue(page, selectors, values, timeout = 8000) {
  for (const selector of selectors) {
    for (const value of values) {
      try {
        const locator = page.locator(selector).first();
        await locator.waitFor({ state: 'visible', timeout });
        await locator.click();
        await locator.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A').catch(() => {});
        await locator.press('Delete').catch(() => {});
        await locator.type(value, { delay: 40 });
        const isValid = await locator.evaluate((node) => {
          if (typeof node.checkValidity !== 'function') return true;
          return node.checkValidity();
        }).catch(() => false);
        if (isValid) return { selector, value };
      } catch {
        // try next value/selector
      }
    }
  }
  return null;
}

async function waitForAnyVisible(page, selectors, timeout = 20000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    for (const selector of selectors) {
      const visible = await page.locator(selector).first().isVisible().catch(() => false);
      if (visible) return selector;
    }
    await page.waitForTimeout(500);
  }
  return null;
}

async function pageShowsPayPalSuccess(page, timeout = 45000) {
  try {
    await page.waitForFunction(() => {
      const bodyText = String(document.body?.innerText || '');
      if (bodyText.includes('Thanks for using PayPal')) return true;
      return Array.from(document.querySelectorAll('button, input[type="submit"]')).some((node) => {
        const text = String(node.textContent || node.value || '').replace(/\s+/g, ' ').trim().toLowerCase();
        return node.disabled && (text.includes('pay now as guest') || text.includes('create account & pay now'));
      });
    }, { timeout });
    return true;
  } catch {
    return false;
  }
}

async function clickGuestSubmit(page) {
  const selector = await clickAny(page, [
    'button:has-text("Pay now as guest")',
    'button:has-text("Create Account & Pay Now")',
    'button:has-text("Pay Now")',
    'input[type="submit"]',
  ], 12000);
  if (selector) return selector;

  const clicked = await page.evaluate(() => {
    const cleanText = (value) => String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
    const candidate = Array.from(document.querySelectorAll('button, input[type="submit"]')).find((node) => {
      const text = cleanText(node.textContent || node.value);
      return text.includes('pay now as guest') || text.includes('create account & pay now') || text === 'pay now';
    });
    if (!candidate) return null;
    candidate.click();
    return cleanText(candidate.textContent || candidate.value);
  }).catch(() => null);

  return clicked;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.setDefaultTimeout(25000);
  page.setDefaultNavigationTimeout(60000);

  try {
    await page.goto(approvalUrl, { waitUntil: 'domcontentloaded' });
    await clickAny(page, [
      'button:has-text("Pay with Debit or Credit Card")',
      'a:has-text("Pay with Debit or Credit Card")',
      'button:has-text("Debit or Credit Card")',
      'a:has-text("Debit or Credit Card")',
    ]);
    await waitForAnyVisible(page, ['#country', '#cardNumber', '#firstName', '#password'], 25000);
    await page.waitForTimeout(1000);

    await page.locator('#country').selectOption('US').catch(() => {});
    await page.waitForTimeout(1000);
    await typeAny(page, ['#cardNumber'], process.env.PAYPAL_SANDBOX_CARD_NUMBER || '4111111111111111', 25000);
    await typeAny(page, ['#cardExpiry'], process.env.PAYPAL_SANDBOX_CARD_EXPIRY || '12/30', 25000);
    await typeAny(page, ['#cardCvv'], process.env.PAYPAL_SANDBOX_CARD_CVV || '123', 25000);
    await fillAny(page, ['#firstName'], guestFirstName, 25000);
    await fillAny(page, ['#lastName'], guestLastName, 25000);
    await fillAny(page, ['#billingLine1'], guestAddress1, 25000);
    await fillAny(page, ['#billingCity'], guestCity, 25000);
    await waitForAnyVisible(page, ['#billingState', '#billingPostalCode'], 10000);
    const billingStateVisible = await page.locator('#billingState').isVisible().catch(() => false);
    if (billingStateVisible) {
      await page.locator('#billingState').selectOption(guestState).catch(async () => {
        await page.locator('#billingState').selectOption({ label: guestState });
      });
    }
    await fillAny(page, ['#billingPostalCode'], guestPostalCode, 25000);
    await typeAny(page, ['#phone'], guestPhone, 25000);
    await fillAny(page, ['#email'], guestEmail, 25000);
    await relaxValidationAny(page, ['#cardExpiry', '#phone']);

    await page.locator('#shipToBilling').check().catch(() => {});
    await fillAny(page, [
      'input#password',
      'input[name="password"]',
      'input[name="newPassword"]',
      'input[autocomplete="new-password"]',
      'input[type="password"]',
    ], guestPassword, 3000).catch(() => {});
    await page.waitForTimeout(1000);

    const button = await clickGuestSubmit(page);

    if (!button) {
      throw new Error('Could not find PayPal guest submit button');
    }

    await page.waitForLoadState('domcontentloaded').catch(() => {});
    const sawSuccess = await pageShowsPayPalSuccess(page, 45000);
    if (!sawSuccess) {
      await page.waitForTimeout(15000);
    }
    const diagnostics = await page.evaluate(() => {
      const cleanText = (value) => String(value || '').replace(/\s+/g, ' ').trim();
      const errors = Array.from(document.querySelectorAll('[role="alert"], .error, .vx_form-control--error, [data-testid*="error"], .ppvx_text--error'))
        .map((node) => cleanText(node.textContent))
        .filter(Boolean)
        .slice(0, 30);
      const invalidFields = Array.from(document.querySelectorAll('input, select, textarea'))
        .map((node) => ({
          id: node.id || null,
          name: node.getAttribute('name'),
          type: node.getAttribute('type'),
          required: Boolean(node.required),
          disabled: Boolean(node.disabled),
          visible: Boolean(node.offsetWidth || node.offsetHeight || node.getClientRects().length),
          value: node.value || '',
          ariaInvalid: node.getAttribute('aria-invalid'),
          validationMessage: typeof node.validationMessage === 'string' ? node.validationMessage : '',
          valid: typeof node.checkValidity === 'function' ? node.checkValidity() : null,
        }))
        .filter((node) => node.visible && !node.disabled && ((node.required && !node.value) || node.valid === false || node.ariaInvalid === 'true'))
        .slice(0, 30);
      const buttons = Array.from(document.querySelectorAll('button, input[type="submit"]'))
        .map((node) => ({
          text: cleanText(node.textContent || node.value),
          id: node.id || null,
          type: node.getAttribute('type'),
          disabled: Boolean(node.disabled),
          ariaDisabled: node.getAttribute('aria-disabled'),
          className: node.className || '',
          dataTestId: node.getAttribute('data-testid'),
        }))
        .slice(0, 30);
      const toggles = Array.from(document.querySelectorAll('input[type="checkbox"], input[type="radio"]'))
        .map((node) => ({
          id: node.id || null,
          name: node.getAttribute('name'),
          type: node.getAttribute('type'),
          checked: Boolean(node.checked),
          required: Boolean(node.required),
          disabled: Boolean(node.disabled),
          visible: Boolean(node.offsetWidth || node.offsetHeight || node.getClientRects().length),
          ariaInvalid: node.getAttribute('aria-invalid'),
          validationMessage: typeof node.validationMessage === 'string' ? node.validationMessage : '',
        }))
        .slice(0, 30);
      return { errors, invalidFields, buttons, toggles };
    });
    const text = (await page.locator('body').innerText().catch(() => '')).split('\n').filter((line) => {
      const trimmed = line.trim();
      return trimmed && trimmed.length < 120;
    }).slice(-40).join('\n');
    console.log(JSON.stringify({ finalUrl: page.url(), diagnostics, text }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(`PayPal guest payment failed: ${error.message || error}`);
  process.exit(1);
});
