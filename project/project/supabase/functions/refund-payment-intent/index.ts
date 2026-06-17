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

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const isUuid = (value: unknown) => UUID_REGEX.test(String(value || '').trim())

const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100

const normalize = (value: unknown) => String(value || '').trim()

const logAccountRefundHistory = async (
  supabaseAdmin: any,
  params: {
    order: any
    actorProfileId: string | null
    refundId: string | null
    amount?: number
    reason: string
  }
) => {
  const rows = [
    {
      subject_profile_id: normalize(params.order?.buyer_id),
      subject_role: 'buyer',
      counterparty_profile_id: normalize(params.order?.seller_id) || null,
      counterparty_role: normalize(params.order?.seller_id) ? 'seller' : null,
    },
    {
      subject_profile_id: normalize(params.order?.seller_id),
      subject_role: 'seller',
      counterparty_profile_id: normalize(params.order?.buyer_id) || null,
      counterparty_role: normalize(params.order?.buyer_id) ? 'buyer' : null,
    },
  ].filter((row) => row.subject_profile_id)

  if (!rows.length) return

  await supabaseAdmin.from('account_refund_history').insert(
    rows.map((row) => ({
      order_id: String(params.order.id),
      order_number: normalize(params.order?.order_number) || null,
      subject_profile_id: row.subject_profile_id,
      subject_role: row.subject_role,
      counterparty_profile_id: row.counterparty_profile_id,
      counterparty_role: row.counterparty_role,
      actor_profile_id: params.actorProfileId || null,
      refund_id: params.refundId,
      refund_amount: Number.isFinite(params.amount) && Number(params.amount) > 0 ? roundMoney(Number(params.amount)) : null,
      currency: normalize(params.order?.currency) || 'USD',
      refund_reason: params.reason,
      provider_order_id: normalize(params.order?.provider_order_id) || null,
      provider_capture_id: normalize(params.order?.provider_capture_id) || null,
      payment_status_before: normalize(params.order?.payment_status) || null,
      order_status_before: normalize(params.order?.status) || null,
      metadata: {
        source: 'admin_refund',
        total_charged: Number(params.order?.total_charged || 0) || null,
      },
    }))
  )
}

const getPayPalEnv = () =>
  String(Deno.env.get('PAYPAL_ENV') || 'sandbox').trim().toLowerCase() === 'live' ? 'live' : 'sandbox'

const getPayPalBaseUrl = () =>
  getPayPalEnv() === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com'

