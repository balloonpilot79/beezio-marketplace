🔧 MANUAL SUPABASE EDGE FUNCTIONS DEPLOYMENT
=============================================

Since CLI is having login issues, let's use the dashboard method:

🎯 STEP-BY-STEP MANUAL DEPLOYMENT:

1. 🌐 Open Supabase Dashboard:
   https://supabase.com/dashboard/project/yemgssttxhkgrivuodbz

2. 🔑 Login with:
   Email: Jlovingsr@gmail.com
   Password: Cole&Sunny24

3. 📋 Navigate to Edge Functions:
   - Click "Edge Functions" in left sidebar
   - Click "Create a new function"

4. 🚀 Deploy Function #1: create-payment-intent
   =============================================
   - Function name: create-payment-intent
   - Copy the code below and paste in editor:

--- COPY THIS CODE ---
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
  commissionRate: number;
  affiliateId?: string;
  affiliateCommissionRate?: number;
}

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

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Calculate totals for the first item (for metadata)
    const primaryItem = items[0] as CartItem
    const totalAmount = amount / 100 // Convert back from cents

    // Create comprehensive metadata for payment distribution
    const metadata = {
      userId,
      productId: primaryItem.productId,
      sellerId: primaryItem.sellerId,
      totalAmount: totalAmount.toString(),
      itemCount: items.length.toString(),
      ...(primaryItem.affiliateId && {
        affiliateId: primaryItem.affiliateId,
        affiliateCommissionRate: primaryItem.affiliateCommissionRate?.toString() || '0'
      })
    }

    // Create customer if needed
    let customerId = null
    if (billingEmail) {
      try {
        const customers = await stripe.customers.list({
          email: billingEmail,
          limit: 1
        })
        
        if (customers.data.length > 0) {
          customerId = customers.data[0].id
        } else {
          const customer = await stripe.customers.create({
            email: billingEmail,
            name: billingName
          })
          customerId = customer.id
        }
      } catch (customerError) {
        console.error('Customer creation error:', customerError)
      }
    }

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'usd',
      metadata,
      description: `Purchase: ${primaryItem.title}${items.length > 1 ? ` and ${items.length - 1} other items` : ''}`,
      ...(customerId && { customer: customerId })
    })

    // Create order record
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        user_id: userId,
        total_amount: totalAmount,
        status: 'pending',
        payment_intent_id: paymentIntent.id,
        billing_name: billingName,
        billing_email: billingEmail
      })
      .select()
      .single()

    if (orderError) {
      console.error('Order creation error:', orderError)
      throw new Error('Failed to create order record')
    }

    // Create order items
    for (const item of items) {
      await supabase
        .from('order_items')
        .insert({
          order_id: order.id,
          product_id: item.productId,
          quantity: item.quantity,
          price: item.price,
          seller_id: item.sellerId,
          ...(item.affiliateId && {
            affiliate_id: item.affiliateId,
            affiliate_commission_rate: item.affiliateCommissionRate
          })
        })
    }

    return new Response(
      JSON.stringify({
        clientSecret: paymentIntent.client_secret,
        orderId: order.id,
        customerId
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Payment intent creation error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
--- END CODE ---

   - Click "Deploy function"

💡 NEXT: I'll give you the code for the other 3 functions in separate messages
   to avoid overwhelming you with too much text at once.

🎯 STATUS: Ready to deploy function #1 - create-payment-intent