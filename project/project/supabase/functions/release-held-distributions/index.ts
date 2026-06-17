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
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    if (!supabaseUrl) return json(500, { error: 'Missing SUPABASE_URL' })
    if (!serviceRoleKey) return json(500, { error: 'Missing SUPABASE_SERVICE_ROLE_KEY' })

    const supabase = createClient(supabaseUrl, serviceRoleKey)

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

    const nowIso = new Date().toISOString()

    let query = supabase
      .from('payment_distributions')
      .select('id, order_id, created_at, available_at, recipient_type')
      .in('recipient_type', ['seller', 'affiliate'])
      .eq('status', 'held')
      .limit(500)

    if (hasAvailableAt) {
      query = query.lte('available_at', nowIso)
    } else {
      // Fallback if the column doesn't exist yet: 14 days from creation.
      const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
      query = query.lte('created_at', cutoff)
    }

    const { data: heldRows, error: heldError } = await query
    if (heldError) return json(400, { error: heldError.message })

    const rows = Array.isArray(heldRows) ? heldRows : []
    if (!rows.length) return json(200, { ok: true, released: 0 })

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

        const okFulfillmentIds = new Set(
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
            return okFulfillmentIds.has(orderId)
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

    if (!eligibleIds.length) return json(200, { ok: true, released: 0 })

    // Transition held -> pending (this triggers the DB function to move held_balance -> current_balance).
    const { error: updateError } = await supabase
      .from('payment_distributions')
      .update({ status: 'pending' })
      .in('id', eligibleIds)

    if (updateError) return json(400, { error: updateError.message })

    return json(200, { ok: true, released: eligibleIds.length })
  } catch (e) {
    return json(500, { error: 'Unexpected error', details: e instanceof Error ? e.message : String(e) })
  }
})
