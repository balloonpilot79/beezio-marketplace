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

    const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY') ?? ''
    if (!stripeSecret) return json(500, { error: 'Missing STRIPE_SECRET_KEY' })

    const stripe = new Stripe(stripeSecret, { apiVersion: '2023-10-16' })
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)

    // Resolve profile id (schemas vary)
    const { data: profileRow } = await supabaseAdmin
      .from('profiles')
      .select('id, role, primary_role, email')
      .or(`id.eq.${userData.user.id},user_id.eq.${userData.user.id}`)
      .maybeSingle()

    const profileId = profileRow?.id ? String(profileRow.id) : null
    if (!profileId) return json(400, { error: 'Missing profile for user' })

    const role = String((profileRow as any)?.primary_role || (profileRow as any)?.role || '')
    if (role !== 'seller') return json(403, { error: 'Only sellers can run identity verification' })

    // Create a Stripe Identity verification session (hosted flow).
    const session = await stripe.identity.verificationSessions.create({
      type: 'document',
      metadata: {
        beezio_profile_id: profileId,
        beezio_user_id: userData.user.id,
      },
      // Ask for self-capture where supported; Stripe will handle per-country capabilities.
      options: { document: { require_id_number: true, require_live_capture: true } } as any,
    })

    // Store the session on the profile so webhooks can reconcile.
    await supabaseAdmin
      .from('profiles')
      .update({
        stripe_identity_verification_session_id: session.id,
        identity_verification_status: session.status || 'processing',
        verification_updated_at: new Date().toISOString(),
      })
      .eq('id', profileId)

    try {
      await supabaseAdmin.from('seller_verification_events').insert({
        seller_id: profileId,
        event_type: 'identity.session_created',
        details: { session_id: session.id, status: session.status },
      })
    } catch (_e) {
      // Non-fatal: audit logging should not block identity verification.
    }

    return json(200, {
      session_id: session.id,
      status: session.status,
      url: (session as any).url || null,
    })
  } catch (e) {
    return json(400, { error: e instanceof Error ? e.message : String(e) })
  }
})
