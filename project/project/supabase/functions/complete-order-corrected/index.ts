import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import Stripe from 'npm:stripe@14.21.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface CartItem {
  productId: string;
  title: string;
  price: number; // This is the final customer price
  quantity: number;
  sellerId: string;
  sellerDesiredAmount: number; // NEW: What seller actually wants per item
  commissionRate: number;
  affiliateId?: string;
  affiliateCommissionRate?: number;
  variantId?: string;
  variantName?: string;
}

interface PaymentDistribution {
  sellerAmount: number;
  affiliateAmount: number;
  platformFee: number;
  referralAmount: number;
  beezioNet: number;
  stripeFee: number;
  totalListingPrice: number;
}

// Unified Beezio distribution constants (must match frontend config)
const STRIPE_PERCENT = 0.029;
const STRIPE_FIXED = 0.30;
const PLATFORM_PERCENT = 0.15;
const REFERRER_PERCENT_OF_SALE = 0.05;
const PLATFORM_FEE_UNDER_20_THRESHOLD = 20;
const PLATFORM_FEE_UNDER_20_SURCHARGE = 1;

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

const looksLikeUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const platformSurchargePerUnit = (sellerAskPerUnit: number): number =>
  Number.isFinite(sellerAskPerUnit) && sellerAskPerUnit > 0 && sellerAskPerUnit <= PLATFORM_FEE_UNDER_20_THRESHOLD
    ? PLATFORM_FEE_UNDER_20_SURCHARGE
    : 0;

