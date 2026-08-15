import type { Handler } from '@netlify/functions';
import { createSupabaseAdmin } from './_lib/supabase';

const CATALOG_URL = 'https://supliful.com/catalog';
const BRAND_SLUG = 'loving-nutrition';
const BRAND_NAME = 'Loving Nutrition';
const BRAND_LOGO = '/loving-nutrition-logo.png';

type CatalogProduct = {
  id?: string;
  sku?: string;
  slug?: string;
  name?: string;
  description?: any[];
  category?: { id?: string; name?: string };
  productImage?: string;
  productAlternativeImage?: string;
  nutritionFactsImage?: string;
  priceRetail?: number;
  priceSupliful?: number | null;
  tierPricing?: Array<{ tier?: number; price?: number }>;
  availability?: string[];
  isNew?: boolean;
  bestseller?: boolean;
};

const text = (value: unknown) => String(value ?? '').trim();
const money = (value: unknown) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

function portableTextToPlainText(value: unknown): string {
  if (!Array.isArray(value)) return '';
  return value
    .flatMap((block: any) => Array.isArray(block?.children) ? block.children : [])
    .map((child: any) => text(child?.text))
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function imagesFor(product: CatalogProduct): string[] {
  return Array.from(new Set([
    text(product.productImage),
    text(product.productAlternativeImage),
    text(product.nutritionFactsImage),
  ].filter((url) => /^https:\/\//i.test(url))));
}

function tierOneCost(product: CatalogProduct): number {
  const tier = Array.isArray(product.tierPricing)
    ? product.tierPricing.find((row) => Number(row?.tier) === 1)
    : null;
  return money(tier?.price);
}

function affiliateTarget(retailPrice: number): number {
  if (retailPrice < 25) return 5;
  if (retailPrice < 50) return 7;
  return 10;
}

function parseCatalog(html: string): CatalogProduct[] {
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/i);
  if (!match?.[1]) throw new Error('Supliful embedded catalog data was not found.');
  const payload = JSON.parse(match[1]);
  const products = payload?.props?.pageProps?.products;
  if (!Array.isArray(products) || products.length < 1) {
    throw new Error('Supliful embedded product array was empty.');
  }
  return products as CatalogProduct[];
}

async function fetchCatalog(): Promise<CatalogProduct[]> {
  const response = await fetch(CATALOG_URL, {
    headers: {
      'User-Agent': 'Beezio-LovingNutrition-CatalogSync/2.0',
      Accept: 'text/html,application/xhtml+xml',
    },
  });
  if (!response.ok) throw new Error(`Supliful catalog returned HTTP ${response.status}.`);
  return parseCatalog(await response.text());
}

export const handler: Handler = async () => {
  const supabase = createSupabaseAdmin();
  const catalog = await fetchCatalog();

  const { data: storefront, error: storefrontError } = await supabase
    .from('storefronts')
    .select('id,owner_id,slug')
    .eq('slug', BRAND_SLUG)
    .eq('is_active', true)
    .maybeSingle();
  if (storefrontError || !storefront?.id || !storefront?.owner_id) {
    throw new Error(`Loving Nutrition storefront unavailable: ${storefrontError?.message || 'not found'}`);
  }

  const [{ data: existingRows, error: existingError }, { data: placementRows, error: placementError }] = await Promise.all([
    supabase
      .from('products')
      .select('id,external_id,vendor_sku,source_url,status,is_promotable,supplier_info')
      .eq('source_platform', 'supliful')
      .limit(1000),
    supabase
      .from('storefront_products')
      .select('product_id,position')
      .eq('storefront_id', storefront.id)
      .limit(1000),
  ]);
  if (existingError) throw new Error(`Supliful product lookup failed: ${existingError.message}`);
  if (placementError) throw new Error(`Loving Nutrition placement lookup failed: ${placementError.message}`);

  const existingByKey = new Map<string, any>();
  for (const row of existingRows || []) {
    const keys = [row?.external_id, row?.vendor_sku, row?.source_url].map(text).filter(Boolean);
    for (const key of keys) existingByKey.set(key, row);
  }

  const placementIds = new Set((placementRows || []).map((row: any) => text(row?.product_id)).filter(Boolean));
  let nextPosition = Math.max(0, ...(placementRows || []).map((row: any) => Number(row?.position || 0))) + 1;
  const previewRows: any[] = [];
  const placementCandidates: Array<{ productId: string; position: number }> = [];
  const sourceErrors: string[] = [];
  let preservedLive = 0;

  for (const product of catalog) {
    const supplierId = text(product.id);
    const supplierSku = text(product.sku);
    const slug = text(product.slug).toLowerCase();
    const title = text(product.name);
    const category = text(product.category?.name) || 'Supplements & Wellness';
    const retailPrice = money(product.priceRetail);
    const cost = tierOneCost(product);
    const images = imagesFor(product);
    const sourceUrl = slug ? `${CATALOG_URL}/${slug}` : '';

    if (!supplierId || !supplierSku || !slug || !title || retailPrice <= 0 || cost <= 0 || images.length < 2) {
      sourceErrors.push(`${supplierSku || supplierId || slug || title || 'unknown'}: missing required source identity/cost/media`);
      continue;
    }
    if (!Array.isArray(product.availability) || !product.availability.includes('US')) continue;

    const existing = existingByKey.get(supplierId) || existingByKey.get(supplierSku) || existingByKey.get(sourceUrl);
    if (existing && (existing.status === 'archived' || existing.is_promotable === true)) {
      preservedLive += existing.is_promotable === true ? 1 : 0;
      continue;
    }

    const productId = text(existing?.id) || crypto.randomUUID();
    const affiliate = affiliateTarget(retailPrice);
    const existingInfo = existing?.supplier_info && typeof existing.supplier_info === 'object'
      ? existing.supplier_info
      : {};
    const description = portableTextToPlainText(product.description) || `${title} — ${category}.`;
    const supplierInfo = {
      ...existingInfo,
      supplier: 'Supliful',
      brand: BRAND_NAME,
      supplier_product_id: supplierId,
      supplier_sku: supplierSku,
      catalog_slug: slug,
      brand_logo_url: BRAND_LOGO,
      custom_label_required: true,
      label_status: existingInfo?.label_status || 'pending_supliful_approval',
      branding_status: existingInfo?.branding_status || 'pending_supliful_label_approval',
      base_cost_status: 'conservative_public_tier1_loaded',
      tier1_supplier_cost: cost,
      public_supliful_price: product.priceSupliful ?? null,
      suggested_retail: retailPrice,
      tier_pricing: product.tierPricing || [],
      availability: product.availability || [],
      is_new: Boolean(product.isNew),
      bestseller: Boolean(product.bestseller),
      pricing_status: 'preview_not_for_sale',
      shipping_status: existingInfo?.shipping_status || 'pending_exact_account_quote',
      activation_rule: 'require_exact_account_cost_shipping_and_approved_loving_nutrition_label',
      affiliate_target: affiliate,
      catalog_data_verified_at: new Date().toISOString(),
    };

    previewRows.push({
      id: productId,
      title,
      description,
      price: retailPrice,
      currency: 'USD',
      images,
      primary_image_url: images[0],
      category,
      product_type: category,
      seller_id: storefront.owner_id,
      status: 'store_only',
      is_active: true,
      is_promotable: false,
      affiliate_enabled: false,
      source_platform: 'supliful',
      source: 'supliful',
      dropship_provider: 'supliful',
      inventory_source: 'supliful',
      is_dropshipped: true,
      lineage: 'Supliful / Loving Nutrition',
      external_id: supplierId,
      external_product_id: supplierId,
      vendor_sku: supplierSku,
      sku: supplierSku,
      source_url: sourceUrl,
      supplier_cost_amount: cost,
      base_cost_cents: Math.round(cost * 100),
      retail_price_cents: Math.round(retailPrice * 100),
      seller_markup_amount: 0,
      affiliate_payout_amount: affiliate,
      commission_rate: 0,
      commission_type: 'flat_rate',
      flat_commission_amount: affiliate,
      affiliate_commission_type: 'flat',
      affiliate_commission_value: affiliate,
      shipping_cost: 0,
      shipping_price: 0,
      shipping_reserve_amount: 0,
      calculated_customer_price: retailPrice,
      seller_ask: cost,
      seller_ask_price: cost,
      track_inventory: true,
      in_stock: false,
      stock_quantity: 0,
      total_inventory: 0,
      requires_shipping: true,
      is_digital: false,
      auto_sync: true,
      import_status: 'awaiting_supliful_account_price_shipping_and_label',
      source_import_version: 'supliful_embedded_catalog_v2',
      verification_status: 'needs_review',
      supplier_info: supplierInfo,
      updated_at: new Date().toISOString(),
    });

    if (!placementIds.has(productId)) {
      placementCandidates.push({ productId, position: nextPosition++ });
      placementIds.add(productId);
    }
  }

  if (previewRows.length) {
    const { error } = await supabase.from('products').upsert(previewRows, { onConflict: 'id' });
    if (error) throw new Error(`Supliful catalog upsert failed: ${error.message}`);
  }

  if (placementCandidates.length) {
    const { error } = await supabase.from('storefront_products').insert(
      placementCandidates.map((row) => ({
        storefront_id: storefront.id,
        product_id: row.productId,
        position: row.position,
        placement_source: 'supliful_catalog_sync',
      }))
    );
    if (error) throw new Error(`Loving Nutrition placement insert failed: ${error.message}`);
  }

  const { count: currentCount } = await supabase
    .from('products')
    .select('id', { count: 'exact', head: true })
    .eq('source_platform', 'supliful')
    .neq('status', 'archived');

  console.log(JSON.stringify({
    ok: true,
    sourceCount: catalog.length,
    previewRowsSynced: previewRows.length,
    placementsAdded: placementCandidates.length,
    preservedLive,
    currentCount: currentCount || 0,
    sourceErrors: sourceErrors.slice(0, 10),
  }));

  return { statusCode: 202, body: '' };
};

export default handler;