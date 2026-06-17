import type { Handler } from '@netlify/functions';

const json = (statusCode: number, body: unknown) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
  },
  body: JSON.stringify(body),
});

const parseBody = (raw: string | null) => {
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const decodeHtmlEntities = (value: string) =>
  String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();

const extractMetaContent = (html: string, key: string): string => {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regexes = [
    new RegExp(`<meta[^>]+property=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${escaped}["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+name=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${escaped}["'][^>]*>`, 'i'),
  ];
  for (const regex of regexes) {
    const match = html.match(regex);
    if (match?.[1]) return decodeHtmlEntities(match[1]);
  }
  return '';
};

const toAbsoluteUrl = (value: string): string => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (raw.startsWith('//')) return `https:${raw}`;
  return raw;
};

const safeJsonParse = (value: string): any | null => {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const flattenProductJsonLd = (payload: any): any[] => {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload.flatMap(flattenProductJsonLd);
  if (payload['@graph'] && Array.isArray(payload['@graph'])) {
    return payload['@graph'].flatMap(flattenProductJsonLd);
  }
  return [payload];
};

const pickProductFromJsonLd = (html: string) => {
  const scriptRegex = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;

  while ((match = scriptRegex.exec(html)) !== null) {
    const content = String(match[1] || '').trim();
    if (!content) continue;
    const parsed = safeJsonParse(content);
    if (!parsed) continue;
    const candidates = flattenProductJsonLd(parsed);
    const found = candidates.find((node: any) => {
      const type = String(node?.['@type'] || '').toLowerCase();
      return type.includes('product');
    });
    if (found) return found;
  }

  return null;
};

const parsePrice = (value: unknown): number | null => {
  const text = String(value ?? '').trim();
  if (!text) return null;
  const cleaned = text.replace(/[^0-9.,-]/g, '').replace(/,/g, '');
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const extractFallbackPriceFromHtml = (html: string): number | null => {
  const patterns = [
    /"price"\s*:\s*"?([0-9]+(?:\.[0-9]+)?)"?/i,
    /"salePrice"\s*:\s*"?([0-9]+(?:\.[0-9]+)?)"?/i,
    /US\s*\$\s*([0-9]+(?:\.[0-9]+)?)/i,
    /\$\s*([0-9]+(?:\.[0-9]+)?)/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      const parsed = parsePrice(match[1]);
      if (parsed) return parsed;
    }
  }
  return null;
};

const looksLikeCaptchaGate = (html: string) => {
  const text = String(html || '').toLowerCase();
  return (
    text.includes('captcha interception') ||
    text.includes('unusual traffic') ||
    text.includes('slide to verify') ||
    text.includes('_____tmd_____') ||
    text.includes('x5secdata=')
  );
};

const extractImageUrlsFromHtml = (html: string): string[] => {
  const imageRegex = /https?:\/\/[^"'\\\s<>]+?\.(?:jpg|jpeg|png|webp)(?:\?[^"'\\\s<>]*)?/gi;
  const matches = html.match(imageRegex) || [];
  return matches
    .map((item) => toAbsoluteUrl(item))
    .filter((item) => item && (/alicdn|aliexpress|ae01\.alicdn/i.test(item) || /^https?:\/\//i.test(item)));
};

const extractVideoUrlsFromHtml = (html: string): string[] => {
  const videoRegex = /https?:\/\/[^"'\\\s<>]+?\.(?:mp4|m3u8)(?:\?[^"'\\\s<>]*)?/gi;
  const matches = html.match(videoRegex) || [];
  return matches.map((item) => toAbsoluteUrl(item)).filter(Boolean);
};

const extractShippingCostFromHtml = (html: string): number | null => {
  if (/free\s+shipping/i.test(html)) return 0;

  const patterns = [
    /(?:shipping|delivery)[^$0-9]{0,25}(?:US\s*)?\$([0-9]+(?:\.[0-9]+)?)/i,
    /(?:US\s*)?\$([0-9]+(?:\.[0-9]+)?)\s*(?:shipping|delivery)/i,
    /"shipping(?:Price|Cost)?"\s*:\s*"?([0-9]+(?:\.[0-9]+)?)"?/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      const parsed = parsePrice(match[1]);
      if (parsed !== null) return parsed;
    }
  }
  return null;
};

const extractShippingSummaryFromHtml = (html: string): string => {
  const summaryPatterns = [
    /(Free\s+shipping[^<\n]{0,80})/i,
    /((?:Shipping|Delivery)[^<\n]{0,120}(?:\$\s*[0-9]+(?:\.[0-9]+)?)[^<\n]{0,60})/i,
  ];
  for (const pattern of summaryPatterns) {
    const match = html.match(pattern);
    if (match?.[1]) return decodeHtmlEntities(match[1]);
  }
  return '';
};

const unique = (values: string[]) => {
  const set = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const normalized = toAbsoluteUrl(value);
    if (!normalized) continue;
    if (set.has(normalized)) continue;
    set.add(normalized);
    out.push(normalized);
  }
  return out;
};

const extractProductIdFromUrl = (value: string) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const patterns = [/\/item\/(\d+)\.html/i, /\/i\/(\d+)\.html/i, /item\/(\d+)/i, /[?&]productId=(\d+)/i];
  for (const pattern of patterns) {
    const match = raw.match(pattern);
    if (match?.[1]) return match[1];
  }
  return '';
};

const extractProductIdFromHtml = (html: string) => {
  const patterns = [/"productId"\s*:\s*"(\d+)"/i, /"itemId"\s*:\s*"(\d+)"/i, /"product_id"\s*:\s*"(\d+)"/i];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return match[1];
  }
  return '';
};

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { ok: false, error: 'Method not allowed' });

  try {
    const body = parseBody(event.body || null);
    const targetUrl = String(body?.url || '').trim();

    if (!targetUrl) return json(400, { ok: false, error: 'Missing url' });
    if (!/^https?:\/\//i.test(targetUrl)) return json(400, { ok: false, error: 'URL must start with http/https' });

    const host = (() => {
      try {
        return new URL(targetUrl).hostname.toLowerCase();
      } catch {
        return '';
      }
    })();

    if (!host.includes('aliexpress.')) {
      return json(400, { ok: false, error: 'Please use a valid AliExpress product link.' });
    }

    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        Referer: 'https://www.aliexpress.com/',
      },
    });

    let html = await response.text();
    if (!response.ok) {
      return json(response.status, {
        ok: false,
        error: `AliExpress page request failed (${response.status})`,
      });
    }

    // Retry with a US gateway URL if the first response looks like bot/captcha interstitial.
    if (looksLikeCaptchaGate(html)) {
      const pid = extractProductIdFromUrl(targetUrl);
      if (pid) {
        const fallbackUrl = `https://www.aliexpress.us/item/${pid}.html?gatewayAdapt=glo2usa4itemAdapt&_randl_shipto=US`;
        try {
          const fallbackResponse = await fetch(fallbackUrl, {
            method: 'GET',
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
              Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
              'Accept-Language': 'en-US,en;q=0.9',
              Referer: 'https://www.aliexpress.us/',
            },
          });
          if (fallbackResponse.ok) {
            const fallbackHtml = await fallbackResponse.text();
            if (!looksLikeCaptchaGate(fallbackHtml)) {
              html = fallbackHtml;
            }
          }
        } catch {
          // ignore fallback errors and continue with original html
        }
      }
    }

    const productJsonLd = pickProductFromJsonLd(html);

    const title =
      decodeHtmlEntities(String(productJsonLd?.name || '')) ||
      extractMetaContent(html, 'og:title') ||
      extractMetaContent(html, 'twitter:title');

    const description =
      decodeHtmlEntities(String(productJsonLd?.description || '')) ||
      extractMetaContent(html, 'og:description') ||
      extractMetaContent(html, 'description');

    const jsonLdImages = Array.isArray(productJsonLd?.image)
      ? productJsonLd.image
      : productJsonLd?.image
      ? [productJsonLd.image]
      : [];

    const ogImage = extractMetaContent(html, 'og:image');

    const images = unique([
      ...jsonLdImages.map((item: any) => String(item || '').trim()),
      ogImage,
    ]);

    const videos = unique([
      extractMetaContent(html, 'og:video'),
      extractMetaContent(html, 'twitter:player'),
      ...extractVideoUrlsFromHtml(html),
    ]);

    const priceFromJsonLd =
      parsePrice(productJsonLd?.offers?.price) ||
      (Array.isArray(productJsonLd?.offers)
        ? parsePrice(productJsonLd.offers.find((offer: any) => parsePrice(offer?.price))?.price)
        : null);

    const price =
      priceFromJsonLd ||
      parsePrice(extractMetaContent(html, 'product:price:amount')) ||
      parsePrice(extractMetaContent(html, 'twitter:data1')) ||
      extractFallbackPriceFromHtml(html);

    const currency =
      String(productJsonLd?.offers?.priceCurrency || '').trim().toUpperCase() ||
      String(extractMetaContent(html, 'product:price:currency') || 'USD').trim().toUpperCase();

    const productId = extractProductIdFromUrl(targetUrl);
    const shippingCost = extractShippingCostFromHtml(html);
    const shippingSummary = extractShippingSummaryFromHtml(html);
    const fallbackImages = extractImageUrlsFromHtml(html);
    const resolvedProductId = productId || extractProductIdFromHtml(html);
    const resolvedImages = unique([...images, ...fallbackImages]).slice(0, 20);
    const hasMeaningfulData =
      Boolean((title || '').trim()) ||
      Boolean((description || '').trim()) ||
      resolvedImages.length > 0 ||
      Boolean(price);

    if (!hasMeaningfulData) {
      return json(422, {
        ok: false,
        error:
          'AliExpress blocked product metadata for this link (captcha/anti-bot). Try another link or import manually for this item.',
        diagnostics: {
          captchaDetected: looksLikeCaptchaGate(html),
          productId: resolvedProductId || '',
          httpStatus: response.status,
        },
      });
    }

    return json(200, {
      ok: true,
      data: {
        title: title || '',
        description: description || '',
        images: resolvedImages,
        videos,
        sourcePrice: price,
        shippingCost,
        shippingSummary,
        currency: currency || 'USD',
        externalProductId: resolvedProductId || '',
        supplierSku: '',
      },
      diagnostics: {
        httpStatus: response.status,
        hasJsonLd: Boolean(productJsonLd),
        imageCount: resolvedImages.length,
      },
    });
    
  } catch (error) {
    return json(500, {
      ok: false,
      error: error instanceof Error ? error.message : 'Unexpected error',
    });
  }
};
