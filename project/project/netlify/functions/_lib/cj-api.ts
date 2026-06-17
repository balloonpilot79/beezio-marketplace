const CJ_API_KEY = String(process.env.CJ_API_KEY || '')
  .trim()
  .replace(/^"(.*)"$/, '$1')
  .replace(/^'(.*)'$/, '$1')
  .trim();

const CJ_API_BASE_URL = String(process.env.CJ_API_BASE_URL || 'https://developers.cjdropshipping.com/api2.0/v1').replace(/\/$/, '');

const CJ_MIN_REQUEST_INTERVAL_MS = Number(process.env.CJ_MIN_REQUEST_INTERVAL_MS || 1500);

let cachedAccessToken: string | null = null;
let tokenExpiryMs: number | null = null;
let tokenFetchInFlight: Promise<string> | null = null;
let lastCJRequestAtMs = 0;
let cjQueue: Promise<unknown> = Promise.resolve();

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = async (): Promise<T> => {
    const waitMs = Math.max(0, CJ_MIN_REQUEST_INTERVAL_MS - (Date.now() - lastCJRequestAtMs));
    if (waitMs > 0) await sleep(waitMs);
    lastCJRequestAtMs = Date.now();
    return task();
  };
  const chained = cjQueue.catch(() => undefined).then(run);
  cjQueue = chained.then(() => undefined, () => undefined);
  return chained;
}

async function getAccessToken(): Promise<string> {
  if (!CJ_API_KEY) throw new Error('Missing CJ_API_KEY');
  if (cachedAccessToken && tokenExpiryMs && tokenExpiryMs > Date.now() + 60_000) {
    return cachedAccessToken;
  }
  if (tokenFetchInFlight) return tokenFetchInFlight;

  tokenFetchInFlight = (async () => {
    const res = await enqueue(() =>
      fetch(`${CJ_API_BASE_URL}/authentication/getAccessToken`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: CJ_API_KEY }),
      })
    );
    const payload = await res.json().catch(() => ({}));
    if (!res.ok || !payload?.result) {
      throw new Error(payload?.message || 'CJ auth failed');
    }
    cachedAccessToken = String(payload?.data?.accessToken || '').trim();
    const rawExpiry = payload?.data?.accessTokenExpiryDate;
    if (typeof rawExpiry === 'number') {
      tokenExpiryMs = rawExpiry > 1e12 ? rawExpiry : rawExpiry * 1000;
    } else if (typeof rawExpiry === 'string') {
      const parsed = Date.parse(rawExpiry);
      tokenExpiryMs = Number.isFinite(parsed) ? parsed : null;
    } else {
      tokenExpiryMs = null;
    }
    if (!cachedAccessToken) throw new Error('CJ access token missing');
    return cachedAccessToken;
  })();

  try {
    return await tokenFetchInFlight;
  } finally {
    tokenFetchInFlight = null;
  }
}

async function cjRequest<T>(endpoint: string, body: Record<string, unknown>, method: 'GET' | 'POST' = 'POST') {
  const token = await getAccessToken();
  return enqueue(async () => {
    const normalizedBody = body || {};
    const requestUrl =
      method === 'GET'
        ? `${CJ_API_BASE_URL}/${endpoint}?${new URLSearchParams(
            Object.entries(normalizedBody).reduce<Record<string, string>>((acc, [key, value]) => {
              if (value === undefined || value === null) return acc;
              const text = String(value).trim();
              if (!text) return acc;
              acc[key] = text;
              return acc;
            }, {})
          ).toString()}`
        : `${CJ_API_BASE_URL}/${endpoint}`;

    const res = await fetch(requestUrl, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'cj-access-token': token,
      },
      body: method === 'POST' ? JSON.stringify(normalizedBody) : undefined,
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok || payload?.result === false) {
      throw new Error(payload?.message || `CJ request failed (${res.status})`);
    }
    return payload as T;
  });
}

const toNonNegativeNumber = (value: unknown) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.floor(n));
};

const extractInventoryFromRow = (row: any): number | null => {
  return (
    toNonNegativeNumber(row?.stock) ??
    toNonNegativeNumber(row?.availableStock) ??
    toNonNegativeNumber(row?.inventory) ??
    toNonNegativeNumber(row?.inventoryNum) ??
    toNonNegativeNumber(row?.variantInventoryNum) ??
    toNonNegativeNumber(row?.stockNum) ??
    toNonNegativeNumber(row?.sellableStock) ??
    toNonNegativeNumber(row?.availableInventory) ??
    toNonNegativeNumber(row?.variantStock) ??
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

export async function getCJInventory(pid: string, vid?: string): Promise<number | null> {
  const data: Record<string, unknown> = { pid };
  if (vid) data.vid = vid;

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
      ...(Array.isArray(payload?.productVariantList) ? payload.productVariantList : []),
      ...(Array.isArray(payload?.data?.productVariantList) ? payload.data.productVariantList : []),
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
        return vid ? candidates[0] : candidates.reduce((acc, n) => acc + n, 0);
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
      if (parsed != null) return parsed;
    }

    return null;
  };

  const postResponse = await cjRequest<any>('product/inventory/query', data, 'POST');
  const postPayload: any = postResponse?.data ?? postResponse;
  const postValue = resolveInventory(postPayload);
  if (postValue !== null) return postValue;

  const getResponse = await cjRequest<any>('product/inventory/query', data, 'GET');
  const getPayload: any = getResponse?.data ?? getResponse;
  const getValue = resolveInventory(getPayload);
  if (getValue !== null) return getValue;

  try {
    const detailResponse = await cjRequest<any>('product/query', { pid }, 'GET');
    const detailPayload: any = detailResponse?.data ?? detailResponse;
    const variants = [
      ...(Array.isArray(detailPayload?.variants) ? detailPayload.variants : []),
      ...(Array.isArray(detailPayload?.productVariantList) ? detailPayload.productVariantList : []),
      ...(Array.isArray(detailPayload?.data?.variants) ? detailPayload.data.variants : []),
      ...(Array.isArray(detailPayload?.data?.productVariantList) ? detailPayload.data.productVariantList : []),
      ...(Array.isArray(detailPayload?.list) ? detailPayload.list : []),
      ...(Array.isArray(detailPayload?.data?.list) ? detailPayload.data.list : []),
    ];

    if (variants.length > 0) {
      if (vid) {
        const match = variants.find((row: any) => {
          const rowVid = String(
            row?.vid ?? row?.variantId ?? row?.variant_id ?? row?.cjVariantId ?? row?.id ?? row?.skuId ?? ''
          ).trim();
          return rowVid === String(vid);
        });
        const parsed = extractInventoryFromRow(match);
        if (parsed !== null) return parsed;
      } else {
        const numbers = variants
          .map((row: any) => extractInventoryFromRow(row))
          .filter((value: number | null): value is number => value !== null);
        if (numbers.length > 0) return numbers.reduce((acc, n) => acc + n, 0);
      }
    }
  } catch {
    return null;
  }

  return null;
}

