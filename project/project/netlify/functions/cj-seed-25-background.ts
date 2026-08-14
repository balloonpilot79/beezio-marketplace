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

const TARGET_COUNT = 25;
const MAX_NEW_PER_RUN = 4;
const MAX_VARIANTS_PER_PRODUCT = 8;
const MAX_SCAN_PAGES = 5;
const PAGE_SIZE = 50;
const MAX_FINAL_PRICE = 79.99;
const LOCK_MINUTES = 14;
const SOFT_TIME_LIMIT_MS = 12 * 60 * 1000;

const text = (value: unknown) => String(value ?? '').trim();
const money = (value: unknown) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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

function extractProductRows(payload: any): any[] {
  const data = payload?.data ?? payload;
  const direct = firstArray(data, data?.list, data?.content, data?.records, data?.rows, data?.productList);
  if (direct.length) return direct;
  if (Array.isArray(data?.content)) {
    return data.content.flatMap((entry: any) => Array.isArray(entry?.productList) ? entry.productList : []);
  }
  return [];
}

function normalizeCountryCode(value: unknown): string {
  const raw = text(value).toUpperCase();
  return /^[A-Z]{2}$/.test(raw) ? raw : '';
}

function imageCandidates(product: any, detail: any): string[] {
  const variants = Array.isArray(detail?.variants) ? detail.variants : [];
  const candidates = [
    product?.productImage,
    product?.bigImage,
    detail?.productImage,
    detail?.bigImage,
    ...(Array.isArray(detail?.productImageList) ? detail.productImageList : []),
    ...(Array.isArray(detail?.images) ? detail.images : []),
    ...variants.map((variant: any) => variant?.variantImage || variant?.variantImageUrl || variant?.variantBigImage),
  ];
  return Array.from(new Set(candidates.map(text).filter(Boolean)));
}

function scoreListRow(row: any): number {
  const listed = Number(row?.listedNum || 0);
  const inventory = Number(row?.totalVerifiedInventory || row?.warehouseInventoryNum || 0);
  const price = Number(row?.sellPrice || row?.price || 0);
  const video = row?.hasVideo || row?.isVideo || row?.isVedio ? 60 : 0;
  const image = firstString(row?.productImage, row?.bigImage) ? 30 : 0;
  return Math.min(200, listed / 5) + Math.min(150, inventory / 20) + video + image + Math.max(0, 100 - Math.max(0, price) * 3);
}

function pricingForLandedCost(landedCost: number) {
  if (landedCost <= 10) return { markup: 6, affiliate: 3 };
  if (landedCost <= 20) return { markup: 9, affiliate: 4 };
  if (landedCost <= 35) return { markup: 12, affiliate: 5 };
  return { markup: 15, affiliate: 6 };
}

async function acquireSeedLock(supabase: any) {
  const now = new Date();
  const nowIso = now.toISOString();
  const lockUntil = new Date(now.getTime() + LOCK_MINUTES * 60_000).toISOString();

  await supabase.from('cj_seed_state').upsert({ id: 1, target_count: TARGET_COUNT }, { onConflict: 'id' });

  const { data, error } = await supabase
    .from('cj_seed_state')
    .update({
      locked_until: lockUntil,
      last_run_at: nowIso,
      started_at: nowIso,
      updated_at: nowIso,
    })
    .eq('id', 1)
    .or(`locked_until.is.null,locked_until.lt.${nowIso}`)
    .select('*')
    .maybeSingle();

  if (error) throw new Error(`CJ seed lock failed: ${error.message}`);
  return data || null;
}

async function releaseSeedLock(supabase: any, result: Record<string, unknown>) {
  const nowIso = new Date().toISOString();
  const verifiedCount = Number(result?.verified_count_after || 0);
  await supabase
    .from('cj_seed_state')
    .update({
      locked_until: null,
      last_result: result,
      completed_at: verifiedCount >= TARGET_COUNT ? nowIso : null,
      updated_at: nowIso,
    })
    .eq('id', 1);
}

async function countVerifiedCjProducts(supabase: any): Promise<number> {
  const { count, error } = await supabase
    .from('products')
    .select('id', { count: 'exact', head: true })
    .eq('source_platform', 'cj')
    .eq('verification_status', 'verified')
    .eq('is_active', true)
    .eq('is_promotable', true);
  if (error) throw new Error(`Verified CJ count failed: ${error.message}`);
  return Number(count || 0);
}

