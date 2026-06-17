import type { Handler } from '@netlify/functions';
import { createSupabaseAdmin } from './_lib/supabase';
import { json, assertPost, parseJson } from './_lib/http';
import { getEnvNumber, getPayoutHoldDays } from './_lib/env';
import { getPayPalEnv, isPayPalEnabled, paypalRequestId } from './_lib/paypal';
import { round2 } from './_lib/money';
import { getPaymentProvider } from './_lib/providers';
import { PayPalProviderError } from './_lib/providers/PayPalProvider';
import { getSiteUrl } from './_lib/site';
import { buildOrderConfirmationEmail, sendTransactionalEmail } from './_lib/email';
import { getCJInventory } from './_lib/cj-api';
import { resolveRecruiterInfluencerId } from './_lib/influencer-referrals';
import { finalizePayPalOrderPayment } from './_lib/paypal-order-finalization';
import { getReferrerBonusTotal } from '../../shared/referralBonus';
import {
  computeBeezioPlatformFee,
  DEFAULT_BEEZIO_LARGE_ORDER_FLAT_FEE,
  DEFAULT_BEEZIO_LARGE_ORDER_THRESHOLD,
  DEFAULT_BEEZIO_PLATFORM_FEE_CAP,
  DEFAULT_BEEZIO_PLATFORM_FEE_MIN,
  DEFAULT_BEEZIO_PLATFORM_RATE,
} from '../../shared/beezioFee';
import { isTestItemTitle, TEST_ITEM_BEEZIO_FEE, TEST_ITEM_INFLUENCER_FEE, TEST_ITEM_PLATFORM_GROSS } from '../../shared/testItemPricing';
import { allocatePayPalFeeToLowPrice, getLowPriceFlatFeeTotal, isLowPriceAmount } from '../../shared/lowPriceFeePolicy';

type CaptureBody = {
  orderID?: string;
  forceRepair?: boolean;
};

const LOCKED_PAYPAL_PERCENT = 0.0399;
const LOCKED_PAYPAL_FIXED = 0.6;
const LOCKED_PAYOUT_BUFFER = 0;
const LOCKED_PLATFORM_RATE = DEFAULT_BEEZIO_PLATFORM_RATE;
const LOCKED_PLATFORM_FEE_MIN_PER_ITEM = DEFAULT_BEEZIO_PLATFORM_FEE_MIN;
const LOCKED_PLATFORM_FEE_CAP = DEFAULT_BEEZIO_PLATFORM_FEE_CAP;
const LOCKED_LARGE_ORDER_THRESHOLD = DEFAULT_BEEZIO_LARGE_ORDER_THRESHOLD;
const LOCKED_LARGE_ORDER_FEE = DEFAULT_BEEZIO_LARGE_ORDER_FLAT_FEE;

const sameProfileId = (left: string | null | undefined, right: string | null | undefined): boolean => {
  const normalizedLeft = String(left || '').trim();
  const normalizedRight = String(right || '').trim();
  return Boolean(normalizedLeft && normalizedRight && normalizedLeft === normalizedRight);
};

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

const selectWithFallback = async (
  supabaseAdmin: any,
  table: string,
  fields: string[],
  filterColumn: string,
  filterValue: string
) => {
  let selected = [...fields];
  let lastError: any = null;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const { data, error } = await supabaseAdmin
      .from(table)
      .select(selected.join(','))
      .eq(filterColumn, filterValue);
    if (!error) return { data: (data as any[]) || [], selected, error: null };
    lastError = error;
    const missing = extractMissingColumnName(String((error as any)?.message || ''));
    if (missing && selected.includes(missing)) {
      selected = selected.filter((field) => field !== missing);
      continue;
    }
    break;
  }

  return { data: [], selected, error: lastError };
};

const selectMaybeSingleWithFallback = async (
  supabaseAdmin: any,
  table: string,
  fields: string[],
  filterColumn: string,
  filterValue: string
) => {
  const result = await selectWithFallback(supabaseAdmin, table, fields, filterColumn, filterValue);
  return {
    ...result,
    data: Array.isArray(result.data) ? result.data[0] || null : null,
  };
};

const insertEmailNotificationWithFallback = async (supabaseAdmin: any, payload: Record<string, any>) => {
  let attemptPayload = { ...payload };
  let lastError: any = null;

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const { error } = await supabaseAdmin.from('email_notifications').insert(attemptPayload as any);
    if (!error) return { error: null };
    lastError = error;
    const missing = extractMissingColumnName(String((error as any)?.message || ''));
    if (missing && Object.prototype.hasOwnProperty.call(attemptPayload, missing)) {
      delete attemptPayload[missing];
      continue;
    }
    break;
  }

  return { error: lastError };
};

