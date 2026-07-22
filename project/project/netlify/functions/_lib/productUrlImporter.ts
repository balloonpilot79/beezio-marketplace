import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

export type ImportedProductVariant = {
  name: string;
  sku: string | null;
  wholesalePrice: number | null;
  available: boolean | null;
  inventory: number | null;
  image: string | null;
  options: Record<string, string>;
};

export type ImportedProductPreview = {
  sourceUrl: string;
  sourceHost: string;
  sourcePlatform: string;
  title: string;
  description: string;
  brand: string | null;
  sku: string | null;
  wholesalePrice: number | null;
  currency: string;
  images: string[];
  variants: ImportedProductVariant[];
  warnings: string[];
};

type DnsLookup = (hostname: string) => Promise<Array<{ address: string; family: number }>>;

const decodeEntities = (value: string) =>
  String(value || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_match, code) => String.fromCharCode(Number(code) || 32));

const stripHtml = (value: unknown) =>
  decodeEntities(String(value || ''))
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<\/?(?:p|div|li|h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim();

const normalizeMoney = (value: unknown, centsLikely = false): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const cleaned = typeof value === 'string' ? value.replace(/[^0-9.-]/g, '') : value;
  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  const normalized = centsLikely && Number.isInteger(parsed) && parsed >= 500 ? parsed / 100 : parsed;
  return Math.round((normalized + Number.EPSILON) * 100) / 100;
};

const normalizeUrl = (value: unknown, baseUrl: string): string | null => {
  const raw = typeof value === 'object' && value ? String((value as any)?.url || (value as any)?.src || '') : String(value || '');
  if (!raw.trim() || raw.startsWith('data:')) return null;
  try {
    const parsed = new URL(raw.trim(), baseUrl);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
    return parsed.toString();
  } catch {
    return null;
  }
};

const uniqueStrings = (values: Array<string | null | undefined>) =>
  Array.from(new Set(values.map((value) => String(value || '').trim()).filter(Boolean)));

const collectImageValues = (value: unknown, baseUrl: string): string[] => {
  if (Array.isArray(value)) return value.flatMap((entry) => collectImageValues(entry, baseUrl));
  const normalized = normalizeUrl(value, baseUrl);
  return normalized ? [normalized] : [];
};

