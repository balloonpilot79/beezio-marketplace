import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Netlify Functions use CJ_API_KEY (no VITE_ prefix).
// Never use VITE_CJ_API_KEY here because that encourages putting secrets into the client build env.
const CJ_API_KEY = process.env.CJ_API_KEY;
const CJ_API_BASE_URL = process.env.CJ_API_BASE_URL || 'https://developers.cjdropshipping.com/api2.0/v1/';

const defaultHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
} as const;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.warn(
    'cj-quote-shipping: Missing SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY. ' +
      'Set these in Netlify environment variables.'
  );
}

const supabase = createClient(
  SUPABASE_URL || 'http://localhost:54321',
  SUPABASE_SERVICE_ROLE_KEY || 'missing-service-role-key'
);

let cachedAccessToken: string | null = null;
let tokenExpiryDate: string | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedAccessToken && tokenExpiryDate) {
    const expiry = new Date(tokenExpiryDate).getTime();
    if (Number.isFinite(expiry) && expiry > Date.now()) {
      return cachedAccessToken;
    }
  }

  if (!CJ_API_KEY) {
    throw new Error('CJ_API_KEY missing (needed to fetch CJ access token)');
  }

  const response = await fetch(`${CJ_API_BASE_URL}authentication/getAccessToken`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey: CJ_API_KEY }),
  });

  const result = await response.json();
  if (!response.ok || !result?.result) {
    throw new Error(`CJ token error: ${response.status} ${result?.message || response.statusText}`);
  }

  cachedAccessToken = result.data.accessToken;
  tokenExpiryDate = result.data.accessTokenExpiryDate;
  if (!cachedAccessToken) {
    throw new Error('CJ access token was missing in response');
  }
  return cachedAccessToken;
}

type QuoteItem = {
  productId: string;
  quantity: number;
  variantId?: string;
};

type QuoteRequest = {
  destinationCountryCode: string;
  destinationZip?: string;
  items: QuoteItem[];
};

type CJFreightOption = {
  logisticName?: string;
  logisticPrice?: number | string;
  logisticAging?: string;
};

