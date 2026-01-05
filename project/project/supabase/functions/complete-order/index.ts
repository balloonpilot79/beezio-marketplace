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
      orderId, 
      paymentIntentId, 
      items, 
      billingDetails 
    } = await req.json()

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Update order status to completed
    const { error: orderError } = await supabase
      .from('orders')
      .update({
        status: 'completed',
        payment_status: 'paid',
        stripe_payment_intent_id: paymentIntentId,
        billing_name: billingDetails.name,
        billing_email: billingDetails.email,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId)

    if (orderError) {
      throw new Error(`Failed to update order: ${orderError.message}`)
    }

    // Create individual order items
    for (const item of items as CartItem[]) {
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
          commission_rate: item.commissionRate,
          affiliate_commission_rate: item.affiliateCommissionRate || 0,
        })

      if (itemError) {
        console.error(`Failed to create order item for product ${item.productId}:`, itemError)
        // Continue processing other items even if one fails
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

    // Create commission records for affiliates
    for (const item of items as CartItem[]) {
      if (item.affiliateId && item.affiliateCommissionRate > 0) {
        const commissionAmount = (item.price * item.quantity * item.affiliateCommissionRate) / 100

        await supabase
          .from('commissions')
          .insert({
            affiliate_id: item.affiliateId,
            product_id: item.productId,
            order_id: orderId,
            commission_rate: item.affiliateCommissionRate,
            commission_amount: commissionAmount,
            status: 'pending',
          })
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        orderId: orderId,
        message: 'Order completed successfully' 
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
