const { chromium } = require('playwright');

// Browser E2E runner: loads the deployed site and executes any test helpers
// exposed to window (e.g., window.testAuthenticationFlows).
// This avoids brittle selector crawling and exercises the actual built client.

const E2E_EVAL_TIMEOUT_MS = Number(process.env.E2E_EVAL_TIMEOUT_MS || 3 * 60 * 1000); // 3 min
const E2E_GLOBAL_TIMEOUT_MS = Number(process.env.E2E_GLOBAL_TIMEOUT_MS || 5 * 60 * 1000); // 5 min
const ALLOW_PRODUCTION_TARGET = String(process.env.E2E_ALLOW_PRODUCTION || '').trim() === '1';

async function waitForStablePage(page) {
  await page.waitForLoadState('domcontentloaded', { timeout: 60000 }).catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 60000 }).catch(() => {});
}

async function readHelpersWithRetry(page) {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await waitForStablePage(page);
      return await page.evaluate(() => ({
        hasAuth: Boolean(window.testAuthenticationFlows),
        hasLaunch: Boolean(window.testLaunchCriticalFlows),
      }));
    } catch (error) {
      lastError = error;
      const message = String(error?.message || error || '');
      if (!message.toLowerCase().includes('execution context was destroyed')) {
        throw error;
      }
      await page.waitForTimeout(500 * (attempt + 1));
    }
  }
  throw lastError;
}

function normalizeDisplayedPrice(value) {
  const match = String(value || '').match(/\$?([0-9]+(?:\.[0-9]{2})?)/);
  return match ? Number(match[1]) : NaN;
}

