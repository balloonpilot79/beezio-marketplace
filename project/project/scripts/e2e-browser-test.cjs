const { chromium } = require('playwright');

// Browser E2E runner: loads the deployed site and executes any test helpers
// exposed to window (e.g., window.testAuthenticationFlows).
// This avoids brittle selector crawling and exercises the actual built client.


(async () => {
  let previewServer;
  const candidateUrls = [];

  if (process.env.E2E_BASE_URL) {
    candidateUrls.push(process.env.E2E_BASE_URL);
  } else {
    try {
      const { preview } = await import('vite');
      previewServer = await preview({
        root: process.cwd(),
        preview: {
          host: '127.0.0.1',
          port: 4173,
          strictPort: true
        }
      });

      const localPreviewUrl = previewServer.resolvedUrls?.local?.[0] || 'http://127.0.0.1:4173';
      candidateUrls.push(localPreviewUrl);
      console.log('Launched local preview server for E2E tests at', localPreviewUrl);
    } catch (err) {
      console.warn('Unable to launch local Vite preview server automatically:', err?.message || err);
    }

    candidateUrls.push(
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:5173'
    );
  }

  if (!candidateUrls.includes('https://beezio.co')) {
    candidateUrls.push('https://beezio.co');
  }

  let url = candidateUrls[candidateUrls.length - 1];

  for (const candidate of candidateUrls) {
    const probeUrl = candidate.endsWith('/') ? candidate : `${candidate}/`;
    try {
      const response = await fetch(probeUrl, { method: 'GET' });
      if (response.ok) {
        url = candidate;
        break;
      }
    } catch (err) {
      // Ignore failures and continue probing the next candidate
    }
  }

  console.log('Starting browser E2E test against', url);

  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  let exitCode = 0;

  page.on('console', msg => {
    const text = msg.text();
    console.log('[page]', text);
  });

  page.on('pageerror', err => {
    console.error('[page error]', err);
  });

  try {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    console.log('Page loaded, checking for test helpers...');

    const hasTester = await page.evaluate(() => Boolean(window.testAuthenticationFlows));

    if (!hasTester) {
      console.warn('No window.testAuthenticationFlows found on the page. The site may not expose the test helper.');
      console.warn('You can still exercise UI flows with Playwright selectors, but that requires knowledge of the UI elements.');
      exitCode = 2;
    } else {
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
        exitCode = 0;
      } else {
        console.error('Browser E2E test failed:', result.message);
        exitCode = 3;
      }
    }

  } catch (err) {
    console.error('Error running browser E2E test:', err);
    exitCode = 4;
  } finally {
    await browser.close();
    if (previewServer) {
      try {
        await previewServer.close();
      } catch (closeErr) {
        console.warn('Failed to close preview server cleanly:', closeErr?.message || closeErr);
      }
    }
    process.exit(exitCode);
  }
})();
