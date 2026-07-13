import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { buildStoreInsuranceListings } from './_lib/storeInsurance';
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
      // Cache at the CDN to avoid repeated Supabase round-trips.
      // stale-while-revalidate smooths over cold starts.
      'Cache-Control': 'public, max-age=5, s-maxage=15, stale-while-revalidate=30',
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

function extractMissingColumnName(message: string): string | null {
  const msg = String(message || '');
  const pg = msg.match(/column\s+\"([^\"]+)\"\s+of\s+relation\s+\"[^\"]+\"\s+does\s+not\s+exist/i);
  if (pg?.[1]) return pg[1];
  const pgDot = msg.match(/column\s+([a-z0-9_]+\.[a-z0-9_]+)\s+does\s+not\s+exist/i);
  if (pgDot?.[1]) return pgDot[1].split('.').pop() || pgDot[1];
  const pgrst = msg.match(/Could not find the '([^']+)' column of '[^']+' in the schema cache/i);
  if (pgrst?.[1]) return pgrst[1];
  return null;
}

async function selectMaybeSingleResilient(
  supabaseAdmin: any,
  table: string,
  selectFields: string,
  matchColumn: string,
  matchValue: string
) {
  let activeSelect = selectFields;
  let lastError: any = null;

  for (let attempt = 0; attempt < 16; attempt += 1) {
    const { data, error } = await supabaseAdmin
      .from(table)
      .select(activeSelect)
      .eq(matchColumn, matchValue)
      .maybeSingle();

    if (!error) return { data, error: null };

    lastError = error;
    const missing = extractMissingColumnName(String((error as any)?.message || ''));
    const selectedFields = activeSelect.split(',').map((entry) => entry.trim());
    if (missing && selectedFields.includes(missing)) {
      activeSelect = selectedFields.filter((entry) => entry && entry !== missing).join(',');
      continue;
    }

    break;
  }

  return { data: null, error: lastError };
}

function isVisibleStorefrontProduct(product: any): boolean {
  const status = String(product?.status || '').trim().toLowerCase();
  if (status === 'draft' || status === 'archived') return false;
  const isActive = product?.is_active === true;
  const isPromotable = product?.is_promotable === true;
  if (status === 'active' || isActive || isPromotable) return true;
  const hasExplicitFlags =
    Object.prototype.hasOwnProperty.call(product || {}, 'is_active') ||
    Object.prototype.hasOwnProperty.call(product || {}, 'is_promotable') ||
    status.length > 0;
  return !hasExplicitFlags;
}

function looksLikeCjProduct(product: any): boolean {
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
}

function normalizeLegacyStorefrontProduct(product: any) {
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
    (affiliateCommissionType === 'flat' || commissionType === 'flat_rate' || commissionType === 'fixed') &&
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
}

