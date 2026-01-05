import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

type ShareChannel = 'copy' | 'facebook' | 'sms' | 'email' | 'x' | 'whatsapp';
type ShareTargetType = 'product' | 'store' | 'collection' | 'fundraiser';

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

function randomCode(len: number): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < len; i++) out += chars.charAt(Math.floor(Math.random() * chars.length));
  return out;
}

async function generateLinkCode(supabaseAdmin: any): Promise<string> {
  try {
    const { data, error } = await supabaseAdmin.rpc('generate_affiliate_link_code');
    if (!error && data) return String(data);
  } catch {
    // ignore
  }

  // Fallback: random with collision check (best-effort).
  for (let attempt = 0; attempt < 6; attempt++) {
    const candidate = randomCode(8);
    try {
      const { data } = await supabaseAdmin
        .from('affiliate_links')
        .select('id')
        .eq('link_code', candidate)
        .limit(1)
        .maybeSingle();
      if (!data) return candidate;
    } catch {
      return candidate;
    }
  }
  return randomCode(10);
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
    const linkCode = await generateLinkCode(supabaseAdmin);

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
        case 'fundraiser':
          return `${origin}/fundraiser/${encodeURIComponent(targetId)}`;
        default:
          return origin;
      }
    })();

    const fullUrl = `${baseTargetUrl}?ref=${encodeURIComponent(profileId)}&code=${encodeURIComponent(linkCode)}&${utm}`;

    const insertPayload: any = {
      affiliate_id: profileId,
      product_id: targetType === 'product' ? targetId : null,
      link_code: linkCode,
      full_url: fullUrl,
      is_active: true,
    };

    // Store metadata if the schema supports it (best-effort).
    insertPayload.custom_name = title ? `Share: ${title}` : null;

    // Try modern schema insert; fall back to legacy schema variants.
    let created: any = null;
    let insertError: any = null;
    ({ data: created, error: insertError } = await supabaseAdmin
      .from('affiliate_links')
      .insert(insertPayload)
      .select('link_code, full_url')
      .maybeSingle());

    if (insertError) {
      const legacyPayload: any = {
        affiliate_id: profileId,
        product_id: targetType === 'product' ? targetId : null,
        link_code: linkCode,
        link_url: `${origin}/af/${encodeURIComponent(linkCode)}`,
        full_url: fullUrl,
        is_active: true,
        custom_name: title ? `Share: ${title}` : null,
      };
      const { data: legacy, error: legacyError } = await supabaseAdmin
        .from('affiliate_links')
        .insert(legacyPayload)
        .select('link_code, full_url')
        .maybeSingle();
      if (legacyError) return json(500, { error: 'Failed to create affiliate link', details: legacyError.message });
      created = legacy;
    }

    return json(200, {
      trackedUrl: `${origin}/af/${encodeURIComponent(String(created?.link_code || linkCode))}`,
      linkCode: String(created?.link_code || linkCode),
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
