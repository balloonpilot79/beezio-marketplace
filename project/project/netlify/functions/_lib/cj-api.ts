import {
  buildCJCreateOrderV2Payload,
  buildCJFreightRequest,
  normalizeCJFreightOptions,
  normalizeCJVideoAssets,
  parseCJUsd,
  requireExactCJVid,
  type CJCreateOrderV2Payload,
  type CJFreightOption,
  type CJVideoAsset,
} from '../../../shared/cjContract';
import { createSupabaseAdmin } from './supabase';

const CJ_API_KEY = String(process.env.CJ_API_KEY || '')
  .trim()
  .replace(/^"(.*)"$/, '$1')
  .replace(/^'(.*)'$/, '$1')
  .trim();

const CJ_API_BASE_URL = String(
  process.env.CJ_API_BASE_URL || 'https://developers.cjdropshipping.com/api2.0/v1'
).replace(/\/$/, '');
const CJ_MIN_REQUEST_INTERVAL_MS = Math.max(
  1_000,
  Number(process.env.CJ_MIN_REQUEST_INTERVAL_MS || 1_500)
);

let cachedAccessToken: string | null = null;
let cachedOpenId: string | null = null;
let tokenExpiryMs: number | null = null;
let tokenFetchInFlight: Promise<string> | null = null;
let lastCJRequestAtMs = 0;
let cjQueue: Promise<unknown> = Promise.resolve();

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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

function parseExpiry(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value > 1e12 ? value : value * 1_000;
  }
  const raw = String(value || '').trim();
  if (!raw) return null;
  if (/^\d+$/.test(raw)) {
    const parsed = Number(raw);
    return parsed > 1e12 ? parsed : parsed * 1_000;
  }
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

async function persistCJToken(): Promise<void> {
  if (!cachedAccessToken) return;
  try {
    const { error } = await createSupabaseAdmin().from('cj_tokens').upsert({
      id: 1,
      access_token: cachedAccessToken,
      open_id: cachedOpenId,
      expires_at: tokenExpiryMs ? new Date(tokenExpiryMs).toISOString() : null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' });
    if (error) console.warn('CJ token cache warning:', error.message);
  } catch (error) {
    console.warn('CJ token cache warning:', error instanceof Error ? error.message : String(error));
  }
}

async function loadPersistedCJToken(): Promise<boolean> {
  try {
    const { data, error } = await createSupabaseAdmin()
      .from('cj_tokens')
      .select('access_token,open_id,expires_at')
      .eq('id', 1)
      .maybeSingle();
    if (error || !data?.access_token) return false;
    const expiresAtMs = Date.parse(String(data.expires_at || ''));
    if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now() + 60_000) return false;
    cachedAccessToken = String(data.access_token).trim();
    cachedOpenId = String(data.open_id || '').trim() || null;
    tokenExpiryMs = expiresAtMs;
    return Boolean(cachedAccessToken);
  } catch (error) {
    console.warn('CJ token cache read warning:', error instanceof Error ? error.message : String(error));
    return false;
  }
}

async function getAccessToken(): Promise<string> {
  if (!CJ_API_KEY) throw new Error('Missing CJ_API_KEY');
  if (cachedAccessToken && (!tokenExpiryMs || tokenExpiryMs > Date.now() + 60_000)) {
    return cachedAccessToken;
  }
  if (tokenFetchInFlight) return tokenFetchInFlight;

  tokenFetchInFlight = (async () => {
    if (await loadPersistedCJToken()) return cachedAccessToken!;
    const response = await enqueue(() =>
      fetch(`${CJ_API_BASE_URL}/authentication/getAccessToken`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: CJ_API_KEY }),
      })
    );
    const payload: any = await response.json().catch(() => ({}));
    if (!response.ok || payload?.result === false || payload?.success === false) {
      throw new Error(String(payload?.message || `CJ authentication failed (${response.status})`));
    }

    cachedAccessToken = String(payload?.data?.accessToken || '').trim();
    cachedOpenId = String(payload?.data?.openId || '').trim() || null;
    tokenExpiryMs = parseExpiry(payload?.data?.accessTokenExpiryDate);
    if (!cachedAccessToken) throw new Error('CJ access token missing');
    await persistCJToken();
    return cachedAccessToken;
  })();

  try {
    return await tokenFetchInFlight;
  } finally {
    tokenFetchInFlight = null;
  }
}

