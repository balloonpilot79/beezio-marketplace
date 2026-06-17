import type { Handler } from '@netlify/functions';
import { createSupabaseAdmin } from './_lib/supabase';
import { json, assertPost, parseJson } from './_lib/http';
import { computeListingPrice } from './_lib/pricing';
import { round2, toAmountString } from './_lib/money';
import { getPayPalEnv, isPayPalEnabled, paypalRequestId } from './_lib/paypal';
import { getEnvNumber } from './_lib/env';
import { getPaymentProvider } from './_lib/providers';
import { requireAdmin } from './_lib/auth';
import { getCJInventory } from './_lib/cj-api';
import { resolveRecruiterInfluencerId } from './_lib/influencer-referrals';
import { validateCjOrderVariant } from './_lib/order-guards';
import { createBeezioOrderNumber } from '../../shared/orderNumber';
import {
  computeBeezioPlatformFee,
  DEFAULT_BEEZIO_LARGE_ORDER_FLAT_FEE,
  DEFAULT_BEEZIO_LARGE_ORDER_THRESHOLD,
  DEFAULT_BEEZIO_PLATFORM_FEE_CAP,
  DEFAULT_BEEZIO_PLATFORM_FEE_MIN,
  DEFAULT_BEEZIO_PLATFORM_RATE,
} from '../../shared/beezioFee';
import { isTestItemTitle, TEST_ITEM_PLATFORM_GROSS, TEST_ITEM_PRICE } from '../../shared/testItemPricing';
import { getLowPriceFlatFeeTotal, isLowPriceAmount } from '../../shared/lowPriceFeePolicy';

const LOCKED_PLATFORM_RATE = DEFAULT_BEEZIO_PLATFORM_RATE;
const LOCKED_PAYPAL_PERCENT = 0.0399;
const LOCKED_PAYPAL_FIXED = 0.6;
const LOCKED_PAYOUT_BUFFER = 0;
const LOCKED_PLATFORM_FEE_MIN_PER_ITEM = DEFAULT_BEEZIO_PLATFORM_FEE_MIN;
const LOCKED_PLATFORM_FEE_CAP = DEFAULT_BEEZIO_PLATFORM_FEE_CAP;
const LOCKED_LARGE_ORDER_THRESHOLD = DEFAULT_BEEZIO_LARGE_ORDER_THRESHOLD;
const LOCKED_LARGE_ORDER_FEE = DEFAULT_BEEZIO_LARGE_ORDER_FLAT_FEE;

type ShippingTier = {
  min_oz: number;
  max_oz: number;
  shipping_cents: number;
};

const DEFAULT_SHIPPING_TIERS: ShippingTier[] = [
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

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isUuid = (value: unknown): boolean => UUID_REGEX.test(String(value || '').trim());

const sameProfileId = (left: string | null | undefined, right: string | null | undefined): boolean => {
  const normalizedLeft = String(left || '').trim();
  const normalizedRight = String(right || '').trim();
  return Boolean(normalizedLeft && normalizedRight && normalizedLeft === normalizedRight);
};

const getPlatformFeeForAsk = (ask: number) =>
  computeBeezioPlatformFee(ask, {
    rate: getEnvNumber('BEEZIO_RATE', LOCKED_PLATFORM_RATE),
    minimum: getEnvNumber('BEEZIO_PLATFORM_FEE_MIN', LOCKED_PLATFORM_FEE_MIN_PER_ITEM),
    cap: getEnvNumber('BEEZIO_PLATFORM_FEE_CAP', LOCKED_PLATFORM_FEE_CAP),
    largeOrderThreshold: getEnvNumber('BEEZIO_PLATFORM_FEE_LARGE_ORDER_THRESHOLD', LOCKED_LARGE_ORDER_THRESHOLD),
    largeOrderFlatFee: getEnvNumber('BEEZIO_PLATFORM_FEE_LARGE_ORDER_FLAT', LOCKED_LARGE_ORDER_FEE),
  });

const roundRate = (value: number) => Math.round((value + Number.EPSILON) * 1_000_000) / 1_000_000;

const PRODUCT_SELECT_COLUMNS = [
  'id',
  'seller_id',
  'title',
  'name',
  'affiliate_enabled',
  'price',
  'seller_ask',
  'seller_amount',
  'seller_ask_price',
  'partner_commission_percent',
  'commission_rate',
  'commission_type',
  'flat_commission_amount',
  'affiliate_commission_rate',
  'affiliate_commission_type',
  'affiliate_commission_value',
  'source_platform',
  'external_id',
  'shipping_cost',
  'shipping_price',
  'base_weight_oz',
  'lineage',
  'dropship_provider',
  'requires_shipping',
  'is_digital',
  'track_inventory',
  'inventory_source',
  'in_stock',
  'total_inventory',
  'stock_quantity',
];

const VARIANT_SELECT_COLUMNS = [
  'id',
  'product_id',
  'sku',
  'source',
  'cj_product_id',
  'cj_variant_id',
  'cj_vid',
  'variant_display_sku',
  'searchable_codes',
  'is_orderable',
  'order_reference_type',
  'source_platform',
  'external_product_id',
  'external_variant_id',
  'external_data',
  'weight_oz',
  'inventory',
  'inventory_source',
  'inventory_policy',
  'is_active',
];

const extractMissingColumnName = (message: string): string | null => {
  const msg = String(message || '');
  const pg = msg.match(/column\s+"([^"]+)"\s+of\s+relation\s+"[^"]+"\s+does\s+not\s+exist/i);
  if (pg?.[1]) return pg[1];
  const pgDot = msg.match(/column\s+([a-z0-9_]+\.[a-z0-9_]+)\s+does\s+not\s+exist/i);
  if (pgDot?.[1]) return pgDot[1].split('.').pop() || pgDot[1];
  const pgrst = msg.match(/Could not find the '([^']+)' column of '[^']+' in the schema cache/i);
  if (pgrst?.[1]) return pgrst[1];
  return null;
};

