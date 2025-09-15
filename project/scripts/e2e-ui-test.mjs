import { chromium } from 'playwright';
import fs from 'fs';

// Allow overriding the target base URL with TEST_BASE for local testing
const BASE = process.env.TEST_BASE || 'https://beezio.co';
const TIMEOUT = 20000;

function nowName(prefix) {
  return `${prefix}-${Date.now()}.png`;
}

async function run() {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', msg => console.log('[page]', msg.text()));
  page.on('pageerror', err => console.error('[page error]', err));

  try {
    // Use domcontentloaded and a larger timeout to avoid waiting for every external resource
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });

    // Prefer visiting the explicit signup route (more reliable than clicking UI)
    try {
      await page.goto(`${BASE}/signup`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    } catch (e) {
      console.warn('/signup route not available or navigation failed, trying to click signup UI');
      const signupSelectors = ['text=Sign Up', 'text=Create account', 'button:has-text("Sign up")', 'a:has-text("Sign Up")'];
      let signupEl = null;
      for (const s of signupSelectors) {
        const el = await page.$(s);
        if (el) { signupEl = el; break; }
      }
      if (!signupEl) {
        console.warn('No signup UI found; continuing from homepage');
      } else {
        await Promise.all([signupEl.click(), page.waitForLoadState('domcontentloaded', { timeout: 30000 })]);
      }
    }

    // Wait for a form email field to appear
    await page.waitForSelector('input[type="email"], input[name="email"], input[placeholder*="Email"]', { timeout: 20000 });

    // Try common email field selectors
    const emailSelectors = ['input[type="email"]', 'input[name="email"]', 'input[placeholder*="Email"]'];
    let emailInput = null;
    for (const s of emailSelectors) {
      try { const el = await page.$(s); if (el) { emailInput = el; break; } } catch (e) {}
    }

    if (!emailInput) {
      console.error('Email input not found. Saving screenshot.');
      await page.screenshot({ path: nowName('no-email-input') });
      await browser.close();
      process.exit(2);
    }

    const testEmail = `ui-e2e-${Date.now()}@test.beezio.co`;
    const testPassword = 'TestPass!234';

    await emailInput.fill(testEmail);

    // password input
    const pwSelectors = ['input[type="password"]', 'input[name="password"]', 'input[placeholder*="Password"]'];
    let pwInput = null;
    for (const s of pwSelectors) {
      const el = await page.$(s);
      if (el) { pwInput = el; break; }
    }

    if (!pwInput) {
      console.error('Password input not found. Saving screenshot.');
      await page.screenshot({ path: nowName('no-password-input') });
      await browser.close();
      process.exit(3);
    }

    await pwInput.fill(testPassword);

    // Try to find and click the submit button
    const submitSelectors = ['button:has-text("Sign up")', 'button:has-text("Create account")', 'button[type="submit"]'];
    let sub = null;
    for (const s of submitSelectors) {
      try { const el = await page.$(s); if (el) { sub = el; break; } } catch (e) {}
    }

    if (!sub) {
      console.warn('Submit button not found, trying Enter key');
      await pwInput.press('Enter');
    } else {
      await Promise.all([sub.click(), page.waitForLoadState('domcontentloaded', { timeout: 30000 })]);
    }

    // Wait briefly for any session handling
    await page.waitForTimeout(2500);

    // Look for login state indicators — e.g., dashboard link or logout
    const loggedInIndicators = ['text=Dashboard', 'text=Logout', 'button:has-text("Logout")', 'a:has-text("Dashboard")'];
    let loggedIn = false;
    for (const s of loggedInIndicators) {
      const el = await page.$(s);
      if (el) { loggedIn = true; break; }
    }

    console.log('Sign up finished — loggedInIndicator:', loggedIn);

    // If not logged in, try sign in flow via /login
    if (!loggedIn) {
      console.log('Attempting sign in via /login');
      try {
        await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      } catch (e) {
        console.warn('/login route navigation failed; trying to locate login UI on current page');
      }
      await page.waitForTimeout(1000);
      // fill login form
      const loginEmail = await page.$('input[type="email"]') || await page.$('input[name="email"]');
      const loginPw = await page.$('input[type="password"]') || await page.$('input[name="password"]');
      if (!loginEmail || !loginPw) {
        console.error('Login form inputs not found. Screenshot saved.');
        await page.screenshot({ path: nowName('no-login-form') });
        await browser.close();
        process.exit(4);
      }
      await loginEmail.fill(testEmail);
      await loginPw.fill(testPassword);
      const loginBtn = await page.$('button:has-text("Sign in")') || await page.$('button[type="submit"]');
  if (loginBtn) await Promise.all([loginBtn.click(), page.waitForLoadState('domcontentloaded', { timeout: 30000 })]);
  await page.waitForTimeout(2000);
      // re-check login indicator
      for (const s of loggedInIndicators) {
        const el = await page.$(s);
        if (el) { loggedIn = true; break; }
      }
    }

    console.log('After sign-in attempt, loggedIn:', loggedIn);

    // Test logout if logged in
    if (loggedIn) {
      const logoutBtn = await page.$('button:has-text("Logout")') || await page.$('a:has-text("Logout")');
      if (logoutBtn) {
        await Promise.all([logoutBtn.click(), page.waitForLoadState('domcontentloaded', { timeout: 20000 })]);
        console.log('Clicked logout');
      } else {
        console.warn('Logout button not found');
      }
    }

    // Test password reset
    console.log('Testing password reset flow — attempting to click "Forgot password"');
    const forgotSelectors = ['text=Forgot password', 'text=Reset password', 'a:has-text("Forgot")', 'button:has-text("Forgot")'];
    let forgot = null;
    for (const s of forgotSelectors) {
      const el = await page.$(s);
      if (el) { forgot = el; break; }
    }

    if (!forgot) {
      console.warn('Forgot password link/button not found — trying /reset-password route');
      try { await page.goto(`${BASE}/reset-password`, { waitUntil: 'domcontentloaded', timeout: 30000 }); } catch (e) { console.warn('/reset-password navigation failed'); }
      await page.waitForTimeout(1000);
    } else {
      await Promise.all([forgot.click(), page.waitForLoadState('domcontentloaded', { timeout: 20000 })]);
    }

    const resetEmailInput = await page.$('input[type="email"]') || await page.$('input[name="email"]');
    if (!resetEmailInput) {
      console.error('Reset email input not found. Screenshot saved.');
      await page.screenshot({ path: nowName('no-reset-input') });
      await browser.close();
      process.exit(5);
    }

    await resetEmailInput.fill(testEmail);
    const resetBtn = await page.$('button:has-text("Reset")') || await page.$('button:has-text("Send reset link")') || await page.$('button[type="submit"]');
    if (resetBtn) await resetBtn.click();
    await page.waitForTimeout(3000);

    // Observe network console messages for errors
    console.log('Password reset request completed (check Supabase email delivery).');

    console.log('\nUI E2E finished — success path completed.');

    await browser.close();
    process.exit(0);

  } catch (err) {
    console.error('UI E2E error:', err);
    try { await page.screenshot({ path: nowName('ui-e2e-error') }); } catch (e) {}
    await browser.close();
    process.exit(6);
  }
}

run();
