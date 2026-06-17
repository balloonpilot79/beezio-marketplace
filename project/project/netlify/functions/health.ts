import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

function json(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      // Never cache health/preflight.
      'Cache-Control': 'no-store',
    },
    body: JSON.stringify(body),
  };
}

function hasEnv(name: string, fallbacks: string[] = []) {
  const keys = [name, ...fallbacks];
  for (const key of keys) {
    const value = String(process.env[key] || '').trim();
    if (value) return { ok: true, key };
  }
  return { ok: false, key: name };
}

const handler: Handler = async (event) => {
  // This endpoint is intentionally non-sensitive: it only reports presence/absence.
  // If you want to lock it down later, add a shared secret header check here.
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

  const checks = {
    supabaseUrl: hasEnv('SUPABASE_URL', ['VITE_SUPABASE_URL']),
    supabaseAnonKey: hasEnv('SUPABASE_ANON_KEY', ['VITE_SUPABASE_ANON_KEY']),
    supabaseServiceRoleKey: hasEnv('SUPABASE_SERVICE_ROLE_KEY'),
    cjApiKey: hasEnv('CJ_API_KEY'),
  };

  const connectivity: Record<string, any> = {
    supabase: null,
  };

  // Best-effort: confirm Supabase reachable with anon key.
  if (supabaseUrl && anonKey) {
    try {
      const supabase = createClient(supabaseUrl, anonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data, error } = await supabase.from('profiles').select('id').limit(1);
      connectivity.supabase = {
        ok: !error,
        error: error ? (error.message || String(error)) : null,
        sampleRows: Array.isArray(data) ? data.length : 0,
      };
    } catch (e) {
      connectivity.supabase = { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  } else {
    connectivity.supabase = { ok: false, error: 'Missing SUPABASE_URL/SUPABASE_ANON_KEY' };
  }

  const allCriticalPresent =
    checks.supabaseUrl.ok &&
    checks.supabaseServiceRoleKey.ok;

  const ok = Boolean(allCriticalPresent && connectivity.supabase?.ok);

  return json(ok ? 200 : 503, {
    ok,
    now: new Date().toISOString(),
    checks,
    connectivity,
  });
};

export { handler };
