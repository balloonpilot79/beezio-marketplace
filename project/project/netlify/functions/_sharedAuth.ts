import { createClient } from '@supabase/supabase-js';

export function json(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

export function requireEnv(name: string, fallbacks: string[] = []): string {
  const keys = [name, ...fallbacks];
  for (const key of keys) {
    const value = String(process.env[key] || '').trim();
    if (value) return value;
  }
  throw new Error(`Missing ${name}${fallbacks.length ? ` (or ${fallbacks.join(', ')})` : ''}`);
}

export async function getAuthedUser(params: { supabaseUrl: string; anonKey: string; authHeader: string }) {
  const supabaseAuthed = createClient(params.supabaseUrl, params.anonKey, {
    global: { headers: { Authorization: params.authHeader } },
  });
  const { data, error } = await supabaseAuthed.auth.getUser();
  if (error || !data?.user) return { user: null, error: error?.message || 'Unauthorized' };
  return { user: data.user, error: null };
}

export async function isAdminUser(params: { supabaseUrl: string; serviceRoleKey: string; userId: string }): Promise<boolean> {
  const supabaseAdmin = createClient(params.supabaseUrl, params.serviceRoleKey);
  try {
    const { data } = await supabaseAdmin.from('user_roles').select('role,is_active').eq('user_id', params.userId).limit(50);
    const roles = (data as any[]) || [];
    return roles.some((r) => String(r?.role || '').toLowerCase() === 'admin' && r?.is_active !== false);
  } catch {
    return false;
  }
}