export async function getCJOpenId(): Promise<string | null> {
  if (!cachedAccessToken) await getAccessToken();
  return cachedOpenId;
}

export async function cjRequest<T = any>(
  endpoint: string,
  body: Record<string, unknown> = {},
  method: 'GET' | 'POST' = 'POST'
): Promise<T> {
  const token = await getAccessToken();
  return enqueue(async () => {
    const normalizedEndpoint = String(endpoint || '').replace(/^\/+/, '');
    const query = new URLSearchParams();
    if (method === 'GET') {
      for (const [key, value] of Object.entries(body || {})) {
        if (value === undefined || value === null) continue;
        const text = String(value).trim();
        if (text) query.set(key, text);
      }
    }
    const suffix = method === 'GET' && query.size ? `?${query.toString()}` : '';
    const response = await fetch(`${CJ_API_BASE_URL}/${normalizedEndpoint}${suffix}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'CJ-Access-Token': token,
      },
      body: method === 'POST' ? JSON.stringify(body || {}) : undefined,
    });
    const raw = await response.text();
    let payload: any = {};
    try {
      payload = raw ? JSON.parse(raw) : {};
    } catch {
      throw new Error(`CJ returned a non-JSON response (${response.status})`);
    }

    if (!response.ok || payload?.result === false || payload?.success === false) {
      const error: any = new Error(String(payload?.message || `CJ request failed (${response.status})`));
      error.statusCode = response.status;
      error.cjCode = payload?.code ?? null;
      error.requestId = payload?.requestId ?? null;
      throw error;
    }
    return payload as T;
  });
}

const nonNegativeInteger = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : null;
};

const sumInventoryRows = (rows: any[]): number | null => {
  const quantities = rows
    .map((row) =>
      nonNegativeInteger(
        row?.totalInventoryNum ??
        row?.totalInventory ??
        row?.storageNum ??
        row?.inventory
      )
    )
    .filter((value): value is number => value !== null);
  return quantities.length ? quantities.reduce((sum, value) => sum + value, 0) : null;
};

export type CJInventoryOrigin = {
  countryCode: string;
  available: number;
  verifiedWarehouse: number | null;
};

export async function getCJInventoryOrigins(pid: string, vid?: string): Promise<CJInventoryOrigin[]> {
  const normalizedPid = String(pid || '').trim();
  if (!normalizedPid) throw new Error('CJ inventory requires a PID.');

  if (vid) {
    const exactVid = requireExactCJVid(vid);
    const response: any = await cjRequest('product/stock/queryByVid', { vid: exactVid }, 'GET');
    const rows = Array.isArray(response?.data) ? response.data : [];
    return rows
      .filter((row: any) => String(row?.vid || '').trim() === exactVid)
      .map((row: any) => ({
        countryCode: String(row?.countryCode || '').trim().toUpperCase(),
        available: nonNegativeInteger(row?.totalInventoryNum ?? row?.totalInventory) ?? 0,
        verifiedWarehouse: nonNegativeInteger(row?.verifiedWarehouse),
      }))
      .filter((row: CJInventoryOrigin) => Boolean(row.countryCode));
  }

  const response: any = await cjRequest('product/stock/getInventoryByPid', { pid: normalizedPid }, 'GET');
  const rows = Array.isArray(response?.data?.inventories) ? response.data.inventories : [];
  return rows
    .map((row: any) => ({
      countryCode: String(row?.countryCode || '').trim().toUpperCase(),
      available: nonNegativeInteger(row?.totalInventoryNum) ?? 0,
      verifiedWarehouse: null,
    }))
    .filter((row: CJInventoryOrigin) => Boolean(row.countryCode));
}

export async function getCJInventory(pid: string, vid?: string): Promise<number | null> {
  const normalizedPid = String(pid || '').trim();
  if (!normalizedPid) throw new Error('CJ inventory requires a PID.');

  if (vid) {
    const origins = await getCJInventoryOrigins(normalizedPid, vid);
    return origins.length ? origins.reduce((sum, row) => sum + row.available, 0) : null;
  }

  const response: any = await cjRequest('product/stock/getInventoryByPid', { pid: normalizedPid }, 'GET');
  const productRows = Array.isArray(response?.data?.inventories) ? response.data.inventories : [];
  return sumInventoryRows(productRows);
}

const firstString = (...values: unknown[]): string => {
  for (const value of values) {
    const text = String(value ?? '').trim();
    if (text) return text;
  }
  return '';
};

const firstArray = (...values: unknown[]): any[] => {
  for (const value of values) {
    if (Array.isArray(value) && value.length) return value;
  }
  return [];
};

const productIdentifiers = (row: any): Set<string> => new Set(
  [row?.pid, row?.productId, row?.productSku, row?.productSpu, row?.sku, row?.spu]
    .map((value) => String(value ?? '').trim())
    .filter(Boolean)
);

export async function getCJProductDetail(params: {
  pid?: string | null;
  productSku?: string | null;
  variantSku?: string | null;
}): Promise<any> {
  const pid = String(params.pid || '').trim();
  const productSku = String(params.productSku || '').trim();
  const variantSku = String(params.variantSku || '').trim();
  const requestedIdentifier = pid || productSku || variantSku;
  if (!requestedIdentifier) throw new Error('CJ product detail requires PID or SKU.');

  const query = pid ? { pid, features: 'enable_video' }
    : productSku ? { productSku, features: 'enable_video' }
      : { variantSku, features: 'enable_video' };
  const response: any = await cjRequest('product/query', query, 'GET');
  const raw = response?.data ?? response;
  const detail = Array.isArray(raw)
    ? raw.find((row: any) => productIdentifiers(row).has(requestedIdentifier))
    : raw;
  if (!detail || !productIdentifiers(detail).has(requestedIdentifier)) {
    throw new Error(`CJ returned a different product than requested: ${requestedIdentifier}`);
  }

  const rawVariants = firstArray(
    detail?.variants,
    detail?.variantList,
    detail?.productVariantList,
    detail?.variantVos
  );
  const variants = rawVariants
    .map((variant: any) => {
      const vid = String(variant?.vid || '').trim();
      if (!vid) return null;
      return {
        ...variant,
        vid,
        variantSku: firstString(variant?.variantSku, variant?.variant_sku),
        variantNameEn: firstString(
          variant?.variantNameEn,
          variant?.variantName,
          variant?.variantKeyEn,
          variant?.variantKey,
          variant?.variantSku,
          vid
        ),
        variantSellPrice: parseCJUsd(
          variant?.variantSellPrice ?? variant?.sellPrice ?? variant?.price ?? variant?.variantPrice
        ),
      };
    })
    .filter(Boolean);

  if (!variants.length) throw new Error('CJ product has no variants with exact VIDs.');
  return {
    ...detail,
    pid: firstString(detail?.pid, detail?.productId, pid),
    productNameEn: firstString(detail?.productNameEn, detail?.nameEn, detail?.productName, detail?.name),
    productSku: firstString(detail?.productSku, detail?.sku, productSku),
    productSpu: firstString(detail?.productSpu, detail?.spu),
    sellPrice: parseCJUsd(detail?.sellPrice ?? detail?.sell_price ?? detail?.nowPrice ?? detail?.price),
    variants,
  };
}

export async function getCJVariantByVid(vid: string): Promise<any> {
  const exactVid = requireExactCJVid(vid);
  const response: any = await cjRequest(
    'product/variant/queryByVid',
    { vid: exactVid, features: 'enable_inventory' },
    'GET'
  );
  const data = response?.data ?? response;
  const variant = Array.isArray(data)
    ? data.find((row: any) => String(row?.vid || '').trim() === exactVid)
    : data;
  if (!variant || String(variant?.vid || '').trim() !== exactVid) {
    throw new Error(`CJ returned a different variant than requested: ${exactVid}`);
  }
  return {
    ...variant,
    vid: exactVid,
    variantSellPrice: parseCJUsd(
      variant?.variantSellPrice ?? variant?.sellPrice ?? variant?.price ?? variant?.variantPrice
    ),
  };
}

export async function getCJFreightQuote(params: {
  originCountryCode: string;
  destinationCountryCode: string;
  destinationZip?: string | null;
  items: Array<{ vid: unknown; quantity: unknown }>;
}): Promise<{ request: ReturnType<typeof buildCJFreightRequest>; options: CJFreightOption[]; raw: any }> {
  const request = buildCJFreightRequest(params);
  const raw: any = await cjRequest('logistic/freightCalculate', request as any, 'POST');
  const options = normalizeCJFreightOptions(raw);
  if (!options.length) throw new Error('CJ returned no valid shipping method for these exact variants.');
  return { request, options, raw };
}

export async function getCJProductVideos(productId: string): Promise<CJVideoAsset[]> {
  const normalizedProductId = String(productId || '').trim();
  if (!normalizedProductId) throw new Error('CJ video query requires productId.');
  const response: any = await cjRequest(
    'product/queryVideosByProductId',
    { productId: normalizedProductId },
    'POST'
  );
  return normalizeCJVideoAssets(response);
}

export async function createCJUnpaidOrder(
  payload: CJCreateOrderV2Payload | Parameters<typeof buildCJCreateOrderV2Payload>[0]
): Promise<any> {
  const normalized = 'payType' in payload
    ? payload as CJCreateOrderV2Payload
    : buildCJCreateOrderV2Payload(payload);
  if (normalized.payType !== 3) throw new Error('CJ automated orders must be created unpaid with payType=3.');
  const response: any = await cjRequest('shopping/order/createOrderV2', normalized as any, 'POST');
  const data = response?.data ?? response;
  if (!data?.orderId && !data?.orderNumber) {
    throw new Error('CJ created no identifiable order.');
  }
  return data;
}

export async function getCJOrderDetail(orderId: string): Promise<any> {
  const normalizedOrderId = String(orderId || '').trim();
  if (!normalizedOrderId) throw new Error('CJ order detail requires orderId.');
  const response: any = await cjRequest(
    'shopping/order/getOrderDetail',
    { orderId: normalizedOrderId },
    'GET'
  );
  return response?.data ?? response;
}

export async function findCJOrderByOrderNumber(orderNumber: string): Promise<any | null> {
  const normalizedOrderNumber = String(orderNumber || '').trim();
  if (!normalizedOrderNumber) return null;
  // CJ's current list API has no exact platform-order-number filter. It
  // returns our submitted `orderNumber` as `orderNum`, so retry recovery scans
  // the newest rows in each documented state. This is only used after a prior
  // create attempt, never on the normal first-attempt path.
  const statuses = [
    '',
    'CREATED',
    'UNPAID',
    'IN_CART',
    'PENDING',
    'PROCESSING',
    'UNSHIPPED',
    'SHIPPED',
    'DELIVERED',
    'CANCELLED',
    'OTHER',
  ];
  for (const status of statuses) {
    const response: any = await cjRequest(
      'shopping/order/list',
      { pageNum: 1, pageSize: 100, ...(status ? { status } : {}) },
      'GET'
    );
    const data = response?.data ?? response;
    const rows = firstArray(data?.list, data?.content, data?.rows, data);
    const match = rows.find((row: any) =>
      String(row?.orderNum ?? row?.orderNumber ?? '').trim() === normalizedOrderNumber
    );
    if (match) return match;
  }
  return null;
}
