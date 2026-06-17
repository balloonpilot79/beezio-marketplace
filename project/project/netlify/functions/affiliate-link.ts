import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

type ShareChannel = 'copy' | 'facebook' | 'sms' | 'email' | 'x' | 'whatsapp';
type ShareTargetType = 'product' | 'store' | 'collection';

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

function buildOrigin(event: any): string {
  const proto = String(event.headers['x-forwarded-proto'] || 'https');
  const host = String(event.headers.host || '');
  return `${proto}://${host}`;
}

function slugify(value: string): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
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

async function insertAffiliateLinkResilient(supabaseAdmin: any, payload: Record<string, any>) {
  let working = { ...payload };
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const { data, error } = await supabaseAdmin
      .from('affiliate_links')
      .insert(working)
      .select('*')
      .maybeSingle();
    if (!error) return { data, error: null };
    const code = String(error?.code || '').trim();
    if (code === '23505') return { data: null, error: null };
    const missing = extractMissingColumnName(String(error?.message || ''));
    if (missing && Object.prototype.hasOwnProperty.call(working, missing)) {
      delete (working as any)[missing];
      continue;
    }
    return { data: null, error };
  }
  return { data: null, error: new Error('Failed to insert affiliate link') };
}

async function resolveAffiliatePublicToken(supabaseAdmin: any, profileId: string): Promise<string> {
  try {
    const { data: storeSettings } = await supabaseAdmin
      .from('affiliate_store_settings')
      .select('subdomain, store_name')
      .eq('affiliate_id', profileId)
      .maybeSingle();
    const subdomain = slugify((storeSettings as any)?.subdomain || '');
    if (subdomain) return subdomain;
    const storeName = slugify((storeSettings as any)?.store_name || '');
    if (storeName) return storeName;
  } catch {
    // ignore
  }

  try {
    const { data: profileRow } = await supabaseAdmin
      .from('profiles')
      .select('referral_code, username, full_name, email')
      .eq('id', profileId)
      .maybeSingle();
    const candidates = [
      (profileRow as any)?.username,
      (profileRow as any)?.referral_code,
      (profileRow as any)?.full_name,
      String((profileRow as any)?.email || '').split('@')[0],
      profileId,
    ];
    for (const candidate of candidates) {
      const token = slugify(candidate || '');
      if (token) return token;
    }
  } catch {
    // ignore
  }

  return slugify(profileId) || profileId;
}

async function resolveProfileId(supabaseAdmin: any, userId: string): Promise<string | null> {
  try {
    const { data } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .or(`id.eq.${userId},user_id.eq.${userId}`)
      .maybeSingle();
    return (data as any)?.id ? String((data as any).id) : null;
  } catch {
    return null;
  }
}

async function isAffiliateUser(supabaseAdmin: any, userId: string, profileId: string | null): Promise<boolean> {
  try {
    const { data: roles } = await supabaseAdmin.from('user_roles').select('role').eq('user_id', userId);
    if (Array.isArray(roles) && roles.some((r: any) => String(r?.role || '').toLowerCase() === 'affiliate')) return true;
  } catch {
    // ignore
  }

  try {
    if (profileId) {
      const { data } = await supabaseAdmin
        .from('profiles')
        .select('role, primary_role')
        .eq('id', profileId)
        .maybeSingle();
      const primary = String((data as any)?.primary_role || '').toLowerCase();
      const role = String((data as any)?.role || '').toLowerCase();
      if (primary === 'affiliate' || role === 'affiliate') return true;
    }
  } catch {
    // ignore
  }

  return false;
}

