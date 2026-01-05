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

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)
    const admin = await isAdminUser(supabaseAdmin, user.id)
    if (!admin) return json(403, { error: 'Admin only' })

    const body = await req.json().catch(() => ({}))
    const email = body?.email ? String(body.email).trim().toLowerCase() : ''
    const subject = body?.subject ? String(body.subject).trim().slice(0, 200) : null
    const messageBody = String(body?.body || '').trim()

    if (!email) return json(400, { error: 'Missing email' })
    if (!messageBody) return json(400, { error: 'Missing body' })
    if (messageBody.length > 4000) return json(400, { error: 'Message too long' })

    const { data: targetUser, error: getUserErr } = await supabaseAdmin.auth.admin.getUserByEmail(email)
    if (getUserErr || !targetUser?.user) return json(404, { error: 'User not found', details: getUserErr?.message })

    const customerId = targetUser.user.id

    const { data: thread, error: threadError } = await supabaseAdmin
      .from('support_threads')
      .insert({
        customer_id: customerId,
        subject: subject || 'Message from Beezio',
        status: 'open',
        assigned_admin_id: user.id,
      })
      .select('id, customer_id, subject, status, assigned_admin_id, created_at, updated_at')
      .single()

    if (threadError || !thread) return json(400, { error: 'Failed to create thread', details: threadError?.message })

    await supabaseAdmin.from('support_thread_participants').upsert(
      [
        { thread_id: thread.id, user_id: customerId },
        { thread_id: thread.id, user_id: user.id },
      ],
      { onConflict: 'thread_id,user_id' }
    )

    const { data: msg, error: msgError } = await supabaseAdmin
      .from('support_messages')
      .insert({ thread_id: thread.id, sender_id: user.id, body: messageBody })
      .select('id, thread_id, sender_id, body, created_at')
      .single()

    if (msgError || !msg) return json(400, { error: 'Failed to send message', details: msgError?.message })

    return json(200, { thread, message: msg })
  } catch (e) {
    return json(500, { error: 'Unexpected error', details: e instanceof Error ? e.message : String(e) })
  }
})

