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
    const { email, type, agreements_signed } = await req.json()

    if (!email || !agreements_signed) {
      return new Response(JSON.stringify({
        error: 'Email and signed agreements required'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2023-10-16',
    })

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Create Express account with enhanced metadata
    const account = await stripe.accounts.create({
      type: 'express',
      email,
      metadata: {
        beezio_user_type: type, // 'seller' or 'affiliate'
        agreements_signed: 'true',
        signup_date: new Date().toISOString(),
        platform: 'beezio-marketplace'
      },
      business_type: type === 'seller' ? 'individual' : 'individual',
      capabilities: {
        transfers: { requested: true },
      },
    })

    // Create account link for embedded onboarding
    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${Deno.env.get('SITE_URL') || 'http://localhost:5174'}/dashboard`,
      return_url: `${Deno.env.get('SITE_URL') || 'http://localhost:5174'}/dashboard`,
      type: 'account_onboarding',
      collect: 'eventually_due', // Collect all required information
    })

    // Store account creation in database
    const { error: dbError } = await supabase
      .from('stripe_account_creations')
      .insert({
        stripe_account_id: account.id,
        user_email: email,
        user_type: type,
        agreements_signed: true,
        onboarding_url: accountLink.url,
        created_at: new Date().toISOString()
      })

    if (dbError) {
      console.error('Error storing account creation:', dbError)
      // Don't fail the request for this
    }

    return new Response(JSON.stringify({
      account_id: account.id,
      onboarding_url: accountLink.url,
      embedded: true,
      requirements: {
        currently_due: account.requirements?.currently_due || [],
        eventually_due: account.requirements?.eventually_due || [],
        pending_verification: account.requirements?.pending_verification || []
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('Embedded Stripe account creation error:', error)
    return new Response(JSON.stringify({
      error: error.message
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})