// CJ Dropshipping API Integration Service
// Handles product import, order creation, and tracking synchronization

import { PLATFORM_FEE_PERCENT, PROCESSING_FIXED_FEE, PROCESSING_PERCENT } from '../config/beezioConfig';

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
  brandName?: string;
  productSku: string;
  productSpu?: string;
  productImage: string;
  productImageList?: string[];
  categoryId: string;
  categoryName: string;
  sellPrice: number;
  createdAt?: string;
  variants?: CJVariant[];
  description?: string;
  productWeight?: number;
  packingWeight?: number;
  productType?: string;
  listedNum?: number;
  warehouseInventoryNum?: number;
  totalVerifiedInventory?: number;
  verifiedWarehouse?: number;
  hasVideo?: boolean;
  isFreeShipping?: boolean;
  shippingCountryCodes?: string[];
}

interface CJVariant {
  vid: string;
  variantSku: string;
  variantNameEn: string;
  variantImage?: string;
  variantSellPrice: number;
  variantStock?: number;
  variantWeight?: number;
  variantWeightOz?: number;
  weight?: number;
  weight_oz?: number;
  shippingOptions?: any[];
  [key: string]: any;
}

const toNonNegativeNumber = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  const raw = typeof value === 'string' ? value.trim() : value;
  const num = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(num) || num < 0) return null;
  return num;
};

const toWeightOz = (value: unknown): number => {
  const numeric = toNonNegativeNumber(value);
  if (numeric === null || numeric <= 0) return 0;

  if (numeric <= 32) {
    return Math.round((numeric + Number.EPSILON) * 100) / 100;
  }

  if (numeric >= 1000) {
    return Math.round((((numeric / 1000) * 35.27396195) + Number.EPSILON) * 100) / 100;
  }

  return Math.round((((numeric / 453.59237) * 16) + Number.EPSILON) * 100) / 100;
};

