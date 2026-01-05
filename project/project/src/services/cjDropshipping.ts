// CJ Dropshipping API Integration Service
// Handles product import, order creation, and tracking synchronization

import { calculateFinalPrice, computePayoutBreakdown } from '../utils/pricingEngine';
import { DEFAULT_FUNDRAISER_PERCENT, PLATFORM_FEE_PERCENT } from '../config/beezioConfig';

// Beezio: CJ Variants + Shipping extension (do not remove)
// IMPORTANT: Never call CJ directly from the browser or expose CJ API keys via VITE_ env vars.
// All CJ calls must go through server-side proxies (Netlify Functions) to avoid leaking credentials and to prevent CORS issues.

interface CJApiResponse<T> {
  code: number;
  result: boolean;
  message: string;
  data: T;
}

interface CJProduct {
  pid: string;
  productNameEn: string;
  productNameCn?: string;
  productSku: string;
  productImage: string;
  productImageList?: string[];
  categoryId: string;
  categoryName: string;
  sellPrice: number;
  variants?: CJVariant[];
  description?: string;
  productWeight?: number;
  packingWeight?: number;
  productType?: string;
}

interface CJVariant {
  vid: string;
  variantSku: string;
  variantNameEn: string;
  variantImage?: string;
  variantSellPrice: number;
  variantStock: number;
}

const toNonNegativeNumber = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  const raw = typeof value === 'string' ? value.trim() : value;
  const num = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(num) || num < 0) return null;
  return num;
};

const normalizeImageList = (images: unknown[]): string[] => {
  const out: string[] = [];
  const seen = new Set<string>();

  for (const img of images || []) {
    const url = String(img ?? '').trim();
    if (!url) continue;
    if (seen.has(url)) continue;
    seen.add(url);
    out.push(url);
  }

  return out;
};

const extractImageUrls = (value: unknown): string[] => {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((v) => String(v ?? '').trim()).filter(Boolean);
  if (typeof value === 'string') {
    const raw = value.trim();
    if (!raw) return [];
    if (raw.includes(',')) return raw.split(',').map((v) => v.trim()).filter(Boolean);
    return [raw];
  }
  if (typeof value === 'object') {
    const url = (value as any)?.url ?? (value as any)?.image ?? (value as any)?.src;
    return url ? [String(url).trim()].filter(Boolean) : [];
  }
  return [];
};

const buildCjImagesFromDetail = (detail: any, fallbackSingleImage?: string): string[] => {
  const main = String(detail?.productImage ?? detail?.bigImage ?? fallbackSingleImage ?? '').trim();

  const productListImages = normalizeImageList([
    ...extractImageUrls(detail?.productImageList),
    ...extractImageUrls(detail?.images),
    ...extractImageUrls(detail?.imageList),
    ...extractImageUrls(detail?.productImages),
  ]);

  const variants = Array.isArray(detail?.variants)
    ? detail.variants
    : Array.isArray(detail?.variantList)
      ? detail.variantList
      : Array.isArray(detail?.variantsList)
        ? detail.variantsList
        : Array.isArray(detail?.productVariantList)
          ? detail.productVariantList
          : Array.isArray(detail?.variantVos)
            ? detail.variantVos
            : [];

  const variantImages = Array.isArray(variants)
    ? variants
        .flatMap((v: any) => {
          const single = String(
            v?.variantImage ??
              v?.variantBigImage ??
              v?.variantImageUrl ??
              v?.image ??
              v?.bigImage ??
              v?.variantImg ??
              ''
          ).trim();

          return [
            ...extractImageUrls(v?.variantImageList),
            ...extractImageUrls(v?.imageList),
            ...extractImageUrls(v?.images),
            ...(single ? [single] : []),
          ];
        })
        .filter(Boolean as any)
    : [];

  return normalizeImageList([main, ...productListImages, ...(variantImages || [])]);
};

function parseCJPriceToUSD(value: unknown): number {
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value <= 0) return 0;
    // Heuristic: CJ sometimes returns integer cents-like values (e.g. 1299 for $12.99)
    if (Number.isInteger(value) && value >= 1000 && value <= 1000000) {
      return Math.round((value / 100 + Number.EPSILON) * 100) / 100;
    }
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  const raw = String(value ?? '').trim();
  if (!raw) return 0;

  // CJ can return ranges like "12.99--19.99" or currency-prefixed strings.
  const firstPart = raw.split('--')[0]?.trim() ?? raw;
  const numericMatch = firstPart.match(/-?\d+(?:\.\d+)?/);
  if (!numericMatch) return 0;

  const parsed = Number(numericMatch[0]);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;

  // If there was no decimal in the original token and it's large, treat as cents.
  const hadDecimal = numericMatch[0].includes('.');
  if (!hadDecimal && Number.isInteger(parsed) && parsed >= 1000 && parsed <= 1000000) {
    return Math.round((parsed / 100 + Number.EPSILON) * 100) / 100;
  }

  return Math.round((parsed + Number.EPSILON) * 100) / 100;
}

