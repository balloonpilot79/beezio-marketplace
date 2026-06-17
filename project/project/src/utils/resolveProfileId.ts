import { supabase } from '../lib/supabase';

const looksLikeUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const extractMissingColumnName = (message: string): string | null => {
  const msg = String(message || '');
  const pg = msg.match(/column\s+"([^"]+)"\s+of\s+relation\s+"[^"]+"\s+does\s+not\s+exist/i);
  if (pg?.[1]) return pg[1];
  const pgDot = msg.match(/column\s+([a-z0-9_]+\.[a-z0-9_]+)\s+does\s+not\s+exist/i);
  if (pgDot?.[1]) return pgDot[1].split('.').pop() || pgDot[1];
  const pgrst = msg.match(/Could not find the '([^']+)' column of '[^']+' in the schema cache/i);
  if (pgrst?.[1]) return pgrst[1];
  return null;
};

export async function resolveProfileIdForUser(userId: string): Promise<string> {
  const uid = String(userId || '').trim();
  if (!uid) return uid;

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .or(`id.eq.${uid},user_id.eq.${uid}`)
      .limit(1)
      .maybeSingle();

    if (!error && data?.id) return String(data.id);
  } catch {
    // ignore
  }

  // Fallback for schemas where profiles.id == auth.users.id
  if (looksLikeUuid(uid)) return uid;

  return uid;
}

type MinimalUser = {
  id: string;
  email?: string | null;
  user_metadata?: { full_name?: string; name?: string } | null;
};

export async function ensureProfileIdForUser(user: MinimalUser): Promise<string> {
  const uid = String(user?.id || '').trim();
  if (!uid) return uid;

  const existing = await resolveProfileIdForUser(uid);
  if (existing && existing !== uid) return existing;

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', uid)
      .maybeSingle();

    if (!error && data?.id) return String(data.id);
  } catch {
    // ignore
  }

  const fullName =
    (user?.user_metadata?.full_name || user?.user_metadata?.name || '').toString();

  const insertWithColumnHealing = async (payload: Record<string, unknown>): Promise<string | null> => {
    const working = { ...payload };
    let lastError: any = null;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const { data, error } = await supabase
        .from('profiles')
        .insert(working)
        .select('id')
        .maybeSingle();
      if (!error) {
        const createdId = String((data as any)?.id || '').trim();
        return createdId || null;
      }
      lastError = error;
      const missing = extractMissingColumnName(String((error as any)?.message || ''));
      if (missing && Object.prototype.hasOwnProperty.call(working, missing)) {
        delete (working as any)[missing];
        continue;
      }
      break;
    }

    const message = String((lastError as any)?.message || '').toLowerCase();
    if (message.includes('duplicate') || message.includes('unique')) {
      const resolved = await resolveProfileIdForUser(uid);
      if (resolved) return resolved;
    }

    return null;
  };

  const payloads = [
    { id: uid, user_id: uid, email: user?.email || null, full_name: fullName },
    { id: uid, email: user?.email || null, full_name: fullName },
    { user_id: uid, email: user?.email || null, full_name: fullName },
  ];

  for (const payload of payloads) {
    const created = await insertWithColumnHealing(payload);
    if (created) return created;
  }

  return uid;
}
