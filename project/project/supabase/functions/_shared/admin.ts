import { createClient } from 'npm:@supabase/supabase-js@2'

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

export function getEnv() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  return { supabaseUrl, anonKey, serviceRoleKey }
}

export async function getAuthedUser(authHeader: string, supabaseUrl: string, anonOrService: string) {
  const supabaseAuthed = createClient(supabaseUrl, anonOrService, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: userData, error: userError } = await supabaseAuthed.auth.getUser()
  if (userError || !userData?.user) {
    return { user: null, error: userError?.message || 'Unauthorized' }
  }
  return { user: userData.user, error: null }
}

export async function isAdminUser(supabaseAdmin: ReturnType<typeof createClient>, userId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('id, role, primary_role')
    .eq('user_id', userId)
    .maybeSingle()
  const role = String((data as any)?.primary_role || (data as any)?.role || '').toLowerCase()
  return role === 'admin'
}

