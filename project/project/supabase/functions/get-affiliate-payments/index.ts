import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import Stripe from 'npm:stripe@14.21.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const { userId } = await req.json()

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2023-10-16',
    })

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: profile } = await supabase.from('profiles').select('stripe_account_id').eq('id', userId).maybeSingle()

    if (!profile?.stripe_account_id) {
      return new Response(JSON.stringify([]), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    const payouts = await stripe.payouts.list({ limit: 20 }, { stripeAccount: profile.stripe_account_id })

    const rows = payouts.data.map((p) => ({
      id: p.id,
      amount: p.amount / 100,
      status: p.status === 'in_transit' ? 'processing' : p.status,
      payment_date: new Date(p.created * 1000).toISOString(),
      period: new Date(p.created * 1000).toLocaleDateString(),
      products_count: 0,
      stripe_transfer_id: p.balance_transaction ? String(p.balance_transaction) : undefined,
    }))

    return new Response(JSON.stringify(rows), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    console.error('Error getting affiliate payments:', error)
    return new Response(JSON.stringify([]), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  }
})

