import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { buildCheckoutSession } from '../../server/payments/buildCheckoutSession';
import { toCents } from '../../server/payments/money';
import { computeBeezioFees, computeBuyerPaidProcessingFeeCents, envStripeProcessingFeeFixedCents, envStripeProcessingFeePct } from '../../server/payments/beezioStripeBible';

type CreateCheckoutBody = {
  cart: {
    line_items: Array<{ product_id: string; variant_id?: string | null; qty: number; unit_price: number }>;
    shipping_amount: number;
    tax_amount: number;
    currency: string;
  };
  context: {
    seller_id: string;
    buyer_id?: string | null;
    store_id?: string | null;
    fundraiser_id?: string | null;
    affiliate_id?: string | null;
    referrer_id?: string | null;
    source?: string | null;
    campaign?: string | null;
  };
  success_url: string;
  cancel_url: string;
};

function json(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

function requireEnv(name: string, fallbacks: string[] = []): string {
  const keys = [name, ...fallbacks];
  for (const key of keys) {
    const value = String(process.env[key] || '').trim();
    if (value) return value;
  }
  throw new Error(`Missing ${name}${fallbacks.length ? ` (or ${fallbacks.join(', ')})` : ''}`);
}

const looksLikeUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const handler: Handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') {
      return json(405, { error: 'Method not allowed' });
    }

    const body = event.body ? JSON.parse(event.body) : null;
    const payload = body as CreateCheckoutBody;

    const cart = payload?.cart;
    const context = payload?.context;

    if (!cart?.line_items?.length) return json(400, { error: 'cart.line_items is required' });
    if (!context?.seller_id) return json(400, { error: 'context.seller_id is required' });
    if (!payload?.success_url || !payload?.cancel_url) return json(400, { error: 'success_url and cancel_url are required' });

    const lineItems = cart.line_items.map((li) => ({
      product_id: String(li.product_id || '').trim(),
      variant_id: li.variant_id ?? null,
      qty: Number(li.qty),
      unit_price: Number(li.unit_price),
    }));

    for (const li of lineItems) {
      if (!li.product_id) return json(400, { error: 'Each line item must include product_id' });
      if (!Number.isFinite(li.qty) || li.qty <= 0) return json(400, { error: 'Each line item must include qty > 0' });
      if (!Number.isFinite(li.unit_price) || li.unit_price < 0) return json(400, { error: 'Each line item must include unit_price >= 0' });
    }

    const shipping_amount = Number(cart.shipping_amount || 0);
    const tax_amount = Number(cart.tax_amount || 0);
    const currency = String(cart.currency || 'USD');

    const supabaseUrl = requireEnv('SUPABASE_URL', ['VITE_SUPABASE_URL']);
    const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const sellerId = String(context.seller_id);

    // Server is source of truth: validate product ownership and canonical prices from DB.
    const productIds = Array.from(new Set(lineItems.map((li) => li.product_id).filter(looksLikeUuid)));
    const variantIds = Array.from(
      new Set(lineItems.map((li) => String(li.variant_id || '').trim()).filter((v) => looksLikeUuid(v)))
    );
    const nonUuidVariantRefs = Array.from(
      new Set(
        lineItems
          .map((li) => String(li.variant_id || '').trim())
          .filter((v) => v && !looksLikeUuid(v))
      )
    );

    const productById = new Map<string, any>();
    if (productIds.length) {
      const { data: products, error: productsError } = await supabaseAdmin
        .from('products')
        .select('id, seller_id, title, price, stock_quantity, is_active, is_promotable, seller_ask, seller_amount, seller_ask_price, commission_rate, commission_type, flat_commission_amount')
        .in('id', productIds);

      if (productsError) return json(500, { error: `Failed to load products: ${productsError.message}` });
      for (const row of (products as any[]) || []) productById.set(String(row.id), row);
    }

    const variantById = new Map<string, any>();
    if (variantIds.length) {
      const { data: variants, error: variantsError } = await supabaseAdmin
        .from('product_variants')
        .select('id, product_id, price, inventory, is_active')
        .in('id', variantIds);

      if (variantsError) return json(500, { error: `Failed to load variants: ${variantsError.message}` });
      for (const row of (variants as any[]) || []) variantById.set(String(row.id), row);
    }

    const variantByCjVariantId = new Map<string, any>();
    if (nonUuidVariantRefs.length) {
      const { data: variants, error: variantsError } = await supabaseAdmin
        .from('product_variants')
        .select('id, product_id, cj_variant_id, price, inventory, is_active')
        .in('cj_variant_id', nonUuidVariantRefs);

      if (variantsError) return json(500, { error: `Failed to resolve variants: ${variantsError.message}` });
      for (const row of (variants as any[]) || []) {
        if (row?.cj_variant_id) variantByCjVariantId.set(String(row.cj_variant_id), row);
      }
    }

    const canonicalLineItems: Array<{ product_id: string; variant_id?: string | null; qty: number; unit_price: number; name?: string }> = [];

    for (const li of lineItems) {
      const product = productById.get(li.product_id);
      if (!product) return json(404, { error: `Product not found: ${li.product_id}` });

      if (String(product.seller_id) !== sellerId) {
        return json(400, { error: `Cart contains product not owned by seller_id ${sellerId}` });
      }

      if (product.is_active === false) {
        return json(400, { error: `Product is inactive: ${li.product_id}` });
      }
      if (product.is_promotable === false) {
        return json(400, { error: `Product is not promotable: ${li.product_id}` });
      }

      const sellerAskCheck =
        Number(product?.seller_ask || 0) ||
        Number(product?.seller_amount || 0) ||
        Number(product?.seller_ask_price || 0) ||
        0;
      if (!Number.isFinite(sellerAskCheck) || sellerAskCheck <= 0) {
        return json(400, { error: `Product missing seller ask: ${li.product_id}` });
      }

      // Stripe Bible: product_subtotal is seller's product price; fees are separate line items.
      let unitPrice = Number(sellerAskCheck);
      const name = String(product.title || `Product ${li.product_id}`);

      const rawVariantRef = String(li.variant_id || '').trim();
      const resolvedVariant =
        rawVariantRef && looksLikeUuid(rawVariantRef)
          ? variantById.get(rawVariantRef) || null
          : rawVariantRef
            ? variantByCjVariantId.get(rawVariantRef) || null
            : null;

      if (rawVariantRef && !resolvedVariant) {
        return json(400, {
          error: `Variant not found or unavailable: ${rawVariantRef}. Please refresh and try again.`,
          code: 'INVALID_VARIANT',
          product_id: li.product_id,
          variant_ref: rawVariantRef,
        });
      }

      if (resolvedVariant) {
        if (String(resolvedVariant.product_id) !== String(li.product_id)) {
          return json(400, { error: `Variant ${rawVariantRef} does not belong to product ${li.product_id}` });
        }
        if (resolvedVariant.is_active === false) return json(400, { error: `Variant is inactive: ${rawVariantRef}` });
        unitPrice = Number(resolvedVariant.price || 0);

        const inventory = Number.isFinite(Number(resolvedVariant.inventory)) ? Number(resolvedVariant.inventory) : null;
        if (inventory !== null && inventory >= 0 && li.qty > inventory) {
          return json(409, {
            error: `Insufficient inventory for variant ${rawVariantRef}. Requested ${li.qty}, available ${inventory}.`,
            code: 'OUT_OF_STOCK',
            variant_id: rawVariantRef,
            requested: li.qty,
            available: inventory,
          });
        }
      } else {
        const inventory = Number.isFinite(Number(product.stock_quantity)) ? Number(product.stock_quantity) : null;
        if (inventory !== null && inventory >= 0 && li.qty > inventory) {
          return json(409, {
            error: `Insufficient inventory for product ${li.product_id}. Requested ${li.qty}, available ${inventory}.`,
            code: 'OUT_OF_STOCK',
            product_id: li.product_id,
            requested: li.qty,
            available: inventory,
          });
        }
      }

      if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
        return json(400, { error: `Invalid price for product ${li.product_id}${li.variant_id ? ` variant ${li.variant_id}` : ''}` });
      }

      canonicalLineItems.push({
        product_id: li.product_id,
        variant_id: resolvedVariant ? String(resolvedVariant.id) : null,
        qty: Math.max(1, Math.floor(li.qty)),
        unit_price: unitPrice,
        name,
      });
    }

    const items_subtotal = canonicalLineItems.reduce((sum, li) => sum + li.unit_price * li.qty, 0);

    const isFundraiser = Boolean(context.fundraiser_id);

    const { data: sellerProfile } = await supabaseAdmin
      .from('profiles')
      .select('stripe_account_id, seller_verification_status, identity_verification_status')
      .eq('id', sellerId)
      .maybeSingle();

    const sellerStripeAccountId =
      (sellerProfile as any)?.stripe_account_id || null;

    if (!sellerStripeAccountId) {
      return json(400, { error: 'Seller stripe_account_id not found (Connect not linked)' });
    }

    const sellerStatus = String((sellerProfile as any)?.seller_verification_status || 'not_started');
    if (sellerStatus !== 'verified') {
      return json(400, { error: 'Seller is not verified yet. Please try again later.' });
    }

    let resolvedReferrerId = context.referrer_id ?? null;
    if (!isFundraiser && !resolvedReferrerId && context.affiliate_id && looksLikeUuid(String(context.affiliate_id))) {
      try {
        const { data: affiliateProfile } = await supabaseAdmin
          .from('profiles')
          .select('referred_by_affiliate_id')
          .eq('id', String(context.affiliate_id))
          .maybeSingle();
        const maybeRef = (affiliateProfile as any)?.referred_by_affiliate_id;
        if (maybeRef && looksLikeUuid(String(maybeRef))) {
          resolvedReferrerId = String(maybeRef);
        }
      } catch {
        // non-fatal
      }
    }

    if (isFundraiser && resolvedReferrerId) {
      return json(400, { error: 'Referral and fundraiser cannot both apply to the same checkout.' });
    }

    const fetchStripeAccountId = async (profileId: string) => {
      const { data } = await supabaseAdmin
        .from('profiles')
        .select('stripe_account_id, seller_verification_status, identity_verification_status')
        .eq('id', profileId)
        .maybeSingle();
      return {
        stripe_account_id: (data as any)?.stripe_account_id ? String((data as any).stripe_account_id) : null,
        seller_verification_status: String((data as any)?.seller_verification_status || ''),
        identity_verification_status: String((data as any)?.identity_verification_status || ''),
      };
    };

    if (affiliateId) {
      const affiliateProfile = await fetchStripeAccountId(affiliateId);
      if (!affiliateProfile.stripe_account_id) {
        return json(400, { error: 'Affiliate stripe_account_id not found (Connect not linked)' });
      }
    }
    if (resolvedReferrerId) {
      const refProfile = await fetchStripeAccountId(String(resolvedReferrerId));
      if (!refProfile.stripe_account_id) {
        return json(400, { error: 'Referrer stripe_account_id not found (Connect not linked)' });
      }
    }
    if (context.fundraiser_id) {
      const fundraiserProfile = await fetchStripeAccountId(String(context.fundraiser_id));
      if (!fundraiserProfile.stripe_account_id) {
        return json(400, { error: 'Fundraiser stripe_account_id not found (Connect not linked)' });
      }
    }

    const productSubtotalCents = toCents(items_subtotal);
    const shippingCents = toCents(shipping_amount);
    const taxCents = toCents(tax_amount);

    // Affiliate fee (applies ONLY to product_subtotal).
    let affiliateFeeCents = 0;
    let affiliateRateBps: number | null = null;
    const affiliateId = context.affiliate_id && looksLikeUuid(String(context.affiliate_id)) ? String(context.affiliate_id) : null;
    if (affiliateId) {
      const percentageRates: number[] = [];
      for (const li of canonicalLineItems) {
        const product = productById.get(String(li.product_id));
        const commissionType = String(product?.commission_type || 'percentage');
        const commissionRate = Number(product?.commission_rate || 0);
        const flatCommission = Number(product?.flat_commission_amount || 0);

        const itemSubtotalCents = toCents(Number(li.unit_price || 0) * Number(li.qty || 0));
        if (commissionType === 'flat_rate') {
          affiliateFeeCents += Math.max(0, toCents(flatCommission) * Math.max(1, Math.floor(li.qty)));
        } else {
          const r = Number.isFinite(commissionRate) ? Math.max(0, commissionRate / 100) : 0;
          percentageRates.push(commissionRate);
          affiliateFeeCents += Math.max(0, Math.round(itemSubtotalCents * r));
        }
      }
      if (percentageRates.length) {
        const unique = Array.from(new Set(percentageRates.map((r) => Math.round(r * 1000) / 1000)));
        if (unique.length === 1) {
          affiliateRateBps = Math.round(unique[0] * 100);
        }
      }
    }

    const hasReferral = Boolean(resolvedReferrerId && !isFundraiser);
    const computedFees = computeBeezioFees({
      productSubtotalCents,
      affiliateFeeCents,
      hasReferral,
      isFundraiser,
    });

    const baseTotalCents =
      computedFees.productSubtotalCents +
      computedFees.affiliateFeeCents +
      computedFees.beezioFeeCents +
      computedFees.refOrFundraiserFeeCents +
      shippingCents +
      taxCents;

    const processingFeeCents = computeBuyerPaidProcessingFeeCents({
      baseTotalCents,
      stripePct: envStripeProcessingFeePct(),
      stripeFixedCents: envStripeProcessingFeeFixedCents(),
    });

    const totalCents = baseTotalCents + processingFeeCents;
    const sellerTransferCents = computedFees.productSubtotalCents;

    const { data: createdIntent, error: createIntentError } = await supabaseAdmin
      .from('checkout_intents')
      .insert({
        seller_id: sellerId,
        affiliate_id: affiliateId,
        referrer_id: resolvedReferrerId ?? null,
        fundraiser_id: context.fundraiser_id ?? null,
        store_id: context.store_id ?? null,
        split_version: 'BEEZIO_SPLIT_V1',
        items_subtotal,
        shipping_amount,
        tax_amount,
        currency: String(currency || 'USD').toUpperCase(),
        split_json: {
          cart: { line_items: canonicalLineItems },
          context,
          split_version: 'BEEZIO_SPLIT_V1',
          breakdown_cents: {
            product_subtotal_cents: computedFees.productSubtotalCents,
            affiliate_fee_cents: computedFees.affiliateFeeCents,
            beezio_fee_cents: computedFees.beezioFeeCents,
            ref_or_fundraiser_fee_cents: computedFees.refOrFundraiserFeeCents,
            shipping_cents: shippingCents,
            tax_cents: taxCents,
            processing_fee_cents: processingFeeCents,
            seller_transfer_cents: sellerTransferCents,
            total_cents: totalCents,
          },
        },
        product_subtotal_cents: computedFees.productSubtotalCents,
        affiliate_rate_bps: affiliateRateBps,
        affiliate_fee_cents: computedFees.affiliateFeeCents,
        beezio_fee_cents: computedFees.beezioFeeCents,
        ref_or_fundraiser_fee_cents: computedFees.refOrFundraiserFeeCents,
        shipping_cents: shippingCents,
        tax_cents: taxCents,
        processing_fee_cents: processingFeeCents,
        seller_transfer_cents: sellerTransferCents,
        total_cents: totalCents,
        has_referral: hasReferral,
        is_fundraiser: Boolean(isFundraiser),
        status: 'created',
      })
      .select('id')
      .single();

    if (createIntentError || !createdIntent?.id) {
      return json(500, { error: createIntentError?.message || 'Failed to create checkout_intent' });
    }

    const metadata: Record<string, string> = {
      checkout_intent_id: String(createdIntent.id),
      split_version: 'BEEZIO_SPLIT_V1',
      seller_id: sellerId,
      buyer_id: context.buyer_id ? String(context.buyer_id) : '',
      affiliate_id: affiliateId || '',
      referrer_id: resolvedReferrerId ? String(resolvedReferrerId) : '',
      fundraiser_id: context.fundraiser_id ? String(context.fundraiser_id) : '',
      source: context.source ? String(context.source) : '',
      campaign: context.campaign ? String(context.campaign) : '',
    };

    const session = await buildCheckoutSession({
      currency,
      line_items: [
        ...canonicalLineItems.map((li) => ({
          name: li.name || `Product ${li.product_id}`,
          quantity: li.qty,
          unit_amount_cents: toCents(li.unit_price),
          product_metadata: {
            product_id: li.product_id,
            ...(li.variant_id ? { variant_id: String(li.variant_id) } : null),
          },
        })),
        ...(computedFees.affiliateFeeCents > 0
          ? [{ name: 'Affiliate commission', quantity: 1, unit_amount_cents: computedFees.affiliateFeeCents }]
          : []),
        ...(computedFees.beezioFeeCents > 0 ? [{ name: 'Beezio fee', quantity: 1, unit_amount_cents: computedFees.beezioFeeCents }] : []),
        ...(computedFees.refOrFundraiserFeeCents > 0
          ? [
              {
                name: isFundraiser ? 'Fundraiser fee' : 'Referral fee',
                quantity: 1,
                unit_amount_cents: computedFees.refOrFundraiserFeeCents,
              },
            ]
          : []),
        ...(shippingCents > 0 ? [{ name: 'Shipping', quantity: 1, unit_amount_cents: shippingCents }] : []),
        ...(taxCents > 0 ? [{ name: 'Tax', quantity: 1, unit_amount_cents: taxCents }] : []),
        ...(processingFeeCents > 0 ? [{ name: 'Processing fee', quantity: 1, unit_amount_cents: processingFeeCents }] : []),
      ],
      success_url: payload.success_url,
      cancel_url: payload.cancel_url,
      metadata,
    });

    await supabaseAdmin
      .from('checkout_intents')
      .update({ stripe_session_id: session.id })
      .eq('id', createdIntent.id);

    return json(200, { url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return json(500, { error: message });
  }
};

export { handler };