async function existingCjIds(supabase: any): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('products')
    .select('cj_product_id,cj_pid')
    .eq('source_platform', 'cj')
    .limit(5000);
  if (error) throw new Error(`Existing CJ product lookup failed: ${error.message}`);
  return new Set(
    (data || [])
      .flatMap((row: any) => [text(row?.cj_product_id), text(row?.cj_pid)])
      .filter(Boolean)
  );
}

async function loadCandidateRows(): Promise<any[]> {
  const rows: any[] = [];
  const seen = new Set<string>();

  for (let page = 1; page <= MAX_SCAN_PAGES; page += 1) {
    let response: any = null;
    try {
      response = await cjRequest('product/listV2', { page, size: PAGE_SIZE }, 'GET');
    } catch {
      response = await cjRequest('product/list', { pageNum: page, pageSize: PAGE_SIZE }, 'GET');
    }

    for (const row of extractProductRows(response)) {
      const pid = firstString(row?.pid, row?.id, row?.productId, row?.product_id);
      if (!pid || seen.has(pid)) continue;
      seen.add(pid);
      rows.push(row);
    }

    if (rows.length >= PAGE_SIZE * MAX_SCAN_PAGES) break;
    await sleep(250);
  }

  return rows.sort((a, b) => scoreListRow(b) - scoreListRow(a));
}

async function getFreightForVariants(detail: any, variants: any[]) {
  const hintedOrigin = normalizeCountryCode(
    detail?.originCountryCode || detail?.originCountry || detail?.countryCode || detail?.shipFrom
  );
  const originCandidates = Array.from(new Set([hintedOrigin, 'CN', 'US'].filter(Boolean)));
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
      } catch (error) {
        lastError = error;
      }
    }

    if (!selected) {
      throw new Error(`No live US freight quote for VID ${vid}: ${lastError instanceof Error ? lastError.message : 'quote failed'}`);
    }
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
  const importUrl = `${params.supabaseUrl.replace(/\/$/, '')}/functions/v1/import-cj-product`;
  const response = await fetch(importUrl, {
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
      computed: {
        finalPrice: params.finalPrice,
        sellerAsk: params.sellerAsk,
      },
    }),
  });

  const raw = await response.text();
  let payload: any = null;
  try {
    payload = raw ? JSON.parse(raw) : null;
  } catch {
    payload = null;
  }
  if (!response.ok) {
    throw new Error(payload?.details || payload?.error || raw || `import-cj-product failed (${response.status})`);
  }
  return payload;
}

