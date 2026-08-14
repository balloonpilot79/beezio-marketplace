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
const MAX_NEW_PER_RUN = 2;
const MAX_VARIANTS_PER_PRODUCT = 24;
const MAX_CANDIDATE_ATTEMPTS = 3;
const PAGE_SIZE = 100;
const MAX_RESULT_PAGE = 20;
const LOCK_MINUTES = 50;
const SOFT_TIME_LIMIT_MS = 14 * 60 * 1000;
const MAX_PER_CATEGORY_PER_TIER = 7;

const PRICE_TIERS = [
  { key: 'under_25', label: 'Under $25', min: 0.01, max: 24.99, supplierMin: 0.20, supplierMax: 18 },
  { key: '25_49', label: '$25-$49.99', min: 25, max: 49.99, supplierMin: 3, supplierMax: 35 },
  { key: '50_99', label: '$50-$99.99', min: 50, max: 99.99, supplierMin: 10, supplierMax: 75 },
  { key: '100_249', label: '$100-$249.99', min: 100, max: 249.99, supplierMin: 25, supplierMax: 190 },
  { key: '250_499', label: '$250-$499.99', min: 250, max: 499.99, supplierMin: 70, supplierMax: 425 },
] as const;

type Tier = (typeof PRICE_TIERS)[number];
type CatalogSnapshot = {
  total: number;
  tierCounts: Record<string, number>;
  categoryCounts: Record<string, Record<string, number>>;
};

type TierPages = Record<string, number>;

const text = (value: unknown) => String(value ?? '').trim();
const money = (value: unknown) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

const firstString = (...values: unknown[]) => {
  for (const value of values) {
    const normalized = text(value);
    if (normalized) return normalized;
  }
  return '';
};

const firstArray = (...values: unknown[]): any[] => {
  for (const value of values) {
    if (Array.isArray(value) && value.length) return value;
  }
  return [];
};

function defaultTierPages(): TierPages {
  return Object.fromEntries(PRICE_TIERS.map((tier) => [tier.key, 1]));
}

function normalizeTierPages(value: any): TierPages {
  const defaults = defaultTierPages();
  for (const tier of PRICE_TIERS) {
    const parsed = Math.floor(Number(value?.[tier.key] || 1));
    defaults[tier.key] = Number.isFinite(parsed) && parsed >= 1 && parsed <= MAX_RESULT_PAGE ? parsed : 1;
  }
  return defaults;
}

function extractProductRows(payload: any): any[] {
  const data = payload?.data ?? payload;
  const direct = firstArray(data, data?.list, data?.content, data?.records, data?.rows, data?.productList);
  if (direct.length) return direct;
  if (Array.isArray(data?.content)) {
    return data.content.flatMap((entry: any) => Array.isArray(entry?.productList) ? entry.productList : []);
  }
  return [];
}

function extractUrlValues(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap(extractUrlValues);
  if (typeof value === 'string') {
    const raw = value.trim();
    if (!raw) return [];
    if ((raw.startsWith('[') && raw.endsWith(']')) || (raw.startsWith('{') && raw.endsWith('}'))) {
      try { return extractUrlValues(JSON.parse(raw)); } catch { /* retain raw */ }
    }
    return raw.includes(',') ? raw.split(',').map((part) => part.trim()).filter(Boolean) : [raw];
  }
  if (typeof value === 'object') {
    const row = value as any;
    return extractUrlValues(row.url || row.image || row.src || row.bigImage || row.productImage || row.variantImage);
  }
  return [];
}

function tierForPrice(value: unknown): Tier | null {
  const price = Number(value);
  if (!Number.isFinite(price) || price <= 0) return null;
  return PRICE_TIERS.find((tier) => price >= tier.min && price <= tier.max) || null;
}

function normalizeCountryCode(value: unknown): string {
  const raw = text(value).toUpperCase();
  return /^[A-Z]{2}$/.test(raw) ? raw : '';
}

