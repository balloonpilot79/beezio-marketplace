import type { Handler } from '@netlify/functions';
import { createSupabaseAdmin } from './_lib/supabase';
import { computeFixedTierPricing } from '../../shared/customerPrice';

const CATALOG_URL = 'https://supliful.com/catalog';
const BRAND_SLUG = 'loving-nutrition';
const BRAND_NAME = 'Loving Nutrition';
const BRAND_LOGO = '/loving-nutrition-logo.png';
const SUPLIFUL_FIRST_UNIT_FULFILLMENT_FEE = 1.99;
const SUPLIFUL_PROCESSING_RATE = 0.0299;
const AFFILIATE_PAYOUT_OPTIONS = [25, 20, 15, 12, 10, 7] as const;

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
  shippingFrom?: number | null;
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

function standardShippingReserve(product: CatalogProduct, cost: number, title: string, category: string): number {
  const embeddedShipping = Number(product.shippingFrom || 0);
  const shipping = embeddedShipping > 0
    ? embeddedShipping
    : /(protein|powder|coffee|tea|cacao|cocoa)/i.test(`${title} ${category}`)
      ? 12
      : 7;
  const processing = money((cost + shipping + SUPLIFUL_FIRST_UNIT_FULFILLMENT_FEE) * SUPLIFUL_PROCESSING_RATE);
  return money(shipping + SUPLIFUL_FIRST_UNIT_FULFILLMENT_FEE + processing);
}

