import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders, getAuthedUser, getEnv, isAdminUser, json } from '../_shared/admin.ts'

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
    const conversationId = String(body?.conversationId || '').trim()
    const messageBody = String(body?.body || '').trim()

    if (!conversationId) return json(400, { error: 'Missing conversationId' })
    if (!messageBody) return json(400, { error: 'Message is empty' })
    if (messageBody.length > 4000) return json(400, { error: 'Message too long' })

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)

    const { data: convo } = await supabaseAdmin
      .from('store_conversations')
      .select('id, owner_id, customer_id')
      .eq('id', conversationId)
      .maybeSingle()

    if (!convo?.id) return json(404, { error: 'Conversation not found' })
    const isAdmin = await isAdminUser(supabaseAdmin, user.id)
    if (!isAdmin && convo.owner_id !== user.id && convo.customer_id !== user.id) {
      return json(403, { error: 'Forbidden' })
    }

    const { data: msg, error: msgError } = await supabaseAdmin
      .from('store_messages')
      .insert({
        conversation_id: conversationId,
        sender_id: user.id,
        body: messageBody,
      })
      .select('id, conversation_id, sender_id, body, created_at')
      .single()

    if (msgError || !msg) return json(400, { error: 'Failed to send', details: msgError?.message })

    // Mark as read for sender.
    await supabaseAdmin
      .from('store_conversation_participants')
      .upsert(
        { conversation_id: conversationId, user_id: user.id, last_read_at: new Date().toISOString() },
        { onConflict: 'conversation_id,user_id' }
      )

    return json(200, { message: msg })
  } catch (e) {
    return json(500, { error: 'Unexpected error', details: e instanceof Error ? e.message : String(e) })
  }
})