interface CJOrder {
  orderNumber: string;
  products: Array<{
    pid: string;
    vid?: string;
    quantity: number;
  }>;
  shippingAddress: {
    firstName: string;
    lastName: string;
    address: string;
    address2?: string;
    city: string;
    state: string;
    zip: string;
    country: string;
    phone: string;
    email: string;
  };
  logisticName?: string;
}

interface CJOrderResponse {
  orderNumber: string;
  cjOrderId: string;
  totalAmount: number;
  status: string;
}

interface CJTrackingInfo {
  orderNumber: string;
  cjOrderId: string;
  trackingNumber: string;
  logisticName: string;
  trackingUrl: string;
  status: string;
}

/**
 * Make authenticated request to CJ API via Netlify proxy to avoid CORS
 */
async function cjRequest<T>(endpoint: string, data?: any, method: 'GET' | 'POST' = 'POST'): Promise<CJApiResponse<T>> {
  const controller = new AbortController();
  const timeoutMs = 25000;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  // Use Netlify function proxy to avoid CORS issues
  let response: Response;
  try {
    response = await fetch('/.netlify/functions/cj-proxy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        endpoint,
        body: data,
        method  // Pass HTTP method to proxy
      }),
      signal: controller.signal,
    });
  } catch (e: any) {
    if (e?.name === 'AbortError') {
      throw new Error(`CJ API request timed out after ${timeoutMs / 1000}s (${endpoint})`);
    }
    throw e;
  } finally {
    clearTimeout(timeoutId);
  }
  
  if (!response.ok) {
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      const hint = retryAfter ? ` Retry after ~${retryAfter}s.` : '';
      const raw = await response.text();
      try {
        const errorJson = JSON.parse(raw);
        throw new Error((errorJson.error || errorJson.details || `CJ API rate limit (429).`) + hint);
      } catch {
        throw new Error(`CJ API rate limit (429).${hint}`);
      }
    }
    // Proxy should return JSON, but if the function route is missing you'll get HTML (SPA fallback).
    const raw = await response.text();
    try {
      const errorJson = JSON.parse(raw);
      throw new Error(errorJson.error || errorJson.details || `CJ API request failed: ${response.status}`);
    } catch {
      const snippet = raw?.slice(0, 120)?.replace(/\s+/g, ' ') || '';
      throw new Error(`CJ API request failed: ${response.status} ${response.statusText}. Response: ${snippet}`);
    }
  }

  const rawBody = await response.text();
  let result: any;
  try {
    result = JSON.parse(rawBody);
  } catch {
    const snippet = rawBody?.slice(0, 120)?.replace(/\s+/g, ' ') || '';
    throw new Error(`CJ API returned non-JSON response (${endpoint}). Response: ${snippet}`);
  }
  
  if (!result.result) {
    throw new Error(`CJ API error: ${result.message}`);
  }

  return result;
}

/**
 * Get product list from CJ catalog
 * @param pageNum Page number (default: 1)
 * @param pageSize Items per page (default: 50, max: 100)
 * @param categoryId Filter by category (optional)
 */
export async function getCJProducts(
  pageNum: number = 1,
  pageSize: number = 50,
  categoryId?: string
): Promise<{ products: CJProduct[]; total: number }> {
  console.log('🟡 getCJProducts called with:', { pageNum, pageSize, categoryId });
  
  const data: any = {
    page: pageNum,
    size: pageSize,
  };

  if (categoryId) {
    data.categoryId = categoryId;
  }

  // CJ API uses /product/listV2 (GET with query params)
  const response = await cjRequest<any>('product/listV2', data, 'GET');
  
  console.log('🟡 getCJProducts raw response:', response);
  
  // ListV2 returns data in nested structure: data.content[0].productList
  const content = response.data?.content?.[0] || {};
  const rawProducts = content.productList || [];
  
  // Map CJ API fields to our interface
  const products = rawProducts.map((p: any) => ({
    pid: p.id,
    productNameEn: p.nameEn,
    productSku: p.sku,
    productImage: p.bigImage,
    categoryId: p.categoryId ?? p.category_id ?? p.threeCategoryId ?? p.twoCategoryId ?? p.oneCategoryId,
    categoryName:
      p.threeCategoryName ||
      p.threeCategoryNameEn ||
      p.twoCategoryName ||
      p.twoCategoryNameEn ||
      p.oneCategoryName ||
      p.oneCategoryNameEn ||
      p.categoryName ||
      p.categoryNameEn ||
      'Uncategorized',
    sellPrice: parseCJPriceToUSD(p.sellPrice),
  }));
  
  console.log('🟡 getCJProducts parsed:', { 
    productsCount: products.length, 
    total: response.data?.totalRecords,
    firstProduct: products[0] 
  });
  
  return {
    products: products,
    total: response.data?.totalRecords || 0,
  };
}

