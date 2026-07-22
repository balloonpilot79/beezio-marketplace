import { createSupabaseAuthed, createSupabaseAdmin } from './supabase';
import { requireEnv } from './env';
import { buildAdminEmailAllowlist } from '../../../shared/adminAccess';

export function buildAuthHeader(input: string | null | undefined): string {
  const raw = String(input || '').trim();
  if (!raw) return '';
  return raw.startsWith('Bearer ') ? raw : `Bearer ${raw}`;
}

export function extractAuthHeader(event: { headers: Record<string, string | undefined>; body?: string | null }): string {
  const headerToken = String(event.headers.authorization || event.headers.Authorization || '').trim();
  if (headerToken) return buildAuthHeader(headerToken);
  if (!event.body) return '';
  try {
    const body = JSON.parse(event.body || '{}');
    const bodyToken = String(body?._access_token || body?.access_token || '').trim();
    return buildAuthHeader(bodyToken);
  } catch {
    return '';
  }
}

export async function getAuthedUser(authHeader: string) {
  const supabaseUrl = requireEnv('SUPABASE_URL', ['VITE_SUPABASE_URL']);
  const supabase = createSupabaseAuthed(authHeader);
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) return { user: null, error: error?.message || 'Unauthorized' };
  return { user: data.user, error: null, supabaseUrl };
}

export function assertEmailVerified(user: { email?: string | null; email_confirmed_at?: string | null; confirmed_at?: string | null }) {
  const email = String(user?.email || '').trim();
  const confirmedAt = String(user?.email_confirmed_at || user?.confirmed_at || '').trim();
  if (!email || !confirmedAt) {
    const err: any = new Error('Confirm your email before using seller, affiliate, or promotional product tools.');
    err.statusCode = 403;
    err.code = 'EMAIL_NOT_VERIFIED';
    throw err;
  }
}

async function tryResolveProfileId(supabaseAdmin: any, userId: string, mode: 'user_id' | 'id' | 'or') {
  let query = supabaseAdmin.from('profiles').select('id');
  if (mode === 'user_id') query = query.eq('user_id', userId);
  if (mode === 'id') query = query.eq('id', userId);
  if (mode === 'or') query = query.or(`id.eq.${userId},user_id.eq.${userId}`);
  const { data, error } = await query.maybeSingle();
  if (error || !data) return null;
  const id = String((data as any)?.id || '').trim();
  return id || null;
}

function extractMissingColumnName(message: string): string | null {
  const msg = String(message || '');
  const pg = msg.match(/column\s+"([^"]+)"\s+of\s+relation\s+"[^"]+"\s+does\s+not\s+exist/i);
  if (pg?.[1]) return pg[1];
  const pgDot = msg.match(/column\s+([a-z0-9_]+\.[a-z0-9_]+)\s+does\s+not\s+exist/i);
  if (pgDot?.[1]) return pgDot[1].split('.').pop() || pgDot[1];
  const pgrst = msg.match(/Could not find the '([^']+)' column of '[^']+' in the schema cache/i);
  if (pgrst?.[1]) return pgrst[1];
  return null;
}

export async function resolveProfileId(user: { id?: string; email?: string | null; user_metadata?: any }) {
  const supabaseAdmin = createSupabaseAdmin();
  const userId = String(user?.id || '').trim();
  if (!userId) return null;

  const existing =
    (await tryResolveProfileId(supabaseAdmin, userId, 'or')) ||
    (await tryResolveProfileId(supabaseAdmin, userId, 'user_id')) ||
    (await tryResolveProfileId(supabaseAdmin, userId, 'id'));
  if (existing) return existing;

  const email = user.email || null;
  const metadata: any = user.user_metadata || {};
  const fullName = metadata.full_name || metadata.name || null;

  const insertWithColumnHealing = async (payload: any): Promise<string | null> => {
    const working = { ...payload };
    let lastError: any = null;
    for (let attempt = 0; attempt < 6; attempt++) {
      const { data, error } = await supabaseAdmin
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
        delete working[missing];
        continue;
      }
      break;
    }
    const message = String((lastError as any)?.message || '').toLowerCase();
    if (message.includes('duplicate') || message.includes('unique')) {
      const resolved =
        (await tryResolveProfileId(supabaseAdmin, userId, 'or')) ||
        (await tryResolveProfileId(supabaseAdmin, userId, 'user_id')) ||
        (await tryResolveProfileId(supabaseAdmin, userId, 'id'));
      if (resolved) return resolved;
    }
    return null;
  };

  const payloads = [
    { id: userId, user_id: userId, email, full_name: fullName },
    { id: userId, email, full_name: fullName },
    { user_id: userId, email, full_name: fullName },
  ];

  for (const payload of payloads) {
    const created = await insertWithColumnHealing(payload);
    if (created) return created;
  }

  return userId;
}

