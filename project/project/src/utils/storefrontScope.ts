export type StorefrontScope =
  | { kind: 'seller'; storeId: string; raw: string }
  | { kind: 'affiliate'; storeId: string; raw: string };

export interface StorefrontBranding {
  kind: 'seller' | 'affiliate' | 'generic';
  storeId?: string;
  name: string;
  tagline?: string;
  logoUrl?: string | null;
  backgroundImageUrl?: string | null;
  homePath: string;
}

const SCOPE_KEY = 'beezio-store-scope';
const POST_AUTH_PATH_KEY = 'beezio-post-auth-path';

export function readStoredStorefrontScope(): StorefrontScope | null {
  if (typeof window === 'undefined') return null;

  const raw = String(window.localStorage.getItem(SCOPE_KEY) || '').trim();
  if (!raw) return null;

  const parts = raw.split(':').map((part) => String(part || '').trim());
  if (parts.length < 3 || parts[0] !== 'store') return null;

  const kind = parts[1];
  const storeId = parts.slice(2).join(':').trim();
  if (!storeId) return null;

  if (kind === 'seller') return { kind: 'seller', storeId, raw };
  if (kind === 'affiliate') return { kind: 'affiliate', storeId, raw };
  return null;
}

export function hasStoredStorefrontScope(): boolean {
  return Boolean(readStoredStorefrontScope());
}

export function setPostAuthPath(path: string) {
  if (typeof window === 'undefined') return;
  const normalized = String(path || '').trim() || '/account';
  window.sessionStorage.setItem(POST_AUTH_PATH_KEY, normalized);
}

export function readPostAuthPath(): string | null {
  if (typeof window === 'undefined') return null;
  const value = String(window.sessionStorage.getItem(POST_AUTH_PATH_KEY) || '').trim();
  return value || null;
}

export function consumePostAuthPath(): string | null {
  if (typeof window === 'undefined') return null;
  const value = String(window.sessionStorage.getItem(POST_AUTH_PATH_KEY) || '').trim();
  if (!value) return null;
  window.sessionStorage.removeItem(POST_AUTH_PATH_KEY);
  return value;
}

export async function loadStorefrontBranding(scope: StorefrontScope | null): Promise<StorefrontBranding> {
  if (!scope) {
    return {
      kind: 'generic',
      name: 'Your Account',
      tagline: 'Orders, receipts, and support in one place.',
      logoUrl: null,
      backgroundImageUrl: null,
      homePath: '/',
    };
  }

  try {
    if (scope.kind === 'seller') {
      const response = await fetch(`/api/public/store/get?store=${encodeURIComponent(scope.storeId)}`);
      const payload: any = await response.json().catch(() => ({}));
      const seller = payload?.seller || {};
      const slug = String(payload?.store_slug || seller?.subdomain || scope.storeId).trim();
      return {
        kind: 'seller',
        storeId: scope.storeId,
        name: String(seller?.full_name || 'Storefront').trim() || 'Storefront',
        tagline: String(seller?.bio || '').trim() || 'Orders, receipts, and support in one place.',
        logoUrl: seller?.store_logo || null,
        backgroundImageUrl: seller?.layout_config?.background_image_url || null,
        homePath: `/store/${slug}`,
      };
    }

    const response = await fetch(`/api/public/affiliate/store/get?affiliate=${encodeURIComponent(scope.storeId)}`);
    const payload: any = await response.json().catch(() => ({}));
    const affiliate = payload?.affiliate || {};
    const settings = payload?.store_settings || {};
    const slug = String(settings?.subdomain || affiliate?.subdomain || payload?.canonical_affiliate_id || scope.storeId).trim();
      return {
        kind: 'affiliate',
        storeId: scope.storeId,
        name: String(settings?.store_name || affiliate?.full_name || 'Storefront').trim() || 'Storefront',
        tagline: String(settings?.store_description || affiliate?.bio || '').trim() || 'Orders, receipts, and support in one place.',
        logoUrl: settings?.store_logo || affiliate?.avatar_url || null,
        backgroundImageUrl: settings?.layout_config?.background_image_url || null,
        homePath: `/store/${slug}`,
      };
  } catch {
    return {
      kind: scope.kind,
      storeId: scope.storeId,
      name: 'Storefront',
      tagline: 'Orders, receipts, and support in one place.',
      logoUrl: null,
      backgroundImageUrl: null,
      homePath: `/store/${scope.storeId}`,
    };
  }
}
