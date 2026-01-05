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
    const subject = body?.subject ? String(body.subject).trim().slice(0, 200) : null
    const messageBody = body?.message ? String(body.message).trim() : null
    const customerIdRaw = body?.customerId ? String(body.customerId).trim() : ''

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)
    const admin = await isAdminUser(supabaseAdmin, user.id)

    const customerId = customerIdRaw && admin ? customerIdRaw : user.id

    if (!customerId) return json(400, { error: 'Missing customerId' })
    if (messageBody && messageBody.length > 4000) return json(400, { error: 'Message too long' })
    if (subject && subject.length > 200) return json(400, { error: 'Subject too long' })

    const { data: thread, error: threadError } = await supabaseAdmin
      .from('support_threads')
      .insert({
        customer_id: customerId,
        subject: subject,
        status: 'open',
        assigned_admin_id: admin ? user.id : null,
      })
      .select('id, customer_id, subject, status, assigned_admin_id, created_at, updated_at')
      .single()

    if (threadError || !thread) return json(400, { error: 'Failed to create thread', details: threadError?.message })

    // Ensure participants exist (customer + creator). For admin-created threads, admin is a participant too.
    const participantRows = [
      { thread_id: thread.id, user_id: customerId },
      { thread_id: thread.id, user_id: user.id },
    ]
    await supabaseAdmin.from('support_thread_participants').upsert(participantRows, { onConflict: 'thread_id,user_id' })

    if (messageBody) {
      const { error: msgError } = await supabaseAdmin.from('support_messages').insert({
        thread_id: thread.id,
        sender_id: user.id,
        body: messageBody,
      })
      if (msgError) return json(400, { error: 'Thread created but failed to send message', details: msgError.message })
    }

    return json(200, { thread })
  } catch (e) {
    return json(500, { error: 'Unexpected error', details: e instanceof Error ? e.message : String(e) })
  }
})