const handler: Handler = async (event) => {
  try {
    const storeRaw = String(event.queryStringParameters?.store || event.queryStringParameters?.sellerId || event.queryStringParameters?.id || '').trim();
    if (!storeRaw) return json(400, { ok: false, error: 'Missing store' });

    const cacheKey = `public-store-get:v4:${storeRaw.toLowerCase()}`;
    const cached = getFromCache(cacheKey);
    if (cached) return json(200, cached);

    const supabaseUrl = requireEnv('SUPABASE_URL', ['VITE_SUPABASE_URL']);
    const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    let sellerId = '';
    let storeSlug = '';

    if (isUuid(storeRaw)) {
      const { data: profileMatch } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .or(`id.eq.${storeRaw},user_id.eq.${storeRaw}`)
        .maybeSingle();
      sellerId = String((profileMatch as any)?.id || storeRaw).trim();
    } else {
      storeSlug = storeRaw.toLowerCase();

      // Do slug lookups in parallel (fast path).
      const [{ data: fromSettings }, { data: fromProfiles }] = await Promise.all([
        supabaseAdmin.from('store_settings').select('seller_id').eq('subdomain', storeSlug).maybeSingle(),
        supabaseAdmin.from('profiles').select('id, role, primary_role').eq('subdomain', storeSlug).maybeSingle(),
      ]);

      const settingsId = String((fromSettings as any)?.seller_id || '').trim();
      if (settingsId) sellerId = settingsId;

      if (!sellerId) {
        const id = String((fromProfiles as any)?.id || '').trim();
        const role = String((fromProfiles as any)?.primary_role || (fromProfiles as any)?.role || '').trim().toLowerCase();
        if (id && (!role || role === 'seller')) sellerId = id;
      }
    }

    if (!sellerId) {
      return json(404, { ok: false, error: 'Store not found' });
    }

    // Pull only fields we actually need (smaller payload, faster queries).
    const profileSelect = 'id,user_id,full_name,bio,location,store_theme,store_banner,store_logo,subdomain,custom_domain,social_links,business_hours,shipping_policy,return_policy,template_id,product_page_template,layout_config,theme_settings,custom_css,color_scheme';
    const settingsSelect = 'seller_id,store_name,store_description,store_theme,store_banner,store_logo,subdomain,custom_domain,social_links,business_hours,shipping_policy,return_policy,template_id,product_page_template,layout_config,theme_settings,custom_css,color_scheme';

    const [{ data: profile, error: profileError }, { data: storeSettings, error: storeSettingsError }] = await Promise.all([
      selectMaybeSingleResilient(supabaseAdmin, 'profiles', profileSelect, 'id', sellerId),
      selectMaybeSingleResilient(supabaseAdmin, 'store_settings', settingsSelect, 'seller_id', sellerId),
    ]);

    if (profileError) {
      console.warn('[public-store-get] profile lookup error (non-fatal):', (profileError as any)?.message || String(profileError));
    }
    if (storeSettingsError) {
      console.warn('[public-store-get] store settings lookup error (non-fatal):', (storeSettingsError as any)?.message || String(storeSettingsError));
    }

    const mergedSeller: any = {
      id: sellerId,
      full_name: (profile as any)?.full_name ?? (storeSettings as any)?.store_name ?? 'Store',
      bio: (profile as any)?.bio ?? (storeSettings as any)?.store_description ?? '',
      store_theme: (storeSettings as any)?.store_theme ?? (profile as any)?.store_theme ?? 'modern',
      store_banner: (storeSettings as any)?.store_banner ?? (profile as any)?.store_banner ?? null,
      store_logo: (storeSettings as any)?.store_logo ?? (profile as any)?.store_logo ?? null,
      subdomain: ((storeSettings as any)?.subdomain ?? (profile as any)?.subdomain ?? storeSlug) || null,
      custom_domain: (storeSettings as any)?.custom_domain ?? (profile as any)?.custom_domain ?? null,
      location: (profile as any)?.location ?? null,
      social_links: (storeSettings as any)?.social_links ?? (profile as any)?.social_links ?? {},
      business_hours: (storeSettings as any)?.business_hours ?? (profile as any)?.business_hours ?? null,
      shipping_policy: (storeSettings as any)?.shipping_policy ?? (profile as any)?.shipping_policy ?? null,
      return_policy: (storeSettings as any)?.return_policy ?? (profile as any)?.return_policy ?? null,
      template_id: (storeSettings as any)?.template_id ?? (profile as any)?.template_id ?? null,
      product_page_template: (storeSettings as any)?.product_page_template ?? (profile as any)?.product_page_template ?? null,
      layout_config: (storeSettings as any)?.layout_config ?? (profile as any)?.layout_config ?? null,
      theme_settings: (storeSettings as any)?.theme_settings ?? (profile as any)?.theme_settings ?? null,
      custom_css: (storeSettings as any)?.custom_css ?? (profile as any)?.custom_css ?? null,
      color_scheme: (storeSettings as any)?.color_scheme ?? (profile as any)?.color_scheme ?? null,
    };

    const sellerAliases = Array.from(
      new Set(
        [sellerId, (profile as any)?.id, (profile as any)?.user_id, (storeSettings as any)?.seller_id]
          .map((value) => String(value || '').trim())
          .filter((value) => Boolean(value) && isUuid(value))
      )
    );

    // Fetch page links concurrently; doesn't affect product ordering.
    const pagesPromise = supabaseAdmin
      .from('custom_pages')
      .select('page_slug,page_title,is_active,display_order')
      .eq('owner_id', sellerId)
      .eq('owner_type', 'seller')
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    const { data: orderData, error: orderError } = await supabaseAdmin
      .from('seller_product_order')
      .select('product_id, display_order, is_featured')
      .in('seller_id', sellerAliases);

    if (orderError) {
      console.warn('[public-store-get] product order lookup error (non-fatal):', (orderError as any)?.message || String(orderError));
    }

    const orderIds = (orderData || []).map((row: any) => String(row?.product_id || '').trim()).filter(Boolean);

    // Conservative public fields only; tolerate schema drift by retrying when a column is missing.
    let selectFields =
      'id,title,description,price,currency,images,videos,category,category_id,shipping_cost,shipping_price,stock_quantity,total_inventory,in_stock,track_inventory,inventory_source,commission_rate,affiliate_commission_rate,commission_type,flat_commission_amount,affiliate_commission_type,affiliate_commission_value,seller_id,average_rating,review_count,created_at,is_active,is_promotable,status,lineage,source_platform,source,dropship_provider,cj_product_id,cj_pid,cj_spu,display_search_code,seller_ask,seller_amount,seller_ask_price,calculated_customer_price';

    let sellerOwnedProducts: any[] = [];
    let curatedProducts: any[] = [];

    for (let attempt = 0; attempt < 16; attempt++) {
      const ownedQuery = supabaseAdmin
        .from('products')
        .select(selectFields)
        .in('seller_id', sellerAliases)
        .order('created_at', { ascending: false })
        .limit(200);

      const curatedQuery = orderIds.length
        ? supabaseAdmin.from('products').select(selectFields).in('id', orderIds)
        : Promise.resolve({ data: [], error: null } as any);

      const [{ data: ownedData, error: ownedError }, { data: curatedData, error: curatedError }] = await Promise.all([
        ownedQuery,
        curatedQuery,
      ]);

      if (!ownedError && !curatedError) {
        sellerOwnedProducts = Array.isArray(ownedData) ? ownedData : [];
        curatedProducts = Array.isArray(curatedData) ? curatedData : [];
        break;
      }

      const missing =
        extractMissingColumnName(String((ownedError as any)?.message || '')) ||
        extractMissingColumnName(String((curatedError as any)?.message || ''));
      if (missing && selectFields.split(',').map((s) => s.trim()).includes(missing)) {
        selectFields = selectFields
          .split(',')
          .map((s) => s.trim())
          .filter((s) => s && s !== missing)
          .join(',');
        continue;
      }

      const details = (ownedError as any)?.message || (curatedError as any)?.message || 'Unknown error';
      return json(500, { ok: false, error: 'Failed to load products', details });
    }

    const productsById = new Map<string, any>();
    [...sellerOwnedProducts, ...curatedProducts]
      .filter((product: any) => isVisibleStorefrontProduct(product))
      .forEach((product: any) => {
        const productId = String(product?.id || '').trim();
        if (productId) productsById.set(productId, product);
      });

    const orderedProducts = Array.from(productsById.values()).map((product: any) => {
      const orderSetting = (orderData || []).find((o: any) => o.product_id === product.id);
      return {
        ...applyCanonicalProductPricing(normalizeLegacyStorefrontProduct(product)),
        display_order: orderSetting?.display_order ?? 999,
        is_featured: orderSetting?.is_featured ?? false,
      };
    });

    orderedProducts.sort((a: any, b: any) => {
      if (a.is_featured && !b.is_featured) return -1;
      if (!a.is_featured && b.is_featured) return 1;
      if (a.display_order !== b.display_order) return a.display_order - b.display_order;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    const sharedSlug = String(mergedSeller.subdomain || storeSlug || '').trim().toLowerCase();
    if (sharedSlug) {
      const { data: affiliateSettingsRow } = await supabaseAdmin
        .from('affiliate_store_settings')
        .select('affiliate_id')
        .eq('subdomain', sharedSlug)
        .maybeSingle();

      const sharedAffiliateId = String((affiliateSettingsRow as any)?.affiliate_id || '').trim();
      if (sharedAffiliateId) {
        const [{ data: affiliateRows }, { data: affiliateProducts }] = await Promise.all([
          supabaseAdmin
            .from('affiliate_products')
            .select('product_id, display_order, is_featured')
            .eq('affiliate_id', sharedAffiliateId),
          supabaseAdmin
            .from('affiliate_products')
            .select('product_id')
            .eq('affiliate_id', sharedAffiliateId),
        ]);

        const affiliateProductIds = Array.from(
          new Set(
            (affiliateProducts || [])
              .map((row: any) => String(row?.product_id || '').trim())
              .filter(Boolean)
          )
        );

        if (affiliateProductIds.length) {
          const { data: promotedProducts } = await supabaseAdmin
            .from('products')
            .select(selectFields)
            .in('id', affiliateProductIds.slice(0, 500));

          const promotedOrderById = new Map<string, any>();
          (affiliateRows || []).forEach((row: any) => {
            const productId = String(row?.product_id || '').trim();
            if (productId) promotedOrderById.set(productId, row);
          });

          const combinedById = new Map<string, any>();
          orderedProducts.forEach((product: any) => {
            const productId = String(product?.id || '').trim();
            if (productId) combinedById.set(productId, product);
          });

          (promotedProducts || [])
            .filter((product: any) => isVisibleStorefrontProduct(product))
            .forEach((product: any) => {
              const productId = String(product?.id || '').trim();
              if (!productId || combinedById.has(productId)) return;
              const order = promotedOrderById.get(productId);
              combinedById.set(productId, {
                ...applyCanonicalProductPricing(normalizeLegacyStorefrontProduct(product)),
                affiliate_id: sharedAffiliateId,
                display_order: Number.isFinite(Number(order?.display_order)) ? Number(order.display_order) : 999,
                is_featured: Boolean(order?.is_featured),
              });
            });

          orderedProducts.splice(0, orderedProducts.length, ...Array.from(combinedById.values()));
          orderedProducts.sort((a: any, b: any) => {
            if (a.is_featured && !b.is_featured) return -1;
            if (!a.is_featured && b.is_featured) return 1;
            if (a.display_order !== b.display_order) return a.display_order - b.display_order;
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
          });
        }
      }
    }

    const [
      { data: pagesData, error: pagesError },
      { data: collectionsData, error: collectionsError },
      { data: placementsData, error: placementsError },
      insuranceListings,
    ] = await Promise.all([
      pagesPromise,
      supabaseAdmin
        .from('store_collections')
        .select('id,name,slug,description,image_url,display_order,is_visible')
        .in('owner_id', sellerAliases)
        .eq('is_visible', true)
        .order('display_order', { ascending: true }),
      supabaseAdmin
        .from('store_product_placements')
        .select('product_id,placement_type,collection_id,custom_page_id,section_key,display_order,is_visible')
        .in('owner_id', sellerAliases)
        .eq('is_visible', true)
        .order('display_order', { ascending: true }),
      buildStoreInsuranceListings(supabaseAdmin, mergedSeller.location, 6),
    ]);

    if (pagesError) {
      console.warn('[public-store-get] custom pages lookup error (non-fatal):', (pagesError as any)?.message || String(pagesError));
    }
    if (collectionsError) {
      console.warn('[public-store-get] collections lookup error (non-fatal):', (collectionsError as any)?.message || String(collectionsError));
    }
    if (placementsError) {
      console.warn('[public-store-get] placements lookup error (non-fatal):', (placementsError as any)?.message || String(placementsError));
    }

    const responseBody = {
      ok: true,
      seller_id: sellerId,
      store_slug: mergedSeller.subdomain || null,
      seller: mergedSeller,
      products: orderedProducts,
      insurance_listings: insuranceListings,
      custom_pages: pagesData || [],
      collections: collectionsData || [],
      product_placements: placementsData || [],
    };

    // Cache hot stores briefly in-memory to avoid repeat Supabase calls.
    setCache(cacheKey, responseBody, 5_000);

    return json(200, responseBody);
  } catch (e) {
    return json(500, { ok: false, error: 'Unexpected error', details: e instanceof Error ? e.message : String(e) });
  }
};

export { handler };
