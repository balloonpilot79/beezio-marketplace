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
    const threadId = String(body?.threadId || '').trim()
    const messageBody = String(body?.body || '').trim()
    if (!threadId) return json(400, { error: 'Missing threadId' })
    if (!messageBody) return json(400, { error: 'Message is empty' })
    if (messageBody.length > 4000) return json(400, { error: 'Message too long' })

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)
    const admin = await isAdminUser(supabaseAdmin, user.id)

    const { data: thread } = await supabaseAdmin
      .from('support_threads')
      .select('id, customer_id')
      .eq('id', threadId)
      .maybeSingle()
    if (!thread?.id) return json(404, { error: 'Thread not found' })

    if (!admin && String(thread.customer_id) !== user.id) return json(403, { error: 'Forbidden' })

    const { data: msg, error: msgError } = await supabaseAdmin
      .from('support_messages')
      .insert({ thread_id: threadId, sender_id: user.id, body: messageBody })
      .select('id, thread_id, sender_id, body, created_at')
      .single()
    if (msgError || !msg) return json(400, { error: 'Failed to send', details: msgError?.message })

    await supabaseAdmin.from('support_thread_participants').upsert(
      { thread_id: threadId, user_id: user.id, last_read_at: new Date().toISOString() },
      { onConflict: 'thread_id,user_id' }
    )

    return json(200, { message: msg })
  } catch (e) {
    return json(500, { error: 'Unexpected error', details: e instanceof Error ? e.message : String(e) })
  }
})