export const handler: Handler = async (event) => {
  const startedAtMs = Date.now();
  const serviceRoleKey = text(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const suppliedToken = text(event.headers.authorization || event.headers.Authorization).replace(/^Bearer\s+/i, '');
  const supabaseUrl = text(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL);

  if (!serviceRoleKey || !supabaseUrl || suppliedToken !== serviceRoleKey) {
    return { statusCode: 403, body: '' };
  }

  const supabase = createSupabaseAdmin();
  let lockAcquired = false;
  const runResult: Record<string, any> = {
    target_count: TARGET_COUNT,
    imported: [],
    skipped: [],
    failed: [],
    started_at: new Date().toISOString(),
  };

  try {
    const lock = await acquireSeedLock(supabase);
    if (!lock) return { statusCode: 202, body: '' };
    lockAcquired = true;

    const verifiedBefore = await countVerifiedCjProducts(supabase);
    runResult.verified_count_before = verifiedBefore;
    if (verifiedBefore >= TARGET_COUNT) {
      runResult.verified_count_after = verifiedBefore;
      runResult.status = 'complete';
      await releaseSeedLock(supabase, runResult);
      lockAcquired = false;
      return { statusCode: 202, body: '' };
    }

    const existingIds = await existingCjIds(supabase);
    const candidates = await loadCandidateRows();
    let importedThisRun = 0;

    for (const candidate of candidates) {
      if (importedThisRun >= MAX_NEW_PER_RUN) break;
      if (Date.now() - startedAtMs >= SOFT_TIME_LIMIT_MS) break;

      const pid = firstString(candidate?.pid, candidate?.id, candidate?.productId, candidate?.product_id);
      if (!pid || existingIds.has(pid)) continue;

      try {
        const detail = await getCJProductDetail({ pid });
        const variants = Array.isArray(detail?.variants) ? detail.variants : [];
        if (!variants.length) {
          runResult.skipped.push({ pid, reason: 'no exact VID variants' });
          continue;
        }
        if (variants.length > MAX_VARIANTS_PER_PRODUCT) {
          runResult.skipped.push({ pid, reason: `too many variants for first verified batch (${variants.length})` });
          continue;
        }
        if (imageCandidates(candidate, detail).length < 2) {
          runResult.skipped.push({ pid, reason: 'insufficient promotional images' });
          continue;
        }

        const variantCosts = variants.map((variant: any) => Number(variant?.variantSellPrice || 0));
        if (variantCosts.some((cost: number) => !Number.isFinite(cost) || cost <= 0)) {
          runResult.skipped.push({ pid, reason: 'invalid variant supplier price' });
          continue;
        }

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

        if (finalPricing.finalAdvertisedPrice > MAX_FINAL_PRICE) {
          runResult.skipped.push({
            pid,
            reason: `first-batch price too high (${finalPricing.finalAdvertisedPrice.toFixed(2)})`,
          });
          continue;
        }

        let videos: string[] = [];
        try {
          const assets = await getCJProductVideos(pid);
          videos = assets.map((asset) => text(asset.videoUrl)).filter(Boolean);
        } catch {
          videos = [];
        }

        let inventory: number | null = null;
        try {
          inventory = await getCJInventory(pid);
        } catch {
          inventory = null;
        }

        const cjProduct = {
          pid,
          productNameEn: firstString(detail?.productNameEn, candidate?.productNameEn, candidate?.nameEn, candidate?.name),
          productSku: firstString(detail?.productSku, candidate?.productSku, candidate?.sku),
          productImage: firstString(detail?.productImage, detail?.bigImage, candidate?.productImage, candidate?.bigImage),
          categoryName: firstString(detail?.categoryName, candidate?.categoryName, 'Other'),
          sellPrice: Number(detail?.sellPrice || candidate?.sellPrice || maxSupplierCost),
        };

        if (!cjProduct.productNameEn || !cjProduct.productSku || !cjProduct.productImage) {
          runResult.skipped.push({ pid, reason: 'missing product identity/media' });
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
          .select('id,title,verification_status,is_active,is_promotable,status')
          .eq('id', productId)
          .single();
        if (savedError) throw savedError;
        if (text(saved?.verification_status) !== 'verified' || saved?.is_active !== true || saved?.is_promotable !== true) {
          throw new Error(`Database triple-check did not certify product (${text(saved?.verification_status) || 'unknown'}).`);
        }

        try {
          await subscribeCJProducts([pid]);
        } catch {
          // Verification is more important than webhook subscription; reconciliation can repair later.
        }

        existingIds.add(pid);
        importedThisRun += 1;
        runResult.imported.push({
          pid,
          product_id: productId,
          title: text(saved?.title),
          variants: variants.length,
          max_supplier_cost: money(maxSupplierCost),
          max_shipping: money(maxShipping),
          seller_markup: pricing.markup,
          affiliate_payout: pricing.affiliate,
          advertised_price: finalPricing.finalAdvertisedPrice,
          verification_status: saved?.verification_status,
        });
      } catch (error) {
        runResult.failed.push({
          pid,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const verifiedAfter = await countVerifiedCjProducts(supabase);
    runResult.verified_count_after = verifiedAfter;
    runResult.status = verifiedAfter >= TARGET_COUNT ? 'complete' : 'in_progress';
    runResult.finished_at = new Date().toISOString();
    await releaseSeedLock(supabase, runResult);
    lockAcquired = false;
    return { statusCode: 202, body: '' };
  } catch (error) {
    runResult.status = 'error';
    runResult.error = error instanceof Error ? error.message : String(error);
    runResult.finished_at = new Date().toISOString();
    try {
      runResult.verified_count_after = await countVerifiedCjProducts(supabase);
    } catch {
      // ignore secondary count failure
    }
    if (lockAcquired) {
      try {
        await releaseSeedLock(supabase, runResult);
        lockAcquired = false;
      } catch {
        // lock expires automatically
      }
    }
    return { statusCode: 202, body: '' };
  }
};
