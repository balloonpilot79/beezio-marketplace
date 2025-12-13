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
  price: number;
  quantity: number;
  sellerId: string;
  sellerDesiredAmount?: number;
  commissionRate: number;
  affiliateId?: string;
  affiliateCommissionRate?: number;
}

const roundToCents = (amount: number): number => Math.round((amount + Number.EPSILON) * 100);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { 
      amount, 
      items, 
      userId, 
      billingName, 
      billingEmail 
    } = await req.json()

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2023-10-16',
    })

    const serviceRoleKey =
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ??
      Deno.env.get('SERVICE_ROLE_KEY') ??
      ''

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      serviceRoleKey
    )

    // Calculate totals for the first item (for metadata)
    const primaryItem = items[0] as CartItem
    const totalAmount = amount / 100 // Convert back from cents

    // Create comprehensive metadata for payment distribution
    const metadata = {
      userId: userId || '',
      billingName: billingName || '',
      billingEmail: billingEmail || '',
      itemCount: items.length.toString(),
      totalAmount: totalAmount.toString(),
      // Primary item metadata (for simple cases)
      productId: primaryItem?.productId || '',
      sellerId: primaryItem?.sellerId || '',
      commissionRate: (primaryItem?.commissionRate || 70).toString(),
      affiliateId: primaryItem?.affiliateId || '',
      affiliateCommissionRate: (primaryItem?.affiliateCommissionRate || 0).toString(),
      // Additional metadata as JSON string for complex cases
      allItems: JSON.stringify(items)
    }

    // Stripe Connect destination charges only work when all items belong to one seller.
    // Otherwise, keep funds on the platform and rely on the webhook/payout automation.
    const uniqueSellerIds = Array.from(
      new Set((Array.isArray(items) ? items : []).map((it: CartItem) => it?.sellerId).filter(Boolean))
    ) as string[]

    const singleSellerId = uniqueSellerIds.length === 1 ? uniqueSellerIds[0] : null

    // Sum seller totals from item metadata (authoritative for payout math)
    const sellerTotalCents = (Array.isArray(items) ? items : []).reduce((acc: number, item: CartItem) => {
      const qty = Number.isFinite(item?.quantity) ? Number(item.quantity) : 0
      const sellerAskUnit = Number.isFinite(item?.sellerDesiredAmount)
        ? Number(item.sellerDesiredAmount)
        : (Number.isFinite(item?.price) ? Number(item.price) * 0.7 : 0)
      return acc + roundToCents(sellerAskUnit) * qty
    }, 0)

    // Check for seller connected account (only for single-seller carts)
    let transferDestination: string | undefined = undefined
    try {
      if (singleSellerId) {
        const { data: sellerProfile, error: sellerError } = await supabase
          .from('profiles')
          .select('stripe_account_id')
          .eq('id', singleSellerId)
          .maybeSingle()

        if (!sellerError && sellerProfile?.stripe_account_id) {
          transferDestination = sellerProfile.stripe_account_id
        }
      }
    } catch (err) {
      console.error('Error fetching seller profile for transfer destination:', err)
    }

    // Build PaymentIntent params. If transferDestination is present, create a direct charge to the connected account
    const piParams: any = {
      amount,
      currency: 'usd',
      metadata,
      description: `Order from ${billingName || 'Customer'} - ${items.length} item(s)`,
    }

    if (transferDestination) {
      // Keep seller proceeds consistent with our internal distribution logic.
      // Seller receives sellerDesiredAmount totals; platform retains everything else
      // (affiliate commission, platform revenue, Stripe buffer, shipping/tax/rounding).
      const applicationFeeAmount = Math.max(amount - sellerTotalCents, 0)

      piParams.transfer_data = { destination: transferDestination }
      piParams.application_fee_amount = applicationFeeAmount
    }

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create(piParams)

    // Create order record in database
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        id: paymentIntent.id, // Use payment intent ID as order ID
        user_id: userId,
        total_amount: totalAmount,
        currency: 'USD',
        status: 'pending',
        payment_status: 'pending',
        stripe_payment_intent_id: paymentIntent.id,
        billing_name: billingName,
        billing_email: billingEmail,
        order_items: items
      })
      .select()
      .single()

    if (orderError) {
      console.error('Error creating order:', orderError)
      // Continue anyway, order will be created by webhook
    }

    return new Response(JSON.stringify({
      client_secret: paymentIntent.client_secret,
      payment_intent_id: paymentIntent.id,
      // In our schema we use the PaymentIntent id as the order id
      order_id: paymentIntent.id
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('Payment intent creation error:', error)
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})