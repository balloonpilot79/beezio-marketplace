import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

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

type ShippingTier = {
  min_oz: number;
  max_oz: number;
  shipping_cents: number;
};

const DEFAULT_TIERS: ShippingTier[] = [
  { min_oz: 0, max_oz: 8, shipping_cents: 499 },
  { min_oz: 9, max_oz: 32, shipping_cents: 699 },
  { min_oz: 33, max_oz: 80, shipping_cents: 999 },
  { min_oz: 81, max_oz: 160, shipping_cents: 1499 },
  { min_oz: 161, max_oz: 999999, shipping_cents: 1999 },
];

const safeNumber = (value: unknown, fallback = 0) => {
  const parsed = typeof value === 'string' ? Number.parseFloat(value) : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const pickTierCost = (totalOz: number, tiers: ShippingTier[]): number => {
  const rounded = Math.max(0, totalOz);
  const tier = tiers.find((t) => rounded >= t.min_oz && rounded <= t.max_oz);
  if (tier) return Math.max(0, Math.round(tier.shipping_cents));
  return tiers.length ? Math.max(0, Math.round(tiers[tiers.length - 1].shipping_cents)) : 0;
};

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
        quantity: Math.max(0, Math.floor(Number(it?.quantity || 0))),
        variantId: it?.variantId ? it.variantId.toString() : undefined,
      }))
      .filter((it) => it.productId && it.quantity > 0);

    if (normalizedItems.length === 0) {
      return {
        statusCode: 400,
        headers: defaultHeaders,
        body: JSON.stringify({ error: 'items required' }),
      };
    }

    const productIds = Array.from(new Set(normalizedItems.map((i) => i.productId)));
    const variantIds = Array.from(
      new Set(normalizedItems.map((i) => i.variantId).filter(Boolean))
    ) as string[];

    const [{ data: products, error: productError }, { data: ruleRows, error: ruleError }] =
      await Promise.all([
        supabase
          .from('products')
          .select('id, lineage, dropship_provider, base_weight_oz')
          .in('id', productIds),
        supabase.from('shipping_rules').select('tiers_json').eq('name', 'default').limit(1),
      ]);

    if (productError) {
      throw new Error(`Supabase product lookup failed: ${productError.message}`);
    }

    if (ruleError) {
      console.warn('cj-quote-shipping: shipping_rules lookup failed', ruleError);
    }

    const tiersRaw = (ruleRows || [])[0]?.tiers_json;
    const tiers = Array.isArray(tiersRaw) && tiersRaw.length
      ? (tiersRaw as ShippingTier[])
      : DEFAULT_TIERS;

    const productById = new Map<string, any>();
    for (const row of products || []) {
      if (row?.id) {
        productById.set(row.id, row);
      }
    }

    const cjProductIds = new Set<string>();
    for (const [id, row] of productById.entries()) {
      const dropshipProvider = String(row?.dropship_provider || '').trim().toLowerCase();
      const lineage = String(row?.lineage || '').trim().toLowerCase();
      if (dropshipProvider === 'cj' || lineage === 'cj') {
        cjProductIds.add(id);
      }
    }

    if (cjProductIds.size === 0) {
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

    const variantWeightById = new Map<string, number>();
    if (variantIds.length) {
      const { data: variants, error: variantError } = await supabase
        .from('product_variants')
        .select('id, weight_oz')
        .in('id', variantIds);

      if (variantError) {
        console.warn('cj-quote-shipping: variant lookup failed', variantError);
      } else {
        for (const row of variants || []) {
          if (row?.id) {
            variantWeightById.set(row.id, Math.max(0, safeNumber(row.weight_oz, 0)));
          }
        }
      }
    }

    let totalWeightOz = 0;
    const mappedProductIds: string[] = [];
    for (const item of normalizedItems) {
      if (!cjProductIds.has(item.productId)) continue;
      mappedProductIds.push(item.productId);

      const product = productById.get(item.productId);
      const baseWeight = Math.max(0, safeNumber(product?.base_weight_oz, 0));
      const variantWeight =
        item.variantId && variantWeightById.has(item.variantId)
          ? variantWeightById.get(item.variantId) || 0
          : 0;
      const weightOz = variantWeight > 0 ? variantWeight : baseWeight;
      totalWeightOz += weightOz * item.quantity;
    }

    const shippingCents = pickTierCost(totalWeightOz, tiers);
    const shippingDollars = Math.round((shippingCents / 100 + Number.EPSILON) * 100) / 100;

    return {
      statusCode: 200,
      headers: defaultHeaders,
      body: JSON.stringify({
        mappedProductIds,
        logisticName: 'CJ Shipping',
        logisticPrice: shippingDollars,
        logisticAging: null,
        options: [
          {
            logisticName: 'CJ Shipping',
            logisticPrice: shippingDollars,
            logisticAging: null,
            destinationCountry: destinationCountryCode,
            destinationZip,
            totalWeightOz: Math.round(totalWeightOz * 100) / 100,
          },
        ],
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
