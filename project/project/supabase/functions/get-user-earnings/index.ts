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

    const body = await req.json().catch(() => ({}))
    const requestedRole = String(body?.role || '').toLowerCase().trim() as Role
    if (requestedRole !== 'seller' && requestedRole !== 'affiliate') {
      return json(400, { error: 'Invalid role' })
    }

    const supabaseAuthed = createClient(supabaseUrl, anonKey || serviceRoleKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: userData, error: userError } = await supabaseAuthed.auth.getUser()
    if (userError || !userData?.user) return json(401, { error: 'Unauthorized', details: userError?.message })

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)

    // Resolve the caller's profile id (some schemas use profiles.id=user_id; others use profiles.user_id)
    const { data: profileRow } = await supabaseAdmin
      .from('profiles')
      .select('id, user_id')
      .or(`id.eq.${userData.user.id},user_id.eq.${userData.user.id}`)
      .maybeSingle()

    const profileId = profileRow?.id ? String(profileRow.id) : null
    if (!profileId) return json(400, { error: 'Missing profile for user' })

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

    const hasHeldBalance = await tableHasColumn('user_earnings', 'held_balance')
    const earningsSelect = hasHeldBalance
      ? 'user_id, role, total_earned, pending_payout, paid_out, current_balance, held_balance, last_payout_at, updated_at'
      : 'user_id, role, total_earned, pending_payout, paid_out, current_balance, last_payout_at, updated_at'

    // Read earnings for this role
    const { data: earningsRow } = await supabaseAdmin
      .from('user_earnings')
      .select(earningsSelect)
      .eq('user_id', profileId)
      .eq('role', requestedRole)
      .maybeSingle()

    // Read recent payout requests
    const { data: requests } = await supabaseAdmin
      .from('payout_requests')
      .select('id, amount, status, requested_at, processed_at, rejection_reason, created_at')
      .eq('user_id', profileId)
      .eq('role', requestedRole)
      .order('created_at', { ascending: false })
      .limit(10)

    const safe = (n: unknown) => {
      const v = Number(n)
      return Number.isFinite(v) ? v : 0
    }

    const earnings = earningsRow
      ? {
          user_id: String((earningsRow as any).user_id),
          role: String((earningsRow as any).role),
          total_earned: safe((earningsRow as any).total_earned),
          pending_payout: safe((earningsRow as any).pending_payout),
          paid_out: safe((earningsRow as any).paid_out),
          current_balance: safe((earningsRow as any).current_balance),
          held_balance: safe((earningsRow as any).held_balance),
          last_payout_at: (earningsRow as any).last_payout_at || null,
          updated_at: (earningsRow as any).updated_at || null,
        }
      : {
          user_id: profileId,
          role: requestedRole,
          total_earned: 0,
          pending_payout: 0,
          paid_out: 0,
          current_balance: 0,
          held_balance: 0,
          last_payout_at: null,
          updated_at: null,
        }

    return json(200, { profileId, earnings, payout_requests: requests || [] })
  } catch (e) {
    return json(500, { error: 'Unexpected error', details: e instanceof Error ? e.message : String(e) })
  }
})