async function cjRequest<T = any>(endpoint: string, data: any): Promise<T> {
  const accessToken = await getAccessToken();
  const response = await fetch(`${CJ_API_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'CJ-Access-Token': accessToken,
    },
    body: JSON.stringify(data),
  });

  const result = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(`CJ API error: ${response.status} ${result?.message || response.statusText}`);
  }

  if (!result?.result) {
    throw new Error(`CJ API error: ${result?.message || 'Unknown error'}`);
  }

  return result.data as T;
}

function parsePriceUSD(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return NaN;
}

export async function handler(event: any) {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: defaultHeaders,
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: defaultHeaders,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const body = (event.body ? JSON.parse(event.body) : {}) as Partial<QuoteRequest>;

    const destinationCountryCode = (body.destinationCountryCode || '').toString().trim().toUpperCase();
    const destinationZip = body.destinationZip ? body.destinationZip.toString().trim() : undefined;
    const items = Array.isArray(body.items) ? body.items : [];

    if (!destinationCountryCode) {
      return {
        statusCode: 400,
        headers: defaultHeaders,
        body: JSON.stringify({ error: 'destinationCountryCode required' }),
      };
    }

    const normalizedItems = items
      .map((it) => ({
        productId: (it?.productId || '').toString(),
        quantity: Number(it?.quantity || 0),
        variantId: it?.variantId ? it.variantId.toString() : undefined,
      }))
      .filter((it) => it.productId && Number.isFinite(it.quantity) && it.quantity > 0);

    if (normalizedItems.length === 0) {
      return {
        statusCode: 400,
        headers: defaultHeaders,
        body: JSON.stringify({ error: 'items required' }),
      };
    }

    const productIds = Array.from(new Set(normalizedItems.map((i) => i.productId)));
    const variantIds = Array.from(new Set(normalizedItems.map((i) => i.variantId).filter(Boolean))) as string[];

    const { data: mappings, error: mapError } = await supabase
      .from('cj_product_mappings')
      .select('beezio_product_id, cj_variant_id')
      .in('beezio_product_id', productIds);

    if (mapError) {
      throw new Error(`Supabase mapping lookup failed: ${mapError.message}`);
    }

    const mappingByProductId = new Map<string, string>();
    for (const row of mappings || []) {
      if (row?.beezio_product_id && row?.cj_variant_id) {
        mappingByProductId.set(row.beezio_product_id, row.cj_variant_id);
      }
    }

    const looksLikeUuid = (value: string) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

    // CJ variant ids ("vid") are numeric strings in CJ's API.
    // Avoid passing random/internal identifiers (ex: "MANUAL:...") to CJ.
    const looksLikeCjVid = (value: string) => /^\d+$/.test(value.trim());

    const uuidVariantIds = variantIds.filter(looksLikeUuid);
    const cjVidByVariantId = new Map<string, string>();

    if (uuidVariantIds.length) {
      const { data: variants, error: variantError } = await supabase
        .from('product_variants')
        .select('id, cj_variant_id')
        .in('id', uuidVariantIds);

      if (variantError) {
        console.warn('cj-quote-shipping: variant lookup failed', variantError);
      } else {
        for (const row of variants || []) {
          if (row?.id && row?.cj_variant_id) {
            cjVidByVariantId.set(row.id, row.cj_variant_id);
          }
        }
      }
    }

    const mappedItems = normalizedItems
      .map((it) => {
        const rawVariantId = it.variantId ? it.variantId.trim() : '';
        const derivedVid =
          rawVariantId && looksLikeUuid(rawVariantId)
            ? cjVidByVariantId.get(rawVariantId) || null
            : rawVariantId && looksLikeCjVid(rawVariantId)
              ? rawVariantId
              : null;

        return {
          productId: it.productId,
          quantity: it.quantity,
          vid: derivedVid || mappingByProductId.get(it.productId) || null,
        };
      })
      .filter((it) => Boolean(it.vid));

    // If none of the items are CJ-mapped, there is nothing to quote.
    if (mappedItems.length === 0) {
      return {
        statusCode: 200,
        headers: defaultHeaders,
        body: JSON.stringify({
          mappedProductIds: [],
          logisticName: null,
          logisticPrice: 0,
          logisticAging: null,
          options: [],
        }),
      };
    }

    const cjBody = {
      startCountryCode: 'CN',
      endCountryCode: destinationCountryCode,
      zip: destinationZip || undefined,
      products: mappedItems.map((it) => ({ quantity: it.quantity, vid: it.vid })),
    };

    const options = await cjRequest<CJFreightOption[]>('logistic/freightCalculate', cjBody);

    const normalizedOptions = (Array.isArray(options) ? options : [])
      .map((opt) => ({
        logisticName: opt?.logisticName || null,
        logisticAging: opt?.logisticAging || null,
        logisticPrice: parsePriceUSD(opt?.logisticPrice),
        rawPrice: opt?.logisticPrice ?? null,
      }))
      .filter((opt) => opt.logisticName && Number.isFinite(opt.logisticPrice));

    if (normalizedOptions.length === 0) {
      return {
        statusCode: 422,
        headers: defaultHeaders,
        body: JSON.stringify({
          error: 'No shipping options returned',
          mappedProductIds: mappedItems.map((it) => it.productId),
          options: [],
        }),
      };
    }

    const cheapest = normalizedOptions.reduce((best, cur) => (cur.logisticPrice < best.logisticPrice ? cur : best));

    return {
      statusCode: 200,
      headers: defaultHeaders,
      body: JSON.stringify({
        mappedProductIds: mappedItems.map((it) => it.productId),
        logisticName: cheapest.logisticName,
        logisticPrice: Math.round((cheapest.logisticPrice + Number.EPSILON) * 100) / 100,
        logisticAging: cheapest.logisticAging,
        options: normalizedOptions.map((o) => ({
          logisticName: o.logisticName,
          logisticPrice: Math.round((o.logisticPrice + Number.EPSILON) * 100) / 100,
          logisticAging: o.logisticAging,
          rawPrice: o.rawPrice,
        })),
      }),
    };
  } catch (err: any) {
    console.error('cj-quote-shipping error:', err);
    return {
      statusCode: 500,
      headers: defaultHeaders,
      body: JSON.stringify({ error: err?.message || 'Shipping quote failed' }),
    };
  }
}
