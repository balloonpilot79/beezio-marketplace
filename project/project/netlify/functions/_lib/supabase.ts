import { createClient } from '@supabase/supabase-js';
import { requireEnv } from './env';

function getSecretKey() {
  const direct = String(process.env.SUPABASE_SECRET_KEY || '').trim();
  if (direct) return direct;

  const raw = String(process.env.SUPABASE_SECRET_KEYS || '').trim();
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      const first = parsed?.default;
      if (typeof first === 'string' && first.trim()) return first.trim();
    } catch {}
  }

  return String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
}

export function createSupabaseAdmin() {
  const supabaseUrl = requireEnv('SUPABASE_URL', ['VITE_SUPABASE_URL']);
  const secretKey = getSecretKey();
  if (!secretKey) throw new Error('Missing SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY)');
  return createClient(supabaseUrl, secretKey);
}

export function createSupabaseAuthed(authorizationHeader: string) {
  const supabaseUrl = requireEnv('SUPABASE_URL', ['VITE_SUPABASE_URL']);
  const anonKey = String(process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '').trim();
  const secretKey = getSecretKey();
  const key = anonKey || secretKey;
  if (!key) throw new Error('Missing SUPABASE_ANON_KEY (or SUPABASE_SECRET_KEY)');

  return createClient(supabaseUrl, key, {
    global: {
      headers: {
        Authorization: authorizationHeader,
      },
    },
  });
}
