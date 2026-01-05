import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import Stripe from 'npm:stripe@14.21.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 405,
    })
  }

  try {
    const { paymentIntentId, reason } = await req.json()
    const safePaymentIntentId = typeof paymentIntentId === 'string' ? paymentIntentId.trim() : ''
    if (!safePaymentIntentId) {
      return new Response(JSON.stringify({ error: 'paymentIntentId required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    const serviceRoleKey =
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ??
      Deno.env.get('SERVICE_ROLE_KEY') ??
      ''

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      serviceRoleKey,
      {
        global: {
          headers: {
            Authorization: req.headers.get('Authorization') ?? '',
          },
        },
      }
    )

    const { data: authData, error: authError } = await supabase.auth.getUser()
    if (authError || !authData?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
    }

    const userId = authData.user.id

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, user_id, payment_status, status')
      .eq('id', safePaymentIntentId)
      .maybeSingle()

    if (orderError) {
      throw new Error(`Order lookup failed: ${orderError.message}`)
    }

    if (!order?.id) {
      return new Response(JSON.stringify({ error: 'Order not found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      })
    }

    if (order.user_id && order.user_id !== userId) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      })
    }

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2023-10-16',
    })

    const pi = await stripe.paymentIntents.retrieve(safePaymentIntentId)

    let action: 'refund' | 'cancel' = 'refund'
    let refundId: string | null = null

    if (pi.status === 'succeeded' || pi.status === 'requires_capture') {
      const stripeRefund = await stripe.refunds.create({
        payment_intent: safePaymentIntentId,
        reason: 'requested_by_customer',
        metadata: {
          reason: typeof reason === 'string' ? reason.slice(0, 200) : 'order_failed',
        },
      })
      refundId = stripeRefund.id
      action = 'refund'
    } else if (pi.status === 'requires_payment_method' || pi.status === 'requires_confirmation') {
      await stripe.paymentIntents.cancel(safePaymentIntentId)
      action = 'cancel'
    } else if (pi.status === 'canceled') {
      action = 'cancel'
    } else {
      // Fallback: attempt refund; Stripe will error if invalid
      const stripeRefund = await stripe.refunds.create({
        payment_intent: safePaymentIntentId,
        reason: 'requested_by_customer',
        metadata: {
          reason: typeof reason === 'string' ? reason.slice(0, 200) : 'order_failed',
        },
      })
      refundId = stripeRefund.id
      action = 'refund'
    }

    await supabase
      .from('orders')
      .update({
        status: action === 'refund' ? 'refunded' : 'canceled',
        payment_status: action === 'refund' ? 'refunded' : 'canceled',
        updated_at: new Date().toISOString(),
      })
      .eq('id', safePaymentIntentId)

    return new Response(JSON.stringify({ ok: true, action, refundId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (e: any) {
    const message = e instanceof Error ? e.message : String(e)
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})

