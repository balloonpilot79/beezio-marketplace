import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { applyCanonicalProductPricing } from '../../shared/productPricing';

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
      'Cache-Control': 'public, max-age=30, s-maxage=300, stale-while-revalidate=86400',
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

const isUuid = (value: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const extractMissingColumnName = (message: string): string | null => {
  const msg = String(message || '');
  const pgRelation = msg.match(/column\s+"([^"]+)"\s+of\s+relation\s+"[^"]+"\s+does\s+not\s+exist/i);
  if (pgRelation?.[1]) return pgRelation[1];
  const pg = msg.match(/column\s+([a-z0-9_]+\.[a-z0-9_]+)\s+does\s+not\s+exist/i);
  if (pg?.[1]) return pg[1].split('.').pop() || pg[1];
  const quoted = msg.match(/column\s+"([^"]+)"\s+does\s+not\s+exist/i);
  if (quoted?.[1]) return quoted[1];
  const pgrst = msg.match(/Could not find the '([^']+)' column of '[^']+' in the schema cache/i);
  if (pgrst?.[1]) return pgrst[1];
  return null;
};

const looksLikeCjProduct = (product: any): boolean => {
  const directMarkers = [
    product?.source_platform,
    product?.source,
    product?.dropship_provider,
    product?.inventory_source,
    product?.lineage,
  ]
    .map((value) => String(value || '').trim().toLowerCase())
    .filter(Boolean);
  if (directMarkers.some((value) => value === 'cj')) return true;
  if (String(product?.cj_product_id || '').trim() || String(product?.cj_pid || '').trim() || String(product?.cj_spu || '').trim()) return true;
  const imageList = Array.isArray(product?.images) ? product.images : [];
  return imageList.some((entry: any) => String(entry || '').toLowerCase().includes('cjdropshipping.com'));
};

const normalizeLegacyProduct = (product: any) => {
  const normalized = { ...(product || {}) };
  const commissionType = String(normalized?.commission_type || '').trim().toLowerCase();
  const affiliateCommissionType = String(normalized?.affiliate_commission_type || '').trim().toLowerCase();
  const hasExplicitFlatType =
    affiliateCommissionType === 'flat' || commissionType === 'flat_rate' || commissionType === 'fixed';
  const hasStoredFlatAmount =
    Number(normalized?.flat_commission_amount || 0) > 0 ||
    (affiliateCommissionType === 'flat' && Number(normalized?.affiliate_commission_value || 0) > 0);
  if (
    hasExplicitFlatType &&
    Number(normalized?.affiliate_commission_value || 0) <= 0 &&
    Number(normalized?.flat_commission_amount || 0) <= 0 &&
    Number(normalized?.commission_rate || 0) > 0
  ) {
    normalized.affiliate_commission_type = 'flat';
    normalized.affiliate_commission_value = Number(normalized.commission_rate);
    normalized.flat_commission_amount = Number(normalized.commission_rate);
  }
  if (looksLikeCjProduct(normalized)) {
    normalized.source_platform = 'cj';
    normalized.source = normalized.source || 'cj';
    normalized.inventory_source = normalized.inventory_source || 'cj';
    normalized.lineage = normalized.lineage || 'CJ';

    if (!hasExplicitFlatType && !hasStoredFlatAmount && Number(normalized?.commission_rate || 0) > 0) {
      normalized.commission_type = 'flat_rate';
      normalized.affiliate_commission_type = 'flat';
      normalized.affiliate_commission_value = Number(normalized.commission_rate);
      normalized.flat_commission_amount = Number(normalized.commission_rate);
    }
  }

  const normalizedPercent = Number(normalized?.commission_rate || 0);
  const normalizedAffiliateRate = Number(normalized?.affiliate_commission_rate || 0);
  const normalizedAffiliateValue = Number(normalized?.affiliate_commission_value || 0);
  const normalizedFlatAmount = Number(normalized?.flat_commission_amount || 0);
  const hasAnyCommission = normalizedPercent > 0 || normalizedAffiliateRate > 0 || normalizedAffiliateValue > 0 || normalizedFlatAmount > 0;

  if (!hasAnyCommission) {
    normalized.commission_type = 'percentage';
    normalized.affiliate_commission_type = 'percent';
    normalized.commission_rate = 30;
    normalized.affiliate_commission_rate = 30;
    normalized.affiliate_commission_value = 30;
  } else if (
    (String(normalized?.affiliate_commission_type || '').trim().toLowerCase() === 'flat' ||
      String(normalized?.commission_type || '').trim().toLowerCase() === 'flat_rate' ||
      String(normalized?.commission_type || '').trim().toLowerCase() === 'fixed') &&
    normalizedPercent <= 0
  ) {
    const displayFlatAmount = normalizedFlatAmount > 0
      ? normalizedFlatAmount
      : normalizedAffiliateValue > 0
        ? normalizedAffiliateValue
        : normalizedAffiliateRate > 0
          ? normalizedAffiliateRate
          : 0;
    if (displayFlatAmount > 0) {
      normalized.commission_rate = displayFlatAmount;
      if (!(normalized.affiliate_commission_rate > 0)) {
        normalized.affiliate_commission_rate = displayFlatAmount;
      }
    }
  }
  return normalized;
};

