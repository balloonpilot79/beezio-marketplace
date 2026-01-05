import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

function json(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

function requireEnv(name: string, fallbacks: string[] = []): string {
  const keys = [name, ...fallbacks];
  for (const key of keys) {
    const value = String(process.env[key] || '').trim();
    if (value) return value;
  }
  throw new Error(`Missing ${name}${fallbacks.length ? ` (or ${fallbacks.join(', ')})` : ''}`);
}

export const handler: Handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
    const authHeader = String(event.headers.authorization || event.headers.Authorization || '').trim();
    if (!authHeader) return json(401, { error: 'Missing Authorization header' });

    const supabaseUrl = requireEnv('SUPABASE_URL', ['VITE_SUPABASE_URL']);
    const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
    const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

    // Validate caller (best-effort; logs are non-sensitive but should not be public spam).
    const supabaseAuthed = createClient(supabaseUrl, anonKey || serviceRoleKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await supabaseAuthed.auth.getUser();
    if (userError || !userData?.user) return json(401, { error: 'Unauthorized', details: userError?.message });

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const body = event.body ? JSON.parse(event.body) : {};
    const payload = {
      affiliate_id: body?.affiliate_id ?? null,
      target_type: String(body?.target_type || '').trim() || null,
      target_id: String(body?.target_id || '').trim() || null,
      channel: String(body?.channel || '').trim() || null,
      campaign: body?.campaign ? String(body.campaign).trim() : null,
      ts: body?.ts ? String(body.ts).trim() : new Date().toISOString(),
      user_agent: String(event.headers['user-agent'] || ''),
      referrer: String(event.headers.referer || event.headers.referrer || ''),
    };

    if (!payload.target_type || !payload.target_id || !payload.channel) {
      return json(400, { error: 'Missing target_type/target_id/channel' });
    }

    // Best-effort insert; if table isn't deployed yet, don't break sharing.
    try {
      const { error } = await supabaseAdmin.from('affiliate_share_clicks').insert(payload as any);
      if (error) {
        return json(200, { ok: false, skipped: true, details: error.message });
      }
    } catch (e: any) {
      return json(200, { ok: false, skipped: true, details: e?.message || String(e) });
    }

    return json(200, { ok: true });
  } catch (e) {
    return json(500, { error: 'Unexpected error', details: e instanceof Error ? e.message : String(e) });
  }
};
