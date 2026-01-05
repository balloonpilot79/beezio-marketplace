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
    const title = String(body?.title || '').trim().slice(0, 200)
    const messageBody = String(body?.body || '').trim()
    const startsAt = body?.startsAt ? String(body.startsAt).trim() : null
    const endsAt = body?.endsAt ? String(body.endsAt).trim() : null

    if (!title) return json(400, { error: 'Missing title' })
    if (!messageBody) return json(400, { error: 'Missing body' })
    if (messageBody.length > 8000) return json(400, { error: 'Body too long' })

    const { data: announcement, error: annError } = await supabaseAdmin
      .from('admin_announcements')
      .insert({
        sender_id: user.id,
        title,
        body: messageBody,
        starts_at: startsAt,
        ends_at: endsAt,
      })
      .select('id, sender_id, title, body, starts_at, ends_at, created_at')
      .single()

    if (annError || !announcement) return json(400, { error: 'Failed to create', details: annError?.message })

    return json(200, { announcement })
  } catch (e) {
    return json(500, { error: 'Unexpected error', details: e instanceof Error ? e.message : String(e) })
  }
})

