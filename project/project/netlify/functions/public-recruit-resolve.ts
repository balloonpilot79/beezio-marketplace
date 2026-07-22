import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

function json(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=86400',
    },
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

const isUuid = (value: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const parseDeterministicReferralCodeToUuid = (value: string): string | null => {
  const trimmed = String(value || '').trim().toUpperCase();
  const match = trimmed.match(/^BZO([0-9A-F]{32})$/);
  if (!match?.[1]) return null;
  const hex = match[1];
  const uuid = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`.toLowerCase();
  return isUuid(uuid) ? uuid : null;
};

const slugify = (value: string): string =>
  String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);

const normalizeRecruitCode = (input: string): string => {
  const raw = String(input || '').trim();
  if (!raw) return '';

  let candidate = raw;
  if (/^https?:\/\//i.test(candidate)) {
    try {
      const parsed = new URL(candidate);
      const fromQuery =
        parsed.searchParams.get('code') ||
        parsed.searchParams.get('recruit') ||
        parsed.searchParams.get('influencer') ||
        parsed.searchParams.get('ic') ||
        parsed.searchParams.get('ref') ||
        '';
      candidate = String(fromQuery || '').trim() || candidate;
    } catch {
      // keep raw candidate
    }
  }

  try {
    candidate = decodeURIComponent(candidate);
  } catch {
    // keep undecoded value
  }

  return candidate
    .trim()
    .replace(/^['"`]+|['"`]+$/g, '')
    .replace(/\/$/, '');
};

async function loadActiveInfluencerProfile(supabaseAdmin: any, profileId: string) {
  const id = String(profileId || '').trim();
  if (!id) return null;

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('id,user_id,full_name,role,primary_role')
    .eq('id', id)
    .maybeSingle();

  if (!(profile as any)?.id) return null;
  const directInfluencer = ['role', 'primary_role'].some(
    (column) => String((profile as any)?.[column] || '').trim().toLowerCase() === 'influencer'
  );
  if (directInfluencer) return profile as any;

  const userId = String((profile as any)?.user_id || '').trim();
  if (!userId) return null;
  const { data: roleRow } = await supabaseAdmin
    .from('user_roles')
    .select('user_id')
    .eq('user_id', userId)
    .eq('role', 'influencer')
    .eq('is_active', true)
    .maybeSingle();

  return (roleRow as any)?.user_id ? profile as any : null;
}

const handler: Handler = async (event) => {
  try {
    const codeRaw = String(
      event.queryStringParameters?.code ||
      event.queryStringParameters?.recruit ||
      event.queryStringParameters?.influencer ||
      ''
    ).trim();
    const code = normalizeRecruitCode(codeRaw);

    if (!code) return json(400, { ok: false, valid: false, error: 'Missing code' });

    const supabaseUrl = requireEnv('SUPABASE_URL', ['VITE_SUPABASE_URL']);
    const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const profileFilters = [`referral_code.ilike.${code}`];
    if (isUuid(code)) {
      profileFilters.push(`id.eq.${code}`);
      profileFilters.push(`user_id.eq.${code}`);
    }

    const deterministicUuid = parseDeterministicReferralCodeToUuid(code);
    if (deterministicUuid) {
      profileFilters.push(`id.eq.${deterministicUuid}`);
      profileFilters.push(`user_id.eq.${deterministicUuid}`);
    }

    const { data: profileRows, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id,full_name')
      .or(profileFilters.join(','))
      .limit(1);

    if (!profileError && Array.isArray(profileRows) && profileRows[0]?.id) {
      const row = profileRows[0] as any;
      const influencer = await loadActiveInfluencerProfile(supabaseAdmin, String(row.id));
      if (influencer) {
        return json(200, {
          ok: true,
          valid: true,
          referrerProfileId: String(influencer.id),
          referrerName: String(influencer.full_name || 'this influencer'),
        });
      }
    }

    // Compatibility fallback: older schemas include `profiles.username`.
    // Newer schemas may not have that column, so this query must be isolated.
    try {
      const { data: byUsername, error: usernameError } = await supabaseAdmin
        .from('profiles')
        .select('id,full_name,username')
        .ilike('username', code)
        .limit(1);

      if (!usernameError && Array.isArray(byUsername) && byUsername[0]?.id) {
        const row = byUsername[0] as any;
        const influencer = await loadActiveInfluencerProfile(supabaseAdmin, String(row.id));
        if (influencer) {
          return json(200, {
            ok: true,
            valid: true,
            referrerProfileId: String(influencer.id),
            referrerName: String(influencer.full_name || row.username || 'this influencer'),
          });
        }
      }
    } catch {
      // Ignore missing-column errors on deployments without profiles.username.
    }

    const normalizedCode = code.toLowerCase();
    const [affiliateStoreRes, affiliateSettingsRes] = await Promise.all([
      supabaseAdmin
        .from('affiliate_stores')
        .select('profile_id,store_name,store_slug')
        .eq('store_slug', normalizedCode)
        .maybeSingle(),
      supabaseAdmin
        .from('affiliate_store_settings')
        .select('affiliate_id,subdomain')
        .eq('subdomain', normalizedCode)
        .maybeSingle(),
    ]);

    const storeProfileId = String((affiliateStoreRes.data as any)?.profile_id || '').trim();
    if (storeProfileId) {
      const influencer = await loadActiveInfluencerProfile(supabaseAdmin, storeProfileId);
      if (influencer) {
        return json(200, {
          ok: true,
          valid: true,
          referrerProfileId: storeProfileId,
          referrerName: String(
            influencer.full_name ||
            (affiliateStoreRes.data as any)?.store_name ||
            (affiliateStoreRes.data as any)?.store_slug ||
            'this influencer'
          ),
        });
      }
    }

    const settingsProfileId = String((affiliateSettingsRes.data as any)?.affiliate_id || '').trim();
    if (settingsProfileId) {
      const influencer = await loadActiveInfluencerProfile(supabaseAdmin, settingsProfileId);
      if (influencer) {
        return json(200, {
          ok: true,
          valid: true,
          referrerProfileId: settingsProfileId,
          referrerName: String(influencer.full_name || (affiliateSettingsRes.data as any)?.subdomain || 'this influencer'),
        });
      }
    }

    // Backward-compatibility fallback:
    // older invite links can be built from slugified affiliate_stores.store_name.
    const storeNameLike = normalizedCode.replace(/-/g, '%');
    const { data: storeNameCandidates } = await supabaseAdmin
      .from('affiliate_stores')
      .select('profile_id,store_name,store_slug')
      .ilike('store_name', `%${storeNameLike}%`)
      .limit(25);

    const slugMatchedRow = (Array.isArray(storeNameCandidates) ? storeNameCandidates : []).find((row: any) => {
      const candidateName = String(row?.store_name || '').trim();
      return candidateName && slugify(candidateName) === normalizedCode;
    });

    const slugMatchedProfileId = String((slugMatchedRow as any)?.profile_id || '').trim();
    if (slugMatchedProfileId) {
      const influencer = await loadActiveInfluencerProfile(supabaseAdmin, slugMatchedProfileId);
      if (influencer) {
        return json(200, {
          ok: true,
          valid: true,
          referrerProfileId: slugMatchedProfileId,
          referrerName: String(
            influencer.full_name ||
            (slugMatchedRow as any)?.store_name ||
            (slugMatchedRow as any)?.store_slug ||
            'this influencer'
          ),
        });
      }
    }

    return json(200, { ok: true, valid: false });
  } catch (e) {
    return json(500, {
      ok: false,
      valid: false,
      error: 'Unexpected error',
      details: e instanceof Error ? e.message : String(e),
    });
  }
};

export { handler };
