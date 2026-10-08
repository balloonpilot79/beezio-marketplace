import { getCombinedShippingPolicy } from '../../shared/combinedShipping';
import { getProductShipping } from '../../shared/productShipping';
import { isPublicStoreProduct, isPublicAffiliateProduct } from '../../shared/publicProductVisibility';
import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { buildStoreInsuranceListings } from './_lib/storeInsurance';
import { applyStorefrontProductPricing } from '../../shared/productPricing';
import { resolveHouseBrandIdentity } from '../../shared/houseBrandIdentity';
import { isSupplyLineProduct, sanitizeSupplyLineProduct } from '../../shared/publicSupplyLineProduct';
import { storefrontProductAttribution } from '../../shared/storefrontProductAttribution';

function json(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      // stale-while-revalidate smooths over cold starts.
      'Cache-Control': 'no-store',
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

const isVisibleStorefrontProduct = (product: any): boolean => isPublicStoreProduct(product);

function looksLikeCjProduct(product: any): boolean {
  return isSupplyLineProduct(product);
}

function normalizeLegacyStorefrontProduct(product: any) {
  const normalized = { ...(product || {}) };
  const fixedAffiliatePayout = Number(normalized?.affiliate_payout_amount || 0);
  if (fixedAffiliatePayout >= 0 && normalized?.affiliate_payout_amount != null) {
    normalized.commission_type = 'flat_rate';
    normalized.affiliate_commission_type = 'flat';
    normalized.flat_commission_amount = fixedAffiliatePayout;
    normalized.affiliate_commission_value = fixedAffiliatePayout;
    normalized.commission_rate = 0;
  }
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
    normalized.commission_type = 'flat_rate';
    normalized.affiliate_commission_type = 'flat';
    normalized.commission_rate = 0;
    normalized.affiliate_commission_rate = 0;
    normalized.affiliate_commission_value = 0;
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


    const supabaseUrl = requireEnv('SUPABASE_URL', ['VITE_SUPABASE_URL']);
    const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    let sellerId = '';
    let storeSlug = '';
    let brandStorefront: any = null;

    if (isUuid(storeRaw)) {
      const { data: storefrontMatch } = await supabaseAdmin
        .from('storefronts')
        .select('id,owner_id,type,name,slug,custom_domain,logo_url,description,banner_url,store_theme,product_page_template,layout_config,theme_settings,color_scheme,social_links,business_hours,shipping_policy,return_policy,custom_css,is_active')
        .eq('id', storeRaw)
        .eq('is_active', true)
        .maybeSingle();
      if ((storefrontMatch as any)?.owner_id) {
        brandStorefront = storefrontMatch;
        sellerId = String((storefrontMatch as any).owner_id).trim();
        storeSlug = String((storefrontMatch as any).slug || '').trim().toLowerCase();
      }

      if (!sellerId) {
      const { data: profileMatch } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .or(`id.eq.${storeRaw},user_id.eq.${storeRaw}`)
        .maybeSingle();
      sellerId = String((profileMatch as any)?.id || storeRaw).trim();
      }
    } else {
      storeSlug = storeRaw.toLowerCase();

      // Do slug lookups in parallel (fast path).
      const [{ data: fromStorefront }, { data: fromSettings }, { data: fromAffiliateSettings }, { data: fromProfiles }] = await Promise.all([
        supabaseAdmin
          .from('storefronts')
          .select('id,owner_id,type,name,slug,custom_domain,logo_url,description,banner_url,store_theme,product_page_template,layout_config,theme_settings,color_scheme,social_links,business_hours,shipping_policy,return_policy,custom_css,is_active')
          .eq('slug', storeSlug)
          .eq('is_active', true)
          .maybeSingle(),
        supabaseAdmin.from('store_settings').select('seller_id').eq('subdomain', storeSlug).maybeSingle(),
        supabaseAdmin.from('affiliate_store_settings').select('affiliate_id').eq('subdomain', storeSlug).maybeSingle(),
        supabaseAdmin.from('profiles').select('id, role, primary_role').eq('subdomain', storeSlug).maybeSingle(),
      ]);

      if ((fromStorefront as any)?.owner_id) {
        brandStorefront = fromStorefront;
        sellerId = String((fromStorefront as any).owner_id).trim();
      }

      const settingsId = String((fromSettings as any)?.seller_id || '').trim();
      if (!sellerId && settingsId) sellerId = settingsId;
      if (!sellerId && (fromAffiliateSettings as any)?.affiliate_id) {
        sellerId = String((fromAffiliateSettings as any).affiliate_id).trim();
      }

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

    const [{ data: profile, error: profileError }, { data: storeSettings, error: storeSettingsError }, { data: affiliateSettings }] = await Promise.all([
      selectMaybeSingleResilient(supabaseAdmin, 'profiles', profileSelect, 'id', sellerId),
      selectMaybeSingleResilient(supabaseAdmin, 'store_settings', settingsSelect, 'seller_id', sellerId),
      selectMaybeSingleResilient(supabaseAdmin, 'affiliate_store_settings', settingsSelect.replace('seller_id,', 'affiliate_id,'), 'affiliate_id', sellerId),
    ]);

    if (profileError) {
      console.warn('[public-store-get] profile lookup error (non-fatal):', (profileError as any)?.message || String(profileError));
    }
    if (storeSettingsError) {
      console.warn('[public-store-get] store settings lookup error (non-fatal):', (storeSettingsError as any)?.message || String(storeSettingsError));
    }

    const memberSettings = storeSettings || affiliateSettings;
    const hasDedicatedStorefront = Boolean(brandStorefront?.id);
    const houseBrandIdentity = resolveHouseBrandIdentity(
      brandStorefront?.slug || storeSlug,
      brandStorefront?.theme_settings?.brand_personality
    );
    const mergedSeller: any = {
      id: sellerId,
      storefront_id: brandStorefront?.id || null,
      full_name: houseBrandIdentity?.name ?? brandStorefront?.name ?? (profile as any)?.full_name ?? (memberSettings as any)?.store_name ?? 'Store',
      bio: houseBrandIdentity?.about ?? (hasDedicatedStorefront ? brandStorefront?.description ?? '' : (profile as any)?.bio ?? (memberSettings as any)?.store_description ?? ''),
      store_theme: hasDedicatedStorefront ? brandStorefront?.store_theme ?? 'modern' : (memberSettings as any)?.store_theme ?? (profile as any)?.store_theme ?? 'modern',
      store_banner: hasDedicatedStorefront ? brandStorefront?.banner_url ?? null : (memberSettings as any)?.store_banner ?? (profile as any)?.store_banner ?? null,
      store_logo: hasDedicatedStorefront ? brandStorefront?.logo_url ?? houseBrandIdentity?.logoUrl ?? null : (memberSettings as any)?.store_logo ?? (profile as any)?.store_logo ?? null,
      subdomain: (brandStorefront?.slug ?? (memberSettings as any)?.subdomain ?? (profile as any)?.subdomain ?? storeSlug) || null,
      custom_domain: hasDedicatedStorefront ? brandStorefront?.custom_domain ?? null : (memberSettings as any)?.custom_domain ?? (profile as any)?.custom_domain ?? null,
      location: hasDedicatedStorefront ? null : (profile as any)?.location ?? null,
      social_links: hasDedicatedStorefront ? brandStorefront?.social_links ?? {} : (memberSettings as any)?.social_links ?? (profile as any)?.social_links ?? {},
      business_hours: hasDedicatedStorefront ? brandStorefront?.business_hours ?? null : (memberSettings as any)?.business_hours ?? (profile as any)?.business_hours ?? null,
      shipping_policy: hasDedicatedStorefront ? brandStorefront?.shipping_policy ?? null : (memberSettings as any)?.shipping_policy ?? (profile as any)?.shipping_policy ?? null,
      return_policy: hasDedicatedStorefront ? brandStorefront?.return_policy ?? null : (memberSettings as any)?.return_policy ?? (profile as any)?.return_policy ?? null,
      template_id: hasDedicatedStorefront ? null : (memberSettings as any)?.template_id ?? (profile as any)?.template_id ?? null,
      product_page_template: hasDedicatedStorefront ? brandStorefront?.product_page_template ?? null : (memberSettings as any)?.product_page_template ?? (profile as any)?.product_page_template ?? null,
      layout_config: hasDedicatedStorefront ? brandStorefront?.layout_config ?? null : (memberSettings as any)?.layout_config ?? (profile as any)?.layout_config ?? null,
      theme_settings: hasDedicatedStorefront ? brandStorefront?.theme_settings ?? null : (memberSettings as any)?.theme_settings ?? (profile as any)?.theme_settings ?? null,
      custom_css: hasDedicatedStorefront ? brandStorefront?.custom_css ?? null : (memberSettings as any)?.custom_css ?? (profile as any)?.custom_css ?? null,
      color_scheme: hasDedicatedStorefront ? brandStorefront?.color_scheme ?? null : (memberSettings as any)?.color_scheme ?? (profile as any)?.color_scheme ?? null,
    };

    const sellerAliases = Array.from(
      new Set(
        [sellerId, (profile as any)?.id, (profile as any)?.user_id, (storeSettings as any)?.seller_id]
          .map((value) => String(value || '').trim())
          .filter((value) => Boolean(value) && isUuid(value))
      )
    );

    // Fetch page links concurrently; doesn't affect product ordering.
    const pagesPromise = brandStorefront?.id ? Promise.resolve({ data: [], error: null } as any) : supabaseAdmin
      .from('custom_pages')
      .select('page_slug,page_title,is_active,display_order')
      .eq('owner_id', sellerId)
      .eq('owner_type', 'seller')
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    const orderLookup = brandStorefront?.id
      ? await supabaseAdmin
          .from('storefront_products')
          .select('product_id, position, placement_source, source_owner_id')
          .eq('storefront_id', brandStorefront.id)
      : await supabaseAdmin
          .from('seller_product_order')
          .select('product_id, display_order, is_featured')
          .in('seller_id', sellerAliases);
    const orderData = (orderLookup.data || []).map((row: any) => ({
      ...row,
      display_order: row.display_order ?? row.position ?? 999,
      is_featured: Boolean(row.is_featured),
    }));
    const orderError = orderLookup.error;

    if (orderError) {
      console.warn('[public-store-get] product order lookup error (non-fatal):', (orderError as any)?.message || String(orderError));
    }

    const orderIds = (orderData || []).map((row: any) => String(row?.product_id || '').trim()).filter(Boolean);

    // Conservative public fields only; tolerate schema drift by retrying when a column is missing.
    let selectFields =
      'id,title,description,price,currency,images,videos,category,category_id,shipping_cost,shipping_price,shipping_options,shipping_reserve_amount,requires_shipping,is_digital,stock_quantity,total_inventory,in_stock,track_inventory,affiliate_enabled,inventory_source,commission_rate,affiliate_commission_rate,commission_type,flat_commission_amount,affiliate_commission_type,affiliate_commission_value,affiliate_payout_amount,supplier_cost_amount,seller_markup_amount,influencer_allocation_amount,paypal_processing_allowance,seller_id,average_rating,review_count,created_at,is_active,is_promotable,status,lineage,source_platform,source,dropship_provider,cj_product_id,cj_pid,cj_spu,display_search_code,seller_ask,seller_amount,seller_ask_price,calculated_customer_price';

    let sellerOwnedProducts: any[] = [];
    let curatedProducts: any[] = [];

    for (let attempt = 0; attempt < 16; attempt++) {
      const ownedQuery = brandStorefront?.id
        ? Promise.resolve({ data: [], error: null } as any)
        : supabaseAdmin
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

    const productCandidates = [
      ...sellerOwnedProducts,
      ...curatedProducts.filter((product: any) => sellerAliases.includes(String(product.seller_id)) || isPublicAffiliateProduct(product)),
    ].filter((product: any) => isVisibleStorefrontProduct(product));
    const otherSellerIds = Array.from(new Set(productCandidates
      .map((product: any) => String(product?.seller_id || '').trim())
      .filter((id: string) => Boolean(id) && !sellerAliases.includes(id))));
    const sellerDisplayNames = new Map<string, string>();
    if (otherSellerIds.length) {
      const { data: sellerProfiles } = await supabaseAdmin.from('profiles')
        .select('id,full_name').in('id', otherSellerIds.slice(0, 500));
      (sellerProfiles || []).forEach((row: any) => {
        const id = String(row?.id || '').trim();
        const name = String(row?.full_name || '').trim();
        if (id && name) sellerDisplayNames.set(id, name);
      });
    }

    const productsById = new Map<string, any>();
    productCandidates.forEach((product: any) => {
        const productId = String(product?.id || '').trim();
        if (productId) productsById.set(productId, product);
      });

    const orderedProducts = Array.from(productsById.values()).map((product: any) => {
      const orderSetting = (orderData || []).find((o: any) => o.product_id === product.id);
      const isDigital = product?.is_digital === true;
      return sanitizeSupplyLineProduct({
        ...applyStorefrontProductPricing(normalizeLegacyStorefrontProduct(product)),
        ...storefrontProductAttribution(brandStorefront, orderSetting, product),
        profiles: { full_name: sellerDisplayNames.get(String(product?.seller_id || '').trim()) || mergedSeller.full_name },
        storefront_slug: brandStorefront?.slug || storeSlug || null,
        shipping_cost: getProductShipping(product),
        shipping_price: getProductShipping(product),
        shipping_options: isDigital
          ? []
          : [{
              name: 'Standard shipping',
              cost: getProductShipping(product),
              estimated_days: isSupplyLineProduct(product) ? 'Confirmed for your address at checkout' : '3-5 business days',
              included_in_price: false,
              ...(getCombinedShippingPolicy(product) ? { bundle_shipping: true, additional_item_cost: getCombinedShippingPolicy(product)!.additionalItemCost } : {}),
            }],
        display_order: orderSetting?.display_order ?? 999,
        is_featured: orderSetting?.is_featured ?? false,
      });
    });

    orderedProducts.sort((a: any, b: any) => {
      if (a.is_featured && !b.is_featured) return -1;
      if (!a.is_featured && b.is_featured) return 1;
      if (a.display_order !== b.display_order) return a.display_order - b.display_order;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    // Every member has one public storefront. Seller-owned products and active
    // affiliate selections are two product sources for that same member ID.
    // Do not merge by slug: a member's old seller/affiliate slugs may differ.
    // Dedicated admin brand storefronts remain deliberately isolated.
    if (!brandStorefront?.id) {
      const { data: affiliateRows, error: affiliateRowsError } = await supabaseAdmin
        .from('affiliate_products')
        .select('product_id,display_order,is_featured,is_active')
        .in('affiliate_id', sellerAliases)
        .eq('is_active', true)
        .limit(500);
      if (affiliateRowsError) {
        console.warn('[public-store-get] Unable to load member affiliate selections:', affiliateRowsError.message);
      } else {
        const affiliateProductIds = Array.from(new Set(
          (affiliateRows || []).map((row: any) => String(row?.product_id || '').trim()).filter(Boolean)
        ));
        if (affiliateProductIds.length) {
          const { data: promotedProducts, error: promotedError } = await supabaseAdmin
            .from('products')
            .select(selectFields)
            .in('id', affiliateProductIds.slice(0, 500));
          if (promotedError) {
            console.warn('[public-store-get] Unable to hydrate member affiliate products:', promotedError.message);
          } else {
            const externalSellerIds = Array.from(new Set((promotedProducts || [])
              .map((product: any) => String(product?.seller_id || '').trim())
              .filter((id: string) => Boolean(id) && !sellerAliases.includes(id))));
            const sellerNameById = new Map<string, string>();
            if (externalSellerIds.length) {
              const { data: sellerProfiles } = await supabaseAdmin.from('profiles')
                .select('id,full_name').in('id', externalSellerIds.slice(0, 500));
              (sellerProfiles || []).forEach((seller: any) => {
                const id = String(seller?.id || '').trim();
                const name = String(seller?.full_name || '').trim();
                if (id && name) sellerNameById.set(id, name);
              });
            }
            const orderById = new Map<string, any>();
            (affiliateRows || []).forEach((row: any) => orderById.set(String(row.product_id), row));
            const combinedById = new Map<string, any>();
            orderedProducts.forEach((product: any) => combinedById.set(String(product.id), product));

            (promotedProducts || []).filter((product: any) => isPublicAffiliateProduct(product))
              .forEach((product: any) => {
                const productId = String(product?.id || '').trim();
                const actualSellerId = String(product?.seller_id || '').trim();
                if (!productId || combinedById.has(productId)) return;
                const selected = orderById.get(productId);
                const externalProduct = !sellerAliases.includes(actualSellerId);
                combinedById.set(productId, sanitizeSupplyLineProduct({
                  ...applyStorefrontProductPricing(normalizeLegacyStorefrontProduct(product)),
                  ...(externalProduct ? { affiliate_id: sellerId } : {}),
                  profiles: { full_name: sellerNameById.get(actualSellerId) || 'Seller' },
                  storefront_slug: mergedSeller.subdomain || storeSlug || null,
                  display_order: Number.isFinite(Number(selected?.display_order)) ? Number(selected.display_order) : 999,
                  is_featured: Boolean(selected?.is_featured),
                }));
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
    }

    const [
      { data: pagesData, error: pagesError },
      { data: collectionsData, error: collectionsError },
      { data: placementsData, error: placementsError },
      insuranceListings,
    ] = await Promise.all([
      pagesPromise,
      brandStorefront?.id ? Promise.resolve({ data: [], error: null } as any) : supabaseAdmin
        .from('store_collections')
        .select('id,name,slug,description,image_url,display_order,is_visible')
        .in('owner_id', sellerAliases)
        .eq('is_visible', true)
        .order('display_order', { ascending: true }),
      brandStorefront?.id ? Promise.resolve({ data: [], error: null } as any) : supabaseAdmin
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
      storefront_id: brandStorefront?.id || null,
      store_slug: mergedSeller.subdomain || null,
      seller: mergedSeller,
      products: orderedProducts,
      insurance_listings: insuranceListings,
      custom_pages: pagesData || [],
      collections: collectionsData || [],
      product_placements: placementsData || [],
    };


    return json(200, responseBody);
  } catch (e) {
    const details = e instanceof Error
      ? e.message
      : String((e as any)?.message || (e as any)?.details || (e as any)?.code || e || 'Unknown error');
    return json(500, { ok: false, error: 'Unexpected error', details });
  }
};

export { handler };
