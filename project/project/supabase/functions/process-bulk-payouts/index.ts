import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  })

type LedgerRow = {
  id: string
  order_id: string | null
  seller_id: string | null
  partner_id: string | null
  influencer_id: string | null
  seller_earnings: number
  partner_earnings: number
  influencer_earnings: number
  status: string
}

type PayoutEntry = {
  ledgerId: string
  orderId: string | null
  userId: string
  role: 'SELLER' | 'PARTNER' | 'INFLUENCER'
  amount: number
}

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100

const getEnvNumber = (key: string, fallback: number) => {
  const raw = Deno.env.get(key)
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : fallback
}

const getPayPalBaseUrl = () => {
  const env = String(Deno.env.get('PAYPAL_ENV') ?? 'sandbox').toLowerCase()
  return env === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com'
}

const getPayPalCredentials = () => {
  const env = String(Deno.env.get('PAYPAL_ENV') ?? 'sandbox').toLowerCase()
  if (env === 'live') {
    return {
      clientId: String(Deno.env.get('PAYPAL_LIVE_CLIENT_ID') || Deno.env.get('PAYPAL_CLIENT_ID') || '').trim(),
      secret: String(Deno.env.get('PAYPAL_LIVE_CLIENT_SECRET') || Deno.env.get('PAYPAL_CLIENT_SECRET') || '').trim(),
    }
  }

  return {
    clientId: String(Deno.env.get('PAYPAL_SANDBOX_CLIENT_ID') || Deno.env.get('PAYPAL_CLIENT_ID') || '').trim(),
    secret: String(Deno.env.get('PAYPAL_SANDBOX_CLIENT_SECRET') || Deno.env.get('PAYPAL_CLIENT_SECRET') || '').trim(),
  }
}

