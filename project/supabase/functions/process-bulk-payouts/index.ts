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
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2023-10-16',
    })

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get authorization header to verify admin access
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      throw new Error('Missing authorization header')
    }

    // Verify user is admin (you might want to add role checking)
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (authError || !user) {
      throw new Error('Unauthorized')
    }

    const MINIMUM_PAYOUT_AMOUNT = 25 // Minimum $25 for payout
    
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
      throw error
    }

    if (!eligibleUsers?.length) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No users eligible for payout',
        processed: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    console.log(`Processing bulk payouts for ${eligibleUsers.length} users`)

    // Create payout batch
    const batchNumber = `MANUAL_${Date.now()}`
    const totalBatchAmount = eligibleUsers.reduce((sum, user) => sum + user.current_balance, 0)

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
      throw batchError
    }

    const results = {
      successful: 0,
      failed: 0,
      totalAmount: 0,
      errors: [] as string[]
    }

    // Process individual payouts
    for (const user of eligibleUsers) {
      try {
        // Create Stripe transfer
        const transfer = await stripe.transfers.create({
          amount: Math.round(user.current_balance * 100), // Convert to cents
          currency: 'usd',
          destination: user.profiles.stripe_account_id,
          description: `Manual payout for ${user.role} earnings - Batch ${batchNumber}`
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

        results.successful++
        results.totalAmount += user.current_balance

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
            failure_reason: transferError.message
          })

        results.failed++
        results.errors.push(`${user.profiles.full_name}: ${transferError.message}`)
      }
    }

    // Update batch status
    const batchStatus = results.failed === 0 ? 'completed' : 'partially_completed'
    await supabase
      .from('payout_batches')
      .update({
        status: batchStatus,
        processed_at: new Date().toISOString()
      })
      .eq('id', batch.id)

    return new Response(JSON.stringify({
      success: true,
      batchNumber,
      results: {
        processed: results.successful + results.failed,
        successful: results.successful,
        failed: results.failed,
        totalAmount: results.totalAmount,
        errors: results.errors
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('Bulk payout error:', error)
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