export const handler: Handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
    const authHeader = String(event.headers.authorization || event.headers.Authorization || '').trim();
    if (!authHeader) return json(401, { error: 'Missing Authorization header' });

    const supabaseUrl = requireEnv('SUPABASE_URL', ['VITE_SUPABASE_URL']);
    const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
    const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

    const supabaseAuthed = createClient(supabaseUrl, anonKey || serviceRoleKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await supabaseAuthed.auth.getUser();
    if (userError || !userData?.user) return json(401, { error: 'Unauthorized', details: userError?.message });

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const body = event.body ? JSON.parse(event.body) : {};
    const targetType = String(body?.target_type || '').trim() as ShareTargetType;
    const targetId = String(body?.target_id || '').trim();
    const targetPath = body?.target_path ? String(body.target_path).trim() : null;
    const sellerId = body?.seller_id ? String(body.seller_id).trim() : null;
    const campaign = body?.campaign ? String(body.campaign).trim() : null;
    const source = String(body?.source || 'copy').trim() as ShareChannel;
    const title = body?.title ? String(body.title).trim() : null;

    if (!targetType || !targetId) return json(400, { error: 'Missing target_type/target_id' });

    const profileId = await resolveProfileId(supabaseAdmin, userData.user.id);
    if (!profileId) return json(400, { error: 'Missing profile id for user' });

    const allowed = await isAffiliateUser(supabaseAdmin, userData.user.id, profileId);
    if (!allowed) return json(403, { error: 'Not an affiliate' });

    const origin = buildOrigin(event);
    const publicToken = await resolveAffiliatePublicToken(supabaseAdmin, profileId);
    const internalLinkCode = targetType === 'product'
      ? `${publicToken}-${String(targetId).trim().slice(0, 8).toLowerCase()}`
      : publicToken;

    const utm = (() => {
      const parts: string[] = [];
      parts.push(`utm_source=${encodeURIComponent(source)}`);
      parts.push(`utm_medium=share`);
      if (campaign) parts.push(`utm_campaign=${encodeURIComponent(campaign)}`);
      return parts.join('&');
    })();

    const baseTargetUrl = (() => {
      if (targetPath && targetPath.startsWith('/')) {
        // Strip any query string if the client accidentally sends one.
        const safePath = targetPath.split('?')[0];
        return `${origin}${safePath}`;
      }
      switch (targetType) {
        case 'product':
          return `${origin}/product/${encodeURIComponent(targetId)}`;
        case 'store':
          // Default store route (seller store). For affiliate store, pass target_path from the client.
          return `${origin}/store/${encodeURIComponent(targetId)}`;
        case 'collection':
          return `${origin}/c/${encodeURIComponent(targetId)}`;
        default:
          return origin;
      }
    })();

    const fullUrl = `${baseTargetUrl}?ref=${encodeURIComponent(publicToken)}&code=${encodeURIComponent(publicToken)}&${utm}`;

    const insertPayload: any = {
      affiliate_id: profileId,
      product_id: targetType === 'product' ? targetId : null,
      link_code: internalLinkCode,
      full_url: fullUrl,
      is_active: true,
    };

    // Store metadata if the schema supports it (best-effort).
    insertPayload.custom_name = title ? `Share: ${title}` : null;

    // Try modern schema insert; fall back to legacy schema variants.
    let created: any = null;
    let insertError: any = null;
    ({ data: created, error: insertError } = await insertAffiliateLinkResilient(supabaseAdmin, insertPayload));

    if (insertError) {
      const legacyPayload: any = {
        affiliate_id: profileId,
        product_id: targetType === 'product' ? targetId : null,
        link_code: internalLinkCode,
        link_url: fullUrl,
        full_url: fullUrl,
        is_active: true,
        custom_name: title ? `Share: ${title}` : null,
      };
      const { data: legacy, error: legacyError } = await insertAffiliateLinkResilient(supabaseAdmin, legacyPayload);
      if (legacyError) return json(500, { error: 'Failed to create affiliate link', details: legacyError.message });
      created = legacy;
    }

    return json(200, {
      trackedUrl: String(created?.full_url || fullUrl),
      linkCode: publicToken,
      fullUrl: String(created?.full_url || fullUrl),
      campaign,
      source,
      targetType,
      targetId,
    });
  } catch (e) {
    return json(500, { error: 'Unexpected error', details: e instanceof Error ? e.message : String(e) });
  }
};
