import type { Session } from '@supabase/supabase-js';

type Json = Record<string, any> | any[] | null;

export async function apiPost<T = any>(path: string, session: Session | null, body?: Json): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    },
    body: JSON.stringify(body ?? {}),
  });

  const text = await res.text().catch(() => '');
  const parsed = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const err: any = new Error((parsed as any)?.error || res.statusText);
    err.status = res.status;
    err.body = parsed;
    throw err;
  }
  return parsed as T;
}

