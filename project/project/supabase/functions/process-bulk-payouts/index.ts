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

    const body = await req.json().catch(() => ({}))
    const force = Boolean((body as any)?.force)
    const dryRun = Boolean((body as any)?.dry_run)
    const onlyUserIdRaw = (body as any)?.only_user_id ?? (body as any)?.onlyUserId ?? null
    const onlyUserId = typeof onlyUserIdRaw === 'string' && onlyUserIdRaw.trim() ? onlyUserIdRaw.trim() : null

    // Bi-monthly payout schedule: 1st and 15th of each month (UTC).
    const now = new Date()
    const day = now.getUTCDate()
    const isPayoutDay = day === 1 || day === 15

    // Authorization: either an admin JWT, or a cron secret header.
    const cronSecret = (Deno.env.get('BEEZIO_PAYOUT_CRON_SECRET') ?? '').trim()
    const cronHeader = (req.headers.get('x-beezio-cron-secret') ?? '').trim()
    const usingCronSecret = Boolean(cronSecret && cronHeader && cronSecret === cronHeader)

    let callerProfileId: string | null = null
    let callerIsAdmin = false

    if (!usingCronSecret) {
      const authHeader = req.headers.get('authorization') || ''
      if (!authHeader) throw new Error('Missing authorization header')

      const token = authHeader.replace('Bearer ', '').trim()
      const { data: { user }, error: authError } = await supabase.auth.getUser(token)
      if (authError || !user) throw new Error('Unauthorized')

      // Require admin profile role (safe now that DB policies prevent self-admin escalation).
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, user_id, role, primary_role')
        .or(`id.eq.${user.id},user_id.eq.${user.id}`)
        .maybeSingle()

      callerProfileId = (profile as any)?.id ? String((profile as any).id) : null
      const role = String((profile as any)?.primary_role || (profile as any)?.role || '').toLowerCase().trim()
      callerIsAdmin = role === 'admin' || role === 'platform_admin'
      if (!callerIsAdmin) {
        throw new Error('Forbidden (admin only)')
      }
    }

    if (!isPayoutDay && !force) {
      return new Response(JSON.stringify({
        success: true,
        skipped: true,
        message: 'Not a payout day (bi-monthly: 1st and 15th UTC).',
        today_utc: now.toISOString().slice(0, 10),
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    // Off-cycle payouts are allowed ONLY for the admin's own account.
    if (!isPayoutDay && force && !usingCronSecret) {
      if (!onlyUserId) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Off-cycle payouts require `only_user_id` to be set (admin can only pay themselves immediately).',
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        })
      }
      if (!callerProfileId || onlyUserId !== callerProfileId) {
        return new Response(JSON.stringify({
          success: false,
          error: '`only_user_id` must match the authenticated admin profile id for off-cycle payouts.',
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 403,
        })
      }
    }

    const MINIMUM_PAYOUT_AMOUNT = 25 // Minimum $25 for payout

    // Release eligible seller holds first (14 days + shipped/delivered).
    // This ensures seller+affiliate payouts run on the same bi-monthly schedule.
    try {
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

      const hasAvailableAt = await tableHasColumn('payment_distributions', 'available_at')
      const hasOrderId = await tableHasColumn('payment_distributions', 'order_id')
      const ordersHasFulfillment = await tableHasColumn('orders', 'fulfillment_status')

      let heldQuery = supabase
        .from('payment_distributions')
        .select('id, order_id, created_at, available_at')
        .eq('recipient_type', 'seller')
        .eq('status', 'held')
        .limit(500)

      if (hasAvailableAt) {
        heldQuery = heldQuery.lte('available_at', now.toISOString())
      } else {
        const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
        heldQuery = heldQuery.lte('created_at', cutoff)
      }

      const { data: heldRows } = await heldQuery
      const rows = Array.isArray(heldRows) ? heldRows : []

      let eligibleIds = rows.map((r: any) => String(r.id))

      if (hasOrderId && ordersHasFulfillment) {
        const orderIds = rows
          .map((r: any) => (r.order_id ? String(r.order_id) : null))
          .filter(Boolean) as string[]

        if (orderIds.length) {
          const { data: orders } = await supabase.from('orders').select('id, fulfillment_status').in('id', orderIds)
          const okOrderIds = new Set(
            (orders || [])
              .filter((o: any) => ['shipped', 'delivered'].includes(String(o.fulfillment_status || '').toLowerCase()))
              .map((o: any) => String(o.id))
          )
          eligibleIds = rows
            .filter((r: any) => !r.order_id || okOrderIds.has(String(r.order_id)))
            .map((r: any) => String(r.id))
        }
      }

      if (eligibleIds.length && !dryRun) {
        await supabase.from('payment_distributions').update({ status: 'pending' }).in('id', eligibleIds)
      }
    } catch (_e) {
      // Non-fatal: payout processing can still proceed for non-held funds.
    }

    // If admin is paying themselves off-cycle, allow their seller holds to be released immediately.
    // This is the only case where "immediate payment" is allowed.
    if (!usingCronSecret && callerIsAdmin && onlyUserId && !isPayoutDay && force && !dryRun) {
      try {
        await supabase
          .from('payment_distributions')
          .update({ status: 'pending' })
          .eq('recipient_type', 'seller')
          .eq('recipient_id', onlyUserId)
          .eq('status', 'held')
      } catch {
        // ignore
      }
    }
    
    // Get users with sufficient balance for payout (support legacy states where amounts were moved into pending_payout)
    let eligibleQuery = supabase
      .from('user_earnings')
      .select(`
        user_id,
        role,
        current_balance,
        pending_payout,
        profiles!inner(stripe_account_id, full_name, email, seller_verification_status, identity_verification_status)
      `)
      .or(`current_balance.gte.${MINIMUM_PAYOUT_AMOUNT},pending_payout.gte.${MINIMUM_PAYOUT_AMOUNT}`)
      .not('profiles.stripe_account_id', 'is', null)

    if (onlyUserId) {
      eligibleQuery = eligibleQuery.eq('user_id', onlyUserId)
    }

    const { data: eligibleUsers, error } = await eligibleQuery

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

    // Create payout batch (deterministic for schedule, or "MANUAL" when force-run off-cycle)
    const ymd = now.toISOString().slice(0, 10).replace(/-/g, '')
    const batchNumber = (isPayoutDay && !force) ? `BIMONTHLY_${ymd}` : `MANUAL_${Date.now()}`
    const totalBatchAmount = eligibleUsers.reduce((sum, user) => {
      const current = Number((user as any)?.current_balance ?? 0)
      const pending = Number((user as any)?.pending_payout ?? 0)
      const amount = Math.max(current, pending)
      return sum + (Number.isFinite(amount) ? amount : 0)
    }, 0)

    const { data: batch, error: batchError } = await supabase
      .from('payout_batches')
      .upsert({
        batch_number: batchNumber,
        total_amount: totalBatchAmount,
        recipient_count: eligibleUsers.length,
        status: 'processing'
      }, { onConflict: 'batch_number' })
      .select()
      .single()

    if (batchError) {
      console.error('Error creating payout batch:', batchError)
      throw batchError
    }

    const results = {
      successful: 0,
      failed: 0,
      skipped: 0,
      totalAmount: 0,
      errors: [] as string[]
    }

    // Process individual payouts
    for (const user of eligibleUsers) {
      try {
        const currentBalance = Number((user as any)?.current_balance ?? 0)
        const pendingPayout = Number((user as any)?.pending_payout ?? 0)
        const amountToPay = Math.max(currentBalance, pendingPayout)
        if (!Number.isFinite(amountToPay) || amountToPay < MINIMUM_PAYOUT_AMOUNT) {
          results.skipped++
          continue
        }

        if (
          String(user.role) === 'seller' &&
          (String((user as any)?.profiles?.seller_verification_status || 'unverified') !== 'verified' ||
            String((user as any)?.profiles?.identity_verification_status || 'not_started') !== 'verified')
        ) {
          // Admin accounts are allowed to receive immediate payouts; keep the guard for everyone else.
          if (!(onlyUserId && callerIsAdmin && String(user.user_id) === onlyUserId)) {
            results.skipped++
            continue
          }
        }

        if (dryRun) {
          results.successful++
          results.totalAmount += amountToPay
          continue
        }

        // Create Stripe transfer (seller+affiliate share the same bi-monthly payout run)
        const transfer = await stripe.transfers.create({
          amount: Math.round(amountToPay * 100), // Convert to cents
          currency: 'usd',
          destination: user.profiles.stripe_account_id,
          description: `Beezio bi-monthly payout for ${user.role} - Batch ${batchNumber}`
        })

        // Record payout
        await supabase
          .from('payouts')
          .insert({
            batch_id: batch.id,
            user_id: user.user_id,
            amount: amountToPay,
            stripe_transfer_id: transfer.id,
            status: 'completed'
          })

        // Update user earnings
        await supabase
          .from('user_earnings')
          .update({
            paid_out: supabase.sql`paid_out + ${amountToPay}`,
            pending_payout: supabase.sql`GREATEST(COALESCE(pending_payout, 0) - ${amountToPay}, 0)`,
            current_balance: 0,
            last_payout_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('user_id', user.user_id)
          .eq('role', user.role)

        results.successful++
        results.totalAmount += amountToPay

        console.log(`Payout completed for user ${user.user_id}: $${amountToPay}`)

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
      schedule: { bi_monthly_days_utc: [1, 15], forced: force, dry_run: dryRun },
      results: {
        processed: results.successful + results.failed + results.skipped,
        successful: results.successful,
        failed: results.failed,
        skipped: results.skipped,
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
