import type { Handler } from '@netlify/functions';
import { createSupabaseAdmin } from './_lib/supabase';
import {
  cjRequest,
  getCJFreightQuote,
  getCJInventory,
  getCJProductDetail,
  getCJProductVideos,
  subscribeCJProducts,
} from './_lib/cj-api';
import { computeFixedTierPricing } from '../../shared/customerPrice';

const TIER_TARGET = 25;
const TARGET_COUNT = 125;
const PAGE_SIZE = 100;
const MAX_RESULT_PAGE = 20;
const MAX_CANDIDATES_PER_RUN = 3;
const MAX_IMPORTS_PER_RUN = 2;
const MAX_VARIANTS_PER_PRODUCT = 24;
const MAX_PER_CATEGORY_PER_TIER = 7;
const LOCK_MINUTES = 50;
const SOFT_TIME_LIMIT_MS = 14 * 60 * 1000;

const TIERS = [
  { key: 'under_25', min: 0.01, max: 24.99, supplierMin: 0.2, supplierMax: 18 },
  { key: '25_49', min: 25, max: 49.99, supplierMin: 3, supplierMax: 35 },
  { key: '50_99', min: 50, max: 99.99, supplierMin: 10, supplierMax: 75 },
  { key: '100_249', min: 100, max: 249.99, supplierMin: 25, supplierMax: 190 },
  { key: '250_499', min: 250, max: 499.99, supplierMin: 70, supplierMax: 425 },
] as const;

type Tier = (typeof TIERS)[number];
type TierPages = Record<string, number>;
type Snapshot = {
  total: number;
  tierCounts: Record<string, number>;
  categoryCounts: Record<string, Record<string, number>>;
};

const text = (value: unknown) => String(value ?? '').trim();
const money = (value: unknown) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

function firstString(...values: unknown[]): string {
  for (const value of values) {
    const normalized = text(value);
    if (normalized) return normalized;
  }
  return '';
}

function flattenProductRows(payload: any): any[] {
  const data = payload?.data ?? payload;

  // listV2 currently returns data.content[] wrapper rows, each containing productList[].
  if (Array.isArray(data?.content)) {
    const nested = data.content.flatMap((entry: any) => {
      if (Array.isArray(entry?.productList)) return entry.productList;
      const pid = firstString(entry?.pid, entry?.id, entry?.productId, entry?.product_id);
      return pid ? [entry] : [];
    });
    if (nested.length) return nested;
  }

  const candidates = [data, data?.list, data?.records, data?.rows, data?.productList];
  for (const candidate of candidates) {
    if (Array.isArray(candidate) && candidate.length) return candidate;
  }
  return [];
}

function extractUrls(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap(extractUrls);
  if (typeof value === 'string') {
    const raw = value.trim();
    if (!raw) return [];
    if ((raw.startsWith('[') && raw.endsWith(']')) || (raw.startsWith('{') && raw.endsWith('}'))) {
      try { return extractUrls(JSON.parse(raw)); } catch { /* use raw */ }
    }
    return raw.includes(',') ? raw.split(',').map((part) => part.trim()).filter(Boolean) : [raw];
  }
  if (typeof value === 'object') {
    const row = value as any;
    return extractUrls(row.url || row.image || row.src || row.productImage || row.bigImage || row.variantImage);
  }
  return [];
}