/**
 * Get detailed product information including variants
 */
export async function getCJProductDetail(pid: string): Promise<CJProduct> {
  const response = await cjRequest<any>('product/query', { pid }, 'GET');
  const data: any = response.data;

  if (!data) return data;

  data.pid = data.pid ?? data.id ?? pid;
  data.sellPrice = parseCJPriceToUSD(data.sellPrice ?? data.sell_price ?? data.nowPrice);

  const rawVariants =
    (Array.isArray(data.variants) && data.variants) ||
    (Array.isArray(data.variantList) && data.variantList) ||
    (Array.isArray(data.variantsList) && data.variantsList) ||
    (Array.isArray(data.productVariantList) && data.productVariantList) ||
    (Array.isArray(data.variantVos) && data.variantVos) ||
    [];

  if (rawVariants.length) {
    data.variants = rawVariants
      .map((v: any) => {
        const vid = v.vid ?? v.id ?? v.variantId ?? v.variant_id ?? '';
        const variantNameEn =
          v.variantNameEn ?? v.variantName ?? v.variant_name ?? v.variantKeyEn ?? v.variantKey ?? '';
        const variantSku = v.variantSku ?? v.sku ?? v.variant_sku ?? '';

        const variantImage = String(
          v.variantImage ??
            v.variantBigImage ??
            v.variantImageUrl ??
            v.image ??
            v.bigImage ??
            v.variantImg ??
            ''
        ).trim();

        const variantStock =
          toNonNegativeNumber(v?.variantStock) ??
          toNonNegativeNumber(v?.stock) ??
          toNonNegativeNumber(v?.inventory) ??
          toNonNegativeNumber(v?.inventoryNum) ??
          toNonNegativeNumber(v?.variantInventoryNum) ??
          toNonNegativeNumber(v?.availableStock) ??
          undefined;

        return {
          vid: String(vid),
          variantSku: String(variantSku),
          variantNameEn: String(variantNameEn),
          variantImage: variantImage || undefined,
          variantSellPrice: parseCJPriceToUSD(v?.variantSellPrice ?? v?.sellPrice ?? v?.price ?? v?.variantPrice),
          variantStock,
          variantKey: v.variantKey ?? v.variantKeyEn ?? undefined,
        };
      })
      .filter((v: any) => v.vid && v.variantNameEn);
  }

  // CJ list endpoints return a single image (bigImage). CJ query returns productImage + per-variant images.
  // Add-only: enrich with a normalized multi-image list for downstream UI/DB without breaking existing single-image fields.
  {
    const images = buildCjImagesFromDetail(data, data.productImage ?? data.bigImage);
    if (images.length) {
      data.productImageList = images.slice(0, 10);
    }
  }

  return data as CJProduct;
}

/**
 * Get product categories from CJ
 */
