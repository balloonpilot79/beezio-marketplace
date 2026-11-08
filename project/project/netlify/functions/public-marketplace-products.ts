import { buildPublicStoreDirectory } from '../../shared/publicStoreDirectory';
import { getProductShipping } from '../../shared/productShipping';
import { isPublicMarketplaceProduct } from '../../shared/publicProductVisibility';
import { isPublicTestProduct } from '../../shared/publicProductVisibility';
import type { Handler } from '@netlify/functions';
import { createSupabaseAdmin } from './_lib/supabase';
import { applyCanonicalProductPricing } from '../../shared/productPricing';
import { isSupplyLineProduct, sanitizeSupplyLineProduct } from '../../shared/publicSupplyLineProduct';
import { getOwnedProductStorefront, getPublicSellerName } from '../../shared/publicSellerIdentity';

function json(statusCode: number, body: unknown, cacheDirectory = false) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'Netlify-Vary': 'query=stores_only|include_stores|page_size|offset',
      ...(cacheDirectory ? {
        'Netlify-CDN-Cache-Control': 'public, durable, s-maxage=60, stale-while-revalidate=60',
      } : {}),
    },
    body: JSON.stringify(body),
  };
}

const text = (value: unknown) => String(value ?? '').trim();

function isLovingNutritionPreview(product: any): boolean {
  return (
    text(product?.source_platform).toLowerCase() === 'supliful' &&
    text(product?.status).toLowerCase() === 'store_only' &&
    product?.is_active === true &&
    product?.is_promotable !== true
  );
}

function isLiveMarketplaceProduct(product: any): boolean {
  return (
    product?.is_active === true &&
    ((product?.is_promotable === true && product?.affiliate_enabled === true) ||
      (product?.direct_marketplace_listing === true && product?.affiliate_enabled === false)) &&
    product?.is_digital !== true &&
    text(product?.status).toLowerCase() === 'active'
  );
}

function publicCommissionFields(product: any) {
  const direct = Number(product?.affiliate_payout_amount ?? 0);
  const storedFlat = Number(product?.flat_commission_amount ?? 0);
  const affiliateValue = Number(product?.affiliate_commission_value ?? 0);
  const amount = [direct, storedFlat, affiliateValue].find((value) => Number.isFinite(value) && value > 0) || 0;
  if (amount > 0) {
    return {
      commission_type: 'flat_rate',
      affiliate_commission_type: 'flat',
      commission_rate: 0,
      affiliate_commission_rate: 0,
      affiliate_commission_value: amount,
      flat_commission_amount: amount,
      affiliate_payout_amount: amount,
    };
  }
  return {
    commission_type: product?.commission_type || 'percentage',
    affiliate_commission_type: product?.affiliate_commission_type || 'percent',
    commission_rate: Number(product?.commission_rate || 0),
    affiliate_commission_rate: Number(product?.affiliate_commission_rate || 0),
    affiliate_commission_value: Number(product?.affiliate_commission_value || 0),
    flat_commission_amount: Number(product?.flat_commission_amount || 0),
    affiliate_payout_amount: Number(product?.affiliate_payout_amount || 0),
  };
}