const firstNonEmptyString = (...values: unknown[]): string => {
  for (const value of values) {
    const normalized = String(value ?? '').trim();
    if (normalized) return normalized;
  }
  return '';
};

const firstArray = (...values: unknown[]): any[] => {
  for (const value of values) {
    if (Array.isArray(value) && value.length > 0) return value;
  }
  return [];
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

const parseCJPriceToUSD = (value: unknown): number => {
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value <= 0) return 0;
    if (Number.isInteger(value) && value >= 1000 && value <= 1000000) {
      return Math.round((value / 100 + Number.EPSILON) * 100) / 100;
    }
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  const raw = String(value ?? '').trim();
  if (!raw) return 0;

  const matches = raw.match(/-?\d+(?:\.\d+)?/g) || [];
  const normalized = matches
    .map((token) => {
      const parsed = Number(token);
      if (!Number.isFinite(parsed) || parsed <= 0) return null;
      if (!token.includes('.') && Number.isInteger(parsed) && parsed >= 1000 && parsed <= 1000000) {
        return Math.round((parsed / 100 + Number.EPSILON) * 100) / 100;
      }
      return Math.round((parsed + Number.EPSILON) * 100) / 100;
    })
    .filter((candidate): candidate is number => typeof candidate === 'number' && Number.isFinite(candidate) && candidate > 0);

  if (!normalized.length) return 0;
  return Math.max(...normalized);
};

export async function getCJProductDetail(params: {
  pid?: string | null;
  productSku?: string | null;
  variantSku?: string | null;
}): Promise<any> {
  const pid = String(params.pid || '').trim();
  const productSku = String(params.productSku || '').trim();
  const variantSku = String(params.variantSku || '').trim();

  if (!pid && !productSku && !variantSku) {
    throw new Error('CJ product detail requires pid, productSku, or variantSku');
  }

  const payload = pid
    ? { pid }
    : productSku
      ? { productSku }
      : { variantSku };

  const response = await cjRequest<any>('product/query', payload, 'GET');
  const data: any = response?.data ?? response;

  const detail = Array.isArray(data)
    ? data.find((row: any) =>
        buildExactIdentifierSet(row).has(pid || productSku || variantSku)
      ) ?? null
    : data;

  if (!detail) {
    throw new Error('CJ product detail not found');
  }

  const requestedIdentifier = String(pid || productSku || variantSku || '').trim();
  if (requestedIdentifier && !buildExactIdentifierSet(detail).has(requestedIdentifier)) {
    throw new Error(`CJ returned a different product than requested: ${requestedIdentifier}`);
  }

  detail.pid = firstNonEmptyString(detail.pid, detail.id, detail.productId, pid);
  detail.productNameEn = firstNonEmptyString(detail.productNameEn, detail.nameEn, detail.productName, detail.name, detail.title);
  detail.productSku = firstNonEmptyString(detail.productSku, detail.sku, detail.productCode, productSku);
  detail.productSpu = firstNonEmptyString(detail.productSpu, detail.spu, detail.spuCode, detail.spuId);
  detail.sellPrice = parseCJPriceToUSD(detail.sellPrice ?? detail.sell_price ?? detail.nowPrice ?? detail.price);

  const rawVariants =
    firstArray(
      detail.variants,
      detail.variantList,
      detail.variantsList,
      detail.productVariantList,
      detail.variantVos,
      detail?.data?.variants,
      detail?.data?.variantList,
      detail?.data?.productVariantList
    );

  detail.variants = rawVariants
    .map((variant: any) => {
      const vid = firstNonEmptyString(variant.vid, variant.id, variant.variantId, variant.variant_id, variant.skuId);
      const sku = firstNonEmptyString(variant.variantSku, variant.sku, variant.variant_sku);
      return {
        ...variant,
        vid,
        variantSku: sku,
        variantNameEn: firstNonEmptyString(variant.variantNameEn, variant.variantName, variant.variantKeyEn, variant.variantKey, sku, vid),
        variantSellPrice: parseCJPriceToUSD(variant.variantSellPrice ?? variant.sellPrice ?? variant.price ?? variant.variantPrice),
        variantStock: extractInventoryFromRow(variant),
      };
    })
    .filter((variant: any) => Boolean(variant.vid || variant.variantSku));

  return detail;
}
