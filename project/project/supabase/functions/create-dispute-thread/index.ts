import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders, getAuthedUser, getEnv, isAdminUser, json } from '../_shared/admin.ts'

const allowedTypes = new Set([
  'product_not_received',
  'product_damaged',
  'wrong_item',
  'not_as_described',
  'refund_request',
  'quality_issue',
  'seller_unresponsive',
  'other',
])

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const DISPUTE_WINDOW_DAYS = 14

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' })

  try {
    const { supabaseUrl, anonKey, serviceRoleKey } = getEnv()
    if (!supabaseUrl) return json(500, { error: 'Missing SUPABASE_URL' })
    if (!serviceRoleKey) return json(500, { error: 'Missing SUPABASE_SERVICE_ROLE_KEY' })

    const authHeader = req.headers.get('authorization') || ''
    if (!authHeader) return json(401, { error: 'Missing authorization header' })

    const { user, error: authErr } = await getAuthedUser(authHeader, supabaseUrl, anonKey || serviceRoleKey)
    if (!user) return json(401, { error: 'Unauthorized', details: authErr })

    const body = await req.json().catch(() => ({}))
    const rawSeller = String(body?.sellerId || '').trim()
    const disputeTypeInput = String(body?.disputeType || '').toLowerCase().trim()
    const description = String(body?.description || '').trim()
    const messageBody = String(body?.message || '').trim()
    const orderId = body?.orderId ? String(body.orderId).trim() : null

    if (!rawSeller) return json(400, { error: 'Missing sellerId' })
    if (!description) return json(400, { error: 'Missing description' })
    if (orderId && !uuidRegex.test(orderId)) return json(400, { error: 'Invalid orderId' })

    const disputeType = allowedTypes.has(disputeTypeInput) ? disputeTypeInput : 'other'
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)
    const admin = await isAdminUser(supabaseAdmin, user.id)

    let resolvedSellerId = rawSeller
    if (rawSeller.includes('@')) {
      const { data } = await supabaseAdmin
        .from('profiles')
        .select('user_id')
        .eq('email', rawSeller)
        .maybeSingle()
      if (data?.user_id) resolvedSellerId = String(data.user_id)
    } else {
      const { data } = await supabaseAdmin
        .from('profiles')
        .select('user_id')
        .or(`id.eq.${rawSeller},user_id.eq.${rawSeller}`)
        .maybeSingle()
      if (data?.user_id) resolvedSellerId = String(data.user_id)
    }

    if (!uuidRegex.test(resolvedSellerId)) {
      return json(400, { error: 'Invalid sellerId' })
    }
    if (resolvedSellerId === user.id) return json(400, { error: 'Cannot file against yourself' })

    if (orderId) {
      const { data: order } = await supabaseAdmin
        .from('orders')
        .select('id, created_at')
        .eq('id', orderId)
        .maybeSingle()

      if (!order?.id) {
        return json(404, { error: 'Order not found' })
      }

      const createdAt = new Date(order.created_at)
      if (Number.isNaN(createdAt.getTime())) {
        return json(400, { error: 'Order has invalid timestamp' })
      }

      const disputeCutoff = Date.now() - DISPUTE_WINDOW_DAYS * 24 * 60 * 60 * 1000
      if (createdAt.getTime() < disputeCutoff) {
        return json(400, { error: `Dispute window expired (${DISPUTE_WINDOW_DAYS} days)` })
      }
    }

    const { data: dispute, error: disputeError } = await supabaseAdmin
      .from('disputes')
      .insert({
        order_id: orderId || null,
        dispute_type: disputeType,
        filed_by: user.id,
        filed_against: resolvedSellerId,
        description,
        status: admin ? 'investigating' : 'open',
      })
      .select(
        'id, order_id, dispute_type, description, status, filed_by, filed_against, created_at, updated_at'
      )
      .single()

    if (disputeError || !dispute) {
      return json(400, { error: 'Failed to create dispute', details: disputeError?.message })
    }

    const initialMessage = messageBody || description
    const { error: messageError } = await supabaseAdmin.from('dispute_messages').insert({
      dispute_id: dispute.id,
      sender_id: user.id,
      message: initialMessage,
      is_admin_message: admin,
    })

    if (messageError) {
      return json(400, { error: 'Dispute created but message failed', details: messageError.message })
    }

    if (orderId) {
      try {
        await supabaseAdmin
          .from('orders')
          .update({
            status: 'disputed',
            payment_status: 'disputed',
            updated_at: new Date().toISOString(),
          })
          .eq('id', orderId)

        const { error: holdError } = await supabaseAdmin
          .from('payment_distributions')
          .update({
            status: 'held',
            hold_reason: 'dispute_open',
            updated_at: new Date().toISOString(),
          })
          .eq('order_id', orderId)
          .in('status', ['pending', 'available', 'held'])

        if (holdError) {
          await supabaseAdmin
            .from('payment_distributions')
            .update({
              status: 'held',
              updated_at: new Date().toISOString(),
            })
            .eq('order_id', orderId)
            .in('status', ['pending', 'available', 'held'])
        }
      } catch (_e) {
        // Non-fatal: dispute should still be created even if ledger hold fails.
      }
    }

    return json(200, { dispute })
  } catch (e) {
    return json(500, { error: 'Unexpected error', details: e instanceof Error ? e.message : String(e) })
  }
})
