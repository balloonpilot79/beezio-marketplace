import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type Role = 'seller' | 'affiliate'

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

const safeNumber = (n: unknown) => {
  const v = Number(n)
  return Number.isFinite(v) ? v : NaN
}

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
    const requestedRole = String(body?.role || '').toLowerCase().trim() as Role
    if (requestedRole !== 'seller' && requestedRole !== 'affiliate') {
      return json(400, { error: 'Invalid role' })
    }

    const requestedAmount = body?.amount !== undefined && body?.amount !== null ? safeNumber(body.amount) : NaN

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)

    // Resolve profile id
    const { data: profileRow } = await supabaseAdmin
      .from('profiles')
      .select('id, user_id, stripe_account_id, seller_verification_status, identity_verification_status')
      .or(`id.eq.${userData.user.id},user_id.eq.${userData.user.id}`)
      .maybeSingle()

    const profileId = profileRow?.id ? String(profileRow.id) : null
    if (!profileId) return json(400, { error: 'Missing profile for user' })

    // Must have Stripe connected to receive transfers/payouts
    const stripeAccountId = (profileRow as any)?.stripe_account_id ? String((profileRow as any).stripe_account_id) : ''
    if (!stripeAccountId) return json(400, { error: 'Connect Stripe before requesting a payout' })

    // Sellers must pass verification before payouts (fraud/shipping risk control).
    if (requestedRole === 'seller') {
      const sellerStatus = String((profileRow as any)?.seller_verification_status || 'unverified')
      const identityStatus = String((profileRow as any)?.identity_verification_status || 'not_started')
      if (sellerStatus !== 'verified' || identityStatus !== 'verified') {
        return json(403, {
          error: 'Seller verification required before requesting payouts',
          details: { seller_verification_status: sellerStatus, identity_verification_status: identityStatus },
        })
      }
    }

    // Load balances (note: payouts are processed automatically bi-monthly; requests are informational/audit-only).
    const { data: earningsRow } = await supabaseAdmin
      .from('user_earnings')
      .select('user_id, role, current_balance, pending_payout')
      .eq('user_id', profileId)
      .eq('role', requestedRole)
      .maybeSingle()

    const currentBalance = Number((earningsRow as any)?.current_balance ?? 0)
    const pendingPayout = Number((earningsRow as any)?.pending_payout ?? 0)
    const available = Math.max(currentBalance, pendingPayout)

    const amount = Number.isFinite(requestedAmount) ? requestedAmount : available
    const rounded = Math.round((amount + Number.EPSILON) * 100) / 100

    if (!Number.isFinite(rounded) || rounded <= 0) return json(400, { error: 'Invalid amount' })
    if (rounded < 25) return json(400, { error: 'Minimum payout request is $25' })
    if (rounded > available) return json(400, { error: 'Amount exceeds available balance' })

    // Create request
    const { data: requestRow, error: requestError } = await supabaseAdmin
      .from('payout_requests')
      .insert({
        user_id: profileId,
        role: requestedRole,
        amount: rounded,
        status: 'pending',
        requested_at: new Date().toISOString(),
      })
      .select('id, amount, status, created_at')
      .single()

    if (requestError) return json(400, { error: 'Failed to create payout request', details: requestError.message })

    return json(200, {
      ok: true,
      profileId,
      request: requestRow,
      balances: { current_balance: currentBalance, pending_payout: pendingPayout },
      note: 'Payouts are processed bi-monthly (1st and 15th UTC). Requests are tracked for audit and do not move balances.',
    })
  } catch (e) {
    return json(500, { error: 'Unexpected error', details: e instanceof Error ? e.message : String(e) })
  }
})
