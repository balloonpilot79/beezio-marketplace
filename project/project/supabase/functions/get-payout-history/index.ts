import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import Stripe from 'npm:stripe@14.21.0'

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

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2023-10-16',
    })

    const supabase = createClient(supabaseUrl, serviceRoleKey)

    // Resolve Stripe account for the authenticated user
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, user_id, stripe_account_id')
      .or(`id.eq.${userData.user.id},user_id.eq.${userData.user.id}`)
      .maybeSingle()

    if (profileError || !profile?.stripe_account_id) return json(200, [])

    const payouts = await stripe.payouts.list({ limit: 20 }, { stripeAccount: profile.stripe_account_id })

    const payoutHistory = payouts.data.map((payout) => ({
      id: payout.id,
      amount: payout.amount / 100,
      status: payout.status,
      arrival_date: new Date(payout.arrival_date * 1000).toLocaleDateString(),
      description: payout.description || `Payout for ${new Date(payout.created * 1000).toLocaleDateString()}`,
      failure_reason: payout.failure_message || null,
    }))

    return json(200, payoutHistory)
  } catch (error) {
    console.error('Error getting payout history:', error)
    return json(200, [])
  }
})

