import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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

const getPayPalToken = async (baseUrl: string, clientId: string, secret: string) => {
  const auth = btoa(`${clientId}:${secret}`)
  const res = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })
  if (!res.ok) {
    throw new Error(`PayPal auth failed (${res.status})`)
  }
  const data = await res.json()
  return String(data?.access_token || '')
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    if (!supabaseUrl || !serviceRoleKey) return json(500, { error: 'Missing Supabase credentials' })

    const supabase = createClient(supabaseUrl, serviceRoleKey)

    const body = await req.json().catch(() => ({}))
    const minimumPayout = getEnvNumber('PAYPAL_MIN_PAYOUT', 25)
    const maxPayoutPerPayee = getEnvNumber('PAYPAL_MAX_PAYOUT_PER_BATCH', 0)
    const dryRun = Boolean((body as any)?.dry_run)
    const includeOnHold = Boolean((body as any)?.include_on_hold)

    let query = supabase
      .from('payout_ledger')
      .select(
        'id, order_id, seller_id, partner_id, influencer_id, seller_earnings, partner_earnings, influencer_earnings, status'
      )
      .eq('status', 'READY_TO_PAY')
      .limit(1000)

    if (includeOnHold) {
      query = supabase
        .from('payout_ledger')
        .select(
          'id, order_id, seller_id, partner_id, influencer_id, seller_earnings, partner_earnings, influencer_earnings, status'
        )
        .in('status', ['READY_TO_PAY', 'ON_HOLD_DISPUTE'])
        .limit(1000)
    }

    const { data: ledgerRows, error: ledgerError } = await query
    if (ledgerError) return json(400, { error: ledgerError.message })

    const rows = (ledgerRows || []) as LedgerRow[]
    if (!rows.length) return json(200, { ok: true, message: 'No payouts eligible', batch: null })

    const entries: PayoutEntry[] = []
    for (const row of rows) {
      if (row.seller_id && row.seller_earnings > 0) {
        entries.push({
          ledgerId: row.id,
          userId: row.seller_id,
          role: 'SELLER',
          amount: round2(row.seller_earnings),
        })
      }
      if (row.partner_id && row.partner_earnings > 0) {
        entries.push({
          ledgerId: row.id,
          userId: row.partner_id,
          role: 'PARTNER',
          amount: round2(row.partner_earnings),
        })
      }
      if (row.influencer_id && row.influencer_earnings > 0) {
        entries.push({
          ledgerId: row.id,
          userId: row.influencer_id,
          role: 'INFLUENCER',
          amount: round2(row.influencer_earnings),
        })
      }
    }

    const userIds = Array.from(new Set(entries.map((e) => e.userId)))
    const { data: paypalAccounts, error: paypalError } = await supabase
      .from('paypal_accounts')
      .select('user_id, role, paypal_email, is_verified')
      .in('user_id', userIds)

    if (paypalError) return json(400, { error: paypalError.message })

    const accountMap = new Map<string, { email: string; verified: boolean }>()
    for (const row of paypalAccounts || []) {
      const key = `${row.user_id}::${row.role}`
      accountMap.set(key, { email: row.paypal_email, verified: Boolean(row.is_verified) })
    }

    const grouped = new Map<string, { total: number; entryIds: PayoutEntry[] }>()

    for (const entry of entries) {
      const key = `${entry.userId}::${entry.role}`
      const account = accountMap.get(key)
      if (!account?.email || !account?.verified) continue
      const emailKey = account.email.toLowerCase()
      const current = grouped.get(emailKey) || { total: 0, entryIds: [] }
      current.total = round2(current.total + entry.amount)
      current.entryIds.push(entry)
      grouped.set(emailKey, current)
    }

    const payoutItems: any[] = []
    const ledgerUpdates: { ledgerId: string; itemId: string }[] = []

    for (const [email, data] of grouped.entries()) {
      if (data.total < minimumPayout) continue

      let payable = data.total
      if (maxPayoutPerPayee > 0 && payable > maxPayoutPerPayee) {
        payable = maxPayoutPerPayee
      }

      const itemId = `pp_${crypto.randomUUID()}`
      payoutItems.push({
        recipient_type: 'EMAIL',
        amount: {
          value: payable.toFixed(2),
          currency: 'USD',
        },
        receiver: email,
        note: 'Beezio payout',
        sender_item_id: itemId,
      })

      for (const entry of data.entryIds) {
        ledgerUpdates.push({ ledgerId: entry.ledgerId, itemId })
      }
    }

    if (!payoutItems.length) {
      return json(200, { ok: true, message: 'No payouts met minimum threshold', batch: null })
    }

    const batchId = `PP_${Date.now()}`

    const usePaypalApi = String(Deno.env.get('PAYPAL_PAYOUTS_API_ENABLED') ?? '').trim() === 'true'
    const paypalEnv = String(Deno.env.get('PAYPAL_ENV') ?? 'sandbox').toLowerCase()
    const paypalBaseUrl =
      paypalEnv === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com'

    let apiResponse: any = null

    if (usePaypalApi && !dryRun) {
      const clientId = Deno.env.get('PAYPAL_CLIENT_ID') ?? ''
      const secret = Deno.env.get('PAYPAL_CLIENT_SECRET') ?? ''
      if (!clientId || !secret) {
        return json(400, { error: 'PayPal API enabled but credentials are missing' })
      }

      const token = await getPayPalToken(paypalBaseUrl, clientId, secret)
      const res = await fetch(`${paypalBaseUrl}/v1/payments/payouts`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sender_batch_header: {
            sender_batch_id: batchId,
            email_subject: 'Your Beezio payout',
            email_message: 'Your Beezio payout has been issued.',
          },
          items: payoutItems,
        }),
      })
      apiResponse = await res.json()
      if (!res.ok) {
        return json(400, { error: apiResponse?.message || 'PayPal payout batch failed', details: apiResponse })
      }
    }

    if (!dryRun) {
      const updates = ledgerUpdates.map((u) => ({
        id: u.ledgerId,
        paypal_payout_batch_id: batchId,
        paypal_payout_item_id: u.itemId,
      }))
      for (const row of updates) {
        await supabase.from('payout_ledger').update(row).eq('id', row.id)
      }
    }

    const csv = payoutItems
      .map((item) => `${item.receiver},${item.amount.value},${item.amount.currency},${item.sender_item_id}`)
      .join('\n')

    return json(200, {
      ok: true,
      batch_id: batchId,
      payout_count: payoutItems.length,
      dry_run: dryRun,
      paypal_api_used: usePaypalApi,
      paypal_response: apiResponse,
      csv,
    })
  } catch (error) {
    return json(500, { error: error instanceof Error ? error.message : String(error) })
  }
})
