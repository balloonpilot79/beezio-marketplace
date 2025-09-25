import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import Stripe from 'npm:stripe@13.0.0'

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
    const { purchase_id, amount, buyer_id, seller_id, affiliate_id } = await req.json()

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
      apiVersion: '2023-10-16',
    })

    // Get seller's Stripe account
    const { data: sellerProfile, error: sellerError } = await supabase
      .from('profiles')
      .select('stripe_account_id')
      .eq('id', seller_id)
      .single()

    if (sellerError || !sellerProfile?.stripe_account_id) {
      throw new Error('Seller Stripe account not found')
    }

    // Get affiliate's Stripe account if applicable
    let affiliateAccountId = null
    if (affiliate_id) {
      const { data: affiliateProfile, error: affiliateError } = await supabase
        .from('profiles')
        .select('stripe_account_id')
        .eq('id', affiliate_id)
        .single()

      if (!affiliateError && affiliateProfile?.stripe_account_id) {
        affiliateAccountId = affiliateProfile.stripe_account_id
      }
    }

    // Calculate amounts
    const platformFee = Math.round(amount * 100 * 0.10) // 10% platform fee
    const affiliateCommission = affiliate_id ? Math.round((amount * 100 - platformFee) * 0.15) : 0 // 15% affiliate commission
    const sellerAmount = Math.round(amount * 100) - platformFee - affiliateCommission

    // Create payment intent (simulated for testing)
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
      application_fee_amount: platformFee,
      transfer_data: {
        destination: sellerProfile.stripe_account_id,
      },
      metadata: {
        purchase_id,
        buyer_id,
        seller_id,
        affiliate_id: affiliate_id || '',
      },
    })

    // Confirm payment (simulated)
    const confirmedPayment = await stripe.paymentIntents.confirm(paymentIntent.id, {
      payment_method: 'pm_card_visa', // Test payment method
    })

    // Process affiliate commission if applicable
    let affiliateTransfer = null
    if (affiliateAccountId && affiliateCommission > 0) {
      affiliateTransfer = await stripe.transfers.create({
        amount: affiliateCommission,
        currency: 'usd',
        destination: affiliateAccountId,
        metadata: {
          purchase_id,
          affiliate_id,
          type: 'commission'
        },
      })
    }

    // Record transaction
    const { error: transactionError } = await supabase
      .from('marketplace_transactions')
      .insert({
        purchase_id,
        stripe_payment_id: confirmedPayment.id,
        amount: amount,
        platform_fee: platformFee / 100,
        seller_amount: sellerAmount / 100,
        affiliate_amount: affiliateCommission / 100,
        affiliate_id,
        status: 'completed'
      })

    if (transactionError) {
      console.error('Error recording transaction:', transactionError)
    }

    return new Response(JSON.stringify({
      success: true,
      payment_id: confirmedPayment.id,
      seller_transfer_id: paymentIntent.transfer_data?.destination,
      affiliate_transfer_id: affiliateTransfer?.id,
      amounts: {
        total: amount,
        platform_fee: platformFee / 100,
        seller_amount: sellerAmount / 100,
        affiliate_amount: affiliateCommission / 100
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    })

  } catch (error) {
    console.error('Payment processing error:', error)
    return new Response(JSON.stringify({ error: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })
  }
})