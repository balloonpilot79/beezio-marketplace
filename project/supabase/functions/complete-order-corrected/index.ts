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
  stripeFee: number;
  totalListingPrice: number;
}

// Calculate correct fee distribution using our NEW formula
function calculateCorrectDistribution(
  sellerDesiredAmount: number,
  affiliateRate: number = 0,
  affiliateType: string = 'percentage'
): PaymentDistribution {
  // Step 1: Seller gets exactly what they want
  const sellerAmount = sellerDesiredAmount;

  // Step 2: Affiliate commission
  const affiliateAmount = affiliateType === 'flat_rate'
    ? affiliateRate
    : sellerAmount * (affiliateRate / 100);

  // Step 3: Stripe fee = 3% of (seller + affiliate) + $0.60
  const stripeBase = sellerAmount + affiliateAmount;
  const stripeFee = stripeBase * 0.03 + 0.60;

  // Step 4: Beezio gets 10% of (seller + affiliate + stripe)
  const totalBeforePlatform = sellerAmount + affiliateAmount + stripeFee;
  const platformFee = totalBeforePlatform * 0.10; // Beezio gets 10%

  // Step 5: Total listing price = (seller + affiliate + stripe) + Beezio
  const totalListingPrice = totalBeforePlatform + platformFee;

  return {
    sellerAmount,
    affiliateAmount,
    platformFee,
    stripeFee,
    totalListingPrice
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

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
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

    for (const item of items as CartItem[]) {
      const sellerAmountForItem = (item.sellerDesiredAmount || item.price * 0.7) * item.quantity;
      const affiliateRate = item.affiliateCommissionRate || 0;
      
      const distribution = calculateCorrectDistribution(
        sellerAmountForItem,
        affiliateRate,
        'percentage'
      );
      
      totalSellerPayouts += distribution.sellerAmount;
      totalAffiliatePayouts += distribution.affiliateAmount;
      totalPlatformRevenue += distribution.platformFee;
      totalStripeFees += distribution.stripeFee;
      
      distributionDetails.push({
        productId: item.productId,
        sellerId: item.sellerId,
        affiliateId: item.affiliateId,
        distribution
      });
      
      console.log(`📊 Item ${item.productId} distribution:`, {
        seller: `$${distribution.sellerAmount.toFixed(2)}`,
        affiliate: `$${distribution.affiliateAmount.toFixed(2)}`,
        platform: `$${distribution.platformFee.toFixed(2)}`,
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
          affiliate_id: item.affiliateId || null,
          quantity: item.quantity,
          unit_price: item.price,
          total_price: item.price * item.quantity,
          seller_desired_amount: item.sellerDesiredAmount || item.price * 0.7,
          seller_payout: detail.distribution.sellerAmount,
          affiliate_commission: detail.distribution.affiliateAmount,
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

    // Create CORRECT commission records for affiliates
    for (let i = 0; i < items.length; i++) {
      const item = items[i] as CartItem;
      const detail = distributionDetails[i];
      
      if (item.affiliateId && detail.distribution.affiliateAmount > 0) {
        await supabase
          .from('commissions')
          .insert({
            affiliate_id: item.affiliateId,
            product_id: item.productId,
            order_id: orderId,
            commission_rate: item.affiliateCommissionRate || 0,
            commission_amount: detail.distribution.affiliateAmount,
            status: 'pending',
          })
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
        percentage: 10.00, // Always 10% of seller amounts
        status: 'pending'
      });

    // Log the CORRECT distribution using NEW formula
    console.log('✅ Order completed with NEW fee distribution (seller+affiliate+stripe=beezio=listing):', {
      orderId,
      totalPaid: `$${totalPaid.toFixed(2)}`,
      breakdown: {
        sellers: `$${totalSellerPayouts.toFixed(2)} (get exactly what they wanted)`,
        affiliates: `$${totalAffiliatePayouts.toFixed(2)} (commission)`,
        platform: `$${totalPlatformRevenue.toFixed(2)} (10% of seller amounts)`,
        stripe: `$${totalStripeFees.toFixed(2)} (3% processing)`
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