export async function resolveAuthUserIdFromProfileId(profileOrUserId: string | null | undefined) {
  const rawId = String(profileOrUserId || '').trim();
  if (!rawId) return null;

  const supabaseAdmin = createSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id,user_id')
    .or(`id.eq.${rawId},user_id.eq.${rawId}`)
    .limit(1)
    .maybeSingle();

  if (error) return null;
  const authUserId = String((data as any)?.user_id || '').trim();
  if (authUserId) return authUserId;

  const profileId = String((data as any)?.id || '').trim();
  return profileId || rawId;
}

export async function requireAdmin(event: { headers: Record<string, string | undefined>; body?: string | null }) {
  const authHeader = extractAuthHeader(event);
  if (!authHeader) {
    const err: any = new Error('Unauthorized');
    err.statusCode = 401;
    throw err;
  }

  const { user, error } = await getAuthedUser(authHeader);
  if (!user || error) {
    const err: any = new Error(error || 'Unauthorized');
    err.statusCode = 401;
    throw err;
  }

  const supabaseAdmin = createSupabaseAdmin();
  const profileId = (await resolveProfileId(user as any)) || String(user.id);

  let isAdmin = false;
  try {
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id,user_id,role,primary_role')
      .or(`id.eq.${profileId},user_id.eq.${user.id}`)
      .limit(1)
      .maybeSingle();

    const role = String((profile as any)?.primary_role || (profile as any)?.role || '').toLowerCase();
    if (role === 'admin') isAdmin = true;
  } catch {
    // ignore profile lookup failure; we'll fall back to user_roles
  }

  if (!isAdmin) {
    try {
      const { data: roles } = await supabaseAdmin
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('is_active', true);
      if (Array.isArray(roles) && roles.some((r: any) => String(r?.role || '').toLowerCase() === 'admin')) {
        isAdmin = true;
      }
    } catch {
      // ignore
    }
  }

  if (!isAdmin) {
    const userEmail = String((user as any)?.email || '').trim().toLowerCase();
    const allowList = buildAdminEmailAllowlist(process.env.ADMIN_EMAILS);
    if (userEmail && allowList.includes(userEmail)) {
      isAdmin = true;
    }
  }

  if (!isAdmin) {
    const err: any = new Error('Forbidden');
    err.statusCode = 403;
    throw err;
  }

  return { userId: user.id, profileId };
}

export async function requireSellerOrAdmin(event: { headers: Record<string, string | undefined>; body?: string | null }) {
  const authHeader = extractAuthHeader(event);
  if (!authHeader) {
    const err: any = new Error('Unauthorized');
    err.statusCode = 401;
    throw err;
  }

  const { user, error } = await getAuthedUser(authHeader);
  if (!user || error) {
    const err: any = new Error(error || 'Unauthorized');
    err.statusCode = 401;
    throw err;
  }

  const supabaseAdmin = createSupabaseAdmin();
  const profileId = (await resolveProfileId(user as any)) || String(user.id);

  let accessRole = '';
  try {
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id,user_id,role,primary_role')
      .or(`id.eq.${profileId},user_id.eq.${user.id}`)
      .limit(1)
      .maybeSingle();

    accessRole = String((profile as any)?.primary_role || (profile as any)?.role || '').toLowerCase();
  } catch {
    // ignore profile lookup failure; we'll fall back to user_roles
  }

  if (!accessRole) {
    try {
      const { data: roles } = await supabaseAdmin
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('is_active', true);
      const normalizedRoles = Array.isArray(roles)
        ? roles.map((r: any) => String(r?.role || '').toLowerCase())
        : [];
      if (normalizedRoles.includes('admin')) accessRole = 'admin';
      else if (normalizedRoles.includes('seller')) accessRole = 'seller';
    } catch {
      // ignore
    }
  }

  if (!accessRole) {
    const userEmail = String((user as any)?.email || '').trim().toLowerCase();
    const allowList = buildAdminEmailAllowlist(process.env.ADMIN_EMAILS);
    if (userEmail && allowList.includes(userEmail)) {
      accessRole = 'admin';
    }
  }

  if (accessRole !== 'admin' && accessRole !== 'seller') {
    const err: any = new Error('Forbidden');
    err.statusCode = 403;
    throw err;
  }

  return { userId: user.id, profileId, accessRole };
}

export async function requireAuthenticatedProfile(event: { headers: Record<string, string | undefined>; body?: string | null }) {
  const authHeader = extractAuthHeader(event);
  if (!authHeader) {
    const err: any = new Error('Unauthorized');
    err.statusCode = 401;
    throw err;
  }

  const { user, error } = await getAuthedUser(authHeader);
  if (!user || error) {
    const err: any = new Error(error || 'Unauthorized');
    err.statusCode = 401;
    throw err;
  }

  const profileId = (await resolveProfileId(user as any)) || String(user.id || '').trim();
  return { userId: String(user.id || '').trim(), profileId };
}