function productImages(row: any, detail: any): string[] {
  const variants = Array.isArray(detail?.variants) ? detail.variants : [];
  const values = [
    ...extractUrls(row?.productImage),
    ...extractUrls(row?.bigImage),
    ...extractUrls(row?.productImageSet),
    ...extractUrls(row?.productImageList),
    ...extractUrls(row?.images),
    ...extractUrls(detail?.productImage),
    ...extractUrls(detail?.bigImage),
    ...extractUrls(detail?.productImageSet),
    ...extractUrls(detail?.productImageList),
    ...extractUrls(detail?.images),
    ...variants.flatMap((variant: any) => [
      ...extractUrls(variant?.variantImage),
      ...extractUrls(variant?.variantImageUrl),
      ...extractUrls(variant?.variantBigImage),
      ...extractUrls(variant?.images),
    ]),
  ];
  return Array.from(new Set(values.map(text).filter((url) => /^https:\/\//i.test(url))));
}

function tierForPrice(value: unknown): Tier | null {
  const price = Number(value);
  if (!Number.isFinite(price) || price <= 0) return null;
  return TIERS.find((tier) => price >= tier.min && price <= tier.max) || null;
}

function categoryFor(value: unknown): string {
  const raw = text(value).toLowerCase();
  if (/pet|dog|cat|animal/.test(raw)) return 'Pet Supplies';
  if (/home|kitchen|household|storage|organizer|furniture|appliance/.test(raw)) return 'Home & Kitchen';
  if (/phone|computer|electronic|camera|audio|gaming|projector|office/.test(raw)) return 'Electronics & Tech';
  if (/auto|car|vehicle|motorcycle/.test(raw)) return 'Automotive';
  if (/outdoor|camp|sport|fitness|exercise|garden|patio/.test(raw)) return 'Sports & Outdoors';
  if (/beauty|personal care|hair|skin|makeup|nail|groom/.test(raw)) return 'Beauty & Personal Care';
  if (/toy|kid|child|baby|hobby|craft|school/.test(raw)) return 'Toys & Kids';
  if (/tool|hardware|improvement|repair/.test(raw)) return 'Tools & Home Improvement';
  if (/fashion|clothing|shoe|bag|jewelry|watch|accessor/.test(raw)) return 'Fashion & Accessories';
  return 'Other';
}

const BLOCKED_TERMS = [
  'cbd', 'cannabis', 'marijuana', 'nicotine', 'vape', 'tobacco',
  'supplement', 'weight loss', 'slimming', 'prescription', 'medicine', 'medical device',
  'pesticide', 'insecticide', 'firearm', 'rifle', 'pistol', 'switchblade', 'taser',
  'sex toy', 'adult toy', 'vibrator', 'dildo',
  'nike', 'adidas', 'gucci', 'louis vuitton', 'chanel', 'disney', 'marvel', 'pokemon', 'lego',
];

function blocked(row: any, detail?: any): boolean {
  const haystack = [
    row?.nameEn, row?.productNameEn, row?.productName, row?.name,
    row?.categoryName, row?.oneCategoryName, row?.twoCategoryName, row?.threeCategoryName,
    detail?.productNameEn, detail?.categoryName, detail?.brandName,
  ].map(text).join(' ').toLowerCase();
  return BLOCKED_TERMS.some((term) => haystack.includes(term));
}

function score(row: any): number {
  const listed = Number(row?.listedNum || 0);
  const inventory = Number(row?.totalVerifiedInventory || row?.warehouseInventoryNum || 0);
  const hasVideo = row?.hasVideo || row?.isVideo || row?.isVedio ? 80 : 0;
  const hasImage = firstString(row?.productImage, row?.bigImage) ? 35 : 0;
  return Math.min(300, listed / 4) + Math.min(200, inventory / 10) + hasVideo + hasImage;
}

function pricingForLandedCost(landedCost: number) {
  if (landedCost <= 8) return { markup: 4, affiliate: 2 };
  if (landedCost <= 18) return { markup: 6, affiliate: 3 };
  if (landedCost <= 40) return { markup: 10, affiliate: 5 };
  if (landedCost <= 90) return { markup: 18, affiliate: 8 };
  if (landedCost <= 180) return { markup: 30, affiliate: 12 };
  return { markup: 50, affiliate: 20 };
}

function normalizeTierPages(value: any): TierPages {
  const result: TierPages = {};
  for (const tier of TIERS) {
    const page = Math.floor(Number(value?.[tier.key] || 1));
    result[tier.key] = Number.isFinite(page) && page >= 1 && page <= MAX_RESULT_PAGE ? page : 1;
  }
  return result;
}

async function snapshot(supabase: any): Promise<Snapshot> {
  const { data, error } = await supabase
    .from('products')
    .select('calculated_customer_price,price,category')
    .eq('source_platform', 'cj')
    .eq('verification_status', 'verified')
    .eq('is_active', true)
    .eq('is_promotable', true)
    .limit(5000);
  if (error) throw new Error(`CJ snapshot failed: ${error.message}`);

  const tierCounts: Record<string, number> = Object.fromEntries(TIERS.map((tier) => [tier.key, 0]));
  const categoryCounts: Record<string, Record<string, number>> = Object.fromEntries(TIERS.map((tier) => [tier.key, {}]));
  for (const row of (data || []) as any[]) {
    const tier = tierForPrice(row?.calculated_customer_price || row?.price);
    if (!tier) continue;
    tierCounts[tier.key] += 1;
    const category = categoryFor(row?.category);
    categoryCounts[tier.key][category] = Number(categoryCounts[tier.key][category] || 0) + 1;
  }
  return {
    total: Object.values(tierCounts).reduce((sum, count) => sum + count, 0),
    tierCounts,
    categoryCounts,
  };
}

async function acquireLock(supabase: any) {
  const now = new Date();
  const nowIso = now.toISOString();
  const lockUntil = new Date(now.getTime() + LOCK_MINUTES * 60_000).toISOString();
  await supabase.from('cj_seed_state').upsert({ id: 1, target_count: TARGET_COUNT, tier_target_count: TIER_TARGET }, { onConflict: 'id' });
  const { data, error } = await supabase
    .from('cj_seed_state')
    .update({ locked_until: lockUntil, last_run_at: nowIso, started_at: nowIso, updated_at: nowIso })
    .eq('id', 1)
    .or(`locked_until.is.null,locked_until.lt.${nowIso}`)
    .select('*')
    .maybeSingle();
  if (error) throw new Error(`CJ seed lock failed: ${error.message}`);
  return data || null;
}

async function releaseLock(supabase: any, result: any, tierPages: TierPages, state?: Snapshot) {
  const now = new Date().toISOString();
  const complete = Boolean(state && TIERS.every((tier) => Number(state.tierCounts[tier.key] || 0) >= TIER_TARGET));
  await supabase.from('cj_seed_state').update({
    locked_until: null,
    tier_counts: state?.tierCounts || {},
    tier_pages: tierPages,
    last_result: result,
    completed_at: complete ? now : null,
    updated_at: now,
  }).eq('id', 1);
}

async function existingIds(supabase: any): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('products')
    .select('cj_product_id,cj_pid')
    .eq('source_platform', 'cj')
    .limit(5000);
  if (error) throw new Error(`Existing CJ lookup failed: ${error.message}`);
  return new Set((data || []).flatMap((row: any) => [text(row?.cj_product_id), text(row?.cj_pid)]).filter(Boolean));
}

async function discover(tier: Tier, page: number) {
  const base = {
    page,
    size: PAGE_SIZE,
    startSellPrice: tier.supplierMin,
    endSellPrice: tier.supplierMax,
    orderBy: 1,
    sort: 'desc',
    features: 'enable_category,enable_video',
  };

  const strictResponse: any = await cjRequest('product/listV2', {
    ...base,
    startWarehouseInventory: 1,
    verifiedWarehouse: 1,
  }, 'GET');
  let rows = flattenProductRows(strictResponse);
  let discoveryMode = 'verified_inventory';

  // The exact per-VID checks below remain mandatory, so a broad discovery fallback
  // does not weaken order safety when CJ has no rows in its verified-list filter.
  if (!rows.length) {
    const broadResponse: any = await cjRequest('product/listV2', base, 'GET');
    rows = flattenProductRows(broadResponse);
    discoveryMode = 'broad_then_exact_verify';
  }

  const seen = new Set<string>();
  const products = rows.filter((row: any) => {
    const pid = firstString(row?.pid, row?.id, row?.productId, row?.product_id);
    if (!pid || seen.has(pid) || blocked(row)) return false;
    seen.add(pid);
    return true;
  }).sort((a: any, b: any) => score(b) - score(a));

  return { products, discoveryMode, rawCount: rows.length };
}

async function freightForEveryVariant(detail: any, variants: any[]) {
  const hinted = firstString(detail?.originCountryCode, detail?.originCountry, detail?.countryCode, detail?.shipFrom).toUpperCase();
  const origins = Array.from(new Set([/^[A-Z]{2}$/.test(hinted) ? hinted : '', 'US', 'CN'].filter(Boolean)));
  const quotes: any[] = [];

  for (const variant of variants) {
    const vid = text(variant?.vid);
    if (!vid) throw new Error('Variant missing exact CJ VID.');

    const inventory = await getCJInventory(text(detail?.pid), vid);
    if (inventory === null || inventory <= 0) throw new Error(`VID ${vid} has no verified live inventory.`);

    let chosen: any = null;
    let lastError: unknown = null;
    for (const originCountryCode of origins) {
      try {
        const freight = await getCJFreightQuote({
          originCountryCode,
          destinationCountryCode: 'US',
          destinationZip: '10001',
          items: [{ vid, quantity: 1 }],
        });
        const option = freight.options[0];
        if (!option) continue;
        chosen = {
          vid,
          originCountryCode,
          destinationCountryCode: 'US',
          destinationZip: '10001',
          logisticName: option.logisticName,
          logisticAging: option.logisticAging,
          logisticPrice: option.logisticPrice,
          taxesFee: option.taxesFee,
          clearanceOperationFee: option.clearanceOperationFee,
          tariff: option.tariff,
          totalPostageFee: option.totalPostageFee,
          quotedAt: new Date().toISOString(),
        };
        break;
      } catch (error) {
        lastError = error;
      }
    }
    if (!chosen) throw new Error(`VID ${vid} has no live U.S. freight route: ${lastError instanceof Error ? lastError.message : 'quote failed'}`);
    quotes.push(chosen);
  }
  return quotes;
}

async function importProduct(params: {
  serviceRoleKey: string;
  supabaseUrl: string;
  listRow: any;
  detail: any;
  variants: any[];
  freightQuotes: any[];
  videos: string[];
  markup: number;
  affiliate: number;
  finalPrice: number;
  sellerAsk: number;
}) {
  const pid = firstString(params.detail?.pid, params.listRow?.pid, params.listRow?.id, params.listRow?.productId);
  const images = productImages(params.listRow, params.detail);
  const cjProduct = {
    pid,
    productNameEn: firstString(params.detail?.productNameEn, params.listRow?.productNameEn, params.listRow?.nameEn, params.listRow?.name),
    productSku: firstString(params.detail?.productSku, params.listRow?.productSku, params.listRow?.sku),
    productImage: firstString(params.detail?.productImage, params.detail?.bigImage, images[0]),
    categoryName: firstString(params.detail?.categoryName, params.listRow?.categoryName, params.listRow?.threeCategoryName, 'Other'),
    sellPrice: Number(params.detail?.sellPrice || params.listRow?.sellPrice || 0),
  };
  if (!pid || !cjProduct.productNameEn || !cjProduct.productSku || !cjProduct.productImage) {
    throw new Error('CJ product identity is incomplete.');
  }

  let inventory: number | null = null;
  try { inventory = await getCJInventory(pid); } catch { inventory = null; }

  const response = await fetch(`${params.supabaseUrl.replace(/\/$/, '')}/functions/v1/import-cj-product`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: params.serviceRoleKey,
      Authorization: `Bearer ${params.serviceRoleKey}`,
      'X-Beezio-Internal-Import': 'supplyline-plus',
    },
    body: JSON.stringify({
      cjProduct,
      detailedProduct: params.detail,
      selectedVariant: params.variants[0],
      variants: params.variants,
      inventory,
      pricing: {
        markup: params.markup,
        markupType: 'flat',
        affiliateCommission: params.affiliate,
        affiliateCommissionType: 'flat',
      },
      shippingCost: Math.max(...params.freightQuotes.map((quote) => Number(quote.totalPostageFee || 0))),
      variantFreightQuotes: params.freightQuotes,
      videos: params.videos,
      beezioCategory: cjProduct.categoryName,
      categoryId: null,
      computed: { finalPrice: params.finalPrice, sellerAsk: params.sellerAsk },
    }),
  });

  const raw = await response.text();
  let body: any = null;
  try { body = raw ? JSON.parse(raw) : null; } catch { body = null; }
  if (!response.ok) throw new Error(body?.details || body?.error || raw || `import-cj-product failed (${response.status})`);
  return body;
}

