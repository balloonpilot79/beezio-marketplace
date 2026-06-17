import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

type Json = Record<string, any> | any[] | null;

async function resolveSession(existing: Session | null): Promise<Session | null> {
  if (existing?.access_token) return existing;
  const { data } = await supabase.auth.getSession();
  if (data?.session?.access_token) return data.session;
  const refreshed = await supabase.auth.refreshSession();
  return refreshed.data?.session ?? null;
}

export async function apiPost<T = any>(path: string, session: Session | null, body?: Json): Promise<T> {
  let activeSession = await resolveSession(session);
  const payload =
    body && typeof body === 'object' && !Array.isArray(body)
      ? { ...body, _access_token: (body as Record<string, any>)._access_token ?? activeSession?.access_token }
      : body ?? {};
  const res = await fetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(activeSession?.access_token ? { Authorization: `Bearer ${activeSession.access_token}` } : {}),
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text().catch(() => '');
  let parsed: any = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = null;
  }
  if (!res.ok) {
    if (res.status === 401) {
      activeSession = await resolveSession(null);
      if (activeSession?.access_token) {
        const retryPayload =
          payload && typeof payload === 'object' && !Array.isArray(payload)
            ? { ...payload, _access_token: activeSession.access_token }
            : payload ?? {};
        const retry = await fetch(path, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${activeSession.access_token}`,
          },
          body: JSON.stringify(retryPayload),
        });
        const retryText = await retry.text().catch(() => '');
        let retryParsed: any = null;
        try {
          retryParsed = retryText ? JSON.parse(retryText) : null;
        } catch {
          retryParsed = null;
        }
        if (retry.ok) return retryParsed as T;
        const retryMsg =
          String((retryParsed as any)?.error || retry.statusText) +
          (typeof (retryParsed as any)?.details === 'string' && String((retryParsed as any).details).trim()
            ? `: ${String((retryParsed as any).details).trim()}`
            : '');
        const retryErr: any = new Error(retryMsg);
        retryErr.status = retry.status;
        retryErr.body = retryParsed;
        throw retryErr;
      }
    }
    const msg =
      String((parsed as any)?.error || res.statusText) +
      (typeof (parsed as any)?.details === 'string' && String((parsed as any).details).trim()
        ? `: ${String((parsed as any).details).trim()}`
        : '');
    const err: any = new Error(msg);
    err.status = res.status;
    err.body = parsed;
    throw err;
  }
  return parsed as T;
}
