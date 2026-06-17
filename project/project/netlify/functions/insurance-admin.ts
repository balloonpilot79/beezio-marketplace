import crypto from 'node:crypto';
import type { Handler } from '@netlify/functions';
import { json, parseJson } from './_lib/http';
import { requireAdmin } from './_lib/auth';
import { createSupabaseAdmin } from './_lib/supabase';

const sha256 = (value: string): string =>
  crypto.createHash('sha256').update(value).digest('hex');

const normalizeIpHash = (input: unknown): string => {
  const raw = String(input || '').trim();
  if (!raw) return '';
  if (/^[a-f0-9]{64}$/i.test(raw)) return raw.toLowerCase();
  return sha256(raw);
};

const INSURANCE_COMPLIANCE_PATTERNS: Array<{ code: string; label: string; pattern: RegExp }> = [
  { code: 'guaranteed_approval', label: 'Guaranteed approval claim', pattern: /\bguaranteed approval\b|\beveryone approved\b|\bapproved no matter what\b/i },
  { code: 'instant_coverage_claim', label: 'Instant coverage claim', pattern: /\binstant coverage\b|\bimmediate coverage guaranteed\b/i },
  { code: 'cold_lead_language', label: 'Cold lead / lead list language', pattern: /\bcold leads?\b|\blead list\b|\bbuy leads?\b|\bdata list\b/i },
  { code: 'spam_blast_language', label: 'Spam / blast wording', pattern: /\bmass text\b|\bblast\b|\brobo ?call\b|\bspam\b/i },
  { code: 'multi_agent_distribution', label: 'Multi-agent distribution claim', pattern: /\bmultiple agents\b|\ball agents\b|\bseveral agents\b|\bshared with agents\b|\bshop your lead around\b/i },
  { code: 'unlicensed_claim', label: 'Licensing or authority risk wording', pattern: /\bgovernment approved\b|\bfederal approval\b|\bstate approved plan\b/i },
];

const collectComplianceFlags = (listing: any) => {
  const text = [
    String(listing?.agency_name || ''),
    String(listing?.bio || ''),
    String(listing?.hero_title || ''),
    String(listing?.hero_subtitle || ''),
    String(listing?.disclaimer || ''),
    String(listing?.contact_name || ''),
  ].join(' ');

  const flags = INSURANCE_COMPLIANCE_PATTERNS
    .filter((entry) => entry.pattern.test(text))
    .map((entry) => ({ code: entry.code, label: entry.label }));

  if (!String(listing?.disclaimer || '').trim()) {
    flags.push({ code: 'missing_disclaimer', label: 'Missing insurance disclaimer' });
  }
  if (!String(listing?.contact_email || '').trim()) {
    flags.push({ code: 'missing_contact_email', label: 'Missing contact email' });
  }

  return flags;
};