const extractInventoryFromRow = (row: any): number | null => {
  return (
    toNonNegativeNumber(row?.stock) ??
    toNonNegativeNumber(row?.availableStock) ??
    toNonNegativeNumber(row?.inventory) ??
    toNonNegativeNumber(row?.inventoryNum) ??
    toNonNegativeNumber(row?.variantInventoryNum) ??
    toNonNegativeNumber(row?.variantStock) ??
    toNonNegativeNumber(row?.stockNum) ??
    toNonNegativeNumber(row?.sellableStock) ??
    toNonNegativeNumber(row?.availableInventory) ??
    toNonNegativeNumber(row?.quantity) ??
    toNonNegativeNumber(row?.qty) ??
    toNonNegativeNumber(row?.variantQuantity) ??
    toNonNegativeNumber(row?.availableQuantity) ??
    toNonNegativeNumber(row?.inventoryQuantity) ??
    toNonNegativeNumber(row?.inventory_count) ??
    toNonNegativeNumber(row?.inventory?.stock) ??
    toNonNegativeNumber(row?.inventory?.availableStock) ??
    toNonNegativeNumber(row?.inventory?.inventoryNum) ??
    toNonNegativeNumber(row?.inventory?.quantity) ??
    null
  );
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

const firstNonEmptyString = (...values: unknown[]): string => {
  for (const value of values) {
    const normalized = String(value ?? '').trim();
    if (normalized) return normalized;
  }
  return '';
};

const normalizeCJProductType = (value: unknown): string => {
  const normalized = String(value || '').trim().toUpperCase();
  if (!normalized) return '';
  if (normalized === 'SUPPLIER_SHIPPED_PRODUCT') return 'SUPPLIER_PRODUCT';
  if (normalized === 'SUPPLIER_PRODUCT' || normalized === 'ORDINARY_PRODUCT') return normalized;
  return '';
};

export const extractCJIdentifierFromSearchQuery = (value: unknown): string => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (!/^https?:\/\//i.test(raw)) return raw;

  try {
    const url = new URL(raw);
    const candidates = [
      url.searchParams.get('pid'),
      url.searchParams.get('productSku'),
      url.searchParams.get('productSpu'),
      url.searchParams.get('spu'),
      url.searchParams.get('variantSku'),
      url.searchParams.get('sku'),
    ];
    for (const candidate of candidates) {
      const normalized = String(candidate || '').trim();
      if (normalized) return normalized;
    }

    const pathCandidates = [
      url.pathname.match(/-p-([a-z0-9_-]+)\.html?$/i)?.[1],
      url.pathname.match(/\/product\/([a-z0-9_-]+)$/i)?.[1],
      url.pathname.match(/\/detail\/([a-z0-9_-]+)$/i)?.[1],
    ];

    for (const candidate of pathCandidates) {
      const normalized = String(candidate || '').trim();
      if (normalized) return normalized;
    }
  } catch {
    return raw;
  }

  return raw;
};

const buildExactIdentifierSet = (row: any): Set<string> => {
  return new Set(
    [
      row?.pid,
      row?.id,
      row?.productId,
      row?.product_id,
      row?.productSku,
      row?.productSpu,
      row?.sku,
      row?.spu,
      row?.spuCode,
      row?.spuId,
      row?.variantSku,
      row?.variantCode,
      row?.variant_sku,
    ]
      .map((value) => String(value ?? '').trim())
      .filter(Boolean)
  );
};

const firstArray = (...values: unknown[]): any[] => {
  for (const value of values) {
    if (Array.isArray(value) && value.length > 0) return value;
  }
  return [];
};

const extractProductRows = (payload: any): any[] => {
  const direct = [payload, payload?.data].flatMap((source: any) => [
    ...(Array.isArray(source) ? source : []),
    ...(Array.isArray(source?.list) ? source.list : []),
    ...(Array.isArray(source?.content) ? source.content : []),
    ...(Array.isArray(source?.records) ? source.records : []),
    ...(Array.isArray(source?.rows) ? source.rows : []),
    ...(Array.isArray(source?.productList) ? source.productList : []),
  ]);

  const nested = [payload, payload?.data].flatMap((source: any) =>
    Array.isArray(source?.content)
      ? source.content.flatMap((entry: any) => (Array.isArray(entry?.productList) ? entry.productList : []))
      : []
  );

  return [...direct, ...nested].filter((row: any) => {
    if (!row || typeof row !== 'object') return false;
    return Boolean(
      row?.id ||
      row?.pid ||
      row?.productId ||
      row?.product_id ||
      row?.nameEn ||
      row?.productNameEn ||
      row?.productName
    );
  });
};

const extractDetailPayload = (payload: any, pid: string): any => {
  const direct = payload?.data ?? payload;
  if (Array.isArray(direct)) {
    return direct.find((row: any) => buildExactIdentifierSet(row).has(String(pid).trim())) ?? null;
  }
  if (Array.isArray(direct?.list)) {
    return direct.list.find((row: any) => buildExactIdentifierSet(row).has(String(pid).trim())) ?? null;
  }
  return direct;
};

const mapCJRowToProduct = (p: any): CJProduct | null => {
  const pid = String(p.pid ?? p.id ?? p.productId ?? p.product_id ?? '').trim();
  const productNameEn = firstNonEmptyString(p.nameEn, p.productNameEn, p.productName, p.name, p.title);
  if (!pid || !productNameEn) return null;

  return {
    pid,
    productNameEn,
    brandName: firstNonEmptyString(p.brandName, p.brand_name, p.brand, p.brandEn),
    productSku: firstNonEmptyString(p.sku, p.productSku, p.productCode, p.productCodeEn),
    productSpu: firstNonEmptyString(p.spu, p.productSpu, p.spuCode, p.spuId, p.productSpuEn),
    productImage: firstNonEmptyString(p.bigImage, p.productImage, p.image, p.productImageUrl, p.mainImage),
    categoryId: firstNonEmptyString(p.categoryId, p.category_id, p.threeCategoryId, p.twoCategoryId, p.oneCategoryId),
    categoryName:
      firstNonEmptyString(
        p.threeCategoryName,
        p.threeCategoryNameEn,
        p.twoCategoryName,
        p.twoCategoryNameEn,
        p.oneCategoryName,
        p.oneCategoryNameEn,
        p.categoryName,
        p.categoryNameEn,
        p.category_path,
        p.categoryPath
      ) || 'Uncategorized',
    sellPrice: parseCJPriceToUSD(p.sellPrice ?? p.sell_price ?? p.price ?? p.variantSellPrice ?? p.minPrice ?? p.maxPrice),
    createdAt:
      p.createTime ||
      p.createdAt ||
      p.createDate ||
      p.created_time ||
      p.gmtCreate ||
      p.addTime ||
      p.updateTime ||
      p.updatedAt ||
      undefined,
    listedNum: toNonNegativeNumber(p.listedNum ?? p.listed_num) ?? undefined,
    warehouseInventoryNum:
      toNonNegativeNumber(p.warehouseInventoryNum ?? p.warehouse_inventory_num ?? p.inventoryNum) ?? undefined,
    totalVerifiedInventory:
      toNonNegativeNumber(p.totalVerifiedInventory ?? p.total_verified_inventory) ?? undefined,
    verifiedWarehouse: toNonNegativeNumber(p.verifiedWarehouse ?? p.verified_warehouse) ?? undefined,
    hasVideo:
      Boolean(p.isVideo ?? p.isVedio) ||
      (Array.isArray(p.videoList) && p.videoList.length > 0) ||
      Boolean(String(p.productVideo ?? '').trim()),
    isFreeShipping: typeof p.isFreeShipping === 'boolean' ? p.isFreeShipping : undefined,
    shippingCountryCodes: Array.isArray(p.shippingCountryCodes)
      ? p.shippingCountryCodes.map((code: unknown) => String(code ?? '').trim()).filter(Boolean)
      : undefined,
  };
};

const queryCJProductByIdentifier = async (identifier: string): Promise<CJProduct | null> => {
  const requestedIdentifier = String(identifier || '').trim();
  if (!requestedIdentifier) return null;

  const normalizedIdentifier = requestedIdentifier.replace(/\s+/g, '');
  const attempts: Array<Record<string, unknown>> = [
    { pid: requestedIdentifier },
    { pid: normalizedIdentifier },
    { productSku: requestedIdentifier },
    { productSku: normalizedIdentifier },
    { variantSku: requestedIdentifier },
    { variantSku: normalizedIdentifier },
    { productSpu: requestedIdentifier },
    { productSpu: normalizedIdentifier },
    { spu: requestedIdentifier },
    { spu: normalizedIdentifier },
  ];

  const seenPayloads = new Set<string>();
  for (const payload of attempts) {
    const key = JSON.stringify(payload);
    if (seenPayloads.has(key)) continue;
    seenPayloads.add(key);

    try {
      const response = await cjRequest<any>('product/query', payload, 'GET');
      const detail = extractDetailPayload(response, requestedIdentifier);
      if (!detail) continue;
      if (!buildExactIdentifierSet(detail).has(requestedIdentifier) && !buildExactIdentifierSet(detail).has(normalizedIdentifier)) {
        continue;
      }

      const mapped = mapCJRowToProduct(detail);
      if (mapped) return mapped;
    } catch (error) {
      console.warn('queryCJProductByIdentifier failed:', payload, error instanceof Error ? error.message : error);
    }
  }

  return null;
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
  // Use the highest parsed value so list/detail values align with CJ app price displays.
  const numericMatches = raw.match(/-?\d+(?:\.\d+)?/g) || [];
  const normalized = numericMatches
    .map((token) => {
      const parsed = Number(token);
      if (!Number.isFinite(parsed) || parsed <= 0) return null;
      const hadDecimal = token.includes('.');
      if (!hadDecimal && Number.isInteger(parsed) && parsed >= 1000 && parsed <= 1000000) {
        return Math.round((parsed / 100 + Number.EPSILON) * 100) / 100;
      }
      return Math.round((parsed + Number.EPSILON) * 100) / 100;
    })
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0);

  if (normalized.length === 0) return 0;
  return Math.max(...normalized);
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

const CJ_REQUEST_MIN_INTERVAL_MS = 1200;
let cjRequestQueue: Promise<void> = Promise.resolve();
let lastCjRequestStartedAt = 0;

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

async function scheduleCjRequest(): Promise<void> {
  const prior = cjRequestQueue;
  let release = () => {};
  cjRequestQueue = new Promise<void>((resolve) => {
    release = resolve;
  });

  await prior;

  const waitMs = Math.max(0, CJ_REQUEST_MIN_INTERVAL_MS - (Date.now() - lastCjRequestStartedAt));
  if (waitMs > 0) {
    await sleep(waitMs);
  }

  lastCjRequestStartedAt = Date.now();
  release();
}

/**
 * Make authenticated request to CJ API via Netlify proxy to avoid CORS
 */
async function cjRequest<T>(endpoint: string, data?: any, method: 'GET' | 'POST' = 'POST'): Promise<CJApiResponse<T>> {
  await scheduleCjRequest();

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
  categoryId?: string,
  newestFirst: boolean = true,
  searchQuery?: string,
  filters?: {
    countryCode?: string;
    productType?: string;
  }
): Promise<{ products: CJProduct[]; total: number }> {
  console.log('getCJProducts called with:', { pageNum, pageSize, categoryId, newestFirst, searchQuery, filters });

  const normalizedSearchQuery = extractCJIdentifierFromSearchQuery(searchQuery);
  const normalizedIdentifier = normalizedSearchQuery.replace(/\s+/g, '').toUpperCase();
  const looksLikeIdentifier = /^[A-Z0-9_-]{6,}$/i.test(normalizedIdentifier);
  const normalizedCountryCode = String(filters?.countryCode || '').trim().toUpperCase();
  const normalizedProductType = normalizeCJProductType(filters?.productType);
  const baseFilters = {
    ...(categoryId ? { categoryId } : {}),
    ...(normalizedCountryCode ? { countryCode: normalizedCountryCode } : {}),
    ...(normalizedProductType ? { productType: normalizedProductType } : {}),
  };

  const mapProducts = (rawProducts: any[]): CJProduct[] =>
    (rawProducts || [])
      .map((p: any) => mapCJRowToProduct(p))
      .filter((product): product is CJProduct => Boolean(product));

  const sortNewestFirst = (products: CJProduct[]): CJProduct[] => {
    if (!newestFirst) return products;
    return [...products].sort((a: CJProduct, b: CJProduct) => {
      const aTime = Date.parse(String(a?.createdAt || ''));
      const bTime = Date.parse(String(b?.createdAt || ''));
      const aValid = Number.isFinite(aTime);
      const bValid = Number.isFinite(bTime);
      if (aValid && bValid) return bTime - aTime;
      if (aValid) return -1;
      if (bValid) return 1;
      return 0;
    });
  };

  const searchRequestVariants: Array<{ endpoint: string; data: any; method: 'GET' | 'POST' }> = [];
  const fallbackRequestVariants: Array<{ endpoint: string; data: any; method: 'GET' | 'POST' }> = [];

  if (normalizedSearchQuery) {
    if (looksLikeIdentifier) {
      searchRequestVariants.push(
        {
          endpoint: 'product/list',
          method: 'GET',
          data: {
            pageNum,
            pageSize,
            productSku: normalizedIdentifier,
            ...baseFilters,
          },
        },
        {
          endpoint: 'product/list',
          method: 'GET',
          data: {
            pageNum,
            pageSize,
            sku: normalizedIdentifier,
            ...baseFilters,
          },
        },
        {
          endpoint: 'product/list',
          method: 'GET',
          data: {
            pageNum,
            pageSize,
            productSpu: normalizedIdentifier,
            ...baseFilters,
          },
        },
        {
          endpoint: 'product/list',
          method: 'GET',
          data: {
            pageNum,
            pageSize,
            spu: normalizedIdentifier,
            ...baseFilters,
          },
        }
      );
    }

    searchRequestVariants.push(
      {
        endpoint: 'product/list',
        method: 'GET',
        data: {
          pageNum,
          pageSize,
          keyWord: normalizedSearchQuery,
          keyword: normalizedSearchQuery,
          ...baseFilters,
          ...(newestFirst ? { sort: 'desc', orderBy: 'createAt' } : {}),
        },
      },
      {
        endpoint: 'product/listV2',
        method: 'GET',
        data: {
          page: pageNum,
          pageNum,
          size: pageSize,
          pageSize,
          keyWord: normalizedSearchQuery,
          keyword: normalizedSearchQuery,
          ...baseFilters,
          ...(newestFirst
            ? {
                sortType: 2,
                sort: 2,
                orderBy: 2,
                orderType: 2,
                sortOrder: 2,
              }
            : {}),
        },
      }
    );
  }

  fallbackRequestVariants.push(
    {
      endpoint: 'product/list',
      method: 'GET',
      data: {
        pageNum,
        pageSize,
        page: pageNum,
        size: pageSize,
        ...baseFilters,
        ...(newestFirst ? { sort: 'desc', orderBy: 'createAt' } : {}),
      },
    },
    {
      endpoint: 'product/listV2',
      method: 'GET',
      data: {
        page: pageNum,
        size: pageSize,
        ...baseFilters,
        ...(newestFirst
          ? {
              sortType: 2,
              sort: 2,
              orderBy: 2,
              orderType: 2,
              sortOrder: 2,
            }
          : {}),
      },
    }
  );

  const requestVariants = normalizedSearchQuery
    ? [...searchRequestVariants, ...fallbackRequestVariants]
    : fallbackRequestVariants;

  let lastError: unknown = null;
  let attemptedSearch = false;
  let exactIdentifierMatch: CJProduct | null = null;

  if (normalizedSearchQuery && looksLikeIdentifier) {
    exactIdentifierMatch = await queryCJProductByIdentifier(normalizedSearchQuery);
    if (exactIdentifierMatch) {
      return { products: [exactIdentifierMatch], total: 1 };
    }
  }

  for (const request of requestVariants) {
    try {
      const response = await cjRequest<any>(request.endpoint, request.data, request.method);
      console.log(`getCJProducts raw response (${request.endpoint}):`, response);

      const listData = response?.data ?? response;
      const rawProducts = extractProductRows(listData);
      if (rawProducts.length === 0) continue;

      const products = sortNewestFirst(mapProducts(rawProducts));
      const total =
        Number(listData?.totalRecords) ||
        Number(listData?.total) ||
        Number(listData?.count) ||
        Number(listData?.data?.totalRecords) ||
        products.length;

      console.log(`getCJProducts parsed via ${request.endpoint}:`, {
        productsCount: products.length,
        total,
        firstProduct: products[0],
      });

      return { products, total };
    } catch (error) {
      lastError = error;
      console.warn(`getCJProducts: ${request.endpoint} failed:`, error instanceof Error ? error.message : error);
    }

    if (
      normalizedSearchQuery &&
      searchRequestVariants.some(
        (searchRequest) =>
          searchRequest.endpoint === request.endpoint &&
          JSON.stringify(searchRequest.data) === JSON.stringify(request.data)
      )
    ) {
      attemptedSearch = true;
    }
  }

  if (normalizedSearchQuery && attemptedSearch) {
    return { products: [], total: 0 };
  }

  throw lastError instanceof Error ? lastError : new Error('Failed to load CJ products');
}
/**
 * Get detailed product information including variants
 */
export async function getCJProductDetail(pid: string): Promise<CJProduct> {
  const response = await cjRequest<any>('product/query', { pid }, 'GET');
  const data: any = extractDetailPayload(response, pid);

  if (!data) {
    throw new Error(`CJ product detail not found for requested pid: ${pid}`);
  }

  const requestedPid = String(pid || '').trim();
  const matchedIdentifiers = buildExactIdentifierSet(data);
  if (!matchedIdentifiers.has(requestedPid)) {
    throw new Error(`CJ returned a different product than requested for pid: ${requestedPid}`);
  }

  data.pid = firstNonEmptyString(data.pid, data.id, data.productId, pid);
  data.productNameEn = firstNonEmptyString(data.productNameEn, data.nameEn, data.productName, data.name, data.title);
  data.productSku = firstNonEmptyString(data.productSku, data.sku, data.productCode, data.productCodeEn);
  data.productImage = firstNonEmptyString(data.productImage, data.bigImage, data.image, data.productImageUrl, data.mainImage);
  data.categoryId = firstNonEmptyString(data.categoryId, data.category_id, data.threeCategoryId, data.twoCategoryId, data.oneCategoryId);
  data.categoryName =
    firstNonEmptyString(
      data.categoryName,
      data.categoryNameEn,
      data.threeCategoryName,
      data.threeCategoryNameEn,
      data.twoCategoryName,
      data.twoCategoryNameEn,
      data.oneCategoryName,
      data.oneCategoryNameEn,
      data.categoryPath,
      data.category_path
    ) || 'Uncategorized';
  data.brandName = firstNonEmptyString(data.brandName, data.brand_name, data.brand, data.brandEn);
  data.description = firstNonEmptyString(data.description, data.productDescription, data.remark, data.detail);
  data.sellPrice = parseCJPriceToUSD(data.sellPrice ?? data.sell_price ?? data.nowPrice ?? data.price);
  data.productWeight = data.productWeight ?? data.weight ?? data.productWeightG ?? data.productWeightGram ?? undefined;
  data.packingWeight = data.packingWeight ?? data.packageWeight ?? data.packingWeightG ?? undefined;
  data.logisticList = firstArray(data.logisticList, data.data?.logisticList);
  data.shippingList = firstArray(data.shippingList, data.data?.shippingList, data.deliveryList, data.data?.deliveryList);
  data.shippingOptions = firstArray(data.shippingOptions, data.data?.shippingOptions);
  data.logistics = firstArray(data.logistics, data.data?.logistics);
  data.warehouseName = firstNonEmptyString(data.warehouseName, data.warehouse, data.data?.warehouseName);
  data.shipFrom = firstNonEmptyString(data.shipFrom, data.shipFromCountry, data.data?.shipFrom);
  data.originCountry = firstNonEmptyString(data.originCountry, data.countryCode, data.data?.originCountry, data.shipCountryCode);

  const rawVariants =
    (Array.isArray(data.variants) && data.variants) ||
    (Array.isArray(data.variantList) && data.variantList) ||
    (Array.isArray(data.variantsList) && data.variantsList) ||
    (Array.isArray(data.productVariantList) && data.productVariantList) ||
    (Array.isArray(data.variantVos) && data.variantVos) ||
    (Array.isArray(data.data?.variants) && data.data.variants) ||
    (Array.isArray(data.data?.variantList) && data.data.variantList) ||
    (Array.isArray(data.data?.productVariantList) && data.data.productVariantList) ||
    [];

  if (rawVariants.length) {
    data.variants = rawVariants
      .map((v: any) => {
        const vid = firstNonEmptyString(v.vid, v.id, v.variantId, v.variant_id, v.skuId);
        const variantNameEn =
          firstNonEmptyString(v.variantNameEn, v.variantName, v.variant_name, v.variantKeyEn, v.variantKey);
        const variantSku = firstNonEmptyString(v.variantSku, v.sku, v.variant_sku, v.productSku);

        const variantImage = firstNonEmptyString(
          v.variantImage,
          v.variantBigImage,
          v.variantImageUrl,
          v.image,
          v.bigImage,
          v.variantImg
        );

        const variantStock = extractInventoryFromRow(v) ?? undefined;
        const variantWeight = toNonNegativeNumber(
          v?.variantWeight ??
            v?.weight ??
            v?.variantWeightG ??
            v?.weightG ??
            v?.variantWeightGram ??
            v?.weightGram
        ) ?? undefined;
        const variantWeightOz = (() => {
          const oz = toWeightOz(
            v?.variantWeightOz ??
              v?.weightOz ??
              v?.weight_oz ??
              v?.variantWeight ??
              v?.weight ??
              v?.variantWeightG ??
              v?.weightG
          );
          return oz > 0 ? oz : undefined;
        })();
        const shippingOptions = firstArray(v?.shippingOptions, v?.logisticList, v?.shippingList, v?.logistics);

        return {
          ...v,
          vid: String(vid),
          variantSku: String(variantSku),
          variantNameEn: String(variantNameEn || variantSku || vid),
          variantImage: variantImage || undefined,
          variantSellPrice: parseCJPriceToUSD(v?.variantSellPrice ?? v?.sellPrice ?? v?.price ?? v?.variantPrice),
          variantStock,
          variantKey: v.variantKey ?? v.variantKeyEn ?? undefined,
          variantWeight,
          variantWeightOz,
          weight: variantWeight,
          weight_oz: variantWeightOz,
          shippingOptions,
        };
      })
      .filter((v: any) => v.vid);
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
 * Create order in CJ system after payment clears
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
export async function getCJProductInventory(pid: string, vid?: string): Promise<number | null> {
  const data: any = { pid };
  if (vid) {
    data.vid = vid;
  }

  const resolveInventory = (payload: any): number | null => {
    const rows = [
      ...(Array.isArray(payload) ? payload : []),
      ...(Array.isArray(payload?.list) ? payload.list : []),
      ...(Array.isArray(payload?.content) ? payload.content : []),
      ...(Array.isArray(payload?.inventoryList) ? payload.inventoryList : []),
      ...(Array.isArray(payload?.data) ? payload.data : []),
      ...(Array.isArray(payload?.data?.list) ? payload.data.list : []),
      ...(Array.isArray(payload?.data?.content) ? payload.data.content : []),
      ...(Array.isArray(payload?.data?.inventoryList) ? payload.data.inventoryList : []),
      ...(Array.isArray(payload?.rows) ? payload.rows : []),
      ...(Array.isArray(payload?.data?.rows) ? payload.data.rows : []),
    ];

    if (rows.length > 0) {
      const resolvedRows = vid
        ? rows.filter((row: any) => {
            const rowVid = String(
              row?.vid ?? row?.variantId ?? row?.variant_id ?? row?.cjVariantId ?? row?.id ?? row?.skuId ?? ''
            ).trim();
            return rowVid === String(vid);
          })
        : rows;

      const candidates = (resolvedRows.length > 0 ? resolvedRows : rows)
        .map((row: any) => extractInventoryFromRow(row))
        .filter((v: number | null): v is number => v !== null);

      if (candidates.length > 0) {
        return Math.floor(vid ? candidates[0] : candidates.reduce((acc, n) => acc + n, 0));
      }
    }

    const directCandidates = [
      payload?.stock,
      payload?.variantStock,
      payload?.availableStock,
      payload?.inventory,
      payload?.inventoryNum,
      payload?.variantInventoryNum,
      payload?.stockNum,
      payload?.sellableStock,
      payload?.availableInventory,
      payload?.quantity,
      payload?.qty,
      payload?.variantQuantity,
      payload?.availableQuantity,
      payload?.data?.stock,
      payload?.data?.variantStock,
      payload?.data?.inventory,
      payload?.data?.availableStock,
      payload?.data?.inventoryNum,
      payload?.data?.quantity,
    ];

    for (const candidate of directCandidates) {
      const parsed = toNonNegativeNumber(candidate);
      if (parsed !== null) return Math.floor(parsed);
    }

    return null;
  };

  const postResponse = await cjRequest<any>('product/inventory/query', data);
  const postPayload: any = postResponse?.data ?? null;
  const postValue = resolveInventory(postPayload);
  if (postValue !== null) return postValue;

  // Some CJ environments return inventory data only when queried as GET.
  const getResponse = await cjRequest<any>('product/inventory/query', data, 'GET');
  const getPayload: any = getResponse?.data ?? null;
  const getValue = resolveInventory(getPayload);
  if (getValue !== null) return getValue;

  // Last fallback: infer from detail variant stock when available.
  try {
    const detail = await getCJProductDetail(pid);
    const variants = Array.isArray((detail as any)?.variants) ? (detail as any).variants : [];
    if (variants.length > 0) {
      if (vid) {
        const match = variants.find((v: any) => String(v?.vid || '') === String(vid));
        const parsed = extractInventoryFromRow(match);
        if (parsed !== null) return Math.floor(parsed);
      } else {
        const numbers = variants
          .map((v: any) => extractInventoryFromRow(v))
          .filter((v: number | null): v is number => v !== null);
        if (numbers.length > 0) return Math.floor(numbers.reduce((acc, n) => acc + n, 0));
      }
    }
  } catch {
    // no-op
  }

  return null;
}

/**
 * Calculate total cost for Beezio including:
 * - CJ product cost
 * - Your desired markup
 * - Affiliate commission (if applicable)
 * - Recruiter commission (5% if affiliate was referred)
 * - Beezio platform fee (15%)
 * - Processing fee (2.9% + $0.30)
 */
const MIN_AFFILIATE_COMMISSION = 5;
const MIN_PLATFORM_FEE = 4;
const MIN_CJ_MARKUP_DOLLARS = 3;

export function calculateBeezioPrice(
  cjCost: number,
  markupPercent: number = 100, // Your markup (e.g., 100% = double the cost)
  affiliateCommissionPercent: number = 20, // Affiliate gets % of seller ask (min $5)
  hasRecruiter: boolean = true, // If affiliate was recruited, 5% of sale is paid to recruiter from platform fee
  options?: { applyMinimums?: boolean }
): {
  cjCost: number;
  yourProfit: number;
  affiliateCommission: number;
  recruiterCommission: number;
  beezioFee: number;
  beezioNet: number;
  processingFee: number;
  finalPrice: number;
  breakdown: string;
} {
  const cleanCost = Number.isFinite(cjCost) ? cjCost : 0;
  const cleanMarkup = Number.isFinite(markupPercent) ? markupPercent : 0;
  const applyMinimums = options?.applyMinimums !== false;
  const rawProfit = cleanCost * (cleanMarkup / 100);
  const yourProfit = cleanCost > 0
    ? (applyMinimums ? Math.max(rawProfit, MIN_CJ_MARKUP_DOLLARS) : Math.max(rawProfit, 0))
    : 0;
  const sellerAsk = cleanCost + yourProfit;

  const percentAffiliate = Number.isFinite(affiliateCommissionPercent) ? affiliateCommissionPercent : 0;
  const computedAffiliate = sellerAsk * (percentAffiliate / 100);
  const affiliateCommission = applyMinimums
    ? Math.max(computedAffiliate, MIN_AFFILIATE_COMMISSION)
    : Math.max(computedAffiliate, 0);
  const platformPercent = PLATFORM_FEE_PERCENT / 100;
  const computedPlatform = (sellerAsk + affiliateCommission) * platformPercent;
  const beezioFee = applyMinimums ? Math.max(computedPlatform, MIN_PLATFORM_FEE) : Math.max(computedPlatform, 0);
  const recruiterCommission = 0;
  const beezioNet = beezioFee; // Referral override disabled in config

  const processingPercent = PROCESSING_PERCENT / 100;
  const processingFixed = PROCESSING_FIXED_FEE;
  const targetNetAfterProcessing = sellerAsk + affiliateCommission + beezioFee;
  const denom = 1 - Math.max(0, processingPercent);
  const finalPrice = denom > 0 ? (targetNetAfterProcessing + processingFixed) / denom : targetNetAfterProcessing;
  const processingFee = finalPrice * processingPercent + processingFixed;

  const breakdown = `
Customer Pays: $${finalPrice.toFixed(2)}
├─ Base Cost: $${cleanCost.toFixed(2)}
├─ Your Profit: $${yourProfit.toFixed(2)} (${markupPercent}% markup, min $${MIN_CJ_MARKUP_DOLLARS.toFixed(2)})
├─ Affiliate Commission: $${affiliateCommission.toFixed(2)} (${percentAffiliate}% of seller ask, min $${MIN_AFFILIATE_COMMISSION.toFixed(2)})
${hasRecruiter ? `├─ Recruiter Commission: $${recruiterCommission.toFixed(2)} (5% slice of platform fee)` : ''}
├─ Beezio Fee (Gross): $${beezioFee.toFixed(2)} (15% platform fee, min $${MIN_PLATFORM_FEE.toFixed(2)})
${hasRecruiter ? `├─ Beezio Fee (Net): $${beezioNet.toFixed(2)}` : ''}
└─ Processing Fee: $${processingFee.toFixed(2)}
`;

  return {
    cjCost: parseFloat(cleanCost.toFixed(2)),
    yourProfit: parseFloat(yourProfit.toFixed(2)),
    affiliateCommission: parseFloat(affiliateCommission.toFixed(2)),
    recruiterCommission: parseFloat(recruiterCommission.toFixed(2)),
    beezioFee: parseFloat(beezioFee.toFixed(2)),
    beezioNet: parseFloat(beezioNet.toFixed(2)),
    processingFee: parseFloat(processingFee.toFixed(2)),
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