const resolveAffiliateCommissionRate = (
  product: any,
  sellerAsk: number,
  defaultPartnerPercent: number
): number => {
  const zeroCommissionFallbackPercent = 0.30;
  const pickPositiveNumber = (...values: unknown[]) => {
    for (const value of values) {
      const num = Number(value);
      if (Number.isFinite(num) && num > 0) return num;
    }
    return 0;
  };

  const legacyPercent = Number(product?.partner_commission_percent);
  if (Number.isFinite(legacyPercent) && legacyPercent > 0) {
    return Math.max(0, legacyPercent) / 100;
  }

  let affiliateCommissionType = String(product?.affiliate_commission_type || '').trim().toLowerCase();
  const commissionType = String(product?.commission_type || '').trim().toLowerCase();
  let flatCommissionAmount = Number(product?.flat_commission_amount ?? 0);
  let affiliateCommissionRate = Number(product?.affiliate_commission_rate ?? 0);
  let affiliateCommissionValue = Number(product?.affiliate_commission_value ?? 0);
  let commissionRate = Number(product?.commission_rate ?? 0);

  // Some products were saved with the newer flat-rate fields (`commission_type=flat_rate`,
  // `commission_rate=<dollars>`) but stale affiliate-specific percent fields remained at 10%.
  // For payout math, prefer the flat-dollar configuration in that case.
  if (
    (commissionType === 'flat_rate' || commissionType === 'fixed') &&
    !(flatCommissionAmount > 0) &&
    commissionRate > 0 &&
    affiliateCommissionType !== 'flat' &&
    !(affiliateCommissionValue > 0)
  ) {
    affiliateCommissionType = 'flat';
    flatCommissionAmount = commissionRate;
    affiliateCommissionValue = commissionRate;
    affiliateCommissionRate = commissionRate;
  }

  const hasFlatAmount = Number.isFinite(flatCommissionAmount) && flatCommissionAmount > 0;
  const hasExplicitAffiliateType = affiliateCommissionType === 'flat' || affiliateCommissionType === 'percent';
  const isFlatCommission =
    affiliateCommissionType === 'flat' ||
    (!hasExplicitAffiliateType && (
    commissionType === 'flat_rate' ||
    commissionType === 'fixed' ||
    hasFlatAmount
    ));

  if (isFlatCommission) {
    const flatValue = affiliateCommissionType === 'flat'
      ? pickPositiveNumber(affiliateCommissionValue, affiliateCommissionRate, flatCommissionAmount)
      : pickPositiveNumber(
          flatCommissionAmount,
          !hasExplicitAffiliateType && (commissionType === 'flat_rate' || commissionType === 'fixed')
            ? pickPositiveNumber(affiliateCommissionValue, affiliateCommissionRate, commissionRate)
            : 0
        );
    const normalizedFlatValue = round2(Math.max(0, flatValue));
    if (!(normalizedFlatValue > 0) || !(sellerAsk > 0)) return roundRate(zeroCommissionFallbackPercent);
    return roundRate(Math.min(normalizedFlatValue / sellerAsk, 1));
  }

  const rawPercent = pickPositiveNumber(
    affiliateCommissionValue,
    affiliateCommissionRate,
    commissionRate,
    defaultPartnerPercent,
    zeroCommissionFallbackPercent * 100
  );
  if (!Number.isFinite(rawPercent) || rawPercent <= 0) return roundRate(zeroCommissionFallbackPercent);
  return roundRate(rawPercent > 1 ? rawPercent / 100 : rawPercent);
};

const fetchProductsByField = async (
  supabaseAdmin: any,
  field: 'id' | 'external_id',
  values: string[]
): Promise<{ rows: any[]; errorMessage: string | null }> => {
  let selected = [...PRODUCT_SELECT_COLUMNS];
  let lastError: any = null;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const { data, error } = await supabaseAdmin
      .from('products')
      .select(selected.join(','))
      .in(field, values);
    if (!error) return { rows: (data as any[]) || [], errorMessage: null };
    lastError = error;
    const missing = extractMissingColumnName(String((error as any)?.message || ''));
    if (missing && selected.includes(missing)) {
      selected = selected.filter((col) => col !== missing);
      continue;
    }
    break;
  }

  return { rows: [], errorMessage: String((lastError as any)?.message || 'query failed') };
};

const resolveSingleAffiliateFallback = async (
  supabaseAdmin: any,
  productIds: string[]
): Promise<string | null> => {
  const canonicalProductIds = Array.from(new Set(productIds.map((value) => String(value || '').trim()).filter(Boolean)));
  if (!canonicalProductIds.length) return null;

  const { data: linkRows, error: linkError } = await supabaseAdmin
    .from('affiliate_links')
    .select('product_id, affiliate_id')
    .in('product_id', canonicalProductIds);

  if (linkError) return null;

  const { data: promotedRows } = await supabaseAdmin
    .from('affiliate_products')
    .select('product_id, affiliate_id')
    .in('product_id', canonicalProductIds);

  const affiliateIds = Array.from(
    new Set(
      [ ...((linkRows as any[]) || []), ...((promotedRows as any[]) || []) ]
        .map((row) => String(row?.affiliate_id || '').trim())
        .filter(Boolean)
    )
  );

  return affiliateIds.length === 1 ? affiliateIds[0] : null;
};

const fetchVariantsByField = async (
  supabaseAdmin: any,
  field: 'id' | 'product_id',
  values: string[]
): Promise<{ rows: any[]; errorMessage: string | null }> => {
  let selected = [...VARIANT_SELECT_COLUMNS];
  let lastError: any = null;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const { data, error } = await supabaseAdmin
      .from('product_variants')
      .select(selected.join(','))
      .in(field, values);
    if (!error) return { rows: (data as any[]) || [], errorMessage: null };
    lastError = error;
    const missing = extractMissingColumnName(String((error as any)?.message || ''));
    if (missing && selected.includes(missing)) {
      selected = selected.filter((col) => col !== missing);
      continue;
    }
    break;
  }

  return { rows: [], errorMessage: String((lastError as any)?.message || 'query failed') };
};

const resolveProfileId = async (supabaseAdmin: any, rawProfileOrUserId: string | null): Promise<string | null> => {
  const candidate = String(rawProfileOrUserId || '').trim();
  if (!candidate) return null;

  try {
    const byProfileId = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('id', candidate)
      .maybeSingle();
    if (!byProfileId.error && (byProfileId.data as any)?.id) {
      return String((byProfileId.data as any).id).trim();
    }
  } catch {
    // fall through
  }

  try {
    const byUserId = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('user_id', candidate)
      .maybeSingle();
    if (!byUserId.error && (byUserId.data as any)?.id) {
      return String((byUserId.data as any).id).trim();
    }
  } catch {
    // fall through
  }

  return null;
};

const resolveAffiliateProfileId = async (supabaseAdmin: any, rawProfileOrUserId: string | null): Promise<string | null> => {
  const profileId = await resolveProfileId(supabaseAdmin, rawProfileOrUserId);
  if (!profileId) {
    const slug = String(rawProfileOrUserId || '').trim().toLowerCase();
    if (!slug) return null;

    try {
      const { data: affiliateSettingsRow } = await supabaseAdmin
        .from('affiliate_store_settings')
        .select('affiliate_id')
        .eq('subdomain', slug)
        .maybeSingle();
      const affiliateId = String((affiliateSettingsRow as any)?.affiliate_id || '').trim();
      if (affiliateId) return affiliateId;
    } catch {
      return null;
    }

    return null;
  }

  try {
    const [{ data: profileRow }, { data: affiliateSettingsRow }] = await Promise.all([
      supabaseAdmin
        .from('profiles')
        .select('id, role, primary_role')
        .eq('id', profileId)
        .maybeSingle(),
      supabaseAdmin
        .from('affiliate_store_settings')
        .select('affiliate_id')
        .eq('affiliate_id', profileId)
        .maybeSingle(),
    ]);

    const role = String((profileRow as any)?.role || '').trim().toLowerCase();
    const primaryRole = String((profileRow as any)?.primary_role || '').trim().toLowerCase();
    const hasAffiliateRole =
      role === 'affiliate' ||
      role === 'partner' ||
      primaryRole === 'affiliate' ||
      primaryRole === 'partner';

    if (hasAffiliateRole || String((affiliateSettingsRow as any)?.affiliate_id || '').trim()) {
      return profileId;
    }
  } catch {
    return null;
  }

  return null;
};

const normalizeProductToken = (value: unknown): string =>
  String(value || '')
    .trim()
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2212]/g, '-');

const pickTierCost = (totalOz: number, tiers: ShippingTier[]): number => {
  const rounded = Math.max(0, totalOz);
  const tier = tiers.find((t) => rounded >= t.min_oz && rounded <= t.max_oz);
  if (tier) return Math.max(0, Math.round(tier.shipping_cents));
  return tiers.length ? Math.max(0, Math.round(tiers[tiers.length - 1].shipping_cents)) : 0;
};

