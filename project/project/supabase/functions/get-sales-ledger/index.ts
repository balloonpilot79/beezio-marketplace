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
    const limit = Number.isFinite(Number(body?.limit)) ? Math.max(1, Math.min(50, Number(body.limit))) : 10

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)

    const tableHasColumn = async (tableName: string, columnName: string): Promise<boolean> => {
      try {
        const { data, error } = await supabaseAdmin
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

    const hasOrderId = await tableHasColumn('payment_distributions', 'order_id')
    if (!hasOrderId) {
      return json(200, {
        ok: true,
        sales: [],
        warning: 'payment_distributions.order_id missing; run latest migrations for full sales ledger',
      })
    }

    const { data: distRows, error: distError } = await supabaseAdmin
      .from('payment_distributions')
      .select('order_id, amount, status, created_at')
      .eq('recipient_type', 'seller')
      .eq('recipient_id', userData.user.id)
      .not('order_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(500)

    if (distError) return json(400, { error: distError.message })

    const rows = (distRows as any[]) || []
    const byOrder = new Map<string, { seller_amount_total: number; statuses: Record<string, number> }>()
    for (const r of rows) {
      const orderId = String(r.order_id)
      const amount = Number(r.amount || 0)
      const status = String(r.status || 'pending')
      const current = byOrder.get(orderId) || { seller_amount_total: 0, statuses: {} }
      current.seller_amount_total += amount
      current.statuses[status] = (current.statuses[status] || 0) + 1
      byOrder.set(orderId, current)
    }

    const orderIds = Array.from(byOrder.keys()).slice(0, limit)
    const { data: orders } = await supabaseAdmin
      .from('orders')
      .select('*')
      .in('id', orderIds)

    const ordersById = new Map<string, any>()
    for (const o of (orders as any[]) || []) ordersById.set(String(o.id), o)

    const sales = orderIds.map((id) => {
      const order = ordersById.get(id) || {}
      const agg = byOrder.get(id) || { seller_amount_total: 0, statuses: {} }
      return {
        order_id: id,
        created_at: order.created_at || null,
        status: order.status || null,
        fulfillment_status: order.fulfillment_status || null,
        buyer_name: order.billing_name || null,
        buyer_email: order.billing_email || null,
        total_amount: order.total_amount || null,
        seller_amount_total: Math.round((agg.seller_amount_total + Number.EPSILON) * 100) / 100,
        seller_distribution_status_counts: agg.statuses,
      }
    })

    return json(200, { ok: true, sales })
  } catch (e) {
    return json(500, { error: 'Unexpected error', details: e instanceof Error ? e.message : String(e) })
  }
})

