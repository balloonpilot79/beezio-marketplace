import { createClient } from '@supabase/supabase-js';
import { requireEnv } from './env';

function unique(values: string[]) {
  return Array.from(new Set(values.map((value) => String(value || '').trim()).filter(Boolean)));
}

function configuredSecretKeys() {
  const keys = [
    String(process.env.SUPABASE_SECRET_KEY || '').trim(),
    String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim(),
  ];

  const raw = String(process.env.SUPABASE_SECRET_KEYS || '').trim();
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed === 'string') keys.push(parsed);
      else if (Array.isArray(parsed)) keys.push(...parsed.filter((value) => typeof value === 'string'));
      else if (parsed && typeof parsed === 'object') {
        keys.push(...Object.values(parsed).filter((value): value is string => typeof value === 'string'));
      }
    } catch {}
  }

  return unique(keys);
}

function configuredSupabaseUrls() {
  // The browser creates signup users with VITE_SUPABASE_URL. Prefer it when
  // production still has a legacy SUPABASE_URL configured, but retain both so
  // existing server jobs continue to have a safe migration path.
  return unique([
    String(process.env.VITE_SUPABASE_URL || '').trim(),
    String(process.env.SUPABASE_URL || '').trim(),
  ]);
}

export function getSecretKey() {
  const serviceRole = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (serviceRole) return serviceRole;

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

  return '';
}

export function createSupabaseAdminCandidates() {
  const urls = configuredSupabaseUrls();
  const keys = configuredSecretKeys();
  if (!urls.length) throw new Error('Missing SUPABASE_URL (or VITE_SUPABASE_URL)');
  if (!keys.length) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY)');

  return urls.flatMap((url) =>
    keys.map((key) => ({
      url,
      client: createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
      }),
    })),
  );
}

export async function findSupabaseAdminForUser(userId: string, email?: string) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  let lastError: any = null;

  for (const candidate of createSupabaseAdminCandidates()) {
    const { data, error } = await candidate.client.auth.admin.getUserById(userId);
    const user = data?.user;
    if (error) lastError = error;
    if (!user) continue;
    if (normalizedEmail && String(user.email || '').trim().toLowerCase() !== normalizedEmail) continue;
    return { supabaseAdmin: candidate.client, authUser: user, error: null };
  }

  return { supabaseAdmin: null, authUser: null, error: lastError };
}

export function createSupabaseAdmin() {
  const supabaseUrl = requireEnv('SUPABASE_URL', ['VITE_SUPABASE_URL']);
  const secretKey = getSecretKey();
  if (!secretKey) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY)');
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
