import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

type CacheEntry = { expiresAt: number; value: any };
const memCache = new Map<string, CacheEntry>();

function getFromCache<T = any>(key: string): T | null {
  const hit = memCache.get(key);
  if (!hit) return null;
  if (Date.now() >= hit.expiresAt) {
    memCache.delete(key);
    return null;
  }
  return hit.value as T;
}

function setCache(key: string, value: any, ttlMs: number) {
  memCache.set(key, { expiresAt: Date.now() + ttlMs, value });
}

function json(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      // Keep this endpoint safe to call from browsers.
      'Cache-Control': 'public, max-age=60, s-maxage=600, stale-while-revalidate=86400',
    },
    body: JSON.stringify(body),
  };
}

function requireEnv(name: string, fallbacks: string[] = []): string {
  const keys = [name, ...fallbacks];
  for (const key of keys) {
    const value = String(process.env[key] || '').trim();
    if (value) return value;
  }
  throw new Error(`Missing ${name}${fallbacks.length ? ` (or ${fallbacks.join(', ')})` : ''}`);
}

const handler: Handler = async (event) => {
  try {
    const slug = String(event.queryStringParameters?.slug || '').trim().toLowerCase();
    if (!slug) return json(400, { ok: false, error: 'Missing slug' });

    const cacheKey = `public-store-resolve:v2:${slug}`;
    const cached = getFromCache(cacheKey);
    if (cached) return json(200, cached);

    const supabaseUrl = requireEnv('SUPABASE_URL', ['VITE_SUPABASE_URL']);
    const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const [brandStorefrontRes, sellerSettingsRes, profileRowsRes, affiliateSettingsRes] = await Promise.all([
      supabaseAdmin.from('storefronts').select('id, owner_id, type, slug, updated_at').eq('slug', slug).eq('is_active', true).limit(10),
      supabaseAdmin.from('store_settings').select('seller_id, subdomain, updated_at').eq('subdomain', slug).limit(10),
      supabaseAdmin.from('profiles').select('id, role, primary_role, subdomain, updated_at').eq('subdomain', slug).limit(10),
      supabaseAdmin.from('affiliate_store_settings').select('affiliate_id, subdomain, updated_at').eq('subdomain', slug).limit(10),
    ]);

    const brandStorefrontRows = Array.isArray(brandStorefrontRes.data) ? brandStorefrontRes.data : [];
    const sellerSettingsRows = Array.isArray(sellerSettingsRes.data) ? sellerSettingsRes.data : [];
    const affiliateSettingsRows = Array.isArray(affiliateSettingsRes.data) ? affiliateSettingsRes.data : [];
    const profileRows = Array.isArray(profileRowsRes.data) ? profileRowsRes.data : [];

    const pickLatest = <T extends { updated_at?: string | null }>(rows: T[]) =>
      [...rows].sort((left, right) => {
        const leftTs = new Date(String(left?.updated_at || 0)).getTime();
        const rightTs = new Date(String(right?.updated_at || 0)).getTime();
        return rightTs - leftTs;
      })[0] || null;

    const latestBrandStorefront = pickLatest(brandStorefrontRows as any[]);
    if (latestBrandStorefront?.id && latestBrandStorefront?.owner_id) {
      const body = {
        ok: true,
        store_type: 'seller',
        store_id: String(latestBrandStorefront.owner_id).trim(),
        storefront_id: String(latestBrandStorefront.id).trim(),
      };
      setCache(cacheKey, body, 5 * 60_000);
      return json(200, body);
    }

    const latestSellerSettings = pickLatest(sellerSettingsRows as any[]);
    const latestAffiliateSettings = pickLatest(affiliateSettingsRows as any[]);
    const latestSellerProfile = pickLatest(
      profileRows.filter((row: any) => String(row?.primary_role || row?.role || '').trim().toLowerCase() === 'seller') as any[]
    );
    const latestAffiliateProfile = pickLatest(
      profileRows.filter((row: any) => String(row?.primary_role || row?.role || '').trim().toLowerCase() === 'affiliate') as any[]
    );

    const sellerId = String((latestSellerSettings as any)?.seller_id || (latestSellerProfile as any)?.id || '').trim();
    const affiliateId = String((latestAffiliateSettings as any)?.affiliate_id || (latestAffiliateProfile as any)?.id || '').trim();

    // A single Beezio account can have both seller and affiliate store settings with
    // the same slug. The seller storefront payload now merges affiliate-selected
    // products too, so shared slugs should prefer the seller storefront shell.
    if (sellerId && affiliateId) {
      const body = { ok: true, store_type: 'seller', store_id: sellerId };
      setCache(cacheKey, body, 60_000);
      return json(200, body);
    }

    if (sellerId) {
      const body = { ok: true, store_type: 'seller', store_id: sellerId };
      setCache(cacheKey, body, 5 * 60_000);
      return json(200, body);
    }

    if (affiliateId) {
      const body = { ok: true, store_type: 'affiliate', store_id: affiliateId };
      setCache(cacheKey, body, 5 * 60_000);
      return json(200, body);
    }

    // Profile fallback for older accounts that stored the slug on profiles.
    if (latestSellerProfile?.id) {
      const body = { ok: true, store_type: 'seller', store_id: String(latestSellerProfile.id).trim() };
      setCache(cacheKey, body, 5 * 60_000);
      return json(200, body);
    }
    if (latestAffiliateProfile?.id) {
      const body = { ok: true, store_type: 'affiliate', store_id: String(latestAffiliateProfile.id).trim() };
      setCache(cacheKey, body, 5 * 60_000);
      return json(200, body);
    }

    const miss = { ok: false, error: 'Store not found' };
    setCache(cacheKey, miss, 5_000);
    return json(404, miss);
  } catch (e) {
    return json(500, { ok: false, error: 'Unexpected error', details: e instanceof Error ? e.message : String(e) });
  }
};

export { handler };