const logEmailNotification = async (params: {
  supabaseAdmin: any;
  userId?: string | null;
  orderId: string;
  emailType: 'order_confirmation' | 'product_sold' | 'commission_earned';
  recipientEmail: string;
  subject: string;
  html: string;
  sent: boolean;
  reason?: string;
  metadata?: Record<string, unknown> | null;
}) => {
  const recipientEmail = String(params.recipientEmail || '').trim();
  if (!recipientEmail) return;

  const { error } = await insertEmailNotificationWithFallback(params.supabaseAdmin, {
    user_id: params.userId || null,
    order_id: params.orderId,
    email_type: params.emailType,
    recipient_email: recipientEmail,
    subject: params.subject,
    content: params.html,
    metadata: params.metadata || null,
    sent_at: new Date().toISOString(),
    status: params.sent ? 'sent' : 'failed',
    error_message: params.sent ? null : String(params.reason || 'delivery_failed'),
  });

  if (error) {
    console.warn('[paypal-capture-order] email notification log failed (non-fatal):', error);
  }
};

const escapeHtml = (value: unknown) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const formatShippingAddressHtml = (raw: any) => {
  const shipping = raw && typeof raw === 'object' ? raw : null;
  if (!shipping) return '<p><strong>Ship to:</strong> No shipping address was saved on the order.</p>';

  const lines = [
    String(shipping?.name || '').trim() ||
      [shipping?.firstName, shipping?.lastName].map((value: unknown) => String(value || '').trim()).filter(Boolean).join(' ').trim(),
    String(shipping?.address || shipping?.address1 || '').trim(),
    String(shipping?.address2 || '').trim(),
    [shipping?.city, shipping?.state, shipping?.zip || shipping?.postal_code]
      .map((value: unknown) => String(value || '').trim())
      .filter(Boolean)
      .join(', ')
      .replace(/, ([^,]+)$/, ' $1'),
    String(shipping?.country || '').trim(),
    String(shipping?.phone || '').trim() ? `Phone: ${String(shipping.phone).trim()}` : '',
    String(shipping?.email || '').trim() ? `Email: ${String(shipping.email).trim()}` : '',
  ].filter(Boolean);

  if (lines.length === 0) {
    return '<p><strong>Ship to:</strong> No shipping address was saved on the order.</p>';
  }

  return `<p><strong>Ship to:</strong><br />${lines.map((line) => escapeHtml(line)).join('<br />')}</p>`;
};
export const handler: Handler = async (event) => {
  try {
    assertPost(event.httpMethod);
    if (!isPayPalEnabled()) return json(503, { error: 'Payments are temporarily unavailable.', code: 'PAYMENTS_PAUSED' });

    // Explicit config check (match create-order env resolution for sandbox/live).
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

    const body = parseJson<CaptureBody>(event.body);
    const providerOrderId = String(body?.orderID || '').trim();
    const forceRepair = body?.forceRepair === true;
    if (!providerOrderId) return json(400, { error: 'Missing orderID' });

    const supabaseAdmin = createSupabaseAdmin();

    const orderSelect = async (columns: string) =>
      supabaseAdmin
        .from('orders')
        .select(columns)
        .eq('provider_order_id', providerOrderId)
        .maybeSingle();

    let orderRow: any = null;
    let orderError: any = null;
    ({ data: orderRow, error: orderError } = await orderSelect(
      'id, buyer_id, billing_email, seller_id, partner_id, influencer_id, currency, subtotal_listing, shipping_amount, tax_amount, total_charged, shipping_address, status, payment_status, provider_capture_id, paid_at'
    ));

    if (orderError && String(orderError.message || '').includes('payment_status')) {
      ({ data: orderRow, error: orderError } = await orderSelect(
        'id, buyer_id, billing_email, seller_id, partner_id, influencer_id, currency, subtotal_listing, shipping_amount, tax_amount, total_charged, shipping_address, status, provider_capture_id, paid_at'
      ));
    }

    if (orderError) return json(500, { error: orderError.message });
    const orderId = (orderRow as any)?.id ? String((orderRow as any).id) : null;
    if (!orderId) return json(404, { error: 'Order not found for that provider_order_id' });

    // Idempotency: only short-circuit when the full accounting mirror exists.
    // Production saw partial captures where payout_ledger existed but payout_snapshots did not,
    // which made paid orders invisible in payout-driven dashboards.
    try {
      const { data: existingLedger } = await supabaseAdmin
        .from('payout_ledger')
        .select('id, status')
        .eq('order_id', orderId)
        .limit(1)
        .maybeSingle();
      if ((existingLedger as any)?.id) {
        const [{ data: existingSnapshots }, { data: existingMoneyRows }] = await Promise.all([
          supabaseAdmin
            .from('payout_snapshots')
            .select('id')
            .eq('order_id', orderId)
            .limit(1),
          supabaseAdmin
            .from('order_money_ledger')
            .select('id')
            .eq('order_id', orderId)
            .limit(1),
        ]);

        const hasSnapshots = Array.isArray(existingSnapshots) && existingSnapshots.length > 0;
        const hasMoneyLedger = Array.isArray(existingMoneyRows) && existingMoneyRows.length > 0;

        if (hasSnapshots && hasMoneyLedger && !forceRepair) {
          return json(200, {
            ok: true,
            order_id: orderId,
            provider_order_id: providerOrderId,
            provider_capture_id: (orderRow as any)?.provider_capture_id ?? null,
            idempotent: true,
          });
        }

        const repaired = await finalizePayPalOrderPayment({
          supabaseAdmin,
          orderId,
          providerOrderId,
          providerCaptureId: String((orderRow as any)?.provider_capture_id || '').trim() || null,
          paidAt: String((orderRow as any)?.paid_at || '').trim() || new Date().toISOString(),
          forceRepair: true,
        });

        return json(200, {
          ok: true,
          order_id: orderId,
          provider_order_id: providerOrderId,
          provider_capture_id: (orderRow as any)?.provider_capture_id ?? null,
          idempotent: true,
          repaired: true,
          force_repair: forceRepair,
          finalization: repaired,
        });
      }
    } catch {
      // ignore and proceed
    }

    const strictCJInventory = String(process.env.CJ_STRICT_STOCK_REQUIRED || 'false').trim().toLowerCase() === 'true';

    const selectOrderItemsForInventory = async (): Promise<any[]> => {
      let selectColumns = [
        'id',
        'quantity',
        'product_id',
        'variant_id',
        'source_platform',
        'cj_product_id',
        'cj_variant_id',
      ];

      let lastError: any = null;
      for (let attempt = 0; attempt < 6; attempt += 1) {
        const { data, error } = await supabaseAdmin
          .from('order_items')
          .select(selectColumns.join(','))
          .eq('order_id', orderId);

        if (!error) return (data as any[]) || [];
        lastError = error;
        const missing = extractMissingColumnName(String((error as any)?.message || ''));
        if (missing && selectColumns.includes(missing)) {
          selectColumns = selectColumns.filter((col) => col !== missing);
          continue;
        }
        break;
      }

      throw new Error(String((lastError as any)?.message || 'Failed to load order items for inventory validation'));
    };

    const inventoryRows = await selectOrderItemsForInventory();
    const productIds = Array.from(new Set(inventoryRows.map((row) => String(row?.product_id || '').trim()).filter(Boolean)));
    const variantIds = Array.from(new Set(inventoryRows.map((row) => String(row?.variant_id || '').trim()).filter(Boolean)));
    const productInventorySource = new Map<string, string>();
    const variantInventorySource = new Map<string, string>();

    if (productIds.length) {
      const { data: products } = await supabaseAdmin
        .from('products')
        .select('id,inventory_source')
        .in('id', productIds);
      for (const row of (products as any[]) || []) {
        const id = String(row?.id || '').trim();
        const inventorySource = String(row?.inventory_source || '').trim().toLowerCase();
        if (id) productInventorySource.set(id, inventorySource);
      }
    }

    if (variantIds.length) {
      const { data: variants } = await supabaseAdmin
        .from('product_variants')
        .select('id,inventory_source')
        .in('id', variantIds);
      for (const row of (variants as any[]) || []) {
        const id = String(row?.id || '').trim();
        const inventorySource = String(row?.inventory_source || '').trim().toLowerCase();
        if (id) variantInventorySource.set(id, inventorySource);
      }
    }

    const cjDemand = new Map<string, { product_id: string; variant_id: string | null; title: string; pid: string; vid?: string; qty: number }>();

    for (const row of inventoryRows) {
      const qty = Math.max(1, Math.floor(Number(row?.quantity || 0)));
      if (!qty) continue;

      const sourcePlatform = String(row?.source_platform || '').trim().toLowerCase();
      const pid = String(row?.cj_product_id || '').trim();
      const vid = String(row?.cj_variant_id || '').trim() || undefined;
      const productId = String(row?.product_id || '').trim();
      const variantId = row?.variant_id ? String(row.variant_id).trim() : null;
      const inventorySource =
        (variantId ? variantInventorySource.get(variantId) : '') ||
        productInventorySource.get(productId) ||
        '';
      const isCJ = sourcePlatform === 'cj' || Boolean(pid);
      if (!isCJ || !pid || inventorySource === 'manual') continue;

      const demandKey = `${pid}::${vid || ''}`;
      const existing = cjDemand.get(demandKey);
      if (existing) {
        existing.qty += qty;
      } else {
        cjDemand.set(demandKey, {
          product_id: productId,
          variant_id: variantId,
          title: productId || 'CJ item',
          pid,
          vid,
          qty,
        });
      }
    }

    if (cjDemand.size > 0) {
      const stockErrors: Array<{ product_id: string; variant_id: string | null; requested_qty: number; available_qty: number | null; reason: string; title?: string }> = [];
      for (const demand of cjDemand.values()) {
        let available: number | null = null;
        try {
          available = await getCJInventory(demand.pid, demand.vid);
        } catch {
          available = null;
        }

        const verifyFailed = available === null;
        const insufficient = typeof available === 'number' && available < demand.qty;
        if ((strictCJInventory && verifyFailed) || insufficient) {
          stockErrors.push({
            product_id: demand.product_id,
            variant_id: demand.variant_id,
            requested_qty: demand.qty,
            available_qty: available,
            reason: insufficient ? 'CJ_INSUFFICIENT' : 'CJ_UNVERIFIED',
            title: demand.title,
          });
        }
      }

      if (stockErrors.length > 0) {
        return json(409, {
          error: 'Some CJ items are no longer available. Payment capture was blocked.',
          code: 'INSUFFICIENT_CJ_INVENTORY',
          strict_cj_inventory: strictCJInventory,
          items: stockErrors,
        });
      }
    }

    const provider = getPaymentProvider('paypal');
    let capture;
    try {
      capture = await provider.captureOrder(providerOrderId, paypalRequestId(`bzo_capture_${orderId}`));
    } catch (error) {
      if (error instanceof PayPalProviderError) {
        return json(error.statusCode, {
          error: error.message,
          code: error.code,
          details: error.details,
          approve_url: error.approveUrl,
        });
      }
      throw error;
    }
    const captureId = capture.providerCaptureId || null;
    const actualPayPalFeeAmount = Number(capture.paypalFeeAmount);
    const paypalFeeAmount = Number.isFinite(actualPayPalFeeAmount) && actualPayPalFeeAmount >= 0
      ? round2(actualPayPalFeeAmount)
      : null;

    const paidAt = new Date().toISOString();

    // Load order items
    const pricingItemsResult = await selectWithFallback(
      supabaseAdmin,
      'order_items',
      [
        'id',
        'quantity',
        'product_id',
        'seller_id',
        'affiliate_id',
        'affiliate_referrer_id',
        'seller_ask_amount',
        'partner_rate',
        'influencer_rate',
        'beezio_rate',
        'computed_listing_price',
        'products:product_id(title)',
      ],
      'order_id',
      orderId
    );
    if (pricingItemsResult.error) return json(500, { error: String((pricingItemsResult.error as any)?.message || 'Failed to load order items') });

    const rows = (pricingItemsResult.data as any[]) || [];
    if (!rows.length) return json(400, { error: 'Order has no line items' });

    const holdDays = getPayoutHoldDays(14);
    const paypalPct = LOCKED_PAYPAL_PERCENT;
    const paypalFixed = LOCKED_PAYPAL_FIXED;
    const payoutBuffer = LOCKED_PAYOUT_BUFFER;

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

    const buyerId = String((orderRow as any)?.buyer_id || '').trim() || null;
    const sellerId = String((orderRow as any)?.seller_id || '').trim() || null;
    const rawPartnerId = String((orderRow as any)?.partner_id || '').trim() || null;
    const partnerId = sameProfileId(rawPartnerId, buyerId) ? null : rawPartnerId;
    const sellerRecruiterInfluencerIdRaw = await resolveRecruiterInfluencerId(supabaseAdmin, sellerId, 'seller');
    const partnerRecruiterInfluencerIdRaw = await resolveRecruiterInfluencerId(supabaseAdmin, partnerId, 'affiliate');
    const sellerRecruiterInfluencerId = sameProfileId(sellerRecruiterInfluencerIdRaw, buyerId) ? null : sellerRecruiterInfluencerIdRaw;
    const partnerRecruiterInfluencerId = sameProfileId(partnerRecruiterInfluencerIdRaw, buyerId) ? null : partnerRecruiterInfluencerIdRaw;
    const partnerIsInfluencer = await isInfluencerProfile(partnerId);
    // Affiliate invite-link attribution takes precedence when a partner drove the sale.
    const rawInfluencerPayoutId = partnerRecruiterInfluencerId || (partnerIsInfluencer ? partnerId : null) || sellerRecruiterInfluencerId || null;
    const influencerPayoutId = sameProfileId(rawInfluencerPayoutId, buyerId) ? null : rawInfluencerPayoutId;

    let askTotal = 0;
    let listingSubtotal = 0;
    let partnerTotal = 0;
    let influencerTotal = 0;
    let beezioFeeGrossTotal = 0;
    let lowPriceListingSubtotal = 0;
    let lowPriceFlatFeeTotal = 0;
    let regularBeezioFeeGrossTotal = 0;
    let lowPriceInfluencerBonusPoolTotal = 0;
    let regularInfluencerBonusPoolTotal = 0;

    const beezioRateDefault = Math.min(1, Math.max(0, getEnvNumber('BEEZIO_RATE', LOCKED_PLATFORM_RATE)));
    const beezioPlatformFeeMin = getEnvNumber('BEEZIO_PLATFORM_FEE_MIN', LOCKED_PLATFORM_FEE_MIN_PER_ITEM);
    const beezioPlatformFeeCap = getEnvNumber('BEEZIO_PLATFORM_FEE_CAP', LOCKED_PLATFORM_FEE_CAP);
    const beezioLargeOrderThreshold = getEnvNumber('BEEZIO_PLATFORM_FEE_LARGE_ORDER_THRESHOLD', LOCKED_LARGE_ORDER_THRESHOLD);
    const beezioLargeOrderFlatFee = getEnvNumber('BEEZIO_PLATFORM_FEE_LARGE_ORDER_FLAT', LOCKED_LARGE_ORDER_FEE);

    for (const it of rows) {
      const qty = Math.max(1, Math.floor(Number(it.quantity || 0)));
      const ask = round2(Number(it.seller_ask_amount ?? 0) || 0);
      const listingUnit = round2(Number(it.computed_listing_price ?? 0) || 0);
      const partnerRate = Math.max(0, Number(it.partner_rate ?? 0) || 0);
      const beezioRate = Number.isFinite(Number(it.beezio_rate)) ? Math.max(0, Number(it.beezio_rate)) : beezioRateDefault;
      const testItem = isTestItemTitle((it as any)?.products?.title);
      const lowPriceItem = isLowPriceAmount(ask);
      const influencerBonusPoolLine = testItem
        ? TEST_ITEM_INFLUENCER_FEE * qty
        : getReferrerBonusTotal(ask, qty);

      askTotal += ask * qty;
      listingSubtotal += listingUnit * qty;
      partnerTotal += ask * qty * partnerRate;
      if (lowPriceItem) {
        lowPriceListingSubtotal += listingUnit * qty;
        lowPriceFlatFeeTotal += getLowPriceFlatFeeTotal(qty);
        lowPriceInfluencerBonusPoolTotal += influencerBonusPoolLine;
      } else {
        regularInfluencerBonusPoolTotal += influencerBonusPoolLine;
        regularBeezioFeeGrossTotal += (testItem
          ? TEST_ITEM_PLATFORM_GROSS
          : round2(
              computeBeezioPlatformFee(ask, {
                rate: beezioRate,
                minimum: beezioPlatformFeeMin,
                cap: beezioPlatformFeeCap,
                largeOrderThreshold: beezioLargeOrderThreshold,
                largeOrderFlatFee: beezioLargeOrderFlatFee,
              })
            )) * qty;
      }
    }

    askTotal = round2(askTotal);
    listingSubtotal = round2(listingSubtotal);
    partnerTotal = partnerId ? round2(partnerTotal) : 0;
    const influencerBonusPoolTotal = round2(lowPriceInfluencerBonusPoolTotal + regularInfluencerBonusPoolTotal);
    const sellerBonusEligible = Boolean(
      sellerRecruiterInfluencerId && influencerPayoutId === sellerRecruiterInfluencerId
    );
    const affiliateBonusEligible = Boolean(
      partnerId &&
      sellerId &&
      partnerId !== sellerId &&
      influencerPayoutId &&
      (
        (partnerRecruiterInfluencerId && influencerPayoutId === partnerRecruiterInfluencerId) ||
        (partnerIsInfluencer && influencerPayoutId === partnerId)
      )
    );
    const influencerBonusEligible = sellerBonusEligible || affiliateBonusEligible;
    const sellerBonusTotal = sellerBonusEligible ? influencerBonusPoolTotal : 0;
    const affiliateBonusTotal = affiliateBonusEligible && !sellerBonusEligible ? influencerBonusPoolTotal : 0;
    influencerTotal = influencerPayoutId && influencerBonusEligible ? influencerBonusPoolTotal : 0;
    regularBeezioFeeGrossTotal = round2(regularBeezioFeeGrossTotal);
    const retainedBonusTotal = round2(Math.max(influencerBonusPoolTotal - influencerTotal, 0));
    const hasSellerOrAffiliateBonus = sellerBonusTotal > 0 || affiliateBonusTotal > 0;
    const platformFeeBonusTotal = round2(influencerTotal);
    const platformFeeAllocationMode = hasSellerOrAffiliateBonus ? 'reduced_by_bonuses' : 'full_retained';

    // Fee buffer adjustment (order-level)
    const paypalFeeEstimate = paypalFeeAmount ?? round2(listingSubtotal * paypalPct + paypalFixed);
    const lowPricePayPalAllocated = allocatePayPalFeeToLowPrice(paypalFeeEstimate, lowPriceListingSubtotal, listingSubtotal);
    const lowPriceBeezioFeeGrossTotal = round2(lowPriceFlatFeeTotal);
    const lowPriceBeezioFeeNetTotal = round2(lowPriceBeezioFeeGrossTotal);
    const regularPayPalAllocated = round2(Math.max(paypalFeeEstimate - lowPricePayPalAllocated, 0));

    // Platform-fee policy:
    // - Beezio fee has a $1.00 floor per item.
    // - Once 10% of seller ask exceeds $1.00, use the 10% rate.
    // - The fee caps at $20 per item, with orders above the threshold staying flat at $20.
    // - Influencer reserve is charged on top of the buyer price and tracked separately.
    // - PayPal only reduces Beezio operating profit on non-low-price items.
    const regularBeezioFeeNetTotal = round2(Math.max(regularBeezioFeeGrossTotal - regularPayPalAllocated, 0));
    beezioFeeGrossTotal = round2(regularBeezioFeeGrossTotal + lowPriceBeezioFeeGrossTotal);
    const beezioFeeNetTotal = round2(regularBeezioFeeNetTotal + lowPriceBeezioFeeNetTotal);
    const beezioProfit = beezioFeeNetTotal;

    const holdReleaseAt = new Date(Date.now() + holdDays * 24 * 60 * 60 * 1000).toISOString();

    const finalization = await finalizePayPalOrderPayment({
      supabaseAdmin,
      orderId,
      providerOrderId,
      providerCaptureId: captureId,
      paypalFeeAmount,
      paidAt,
    });

    // Best-effort: trigger fulfillment dispatch (Printful/Printify/CJ).
    try {
      const siteUrl = getSiteUrl();
      if (siteUrl) {
        await fetch(`${siteUrl.replace(/\/$/, '')}/.netlify/functions/fulfillment-dispatch`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId }),
        });
      }
    } catch (err) {
      console.warn('Fulfillment dispatch failed (non-fatal):', err);
    }

    // Best-effort operational log for seller/partner/influencer visibility in admin diagnostics.
    try {
      await supabaseAdmin.from('integration_logs').insert({
        integration_id: null,
        action: 'order_captured',
        status: 'success',
        products_imported: rows.length,
        metadata: {
          order_id: orderId,
          provider_order_id: providerOrderId,
          provider_capture_id: captureId,
          seller_id: (orderRow as any)?.seller_id ?? null,
          partner_id: (orderRow as any)?.partner_id ?? null,
          influencer_id: influencerPayoutId,
          subtotal_listing: listingSubtotal,
          seller_ask_total: askTotal,
          partner_total: partnerTotal,
          influencer_total: influencerTotal,
          influencer_seller_bonus_total: sellerBonusTotal,
          influencer_affiliate_bonus_total: affiliateBonusTotal,
          platform_fee_mode: platformFeeAllocationMode,
          platform_fee_bonus_total: platformFeeBonusTotal,
          platform_fee_bonus_retained_total: retainedBonusTotal,
          low_price_flat_fee_total: lowPriceFlatFeeTotal,
          low_price_paypal_allocated: lowPricePayPalAllocated,
          regular_paypal_allocated: regularPayPalAllocated,
          paypal_fee_source: paypalFeeAmount === null ? 'estimate' : 'paypal_capture',
          beezio_fee_net: beezioFeeNetTotal,
          beezio_profit: beezioProfit,
          snapshot_finalized: true,
          finalization_idempotent: finalization.idempotent,
        },
      });
    } catch (logErr) {
      console.warn('Order capture log insert failed (non-fatal):', logErr);
    }

    console.info('[paypal-capture-order] capture completed', {
      orderId,
      providerOrderId,
      captureId,
      sellerId: (orderRow as any)?.seller_id ?? null,
      partnerId: (orderRow as any)?.partner_id ?? null,
      influencerId: influencerPayoutId,
      influencerSellerBonus: sellerBonusTotal,
      influencerAffiliateBonus: affiliateBonusTotal,
      finalizationIdempotent: finalization.idempotent,
    });

    try {
      const digitalItemsResult = await selectWithFallback(
        supabaseAdmin,
        'order_items',
        [
          'id',
          'order_id',
          'product_id',
          'seller_id',
          'quantity',
          'products:product_id(title,is_digital,digital_download_bucket,digital_download_path,digital_download_filename,digital_download_content_type,digital_download_file_size,digital_download_limit)',
        ],
        'order_id',
        orderId
      );
      const digitalItems = digitalItemsResult.data;
      const digitalItemsError = digitalItemsResult.error;

      if (digitalItemsError) {
        console.warn('[paypal-capture-order] digital entitlement load failed:', digitalItemsError.message);
      } else {
        const entitlementPayload = ((digitalItems as any[]) || [])
          .filter((row) => row?.products?.is_digital === true)
          .filter((row) => String(row?.products?.digital_download_bucket || '').trim() && String(row?.products?.digital_download_path || '').trim())
          .map((row) => {
            const quantity = Math.max(1, Math.floor(Number(row?.quantity || 0)));
            const configuredLimit = Math.max(1, Number(row?.products?.digital_download_limit || 1));
            return {
              order_id: orderId,
              order_item_id: String(row.id),
              product_id: String(row.product_id),
              seller_id: row.seller_id ? String(row.seller_id) : (String((orderRow as any)?.seller_id || '').trim() || null),
              buyer_user_id: String((orderRow as any)?.buyer_id || '').trim() || null,
              billing_email: String((orderRow as any)?.billing_email || '').trim() || null,
              storage_bucket: String(row.products.digital_download_bucket),
              storage_path: String(row.products.digital_download_path),
              original_filename: String(row.products.digital_download_filename || `${String(row.products.title || 'download').trim() || 'download'}`),
              content_type: String(row.products.digital_download_content_type || '').trim() || null,
              file_size_bytes: Number(row.products.digital_download_file_size || 0) || null,
              download_limit: Math.max(quantity, configuredLimit),
              access_status: 'active',
              metadata: {
                product_title: String(row?.products?.title || '').trim() || null,
              },
            };
          });

        if (entitlementPayload.length > 0) {
          const { error: entitlementError } = await supabaseAdmin
            .from('digital_download_entitlements')
            .upsert(entitlementPayload, { onConflict: 'order_item_id' });
          if (entitlementError) {
            console.warn('[paypal-capture-order] digital entitlement upsert failed:', entitlementError.message);
          }
        }
      }
    } catch (digitalErr) {
      console.warn('[paypal-capture-order] digital entitlement creation failed (non-fatal):', digitalErr);
    }

    // Best-effort buyer confirmation email
    try {
      const orderEmailResult = await selectMaybeSingleWithFallback(
        supabaseAdmin,
        'orders',
        ['id', 'billing_email', 'billing_name', 'currency', 'subtotal_listing', 'shipping_amount', 'tax_amount', 'total_charged'],
        'id',
        orderId
      );
      const orderEmailRow = orderEmailResult.data;

      const recipient = String((orderEmailRow as any)?.billing_email || '').trim();
      if (recipient) {
        const emailItemsResult = await selectWithFallback(
          supabaseAdmin,
          'order_items',
          ['quantity', 'computed_listing_price', 'product:products(title, name)'],
          'order_id',
          orderId
        );
        const emailItems = emailItemsResult.data;

        const lineItems = ((emailItems as any[]) || []).map((it: any) => ({
          name: String(it?.product?.title || it?.product?.name || 'Item'),
          quantity: Math.max(1, Number(it?.quantity || 1)),
          amount: round2(Math.max(1, Number(it?.quantity || 1)) * Number(it?.computed_listing_price || 0)),
        }));

        const template = buildOrderConfirmationEmail({
          orderId,
          buyerName: String((orderEmailRow as any)?.billing_name || '').trim() || null,
          currency: String((orderEmailRow as any)?.currency || 'USD'),
          items: lineItems,
          subtotal: Number((orderEmailRow as any)?.subtotal_listing || 0),
          shipping: Number((orderEmailRow as any)?.shipping_amount || 0),
          tax: Number((orderEmailRow as any)?.tax_amount || 0),
          total: Number((orderEmailRow as any)?.total_charged || 0),
        });

        const emailResult = await sendTransactionalEmail({
          to: recipient,
          subject: template.subject,
          html: template.html,
        });
        await logEmailNotification({
          supabaseAdmin,
          userId: String((orderRow as any)?.buyer_id || '').trim() || null,
          orderId,
          emailType: 'order_confirmation',
          recipientEmail: recipient,
          subject: template.subject,
          html: template.html,
          sent: emailResult.sent,
          reason: emailResult.reason,
          metadata: {
            provider_order_id: providerOrderId,
            provider_capture_id: captureId,
          },
        });
        if (!emailResult.sent) {
          console.warn('[paypal-capture-order] order confirmation email skipped:', emailResult.reason);
        }
      }
    } catch (emailErr) {
      console.warn('[paypal-capture-order] confirmation email failed (non-fatal):', emailErr);
    }

    // Best-effort seller sale alert email. Affiliates and influencers see earnings in their dashboards.
    try {
      const saleAlertItemsResult = await selectWithFallback(
        supabaseAdmin,
        'order_items',
        ['quantity', 'computed_listing_price', 'product_title', 'product:products(title, name)'],
        'order_id',
        orderId
      );
      const saleAlertItems = saleAlertItemsResult.data;

      const itemRows = ((saleAlertItems as any[]) || [])
        .map((it: any) => {
          const name = String(it?.product_title || it?.product?.title || it?.product?.name || 'Item');
          const qty = Math.max(1, Number(it?.quantity || 1));
          const unit = Number(it?.computed_listing_price || 0);
          return `<li>${name} x ${qty} @ $${unit.toFixed(2)}</li>`;
        })
        .join('');

      const resolvePayeeEmail = async (profileId: string | null, role: 'SELLER' | 'PARTNER' | 'INFLUENCER') => {
        const payeeId = String(profileId || '').trim();
        if (!payeeId) return '';

        const { data: payoutAccount } = await supabaseAdmin
          .from('paypal_accounts')
          .select('paypal_email')
          .eq('user_id', payeeId)
          .eq('role', role)
          .maybeSingle();
        const paypalEmail = String((payoutAccount as any)?.paypal_email || '').trim();
        if (paypalEmail) return paypalEmail;

        const { data: profileRow } = await supabaseAdmin
          .from('profiles')
          .select('email')
          .eq('id', payeeId)
          .maybeSingle();
        return String((profileRow as any)?.email || '').trim();
      };

      const shouldSendSellerSaleEmail = async (profileId: string | null) => {
        const sellerId = String(profileId || '').trim();
        if (!sellerId) return true;

        const preferenceResult = await selectMaybeSingleWithFallback(
          supabaseAdmin,
          'profiles',
          ['id', 'sale_email_notifications'],
          'id',
          sellerId
        );
        const value = (preferenceResult.data as any)?.sale_email_notifications;
        return value !== false;
      };

      const sendPayeeSaleAlert = async (config: {
        profileId: string | null;
        role: 'SELLER' | 'PARTNER' | 'INFLUENCER';
        payoutAmount: number;
        label: string;
      }) => {
        const payeeId = String(config.profileId || '').trim() || null;
        if (config.role === 'SELLER') {
          const sellerWantsEmail = await shouldSendSellerSaleEmail(config.profileId);
          if (!sellerWantsEmail) return;
        }
        const recipient = await resolvePayeeEmail(config.profileId, config.role);
        if (!recipient || config.payoutAmount <= 0) return;

        const shippingAddressHtml = config.role === 'SELLER'
          ? formatShippingAddressHtml((orderRow as any)?.shipping_address)
          : '';

        const payoutLabel =
          config.role === 'SELLER'
            ? 'Seller payout'
            : config.role === 'PARTNER'
              ? 'Affiliate commission'
              : 'Influencer payout';
        const shippingHtml =
          Number((orderRow as any)?.shipping_amount || 0) > 0
            ? `<p><strong>Shipping:</strong> $${Number((orderRow as any)?.shipping_amount || 0).toFixed(2)}</p>`
            : '';

        const subject = `Beezio order captured: Order ${orderId}`;
        const html = `
          <h2>Beezio order captured</h2>
          <p><strong>Order:</strong> ${orderId}</p>
          <p><strong>Your role:</strong> ${config.label}</p>
          <p><strong>${payoutLabel}:</strong> $${Number(config.payoutAmount || 0).toFixed(2)}</p>
          ${shippingHtml}
          <p><strong>Buyer:</strong> ${String((orderRow as any)?.billing_email || 'Unknown')}</p>
          ${shippingAddressHtml}
          <p><strong>Items:</strong></p>
          <ul>${itemRows || '<li>Order items unavailable</li>'}</ul>
        `;

        const result = await sendTransactionalEmail({ to: recipient, subject, html });
        await logEmailNotification({
          supabaseAdmin,
          userId: payeeId,
          orderId,
          emailType: config.role === 'SELLER' ? 'product_sold' : 'commission_earned',
          recipientEmail: recipient,
          subject,
          html,
          sent: result.sent,
          reason: result.reason,
          metadata: {
            payee_role: config.role,
            provider_order_id: providerOrderId,
            provider_capture_id: captureId,
            payout_amount: Number(config.payoutAmount || 0),
          },
        });
        if (!result.sent) {
          console.warn(`[paypal-capture-order] ${config.role.toLowerCase()} sale email skipped:`, result.reason);
        }
      };

      await sendPayeeSaleAlert({
        profileId: String((orderRow as any)?.seller_id || '').trim() || null,
        role: 'SELLER',
        payoutAmount: askTotal,
        label: 'Seller',
      });
    } catch (sellerEmailErr) {
      console.warn('[paypal-capture-order] payee sale email failed (non-fatal):', sellerEmailErr);
    }

    return json(200, {
      ok: true,
      order_id: orderId,
      provider_order_id: providerOrderId,
      provider_capture_id: captureId,
      hold_release_at: finalization.hold_release_at || holdReleaseAt,
      idempotent: finalization.idempotent,
    });
  } catch (e: any) {
    const statusCode = Number(e?.statusCode) || 500;
    return json(statusCode, { error: e instanceof Error ? e.message : 'Unexpected error' });
  }
};

export default handler;
