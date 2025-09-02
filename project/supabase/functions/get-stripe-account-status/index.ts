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

  try {
    const { userId } = await req.json()

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2023-10-16',
    })

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get user's Stripe account ID
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('stripe_account_id')
      .eq('id', userId)
      .single()

    if (profileError || !profile?.stripe_account_id) {
      return new Response(JSON.stringify({ error: 'No Stripe account found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      })
    }

    // Get account status from Stripe
    const account = await stripe.accounts.retrieve(profile.stripe_account_id)
    
    // Get account balance
    const balance = await stripe.balance.retrieve({
      stripeAccount: profile.stripe_account_id,
    })

    // Get upcoming payout (if any)
    let nextPayout = null
    try {
      const payouts = await stripe.payouts.list(
        { limit: 1 },
        { stripeAccount: profile.stripe_account_id }
      )
      if (payouts.data.length > 0) {
        nextPayout = payouts.data[0]
      }
    } catch (error) {
      // Ignore payout errors for new accounts
    }

    const accountStatus = {
      account_id: account.id,
      charges_enabled: account.charges_enabled,
      payouts_enabled: account.payouts_enabled,
      details_submitted: account.details_submitted,
      requirements: account.requirements?.currently_due || [],
      business_name: account.business_profile?.name,
      business_url: account.business_profile?.url,
      balance_available: balance.available.reduce((sum, bal) => sum + bal.amount, 0) / 100,
      balance_pending: balance.pending.reduce((sum, bal) => sum + bal.amount, 0) / 100,
      next_payout_date: nextPayout ? new Date(nextPayout.arrival_date * 1000).toLocaleDateString() : null,
      next_payout_amount: nextPayout ? nextPayout.amount / 100 : null,
    }

    return new Response(JSON.stringify(accountStatus), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('Error getting account status:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
