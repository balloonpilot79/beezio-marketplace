import { supabase } from '../lib/supabase';

const looksLikeUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export async function resolveProfileIdForUser(userId: string): Promise<string> {
  const uid = String(userId || '').trim();
  if (!uid) return uid;

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', uid)
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