const getPayPalCredentials = () => {
  if (getPayPalEnv() === 'live') {
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

const getPayPalAccessToken = async () => {
  const { clientId, secret } = getPayPalCredentials()
  if (!clientId || !secret) throw new Error('PayPal is not configured')

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

const refundPayPalCapture = async (params: {
  captureId: string
  currency: string
  amount?: number
  note?: string
}) => {
  const accessToken = await getPayPalAccessToken()
  const body: Record<string, unknown> = {}
  if (Number.isFinite(params.amount) && Number(params.amount) > 0) {
    body.amount = {
      currency_code: String(params.currency || 'USD').toUpperCase(),
      value: roundMoney(Number(params.amount)).toFixed(2),
    }
  }
  if (params.note) {
    body.note_to_payer = String(params.note).slice(0, 255)
  }

  const res = await fetch(`${getPayPalBaseUrl()}/v2/payments/captures/${encodeURIComponent(params.captureId)}/refund`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(String((data as any)?.details?.[0]?.description || (data as any)?.message || 'PayPal refund failed'))
  }

  return {
    refundId: String((data as any)?.id || '').trim() || null,
    status: String((data as any)?.status || '').trim() || null,
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 405,
    })
  }

  try {
    const { paymentIntentId, referenceId, reason, amount, orderId, providerCaptureId, providerOrderId } = await req.json().catch(() => ({}))
    const candidateIds = [
      normalize(orderId),
      normalize(providerCaptureId),
      normalize(providerOrderId),
      normalize(referenceId),
      normalize(paymentIntentId),
    ].filter(Boolean)
    if (!candidateIds.length) return json(400, { error: 'referenceId required' })
    const refundAmount = Number(amount)

    const serviceRoleKey =
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ??
      Deno.env.get('SERVICE_ROLE_KEY') ??
      ''

    const supabaseAuthed = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      serviceRoleKey,
      {
        global: {
          headers: {
            Authorization: req.headers.get('Authorization') ?? '',
          },
        },
      }
    )

    const { data: authData, error: authError } = await supabaseAuthed.auth.getUser()
    if (authError || !authData?.user) return json(401, { error: 'Unauthorized' })

    const userId = authData.user.id

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      serviceRoleKey
    )

    const { data: profileRow } = await supabaseAdmin
      .from('profiles')
      .select('id, user_id, role, primary_role')
      .or(`id.eq.${userId},user_id.eq.${userId}`)
      .maybeSingle()

    const normalizedRole = String((profileRow as any)?.primary_role || (profileRow as any)?.role || '').trim().toLowerCase()
    const actorProfileId = normalize((profileRow as any)?.id) || userId
    const isAdmin = normalizedRole === 'admin' || normalizedRole === 'platform_admin'

    const selectOrder = async (column: 'id' | 'provider_capture_id' | 'provider_order_id', value: string) =>
      await supabaseAdmin
        .from('orders')
        .select('id, order_number, user_id, buyer_id, seller_id, provider_order_id, provider_capture_id, payment_status, status, currency, total_charged')
        .eq(column, value)
        .maybeSingle()

    let orderLookup = { data: null as any }
    for (const candidateId of candidateIds) {
      if (!orderLookup.data && isUuid(candidateId)) orderLookup = await selectOrder('id', candidateId)
      if (!orderLookup.data) orderLookup = await selectOrder('provider_capture_id', candidateId)
      if (!orderLookup.data) orderLookup = await selectOrder('provider_order_id', candidateId)
      if (orderLookup.data) break
    }

    const order = orderLookup.data as any

    if (!order?.id) return json(404, { error: 'Order not found' })

    const orderOwnerIds = [order.user_id, order.buyer_id].map((value: unknown) => String(value || '').trim()).filter(Boolean)
    if (!isAdmin && orderOwnerIds.length > 0 && !orderOwnerIds.includes(userId)) return json(403, { error: 'Forbidden' })

    if (!order.provider_capture_id) {
      return json(400, { error: 'Order is missing a PayPal capture reference' })
    }

    const refund = await refundPayPalCapture({
      captureId: String(order.provider_capture_id),
      currency: String(order.currency || 'USD'),
      amount: Number.isFinite(refundAmount) && refundAmount > 0 ? refundAmount : undefined,
      note: typeof reason === 'string' ? reason : 'refund',
    })

    await supabaseAdmin
      .from('orders')
      .update({
        status: 'refunded',
        payment_status: 'refunded',
        updated_at: new Date().toISOString(),
      })
      .eq('id', String(order.id))

    await supabaseAdmin
      .from('payout_ledger')
      .update({ status: 'CANCELED' })
      .eq('order_id', String(order.id))
      .in('status', ['PENDING_HOLD', 'READY_TO_PAY'])

    await supabaseAdmin
      .from('payout_snapshots')
      .update({ status: 'CANCELED', updated_at: new Date().toISOString() })
      .eq('order_id', String(order.id))
      .in('status', ['PENDING_HOLD', 'READY_TO_PAY'])

    try {
      await supabaseAdmin
        .from('payment_distributions')
        .update({ status: 'canceled', paid_at: new Date().toISOString() })
        .eq('order_id', String(order.id))
        .in('status', ['held', 'pending', 'available'])
    } catch {
      // Best-effort compatibility for schemas without payment_distributions or status variants.
    }

    try {
      await supabaseAdmin.rpc('record_order_money_ledger_reversal', {
        p_order_id: String(order.id),
        p_reason: 'refund',
        p_provider_capture_id: String(order.provider_capture_id),
      })
    } catch {
      await supabaseAdmin
        .from('order_money_ledger')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('order_id', String(order.id))
        .in('status', ['held', 'ready', 'tracked'])
    }

    try {
      await logAccountRefundHistory(supabaseAdmin, {
        order,
        actorProfileId,
        refundId: refund.refundId,
        amount: refundAmount,
        reason: normalize(reason) || 'Refund issued',
      })
    } catch {
      // Best-effort.
    }

    return json(200, { ok: true, action: 'refund', refundId: refund.refundId, provider: 'paypal' })
  } catch (e: any) {
    const message = e instanceof Error ? e.message : String(e)
    return json(500, { error: message })
  }
})