function canonicalCategory(value: unknown): string {
  const raw = text(value).toLowerCase();
  if (!raw) return 'Other';
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

function productText(row: any, detail?: any): string {
  return [
    row?.nameEn, row?.productNameEn, row?.productName, row?.name,
    row?.categoryName, row?.threeCategoryName, row?.twoCategoryName, row?.oneCategoryName,
    detail?.productNameEn, detail?.categoryName, detail?.brandName,
  ].map(text).filter(Boolean).join(' ').toLowerCase();
}

const BLOCKED_TERMS = [
  'cbd', 'cannabis', 'marijuana', 'nicotine', 'vape', 'tobacco',
  'supplement', 'weight loss', 'slimming', 'prescription', 'medicine', 'medical device',
  'pesticide', 'insecticide', 'firearm', 'rifle', 'pistol', 'switchblade', 'taser',
  'sex toy', 'adult toy', 'vibrator', 'dildo',
  'nike', 'adidas', 'gucci', 'louis vuitton', 'chanel', 'disney', 'marvel', 'pokemon', 'lego',
];

function isBlockedProduct(row: any, detail?: any): boolean {
  const haystack = productText(row, detail);
  return BLOCKED_TERMS.some((term) => haystack.includes(term));
}

function imageCandidates(product: any, detail: any): string[] {
  const variants = Array.isArray(detail?.variants) ? detail.variants : [];
  const candidates = [
    ...extractUrlValues(product?.productImage),
    ...extractUrlValues(product?.bigImage),
    ...extractUrlValues(product?.productImageSet),
    ...extractUrlValues(product?.productImageList),
    ...extractUrlValues(product?.images),
    ...extractUrlValues(detail?.productImage),
    ...extractUrlValues(detail?.bigImage),
    ...extractUrlValues(detail?.productImageSet),
    ...extractUrlValues(detail?.productImageList),
    ...extractUrlValues(detail?.images),
    ...variants.flatMap((variant: any) => [
      ...extractUrlValues(variant?.variantImage),
      ...extractUrlValues(variant?.variantImageUrl),
      ...extractUrlValues(variant?.variantBigImage),
      ...extractUrlValues(variant?.images),
    ]),
  ];
  return Array.from(new Set(candidates.map(text).filter((url) => /^https:\/\//i.test(url))));
}

function scoreListRow(row: any): number {
  const listed = Number(row?.listedNum || 0);
  const inventory = Number(row?.totalVerifiedInventory || row?.warehouseInventoryNum || 0);
  const video = row?.hasVideo || row?.isVideo || row?.isVedio ? 80 : 0;
  const image = firstString(row?.productImage, row?.bigImage) ? 35 : 0;
  const category = canonicalCategory(firstString(row?.categoryName, row?.threeCategoryName, row?.twoCategoryName, row?.oneCategoryName));
  const demandCategoryBonus = category === 'Other' || category === 'Fashion & Accessories' ? 0 : 35;
  return Math.min(260, listed / 4) + Math.min(180, inventory / 15) + video + image + demandCategoryBonus;
}

function pricingForLandedCost(landedCost: number) {
  if (landedCost <= 8) return { markup: 4, affiliate: 2 };
  if (landedCost <= 18) return { markup: 6, affiliate: 3 };
  if (landedCost <= 40) return { markup: 10, affiliate: 5 };
  if (landedCost <= 90) return { markup: 18, affiliate: 8 };
  if (landedCost <= 180) return { markup: 30, affiliate: 12 };
  return { markup: 50, affiliate: 20 };
}

async function acquireSeedLock(supabase: any) {
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

async function releaseSeedLock(
  supabase: any,
  result: Record<string, unknown>,
  snapshot: CatalogSnapshot | undefined,
  tierPages: TierPages,
) {
  const nowIso = new Date().toISOString();
  const complete = snapshot ? PRICE_TIERS.every((tier) => Number(snapshot.tierCounts[tier.key] || 0) >= TIER_TARGET) : false;
  await supabase.from('cj_seed_state').update({
    locked_until: null,
    last_result: result,
    tier_counts: snapshot?.tierCounts || {},
    tier_pages: tierPages,
    completed_at: complete ? nowIso : null,
    updated_at: nowIso,
  }).eq('id', 1);
}

async function catalogSnapshot(supabase: any): Promise<CatalogSnapshot> {
  const { data, error } = await supabase
    .from('products')
    .select('calculated_customer_price,price,category')
    .eq('source_platform', 'cj')
    .eq('verification_status', 'verified')
    .eq('is_active', true)
    .eq('is_promotable', true)
    .limit(5000);
  if (error) throw new Error(`Verified CJ catalog lookup failed: ${error.message}`);

  const tierCounts: Record<string, number> = Object.fromEntries(PRICE_TIERS.map((tier) => [tier.key, 0]));
  const categoryCounts: Record<string, Record<string, number>> = Object.fromEntries(PRICE_TIERS.map((tier) => [tier.key, {}]));
  for (const row of (data || []) as any[]) {
    const tier = tierForPrice(row?.calculated_customer_price || row?.price);
    if (!tier) continue;
    tierCounts[tier.key] = Number(tierCounts[tier.key] || 0) + 1;
    const category = canonicalCategory(row?.category);
    categoryCounts[tier.key][category] = Number(categoryCounts[tier.key][category] || 0) + 1;
  }
  return { total: Object.values(tierCounts).reduce((sum, value) => sum + value, 0), tierCounts, categoryCounts };
}

async function existingCjIds(supabase: any): Promise<Set<string>> {
  const { data, error } = await supabase.from('products').select('cj_product_id,cj_pid').eq('source_platform', 'cj').limit(5000);
  if (error) throw new Error(`Existing CJ product lookup failed: ${error.message}`);
  return new Set((data || []).flatMap((row: any) => [text(row?.cj_product_id), text(row?.cj_pid)]).filter(Boolean));
}

async function loadCandidateRows(tier: Tier, page: number): Promise<any[]> {
  const response: any = await cjRequest('product/listV2', {
    page,
    size: PAGE_SIZE,
    startSellPrice: tier.supplierMin,
    endSellPrice: tier.supplierMax,
    startWarehouseInventory: 1,
    verifiedWarehouse: 1,
    orderBy: 1,
    sort: 'desc',
    features: 'enable_category',
  }, 'GET');

  const seen = new Set<string>();
  return extractProductRows(response)
    .filter((row) => {
      const pid = firstString(row?.pid, row?.id, row?.productId, row?.product_id);
      if (!pid || seen.has(pid) || isBlockedProduct(row)) return false;
      seen.add(pid);
      return true;
    })
    .sort((a, b) => scoreListRow(b) - scoreListRow(a));
}

async function verifyVariantsInStock(pid: string, variants: any[]) {
  for (const variant of variants) {
    const vid = text(variant?.vid);
    if (!vid) throw new Error('Variant missing exact CJ VID.');
    const inventory = await getCJInventory(pid, vid);
    if (inventory === null || inventory <= 0) {
      throw new Error(`Variant ${vid} is not currently verified as in stock.`);
    }
  }
}

async function getFreightForVariants(detail: any, variants: any[]) {
  const hintedOrigin = normalizeCountryCode(detail?.originCountryCode || detail?.originCountry || detail?.countryCode || detail?.shipFrom);
  const originCandidates = Array.from(new Set([hintedOrigin, 'US', 'CN'].filter(Boolean)));
  const quotes: any[] = [];

  for (const variant of variants) {
    const vid = text(variant?.vid);
    if (!vid) throw new Error('Variant missing exact CJ VID.');
    let selected: any = null;
    let lastError: unknown = null;
    for (const originCountryCode of originCandidates) {
      try {
        const freight = await getCJFreightQuote({
          originCountryCode,
          destinationCountryCode: 'US',
          destinationZip: '10001',
          items: [{ vid, quantity: 1 }],
        });
        const option = freight.options[0];
        if (!option) continue;
        selected = {
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
      } catch (error) { lastError = error; }
    }
    if (!selected) throw new Error(`No live US freight quote for VID ${vid}: ${lastError instanceof Error ? lastError.message : 'quote failed'}`);
    quotes.push(selected);
  }
  return quotes;
}

async function importViaSupabase(params: {
  serviceRoleKey: string;
  supabaseUrl: string;
  cjProduct: any;
  detail: any;
  variants: any[];
  inventory: number | null;
  freightQuotes: any[];
  videos: string[];
  markup: number;
  affiliate: number;
  finalPrice: number;
  sellerAsk: number;
}) {
  const response = await fetch(`${params.supabaseUrl.replace(/\/$/, '')}/functions/v1/import-cj-product`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: params.serviceRoleKey,
      Authorization: `Bearer ${params.serviceRoleKey}`,
      'X-Beezio-Internal-Import': 'supplyline-plus',
    },
    body: JSON.stringify({
      cjProduct: params.cjProduct,
      detailedProduct: params.detail,
      selectedVariant: params.variants[0] || null,
      variants: params.variants,
      inventory: params.inventory,
      pricing: {
        markup: params.markup,
        markupType: 'flat',
        affiliateCommission: params.affiliate,
        affiliateCommissionType: 'flat',
      },
      shippingCost: Math.max(...params.freightQuotes.map((quote) => Number(quote.totalPostageFee || 0))),
      variantFreightQuotes: params.freightQuotes,
      videos: params.videos,
      beezioCategory: firstString(params.detail?.categoryName, params.cjProduct?.categoryName, 'Other'),
      categoryId: null,
      computed: { finalPrice: params.finalPrice, sellerAsk: params.sellerAsk },
    }),
  });
  const raw = await response.text();
  let payload: any = null;
  try { payload = raw ? JSON.parse(raw) : null; } catch { payload = null; }
  if (!response.ok) throw new Error(payload?.details || payload?.error || raw || `import-cj-product failed (${response.status})`);
  return payload;
}

export const handler: Handler = async (event) => {
  const startedAtMs = Date.now();
  const serviceRoleKey = text(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const suppliedToken = text(event.headers.authorization || event.headers.Authorization).replace(/^Bearer\s+/i, '');
  const supabaseUrl = text(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL);
  if (!serviceRoleKey || !supabaseUrl || suppliedToken !== serviceRoleKey) return { statusCode: 403, body: '' };

  const supabase = createSupabaseAdmin();
  let lockAcquired = false;
  let tierPages = defaultTierPages();
  let snapshot: CatalogSnapshot | undefined;
  const runResult: Record<string, any> = {
    target_count: TARGET_COUNT,
    tier_target_count: TIER_TARGET,
    imported: [],
    skipped: [],
    failed: [],
    started_at: new Date().toISOString(),
  };

  try {
    const lock = await acquireSeedLock(supabase);
    if (!lock) return { statusCode: 202, body: '' };
    lockAcquired = true;
    tierPages = normalizeTierPages(lock?.tier_pages);

    snapshot = await catalogSnapshot(supabase);
    runResult.tier_counts_before = snapshot.tierCounts;
    runResult.tier_pages_before = { ...tierPages };
    if (PRICE_TIERS.every((tier) => snapshot!.tierCounts[tier.key] >= TIER_TARGET)) {
      runResult.status = 'complete';
      runResult.verified_count_after = snapshot.total;
      await releaseSeedLock(supabase, runResult, snapshot, tierPages);
      return { statusCode: 202, body: '' };
    }

    const existingIds = await existingCjIds(supabase);
    const targetTier = [...PRICE_TIERS]
      .filter((tier) => Number(snapshot!.tierCounts[tier.key] || 0) < TIER_TARGET)
      .sort((a, b) => Number(snapshot!.tierCounts[a.key] || 0) - Number(snapshot!.tierCounts[b.key] || 0))[0];

    if (!targetTier) throw new Error('No incomplete price tier could be selected.');
    const searchPage = Math.max(1, Math.min(MAX_RESULT_PAGE, Number(tierPages[targetTier.key] || 1)));
    const candidates = await loadCandidateRows(targetTier, searchPage);
    tierPages[targetTier.key] = searchPage >= MAX_RESULT_PAGE ? 1 : searchPage + 1;
    runResult.searched_tier = targetTier.key;
    runResult.searched_page = searchPage;
    runResult.candidates_returned = candidates.length;

    let importedThisRun = 0;
    let attemptedCandidates = 0;

    for (const candidate of candidates) {
      if (importedThisRun >= MAX_NEW_PER_RUN || attemptedCandidates >= MAX_CANDIDATE_ATTEMPTS) break;
      if (Date.now() - startedAtMs >= SOFT_TIME_LIMIT_MS) break;
      const pid = firstString(candidate?.pid, candidate?.id, candidate?.productId, candidate?.product_id);
      if (!pid || existingIds.has(pid)) continue;
      attemptedCandidates += 1;

      try {
        const detail = await getCJProductDetail({ pid });
        if (isBlockedProduct(candidate, detail)) {
          runResult.skipped.push({ pid, reason: 'blocked product/category/brand term' });
          continue;
        }

        const variants = Array.isArray(detail?.variants) ? detail.variants : [];
        if (!variants.length || variants.length > MAX_VARIANTS_PER_PRODUCT) {
          runResult.skipped.push({ pid, reason: !variants.length ? 'no exact VID variants' : `too many variants (${variants.length})` });
          continue;
        }
        const images = imageCandidates(candidate, detail);
        if (images.length < 2) {
          runResult.skipped.push({ pid, reason: 'insufficient promotional images' });
          continue;
        }

        const variantCosts = variants.map((variant: any) => Number(variant?.variantSellPrice || 0));
        if (variantCosts.some((cost: number) => !Number.isFinite(cost) || cost <= 0)) {
          runResult.skipped.push({ pid, reason: 'invalid supplier price on one or more variants' });
          continue;
        }

        await verifyVariantsInStock(pid, variants);
        const freightQuotes = await getFreightForVariants(detail, variants);
        const maxSupplierCost = Math.max(...variantCosts);
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
        if (!actualTier || Number(snapshot.tierCounts[actualTier.key] || 0) >= TIER_TARGET) {
          runResult.skipped.push({ pid, reason: `landed Beezio price did not fit an incomplete target tier (${finalPricing.finalAdvertisedPrice.toFixed(2)})` });
          continue;
        }

        const category = canonicalCategory(firstString(detail?.categoryName, candidate?.categoryName, candidate?.threeCategoryName, candidate?.twoCategoryName));
        if (Number(snapshot.categoryCounts[actualTier.key]?.[category] || 0) >= MAX_PER_CATEGORY_PER_TIER) {
          runResult.skipped.push({ pid, reason: `category quota full (${category})` });
          continue;
        }

        const shippingRatioLimit = finalPricing.finalAdvertisedPrice < 50 ? 0.55 : 0.45;
        if (maxShipping > finalPricing.finalAdvertisedPrice * shippingRatioLimit) {
          runResult.skipped.push({ pid, price_tier: actualTier.key, reason: `shipping too high (${money(maxShipping).toFixed(2)})` });
          continue;
        }

        let videos: string[] = [];
        try {
          const assets = await getCJProductVideos(pid);
          videos = assets.map((asset) => text(asset.videoUrl)).filter(Boolean);
        } catch { videos = []; }

        let inventory: number | null = null;
        try { inventory = await getCJInventory(pid); } catch { inventory = null; }

        const cjProduct = {
          pid,
          productNameEn: firstString(detail?.productNameEn, candidate?.productNameEn, candidate?.nameEn, candidate?.name),
          productSku: firstString(detail?.productSku, candidate?.productSku, candidate?.sku),
          productImage: firstString(detail?.productImage, detail?.bigImage, images[0]),
          categoryName: firstString(detail?.categoryName, candidate?.categoryName, category),
          sellPrice: Number(detail?.sellPrice || candidate?.sellPrice || maxSupplierCost),
        };
        if (!cjProduct.productNameEn || !cjProduct.productSku || !cjProduct.productImage) {
          runResult.skipped.push({ pid, reason: 'missing product title, SKU, or image' });
          continue;
        }

        const result = await importViaSupabase({
          serviceRoleKey,
          supabaseUrl,
          cjProduct,
          detail,
          variants,
          inventory,
          freightQuotes,
          videos,
          markup: pricing.markup,
          affiliate: pricing.affiliate,
          finalPrice: finalPricing.finalAdvertisedPrice,
          sellerAsk: money(maxSupplierCost + pricing.markup),
        });

        const productId = text(result?.product?.id);
        if (!productId) throw new Error('Importer returned no Beezio product id.');
        const { data: saved, error: savedError } = await supabase
          .from('products')
          .select('id,title,category,calculated_customer_price,verification_status,is_active,is_promotable,status')
          .eq('id', productId)
          .single();
        if (savedError) throw savedError;
        if (text(saved?.verification_status) !== 'verified' || saved?.is_active !== true || saved?.is_promotable !== true) {
          throw new Error(`Database triple-check did not certify product (${text(saved?.verification_status) || 'unknown'}).`);
        }

        try { await subscribeCJProducts([pid]); } catch { /* reconciliation repairs this */ }
        existingIds.add(pid);
        importedThisRun += 1;
        snapshot.tierCounts[actualTier.key] = Number(snapshot.tierCounts[actualTier.key] || 0) + 1;
        snapshot.total += 1;
        snapshot.categoryCounts[actualTier.key][category] = Number(snapshot.categoryCounts[actualTier.key][category] || 0) + 1;
        runResult.imported.push({
          pid,
          product_id: productId,
          title: text(saved?.title),
          category,
          price_tier: actualTier.key,
          searched_tier: targetTier.key,
          searched_page: searchPage,
          variants: variants.length,
          max_supplier_cost: money(maxSupplierCost),
          max_shipping: money(maxShipping),
          seller_markup: pricing.markup,
          affiliate_payout: pricing.affiliate,
          advertised_price: Number(saved?.calculated_customer_price || finalPricing.finalAdvertisedPrice),
          verification_status: saved?.verification_status,
        });
      } catch (error) {
        runResult.failed.push({ pid, searched_tier: targetTier.key, searched_page: searchPage, error: error instanceof Error ? error.message : String(error) });
      }
    }

    snapshot = await catalogSnapshot(supabase);
    runResult.attempted_candidates = attemptedCandidates;
    runResult.tier_counts_after = snapshot.tierCounts;
    runResult.tier_pages_after = tierPages;
    runResult.verified_count_after = snapshot.total;
    runResult.status = PRICE_TIERS.every((tier) => snapshot!.tierCounts[tier.key] >= TIER_TARGET) ? 'complete' : 'in_progress';
    runResult.finished_at = new Date().toISOString();
    await releaseSeedLock(supabase, runResult, snapshot, tierPages);
    lockAcquired = false;
    return { statusCode: 202, body: '' };
  } catch (error) {
    runResult.status = 'error';
    runResult.error = error instanceof Error ? error.message : String(error);
    runResult.finished_at = new Date().toISOString();
    try {
      snapshot = snapshot || await catalogSnapshot(supabase);
      runResult.tier_counts_after = snapshot.tierCounts;
      runResult.tier_pages_after = tierPages;
      runResult.verified_count_after = snapshot.total;
      if (lockAcquired) await releaseSeedLock(supabase, runResult, snapshot, tierPages);
    } catch { /* lock expires automatically */ }
    return { statusCode: 202, body: '' };
  }
};

export default handler;
