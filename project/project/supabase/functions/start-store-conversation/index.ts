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
    const ownerId = String(body?.ownerId || '').trim()
    const ownerType = String(body?.ownerType || '').toLowerCase().trim()
    const storeName = body?.storeName ? String(body.storeName) : null

    if (!ownerId) return json(400, { error: 'Missing ownerId' })
    if (!['seller', 'affiliate', 'fundraiser'].includes(ownerType)) return json(400, { error: 'Invalid ownerType' })
    if (ownerId === userData.user.id) return json(400, { error: 'Cannot message yourself' })

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)

    // Upsert conversation (unique by owner_id+owner_type+customer_id).
    const { data: convo, error: convoError } = await supabaseAdmin
      .from('store_conversations')
      .upsert(
        {
          owner_id: ownerId,
          owner_type: ownerType,
          customer_id: userData.user.id,
          store_name: storeName,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'owner_id,owner_type,customer_id' }
      )
      .select('id, owner_id, owner_type, customer_id, store_name, created_at, updated_at')
      .single()

    if (convoError || !convo) return json(400, { error: 'Failed to create conversation', details: convoError?.message })

    // Ensure participants exist (idempotent).
    await supabaseAdmin
      .from('store_conversation_participants')
      .upsert(
        [
          { conversation_id: convo.id, user_id: ownerId },
          { conversation_id: convo.id, user_id: userData.user.id },
        ],
        { onConflict: 'conversation_id,user_id' }
      )

    return json(200, { conversation: convo })
  } catch (e) {
    return json(500, { error: 'Unexpected error', details: e instanceof Error ? e.message : String(e) })
  }
})

