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

const round2 = (value: number) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100
const asText = (value: unknown) => String(value || '').trim()

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    if (!supabaseUrl) return json(500, { error: 'Missing SUPABASE_URL' })
    if (!serviceRoleKey) return json(500, { error: 'Missing SUPABASE_SERVICE_ROLE_KEY' })

    const authHeader = req.headers.get('authorization') || ''
    if (!authHeader) return json(401, { error: 'Missing authorization header' })

    const supabaseAuthed = createClient(supabaseUrl, anonKey || serviceRoleKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: userData, error: userError } = await supabaseAuthed.auth.getUser()
    if (userError || !userData?.user) return json(401, { error: 'Unauthorized', details: userError?.message })

    const body = await req.json().catch(() => ({}))
    const limit = Number.isFinite(Number(body?.limit)) ? Math.max(1, Math.min(100, Number(body.limit))) : 10

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)

    const { data: profileRows, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, user_id')
      .or(`id.eq.${userData.user.id},user_id.eq.${userData.user.id}`)
      .limit(10)

    if (profileError) return json(500, { error: 'Failed to resolve profile', details: profileError.message })

    const rows = Array.isArray(profileRows) ? profileRows : []
    const profileId =
      rows.find((row: any) => asText(row?.user_id) === asText(userData.user.id))?.id ||
      rows.find((row: any) => asText(row?.id) === asText(userData.user.id))?.id ||
      rows[0]?.id ||
      userData.user.id

    const { data: sellerSnapshots, error: snapshotError } = await supabaseAdmin
      .from('payout_snapshots')
      .select('order_id, amount, status, hold_release_at, paid_at, created_at')
      .eq('payee_role', 'SELLER')
      .eq('payee_user_id', profileId)
      .order('created_at', { ascending: false })
      .limit(500)

    if (snapshotError) return json(400, { error: snapshotError.message })

    const snapshotRows = (sellerSnapshots as any[]) || []
    const orderIds = Array.from(new Set(snapshotRows.map((row) => asText(row?.order_id)).filter(Boolean))).slice(0, limit)

    if (!orderIds.length) {
      return json(200, { ok: true, sales: [] })
    }

    const [{ data: orders, error: ordersError }, { data: ledgers, error: ledgerError }] = await Promise.all([
      supabaseAdmin
        .from('orders')
        .select('id, order_number, created_at, status, payment_status, fulfillment_status, dispute_status, billing_name, billing_email, customer_email, total_amount, total_charged')
        .in('id', orderIds),
      supabaseAdmin
        .from('payout_ledger')
        .select('order_id, seller_earnings, status, hold_release_at, paid_at')
        .in('order_id', orderIds),
    ])

    if (ordersError) return json(400, { error: ordersError.message })
    if (ledgerError) return json(400, { error: ledgerError.message })

    const ordersById = new Map<string, any>()
    for (const order of (orders as any[]) || []) {
      const orderId = asText(order?.id)
      if (orderId) ordersById.set(orderId, order)
    }

    const ledgerByOrderId = new Map<string, any>()
    for (const ledger of (ledgers as any[]) || []) {
      const orderId = asText(ledger?.order_id)
      if (orderId && !ledgerByOrderId.has(orderId)) ledgerByOrderId.set(orderId, ledger)
    }

    const snapshotTotalsByOrderId = new Map<string, { seller_amount_total: number; statuses: Record<string, number> }>()
    for (const row of snapshotRows) {
      const orderId = asText(row?.order_id)
      if (!orderId || !orderIds.includes(orderId)) continue

      const current = snapshotTotalsByOrderId.get(orderId) || { seller_amount_total: 0, statuses: {} as Record<string, number> }
      current.seller_amount_total = round2(current.seller_amount_total + Number(row?.amount || 0))
      const status = asText(row?.status) || 'UNKNOWN'
      current.statuses[status] = (current.statuses[status] || 0) + 1
      snapshotTotalsByOrderId.set(orderId, current)
    }

    const sales = orderIds.map((orderId) => {
      const order = ordersById.get(orderId) || {}
      const ledger = ledgerByOrderId.get(orderId) || {}
      const snapshotAgg = snapshotTotalsByOrderId.get(orderId) || { seller_amount_total: 0, statuses: {} }
      return {
        order_id: orderId,
        order_number: asText(order?.order_number) || null,
        created_at: order?.created_at || null,
        status: asText(order?.status) || null,
        payment_status: asText(order?.payment_status) || null,
        fulfillment_status: asText(order?.fulfillment_status) || null,
        dispute_status: asText(order?.dispute_status) || null,
        buyer_name: asText(order?.billing_name) || null,
        buyer_email: asText(order?.billing_email) || asText(order?.customer_email) || null,
        total_amount: order?.total_charged ?? order?.total_amount ?? null,
        seller_amount_total: round2(Number(ledger?.seller_earnings || 0) || snapshotAgg.seller_amount_total),
        seller_distribution_status_counts: snapshotAgg.statuses,
        payout_status: asText(ledger?.status) || null,
        hold_release_at: ledger?.hold_release_at || null,
        paid_at: ledger?.paid_at || null,
      }
    })

    return json(200, { ok: true, sales })
  } catch (e) {
    return json(500, { error: 'Unexpected error', details: e instanceof Error ? e.message : String(e) })
  }
})