type CartLineItem = {
  product_id: string;
  variant_id?: string | null;
  qty: number;
  unit_price: number; // seller ask
};

type CreateOrderBody = {
  cart: {
    line_items: CartLineItem[];
    shipping_amount: number;
    tax_amount: number;
    currency: string;
  };
  context: {
    seller_id: string;
    buyer_id?: string | null;
    affiliate_id?: string | null;
    referrer_id?: string | null;
    storefront_id?: string | null;
    store_id?: string | null;
    source?: string | null;
    campaign?: string | null;
  };
  customer?: {
    email?: string;
    name?: string;
  };
  shipping_info?: {
    firstName?: string;
    lastName?: string;
    address?: string;
    address2?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
    phone?: string;
    email?: string;
    name?: string;
  };
  success_url?: string;
  cancel_url?: string;
};

const resolveOwnedStorefrontRecord = async (
  supabaseAdmin: any,
  ownerProfileId: string | null,
  type: 'seller' | 'affiliate'
): Promise<{ storefrontId: string | null; storefrontProfileId: string | null; source: string | null }> => {
  const ownerId = String(ownerProfileId || '').trim();
  if (!ownerId) return { storefrontId: null, storefrontProfileId: null, source: null };

  try {
    const { data: storefrontRow } = await supabaseAdmin
      .from('storefronts')
      .select('id, owner_id, type')
      .eq('owner_id', ownerId)
      .eq('type', type)
      .maybeSingle();

    const storefrontId = String((storefrontRow as any)?.id || '').trim();
    const storefrontProfileId = String((storefrontRow as any)?.owner_id || ownerId).trim();
    if (storefrontId) {
      return {
        storefrontId,
        storefrontProfileId,
        source: type === 'affiliate' ? 'affiliate_storefront' : 'seller_storefront',
      };
    }
  } catch {
    // fall through
  }

  return {
    storefrontId: null,
    storefrontProfileId: ownerId,
    source: type === 'affiliate' ? 'affiliate_storefront' : 'seller_storefront',
  };
};

const resolveStorefrontContext = async (
  supabaseAdmin: any,
  rawStorefrontId: string | null,
  orderSource: string | null
): Promise<{ storefrontId: string | null; storefrontProfileId: string | null; source: string | null }> => {
  const candidate = String(rawStorefrontId || '').trim();
  const normalizedSource = String(orderSource || '').trim().toLowerCase();
  if (!candidate) return { storefrontId: null, storefrontProfileId: null, source: normalizedSource || null };

  if (isUuid(candidate)) {
    try {
      const { data: storefrontRow } = await supabaseAdmin
        .from('storefronts')
        .select('id, owner_id, type')
        .eq('id', candidate)
        .maybeSingle();
      const storefrontId = String((storefrontRow as any)?.id || '').trim();
      const ownerId = String((storefrontRow as any)?.owner_id || '').trim();
      const storefrontType = String((storefrontRow as any)?.type || '').trim().toLowerCase();
      if (storefrontId) {
        return {
          storefrontId,
          storefrontProfileId: ownerId || null,
          source:
            storefrontType === 'affiliate'
              ? 'affiliate_storefront'
              : storefrontType === 'seller'
              ? 'seller_storefront'
              : normalizedSource || null,
        };
      }
    } catch {
      // fall through
    }
  }

  const resolveSellerStorefront = async () => {
    const directProfileId = await resolveProfileId(supabaseAdmin, candidate);
    if (directProfileId) {
      return resolveOwnedStorefrontRecord(supabaseAdmin, directProfileId, 'seller');
    }

    const { data: storeRow } = await supabaseAdmin
      .from('store_settings')
      .select('seller_id')
      .eq('subdomain', candidate.toLowerCase())
      .maybeSingle();
    const sellerId = String((storeRow as any)?.seller_id || '').trim();
    if (sellerId) return resolveOwnedStorefrontRecord(supabaseAdmin, sellerId, 'seller');

    const { data: profileRow } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('subdomain', candidate.toLowerCase())
      .maybeSingle();
    const profileId = String((profileRow as any)?.id || '').trim();
    if (profileId) return resolveOwnedStorefrontRecord(supabaseAdmin, profileId, 'seller');
    return { storefrontId: null, storefrontProfileId: null, source: null };
  };

  const resolveAffiliateStorefront = async () => {
    const directAffiliateId = await resolveAffiliateProfileId(supabaseAdmin, candidate);
    if (directAffiliateId) {
      return resolveOwnedStorefrontRecord(supabaseAdmin, directAffiliateId, 'affiliate');
    }

    const { data: affiliateRow } = await supabaseAdmin
      .from('affiliate_store_settings')
      .select('affiliate_id')
      .eq('subdomain', candidate.toLowerCase())
      .maybeSingle();
    const affiliateId = String((affiliateRow as any)?.affiliate_id || '').trim();
    if (affiliateId) return resolveOwnedStorefrontRecord(supabaseAdmin, affiliateId, 'affiliate');

    return { storefrontId: null, storefrontProfileId: null, source: null };
  };

  if (normalizedSource === 'seller_storefront') return resolveSellerStorefront();
  if (normalizedSource === 'affiliate_storefront') return resolveAffiliateStorefront();

  const affiliateContext = await resolveAffiliateStorefront();
  if (affiliateContext.storefrontProfileId) return affiliateContext;

  const sellerContext = await resolveSellerStorefront();
  if (sellerContext.storefrontProfileId) return sellerContext;

  return { storefrontId: null, storefrontProfileId: null, source: normalizedSource || null };
};

