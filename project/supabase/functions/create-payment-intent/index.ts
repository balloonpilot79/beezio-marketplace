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

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'usd',
      metadata,
      description: `Order from ${billingName || 'Customer'} - ${items.length} item(s)`,
    })

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
      payment_intent_id: paymentIntent.id
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