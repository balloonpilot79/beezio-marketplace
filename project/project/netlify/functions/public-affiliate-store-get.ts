import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { buildStoreInsuranceListings } from './_lib/storeInsurance';
import { applyCanonicalProductPricing } from '../../shared/productPricing';

function json(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
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

function extractMissingColumnName(message: string): string | null {
  const msg = String(message || '');
  const pg = msg.match(/column\s+"([^"]+)"\s+of\s+relation\s+"[^"]+"\s+does\s+not\s+exist/i);
  if (pg?.[1]) return pg[1];
  const pgDot = msg.match(/column\s+([a-z0-9_]+\.[a-z0-9_]+)\s+does\s+not\s+exist/i);
  if (pgDot?.[1]) return pgDot[1].split('.').pop() || pgDot[1];
  const pgrst = msg.match(/Could not find the '([^']+)' column of '[^']+' in the schema cache/i);
  if (pgrst?.[1]) return pgrst[1];
  return null;
}

const isUuid = (value: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const isVisibleStorefrontProduct = (product: any): boolean => {
  const status = String(product?.status || '').trim().toLowerCase();
  const isActive = product?.is_active === true;
  const isPromotable = product?.is_promotable === true;
  if (status === 'active' || isActive || isPromotable) return true;
  const hasExplicitFlags =
    Object.prototype.hasOwnProperty.call(product || {}, 'is_active') ||
    Object.prototype.hasOwnProperty.call(product || {}, 'is_promotable') ||
    status.length > 0;
  return !hasExplicitFlags;
};

const sortStorefrontRows = (rows: any[]) =>
  rows.sort((a: any, b: any) => {
    if (a?.is_featured && !b?.is_featured) return -1;
    if (!a?.is_featured && b?.is_featured) return 1;
    const orderA = Number.isFinite(Number(a?.display_order)) ? Number(a.display_order) : 999;
    const orderB = Number.isFinite(Number(b?.display_order)) ? Number(b.display_order) : 999;
    if (orderA !== orderB) return orderA - orderB;
    const createdA = new Date(String(a?.products?.created_at || 0)).getTime();
    const createdB = new Date(String(b?.products?.created_at || 0)).getTime();
    return createdB - createdA;
  });

const normalizeAffiliateStoreProduct = (product: any) => {
  const normalized = { ...(product || {}) };
  const normalizedPercent = Number(normalized?.commission_rate || 0);
  const normalizedAffiliateRate = Number(normalized?.affiliate_commission_rate || 0);
  const normalizedAffiliateValue = Number(normalized?.affiliate_commission_value || 0);
  const normalizedFlatAmount = Number(normalized?.flat_commission_amount || 0);
  const commissionType = String(normalized?.commission_type || '').trim().toLowerCase();
  const affiliateCommissionType = String(normalized?.affiliate_commission_type || '').trim().toLowerCase();
  const hasAnyCommission = normalizedPercent > 0 || normalizedAffiliateRate > 0 || normalizedAffiliateValue > 0 || normalizedFlatAmount > 0;

  if (!hasAnyCommission) {
    normalized.commission_type = 'percentage';
    normalized.affiliate_commission_type = 'percent';
    normalized.commission_rate = 30;
    normalized.affiliate_commission_rate = 30;
    normalized.affiliate_commission_value = 30;
    return normalized;
  }

  if ((affiliateCommissionType === 'flat' || commissionType === 'flat_rate' || commissionType === 'fixed') && normalizedPercent <= 0) {
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
    const affiliateRaw = String(
      event.queryStringParameters?.affiliate ||
        event.queryStringParameters?.id ||
        event.queryStringParameters?.store ||
        ''
    ).trim();
    if (!affiliateRaw) return json(400, { ok: false, error: 'Missing affiliate' });

    const supabaseUrl = requireEnv('SUPABASE_URL', ['VITE_SUPABASE_URL']);
    const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    let canonicalAffiliateId = '';
    let settingsRow: any = null;
    let profileRow: any = null;

    if (!isUuid(affiliateRaw)) {
      const normalizedSlug = affiliateRaw.toLowerCase();
      const [{ data: slugMatch }, { data: profileSlugMatch }] = await Promise.all([
        supabaseAdmin
          .from('affiliate_store_settings')
          .select('*')
          .eq('subdomain', normalizedSlug)
          .maybeSingle(),
        supabaseAdmin
          .from('profiles')
          .select('*')
          .eq('subdomain', normalizedSlug)
          .maybeSingle(),
      ]);
      if (slugMatch?.affiliate_id) {
        canonicalAffiliateId = String(slugMatch.affiliate_id);
        settingsRow = slugMatch;
      }
      if (!profileRow && profileSlugMatch) {
        profileRow = profileSlugMatch;
        canonicalAffiliateId = String(profileSlugMatch.id || canonicalAffiliateId || '').trim();
      }
    }

    const lookup = canonicalAffiliateId || affiliateRaw;
    const { data: profileCandidate } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .or(`id.eq.${lookup},user_id.eq.${lookup}`)
      .maybeSingle();
    if (profileCandidate) {
      profileRow = profileCandidate;
      canonicalAffiliateId = String(profileCandidate.id || canonicalAffiliateId || lookup);
    }

    if (!settingsRow && canonicalAffiliateId) {
      const { data: settingsCandidate } = await supabaseAdmin
        .from('affiliate_store_settings')
        .select('*')
        .eq('affiliate_id', canonicalAffiliateId)
        .maybeSingle();
      if (settingsCandidate) settingsRow = settingsCandidate;
    }

    if (!canonicalAffiliateId && settingsRow?.affiliate_id) {
      canonicalAffiliateId = String(settingsRow.affiliate_id);
    }
    if (!canonicalAffiliateId) canonicalAffiliateId = lookup;

    if (!canonicalAffiliateId) {
      return json(404, { ok: false, error: 'Store not found' });
    }

    const affiliateAliases = new Set(
      [
        canonicalAffiliateId,
        lookup,
        String(settingsRow?.affiliate_id || '').trim(),
        String(profileRow?.id || '').trim(),
        String(profileRow?.user_id || '').trim(),
      ]
        .map((value) => String(value || '').trim())
        .filter(Boolean)
    );

    const { data: affiliateRows, error: affiliateRowsError } = await supabaseAdmin
      .from('affiliate_products')
      .select('id,affiliate_id,product_id,is_featured,display_order');

    if (affiliateRowsError) {
      return json(500, {
        ok: false,
        error: 'Failed to load affiliate products',
        details: affiliateRowsError.message,
      });
    }

    const matchingRows = (affiliateRows || []).filter((row: any) => {
      const rowAffiliateId = String(row?.affiliate_id || '').trim();
      return affiliateAliases.has(rowAffiliateId);
    });

    const productIds = Array.from(
      new Set(
        matchingRows
          .map((row: any) => String(row?.product_id || '').trim())
          .filter(Boolean)
      )
    );

    let productsById = new Map<string, any>();
    if (productIds.length) {
      let selectFields =
        'id,title,description,price,images,primary_image_url,image_url,category_id,stock_quantity,total_inventory,in_stock,track_inventory,inventory_source,seller_id,is_active,is_promotable,status,created_at,lineage,source_platform,source,dropship_provider,cj_product_id,cj_pid,cj_spu,display_search_code,seller_ask,seller_amount,seller_ask_price,calculated_customer_price,commission_rate,affiliate_commission_rate,commission_type,flat_commission_amount,affiliate_commission_type,affiliate_commission_value';

      let fetchedProducts: any[] = [];

      for (let attempt = 0; attempt < 16; attempt++) {
        let query = supabaseAdmin.from('products').select(selectFields).in('id', productIds.slice(0, 500));

        const { data, error } = await query;
        if (!error) {
          fetchedProducts = Array.isArray(data) ? data : [];
          break;
        }

        const missing = extractMissingColumnName(String((error as any)?.message || ''));
        if (missing && selectFields.split(',').map((s) => s.trim()).includes(missing)) {
          selectFields = selectFields
            .split(',')
            .map((s) => s.trim())
            .filter((s) => s && s !== missing)
            .join(',');
          continue;
        }

        return json(500, { ok: false, error: 'Failed to load products', details: (error as any)?.message || String(error) });
      }

      const visibleProducts = fetchedProducts.filter((product: any) => isVisibleStorefrontProduct(product));

      const sellerIds = Array.from(
        new Set(visibleProducts.map((p: any) => String(p?.seller_id || '').trim()).filter(Boolean))
      );
      const sellerNameById = new Map<string, string>();
      if (sellerIds.length) {
        const { data: sellers } = await supabaseAdmin
          .from('profiles')
          .select('id,full_name')
          .in('id', sellerIds.slice(0, 500));
        (sellers || []).forEach((seller: any) => {
          const id = String(seller?.id || '').trim();
          const name = String(seller?.full_name || '').trim();
          if (id && name) sellerNameById.set(id, name);
        });
      }

      productsById = new Map(
        visibleProducts.map((product: any) => [
          String(product.id),
          {
            ...applyCanonicalProductPricing(normalizeAffiliateStoreProduct(product)),
            profiles: { full_name: sellerNameById.get(String(product?.seller_id || '').trim()) || undefined },
          },
        ])
      );
    }

    let rowsWithProducts = matchingRows
      .map((row: any) => ({
        ...row,
        products: productsById.get(String(row?.product_id || '').trim()) || null,
      }))
      .filter((row: any) => Boolean(row.products));

    const sharedSlug = String(settingsRow?.subdomain || '').trim().toLowerCase();
    if (sharedSlug) {
      const { data: sellerSettingsRow } = await supabaseAdmin
        .from('store_settings')
        .select('seller_id')
        .eq('subdomain', sharedSlug)
        .maybeSingle();

      const sharedSellerId = String((sellerSettingsRow as any)?.seller_id || '').trim();
      if (sharedSellerId) {
        const [{ data: sellerOrderRows }, { data: sellerProducts }] = await Promise.all([
          supabaseAdmin
            .from('seller_product_order')
            .select('product_id, display_order, is_featured')
            .eq('seller_id', sharedSellerId),
          supabaseAdmin
            .from('products')
            .select('id,title,description,price,images,primary_image_url,image_url,category_id,stock_quantity,total_inventory,in_stock,track_inventory,seller_id,is_active,is_promotable,status,created_at,lineage,source_platform,source,dropship_provider,cj_product_id,cj_pid,cj_spu,display_search_code,seller_ask,seller_amount,seller_ask_price,calculated_customer_price,commission_rate,affiliate_commission_rate,commission_type,flat_commission_amount,affiliate_commission_type,affiliate_commission_value')
            .eq('seller_id', sharedSellerId)
            .order('created_at', { ascending: false })
            .limit(200),
        ]);

        const orderByProductId = new Map<string, any>();
        (sellerOrderRows || []).forEach((row: any) => {
          const productId = String(row?.product_id || '').trim();
          if (productId) orderByProductId.set(productId, row);
        });

        const combinedByProductId = new Map<string, any>();
        rowsWithProducts.forEach((row: any) => {
          const productId = String(row?.product_id || '').trim();
          if (productId) combinedByProductId.set(productId, row);
        });

        (sellerProducts || [])
          .filter((product: any) => isVisibleStorefrontProduct(product))
          .forEach((product: any) => {
            const productId = String(product?.id || '').trim();
            if (!productId || combinedByProductId.has(productId)) return;
            const order = orderByProductId.get(productId);
            combinedByProductId.set(productId, {
              id: `seller:${productId}`,
              affiliate_id: canonicalAffiliateId,
              product_id: productId,
              is_featured: Boolean(order?.is_featured),
              display_order: Number.isFinite(Number(order?.display_order)) ? Number(order.display_order) : 999,
              products: {
                ...applyCanonicalProductPricing(normalizeAffiliateStoreProduct(product)),
                profiles: rowsWithProducts[0]?.products?.profiles || undefined,
              },
            });
          });

        rowsWithProducts = Array.from(combinedByProductId.values());
      }
    }

    rowsWithProducts = sortStorefrontRows(rowsWithProducts);

    const [customPagesResult, collectionsResult, placementsResult, insuranceListings] = await Promise.all([
      supabaseAdmin
        .from('custom_pages')
        .select('page_slug,page_title,is_active,display_order')
        .eq('owner_id', canonicalAffiliateId)
        .eq('owner_type', 'affiliate')
        .eq('is_active', true)
        .order('display_order', { ascending: true }),
      supabaseAdmin
        .from('store_collections')
        .select('id,name,slug,description,image_url,display_order,is_visible')
        .in('owner_id', Array.from(affiliateAliases))
        .eq('is_visible', true)
        .order('display_order', { ascending: true }),
      supabaseAdmin
        .from('store_product_placements')
        .select('product_id,placement_type,collection_id,custom_page_id,section_key,display_order,is_visible')
        .in('owner_id', Array.from(affiliateAliases))
        .eq('is_visible', true)
        .order('display_order', { ascending: true }),
      buildStoreInsuranceListings(
        supabaseAdmin,
        (profileRow as any)?.location || (settingsRow as any)?.location || '',
        6
      ),
    ]);

    const customPages = customPagesResult.data || [];

    if (collectionsResult.error) {
      console.warn('[public-affiliate-store-get] collections lookup error (non-fatal):', collectionsResult.error.message);
    }
    if (placementsResult.error) {
      console.warn('[public-affiliate-store-get] placements lookup error (non-fatal):', placementsResult.error.message);
    }

    return json(200, {
      ok: true,
      canonical_affiliate_id: canonicalAffiliateId,
      affiliate: profileRow || null,
      store_settings: settingsRow || null,
      rows: rowsWithProducts,
      insurance_listings: insuranceListings,
      custom_pages: customPages,
      collections: collectionsResult.data || [],
      product_placements: placementsResult.data || [],
    });
  } catch (e) {
    return json(500, {
      ok: false,
      error: 'Unexpected error',
      details: e instanceof Error ? e.message : String(e),
    });
  }
};

export { handler };
