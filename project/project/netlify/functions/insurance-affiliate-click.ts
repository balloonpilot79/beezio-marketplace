import crypto from 'node:crypto';
import type { Handler } from '@netlify/functions';
import { json, parseJson } from './_lib/http';
import { createSupabaseAdmin } from './_lib/supabase';

const isUuid = (value: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const sha256 = (value: string): string =>
  crypto.createHash('sha256').update(value).digest('hex');

const getIpAddress = (event: any): string => {
  const candidates = [
    event.headers['x-nf-client-connection-ip'],
    event.headers['client-ip'],
    event.headers['x-forwarded-for'],
    event.headers['x-real-ip'],
  ];
  for (const candidate of candidates) {
    const raw = String(candidate || '').split(',')[0].trim();
    if (raw) return raw;
  }
  return 'unknown';
};

const resolveAffiliateId = async (supabaseAdmin: any, rawValue: string): Promise<string | null> => {
  const raw = String(rawValue || '').trim();
  if (!raw) return null;

  if (isUuid(raw)) {
    const { data } = await supabaseAdmin
      .from('profiles')
      .select('id,role,primary_role')
      .or(`id.eq.${raw},user_id.eq.${raw}`)
      .maybeSingle();
    const id = String((data as any)?.id || raw).trim();
    const role = String((data as any)?.primary_role || (data as any)?.role || '').toLowerCase();
    if (id && (!role || role === 'affiliate' || role === 'admin')) return id;
  }

  const { data: linkRow } = await supabaseAdmin
    .from('affiliate_links')
    .select('affiliate_id')
    .or(`link_code.eq.${raw},referral_code.eq.${raw}`)
    .maybeSingle();
  const affiliateId = String((linkRow as any)?.affiliate_id || '').trim();
  return affiliateId || null;
};

export const handler: Handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') {
      return json(405, { ok: false, error: 'Method not allowed' });
    }

    const body = parseJson<any>(event.body);
    const listingId = String(body?.listing_id || '').trim();
    const affiliateRef = String(body?.affiliate_ref || body?.affiliate_id || '').trim();
    if (!listingId || !affiliateRef) {
      return json(400, { ok: false, error: 'Missing listing_id or affiliate_ref' });
    }

    const supabaseAdmin = createSupabaseAdmin();
    const affiliateId = await resolveAffiliateId(supabaseAdmin, affiliateRef);
    if (!affiliateId) {
      return json(200, { ok: true, tracked: false, reason: 'affiliate_not_resolved' });
    }

    const { data: campaign, error: campaignError } = await supabaseAdmin
      .from('insurance_lead_campaigns')
      .select('id')
      .eq('listing_id', listingId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (campaignError) return json(500, { ok: false, error: campaignError.message });

    const ipHash = sha256(getIpAddress(event));
    const userAgent = String(event.headers['user-agent'] || '').trim();
    const fingerprintSource = [
      affiliateId,
      listingId,
      ipHash,
      userAgent,
      String(body?.source_url || '').trim(),
      String(body?.referrer || '').trim(),
    ].join('|');

    const { error } = await supabaseAdmin
      .from('insurance_affiliate_clicks')
      .insert({
        affiliate_user_id: affiliateId,
        tracking_code: affiliateRef,
        listing_id: listingId,
        campaign_id: String((campaign as any)?.id || '').trim() || null,
        click_ip_hash: ipHash,
        click_user_agent: userAgent || null,
        click_fingerprint: sha256(fingerprintSource),
      });
    if (error) return json(500, { ok: false, error: error.message });

    return json(200, {
      ok: true,
      tracked: true,
      affiliate_id: affiliateId,
    });
  } catch (error: any) {
    return json(Number(error?.statusCode) || 500, { ok: false, error: error?.message || 'Unexpected error' });
  }
};

export default handler;