function chooseLivePricing(params: {
  cost: number;
  suggestedRetail: number;
  reserve: number;
}) {
  const markup = params.suggestedRetail >= 50 ? 8 : 6;
  const softRetailCap = Math.max(params.suggestedRetail * 1.25, params.suggestedRetail + 10);

  for (const affiliate of AFFILIATE_PAYOUT_OPTIONS) {
    const pricing = computeFixedTierPricing({
      supplierCost: params.cost,
      sellerMarkup: markup,
      affiliatePayout: affiliate,
      shippingIncluded: params.reserve,
    });
    if (pricing.finalAdvertisedPrice <= softRetailCap) {
      return { affiliate, markup, pricing };
    }
  }

  const affiliate = AFFILIATE_PAYOUT_OPTIONS[AFFILIATE_PAYOUT_OPTIONS.length - 1];
  return {
    affiliate,
    markup,
    pricing: computeFixedTierPricing({
      supplierCost: params.cost,
      sellerMarkup: markup,
      affiliatePayout: affiliate,
      shippingIncluded: params.reserve,
    }),
  };
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
      'User-Agent': 'Beezio-LovingNutrition-CatalogSync/3.0',
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
  const liveRows: any[] = [];
  const placementCandidates: Array<{ productId: string; position: number }> = [];
  const unavailableIds: string[] = [];
  const sourceErrors: string[] = [];

  for (const product of catalog) {
    const supplierId = text(product.id);
    const supplierSku = text(product.sku);
    const slug = text(product.slug).toLowerCase();
    const title = text(product.name);
    const category = text(product.category?.name) || 'Supplements & Wellness';
    const suggestedRetail = money(product.priceRetail);
    const cost = tierOneCost(product);
    const images = imagesFor(product);
    const sourceUrl = slug ? `${CATALOG_URL}/${slug}` : '';
    const existing = existingByKey.get(supplierId) || existingByKey.get(supplierSku) || existingByKey.get(sourceUrl);

    if (existing?.status === 'archived') continue;
    if (!Array.isArray(product.availability) || !product.availability.includes('US')) {
      if (existing?.id) unavailableIds.push(text(existing.id));
      continue;
    }

    if (!supplierId || !supplierSku || !slug || !title || suggestedRetail <= 0 || cost <= 0 || images.length < 2) {
      sourceErrors.push(`${supplierSku || supplierId || slug || title || 'unknown'}: missing required source identity/cost/media`);
      continue;
    }

    const productId = text(existing?.id) || crypto.randomUUID();
    const reserve = standardShippingReserve(product, cost, title, category);
    const { affiliate, markup, pricing } = chooseLivePricing({ cost, suggestedRetail, reserve });
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
      suggested_retail: suggestedRetail,
      tier_pricing: product.tierPricing || [],
      availability: product.availability || [],
      is_new: Boolean(product.isNew),
      bestseller: Boolean(product.bestseller),
      pricing_status: 'live_manual_fulfillment',
      fulfillment_mode: 'manual_order',
      manual_fulfillment_required: true,
      shipping_status: 'us_standard_shipping_fulfillment_processing_reserved',
      shipping_reserve: reserve,
      affiliate_target: affiliate,
      seller_markup: markup,
      live_customer_price: pricing.finalAdvertisedPrice,
      activation_rule: 'manual_supliful_order_after_beezio_payment',
      catalog_data_verified_at: new Date().toISOString(),
    };

    liveRows.push({
      id: productId,
      title,
      description,
      price: pricing.finalAdvertisedPrice,
      currency: 'USD',
      images,
      primary_image_url: images[0],
      category,
      product_type: category,
      seller_id: storefront.owner_id,
      status: 'active',
      is_active: true,
      is_promotable: true,
      affiliate_enabled: true,
      source_platform: 'supliful',
      source: 'supliful',
      dropship_provider: 'supliful',
      inventory_source: 'supliful_manual',
      is_dropshipped: true,
      lineage: 'Supliful / Loving Nutrition',
      external_id: supplierId,
      external_product_id: supplierId,
      vendor_sku: supplierSku,
      sku: supplierSku,
      source_url: sourceUrl,
      supplier_cost_amount: cost,
      base_cost_cents: Math.round(cost * 100),
      retail_price_cents: Math.round(pricing.finalAdvertisedPrice * 100),
      seller_markup_amount: markup,
      seller_ask: pricing.sellerPayout,
      seller_amount: pricing.sellerPayout,
      seller_ask_price: pricing.sellerPayout,
      affiliate_payout_amount: affiliate,
      commission_rate: 0,
      affiliate_commission_rate: 0,
      commission_type: 'flat_rate',
      flat_commission_amount: affiliate,
      affiliate_commission_type: 'flat',
      affiliate_commission_value: affiliate,
      shipping_cost: 0,
      shipping_price: 0,
      shipping_reserve_amount: reserve,
      calculated_customer_price: pricing.finalAdvertisedPrice,
      influencer_allocation_amount: pricing.influencerAllocation,
      paypal_processing_allowance: pricing.paypalProcessingAllowance,
      track_inventory: false,
      in_stock: true,
      stock_quantity: 0,
      total_inventory: 0,
      requires_shipping: true,
      is_digital: false,
      auto_sync: true,
      import_status: 'manual_fulfillment_ready',
      source_import_version: 'supliful_embedded_catalog_v3_live',
      verification_status: 'verified',
      supplier_info: supplierInfo,
      updated_at: new Date().toISOString(),
    });

    if (!placementIds.has(productId)) {
      placementCandidates.push({ productId, position: nextPosition++ });
      placementIds.add(productId);
    }
  }

  if (liveRows.length) {
    const { error } = await supabase.from('products').upsert(liveRows, { onConflict: 'id' });
    if (error) throw new Error(`Supliful live catalog upsert failed: ${error.message}`);
  }

  if (unavailableIds.length) {
    const { error } = await supabase.from('products').update({
      status: 'draft',
      is_active: false,
      is_promotable: false,
      affiliate_enabled: false,
      in_stock: false,
      updated_at: new Date().toISOString(),
    }).in('id', unavailableIds);
    if (error) throw new Error(`Supliful unavailable-product hold failed: ${error.message}`);
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
    liveRowsSynced: liveRows.length,
    placementsAdded: placementCandidates.length,
    unavailableHeld: unavailableIds.length,
    currentCount: currentCount || 0,
    sourceErrors: sourceErrors.slice(0, 10),
  }));

  return { statusCode: 202, body: '' };
};

export default handler;