export async function getCJCategories(): Promise<Array<{ id: string; name: string; parentId?: string }>> {
  console.log('🟡 getCJCategories called');
  
  // CJ API uses /product/getCategory (GET)
  const response = await cjRequest<any>('product/getCategory', {}, 'GET');
  
  console.log('🟡 getCJCategories raw response:', response);
  
  // CJ may return either:
  // - nested structure: [{ categoryFirstName, categoryFirstList: [{ categorySecondName, categorySecondList: [{ categoryId, categoryName }] }]}]
  // - flat structure: [{ categoryId, categoryName }]
  const categories: Array<{ id: string; name: string; parentId?: string }> = [];

  // CJ payload shape has varied over time. Normalize to an array for parsing:
  // - Array payload: [...]
  // - Object payload: { list: [...] } / { content: [...] } / { data: [...] }
  const rawData: any = response.data;
  const data = Array.isArray(rawData)
    ? rawData
    : Array.isArray(rawData?.list)
      ? rawData.list
      : Array.isArray(rawData?.content)
        ? rawData.content
        : Array.isArray(rawData?.data)
          ? rawData.data
          : [];

  if (Array.isArray(data)) {
    // Nested form
    if (data.some((x: any) => x && Array.isArray(x.categoryFirstList))) {
      data.forEach((firstLevel: any) => {
        const firstName = String(firstLevel?.categoryFirstName || '').trim();
        (firstLevel?.categoryFirstList || []).forEach((secondLevel: any) => {
          const secondName = String(secondLevel?.categorySecondName || '').trim();
          (secondLevel?.categorySecondList || []).forEach((thirdLevel: any) => {
            const id = String(thirdLevel?.categoryId || thirdLevel?.id || '').trim();
            const thirdName = String(thirdLevel?.categoryName || thirdLevel?.name || '').trim();
            if (!id || !thirdName) return;
            const parts = [firstName, secondName, thirdName].filter(Boolean);
            categories.push({
              id,
              name: parts.length ? parts.join(' / ') : thirdName,
              parentId: secondName || undefined,
            });
          });
        });
      });
    } else {
      // Flat form
      data.forEach((row: any) => {
        const id = String(row?.categoryId || row?.id || row?.category_id || '').trim();
        const name = String(row?.categoryName || row?.name || row?.categoryNameEn || row?.nameEn || '').trim();
        if (!id || !name) return;
        categories.push({ id, name });
      });
    }
  }

  const seen = new Set<string>();
  const deduped = categories.filter((c) => {
    if (!c.id || !c.name) return false;
    if (seen.has(c.id)) return false;
    seen.add(c.id);
    return true;
  });

  deduped.sort((a, b) => a.name.localeCompare(b.name));
  return deduped;
}

/**
 * Create order in CJ system after Stripe payment clears
 */
export async function createCJOrder(orderData: CJOrder): Promise<CJOrderResponse> {
  const response = await cjRequest<CJOrderResponse>('shopping/order/createOrder', orderData);
  return response.data;
}

/**
 * Get order status and tracking information
 */
export async function getCJOrderTracking(orderNumber: string): Promise<CJTrackingInfo> {
  const response = await cjRequest<CJTrackingInfo>('shopping/order/query', { orderNumber });
  return response.data;
}

/**
 * Sync inventory for a specific product
 */
export async function getCJProductInventory(pid: string, vid?: string): Promise<number> {
  const data: any = { pid };
  if (vid) {
    data.vid = vid;
  }

  const response = await cjRequest<any>('product/inventory/query', data);
  const payload: any = response?.data ?? null;

  const directCandidates = [
    payload?.stock,
    payload?.variantStock,
    payload?.availableStock,
    payload?.inventory,
    payload?.inventoryNum,
    payload?.stockNum,
    payload?.quantity,
    payload?.data?.stock,
    payload?.data?.inventory,
    payload?.data?.availableStock,
  ];

  for (const candidate of directCandidates) {
    const parsed = toNonNegativeNumber(candidate);
    if (parsed !== null) return Math.floor(parsed);
  }

  const listCandidates =
    (Array.isArray(payload?.list) && payload.list) ||
    (Array.isArray(payload?.content) && payload.content) ||
    (Array.isArray(payload?.inventoryList) && payload.inventoryList) ||
    (Array.isArray(payload?.data?.list) && payload.data.list) ||
    (Array.isArray(payload?.data?.content) && payload.data.content) ||
    [];

  if (Array.isArray(listCandidates) && listCandidates.length > 0) {
    const sum = listCandidates.reduce((acc: number, row: any) => {
      const parsed =
        toNonNegativeNumber(row?.stock) ??
        toNonNegativeNumber(row?.availableStock) ??
        toNonNegativeNumber(row?.inventory) ??
        toNonNegativeNumber(row?.inventoryNum) ??
        toNonNegativeNumber(row?.stockNum) ??
        null;
      return acc + (parsed ?? 0);
    }, 0);

    return Math.floor(sum);
  }

  return 0;
}

/**
 * Calculate total cost for Beezio including:
 * - CJ product cost
 * - Your desired markup
 * - Affiliate commission (if applicable)
 * - Recruiter commission (5% if affiliate was referred)
 * - Beezio platform fee (10%)
 * - Stripe processing fee (2.9% + $0.30)
 */