export const handler: Handler = async (event) => {
  const serviceRoleKey = text(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const suppliedToken = text(event.headers.authorization || event.headers.Authorization).replace(/^Bearer\s+/i, '');
  const supabaseUrl = text(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL);
  if (!serviceRoleKey || !supabaseUrl || suppliedToken !== serviceRoleKey) return { statusCode: 403, body: '' };

  const startedMs = Date.now();
  const supabase = createSupabaseAdmin();
  let locked = false;
  let tierPages: TierPages = normalizeTierPages({});
  let state: Snapshot | undefined;
  const result: any = {
    version: 'tier_v2_nested_parser',
    target_count: TARGET_COUNT,
    tier_target_count: TIER_TARGET,
    imported: [],
    skipped: [],
    failed: [],
    started_at: new Date().toISOString(),
  };

  try {
    const lock = await acquireLock(supabase);
    if (!lock) return { statusCode: 202, body: '' };
    locked = true;
    tierPages = normalizeTierPages(lock?.tier_pages);

    state = await snapshot(supabase);
    result.tier_counts_before = state.tierCounts;
    result.tier_pages_before = { ...tierPages };
    if (TIERS.every((tier) => Number(state!.tierCounts[tier.key] || 0) >= TIER_TARGET)) {
      result.status = 'complete';
      result.verified_count_after = state.total;
      await releaseLock(supabase, result, tierPages, state);
      return { statusCode: 202, body: '' };
    }

    const targetTier = [...TIERS]
      .filter((tier) => Number(state!.tierCounts[tier.key] || 0) < TIER_TARGET)
      .sort((a, b) => Number(state!.tierCounts[a.key] || 0) - Number(state!.tierCounts[b.key] || 0))[0];
    if (!targetTier) throw new Error('No incomplete tier available.');

    const page = Number(tierPages[targetTier.key] || 1);
    const discovered = await discover(targetTier, page);
    tierPages[targetTier.key] = page >= MAX_RESULT_PAGE ? 1 : page + 1;
    result.searched_tier = targetTier.key;
    result.searched_page = page;
    result.discovery_mode = discovered.discoveryMode;
    result.raw_rows = discovered.rawCount;
    result.candidates_returned = discovered.products.length;

    const known = await existingIds(supabase);
    let attempted = 0;
    let imported = 0;

    for (const row of discovered.products) {
      if (attempted >= MAX_CANDIDATES_PER_RUN || imported >= MAX_IMPORTS_PER_RUN) break;
      if (Date.now() - startedMs >= SOFT_TIME_LIMIT_MS) break;

      const pid = firstString(row?.pid, row?.id, row?.productId, row?.product_id);
      if (!pid || known.has(pid)) continue;
      attempted += 1;

      try {
        const detail = await getCJProductDetail({ pid });
        if (blocked(row, detail)) {
          result.skipped.push({ pid, reason: 'blocked category/brand/product term' });
          continue;
        }

        const variants = Array.isArray(detail?.variants) ? detail.variants : [];
        if (!variants.length) {
          result.skipped.push({ pid, reason: 'CJ returned no exact VID variants' });
          continue;
        }
        if (variants.length > MAX_VARIANTS_PER_PRODUCT) {
          result.skipped.push({ pid, reason: `all-variant rule: ${variants.length} variants exceeds batch limit ${MAX_VARIANTS_PER_PRODUCT}` });
          continue;
        }
        if (variants.some((variant: any) => !text(variant?.vid) || !text(variant?.variantSku) || !(Number(variant?.variantSellPrice) > 0))) {
          result.skipped.push({ pid, reason: 'one or more variants missing VID, SKU, or supplier price' });
          continue;
        }

        const images = productImages(row, detail);
        if (images.length < 2) {
          result.skipped.push({ pid, reason: 'fewer than two promotional images' });
          continue;
        }

        const freightQuotes = await freightForEveryVariant(detail, variants);
        const maxSupplierCost = Math.max(...variants.map((variant: any) => Number(variant.variantSellPrice)));
        const maxShipping = Math.max(...freightQuotes.map((quote) => Number(quote.totalPostageFee || 0)));
        const landedCost = money(maxSupplierCost + maxShipping);
        const pricing = pricingForLandedCost(landedCost);
        const finalPricing = computeFixedTierPricing({
          supplierCost: maxSupplierCost,
          sellerMarkup: pricing.markup,
          affiliatePayout: pricing.affiliate,
          shippingIncluded: maxShipping,
        });
        const actualTier = tierForPrice(finalPricing.finalAdvertisedPrice);
        if (!actualTier || Number(state.tierCounts[actualTier.key] || 0) >= TIER_TARGET) {
          result.skipped.push({ pid, reason: `final Beezio price ${finalPricing.finalAdvertisedPrice.toFixed(2)} does not fit an incomplete tier` });
          continue;
        }

        const category = categoryFor(firstString(detail?.categoryName, row?.categoryName, row?.threeCategoryName));
        if (Number(state.categoryCounts[actualTier.key]?.[category] || 0) >= MAX_PER_CATEGORY_PER_TIER) {
          result.skipped.push({ pid, reason: `category quota full for ${category}` });
          continue;
        }

        const shippingRatioLimit = finalPricing.finalAdvertisedPrice < 50 ? 0.55 : 0.45;
        if (maxShipping > finalPricing.finalAdvertisedPrice * shippingRatioLimit) {
          result.skipped.push({ pid, reason: `shipping ${maxShipping.toFixed(2)} is too large relative to final price` });
          continue;
        }

        let videos: string[] = [];
        try {
          const assets = await getCJProductVideos(pid);
          videos = assets.map((asset) => text(asset.videoUrl)).filter(Boolean);
        } catch { videos = []; }

        const importedBody = await importProduct({
          serviceRoleKey,
          supabaseUrl,
          listRow: row,
          detail,
          variants,
          freightQuotes,
          videos,
          markup: pricing.markup,
          affiliate: pricing.affiliate,
          finalPrice: finalPricing.finalAdvertisedPrice,
          sellerAsk: money(maxSupplierCost + pricing.markup),
        });

        const productId = text(importedBody?.product?.id);
        if (!productId) throw new Error('Importer returned no Beezio product id.');
        const { data: saved, error: savedError } = await supabase
          .from('products')
          .select('id,title,calculated_customer_price,verification_status,is_active,is_promotable')
          .eq('id', productId)
          .single();
        if (savedError) throw savedError;
        if (text(saved?.verification_status) !== 'verified' || saved?.is_active !== true || saved?.is_promotable !== true) {
          throw new Error(`Database verification gate did not certify product (${text(saved?.verification_status) || 'unknown'}).`);
        }

        try { await subscribeCJProducts([pid]); } catch { /* webhook reconciliation repairs later */ }

        known.add(pid);
        imported += 1;
        state.tierCounts[actualTier.key] = Number(state.tierCounts[actualTier.key] || 0) + 1;
        state.total += 1;
        state.categoryCounts[actualTier.key][category] = Number(state.categoryCounts[actualTier.key]?.[category] || 0) + 1;
        result.imported.push({
          pid,
          product_id: productId,
          title: text(saved?.title),
          price_tier: actualTier.key,
          category,
          variant_count: variants.length,
          advertised_price: Number(saved?.calculated_customer_price || finalPricing.finalAdvertisedPrice),
          max_supplier_cost: money(maxSupplierCost),
          max_shipping: money(maxShipping),
          affiliate_payout: pricing.affiliate,
          seller_markup: pricing.markup,
        });
      } catch (error) {
        result.failed.push({ pid, error: error instanceof Error ? error.message : String(error) });
      }
    }

    state = await snapshot(supabase);
    result.attempted_candidates = attempted;
    result.tier_counts_after = state.tierCounts;
    result.tier_pages_after = tierPages;
    result.verified_count_after = state.total;
    result.status = TIERS.every((tier) => Number(state!.tierCounts[tier.key] || 0) >= TIER_TARGET) ? 'complete' : 'in_progress';
    result.finished_at = new Date().toISOString();
    await releaseLock(supabase, result, tierPages, state);
    locked = false;
    return { statusCode: 202, body: '' };
  } catch (error) {
    result.status = 'error';
    result.error = error instanceof Error ? error.message : String(error);
    result.finished_at = new Date().toISOString();
    try {
      state = state || await snapshot(supabase);
      if (locked) await releaseLock(supabase, result, tierPages, state);
    } catch { /* lock expires if recovery fails */ }
    return { statusCode: 202, body: '' };
  }
};

export default handler;
