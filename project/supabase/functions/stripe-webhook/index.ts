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
  allItems?: string
}

// Unified distribution constants (keep aligned with frontend)
const STRIPE_PERCENT = 0.029;
const STRIPE_FIXED = 0.60;
const PLATFORM_PERCENT = 0.15;
const REFERRER_PERCENT_OF_SALE = 0.05;
const PLATFORM_FEE_UNDER_20_THRESHOLD = 20;
const PLATFORM_FEE_UNDER_20_SURCHARGE = 1;

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

const platformSurchargePerUnit = (sellerAskPerUnit: number): number =>
  Number.isFinite(sellerAskPerUnit) && sellerAskPerUnit > 0 && sellerAskPerUnit <= PLATFORM_FEE_UNDER_20_THRESHOLD
    ? PLATFORM_FEE_UNDER_20_SURCHARGE
    : 0;

type MetaCartItem = {
  productId: string;
  title?: string;
  price: number; // unit final customer price
  quantity: number;
  sellerId: string;
  sellerDesiredAmount?: number; // unit seller ask
  affiliateId?: string | null; // may be profile id or referral code
  affiliateCommissionRate?: number; // percent
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
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

    const tableHasColumn = async (tableName: string, columnName: string): Promise<boolean> => {
      try {
        const { data, error } = await supabase
          .from('information_schema.columns')
          .select('column_name')
          .eq('table_name', tableName)
          .eq('column_name', columnName)
          .limit(1)
          .maybeSingle()
        if (error) return false
        return Boolean(data)
      } catch (_e) {
        return false
      }
    }

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
          allItems,
        } = metadata

        console.log('Processing payment distribution for:', paymentIntent.id)

        // Idempotency check: if we've already processed this payment intent, skip
        const { data: existingTx, error: existingError } = await supabase
          .from('transactions')
          .select('id')
          .eq('stripe_payment_intent_id', paymentIntent.id)
          .limit(1)
          .maybeSingle()

        if (existingError) {
          console.error('Error checking existing transaction for idempotency:', existingError)
          // continue - we'll attempt to create the transaction below, but surface the error to logs
        }

        if (existingTx) {
          console.log(`PaymentIntent ${paymentIntent.id} already processed (transaction id: ${existingTx.id}). Skipping.`)
          return new Response(JSON.stringify({ received: true, skipped: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          })
        }

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

        // Best-effort: resolve the Beezio order id so downstream records can link correctly
        let beezioOrderId: string | null = null
        try {
          const { data: orderRow } = await supabase
            .from('orders')
            .select('id')
            .eq('stripe_payment_intent_id', paymentIntent.id)
            .maybeSingle()
          beezioOrderId = (orderRow as any)?.id ?? null
        } catch (e) {
          // non-blocking
        }

        // Calculate distributions using metadata.allItems when available (authoritative).
        const totalAmount = round2(paymentIntent.amount / 100)

        let items: MetaCartItem[] = [];
        try {
          if (allItems) {
            const parsed = JSON.parse(allItems);
            if (Array.isArray(parsed)) {
              items = parsed as MetaCartItem[];
            }
          }
        } catch (e) {
          console.warn('Failed to parse metadata.allItems; falling back to legacy metadata fields');
        }

        // Fallback to single-item metadata if needed
        if (!items.length) {
          items = [
            {
              productId,
              price: totalAmount,
              quantity: 1,
              sellerId,
              sellerDesiredAmount: undefined,
              affiliateId: affiliateId || null,
              affiliateCommissionRate: parseFloat(affiliateCommissionRate || '0') || 0,
            },
          ];
        }

        const sellerTotals = new Map<string, number>();
        const affiliateTotals = new Map<string, number>();
        let platformGrossTotal = 0;
        let stripeTotal = 0;
        let referralTotal = 0;

        for (const item of items) {
          const unitFinalPrice = Number.isFinite(item.price) ? item.price : 0;
          const qty = Number.isFinite(item.quantity) ? item.quantity : 0;
          const finalPriceTotal = round2(unitFinalPrice * qty);

          const sellerAskPerUnit = Number.isFinite(item.sellerDesiredAmount)
            ? (item.sellerDesiredAmount as number)
            : unitFinalPrice * 0.7; // best-effort fallback

          const sellerAmount = round2(sellerAskPerUnit * qty);
          const affiliatePercent = Number.isFinite(item.affiliateCommissionRate)
            ? (item.affiliateCommissionRate as number)
            : 0;
          const affiliateAmount = round2(finalPriceTotal * (Math.max(0, affiliatePercent) / 100));

          const platformGross = round2(
            finalPriceTotal * PLATFORM_PERCENT + platformSurchargePerUnit(sellerAskPerUnit) * qty
          );

          // Recruiter referral:
          // - Referral code is stored at signup: profiles.referred_by_affiliate_id on the *sale owner*.
          // - Sale owner is the attributed affiliate when present; otherwise it's the seller.
          let recruiterId: string | null = null;
          let resolvedAffiliateProfileId: string | null = null;
          let saleOwnerProfileId: string | null = null;

          if (item.affiliateId) {
            const { data: affiliateProfile } = await supabase
              .from('profiles')
              .select('id, referred_by_affiliate_id')
              .or(`id.eq.${item.affiliateId},referral_code.ilike.${item.affiliateId}`)
              .maybeSingle();

            resolvedAffiliateProfileId = (affiliateProfile as any)?.id ?? null;
            saleOwnerProfileId = resolvedAffiliateProfileId;
            recruiterId = (affiliateProfile as any)?.referred_by_affiliate_id ?? null;
          } else {
            const sellerProfileId = item.sellerId || sellerId;
            if (sellerProfileId) {
              const { data: sellerProfile } = await supabase
                .from('profiles')
                .select('id, referred_by_affiliate_id')
                .eq('id', sellerProfileId)
                .maybeSingle();

              saleOwnerProfileId = (sellerProfile as any)?.id ?? null;
              recruiterId = (sellerProfile as any)?.referred_by_affiliate_id ?? null;
            }
          }

          const referralAmount = recruiterId && saleOwnerProfileId
            ? round2(finalPriceTotal * REFERRER_PERCENT_OF_SALE)
            : 0;

          if (recruiterId && saleOwnerProfileId && referralAmount > 0) {
            // Best-effort record (non-blocking)
            try {
              await supabase
                .from('referral_commissions')
                .insert({
                  referrer_id: recruiterId,
                  referred_affiliate_id: saleOwnerProfileId,
                  order_id: beezioOrderId,
                  sale_amount: finalPriceTotal,
                  commission_amount: referralAmount,
                  commission_rate: 5.0,
                  status: 'pending'
                });
            } catch (e) {
              console.warn('Failed to record referral_commissions (non-blocking):', e);
            }
          }

          const stripeFee = round2(finalPriceTotal * STRIPE_PERCENT + STRIPE_FIXED * qty);

          const sellerKey = item.sellerId || sellerId;
          sellerTotals.set(sellerKey, round2((sellerTotals.get(sellerKey) || 0) + sellerAmount));

          // Use the resolved affiliate profile id when possible, else raw affiliateId
          const affiliateKey = resolvedAffiliateProfileId || (item.affiliateId ? String(item.affiliateId) : '');
          if (affiliateKey && affiliateAmount > 0) {
            affiliateTotals.set(affiliateKey, round2((affiliateTotals.get(affiliateKey) || 0) + affiliateAmount));
          }

          platformGrossTotal += platformGross;
          stripeTotal += stripeFee;
          referralTotal += referralAmount;
        }

        const sellerTotal = round2(Array.from(sellerTotals.values()).reduce((a, b) => a + b, 0));
        const affiliateTotal = round2(Array.from(affiliateTotals.values()).reduce((a, b) => a + b, 0));
        platformGrossTotal = round2(platformGrossTotal);
        stripeTotal = round2(stripeTotal);
        referralTotal = round2(referralTotal);

        const platformNet = round2(Math.max(platformGrossTotal - referralTotal, 0));

        // Keep transaction totals consistent. Any remainder (shipping/rounding) stays with platform.
        const distributedMerchandiseTotal = round2(sellerTotal + affiliateTotal + platformNet + stripeTotal);
        const remainder = round2(Math.max(totalAmount - distributedMerchandiseTotal, 0));
        const platformAmount = round2(platformNet + remainder);

        console.log('✅ Distribution breakdown (unified):', {
          totalAmount,
          sellerTotal,
          affiliateTotal,
          platformGrossTotal,
          referralTotal,
          platformNet,
          stripeTotal,
          remainder
        })

        // Create payment distribution records
        const distributions: any[] = []

        // Seller distributions (grouped)
        for (const [sellerRecipientId, amount] of sellerTotals.entries()) {
          if (!sellerRecipientId) continue
          distributions.push({
            transaction_id: transaction.id,
            recipient_type: 'seller',
            recipient_id: sellerRecipientId,
            amount,
            percentage: 0,
            status: 'pending'
          })
        }

        // Affiliate distributions (grouped)
        for (const [affiliateRecipientId, amount] of affiliateTotals.entries()) {
          if (!affiliateRecipientId) continue
          distributions.push({
            transaction_id: transaction.id,
            recipient_type: 'affiliate',
            recipient_id: affiliateRecipientId,
            amount,
            percentage: 0,
            status: 'pending'
          })
        }

        // Platform distribution (net + remainder)
        distributions.push({
          transaction_id: transaction.id,
          recipient_type: 'platform',
          recipient_id: null,
          amount: platformAmount,
          percentage: 0,
          status: 'completed'
        })

        // Insert payment distributions using whichever linkage column exists
        const paymentDistributionsUsesTransactionId = await tableHasColumn('payment_distributions', 'transaction_id')
        const paymentDistributionsUsesOrderId = await tableHasColumn('payment_distributions', 'order_id')

        const distributionsToInsert = distributions
          .map((d) => {
            const row: any = { ...d }
            if (!paymentDistributionsUsesTransactionId) {
              delete row.transaction_id
            }
            if (paymentDistributionsUsesOrderId && beezioOrderId) {
              row.order_id = beezioOrderId
            }
            return row
          })
          .filter((row) => {
            if (paymentDistributionsUsesOrderId && !beezioOrderId) return false
            if (paymentDistributionsUsesTransactionId && !row.transaction_id) return false
            return true
          })

        const { error: distributionError } = distributionsToInsert.length
          ? await supabase
              .from('payment_distributions')
              .insert(distributionsToInsert)
          : { error: null as any }

        if (distributionError) {
          console.error('Error creating payment distributions:', distributionError)
          throw distributionError
        }

        // Record platform revenue
        const currentMonth = new Date().toISOString().slice(0, 7) // YYYY-MM
        try {
          const platformRevenueUsesTransactionId = await tableHasColumn('platform_revenue', 'transaction_id')
          const platformRevenueUsesOrderId = await tableHasColumn('platform_revenue', 'order_id')

          const revenueRow: any = {
            amount: platformAmount,
            revenue_type: 'commission',
            month_year: currentMonth,
          }
          if (platformRevenueUsesTransactionId) {
            revenueRow.transaction_id = transaction.id
          } else if (platformRevenueUsesOrderId && beezioOrderId) {
            revenueRow.order_id = beezioOrderId
          }

          const { error: revenueError } = await supabase
            .from('platform_revenue')
            .insert(revenueRow)

          if (revenueError) {
            console.error('Error recording platform revenue:', revenueError)
          }
        } catch (e) {
          console.error('Error recording platform revenue:', e)
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
                  'Authorization': `Bearer ${serviceRoleKey}`,
                },
                body: JSON.stringify({ orderId: orderData.id }),
              }
            )

            if (!fulfillmentResponse.ok) {
              console.error('Failed to trigger automated fulfillment:', await fulfillmentResponse.text())
            } else {
              console.log('Automated fulfillment triggered successfully')
            }

            // Trigger CJ Dropshipping fulfillment for dropship products
            try {
              console.log('Triggering CJ fulfillment for order:', orderData.id)
              const cjResponse = await fetch(
                `${Deno.env.get('NETLIFY_FUNCTIONS_URL') || 'https://beezio.co'}/.netlify/functions/cj-fulfill-order`,
                {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({ orderId: orderData.id }),
                }
              )

              if (!cjResponse.ok) {
                const errorText = await cjResponse.text()
                console.error('Failed to trigger CJ fulfillment:', errorText)
              } else {
                const cjResult = await cjResponse.json()
                console.log('CJ fulfillment response:', cjResult)
              }
            } catch (cjError) {
              console.error('Error triggering CJ fulfillment:', cjError)
              // Don't throw - CJ fulfillment failure shouldn't block the webhook
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