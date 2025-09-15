const { chromium } = require('playwright');

// Browser E2E runner: loads the deployed site and executes any test helpers
// exposed to window (e.g., window.testAuthenticationFlows).
// This avoids brittle selector crawling and exercises the actual built client.

(async () => {
  const url = 'https://beezio.co';
  console.log('Starting browser E2E test against', url);

  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', msg => {
    const text = msg.text();
    console.log('[page]', text);
  });

  page.on('pageerror', err => {
    console.error('[page error]', err);
  });

  try {
    await page.goto(url, { waitUntil: 'networkidle' });
    console.log('Page loaded, checking for test helpers...');

    const hasTester = await page.evaluate(() => Boolean(window.testAuthenticationFlows));

    if (!hasTester) {
      console.warn('No window.testAuthenticationFlows found on the page. The site may not expose the test helper.');
      console.warn('You can still exercise UI flows with Playwright selectors, but that requires knowledge of the UI elements.');
      await browser.close();
      process.exit(2);
    }

    console.log('Found test helper. Executing testAuthenticationFlows() in page context. This may create test users and trigger emails.');

    const result = await page.evaluate(async () => {
      try {
        // run the exported test which logs to the page console
        await window.testAuthenticationFlows();
        return { success: true };
      } catch (err) {
        return { success: false, message: err?.message || String(err) };
      }
    });

    if (result.success) {
      console.log('Browser E2E test completed successfully.');
      await browser.close();
      process.exit(0);
    } else {
      console.error('Browser E2E test failed:', result.message);
      await browser.close();
      process.exit(3);
    }

  } catch (err) {
    console.error('Error running browser E2E test:', err);
    await browser.close();
    process.exit(4);
  }
})();