export const handler: Handler = async (event) => {
  try {
    assertPost(event.httpMethod);
    if (!isPayPalEnabled()) return json(503, { error: 'Payments are temporarily unavailable.', code: 'PAYMENTS_PAUSED' });

    // Explicit config check (avoids generic 500s when env vars are missing).
    const paypalEnv = await getPayPalEnv();
    const clientId = paypalEnv === 'live'
      ? String(process.env.PAYPAL_LIVE_CLIENT_ID || process.env.PAYPAL_CLIENT_ID || '').trim()
      : String(process.env.PAYPAL_SANDBOX_CLIENT_ID || process.env.PAYPAL_CLIENT_ID || '').trim();
    const clientSecret = paypalEnv === 'live'
      ? String(process.env.PAYPAL_LIVE_CLIENT_SECRET || process.env.PAYPAL_CLIENT_SECRET || '').trim()
      : String(process.env.PAYPAL_SANDBOX_CLIENT_SECRET || process.env.PAYPAL_CLIENT_SECRET || '').trim();
    if (!clientId || !clientSecret) {
      return json(503, { error: 'PayPal is not configured.', code: 'PAYPAL_NOT_CONFIGURED' });
    }

    const body = parseJson<CreateOrderBody>(event.body);

    // Fee policy lock: client-side fee overrides are forbidden for non-admin callers.
    // If override-like fields are present, require admin auth and reject otherwise.
    const overrideKeys = [
      'beezio_rate',
      'platform_rate',
      'influencer_rate',
      'paypal_pct',
      'paypal_fixed',
      'payout_buffer',
      'partner_rate',
      'fee_overrides',
      'pricing_overrides',
      'admin_overrides',
    ];
    const hasOverridePayload = overrideKeys.some((k) => Object.prototype.hasOwnProperty.call(body || {}, k))
      || overrideKeys.some((k) => Object.prototype.hasOwnProperty.call((body as any)?.context || {}, k));
    if (hasOverridePayload) {
      try {
        await requireAdmin(event as any);
      } catch {
        return json(403, {
          error: 'Fee overrides are admin-only.',
          code: 'FEE_OVERRIDE_FORBIDDEN',
        });
      }
    }

    const currency = String(body?.cart?.currency || 'USD').toUpperCase();

    const lineItems = Array.isArray(body?.cart?.line_items) ? body.cart.line_items : [];
    const requestedSellerId = String(body?.context?.seller_id || '').trim();
    const requestedBuyerId = body?.context?.buyer_id ? String(body.context.buyer_id).trim() : null;
    const requestedPartnerId = body?.context?.affiliate_id ? String(body.context.affiliate_id).trim() : null;
    const explicitReferrerId = body?.context?.referrer_id ? String(body.context.referrer_id).trim() : null;
    const storefrontId = body?.context?.storefront_id
      ? String(body.context.storefront_id).trim()
      : body?.context?.store_id
        ? String(body.context.store_id).trim()
        : null;
    const orderSource = body?.context?.source ? String(body.context.source).trim() : null;
    const orderCampaign = body?.context?.campaign ? String(body.context.campaign).trim() : null;

    if (!lineItems.length) return json(400, { error: 'Missing cart line_items' });

    const shippingAmountClient = Number(body?.cart?.shipping_amount ?? 0) || 0;
    const taxAmountClient = Number(body?.cart?.tax_amount ?? 0) || 0;

    if (shippingAmountClient < 0) return json(400, { error: 'Invalid shipping amount' });
    if (taxAmountClient < 0) return json(400, { error: 'Invalid tax amount' });

    const paypalPct = LOCKED_PAYPAL_PERCENT;
    const paypalFixed = LOCKED_PAYPAL_FIXED;
    const payoutBuffer = LOCKED_PAYOUT_BUFFER;

    const supabaseAdmin = createSupabaseAdmin();
    const buyerId = await resolveProfileId(supabaseAdmin, requestedBuyerId);
    const storefrontContext = await resolveStorefrontContext(supabaseAdmin, storefrontId, orderSource);
    const resolvedStorefrontId = storefrontContext.storefrontId;
    const resolvedStorefrontProfileId = storefrontContext.storefrontProfileId;
    const resolvedOrderSource = storefrontContext.source || orderSource;
    const requestedPartnerProfileId = await resolveAffiliateProfileId(supabaseAdmin, requestedPartnerId);
    const explicitReferrerProfileId = await resolveProfileId(supabaseAdmin, explicitReferrerId);
    let rawPartnerId =
      requestedPartnerProfileId ||
      (resolvedOrderSource === 'affiliate_storefront'
        ? await resolveAffiliateProfileId(supabaseAdmin, resolvedStorefrontProfileId)
        : null);

    const isInfluencerProfile = async (profileId: string | null): Promise<boolean> => {
      if (!profileId) return false;

      const { data: profileRow } = await supabaseAdmin
        .from('profiles')
        .select('role,primary_role')
        .eq('id', profileId)
        .maybeSingle();

      const role = String((profileRow as any)?.role || '').toLowerCase();
      const primaryRole = String((profileRow as any)?.primary_role || '').toLowerCase();
      return role === 'influencer' || primaryRole === 'influencer';
    };

    // Fetch product names + commission percents (best-effort)
    const productTokens = Array.from(new Set(lineItems.map((li) => normalizeProductToken(li.product_id)).filter(Boolean)));
    const productMap = new Map<string, any>(); // canonical product id -> product row
    const tokenToProduct = new Map<string, any>(); // requested token -> product row
    let productsByIdCount = 0;
    let productsByExternalIdCount = 0;
    let productsByIdError: string | null = null;
    let productsByExternalIdError: string | null = null;
    if (productTokens.length) {
      const idLookup = await fetchProductsByField(supabaseAdmin, 'id', productTokens);
      const productsById = idLookup.rows;
      productsByIdCount = productsById.length;
      productsByIdError = idLookup.errorMessage;
      for (const p of (productsById as any[]) || []) {
        if (!p?.id) continue;
        const canonicalId = String(p.id).trim();
        if (!isUuid(canonicalId)) continue;
        productMap.set(canonicalId, p);
        tokenToProduct.set(normalizeProductToken(canonicalId), p);
      }

      const unresolvedTokens = productTokens.filter((token) => !tokenToProduct.has(token));
      if (unresolvedTokens.length) {
        const externalLookup = await fetchProductsByField(supabaseAdmin, 'external_id', unresolvedTokens);
        const productsByExternalId = externalLookup.rows;
        productsByExternalIdCount = productsByExternalId.length;
        productsByExternalIdError = externalLookup.errorMessage;
        for (const p of (productsByExternalId as any[]) || []) {
          if (!p?.id) continue;
          const canonicalId = String(p.id).trim();
          if (!isUuid(canonicalId)) continue;
          const externalToken = normalizeProductToken(p.external_id);
          productMap.set(canonicalId, p);
          if (externalToken) tokenToProduct.set(externalToken, p);
          tokenToProduct.set(normalizeProductToken(canonicalId), p);
        }
      }
    }

    const missingProductId = productTokens.find((token) => !tokenToProduct.has(token));
    if (missingProductId) {
      return json(400, {
        error: `Product not found: ${missingProductId}`,
        details: {
          attemptedTokens: productTokens,
          productsByIdCount,
          productsByIdError,
          productsByExternalIdCount,
          productsByExternalIdError,
          resolvedCount: tokenToProduct.size,
        },
      });
    }

    const hasDigitalProduct = productTokens.some((token) => tokenToProduct.get(token)?.is_digital === true);
    if (hasDigitalProduct && !buyerId) {
      return json(400, {
        error: 'You must sign in to purchase digital products so delivery stays secure.',
        code: 'DIGITAL_LOGIN_REQUIRED',
      });
    }

    const sellerIds = Array.from(new Set(productTokens.map((token) => String(tokenToProduct.get(token)?.seller_id || '').trim()).filter(Boolean)));
    if (sellerIds.length !== 1) {
      return json(400, { error: 'Your cart contains items from multiple sellers. Please checkout one seller at a time.' });
    }
    const sellerId = sellerIds[0];
    if (sameProfileId(buyerId, sellerId)) {
      return json(400, {
        error: 'Buyer cannot be the seller on the same checkout.',
        code: 'BUYER_SELLER_CONFLICT',
      });
    }
    if (requestedSellerId && requestedSellerId !== sellerId) {
      return json(400, { error: 'Seller mismatch for cart items.' });
    }

    if (!rawPartnerId) {
      rawPartnerId = await resolveSingleAffiliateFallback(supabaseAdmin, sellerIds.length ? productTokens.map((token) => String(tokenToProduct.get(token)?.id || '').trim()).filter(Boolean) : []);
    }

    const partnerId = sameProfileId(rawPartnerId, buyerId) ? null : rawPartnerId;

    const sellerRecruiterInfluencerIdRaw = await resolveRecruiterInfluencerId(supabaseAdmin, sellerId, 'seller');
    const partnerRecruiterInfluencerIdRaw = await resolveRecruiterInfluencerId(supabaseAdmin, partnerId, 'affiliate');
    const sellerRecruiterInfluencerId = sameProfileId(sellerRecruiterInfluencerIdRaw, buyerId) ? null : sellerRecruiterInfluencerIdRaw;
    const partnerRecruiterInfluencerId = sameProfileId(partnerRecruiterInfluencerIdRaw, buyerId) ? null : partnerRecruiterInfluencerIdRaw;
    const partnerIsInfluencer = await isInfluencerProfile(partnerId);
    // Keep explicit checkout referrers on the order, but let capture finalization resolve
    // seller-vs-affiliate recruiter slots from influencer_referrals so both roles can pay correctly.
    const inferredPartnerInfluencerId = partnerRecruiterInfluencerId || (partnerIsInfluencer && !sameProfileId(partnerId, buyerId) ? partnerId : null) || null;
    const inferredSellerInfluencerId = sellerRecruiterInfluencerId || null;
    const rawInfluencerId = explicitReferrerProfileId || null;
    const influencerId = sameProfileId(rawInfluencerId, buyerId) ? null : rawInfluencerId;
    const hasInfluencerSlot = Boolean(influencerId || inferredPartnerInfluencerId || inferredSellerInfluencerId);

    const cjCostMap = new Map<string, any>();
    const canonicalProductIds = Array.from(new Set(Array.from(tokenToProduct.values()).map((p: any) => String(p?.id || '').trim()).filter(Boolean)));
    if (canonicalProductIds.length) {
      const { data: mappings } = await supabaseAdmin
        .from('cj_product_mappings')
        .select('beezio_product_id, cj_product_id, cj_variant_id, cj_cost, price_breakdown')
        .in('beezio_product_id', canonicalProductIds);
      for (const row of (mappings as any[]) || []) {
        if (row?.beezio_product_id) cjCostMap.set(String(row.beezio_product_id), row);
      }
    }

    const variantTokens = Array.from(new Set(lineItems.map((li) => normalizeProductToken(li.variant_id)).filter(Boolean)));
    const variantMap = new Map<string, any>();
    if (variantTokens.length) {
      const variantUuidIds = variantTokens.filter((token) => isUuid(token));
      if (variantUuidIds.length) {
        const variantLookup = await fetchVariantsByField(supabaseAdmin, 'id', variantUuidIds);
        for (const v of (variantLookup.rows as any[]) || []) {
          const canonicalVariantId = String(v?.id || '').trim();
          if (!isUuid(canonicalVariantId)) continue;
          variantMap.set(normalizeProductToken(canonicalVariantId), v);
        }
      }

      const unresolvedVariantTokens = variantTokens.filter((token) => !variantMap.has(token));
      if (unresolvedVariantTokens.length && canonicalProductIds.length) {
        const productVariantLookup = await fetchVariantsByField(supabaseAdmin, 'product_id', canonicalProductIds);
        for (const v of (productVariantLookup.rows as any[]) || []) {
          const canonicalVariantId = String(v?.id || '').trim();
          if (!isUuid(canonicalVariantId)) continue;

          const candidateTokens = new Set<string>();
          candidateTokens.add(normalizeProductToken(canonicalVariantId));

          for (const rawCandidate of [
            v?.external_variant_id,
            v?.cj_variant_id,
            v?.cj_vid,
            v?.sku,
            v?.variant_display_sku,
          ]) {
            const candidate = normalizeProductToken(rawCandidate);
            if (candidate) candidateTokens.add(candidate);
          }

          const searchableCodes = Array.isArray(v?.searchable_codes) ? v.searchable_codes : [];
          for (const code of searchableCodes) {
            const candidate = normalizeProductToken(code);
            if (candidate) candidateTokens.add(candidate);
          }

          for (const candidate of candidateTokens) {
            if (unresolvedVariantTokens.includes(candidate)) {
              variantMap.set(candidate, v);
            }
          }
        }
      }
    }

    // Seller defaults (best-effort)
    let defaultPartnerPercent = 0;
    {
      const { data: sellerRow } = await supabaseAdmin
        .from('sellers')
        .select('default_partner_commission_percent')
        .eq('id', sellerId)
        .maybeSingle();
      const val = Number((sellerRow as any)?.default_partner_commission_percent);
      defaultPartnerPercent = Number.isFinite(val) ? Math.max(0, val) : 0;
    }

    const askTotal = lineItems.reduce((acc, li) => {
      const qty = Math.max(1, Math.floor(Number(li.qty || 0)));
      const token = normalizeProductToken(li.product_id);
      const prod = tokenToProduct.get(token);
      const ask = Math.max(
        0,
        Number(
          prod?.seller_ask ??
          prod?.seller_amount ??
          prod?.seller_ask_price ??
          0
        )
      );
      return acc + ask * qty;
    }, 0);

    // Compute listing subtotal (pre tax/shipping) with PayPal model.
    let subtotalListing = 0;
    const computedItems: Array<{
      productId: string;
      name: string;
      quantity: number;
      ask: number;
      configuredAffiliatePercent: number;
      partnerRate: number;
      influencerRate: number;
      beezioRate: number;
      listingUnit: number;
      variantId?: string | null;
      platformFeeGrossUnit?: number | null;
      platformFeeNetUnit?: number | null;
      cjCostUnit?: number | null;
      beezioCjProfitUnit?: number | null;
    }> = [];

    for (const li of lineItems) {
      const token = normalizeProductToken(li.product_id);
      const resolved = tokenToProduct.get(token);
      const productId = String(resolved?.id || '').trim();
      const variantToken = normalizeProductToken(li.variant_id);
      const variant = variantToken ? variantMap.get(variantToken) : null;
      const variantId = isUuid(variant?.id) ? String(variant.id).trim() : null;
      const qty = Math.max(1, Math.floor(Number(li.qty || 0)));
      const prod = resolved;
      if (!resolved || !isUuid(productId)) {
        return json(400, {
          error: 'Invalid product reference in cart. Please refresh your cart and try again.',
          code: 'INVALID_PRODUCT_REFERENCE',
          details: {
            product_token: token,
            resolved_product_id: resolved?.id ?? null,
          },
        });
      }
      const askRaw = Math.max(
        0,
        Number(
          prod?.seller_ask ??
          prod?.seller_amount ??
          prod?.seller_ask_price ??
          0
        )
      );
      const ask = askRaw > 0 ? askRaw : canonicalListingUnit;
      if (!productId) continue;
      if (ask <= 0) {
        return json(400, {
          error: `Missing seller ask for product ${productId}.`,
          code: 'MISSING_SELLER_ASK',
        });
      }
      const title = String(prod?.title || prod?.name || 'Item');

      const beezioRate = LOCKED_PLATFORM_RATE;
      const affiliateEnabled = (prod?.affiliate_enabled ?? true) !== false;
      const configuredAffiliateRate = affiliateEnabled ? resolveAffiliateCommissionRate(
        prod,
        ask,
        defaultPartnerPercent
      ) : 0;
      const partnerRate = partnerId ? configuredAffiliateRate : 0;
      const pricingPartnerRate = configuredAffiliateRate;
      const influencerRate = 0;

      if (!(askTotal > 0)) return json(400, { error: 'Invalid cart subtotal' });
      const lineAskTotal = ask * qty;
      const fixedShare = (paypalFixed * lineAskTotal) / askTotal;
      const bufferShare = (payoutBuffer * lineAskTotal) / askTotal;
      const lineListingTotal = isTestItemTitle(title)
        ? round2(TEST_ITEM_PRICE * qty)
        : computeListingPrice({
            ask: lineAskTotal,
            partnerRate: pricingPartnerRate,
            influencerActive: hasInfluencerSlot,
            beezioRate,
            beezioMinimum: getEnvNumber('BEEZIO_PLATFORM_FEE_MIN', LOCKED_PLATFORM_FEE_MIN_PER_ITEM),
            beezioCap: getEnvNumber('BEEZIO_PLATFORM_FEE_CAP', LOCKED_PLATFORM_FEE_CAP),
            beezioLargeOrderThreshold: getEnvNumber('BEEZIO_PLATFORM_FEE_LARGE_ORDER_THRESHOLD', LOCKED_LARGE_ORDER_THRESHOLD),
            beezioLargeOrderFlatFee: getEnvNumber('BEEZIO_PLATFORM_FEE_LARGE_ORDER_FLAT', LOCKED_LARGE_ORDER_FEE),
            paypalPct,
            paypalFixed: fixedShare,
            payoutBuffer: bufferShare,
          });
      const listingUnit = round2(lineListingTotal / qty);
      subtotalListing += listingUnit * qty;

      const platformFeeGrossUnit = round2(getPlatformFeeForAsk(ask));
      const platformFeeNetUnit = platformFeeGrossUnit;
      const cjMapping = cjCostMap.get(productId);
      const cjCost = Number(cjMapping?.cj_cost ?? cjMapping?.price_breakdown?.cjCost ?? NaN);
      const cjCostUnit = Number.isFinite(cjCost) ? round2(cjCost) : null;
      const beezioCjProfitUnit = Number.isFinite(cjCost)
        ? round2(Math.max(0, ask - cjCost))
        : null;

      computedItems.push({
        productId,
        name: title,
        quantity: qty,
        ask,
        configuredAffiliatePercent: round2(configuredAffiliateRate * 100),
        partnerRate,
        influencerRate,
        beezioRate,
        listingUnit,
        variantId,
        platformFeeGrossUnit,
        platformFeeNetUnit,
        cjCostUnit,
        beezioCjProfitUnit,
      });
    }

    subtotalListing = round2(subtotalListing);

    const strictCJInventory = String(process.env.CJ_STRICT_STOCK_REQUIRED || 'false').trim().toLowerCase() === 'true';
    const inventoryErrors: Array<{ product_id: string; variant_id: string | null; requested_qty: number; available_qty: number | null; reason: string; title?: string }> = [];
    const cjDemandByKey = new Map<string, { pid: string; vid?: string; productId: string; variantId: string | null; title: string; qty: number }>();

    const getIsCJ = (product: any): boolean => {
      const dropshipProvider = String(product?.dropship_provider || '').trim().toLowerCase();
      const lineage = String(product?.lineage || '').trim().toLowerCase();
      return dropshipProvider === 'cj' || lineage === 'cj';
    };

    const shouldUseCjInventory = (product: any, variant: any): boolean => {
      const variantInventorySource = String(variant?.inventory_source || '').trim().toLowerCase();
      if (variantInventorySource) return variantInventorySource === 'cj';
      const productInventorySource = String(product?.inventory_source || '').trim().toLowerCase();
      if (productInventorySource) return productInventorySource === 'cj';
      return getIsCJ(product) || String(variant?.source_platform || '').trim().toLowerCase() === 'cj';
    };

    for (const li of lineItems) {
      const qty = Math.max(1, Math.floor(Number(li.qty || 0)));
      const token = normalizeProductToken(li.product_id);
      const product = tokenToProduct.get(token);
      const productId = String(product?.id || token).trim();
      const title = String(product?.title || product?.name || 'Item');
      const variantToken = normalizeProductToken(li.variant_id);
      const variant = variantToken ? variantMap.get(variantToken) : null;
      const variantId = isUuid(variant?.id) ? String(variant.id).trim() : null;

      const trackInventory = product?.track_inventory !== false;
      const allowBackorder = shouldUseCjInventory(product, variant);
      const productInStockFlag =
        typeof product?.in_stock === 'boolean' ? Boolean(product.in_stock) : null;
      const productStockRaw = Number(product?.stock_quantity ?? product?.total_inventory);
      const productStock = Number.isFinite(productStockRaw) ? Math.max(0, Math.floor(productStockRaw)) : null;
      if (trackInventory && !allowBackorder && variantId) {
        const variantActive = variant?.is_active !== false;
        const inventoryPolicy = String(variant?.inventory_policy || 'deny').trim().toLowerCase();
        const variantExplicitInStock =
          typeof variant?.in_stock === 'boolean' ? Boolean(variant.in_stock) : null;
        const variantInvRaw = Number(variant?.inventory);
        const variantInventory = Number.isFinite(variantInvRaw) ? Math.max(0, Math.floor(variantInvRaw)) : null;

        if (!variantActive) {
          inventoryErrors.push({
            product_id: productId,
            variant_id: variantId,
            requested_qty: qty,
            available_qty: 0,
            reason: 'VARIANT_INACTIVE',
            title,
          });
          continue;
        }

        if (inventoryPolicy !== 'continue' && variantInventory !== null && variantInventory < qty) {
          inventoryErrors.push({
            product_id: productId,
            variant_id: variantId,
            requested_qty: qty,
            available_qty: variantInventory,
            reason: 'VARIANT_INSUFFICIENT',
            title,
          });
          continue;
        }

        if (inventoryPolicy !== 'continue' && variantInventory === null && variantExplicitInStock === false) {
          inventoryErrors.push({
            product_id: productId,
            variant_id: variantId,
            requested_qty: qty,
            available_qty: null,
            reason: 'VARIANT_OUT_OF_STOCK',
            title,
          });
          continue;
        }
      } else if (trackInventory && !allowBackorder && productStock !== null && productStock < qty) {
        inventoryErrors.push({
          product_id: productId,
          variant_id: null,
          requested_qty: qty,
          available_qty: productStock,
          reason: 'PRODUCT_INSUFFICIENT',
          title,
        });
        continue;
      } else if (trackInventory && !allowBackorder && productStock === null && productInStockFlag === false) {
        inventoryErrors.push({
          product_id: productId,
          variant_id: null,
          requested_qty: qty,
          available_qty: null,
          reason: 'PRODUCT_OUT_OF_STOCK',
          title,
        });
        continue;
      }

      const isCJ = allowBackorder;
      if (!isCJ) continue;
      if (!variantId) {
        inventoryErrors.push({
          product_id: productId,
          variant_id: null,
          requested_qty: qty,
          available_qty: null,
          reason: 'CJ_VARIANT_REQUIRED',
          title,
        });
        continue;
      }
      const variantValidation = await validateCjOrderVariant({
        supabaseAdmin,
        productId,
        variantId,
      });
      if (!variantValidation.ok) {
        inventoryErrors.push({
          product_id: productId,
          variant_id: variantId,
          requested_qty: qty,
          available_qty: null,
          reason: 'CJ_MAPPING_INVALID',
          title,
        });
        continue;
      }

      const mapping = cjCostMap.get(productId);
      const pid = String(variant?.cj_product_id || mapping?.cj_product_id || '').trim();
      const vid = String(variantValidation.orderReference || variant?.cj_vid || variant?.cj_variant_id || mapping?.cj_variant_id || '').trim() || undefined;
      if (!pid) {
        inventoryErrors.push({
          product_id: productId,
          variant_id: variantId,
          requested_qty: qty,
          available_qty: null,
          reason: 'CJ_MAPPING_MISSING',
          title,
        });
        continue;
      }

      const demandKey = `${pid}::${vid || ''}`;
      const existingDemand = cjDemandByKey.get(demandKey);
      if (existingDemand) {
        existingDemand.qty += qty;
      } else {
        cjDemandByKey.set(demandKey, {
          pid,
          vid,
          productId,
          variantId,
          title,
          qty,
        });
      }
    }

    if (inventoryErrors.length > 0) {
      return json(409, {
        error: 'Some cart items are no longer in stock.',
        code: 'INSUFFICIENT_INVENTORY',
        items: inventoryErrors,
      });
    }

    if (cjDemandByKey.size > 0) {
      for (const demand of cjDemandByKey.values()) {
        let available: number | null = null;
        try {
          available = await getCJInventory(demand.pid, demand.vid);
        } catch {
          available = null;
        }

        const verifyFailed = available === null;
        const insufficient = typeof available === 'number' && available < demand.qty;

        if ((strictCJInventory && verifyFailed) || insufficient) {
          inventoryErrors.push({
            product_id: demand.productId,
            variant_id: demand.variantId,
            requested_qty: demand.qty,
            available_qty: available,
            reason: insufficient ? 'CJ_INSUFFICIENT' : 'CJ_UNVERIFIED',
            title: demand.title,
          });
        }
      }

      if (inventoryErrors.length > 0) {
        return json(409, {
          error: 'Some CJ items are not currently available in live supplier inventory.',
          code: 'INSUFFICIENT_CJ_INVENTORY',
          strict_cj_inventory: strictCJInventory,
          items: inventoryErrors,
        });
      }
    }

    const taxCollectionDisabled = String(process.env.DISABLE_TAX_COLLECTION || '').trim().toLowerCase() === 'true';
    const configuredPaymentTaxRate = Number(String(process.env.PAYMENT_TAX_RATE || '').trim());
    const configuredFallbackTaxRate = Number(String(process.env.TAX_RATE || '').trim());
    const effectiveTaxRate = taxCollectionDisabled
      ? 0
      : Number.isFinite(configuredPaymentTaxRate) && configuredPaymentTaxRate > 0
        ? configuredPaymentTaxRate
        : Number.isFinite(configuredFallbackTaxRate) && configuredFallbackTaxRate > 0
          ? configuredFallbackTaxRate
          : null;
    const taxAmount = effectiveTaxRate !== null
      ? round2(subtotalListing * effectiveTaxRate)
      : round2(Math.max(0, taxAmountClient));

    // Server-side shipping calculation (non-CJ + CJ weight tiers).
    let nonCJShippingTotal = 0;
    let cjTotalWeightOz = 0;
    let hasCJ = false;

    for (const li of lineItems) {
      const productId = String(li.product_id || '').trim();
      if (!productId) continue;
      const product = tokenToProduct.get(normalizeProductToken(productId));
      const requiresShipping = product?.is_digital === true ? false : product?.requires_shipping !== false;
      if (!requiresShipping) continue;

      const isCJ = getIsCJ(product);
      if (isCJ) {
        hasCJ = true;
        const variantId = li.variant_id ? String(li.variant_id).trim() : null;
        if (!variantId) {
          return json(400, { error: 'CJ products require a selected variant before checkout.' });
        }
        const variantValidation = await validateCjOrderVariant({
          supabaseAdmin,
          productId,
          variantId,
        });
        if (!variantValidation.ok) {
          return json(400, { error: variantValidation.reason || 'CJ variant mapping is incomplete.' });
        }
        const variant = variantId ? variantMap.get(variantId) : null;
        const variantWeight = variant ? Math.max(0, safeNumber(variant?.weight_oz, 0)) : 0;
        const baseWeight = Math.max(0, safeNumber(product?.base_weight_oz, 0));
        const weightOz = variantWeight > 0 ? variantWeight : baseWeight;
        if (weightOz <= 0) {
          return json(400, { error: 'Missing shipping weight for CJ product.' });
        }
        const qty = Math.max(1, Math.floor(Number(li.qty || 0)));
        cjTotalWeightOz += weightOz * qty;
        continue;
      }

      const baseShipping = Number(product?.shipping_cost ?? product?.shipping_price ?? 0) || 0;
      const qty = Math.max(1, Math.floor(Number(li.qty || 0)));
      nonCJShippingTotal += round2(baseShipping * qty);
    }
    nonCJShippingTotal = round2(nonCJShippingTotal);

    let cjShippingTotal = 0;
    if (hasCJ) {
      let tiers: ShippingTier[] = DEFAULT_SHIPPING_TIERS;
      try {
        const { data: ruleRows } = await supabaseAdmin
          .from('shipping_rules')
          .select('tiers_json')
          .eq('name', 'default')
          .limit(1);
        const tiersRaw = (ruleRows || [])[0]?.tiers_json;
        if (Array.isArray(tiersRaw) && tiersRaw.length) {
          tiers = tiersRaw as ShippingTier[];
        }
      } catch {
        // fall back to defaults
      }

      const shippingCents = pickTierCost(cjTotalWeightOz, tiers);
      cjShippingTotal = Math.round((shippingCents / 100 + Number.EPSILON) * 100) / 100;
    }

    const shippingAmount = round2(nonCJShippingTotal + cjShippingTotal);

    const totalCharged = round2(subtotalListing + shippingAmount + taxAmount);

    if (!computedItems.length || subtotalListing <= 0) {
      return json(400, { error: 'Unable to compute listing price for cart' });
    }

    const beezioOrderId = crypto.randomUUID();
    const orderNumber = createBeezioOrderNumber(beezioOrderId);

    const purchaseUnitItems = computedItems.map((it) => ({
      name: it.name.slice(0, 120),
      quantity: String(it.quantity),
      unit_amount: { currency_code: currency, value: toAmountString(it.listingUnit) },
      category: productMap.get(it.productId)?.is_digital === true ? 'DIGITAL_GOODS' : 'PHYSICAL_GOODS',
    }));

    const extractMissingColumnName = (message: string): string | null => {
      const msg = String(message || '');
      const pg = msg.match(/column\s+"([^"]+)"\s+of\s+relation\s+"[^"]+"\s+does\s+not\s+exist/i);
      if (pg?.[1]) return pg[1];
      const pgDot = msg.match(/column\s+([a-z0-9_]+\.[a-z0-9_]+)\s+does\s+not\s+exist/i);
      if (pgDot?.[1]) return pgDot[1].split('.').pop() || pgDot[1];
      const pgrst = msg.match(/Could not find the '([^']+)' column of '[^']+' in the schema cache/i);
      if (pgrst?.[1]) return pgrst[1];
      return null;
    };

    const insertWithFallback = async (table: string, payload: any) => {
      let attemptPayload = payload;
      let lastError: any = null;
      for (let attempt = 0; attempt < 24; attempt += 1) {
        const { error } = await supabaseAdmin.from(table).insert(attemptPayload as any);
        if (!error) return { error: null };
        lastError = error;
        const message = [
          String((error as any)?.message || ''),
          String((error as any)?.details || ''),
          String((error as any)?.hint || ''),
        ]
          .join(' ')
          .trim();
        const missing = extractMissingColumnName(message);
        if (missing) {
          if (Array.isArray(attemptPayload)) {
            attemptPayload = attemptPayload.map((row) => {
              const clone = { ...row };
              delete clone[missing];
              return clone;
            });
          } else if (Object.prototype.hasOwnProperty.call(attemptPayload, missing)) {
            const clone = { ...attemptPayload };
            delete clone[missing];
            attemptPayload = clone;
          } else {
            break;
          }
          continue;
        }
        if (message.toLowerCase().includes('invalid input value for enum')) {
          const enumFields = ['status', 'payment_status'];
          let removed = false;
          if (Array.isArray(attemptPayload)) {
            attemptPayload = attemptPayload.map((row) => {
              const clone = { ...row };
              for (const field of enumFields) {
                if (Object.prototype.hasOwnProperty.call(clone, field)) {
                  delete clone[field];
                  removed = true;
                }
              }
              return clone;
            });
          } else {
            const clone = { ...attemptPayload };
            for (const field of enumFields) {
              if (Object.prototype.hasOwnProperty.call(clone, field)) {
                delete clone[field];
                removed = true;
              }
            }
            attemptPayload = clone;
          }
          if (removed) continue;
        }
        break;
      }
      return { error: lastError };
    };

    const updateWithFallback = async (table: string, filterColumn: string, filterValue: string, payload: Record<string, any>) => {
      let attemptPayload = { ...payload };
      let lastError: any = null;
      for (let attempt = 0; attempt < 24; attempt += 1) {
        const { error } = await supabaseAdmin.from(table).update(attemptPayload as any).eq(filterColumn, filterValue);
        if (!error) return { error: null };
        lastError = error;
        const message = [
          String((error as any)?.message || ''),
          String((error as any)?.details || ''),
          String((error as any)?.hint || ''),
        ]
          .join(' ')
          .trim();
        const missing = extractMissingColumnName(message);
        if (missing && Object.prototype.hasOwnProperty.call(attemptPayload, missing)) {
          const clone = { ...attemptPayload };
          delete clone[missing];
          attemptPayload = clone;
          continue;
        }
        if (message.toLowerCase().includes('invalid input value for enum')) {
          const clone = { ...attemptPayload };
          let removed = false;
          for (const field of ['status', 'payment_status']) {
            if (Object.prototype.hasOwnProperty.call(clone, field)) {
              delete clone[field];
              removed = true;
            }
          }
          if (removed) {
            attemptPayload = clone;
            continue;
          }
        }
        break;
      }
      return { error: lastError };
    };

    // Persist DB order draft (schema-flexible)
    const orderPayload = {
      id: beezioOrderId,
      order_number: orderNumber,
      buyer_id: buyerId,
      seller_id: sellerId,
      partner_id: partnerId,
      affiliate_id: partnerId,
      influencer_id: influencerId,
      referrer_id: influencerId,
      storefront_id: resolvedStorefrontId,
      store_id: resolvedStorefrontId,
      source: resolvedOrderSource,
      campaign: orderCampaign,
      currency,
      status: 'created',
      payment_status: 'unpaid',
      payment_provider: 'PAYPAL',
      provider_order_id: null,
      subtotal_listing: subtotalListing,
      items_subtotal: subtotalListing,
      shipping_amount: shippingAmount,
      tax_amount: taxAmount,
      total_charged: totalCharged,
      total_amount: totalCharged,
      billing_name: body?.customer?.name || null,
      billing_email: body?.customer?.email || null,
      shipping_address: body?.shipping_info || null,
      created_at: new Date().toISOString(),
    };

    const { error: orderError } = await insertWithFallback('orders', orderPayload);
    if (orderError) return json(500, { error: 'Failed to create order', details: orderError.message });

    const orderItemsPayload = computedItems.map((it) => {
      const variantId = it.variantId ? String(it.variantId).trim() : null;
      const variant = variantId ? variantMap.get(variantId) : null;
      const product = productMap.get(it.productId);
      const sourcePlatform = String(variant?.source_platform || product?.source_platform || '').trim() || null;
      const externalProductId = String(variant?.external_product_id || product?.external_id || '').trim() || null;
      const externalVariantId = String(variant?.external_variant_id || '').trim() || null;
      const unitPrice = round2(it.listingUnit);
      const affiliateCommissionRate = round2(it.configuredAffiliatePercent || 0);
      const platformPercentAtPurchase = round2(it.beezioRate * 100);

      return {
        order_id: beezioOrderId,
        product_id: it.productId,
        quantity: it.quantity,
        price: unitPrice,
        final_sale_price_per_unit: unitPrice,
        seller_ask_price_per_unit: it.ask,
        affiliate_commission_percent_at_purchase: affiliateCommissionRate,
        platform_percent_at_purchase: platformPercentAtPurchase,
        seller_ask_amount: it.ask,
        partner_rate: it.partnerRate,
        influencer_rate: it.influencerRate,
        beezio_rate: it.beezioRate,
        computed_listing_price: it.listingUnit,
        variant_id: variantId,
        sku: variant?.sku || null,
        cj_product_id: variant?.cj_product_id || null,
        cj_variant_id: variant?.cj_vid || variant?.cj_variant_id || null,
        source_platform: sourcePlatform,
        external_product_id: externalProductId,
        external_variant_id: externalVariantId,
      };
    });

    const { error: itemsError } = await insertWithFallback('order_items', orderItemsPayload);
    if (itemsError) {
      // best-effort rollback
      await supabaseAdmin.from('orders').delete().eq('id', beezioOrderId);
      return json(500, { error: 'Failed to create order items', details: itemsError.message });
    }

    const provider = getPaymentProvider('paypal');
    let providerOrderId = '';
    try {
      const providerResult = await provider.createOrder({
        currency,
        subtotal: subtotalListing,
        shipping: shippingAmount,
        tax: taxAmount,
        items: purchaseUnitItems.map((it) => ({
          name: it.name,
          quantity: Number(it.quantity),
          unit_amount: Number(it.unit_amount.value),
        })),
        referenceId: beezioOrderId,
        requestId: paypalRequestId(`bzo_${beezioOrderId}`),
      });
      providerOrderId = String(providerResult?.providerOrderId || '').trim();
    } catch (providerError: any) {
      await supabaseAdmin.from('order_items').delete().eq('order_id', beezioOrderId);
      await supabaseAdmin.from('orders').delete().eq('id', beezioOrderId);
      return json(502, {
        error: 'Failed to create PayPal order',
        details: providerError instanceof Error ? providerError.message : 'Unknown provider error',
        code: 'PAYPAL_CREATE_ORDER_FAILED',
      });
    }
    if (!providerOrderId) {
      await supabaseAdmin.from('order_items').delete().eq('order_id', beezioOrderId);
      await supabaseAdmin.from('orders').delete().eq('id', beezioOrderId);
      return json(502, {
        error: 'Failed to create PayPal order',
        details: 'Provider did not return an order id.',
        code: 'PAYPAL_CREATE_ORDER_FAILED',
      });
    }

    const { error: providerOrderUpdateError } = await updateWithFallback('orders', 'id', beezioOrderId, {
      provider_order_id: providerOrderId,
      updated_at: new Date().toISOString(),
    });
    if (providerOrderUpdateError) {
      await supabaseAdmin.from('order_items').delete().eq('order_id', beezioOrderId);
      await supabaseAdmin.from('orders').delete().eq('id', beezioOrderId);
      return json(500, {
        error: 'Failed to link local order to PayPal order',
        details: providerOrderUpdateError.message,
      });
    }

    return json(200, {
      ok: true,
      orderID: providerOrderId,
      beezioOrderId,
      orderNumber,
      currency,
      subtotal_listing: subtotalListing,
      shipping: shippingAmount,
      tax: taxAmount,
      total_charged: totalCharged,
    });
  } catch (e: any) {
    const statusCode = Number(e?.statusCode) || 500;
    return json(statusCode, { error: e instanceof Error ? e.message : 'Unexpected error' });
  }
};

export default handler;