const readMeta = (html: string, key: string): string => {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']*)["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${escaped}["'][^>]*>`, 'i'),
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(html);
    if (match?.[1]) return decodeEntities(match[1]).trim();
  }
  return '';
};

const jsonScripts = (html: string) => {
  const scripts: Array<{ type: string; contents: string }> = [];
  const pattern = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) && scripts.length < 200) {
    const attrs = String(match[1] || '');
    const typeMatch = /type=["']([^"']+)["']/i.exec(attrs);
    const type = String(typeMatch?.[1] || '').toLowerCase();
    if (type.includes('json') || type.includes('ld+json')) {
      scripts.push({ type, contents: String(match[2] || '').trim() });
    }
  }
  return scripts;
};

const safeParseJson = (value: string): any | null => {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const walkObjects = (root: unknown, visitor: (value: any) => void) => {
  const queue: unknown[] = [root];
  const seen = new Set<object>();
  let visited = 0;
  while (queue.length && visited < 8000) {
    const value = queue.shift();
    if (!value || typeof value !== 'object') continue;
    if (seen.has(value as object)) continue;
    seen.add(value as object);
    visited += 1;
    visitor(value);
    if (Array.isArray(value)) queue.push(...value.slice(0, 500));
    else queue.push(...Object.values(value as Record<string, unknown>).slice(0, 500));
  }
};

const typeIncludesProduct = (value: any) => {
  const types = Array.isArray(value?.['@type']) ? value['@type'] : [value?.['@type']];
  return types.some((type) => String(type || '').toLowerCase() === 'product');
};

const optionMap = (variant: any): Record<string, string> => {
  const options: Record<string, string> = {};
  if (Array.isArray(variant?.selectedOptions)) {
    variant.selectedOptions.forEach((entry: any) => {
      const name = String(entry?.name || '').trim();
      const value = String(entry?.value || '').trim();
      if (name && value) options[name] = value;
    });
  }
  if (variant?.options && typeof variant.options === 'object' && !Array.isArray(variant.options)) {
    Object.entries(variant.options).forEach(([name, value]) => {
      const normalized = String(value || '').trim();
      if (normalized) options[String(name || 'Option')] = normalized;
    });
  }
  ['option1', 'option2', 'option3'].forEach((key, index) => {
    const value = String(variant?.[key] || '').trim();
    if (value && value.toLowerCase() !== 'default title') options[`Option ${index + 1}`] = value;
  });
  if (!Object.keys(options).length && variant?.name) options.Variant = String(variant.name).trim();
  return options;
};

const normalizeVariant = (variant: any, baseUrl: string, centsLikely = false): ImportedProductVariant | null => {
  if (!variant || typeof variant !== 'object') return null;
  const offers = Array.isArray(variant.offers) ? variant.offers[0] : variant.offers || variant;
  const options = optionMap(variant);
  const name = stripHtml(variant.name || variant.title || Object.values(options).join(' / ') || variant.sku || 'Variant');
  const sku = String(variant.sku || offers?.sku || '').trim() || null;
  const price = normalizeMoney(offers?.price ?? variant.price ?? variant.cost ?? variant.wholesale_price, centsLikely);
  const availabilityRaw = String(offers?.availability || variant.available || variant.in_stock || '').toLowerCase();
  const available = typeof variant.available === 'boolean'
    ? variant.available
    : typeof variant.in_stock === 'boolean'
      ? variant.in_stock
      : availabilityRaw
        ? !availabilityRaw.includes('outofstock') && availabilityRaw !== 'false'
        : null;
  const inventoryValue = Number(variant.inventory_quantity ?? variant.inventory ?? variant.stock_quantity);
  const inventory = Number.isFinite(inventoryValue) ? Math.max(0, Math.floor(inventoryValue)) : null;
  const image = normalizeUrl(variant.image || variant.featured_image || offers?.image, baseUrl);
  if (!sku && price === null && !name) return null;
  return { name: name || 'Variant', sku, wholesalePrice: price, available, inventory, image, options };
};

const isPrivateIpAddress = (address: string) => {
  const normalized = String(address || '').trim().toLowerCase().split('%')[0];
  if (!normalized) return true;
  if (normalized === '::1' || normalized === '::' || normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe8') || normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb')) return true;
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(normalized);
  const ipv4 = mapped?.[1] || normalized;
  if (isIP(ipv4) === 4) {
    const [a, b] = ipv4.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 198 && (b === 18 || b === 19));
  }
  return isIP(normalized) !== 6;
};

export async function assertSafeProductUrl(rawUrl: string, dnsLookup: DnsLookup = async (hostname) => lookup(hostname, { all: true, verbatim: true })) {
  let parsed: URL;
  try {
    parsed = new URL(String(rawUrl || '').trim());
  } catch {
    throw new Error('Enter a complete public product URL, including https://.');
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') throw new Error('Only public http and https product URLs are supported.');
  if (parsed.username || parsed.password) throw new Error('URLs containing usernames or passwords are not allowed.');
  const hostname = parsed.hostname.toLowerCase().replace(/\.$/, '');
  if (!hostname || hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local') || hostname.endsWith('.internal')) {
    throw new Error('Private or local network URLs are not allowed.');
  }
  const literalFamily = isIP(hostname);
  const addresses = literalFamily ? [{ address: hostname, family: literalFamily }] : await dnsLookup(hostname);
  if (!addresses.length || addresses.some((entry) => isPrivateIpAddress(entry.address))) {
    throw new Error('This URL resolves to a private or unsupported network address.');
  }
  parsed.hash = '';
  return parsed;
}

export function parseProductHtml(html: string, sourceUrl: string): ImportedProductPreview {
  const source = new URL(sourceUrl);
  const scripts = jsonScripts(html);
  const parsedScripts = scripts.map((script) => ({ ...script, json: safeParseJson(script.contents) })).filter((script) => script.json !== null);
  const productCandidates: any[] = [];
  const variantCandidates: Array<{ value: any; centsLikely: boolean }> = [];

  parsedScripts.forEach((script) => {
    walkObjects(script.json, (value) => {
      if (typeIncludesProduct(value)) productCandidates.push(value);
      if (Array.isArray(value?.variants) && (value?.title || value?.name || value?.product)) {
        value.variants.slice(0, 500).forEach((variant: any) => variantCandidates.push({ value: variant, centsLikely: !script.type.includes('ld+json') }));
      }
    });
  });

  const primaryProduct = productCandidates.find((candidate) => candidate?.name && (candidate?.offers || candidate?.image)) || productCandidates[0] || {};
  const titleTag = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] || '';
  const title = stripHtml(primaryProduct.name || readMeta(html, 'og:title') || readMeta(html, 'twitter:title') || titleTag);
  const description = stripHtml(primaryProduct.description || readMeta(html, 'og:description') || readMeta(html, 'description') || readMeta(html, 'twitter:description'));
  const brand = stripHtml(typeof primaryProduct.brand === 'object' ? primaryProduct.brand?.name : primaryProduct.brand) || null;
  const sku = String(primaryProduct.sku || primaryProduct.mpn || '').trim() || null;
  const offers = Array.isArray(primaryProduct.offers) ? primaryProduct.offers : primaryProduct.offers ? [primaryProduct.offers] : [];
  const offerPrices = offers.map((offer: any) => normalizeMoney(offer?.price ?? offer?.lowPrice)).filter((value): value is number => value !== null);
  const currency = String(offers.find((offer: any) => offer?.priceCurrency)?.priceCurrency || readMeta(html, 'product:price:currency') || 'USD').trim().toUpperCase();

  const images = uniqueStrings([
    ...collectImageValues(primaryProduct.image, sourceUrl),
    normalizeUrl(readMeta(html, 'og:image'), sourceUrl),
    normalizeUrl(readMeta(html, 'twitter:image'), sourceUrl),
  ]);

  const structuredVariants = Array.isArray(primaryProduct.hasVariant)
    ? primaryProduct.hasVariant
    : primaryProduct.hasVariant
      ? [primaryProduct.hasVariant]
      : [];
  structuredVariants.forEach((variant: any) => variantCandidates.push({ value: variant, centsLikely: false }));
  if (offers.length > 1) offers.forEach((offer: any) => variantCandidates.push({ value: offer, centsLikely: false }));

  const variants: ImportedProductVariant[] = [];
  const variantKeys = new Set<string>();
  variantCandidates.forEach(({ value, centsLikely }) => {
    const variant = normalizeVariant(value, sourceUrl, centsLikely);
    if (!variant) return;
    const key = `${variant.sku || ''}::${variant.name.toLowerCase()}::${variant.wholesalePrice ?? ''}::${JSON.stringify(variant.options)}`;
    if (variantKeys.has(key)) return;
    variantKeys.add(key);
    variants.push(variant);
    if (variant.image) images.push(variant.image);
  });

  const wholesalePrice = offerPrices[0]
    ?? variants.map((variant) => variant.wholesalePrice).find((value): value is number => value !== null)
    ?? normalizeMoney(readMeta(html, 'product:price:amount'));
  const warnings: string[] = [];
  const supplementText = `${title} ${description}`.toLowerCase();
  if (/supplement|nutrition facts|dietary|vitamin|capsule|gummy|probiotic|protein powder/.test(supplementText)) {
    warnings.push('Review the full Supplement/Nutrition Facts panel, ingredients, allergen statement, serving size, claims, and required legal disclaimers before publishing.');
  }
  if (!variants.length) warnings.push('No structured variants were detected. Confirm sizes, flavors, colors, SKUs, stock, and variant images with the supplier before publishing.');
  if (!wholesalePrice) warnings.push('No dependable source price was detected. Enter and verify the wholesale cost manually.');
  if (!images.length) warnings.push('No dependable product images were detected. Add approved images before publishing.');

  return {
    sourceUrl,
    sourceHost: source.hostname,
    sourcePlatform: source.hostname.replace(/^www\./, ''),
    title,
    description,
    brand,
    sku,
    wholesalePrice: wholesalePrice ?? null,
    currency: currency || 'USD',
    images: uniqueStrings(images).slice(0, 60),
    variants: variants.slice(0, 500),
    warnings,
  };
}

export async function importProductUrl(rawUrl: string): Promise<ImportedProductPreview> {
  let currentUrl = await assertSafeProductUrl(rawUrl);
  for (let redirect = 0; redirect <= 4; redirect += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);
    try {
      const response = await fetch(currentUrl, {
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          Accept: 'text/html,application/xhtml+xml;q=0.9,application/json;q=0.7',
          'User-Agent': 'BeezioProductImporter/1.0 (+https://beezio.co)',
        },
      });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location) throw new Error('The supplier page returned an invalid redirect.');
        currentUrl = await assertSafeProductUrl(new URL(location, currentUrl).toString());
        continue;
      }
      if (!response.ok) throw new Error(`The supplier page returned HTTP ${response.status}.`);
      const contentType = String(response.headers.get('content-type') || '').toLowerCase();
      if (contentType && !contentType.includes('text/html') && !contentType.includes('application/xhtml') && !contentType.includes('application/json')) {
        throw new Error('The URL did not return a supported product page.');
      }
      const declaredLength = Number(response.headers.get('content-length') || 0);
      if (declaredLength > 3_000_000) throw new Error('The supplier page is too large to import safely.');
      const buffer = await response.arrayBuffer();
      if (buffer.byteLength > 3_000_000) throw new Error('The supplier page is too large to import safely.');
      const html = new TextDecoder('utf-8', { fatal: false }).decode(buffer);
      return parseProductHtml(html, currentUrl.toString());
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new Error('The supplier page redirected too many times.');
}
