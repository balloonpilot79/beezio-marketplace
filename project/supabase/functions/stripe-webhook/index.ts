import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import Stripe from 'npm:stripe@14.21.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface PaymentMetadata {
  productId: string
  sellerId: string
  userId: string
  commissionRate: string
  affiliateId?: string
  affiliateCommissionRate?: string
  billingName: string
  billingEmail: string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2023-10-16',
    })

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const signature = req.headers.get('stripe-signature')
    const body = await req.text()
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')

    if (!signature || !webhookSecret) {
      throw new Error('Missing signature or webhook secret')
    }

    // Verify webhook signature
    const event = stripe.webhooks.constructEvent(body, signature, webhookSecret)

    console.log('Webhook event received:', event.type)

    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        
        // Extract metadata
        const metadata = paymentIntent.metadata as PaymentMetadata
        const {
          productId,
          sellerId,
          userId,
          commissionRate,
          affiliateId,
          affiliateCommissionRate,
          billingName,
          billingEmail,
        } = metadata

        console.log('Processing payment distribution for:', paymentIntent.id)

        // Create transaction record
        const { data: transaction, error: transactionError } = await supabase
          .from('transactions')
          .insert({
            stripe_payment_intent_id: paymentIntent.id,
            total_amount: paymentIntent.amount / 100, // Convert from cents
            currency: paymentIntent.currency.toUpperCase(),
            status: 'completed'
          })
          .select()
          .single()

        if (transactionError) {
          console.error('Error creating transaction:', transactionError)
          throw transactionError
        }

        // Calculate CORRECT payment distributions using our NEW pricing formula
        const totalAmount = paymentIntent.amount / 100
        const sellerCommissionRate = parseFloat(commissionRate) || 70
        const affiliateCommissionPercent = parseFloat(affiliateCommissionRate || '0')

        // Use our NEW pricing formula: Beezio gets 10% of (seller + affiliate + stripe)
        // 1. Seller gets their desired amount (70% of listing price by default)
        const sellerDesiredAmount = totalAmount * (sellerCommissionRate / 100)
        // 2. Affiliate commission
        const affiliateAmount = affiliateId ? sellerDesiredAmount * (affiliateCommissionPercent / 100) : 0
        // 3. Stripe fee = 3% of (seller + affiliate) + $0.60
        const stripeBase = sellerDesiredAmount + affiliateAmount
        const stripeFee = stripeBase * 0.03 + 0.60
        // 4. Beezio gets 10% of (seller + affiliate + stripe)
        const totalBeforePlatform = sellerDesiredAmount + affiliateAmount + stripeFee
        const platformFee = totalBeforePlatform * 0.10 // Beezio gets 10%

        console.log('✅ CORRECT Distribution breakdown:', {
          totalAmount,
          sellerDesiredAmount,
          affiliateAmount,
          stripeFee,
          platformFee,
          totalBeforePlatform,
          verification: totalBeforePlatform + platformFee
        })

        const sellerAmount = sellerDesiredAmount
        const platformAmount = platformFee

        // Create payment distribution records
        const distributions = [
          {
            transaction_id: transaction.id,
            recipient_type: 'seller',
            recipient_id: sellerId,
            amount: sellerAmount,
            percentage: sellerCommissionRate,
            status: 'pending'
          },
          {
            transaction_id: transaction.id,
            recipient_type: 'platform',
            recipient_id: null,
            amount: platformAmount,
            percentage: 100 - sellerCommissionRate - affiliateCommissionPercent,
            status: 'completed' // Platform gets paid immediately
          }
        ]

        // Add affiliate distribution if applicable
        if (affiliateId && affiliateAmount > 0) {
          distributions.push({
            transaction_id: transaction.id,
            recipient_type: 'affiliate',
            recipient_id: affiliateId,
            amount: affiliateAmount,
            percentage: affiliateCommissionPercent,
            status: 'pending'
          })
        }

        const { error: distributionError } = await supabase
          .from('payment_distributions')
          .insert(distributions)

        if (distributionError) {
          console.error('Error creating payment distributions:', distributionError)
          throw distributionError
        }

        // Record platform revenue
        const currentMonth = new Date().toISOString().slice(0, 7) // YYYY-MM
        const { error: revenueError } = await supabase
          .from('platform_revenue')
          .insert({
            transaction_id: transaction.id,
            amount: platformAmount,
            revenue_type: 'commission',
            month_year: currentMonth
          })

        if (revenueError) {
          console.error('Error recording platform revenue:', revenueError)
        }

        // Update order status
        const { error: orderError } = await supabase
          .from('orders')
          .update({
            status: 'completed',
            payment_status: 'paid',
            fulfillment_status: 'processing', // Set to processing to trigger automation
            updated_at: new Date().toISOString()
          })
          .eq('stripe_payment_intent_id', paymentIntent.id)

        if (orderError) {
          console.error('Error updating order:', orderError)
        }

        // Trigger automated order fulfillment
        try {
          const { data: orderData } = await supabase
            .from('orders')
            .select('id')
            .eq('stripe_payment_intent_id', paymentIntent.id)
            .single()

          if (orderData) {
            console.log('Triggering automated fulfillment for order:', orderData.id)

            // Call the automated fulfillment function
            const fulfillmentResponse = await fetch(
              `${Deno.env.get('SUPABASE_URL')}/functions/v1/automated-order-fulfillment`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
                },
                body: JSON.stringify({ orderId: orderData.id }),
              }
            )

            if (!fulfillmentResponse.ok) {
              console.error('Failed to trigger automated fulfillment:', await fulfillmentResponse.text())
            } else {
              console.log('Automated fulfillment triggered successfully')
            }
          }
        } catch (error) {
          console.error('Error triggering automated fulfillment:', error)
          // Don't throw here - we don't want to fail the webhook if fulfillment fails
        }

        // Initiate automatic payouts for amounts over threshold
        await initiateAutomaticPayouts(supabase, stripe)

        break
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        
        // Update transaction status
        await supabase
          .from('transactions')
          .update({ status: 'failed' })
          .eq('stripe_payment_intent_id', paymentIntent.id)

        // Update order status
        await supabase
          .from('orders')
          .update({ 
            status: 'failed',
            payment_status: 'failed',
            updated_at: new Date().toISOString()
          })
          .eq('stripe_payment_intent_id', paymentIntent.id)

        break
      }

      case 'transfer.created':
      case 'transfer.paid':
      case 'transfer.failed': {
        const transfer = event.data.object as Stripe.Transfer
        
        // Update payout status
        const status = event.type === 'transfer.paid' ? 'completed' : 
                      event.type === 'transfer.failed' ? 'failed' : 'processing'
        
        await supabase
          .from('payouts')
          .update({ 
            status,
            completed_at: event.type === 'transfer.paid' ? new Date().toISOString() : null,
            failure_reason: event.type === 'transfer.failed' ? transfer.failure_message : null
          })
          .eq('stripe_transfer_id', transfer.id)

        break
      }

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('Webhook error:', error)
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})