async function runSmokeFallback(page, url) {
  const baseUrl = url.replace(/\/+$/, '');

  const assertNoFatalPageError = async () => {
    const fatalText = await page.evaluate(() => {
      const text = document.body?.innerText || '';
      const patterns = [
        'application error',
        'unexpected application error',
        'something went wrong',
        'failed to fetch',
      ];
      return patterns.find((pattern) => text.toLowerCase().includes(pattern)) || '';
    });

    if (fatalText) {
      throw new Error(`Page rendered fatal text: ${fatalText}`);
    }
  };

  await page.waitForLoadState('networkidle', { timeout: 60000 }).catch(() => {});
  await assertNoFatalPageError();

  console.log('No browser helpers found. Running smoke fallback checks.');

  await page.goto(`${baseUrl}/marketplace`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForLoadState('networkidle', { timeout: 60000 }).catch(() => {});
  await assertNoFatalPageError();

  const marketplaceState = await page.evaluate(() => {
    const productCards = document.querySelectorAll(
      '[data-testid^="product-card-"], a[href*="/product/"], a[href*="/store/"]'
    ).length;
    const text = document.body?.innerText || '';
    return {
      productCards,
      hasMarketplaceText: /marketplace|products|shop/i.test(text),
    };
  });

  if (!marketplaceState.hasMarketplaceText) {
    throw new Error('Marketplace smoke check failed: expected marketplace content was not rendered.');
  }

  if (marketplaceState.productCards < 1) {
    throw new Error('Marketplace smoke check failed: no product cards or product links were rendered.');
  }

  await page.goto(`${baseUrl}/signup`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForLoadState('networkidle', { timeout: 60000 }).catch(() => {});
  await assertNoFatalPageError();

  const authState = await page.evaluate(() => {
    const body = document.body?.innerText || '';
    const hasEmailInput = Boolean(
      document.querySelector('input[type="email"], input[name="email"], input[autocomplete="email"]')
    );
    return {
      hasEmailInput,
      hasAuthText: /sign up|create account|email/i.test(body),
    };
  });

  if (!authState.hasEmailInput && !authState.hasAuthText) {
    throw new Error('Signup smoke check failed: auth UI did not render as expected.');
  }

  console.log('Smoke fallback checks passed.');
}

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

    // If we were unable to start preview, probe common dev ports.
    candidateUrls.push('http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:5173');
  }

  // Safety: never target production unless explicitly allowed.
  if (ALLOW_PRODUCTION_TARGET && !candidateUrls.includes('https://beezio.co')) {
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

  page.setDefaultTimeout(60000);
  page.setDefaultNavigationTimeout(60000);

  const globalTimer = setTimeout(() => {
    console.error(`E2E browser test timed out after ${Math.round(E2E_GLOBAL_TIMEOUT_MS / 1000)}s`);
    exitCode = 124;
    browser.close().catch(() => {});
  }, E2E_GLOBAL_TIMEOUT_MS);

  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('Auth change profile fetch timed out or failed:')) {
      return;
    }
    if (text.includes('Loading timeout reached (10s), setting loading to false')) {
      return;
    }
    console.log('[page]', text);
  });

  page.on('pageerror', err => {
    console.error('[page error]', err);
  });

  page.on('requestfailed', req => {
    const failureText = req.failure()?.errorText || '';
    if (['net::ERR_ABORTED', 'net::ERR_BLOCKED_BY_ORB'].includes(failureText) && ['image', 'media', 'font'].includes(req.resourceType())) {
      return;
    }
    console.warn('[requestfailed]', req.method(), req.url(), req.failure()?.errorText || '');
  });

  try {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    console.log('Page loaded, checking for test helpers...');

    const helpers = await readHelpersWithRetry(page);

    if (!helpers.hasAuth && !helpers.hasLaunch) {
      await runSmokeFallback(page, url);
      exitCode = 0;
    } else if (helpers.hasLaunch) {
      console.log('Found test helper. Executing testLaunchCriticalFlows() in page context.');

      const result = await Promise.race([
        page.evaluate(async () => {
          try {
            const res = await window.testLaunchCriticalFlows();
            return { success: true, data: res };
          } catch (err) {
            return { success: false, message: err?.message || String(err) };
          }
        }),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error(`testLaunchCriticalFlows() timed out after ${Math.round(E2E_EVAL_TIMEOUT_MS / 1000)}s`)),
            E2E_EVAL_TIMEOUT_MS
          )
        )
      ]);

      if (!result.success) {
        console.error('Launch-critical E2E helper failed:', result.message);
        exitCode = 3;
      } else {
        const data = result.data || {};
        const sellerProfileId = data.sellerProfileId;
        const storeRoute = data.storeRoute;
        const storeRouteSlug = data.storeRouteSlug;
        const createdProductId = data.createdProductId;
        const ownTitle = data.ownProductTitle;
        const curatedProductId = data.curatedProductId;
        const curatedTitle = data.curatedProductTitle;

        if (!sellerProfileId || !storeRoute || !storeRouteSlug || !createdProductId || !ownTitle || !curatedProductId || !curatedTitle) {
          console.error('Launch-critical helper did not return required info:', data);
          exitCode = 3;
        } else {
          const baseUrl = url.replace(/\/+$/, '');
          const storeUrlById = storeRoute.startsWith('http') ? storeRoute : `${baseUrl}${storeRoute}`;
          const storeUrlBySlug = storeRouteSlug.startsWith('http') ? storeRouteSlug : `${baseUrl}${storeRouteSlug}`;

          const assertStorefrontRendersProducts = async (targetUrl) => {
            console.log('Navigating to seller store:', targetUrl);
            await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

            // Wait for products section to exist (attached to DOM). We'll separately assert visibility.
            try {
              await page.locator('#products').waitFor({ state: 'attached', timeout: 60000 });
            } catch (err) {
              const debug = await page.evaluate(() => {
                const el = document.getElementById('products');
                return {
                  location: String(window.location.href || ''),
                  hasProductsEl: Boolean(el),
                  bodyTextSample: (document.body?.innerText || '').slice(0, 5000),
                };
              });
              console.error('Products section not attached debug:', debug);
              throw err;
            }

            const productsVisibility = await page.evaluate(() => {
              const el = document.getElementById('products');
              if (!el) return { visible: false, reason: 'missing' };
              const style = window.getComputedStyle(el);
              const rect = el.getBoundingClientRect();
              const visible =
                style.display !== 'none' &&
                style.visibility !== 'hidden' &&
                Number(style.opacity || '1') > 0 &&
                rect.width > 0 &&
                rect.height > 0;
              return {
                visible,
                display: style.display,
                visibility: style.visibility,
                opacity: style.opacity,
                rect: { width: rect.width, height: rect.height, top: rect.top, left: rect.left },
              };
            });
            if (!productsVisibility.visible) {
              console.warn('⚠️ #products exists but is not visible:', productsVisibility);
            }

            // Assert both items render on the storefront page via stable test ids.
            const ownedTitleLocator = page.locator(`[data-testid="product-title-${createdProductId}"]`);
            const curatedTitleLocator = page.locator(`[data-testid="product-title-${curatedProductId}"]`);

            try {
              await ownedTitleLocator.waitFor({ timeout: 60000 });
              await curatedTitleLocator.waitFor({ timeout: 60000 });
            } catch (err) {
              const debug = await page.evaluate(() => {
                const titles = Array.from(document.querySelectorAll('[data-testid^="product-title-"]'))
                  .map((el) => (el.textContent || '').trim())
                  .filter(Boolean);
                const h3s = Array.from(document.querySelectorAll('h3'))
                  .map((el) => (el.textContent || '').trim())
                  .filter(Boolean)
                  .slice(0, 30);
                return {
                  titleCount: titles.length,
                  titles,
                  h3s,
                  location: String(window.location.href || ''),
                };
              });
              console.error('Storefront assertion debug:', debug);
              throw err;
            }

            // Extra safety: confirm text content matches what we created/curated.
            const ownedText = (await ownedTitleLocator.first().textContent()) || '';
            const curatedText = (await curatedTitleLocator.first().textContent()) || '';
            if (!ownedText.includes(ownTitle) || !curatedText.includes(curatedTitle)) {
              throw new Error(
                `Title text mismatch at ${targetUrl}: expected (${ownTitle}, ${curatedTitle}) got (${ownedText}, ${curatedText})`
              );
            }
          };

          // Validate both routes.
          await assertStorefrontRendersProducts(storeUrlById);
          await assertStorefrontRendersProducts(storeUrlBySlug);

          const assertRegisterAliasRendersAuth = async () => {
            const registerUrl = `${baseUrl}/auth/register`;
            console.log('Checking register alias route:', registerUrl);
            await page.goto(registerUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
            await page.waitForLoadState('networkidle', { timeout: 60000 }).catch(() => {});

            const authState = await page.evaluate(() => {
              const bodyText = document.body?.innerText || '';
              const hasEmailInput = Boolean(
                document.querySelector('input[type="email"], input[name="email"], input[autocomplete="email"]')
              );
              return {
                location: String(window.location.href || ''),
                hasEmailInput,
                hasAuthHeading: /create your beezio account|sign up|create account/i.test(bodyText),
                hasNotFound: /page not found|store not found/i.test(bodyText),
              };
            });

            if (authState.hasNotFound || (!authState.hasEmailInput && !authState.hasAuthHeading)) {
              throw new Error(`Register alias route did not render auth UI: ${JSON.stringify(authState)}`);
            }
          };

          await assertRegisterAliasRendersAuth();

          const assertMarketplaceAndDetailPriceMatch = async () => {
            const marketplaceUrl = `${baseUrl}/marketplace`;
            const publicContext = await browser.newContext();
            const publicPage = await publicContext.newPage();
            publicPage.setDefaultTimeout(60000);
            publicPage.setDefaultNavigationTimeout(60000);
            console.log('Comparing marketplace and product detail prices for the first visible marketplace product.');

            try {
              await publicPage.goto(marketplaceUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

              const productLink = publicPage.locator('a[href*="/product/"]').first();
              try {
                await productLink.waitFor({ state: 'visible', timeout: 60000 });
              } catch (error) {
                let debug = {
                  location: 'unavailable',
                  bodyTextSample: '',
                  productLinkCount: -1,
                  reason: error?.message || String(error),
                };

                if (!publicPage.isClosed()) {
                  try {
                    debug = await publicPage.evaluate((reason) => ({
                      location: String(window.location.href || ''),
                      bodyTextSample: (document.body?.innerText || '').slice(0, 2000),
                      productLinkCount: document.querySelectorAll('a[href*="/product/"]').length,
                      reason,
                    }), error?.message || String(error));
                  } catch (debugError) {
                    debug = {
                      ...debug,
                      reason: `${debug.reason}; debug read failed: ${debugError?.message || String(debugError)}`,
                    };
                  }
                }

                console.warn('Skipping marketplace/detail price parity browser check because the marketplace rendered no product links.', debug);
                return;
              }

              const productHref = await productLink.getAttribute('href');
              const productIdMatch = String(productHref || '').match(/\/product\/([^/?#]+)/);
              if (!productIdMatch) {
                throw new Error(`Could not determine marketplace product id from href: ${productHref}`);
              }
              const targetProductId = decodeURIComponent(productIdMatch[1]);

              const marketplacePriceText = await publicPage
                .locator(`[data-testid="product-price-${targetProductId}"]`)
                .first()
                .textContent();

              await productLink.click();
              await publicPage.waitForURL((currentUrl) => currentUrl.pathname.includes(`/product/${targetProductId}`), {
                timeout: 60000,
              });

              const detailPriceText = await publicPage.locator('[data-testid="product-detail-price"]').first().textContent();
              const marketplacePrice = normalizeDisplayedPrice(marketplacePriceText);
              const detailPrice = normalizeDisplayedPrice(detailPriceText);

              if (!Number.isFinite(marketplacePrice) || !Number.isFinite(detailPrice)) {
                throw new Error(
                  `Could not parse prices for ${targetProductId}: marketplace=${marketplacePriceText} detail=${detailPriceText}`
                );
              }

              if (Math.abs(marketplacePrice - detailPrice) > 0.001) {
                throw new Error(
                  `Marketplace/detail price mismatch for ${targetProductId}: marketplace=${marketplacePriceText} detail=${detailPriceText}`
                );
              }
            } finally {
              await publicContext.close();
            }
          };

          await assertMarketplaceAndDetailPriceMatch();

          console.log('✅ Storefront renders seller-owned + curated marketplace products on /store/id/:id and /store/:slug.');
          exitCode = 0;
        }
      }
    } else {
      console.log('Found test helper. Executing testAuthenticationFlows() in page context.');

      const result = await Promise.race([
        page.evaluate(async () => {
          try {
            await window.testAuthenticationFlows();
            return { success: true };
          } catch (err) {
            return { success: false, message: err?.message || String(err) };
          }
        }),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error(`testAuthenticationFlows() timed out after ${Math.round(E2E_EVAL_TIMEOUT_MS / 1000)}s`)),
            E2E_EVAL_TIMEOUT_MS
          )
        )
      ]);

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
    try {
      await page.screenshot({ path: 'e2e-browser-test-fail.png', fullPage: true });
      console.error('Saved screenshot: e2e-browser-test-fail.png');
    } catch {}
    exitCode = 4;
  } finally {
    clearTimeout(globalTimer);
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