const getPayPalToken = async () => {
  const { clientId, secret } = getPayPalCredentials()
  if (!clientId || !secret) throw new Error('PayPal credentials are missing')

  const auth = btoa(`${clientId}:${secret}`)
  const res = await fetch(`${getPayPalBaseUrl()}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(String((data as any)?.error_description || (data as any)?.message || 'PayPal auth failed'))
  }
  const token = String((data as any)?.access_token || '').trim()
  if (!token) throw new Error('PayPal auth failed: missing access token')
  return token
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const body = await req.json().catch(() => ({}))
    const force = Boolean((body as any)?.force)
    const dryRun = Boolean((body as any)?.dry_run)
    const onlyUserIdRaw = (body as any)?.only_user_id ?? (body as any)?.onlyUserId ?? null
    const onlyUserId = typeof onlyUserIdRaw === 'string' && onlyUserIdRaw.trim() ? onlyUserIdRaw.trim() : null

    // Payout schedule: 15th and final calendar day of each month.
    const now = new Date()
    const day = now.getUTCDate()
    const lastDayOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate()
    const isPayoutDay = day === 15 || day === lastDayOfMonth

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
      return json(200, {
        success: true,
        skipped: true,
        message: 'Not a payout day (bi-monthly: 1st and 15th UTC).',
        today_utc: now.toISOString().slice(0, 10),
      })
    }

    // Off-cycle payouts are allowed ONLY for the admin's own account.
    if (!isPayoutDay && force && !usingCronSecret) {
      if (!onlyUserId) {
        return json(400, {
          success: false,
          error: 'Off-cycle payouts require `only_user_id` to be set (admin can only pay themselves immediately).',
        })
      }
      if (!callerProfileId || onlyUserId !== callerProfileId) {
        return json(403, {
          success: false,
          error: '`only_user_id` must match the authenticated admin profile id for off-cycle payouts.',
        })
      }
    }

    const minimumPayout = getEnvNumber('PAYPAL_MIN_PAYOUT', 25)
    const maxPayoutPerPayee = getEnvNumber('PAYPAL_MAX_PAYOUT_PER_BATCH', 0)

    // Release eligible seller holds first (14 days + shipped/delivered).
    // This ensures seller+affiliate payouts run on the same bi-monthly schedule.
    try {
      const tableHasColumn = async (tableName: string, columnName: string): Promise<boolean> => {
        try {
          const { data, error } = await supabase
            .from('information_schema.columns')
            .select('column_name')
            .eq('table_schema', 'public')
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

      const tableExists = async (tableName: string): Promise<boolean> => {
        try {
          const { data, error } = await supabase
            .from('information_schema.tables')
            .select('table_name')
            .eq('table_schema', 'public')
            .eq('table_name', tableName)
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
      const ordersHasPaymentStatus = await tableHasColumn('orders', 'payment_status')
      const hasDisputes = await tableExists('disputes')

      let heldQuery = supabase
        .from('payment_distributions')
        .select('id, order_id, created_at, available_at, recipient_type')
        .in('recipient_type', ['seller', 'affiliate'])
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

      if (hasOrderId && (ordersHasFulfillment || ordersHasPaymentStatus)) {
        const orderIds = rows
          .map((r: any) => (r.order_id ? String(r.order_id) : null))
          .filter(Boolean) as string[]

        if (orderIds.length) {
          const { data: orders } = await supabase
            .from('orders')
            .select('id, fulfillment_status, payment_status')
            .in('id', orderIds)
          const okOrderIds = new Set(
            (orders || [])
              .filter((o: any) => ['shipped', 'delivered'].includes(String(o.fulfillment_status || '').toLowerCase()))
              .map((o: any) => String(o.id))
          )
          const disputedIds = new Set(
            (orders || [])
              .filter((o: any) => String(o.payment_status || '').toLowerCase() === 'disputed')
              .map((o: any) => String(o.id))
          )
          eligibleIds = rows
            .filter((r: any) => {
              const orderId = r.order_id ? String(r.order_id) : null
              if (!orderId) return true
              if (ordersHasPaymentStatus && disputedIds.has(orderId)) return false
              if (String(r.recipient_type || '').toLowerCase() !== 'seller') return true
              if (!ordersHasFulfillment) return true
              return okOrderIds.has(orderId)
            })
            .map((r: any) => String(r.id))
        }
      }

      if (hasOrderId && hasDisputes) {
        const eligibleRows = rows.filter((r: any) => eligibleIds.includes(String(r.id)))
        const orderIds = eligibleRows
          .map((r: any) => (r.order_id ? String(r.order_id) : null))
          .filter(Boolean) as string[]

        if (orderIds.length) {
          const { data: disputes } = await supabase
            .from('disputes')
            .select('order_id, status')
            .in('order_id', orderIds)
            .in('status', ['open', 'investigating', 'awaiting_response'])

          const disputedOrderIds = new Set(
            (disputes || [])
              .map((d: any) => (d?.order_id ? String(d.order_id) : null))
              .filter(Boolean)
          )

          if (disputedOrderIds.size) {
            eligibleIds = eligibleRows
              .filter((r: any) => {
                const orderId = r.order_id ? String(r.order_id) : null
                return !orderId || !disputedOrderIds.has(orderId)
              })
              .map((r: any) => String(r.id))
          }
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
          .in('recipient_type', ['seller', 'affiliate'])
          .eq('recipient_id', onlyUserId)
          .eq('status', 'held')
      } catch {
        // ignore
      }
    }
    
    let query = supabase
      .from('payout_ledger')
      .select(
        'id, order_id, seller_id, partner_id, influencer_id, seller_earnings, partner_earnings, influencer_earnings, status'
      )
      .eq('status', 'READY_TO_PAY')
      .limit(1000)

    const { data: ledgerRows, error } = await query
    if (error) throw error

    const rows = (ledgerRows || []) as LedgerRow[]
    if (!rows.length) {
      return json(200, {
        success: true,
        message: 'No payouts eligible for PayPal batch processing',
        results: { processed: 0, successful: 0, failed: 0, skipped: 0, totalAmount: 0, errors: [] },
      })
    }

    const entries: PayoutEntry[] = []
    for (const row of rows) {
      if (row.seller_id && Number(row.seller_earnings) > 0) {
        entries.push({ ledgerId: row.id, orderId: row.order_id, userId: row.seller_id, role: 'SELLER', amount: round2(Number(row.seller_earnings)) })
      }
      if (row.partner_id && Number(row.partner_earnings) > 0) {
        entries.push({ ledgerId: row.id, orderId: row.order_id, userId: row.partner_id, role: 'PARTNER', amount: round2(Number(row.partner_earnings)) })
      }
      if (row.influencer_id && Number(row.influencer_earnings) > 0) {
        entries.push({ ledgerId: row.id, orderId: row.order_id, userId: row.influencer_id, role: 'INFLUENCER', amount: round2(Number(row.influencer_earnings)) })
      }
    }

    const filteredEntries = onlyUserId ? entries.filter((entry) => entry.userId === onlyUserId) : entries
    if (!filteredEntries.length) {
      return json(200, {
        success: true,
        message: 'No eligible payout entries matched the requested user scope',
        results: { processed: 0, successful: 0, failed: 0, skipped: 0, totalAmount: 0, errors: [] },
      })
    }

    const userIds = Array.from(new Set(filteredEntries.map((entry) => entry.userId)))
    const { data: paypalAccounts, error: paypalError } = await supabase
      .from('paypal_accounts')
      .select('user_id, role, paypal_email, is_verified')
      .in('user_id', userIds)

    if (paypalError) throw paypalError

    const accountMap = new Map<string, { email: string; verified: boolean }>()
    for (const row of paypalAccounts || []) {
      const key = `${row.user_id}::${row.role}`
      accountMap.set(key, { email: row.paypal_email, verified: Boolean(row.is_verified) })
    }

    const grouped = new Map<string, { total: number; entries: PayoutEntry[] }>()
    const results = {
      successful: 0,
      failed: 0,
      skipped: 0,
      totalAmount: 0,
      errors: [] as string[],
    }

    for (const entry of filteredEntries) {
      const account = accountMap.get(`${entry.userId}::${entry.role}`)
      if (!account?.email || !account?.verified) {
        results.skipped++
        results.errors.push(`Missing verified PayPal email for ${entry.role.toLowerCase()} ${entry.userId}`)
        continue
      }

      const key = account.email.toLowerCase()
      const current = grouped.get(key) || { total: 0, entries: [] }
      current.total = round2(current.total + entry.amount)
      current.entries.push(entry)
      grouped.set(key, current)
    }

    const payoutItems: Array<{ receiver: string; amount: string; sender_item_id: string; entries: PayoutEntry[] }> = []
    for (const [email, group] of grouped.entries()) {
      if (group.total < minimumPayout) {
        results.skipped += group.entries.length
        continue
      }

      const payable = maxPayoutPerPayee > 0 ? Math.min(group.total, maxPayoutPerPayee) : group.total
      payoutItems.push({
        receiver: email,
        amount: round2(payable).toFixed(2),
        sender_item_id: `pp_${crypto.randomUUID()}`,
        entries: group.entries,
      })
    }

    if (!payoutItems.length) {
      return json(200, {
        success: true,
        message: 'No payout entries met the PayPal batch minimum threshold',
        results: { processed: 0, successful: 0, failed: 0, skipped: results.skipped, totalAmount: 0, errors: results.errors },
      })
    }

    const ymd = now.toISOString().slice(0, 10).replace(/-/g, '')
    const batchNumber = isPayoutDay && !force ? `PAYPAL_BIMONTHLY_${ymd}` : `PAYPAL_MANUAL_${Date.now()}`
    const totalBatchAmount = payoutItems.reduce((sum, item) => sum + Number(item.amount), 0)

    const { data: batch, error: batchError } = await supabase
      .from('payout_batches')
      .upsert(
        {
          batch_number: batchNumber,
          total_amount: totalBatchAmount,
          recipient_count: payoutItems.length,
          status: dryRun ? 'pending' : 'processing',
        },
        { onConflict: 'batch_number' }
      )
      .select()
      .single()

    if (batchError) throw batchError

    let paypalResponse: any = null
    const usePaypalApi = String(Deno.env.get('PAYPAL_PAYOUTS_API_ENABLED') ?? '').trim() === 'true'

    if (usePaypalApi && !dryRun) {
      const token = await getPayPalToken()
      const res = await fetch(`${getPayPalBaseUrl()}/v1/payments/payouts`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sender_batch_header: {
            sender_batch_id: batchNumber,
            email_subject: 'Your Beezio payout',
            email_message: 'Your Beezio payout has been issued.',
          },
          items: payoutItems.map((item) => ({
            recipient_type: 'EMAIL',
            amount: { value: item.amount, currency: 'USD' },
            receiver: item.receiver,
            note: 'Beezio payout',
            sender_item_id: item.sender_item_id,
          })),
        }),
      })
      paypalResponse = await res.json().catch(() => ({}))
      if (!res.ok) {
        await supabase
          .from('payout_batches')
          .update({ status: 'failed', processed_at: new Date().toISOString() })
          .eq('id', batch.id)
        throw new Error(String((paypalResponse as any)?.message || 'PayPal payout batch failed'))
      }
    }

    const processedAt = new Date().toISOString()
    for (const item of payoutItems) {
      results.successful += item.entries.length
      results.totalAmount += Number(item.amount)

      for (const entry of item.entries) {
        if (!dryRun) {
          await supabase
            .from('payout_ledger')
            .update({
              paypal_payout_batch_id: batchNumber,
              paypal_payout_item_id: item.sender_item_id,
              paid_at: processedAt,
              status: usePaypalApi ? 'PAID' : 'READY_TO_PAY',
            })
            .eq('id', entry.ledgerId)

          await supabase
            .from('payouts')
            .insert({
              batch_id: batch.id,
              user_id: entry.userId,
              amount: entry.amount,
              status: usePaypalApi ? 'completed' : 'pending',
              provider: 'paypal',
              paypal_batch_id: batchNumber,
              paypal_item_id: item.sender_item_id,
            })

          if (entry.role === 'SELLER' || entry.role === 'PARTNER') {
            const earningsRole = entry.role === 'SELLER' ? 'seller' : 'affiliate'
            const { data: earningsRow } = await supabase
              .from('user_earnings')
              .select('current_balance, pending_payout, paid_out')
              .eq('user_id', entry.userId)
              .eq('role', earningsRole)
              .maybeSingle()

            const currentBalance = Number((earningsRow as any)?.current_balance ?? 0)
            const pendingPayout = Number((earningsRow as any)?.pending_payout ?? 0)
            const paidOut = Number((earningsRow as any)?.paid_out ?? 0)

            await supabase
              .from('user_earnings')
              .upsert({
                user_id: entry.userId,
                role: earningsRole,
                current_balance: Math.max(round2(currentBalance - entry.amount), 0),
                pending_payout: Math.max(round2(pendingPayout - entry.amount), 0),
                paid_out: round2(paidOut + entry.amount),
                last_payout_at: processedAt,
                updated_at: processedAt,
              }, { onConflict: 'user_id,role' })
          }

          if (entry.orderId) {
            try {
              await supabase
                .from('payment_distributions')
                .update({
                  status: 'paid',
                  paid_at: processedAt,
                  updated_at: processedAt,
                })
                .eq('order_id', entry.orderId)
                .eq('recipient_id', entry.userId)
                .in('status', ['pending', 'available'])
            } catch {
              // Compatibility: some deployments will not have matching legacy rows.
            }
          }
        }
      }
    }

    if (!dryRun) {
      await supabase
        .from('payout_batches')
        .update({ status: usePaypalApi ? 'completed' : 'pending', processed_at: processedAt })
        .eq('id', batch.id)
    }

    return json(200, {
      success: true,
      batchNumber,
      provider: 'paypal',
      schedule: { days: ['15th', 'last_day_of_month'], forced: force, dry_run: dryRun },
      paypal_api_used: usePaypalApi,
      paypal_response: paypalResponse,
      results: {
        processed: results.successful + results.failed + results.skipped,
        successful: results.successful,
        failed: results.failed,
        skipped: results.skipped,
        totalAmount: round2(results.totalAmount),
        errors: results.errors,
      },
    })

  } catch (error) {
    console.error('Bulk payout error:', error)
    return json(400, { 
      success: false, 
      error: error instanceof Error ? error.message : String(error),
    })
  }
})