export const handler: Handler = async (event) => {
  try {
    await requireAdmin(event as any);
    const supabaseAdmin = createSupabaseAdmin();
    const body = event.body ? parseJson<any>(event.body) : {};

    if (event.httpMethod === 'GET') {
      const [
        settingsRes,
        blockedIpsRes,
        affiliateProfilesRes,
        recentLeadsRes,
        campaignsRes,
        listingsRes,
      ] = await Promise.all([
        supabaseAdmin
          .from('insurance_admin_settings')
          .select('id,setting_key,setting_value,updated_at')
          .order('setting_key', { ascending: true }),
        supabaseAdmin
          .from('insurance_blocked_ips')
          .select('id,ip_hash,reason,expires_at,created_at')
          .order('created_at', { ascending: false })
          .limit(20),
        supabaseAdmin
          .from('insurance_affiliate_profiles')
          .select('id,affiliate_user_id,trust_tier,daily_valid_lead_cap,fraud_flag_count,payout_hold_days,updated_at')
          .order('fraud_flag_count', { ascending: false })
          .limit(20),
        supabaseAdmin
          .from('insurance_leads')
          .select('id,listing_id,affiliate_user_id,vertical,status,review_status,fraud_score,status_reason,created_at,delivered_at,lead_price_cents,affiliate_payout_cents,influencer_payout_cents,beezio_fee_cents,payload_json')
          .order('created_at', { ascending: false })
          .limit(20),
        supabaseAdmin
          .from('insurance_lead_campaigns')
          .select('id,listing_id,agent_user_id,vertical,status,cost_per_lead_cents,affiliate_payout_cents,updated_at')
          .order('updated_at', { ascending: false })
          .limit(20),
        supabaseAdmin
          .from('insurance_agent_listings')
          .select('id,agency_name,slug,bio,hero_title,hero_subtitle,disclaimer,contact_name,contact_email,is_active,accepts_new_leads,updated_at')
          .order('updated_at', { ascending: false })
          .limit(20),
      ]);

      if (settingsRes.error) return json(500, { ok: false, error: settingsRes.error.message });
      if (blockedIpsRes.error) return json(500, { ok: false, error: blockedIpsRes.error.message });
      if (affiliateProfilesRes.error) return json(500, { ok: false, error: affiliateProfilesRes.error.message });
      if (recentLeadsRes.error) return json(500, { ok: false, error: recentLeadsRes.error.message });
      if (campaignsRes.error) return json(500, { ok: false, error: campaignsRes.error.message });
      if (listingsRes.error) return json(500, { ok: false, error: listingsRes.error.message });

      const affiliateIds = Array.from(
        new Set((((affiliateProfilesRes.data as any[]) || []).map((row: any) => String(row?.affiliate_user_id || '').trim())).filter(Boolean))
      );
      const listingIds = Array.from(
        new Set(
          [
            ...(((recentLeadsRes.data as any[]) || []).map((row: any) => String(row?.listing_id || '').trim())),
            ...(((campaignsRes.data as any[]) || []).map((row: any) => String(row?.listing_id || '').trim())),
          ].filter(Boolean)
        )
      );

      const [profilesRes, listingLookupRes, leadCountsRes] = await Promise.all([
        affiliateIds.length > 0
          ? supabaseAdmin.from('profiles').select('id,full_name,email').in('id', affiliateIds)
          : Promise.resolve({ data: [], error: null }),
        listingIds.length > 0
          ? supabaseAdmin.from('insurance_agent_listings').select('id,agency_name,slug').in('id', listingIds)
          : Promise.resolve({ data: [], error: null }),
        supabaseAdmin.from('insurance_leads').select('id,status,review_status'),
      ]);

      if (profilesRes.error) return json(500, { ok: false, error: profilesRes.error.message });
      if (listingLookupRes.error) return json(500, { ok: false, error: listingLookupRes.error.message });
      if (leadCountsRes.error) return json(500, { ok: false, error: leadCountsRes.error.message });

      const profileMap = new Map<string, any>();
      for (const row of (profilesRes.data as any[]) || []) {
        profileMap.set(String(row?.id || '').trim(), row);
      }
      const listingMap = new Map<string, any>();
      for (const row of (listingLookupRes.data as any[]) || []) {
        listingMap.set(String(row?.id || '').trim(), row);
      }

      const allLeads = (leadCountsRes.data as any[]) || [];
      const overview = {
        total_leads: allLeads.length,
        delivered_leads: allLeads.filter((row: any) => String(row?.status || '').toLowerCase() === 'delivered').length,
        flagged_leads: allLeads.filter((row: any) => String(row?.review_status || '').toLowerCase() === 'flagged').length,
        rejected_leads: allLeads.filter((row: any) => String(row?.status || '').toLowerCase() === 'invalid').length,
        blocked_ip_count: ((blockedIpsRes.data as any[]) || []).length,
        out_of_funds_campaigns: ((campaignsRes.data as any[]) || []).filter((row: any) => String(row?.status || '').toLowerCase() === 'out_of_funds').length,
        flagged_listings: ((listingsRes.data as any[]) || []).filter((row: any) => collectComplianceFlags(row).length > 0).length,
      };

      return json(200, {
        ok: true,
        overview,
        settings: (settingsRes.data as any[]) || [],
        blocked_ips: (blockedIpsRes.data as any[]) || [],
        affiliate_profiles: ((affiliateProfilesRes.data as any[]) || []).map((row: any) => ({
          ...row,
          profile: profileMap.get(String(row?.affiliate_user_id || '').trim()) || null,
        })),
        recent_leads: ((recentLeadsRes.data as any[]) || []).map((row: any) => ({
          ...row,
          listing: listingMap.get(String(row?.listing_id || '').trim()) || null,
          affiliate_profile: profileMap.get(String(row?.affiliate_user_id || '').trim()) || null,
        })),
        listings: ((listingsRes.data as any[]) || []).map((row: any) => ({
          ...row,
          compliance_flags: collectComplianceFlags(row),
        })),
        campaigns: ((campaignsRes.data as any[]) || []).map((row: any) => ({
          ...row,
          listing: listingMap.get(String(row?.listing_id || '').trim()) || null,
        })),
      });
    }

    if (event.httpMethod !== 'POST') {
      return json(405, { ok: false, error: 'Method not allowed' });
    }

    const action = String(body?.action || '').trim().toLowerCase();

    if (action === 'update_setting') {
      const settingKey = String(body?.setting_key || '').trim();
      if (!settingKey) return json(400, { ok: false, error: 'setting_key is required.' });
      const { error } = await supabaseAdmin
        .from('insurance_admin_settings')
        .upsert({ setting_key: settingKey, setting_value: body?.setting_value ?? null }, { onConflict: 'setting_key' });
      if (error) return json(500, { ok: false, error: error.message });
      return json(200, { ok: true });
    }

    if (action === 'block_ip') {
      const ipHash = normalizeIpHash(body?.ip_or_hash || body?.ip_hash);
      if (!ipHash) return json(400, { ok: false, error: 'ip_or_hash is required.' });
      const { error } = await supabaseAdmin
        .from('insurance_blocked_ips')
        .upsert({
          ip_hash: ipHash,
          reason: String(body?.reason || '').trim() || 'Admin blocked',
          expires_at: body?.expires_at ? new Date(body.expires_at).toISOString() : null,
        }, { onConflict: 'ip_hash' });
      if (error) return json(500, { ok: false, error: error.message });
      return json(200, { ok: true, ip_hash: ipHash });
    }

    if (action === 'unblock_ip') {
      const blockId = String(body?.block_id || '').trim();
      if (!blockId) return json(400, { ok: false, error: 'block_id is required.' });
      const { error } = await supabaseAdmin.from('insurance_blocked_ips').delete().eq('id', blockId);
      if (error) return json(500, { ok: false, error: error.message });
      return json(200, { ok: true });
    }

    if (action === 'update_affiliate_profile') {
      const affiliateUserId = String(body?.affiliate_user_id || '').trim();
      if (!affiliateUserId) return json(400, { ok: false, error: 'affiliate_user_id is required.' });
      const payload = {
        affiliate_user_id: affiliateUserId,
        trust_tier: String(body?.trust_tier || 'new').trim() || 'new',
        daily_valid_lead_cap: Math.max(1, Math.floor(Number(body?.daily_valid_lead_cap || 5))),
        payout_hold_days: Math.max(0, Math.floor(Number(body?.payout_hold_days || 7))),
        fraud_flag_count: Math.max(0, Math.floor(Number(body?.fraud_flag_count || 0))),
      };
      const { error } = await supabaseAdmin
        .from('insurance_affiliate_profiles')
        .upsert(payload, { onConflict: 'affiliate_user_id' });
      if (error) return json(500, { ok: false, error: error.message });
      return json(200, { ok: true });
    }

    return json(400, { ok: false, error: 'Unsupported action.' });
  } catch (error: any) {
    return json(Number(error?.statusCode) || 500, { ok: false, error: error?.message || 'Unexpected error' });
  }
};

export default handler;
