import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

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
const STRIPE_FIXED = 0.60;
const PLATFORM_PERCENT = 0.15;
const REFERRER_PERCENT_OF_SALE = 0.05;
const PLATFORM_FEE_UNDER_20_THRESHOLD = 20;
const PLATFORM_FEE_UNDER_20_SURCHARGE = 1;

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

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

  const affiliateAmountTotal = round2(
    affiliateType === 'flat_rate'
      ? (Number.isFinite(affiliatePercent) ? affiliatePercent : 0) * qty
      : finalPriceTotal * (Math.max(0, affiliatePercent) / 100)
  );

  const sellerAmountTotal = round2((Number.isFinite(sellerAskPerUnit) ? sellerAskPerUnit : 0) * qty);

  // IMPORTANT: This code models Stripe fixed fee per-unit, because item prices were computed per-unit.
  const stripeFeeTotal = round2(finalPriceTotal * STRIPE_PERCENT + STRIPE_FIXED * qty);

  const platformFeeTotal = round2(
    finalPriceTotal * PLATFORM_PERCENT + platformSurchargePerUnit(sellerAskPerUnit) * qty
  );

  const referralAmountTotal = recruiterEnabled
    ? round2(finalPriceTotal * REFERRER_PERCENT_OF_SALE)
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
      tax = 0 // Fixed tax amount passed from client
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
      tax
    });

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
      }

      // Recruiter bonus is based on the SELLER being referred at signup.
      // If seller has referred_by_affiliate_id, pay recruiter 5% of sale and reduce Beezio net from 15% to 10%.
      let recruiterAffiliateId: string | null = null;
      if (item.sellerId) {
        if (sellerRecruiterCache.has(item.sellerId)) {
          recruiterAffiliateId = sellerRecruiterCache.get(item.sellerId) ?? null;
        } else {
          const { data: sellerProfile, error: sellerLookupError } = await supabase
            .from('profiles')
            .select('id, referred_by_affiliate_id')
            .eq('id', item.sellerId)
            .maybeSingle();

          if (sellerLookupError) {
            console.warn('Seller recruiter lookup warning:', sellerLookupError);
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

    // Update order status to completed
    const { error: orderError } = await supabase
      .from('orders')
      .update({
        status: 'completed',
        payment_status: 'paid',
        stripe_payment_intent_id: paymentIntentId,
        billing_name: billingDetails.name,
        billing_email: billingDetails.email,
        tax_amount: tax,
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
      
      const { error: itemError } = await supabase
        .from('order_items')
        .insert({
          order_id: orderId,
          product_id: item.productId,
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
      await supabase
        .from('products')
        .update({
          sales_count: supabase.sql`sales_count + ${item.quantity}`,
        })
        .eq('id', item.productId)
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

    // Create recruiter earnings (5% of sale) based on SELLER recruitment
    const recruiterEarningsByPair = new Map<string, { recruiterId: string; recruitId: string; amount: number }>();
    for (let i = 0; i < items.length; i++) {
      const item = items[i] as CartItem;
      const detail = distributionDetails[i];
      const recruiterId = (detail.recruiterAffiliateId as string | null) || null;
      const recruitId = (detail.sellerId as string | null) || null;
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
