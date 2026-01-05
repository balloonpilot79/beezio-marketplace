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

    const nowIso = new Date().toISOString()

    let query = supabase
      .from('payment_distributions')
      .select('id, order_id, created_at, available_at')
      .eq('recipient_type', 'seller')
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

    if (hasOrderId && ordersHasFulfillment) {
      const orderIds = rows
        .map((r: any) => (r.order_id ? String(r.order_id) : null))
        .filter(Boolean) as string[]

      if (orderIds.length) {
        const { data: orders } = await supabase
          .from('orders')
          .select('id, fulfillment_status')
          .in('id', orderIds)

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

