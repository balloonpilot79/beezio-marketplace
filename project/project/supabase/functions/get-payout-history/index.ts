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

const safeNumber = (value: unknown) => {
  const num = Number(value)
  return Number.isFinite(num) ? num : 0
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

    const supabase = createClient(supabaseUrl, serviceRoleKey)

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, user_id')
      .or(`id.eq.${userData.user.id},user_id.eq.${userData.user.id}`)
      .maybeSingle()

    if (profileError || !profile?.id) return json(200, [])

    const profileId = String(profile.id)
    const body = await req.json().catch(() => ({}))
    const limit = Math.max(1, Math.min(50, Number((body as any)?.limit || 20) || 20))

    const { data: payouts } = await supabase
      .from('payouts')
      .select('id, amount, status, completed_at, created_at, failure_reason, batch_id')
      .eq('user_id', profileId)
      .order('created_at', { ascending: false })
      .limit(limit)

    const payoutHistory = ((payouts as any[]) || []).map((payout: any) => ({
      id: String(payout?.id || ''),
      amount: safeNumber(payout?.amount),
      status: String(payout?.status || 'pending'),
      arrival_date: payout?.completed_at ? new Date(String(payout.completed_at)).toLocaleDateString() : null,
      description: payout?.completed_at
        ? `PayPal payout completed ${new Date(String(payout.completed_at)).toLocaleDateString()}`
        : `PayPal payout created ${new Date(String(payout?.created_at || new Date().toISOString())).toLocaleDateString()}`,
      failure_reason: payout?.failure_reason ? String(payout.failure_reason) : null,
    }))

    if (payoutHistory.length > 0) return json(200, payoutHistory)

    const { data: requests } = await supabase
      .from('payout_requests')
      .select('id, amount, status, requested_at, processed_at, rejection_reason')
      .eq('user_id', profileId)
      .order('requested_at', { ascending: false })
      .limit(limit)

    return json(
      200,
      ((requests as any[]) || []).map((request: any) => ({
        id: String(request?.id || ''),
        amount: safeNumber(request?.amount),
        status: String(request?.status || 'pending'),
        arrival_date: request?.processed_at ? new Date(String(request.processed_at)).toLocaleDateString() : null,
        description: request?.processed_at
          ? `PayPal payout request processed ${new Date(String(request.processed_at)).toLocaleDateString()}`
          : `PayPal payout request submitted ${new Date(String(request?.requested_at || new Date().toISOString())).toLocaleDateString()}`,
        failure_reason: request?.rejection_reason ? String(request.rejection_reason) : null,
      }))
    )
  } catch (error) {
    console.error('Error getting payout history:', error)
    return json(200, [])
  }
})