// Function to initiate automatic payouts for users with sufficient balance
async function initiateAutomaticPayouts(supabase: any, stripe: Stripe) {
  const MINIMUM_PAYOUT_AMOUNT = 25 // Minimum $25 for payout
  
  try {
    // Get users with sufficient balance for payout
    const { data: eligibleUsers, error } = await supabase
      .from('user_earnings')
      .select(`
        user_id,
        role,
        current_balance,
        profiles!inner(stripe_account_id, full_name, email)
      `)
      .gte('current_balance', MINIMUM_PAYOUT_AMOUNT)
      .not('profiles.stripe_account_id', 'is', null)

    if (error) {
      console.error('Error fetching eligible users:', error)
      return
    }

    if (!eligibleUsers?.length) {
      console.log('No users eligible for automatic payout')
      return
    }

    console.log(`Processing automatic payouts for ${eligibleUsers.length} users`)

    // Create payout batch
    const batchNumber = `AUTO_${Date.now()}`
    const totalBatchAmount = eligibleUsers.reduce((sum: number, user: any) => sum + user.current_balance, 0)

    const { data: batch, error: batchError } = await supabase
      .from('payout_batches')
      .insert({
        batch_number: batchNumber,
        total_amount: totalBatchAmount,
        recipient_count: eligibleUsers.length,
        status: 'processing'
      })
      .select()
      .single()

    if (batchError) {
      console.error('Error creating payout batch:', batchError)
      return
    }

    // Process individual payouts
    for (const user of eligibleUsers) {
      try {
        // Create Stripe transfer
        const transfer = await stripe.transfers.create({
          amount: Math.round(user.current_balance * 100), // Convert to cents
          currency: 'usd',
          destination: user.profiles.stripe_account_id,
          description: `Payout for ${user.role} earnings - Batch ${batchNumber}`
        })

        // Record payout
        await supabase
          .from('payouts')
          .insert({
            batch_id: batch.id,
            user_id: user.user_id,
            amount: user.current_balance,
            stripe_transfer_id: transfer.id,
            status: 'completed'
          })

        // Update user earnings
        await supabase
          .from('user_earnings')
          .update({
            paid_out: supabase.sql`paid_out + ${user.current_balance}`,
            pending_payout: supabase.sql`pending_payout - ${user.current_balance}`,
            current_balance: 0,
            last_payout_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('user_id', user.user_id)
          .eq('role', user.role)

        console.log(`Payout completed for user ${user.user_id}: $${user.current_balance}`)

      } catch (transferError) {
        console.error(`Error processing payout for user ${user.user_id}:`, transferError)
        
        // Record failed payout
        await supabase
          .from('payouts')
          .insert({
            batch_id: batch.id,
            user_id: user.user_id,
            amount: user.current_balance,
            status: 'failed',
            failure_reason: (transferError as Error).message
          })
      }
    }

    // Update batch status
    await supabase
      .from('payout_batches')
      .update({
        status: 'completed',
        processed_at: new Date().toISOString()
      })
      .eq('id', batch.id)

  } catch (error) {
    console.error('Error in automatic payouts:', error)
  }
}