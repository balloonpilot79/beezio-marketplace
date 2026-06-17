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

const parseDays = (value: string | undefined | null): number | null => {
  if (!value) return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  return parsed
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    if (!supabaseUrl || !serviceRoleKey) return json(500, { error: 'Missing Supabase credentials' })

    const supabase = createClient(supabaseUrl, serviceRoleKey)
    const now = new Date()
    const nowIso = now.toISOString()

    const earlyReleaseDays = parseDays(Deno.env.get('PAYPAL_SHIPPED_HOLD_DAYS') ?? '')

    const { data: ledgerRows, error: ledgerError } = await supabase
      .from('payout_ledger')
      .select('id, order_id, hold_release_at, status')
      .in('status', ['PENDING_HOLD', 'READY_TO_PAY'])
      .limit(500)

    if (ledgerError) return json(400, { error: ledgerError.message })

    const rows = Array.isArray(ledgerRows) ? ledgerRows : []
    if (!rows.length) return json(200, { ok: true, moved: 0 })

    const orderIds = rows.map((r: any) => r.order_id).filter(Boolean)

    const orderMap = new Map<string, any>()
    if (orderIds.length) {
      const { data: orders } = await supabase
        .from('orders')
        .select('id, dispute_status, shipped_at, tracking_number, carrier')
        .in('id', orderIds)
      for (const order of orders || []) {
        orderMap.set(String((order as any).id), order)
      }
    }

    const readyIds: string[] = []
    const disputeIds: string[] = []

    for (const row of rows) {
      const holdReleaseAt = new Date(row.hold_release_at)
      const order = orderMap.get(String(row.order_id || '')) || null
      const disputeStatus = String(order?.dispute_status || 'NONE')

      if (disputeStatus !== 'NONE') {
        disputeIds.push(String(row.id))
        continue
      }

      if (String(row.status).toUpperCase() === 'READY_TO_PAY') {
        continue
      }

      let effectiveReleaseAt = holdReleaseAt
      if (earlyReleaseDays && order?.shipped_at && order?.tracking_number) {
        const shippedAt = new Date(order.shipped_at)
        const earlyDate = new Date(shippedAt.getTime() + earlyReleaseDays * 24 * 60 * 60 * 1000)
        if (earlyDate < effectiveReleaseAt) {
          effectiveReleaseAt = earlyDate
        }
      }

      if (effectiveReleaseAt <= now) {
        readyIds.push(String(row.id))
      }
    }

    if (disputeIds.length) {
      await supabase
        .from('payout_ledger')
        .update({ status: 'ON_HOLD_DISPUTE' })
        .in('id', disputeIds)
    }

    if (readyIds.length) {
      await supabase
        .from('payout_ledger')
        .update({ status: 'READY_TO_PAY' })
        .in('id', readyIds)
    }

    return json(200, { ok: true, moved: readyIds.length, dispute_holds: disputeIds.length, now: nowIso })
  } catch (error) {
    return json(500, { error: error instanceof Error ? error.message : String(error) })
  }
})
