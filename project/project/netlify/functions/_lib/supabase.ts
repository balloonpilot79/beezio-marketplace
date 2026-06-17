import { createClient } from '@supabase/supabase-js';
import { requireEnv } from './env';

export function createSupabaseAdmin() {
  const supabaseUrl = requireEnv('SUPABASE_URL', ['VITE_SUPABASE_URL']);
  const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  return createClient(supabaseUrl, serviceRoleKey);
}

export function createSupabaseAuthed(authorizationHeader: string) {
  const supabaseUrl = requireEnv('SUPABASE_URL', ['VITE_SUPABASE_URL']);
  const anonKey = String(process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '').trim();
  const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const key = anonKey || serviceRoleKey;
  if (!key) throw new Error('Missing SUPABASE_ANON_KEY (or SUPABASE_SERVICE_ROLE_KEY)');

  return createClient(supabaseUrl, key, {
    global: {
      headers: {
        Authorization: authorizationHeader,
      },
    },
  });
}