function calculateBeezioDistributionFromFinalPrice(params: {
  unitFinalPrice: number;
  quantity: number;
  sellerAskPerUnit: number;
  affiliatePercent: number;
  affiliateType?: 'percentage' | 'flat_rate';
  recruiterEnabled: boolean;
}): PaymentDistribution {
  const {
    unitFinalPrice,
    quantity,
    sellerAskPerUnit,
    affiliatePercent,
    affiliateType = 'percentage',
    recruiterEnabled,
  } = params;

  const qty = Number.isFinite(quantity) && quantity > 0 ? quantity : 0;
  const finalPriceTotal = round2((Number.isFinite(unitFinalPrice) ? unitFinalPrice : 0) * qty);

  const sellerAmountTotal = round2((Number.isFinite(sellerAskPerUnit) ? sellerAskPerUnit : 0) * qty);

  const affiliateAmountTotal = round2(
    affiliateType === 'flat_rate'
      ? (Number.isFinite(affiliatePercent) ? affiliatePercent : 0) * qty
      : sellerAmountTotal * (Math.max(0, affiliatePercent) / 100)
  );

  // IMPORTANT: This code models Stripe fixed fee per-unit, because item prices were computed per-unit.
  const stripeFeeTotal = round2(finalPriceTotal * STRIPE_PERCENT + STRIPE_FIXED * qty);

  const platformFeeTotal = round2(
    sellerAmountTotal * PLATFORM_PERCENT + platformSurchargePerUnit(sellerAskPerUnit) * qty
  );

  // Referral override is 5 percentage points of the sale base (seller ask),
  // paid out of Beezio's 15% platform fee (so Beezio nets 10% + any surcharge).
  const referralAmountTotal = recruiterEnabled
    ? Math.min(platformFeeTotal, round2(sellerAmountTotal * REFERRER_PERCENT_OF_SALE))
    : 0;

  const beezioNet = round2(Math.max(platformFeeTotal - referralAmountTotal, 0));

  return {
    sellerAmount: sellerAmountTotal,
    affiliateAmount: affiliateAmountTotal,
    platformFee: platformFeeTotal,
    referralAmount: referralAmountTotal,
    beezioNet,
    stripeFee: stripeFeeTotal,
    totalListingPrice: finalPriceTotal,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { 
      orderId, 
      paymentIntentId, 
      items, 
      billingDetails,
      totalPaid, // Amount actually paid by customer
      tax = 0, // Fixed tax amount passed from client
      shippingAmount = 0, // Order-level shipping total
      shippingLogisticName = null, // CJ logisticName chosen at checkout
      shippingOptionId = null,
      shippingOptionName = null,
      shippingMethodCode = null,
      shippingCountry = null,
    } = await req.json()

    const serviceRoleKey =
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ??
      Deno.env.get('SERVICE_ROLE_KEY') ??
      ''

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      serviceRoleKey
    )

    console.log('🔄 Processing order with CORRECT fee distribution:', {
      orderId,
      paymentIntentId,
      itemCount: items.length,
      totalPaid: totalPaid,
      tax,
      shippingAmount,
      shippingLogisticName,
    });

    const subtotalAmount = round2(
      (Array.isArray(items) ? items : []).reduce((acc: number, it: CartItem) => {
        const unit = Number.isFinite(it?.price) ? Number(it.price) : 0;
        const qty = Number.isFinite(it?.quantity) ? Number(it.quantity) : 0;
        return acc + unit * qty;
      }, 0)
    );

    const normalizedShippingAmount = round2(Number.isFinite(shippingAmount) ? Number(shippingAmount) : 0);
    const normalizedTax = round2(Number.isFinite(tax) ? Number(tax) : 0);
    const normalizedTotalPaid = round2(Number.isFinite(totalPaid) ? Number(totalPaid) : subtotalAmount + normalizedShippingAmount + normalizedTax);

    const safeShippingOptionId =
      typeof shippingOptionId === 'string' && looksLikeUuid(shippingOptionId) ? shippingOptionId : null;

    const shippingInfo = {
      firstName: (billingDetails?.name || '').toString().split(' ')[0] || null,
      lastName: ((billingDetails?.name || '').toString().split(' ').slice(1).join(' ') || null),
      address: billingDetails?.address?.line1 || null,
      address2: billingDetails?.address?.line2 || null,
      city: billingDetails?.address?.city || null,
      state: billingDetails?.address?.state || null,
      zip: billingDetails?.address?.postal_code || null,
      country: shippingCountry || billingDetails?.address?.country || null,
      email: billingDetails?.email || null,
      phone: billingDetails?.phone || null,
      logistic_name: (shippingOptionName && shippingOptionName.trim()) || (typeof shippingLogisticName === 'string' ? shippingLogisticName.trim() : null),
      method_code: shippingMethodCode || null,
      shipping_option_id: safeShippingOptionId,
    };

    // Validate and calculate distributions for all items
    let totalSellerPayouts = 0;
    let totalAffiliatePayouts = 0;
    let totalPlatformRevenue = 0;
    let totalStripeFees = 0;
    const distributionDetails = [];

    // Cache seller recruiter lookups (seller profile id -> recruiter profile id)
    const sellerRecruiterCache = new Map<string, string | null>();

    for (const item of items as CartItem[]) {
      const unitFinalPrice = Number.isFinite(item.price) ? item.price : 0;
      const qty = Number.isFinite(item.quantity) ? item.quantity : 0;
      const sellerAskPerUnit = Number.isFinite(item.sellerDesiredAmount)
        ? item.sellerDesiredAmount
        : unitFinalPrice * 0.7;

      // Resolve affiliate profile id (for affiliate commissions)
      let resolvedAffiliateProfileId: string | null = null;
      let affiliateReferredById: string | null = null;

      if (item.affiliateId) {
        const { data: affiliateProfile, error: affiliateLookupError } = await supabase
          .from('profiles')
          .select('id, referred_by_affiliate_id')
          .or(`id.eq.${item.affiliateId},referral_code.ilike.${item.affiliateId}`)
          .maybeSingle();

        if (affiliateLookupError) {
          console.warn('Recruiter lookup warning:', affiliateLookupError);
        }

        resolvedAffiliateProfileId = (affiliateProfile as any)?.id ?? null;
        affiliateReferredById = (affiliateProfile as any)?.referred_by_affiliate_id ?? null;
      }

      // Referral override is based on the "sale owner" being referred at signup:
      // - if an affiliate is attributed, the sale owner is that affiliate
      // - otherwise the sale owner is the seller
      const saleOwnerId = resolvedAffiliateProfileId ?? item.sellerId ?? null;

      let recruiterAffiliateId: string | null = null;
      if (saleOwnerId && saleOwnerId === resolvedAffiliateProfileId) {
        recruiterAffiliateId = affiliateReferredById;
      } else if (item.sellerId) {
        if (sellerRecruiterCache.has(item.sellerId)) {
          recruiterAffiliateId = sellerRecruiterCache.get(item.sellerId) ?? null;
        } else {
          const { data: sellerProfile, error: sellerLookupError } = await supabase
            .from('profiles')
            .select('id, referred_by_affiliate_id')
            .eq('id', item.sellerId)
            .maybeSingle();

          if (sellerLookupError) {
            console.warn('Sale owner recruiter lookup warning:', sellerLookupError);
          }

          recruiterAffiliateId = (sellerProfile as any)?.referred_by_affiliate_id ?? null;
          sellerRecruiterCache.set(item.sellerId, recruiterAffiliateId);
        }
      }

      const affiliatePercent = Number.isFinite(item.affiliateCommissionRate)
        ? (item.affiliateCommissionRate as number)
        : 0;

      const distribution = calculateBeezioDistributionFromFinalPrice({
        unitFinalPrice,
        quantity: qty,
        sellerAskPerUnit,
        affiliatePercent,
        affiliateType: 'percentage',
        recruiterEnabled: Boolean(recruiterAffiliateId),
      });
      
      totalSellerPayouts += distribution.sellerAmount;
      totalAffiliatePayouts += distribution.affiliateAmount;
      // Platform revenue tracked as net (after recruiter override)
      totalPlatformRevenue += distribution.beezioNet;
      totalStripeFees += distribution.stripeFee;
      
      distributionDetails.push({
        productId: item.productId,
        sellerId: item.sellerId,
        affiliateId: resolvedAffiliateProfileId ?? item.affiliateId ?? null,
        saleOwnerId,
        recruiterAffiliateId,
        distribution
      });
      
      console.log(`📊 Item ${item.productId} distribution:`, {
        seller: `$${distribution.sellerAmount.toFixed(2)}`,
        affiliate: `$${distribution.affiliateAmount.toFixed(2)}`,
        platformGross: `$${distribution.platformFee.toFixed(2)}`,
        recruiter: `$${distribution.referralAmount.toFixed(2)}`,
        beezioNet: `$${distribution.beezioNet.toFixed(2)}`,
        stripe: `$${distribution.stripeFee.toFixed(2)}`,
        total: `$${distribution.totalListingPrice.toFixed(2)}`
      });
    }

    // Atomically decrement inventory (prevents overselling).
    // If this fails, we do NOT mark the order completed.
    try {
      for (const item of items as CartItem[]) {
        const qty = Number.isFinite(item?.quantity) ? Number(item.quantity) : 0;
        if (qty <= 0) continue;

        const safeVariantId =
          typeof item.variantId === 'string' && looksLikeUuid(item.variantId) ? item.variantId : null;

        if (safeVariantId) {
          const { data: remaining, error: decError } = await supabase.rpc('decrement_variant_inventory', {
            p_variant_id: safeVariantId,
            p_quantity: qty,
          });

          if (decError) {
            throw new Error(`Inventory update failed for variant ${safeVariantId}: ${decError.message}`);
          }

          if (!Array.isArray(remaining) || remaining.length === 0) {
            throw new Error(`OUT_OF_STOCK:variant:${safeVariantId}`);
          }
        } else {
          const { data: remaining, error: decError } = await supabase.rpc('decrement_product_stock', {
            p_product_id: item.productId,
            p_quantity: qty,
          });

          if (decError) {
            throw new Error(`Inventory update failed for product ${item.productId}: ${decError.message}`);
          }

          if (!Array.isArray(remaining) || remaining.length === 0) {
            throw new Error(`OUT_OF_STOCK:product:${item.productId}`);
          }
        }
      }
    } catch (inventoryError: any) {
      const message = inventoryError instanceof Error ? inventoryError.message : String(inventoryError);
      const match = message.match(/^OUT_OF_STOCK:(variant|product):(.+)$/i);
      if (match) {
        const kind = match[1].toLowerCase();
        const id = match[2];

        // Auto-refund to ensure the 2nd buyer doesn't get charged in a race condition.
        let refunded = false;
        try {
          const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
            apiVersion: '2023-10-16',
          });
          await stripe.refunds.create({
            payment_intent: paymentIntentId || orderId,
            reason: 'requested_by_customer',
            metadata: { reason: 'out_of_stock', kind, id },
          });
          refunded = true;
        } catch (e) {
          console.warn('Out-of-stock refund attempt failed:', e);
        }

        // Keep the order record, but mark as failed/refunded so support/ops can see why it didn't complete.
        await supabase
          .from('orders')
          .update({
            status: refunded ? 'refunded' : 'failed',
            payment_status: refunded ? 'refunded' : 'paid',
            updated_at: new Date().toISOString(),
          })
          .eq('id', orderId);

        return new Response(JSON.stringify({
          error: 'Out of stock',
          code: 'OUT_OF_STOCK',
          kind,
          id,
          refunded,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 409,
        });
      }

      throw inventoryError;
    }

    // Update order status to completed
    const { error: orderError } = await supabase
      .from('orders')
      .update({
        status: 'completed',
        payment_status: 'paid',
        stripe_payment_intent_id: paymentIntentId,
        billing_name: billingDetails.name,
        billing_email: billingDetails.email,
        subtotal_amount: subtotalAmount,
        tax_amount: normalizedTax,
        shipping_amount: normalizedShippingAmount,
        total_amount: normalizedTotalPaid,
        shipping_option_id: safeShippingOptionId,
        shipping_logistic_name: (() => {
          const name = (shippingOptionName && shippingOptionName.trim()) || (typeof shippingLogisticName === 'string' ? shippingLogisticName.trim() : '');
          return name ? name : null;
        })(),
        shipping_info: shippingInfo,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId)

    if (orderError) {
      throw new Error(`Failed to update order: ${orderError.message}`)
    }

    // Create individual order items with CORRECT fee breakdown
      for (let i = 0; i < items.length; i++) {
        const item = items[i] as CartItem;
        const detail = distributionDetails[i];
        const safeVariantId =
          typeof item.variantId === 'string' && looksLikeUuid(item.variantId) ? item.variantId : null;
        
        const { error: itemError } = await supabase
          .from('order_items')
          .insert({
            order_id: orderId,
            product_id: item.productId,
            variant_id: safeVariantId,
            shipping_option_id: safeShippingOptionId,
            seller_id: item.sellerId,
          affiliate_id: (detail.affiliateId as string | null) || null,
          affiliate_referrer_id: (detail.recruiterAffiliateId as string | null) || null,
          quantity: item.quantity,
          unit_price: item.price,
          total_price: item.price * item.quantity,
          seller_desired_amount: item.sellerDesiredAmount || item.price * 0.7,
          seller_payout: detail.distribution.sellerAmount,
          affiliate_commission: detail.distribution.affiliateAmount,
          referral_bonus: detail.distribution.referralAmount,
          beezio_gross: detail.distribution.platformFee,
          beezio_net: detail.distribution.beezioNet,
          platform_fee: detail.distribution.platformFee,
          stripe_fee: detail.distribution.stripeFee,
          commission_rate: item.commissionRate,
          affiliate_commission_rate: item.affiliateCommissionRate || 0,
          tax_amount: tax / items.length // Spread tax across items (simple allocation)
        })

      if (itemError) {
        console.error(`Failed to create order item for product ${item.productId}:`, itemError)
      }
    }

    // Update product sales counts
    for (const item of items as CartItem[]) {
      const qty = Number.isFinite(item?.quantity) ? Number(item.quantity) : 0;
      if (qty <= 0) continue;
      await supabase.rpc('increment_product_sales_count', {
        p_product_id: item.productId,
        p_quantity: qty,
      })
    }

    // Create commission records for affiliates (direct commissions)
    for (let i = 0; i < items.length; i++) {
      const item = items[i] as CartItem;
      const detail = distributionDetails[i];

      const resolvedAffiliateId = (detail.affiliateId as string | null) || null;

      if (resolvedAffiliateId && detail.distribution.affiliateAmount > 0) {
        await supabase
          .from('commissions')
          .insert({
            affiliate_id: resolvedAffiliateId,
            product_id: item.productId,
            order_id: orderId,
            commission_rate: item.affiliateCommissionRate || 0,
            commission_amount: detail.distribution.affiliateAmount,
            status: 'pending',
          });
      }
    }

    // Create recruiter earnings (5% of sale) based on sale-owner recruitment
    const recruiterEarningsByPair = new Map<string, { recruiterId: string; recruitId: string; amount: number }>();
    for (let i = 0; i < items.length; i++) {
      const item = items[i] as CartItem;
      const detail = distributionDetails[i];
      const recruiterId = (detail.recruiterAffiliateId as string | null) || null;
      const recruitId = (detail.saleOwnerId as string | null) || null;
      if (!recruiterId || !recruitId) continue;
      if (!(detail.distribution.referralAmount > 0)) continue;

      const key = `${recruiterId}__${recruitId}`;
      const current = recruiterEarningsByPair.get(key);
      if (current) {
        current.amount = round2(current.amount + detail.distribution.referralAmount);
      } else {
        recruiterEarningsByPair.set(key, {
          recruiterId,
          recruitId,
          amount: detail.distribution.referralAmount,
        });
      }
    }

    for (const { recruiterId, recruitId, amount } of recruiterEarningsByPair.values()) {
      try {
        await supabase
          .from('recruiter_earnings')
          .insert({
            recruiter_id: recruiterId,
            recruit_id: recruitId,
            order_id: orderId,
            amount,
            status: 'pending',
          });
      } catch (e) {
        console.warn('Recruiter earnings insert failed (non-fatal):', e);
      }
    }

    // Create payment distribution records for proper payouts
    const distributionRecords = [];
    
    // Group by seller
    const sellerPayouts = new Map();
    distributionDetails.forEach(detail => {
      const sellerId = detail.sellerId;
      const current = sellerPayouts.get(sellerId) || 0;
      sellerPayouts.set(sellerId, current + detail.distribution.sellerAmount);
    });
    
    // Group by affiliate  
    const affiliatePayouts = new Map();
    distributionDetails.forEach(detail => {
      if (detail.affiliateId && detail.distribution.affiliateAmount > 0) {
        const affiliateId = detail.affiliateId;
        const current = affiliatePayouts.get(affiliateId) || 0;
        affiliatePayouts.set(affiliateId, current + detail.distribution.affiliateAmount);
      }
    });

    // Insert seller payout records
    for (const [sellerId, amount] of sellerPayouts) {
      await supabase
        .from('payment_distributions')
        .insert({
          order_id: orderId,
          recipient_type: 'seller',
          recipient_id: sellerId,
          amount: amount,
          percentage: 100.00, // Seller gets 100% of their desired amount
          status: 'pending'
        });
    }

    // Insert affiliate payout records
    for (const [affiliateId, amount] of affiliatePayouts) {
      await supabase
        .from('payment_distributions')
        .insert({
          order_id: orderId,
          recipient_type: 'affiliate', 
          recipient_id: affiliateId,
          amount: amount,
          percentage: 0, // Will be calculated based on commission rates
          status: 'pending'
        });
    }

    // Insert platform revenue record
    await supabase
      .from('payment_distributions')
      .insert({
        order_id: orderId,
        recipient_type: 'platform',
        recipient_id: null,
        amount: totalPlatformRevenue,
        // Net platform amount after recruiter override. Percentage is informational here.
        percentage: 15.00,
        status: 'pending'
      });

    // Log distribution summary
    console.log('✅ Order completed with Beezio distribution:', {
      orderId,
      totalPaid: `$${totalPaid.toFixed(2)}`,
      breakdown: {
        sellers: `$${totalSellerPayouts.toFixed(2)} (get exactly what they wanted)`,
        affiliates: `$${totalAffiliatePayouts.toFixed(2)} (commission)`,
        platform: `$${totalPlatformRevenue.toFixed(2)} (net after recruiter override)`,
        stripe: `$${totalStripeFees.toFixed(2)} (Stripe fees)`
      },
      verification: `${totalSellerPayouts.toFixed(2)} + ${totalAffiliatePayouts.toFixed(2)} + ${totalPlatformRevenue.toFixed(2)} + ${totalStripeFees.toFixed(2)} = ${(totalSellerPayouts + totalAffiliatePayouts + totalPlatformRevenue + totalStripeFees).toFixed(2)}`
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        orderId: orderId,
        message: 'Order completed with correct fee distribution',
        distribution: {
          totalSellerPayouts: totalSellerPayouts.toFixed(2),
          totalAffiliatePayouts: totalAffiliatePayouts.toFixed(2), 
          totalPlatformRevenue: totalPlatformRevenue.toFixed(2),
          totalStripeFees: totalStripeFees.toFixed(2),
          totalDistributed: (totalSellerPayouts + totalAffiliatePayouts + totalPlatformRevenue + totalStripeFees).toFixed(2)
        }
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Complete order error:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to complete order' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