export function calculateBeezioPrice(
  cjCost: number,
  markupPercent: number = 100, // Your markup (e.g., 100% = double the cost)
  affiliateCommissionPercent: number = 20, // Affiliate gets % of the final sale price
  hasRecruiter: boolean = true // If affiliate was recruited, 5% of sale is paid to recruiter from platform fee
): {
  cjCost: number;
  yourProfit: number;
  affiliateCommission: number;
  recruiterCommission: number;
  beezioFee: number;
  beezioNet: number;
  stripeFee: number;
  finalPrice: number;
  breakdown: string;
} {
  const cleanCost = Number.isFinite(cjCost) ? cjCost : 0;
  const cleanMarkup = Number.isFinite(markupPercent) ? markupPercent : 0;
  const yourProfit = cleanCost * (cleanMarkup / 100);
  const sellerAsk = cleanCost + yourProfit;

  const payoutSettings = {
    affiliatePercent: affiliateCommissionPercent,
    platformPercent: PLATFORM_FEE_PERCENT,
    fundraiserPercent: DEFAULT_FUNDRAISER_PERCENT,
  };

  // Ask-based pricing model (matches ProductCard/ProductDetail and DB pricing).
  const finalPrice = calculateFinalPrice(sellerAsk, payoutSettings);
  const breakdownValues = computePayoutBreakdown(finalPrice, sellerAsk, payoutSettings, {
    referralOverrideEnabled: Boolean(hasRecruiter),
  });

  const affiliateCommission = breakdownValues.affiliateAmount;
  const recruiterCommission = breakdownValues.referralAffiliateAmount;
  const beezioFee = breakdownValues.platformGrossAmount;
  const beezioNet = breakdownValues.beezioNetAmount;
  const stripeFee = breakdownValues.stripePercentAmount + breakdownValues.stripeFixedFee;

  // 9. Create breakdown text
  const breakdown = `
Customer Pays: $${finalPrice.toFixed(2)}
├─ Base Cost: $${cleanCost.toFixed(2)}
├─ Your Profit: $${yourProfit.toFixed(2)} (${markupPercent}% markup)
├─ Affiliate Commission: $${affiliateCommission.toFixed(2)} (${affiliateCommissionPercent}% of seller ask)
${hasRecruiter ? `├─ Recruiter Commission: $${recruiterCommission.toFixed(2)} (5% slice of platform fee)` : ''}
├─ Beezio Fee (Gross): $${beezioFee.toFixed(2)} (platform fee derived from seller ask)
${hasRecruiter ? `├─ Beezio Fee (Net): $${beezioNet.toFixed(2)}` : ''}
└─ Stripe Fee: $${stripeFee.toFixed(2)}
`;

  return {
    cjCost: parseFloat(cleanCost.toFixed(2)),
    yourProfit: parseFloat(yourProfit.toFixed(2)),
    affiliateCommission: parseFloat(affiliateCommission.toFixed(2)),
    recruiterCommission: parseFloat(recruiterCommission.toFixed(2)),
    beezioFee: parseFloat(beezioFee.toFixed(2)),
    beezioNet: parseFloat(beezioNet.toFixed(2)),
    stripeFee: parseFloat(stripeFee.toFixed(2)),
    finalPrice: parseFloat(finalPrice.toFixed(2)),
    breakdown,
  };
}

/**
 * Map CJ category to Beezio category
 * This will need to be customized based on your category structure
 */
export function mapCJCategoryToBeezio(cjCategoryName: string): string {
  const categoryMap: Record<string, string> = {
    'Electronics': 'electronics',
    'Clothing & Accessories': 'fashion',
    'Home & Garden': 'home-garden',
    'Sports & Outdoors': 'sports-outdoors',
    'Beauty & Health': 'beauty-personal-care',
    'Toys & Games': 'toys-games',
    'Jewelry & Watches': 'fashion',
    'Bags & Shoes': 'fashion',
    // Add more mappings as needed
  };

  return categoryMap[cjCategoryName] || 'other';
}

export async function placeCJOrderFromPaidOrder(orderId: string): Promise<any> {
  const response = await fetch('/.netlify/functions/cj-fulfill-order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderId }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`CJ fulfillment failed (${response.status}): ${text}`);
  }

  return response.json();
}

export default {
  getCJProducts,
  getCJProductDetail,
  getCJCategories,
  createCJOrder,
  getCJOrderTracking,
  getCJProductInventory,
  calculateBeezioPrice,
  mapCJCategoryToBeezio,
  placeCJOrderFromPaidOrder,
};