const handler: Handler = async (event) => {
  try {
    const productIdRaw = String(event.queryStringParameters?.id || event.queryStringParameters?.productId || '').trim();
    if (!productIdRaw) return json(400, { ok: false, error: 'Missing id' });
    if (!isUuid(productIdRaw)) return json(400, { ok: false, error: 'Invalid id' });

    const cacheKey = `public-product-get:v3:${productIdRaw}`;
    const cached = getFromCache(cacheKey);
    if (cached) return json(200, cached);

    const supabaseUrl = requireEnv('SUPABASE_URL', ['VITE_SUPABASE_URL']);
    const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Conservative public fields only.
    let selectFields = [
      'id',
      'title',
      'description',
      'price',
      'currency',
      'images',
      'videos',
      'shipping_options',
      'requires_shipping',
      'is_digital',
      'track_inventory',
      'shipping_cost',
      'shipping_price',
      'stock_quantity',
      'total_inventory',
      'in_stock',
      'commission_rate',
      'affiliate_commission_rate',
      'commission_type',
      'flat_commission_amount',
      'affiliate_commission_type',
      'affiliate_commission_value',
      'seller_id',
      'average_rating',
      'review_count',
      'tags',
      'created_at',
      'is_active',
      'is_promotable',
      'status',
      'source',
      'source_platform',
      'dropship_provider',
      'inventory_source',
      'cj_product_id',
      'cj_pid',
      'cj_product_code',
      'cj_product_sku',
      'cj_spu',
      'display_search_code',
      'import_status',
      'lineage',
      'seller_ask',
      'seller_amount',
      'seller_ask_price',
      'calculated_customer_price',
      'digital_download_instructions',
      'digital_return_policy_notice',
    ];

    let product: any = null;
    let error: any = null;
    for (let attempt = 0; attempt < 16; attempt += 1) {
      const res = await supabaseAdmin
        .from('products')
        .select(selectFields.join(','))
        .eq('id', productIdRaw)
        .maybeSingle();
      product = res.data;
      error = res.error;
      if (!error) break;
      const missing = extractMissingColumnName(String((error as any)?.message || ''));
      if (missing && selectFields.includes(missing)) {
        selectFields = selectFields.filter((field) => field !== missing);
        continue;
      }
      break;
    }

    if (error) {
      return json(500, { ok: false, error: 'Failed to load product', details: (error as any)?.message || String(error) });
    }

    if (!product) {
      return json(404, { ok: false, error: 'Product not found' });
    }

    const sellerId = String((product as any)?.seller_id || '').trim();

    let sellerName: string | undefined = undefined;
    let storeSettings: any = null;

    if (sellerId) {
      const [{ data: seller }, { data: settings }] = await Promise.all([
        supabaseAdmin.from('profiles').select('full_name').eq('id', sellerId).maybeSingle(),
        supabaseAdmin
          .from('store_settings')
          .select('store_name, return_policy, shipping_policy, subdomain, custom_domain')
          .eq('seller_id', sellerId)
          .maybeSingle(),
      ]);
      const name = String((seller as any)?.full_name || '').trim();
      if (name) sellerName = name;
      storeSettings = settings || null;
    }

    const normalizedProduct = applyCanonicalProductPricing(normalizeLegacyProduct(product));

    const responseBody = {
      ok: true,
      product: {
        ...(normalizedProduct as any),
        profiles: sellerName ? { full_name: sellerName } : undefined,
      },
      store_settings: storeSettings,
    };

    setCache(cacheKey, responseBody, 60_000);
    return json(200, responseBody);
  } catch (e) {
    return json(500, { ok: false, error: 'Unexpected error', details: e instanceof Error ? e.message : String(e) });
  }
};

export { handler };