const handler: Handler = async (event) => {
  try {
    const supabaseAdmin = createSupabaseAdmin();
    const selectFields = [
      'id',
      'title',
      'item_condition',
      'merchandise_types',
      'direct_marketplace_listing',
      'description',
      'price',
      'calculated_customer_price',
      'seller_ask',
      'seller_amount',
      'seller_ask_price',
      'shipping_reserve_amount',
      'shipping_price',
      'shipping_cost',
      'stock_quantity',
      'total_inventory',
      'in_stock',
      'track_inventory',
      'inventory_source',
      'category',
      'beezio_category_id',
      'images',
      'commission_rate',
      'affiliate_commission_rate',
      'commission_type',
      'flat_commission_amount',
      'affiliate_commission_type',
      'affiliate_commission_value',
      'affiliate_payout_amount',
      'seller_id',
      'average_rating',
      'review_count',
      'created_at',
      'is_active',
      'is_promotable',
      'affiliate_enabled',
      'status',
      'lineage',
      'dropship_provider',
      'source_platform',
      'source',
      'is_digital',
      'requires_shipping',
    ].join(',');

    const params = event.queryStringParameters || {};
    const storesOnly = params.stores_only === '1';
    const requestedSize = Number(params.page_size || 500);
    const pageSize = Number.isSafeInteger(requestedSize) ? Math.max(1, Math.min(500, requestedSize)) : 500;
    const requestedOffset = Number(params.offset || 0);
    const offset = Number.isSafeInteger(requestedOffset) && requestedOffset >= 0 ? requestedOffset : 0;

    const { data, error } = await supabaseAdmin
      .from('products')
      .select(storesOnly
        ? 'id,seller_id,images,is_active,is_promotable,affiliate_enabled,direct_marketplace_listing,status,is_digital,in_stock,track_inventory,stock_quantity,total_inventory'
        : selectFields)
      .eq('is_active', true)
      .or('and(is_promotable.eq.true,affiliate_enabled.eq.true),and(direct_marketplace_listing.eq.true,affiliate_enabled.eq.false)')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .order('id', { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) {
      return json(500, { ok: false, error: 'Failed to load marketplace catalog', details: error.message });
    }

    const candidates = (Array.isArray(data) ? data : []).filter(
      (product: any) => isPublicMarketplaceProduct(product) && isLiveMarketplaceProduct(product)
    );

    const categoryIds = Array.from(new Set(
      candidates.map((product: any) => text(product?.beezio_category_id)).filter(Boolean)
    ));
    const sellerIds = Array.from(new Set(
      candidates.map((product: any) => text(product?.seller_id)).filter(Boolean)
    ));
    const productIds = candidates.map((product: any) => text(product?.id)).filter(Boolean);
    const includeStores = storesOnly || params.include_stores === '1';

    const [categories, sellers, sellerSettings, placements, selections] = await Promise.all([
      !storesOnly && categoryIds.length
        ? supabaseAdmin.from('categories').select('id,name,slug,parent_id').in('id', categoryIds.slice(0, 500))
        : { data: [] },
      sellerIds.length
        ? supabaseAdmin.from('profiles').select('id,full_name,location').in('id', sellerIds.slice(0, 500))
        : { data: [] },
      sellerIds.length
        ? supabaseAdmin.from('store_settings').select('seller_id,store_name,subdomain').in('seller_id', sellerIds.slice(0, 500))
        : { data: [] },
      productIds.length
        ? supabaseAdmin.from('storefront_products').select('product_id,storefront_id').in('product_id', productIds.slice(0, 500))
        : { data: [] },
      productIds.length && includeStores
        ? supabaseAdmin.from('affiliate_products').select('affiliate_id,product_id').in('product_id', productIds.slice(0, 500)).eq('is_active', true).limit(1000)
        : { data: [] },
    ]);

    const categoryMetaById = new Map<string, { name?: string; slug?: string; parent_id?: string | null }>();
    (categories.data || []).forEach((row: any) => {
      const id = text(row?.id);
      if (id) categoryMetaById.set(id, {
        name: text(row?.name) || undefined,
        slug: text(row?.slug) || undefined,
        parent_id: row?.parent_id ? text(row.parent_id) : null,
      });
    });
    const sellerMetaById = new Map<string, { full_name?: string; location?: string }>();
    (sellers.data || []).forEach((row: any) => {
      const id = text(row?.id);
      if (id) sellerMetaById.set(id, {
        full_name: text(row?.full_name) || undefined,
        location: text(row?.location) || undefined,
      });
    });
    const sellerSettingsById = new Map((sellerSettings.data || []).map((row: any) => [text(row.seller_id), row]));
    let directoryComplete = ![sellers, sellerSettings, placements, selections].some(result => 'error' in result && result.error);
    const { data: placementRows } = placements;
    const storefrontsByProductId = new Map<string, any[]>();
    if (placementRows?.length) {
      const storefrontIds = Array.from(new Set(
        (placementRows || []).map((row: any) => text(row?.storefront_id)).filter(Boolean)
      ));
      const storefrontById = new Map<string, any>();
      if (storefrontIds.length) {
        const { data: storefrontRows, error: storefrontError } = await supabaseAdmin
          .from('storefronts')
          .select('id,owner_id,name,slug,theme_settings,is_active')
          .in('id', storefrontIds.slice(0, 500))
          .eq('is_active', true);
        directoryComplete &&= !storefrontError;
        (storefrontRows || []).forEach((row: any) => {
          const id = text(row?.id);
          if (id) storefrontById.set(id, row);
        });
      }
      (placementRows || []).forEach((placement: any) => {
        const productId = text(placement?.product_id);
        const storefront = storefrontById.get(text(placement?.storefront_id));
        if (!productId || !storefront) return;
        const rows = storefrontsByProductId.get(productId) || [];
        rows.push(storefront);
        storefrontsByProductId.set(productId, rows);
      });
    }

    const products = candidates.map((raw: any) => {
      if (storesOnly) return { ...raw, profiles: sellerMetaById.get(text(raw.seller_id)) };
      const preview = isLovingNutritionPreview(raw);
      const storedBuyerPrice = Number(raw?.calculated_customer_price ?? 0);
      const priced = preview || (Number.isFinite(storedBuyerPrice) && storedBuyerPrice > 0)
        ? { ...raw }
        : applyCanonicalProductPricing(raw);
      const categoryId = text(raw?.beezio_category_id);
      const categoryMeta = categoryMetaById.get(categoryId) || {};
      const sellerMeta = sellerMetaById.get(text(raw?.seller_id)) || {};
      const productStorefronts = storefrontsByProductId.get(text(raw?.id)) || [];
      const houseStorefront = getOwnedProductStorefront(productStorefronts, raw?.seller_id);
      const publicSellerName = getPublicSellerName(sellerMeta.full_name, sellerSettingsById.get(text(raw?.seller_id)), houseStorefront);

      const publicRow: any = sanitizeSupplyLineProduct({
        ...priced,
        ...publicCommissionFields(raw),
        category_id: categoryId || null,
        shipping_cost: getProductShipping(raw),
        shipping_price: getProductShipping(raw),
        category: text(raw?.category || categoryMeta.name) || null,
        category_name: text(categoryMeta.name || raw?.category) || null,
        category_slug: text(categoryMeta.slug) || null,
        category_parent_id: categoryMeta.parent_id || null,
        storefront_slug: houseStorefront?.slug || null,
        profiles: {
          full_name: publicSellerName,
          location: sellerMeta.location,
        },
      });

      if (!preview) return publicRow;

      // MarketplacePageDual treats rows with no explicit visibility state as
      // legacy-visible products. Omit those state fields on previews so they can
      // appear in the catalog while ProductCard still sees zero tracked stock and
      // refuses add-to-store/purchase actions. Real checkout independently rejects
      // these rows because inventory is tracked at zero.
      const {
        status: _status,
        is_active: _isActive,
        is_promotable: _isPromotable,
        affiliate_enabled: _affiliateEnabled,
        ...previewRow
      } = publicRow;

      return {
        ...previewRow,
        catalog_preview: true,
        catalog_status: 'coming_soon',
        storefront_slug: 'loving-nutrition',
        profiles: {
          full_name: 'Loving Nutrition',
          location: sellerMeta.location,
        },
        stock_quantity: 0,
        total_inventory: 0,
        in_stock: false,
        track_inventory: true,
        requires_shipping: false,
      };
    });

    const { data: affiliateSelections } = selections;
    const affiliateIds = Array.from(new Set((affiliateSelections || []).map((row: any) => text(row.affiliate_id)).filter(Boolean)));
    const affiliateStores: any[] = [];
    if (affiliateIds.length) {
      const [memberSettings, affiliateSettings] = await Promise.all([
        supabaseAdmin.from('store_settings').select('seller_id,store_name,subdomain').in('seller_id', affiliateIds.slice(0, 500)),
        supabaseAdmin.from('affiliate_store_settings').select('affiliate_id,store_name,subdomain').in('affiliate_id', affiliateIds.slice(0, 500)),
      ]);
      directoryComplete &&= !memberSettings.error && !affiliateSettings.error;
      affiliateIds.forEach(id => {
        const settings = (memberSettings.data || []).find((row: any) => text(row.seller_id) === id)
          || (affiliateSettings.data || []).find((row: any) => text(row.affiliate_id) === id);
        if (settings) affiliateStores.push({ ...settings, productIds: (affiliateSelections || []).filter((row: any) => text(row.affiliate_id) === id).map((row: any) => text(row.product_id)) });
      });
    }
    const stores = buildPublicStoreDirectory(products, sellerSettingsById, storefrontsByProductId, affiliateStores);

    if (storesOnly) return json(200, { ok: true, stores }, directoryComplete && !params.page_size && !params.offset);

    return json(200, {
      ok: true,
      products,
      next_offset: data?.length === pageSize ? offset + pageSize : null,
      stores,
      counts: {
        total: products.length,
        live: products.filter((product: any) => product?.catalog_preview !== true).length,
        coming_soon: products.filter((product: any) => product?.catalog_preview === true).length,
      },
    });
  } catch (error) {
    return json(500, {
      ok: false,
      error: 'Unexpected marketplace catalog error',
      details: error instanceof Error ? error.message : String(error),
    });
  }
};

export { handler };
