const STORE_ROUTE_PREFIXES = ['store', 'partner', 'seller'];

function extractRouteSlug(rawValue: string): string {
  const trimmed = rawValue.trim();
  if (!trimmed) return '';

  let value = trimmed.replace(/\\/g, '/');

  if (/^www\./i.test(value)) {
    value = `https://${value}`;
  }

  try {
    const parsed = new URL(value);
    value = parsed.pathname || '';
  } catch {
    // Fall back to path-style parsing for non-URL input.
  }

  value = value
    .split('?')[0]
    .split('#')[0]
    .replace(/^https?:\/\/[^/]+/i, '')
    .replace(/^\/+|\/+$/g, '');

  if (!value) return '';

  const segments = value
    .split('/')
    .map((segment) => decodeURIComponent(segment).trim())
    .filter(Boolean);

  if (segments.length === 0) return '';

  const routeIndex = segments.findIndex((segment) =>
    STORE_ROUTE_PREFIXES.includes(segment.toLowerCase())
  );

  if (routeIndex >= 0 && segments[routeIndex + 1]) {
    return segments[routeIndex + 1];
  }

  if (segments.length > 1) {
    return segments[segments.length - 1];
  }

  return segments[0];
}

export function normalizeStoreSlug(input?: string | null): string {
  const slug = extractRouteSlug(String(input || '')).trim().toLowerCase();
  if (!slug) return '';

  // Legacy / marketing slugs
  if (slug === 'beezio-shop') return 'beezio-store';

  return slug;
}

export function getStoreSlugLookupCandidates(input?: string | null): string[] {
  const slug = normalizeStoreSlug(input);
  if (!slug) return [];

  return Array.from(new Set([
    slug,
    `/store/${slug}`,
    `store/${slug}`,
    `https://beezio.co/store/${slug}`,
    `https://www.beezio.co/store/${slug}`,
    `http://beezio.co/store/${slug}`,
    `http://www.beezio.co/store/${slug}`,
    `/partner/${slug}`,
    `partner/${slug}`,
    `https://beezio.co/partner/${slug}`,
    `https://www.beezio.co/partner/${slug}`,
    `http://beezio.co/partner/${slug}`,
    `http://www.beezio.co/partner/${slug}`,
    `/seller/${slug}`,
    `seller/${slug}`,
    `https://beezio.co/seller/${slug}`,
    `https://www.beezio.co/seller/${slug}`,
    `http://beezio.co/seller/${slug}`,
    `http://www.beezio.co/seller/${slug}`,
  ]));
}
