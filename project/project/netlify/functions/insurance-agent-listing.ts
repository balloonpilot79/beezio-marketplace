import type { Handler } from '@netlify/functions';
import { createSupabaseAdmin } from './_lib/supabase';
import { assertPost, json, parseJson } from './_lib/http';
import { requireSellerOrAdmin } from './_lib/auth';
import {
  buildInsurancePricingPreview,
  createInsurancePackagePurchase,
  ensureInsuranceWallet,
  fundInsuranceWallet,
  loadInsuranceAdminSettings,
} from './_lib/insuranceMarketplace';
import {
  INSURANCE_DEFAULT_LEAD_PRICE_CENTS,
  INSURANCE_VERTICALS,
  InsuranceVertical,
  centsToDollars,
  dollarsToCents,
  humanizeInsuranceVertical,
  normalizeInsuranceVertical,
} from '../../shared/insuranceLeads';

const slugify = (value: string): string =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

const normalizeList = (input: unknown): string[] =>
  Array.isArray(input)
    ? input.map((value) => String(value || '').trim()).filter(Boolean)
    : String(input || '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);

const normalizeVerticals = (input: unknown): InsuranceVertical[] => {
  const raw = normalizeList(input).map((value) => normalizeInsuranceVertical(value));
  return raw.length > 0 ? Array.from(new Set(raw)) : ['life'];
};

const normalizeBoolean = (value: unknown, fallback = false): boolean => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
    if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  }
  return fallback;
};

const normalizeLeadTier = (value: unknown): 'verified' | 'qualified' | 'high_intent' => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'verified' || normalized === 'high_intent') return normalized;
  return 'qualified';
};

const resolveTargetAgentProfileId = async (supabaseAdmin: any, body: any, fallbackProfileId: string) => {
  const raw = String(body?.agent_profile_id || body?.target_profile_id || '').trim();
  if (!raw) return fallbackProfileId;
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .or(`id.eq.${raw},user_id.eq.${raw}`)
    .maybeSingle();
  return String((data as any)?.id || raw).trim() || fallbackProfileId;
};

export const handler: Handler = async (event) => {
  try {
    const admin = await requireSellerOrAdmin(event as any);
    const supabaseAdmin = createSupabaseAdmin();
    const body = event.body ? parseJson<any>(event.body) : {};
    const targetProfileId = await resolveTargetAgentProfileId(supabaseAdmin, body, admin.profileId);
    const adminSettings = await loadInsuranceAdminSettings(supabaseAdmin);

    if (event.httpMethod === 'GET') {
      const { data: listing, error: listingError } = await supabaseAdmin
        .from('insurance_agent_listings')
        .select('*')
        .eq('agent_profile_id', targetProfileId)
        .maybeSingle();
      if (listingError) return json(500, { ok: false, error: listingError.message });

      const wallet = await ensureInsuranceWallet(supabaseAdmin, targetProfileId);
      const { data: campaigns } = await supabaseAdmin
        .from('insurance_lead_campaigns')
        .select('*')
        .eq('agent_user_id', targetProfileId)
        .order('created_at', { ascending: false });
      const { data: packageTemplates } = await supabaseAdmin
        .from('insurance_lead_package_templates')
        .select('*')
        .eq('is_active', true)
        .order('qualified_lead_count', { ascending: true });
      const { data: packages } = await supabaseAdmin
        .from('insurance_agent_lead_packages')
        .select('*')
        .eq('agent_user_id', targetProfileId)
        .order('created_at', { ascending: false });
      const { data: walletTransactions } = await supabaseAdmin
        .from('insurance_wallet_transactions')
        .select('*')
        .eq('wallet_id', String((wallet as any)?.id || ''))
        .order('created_at', { ascending: false })
        .limit(20);
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('id,full_name,email')
        .eq('id', targetProfileId)
        .maybeSingle();

      return json(200, {
        ok: true,
        listing: listing || null,
        wallet: wallet || null,
        campaigns: campaigns || [],
        package_templates: packageTemplates || [],
        packages: packages || [],
        wallet_transactions: walletTransactions || [],
        agent_profile: profile || null,
        admin_settings: adminSettings,
      });
    }

    assertPost(event.httpMethod);
    const action = String(body?.action || 'save_listing_campaign').trim().toLowerCase();

    if (action === 'fund_wallet') {
      const amountCents = Math.max(0, Math.round(Number(body?.amount_cents || dollarsToCents(body?.amount || 0) || 0)));
      if (amountCents <= 0) return json(400, { ok: false, error: 'Funding amount is required.' });
      const wallet = await fundInsuranceWallet({
        supabaseAdmin,
        agentUserId: targetProfileId,
        amountCents,
        notes: String(body?.notes || '').trim() || 'Manual insurance wallet funding',
      });
      return json(200, { ok: true, wallet });
    }

    if (action === 'buy_package') {
      const packageTemplateId = String(body?.package_template_id || '').trim();
      if (!packageTemplateId) return json(400, { ok: false, error: 'package_template_id is required.' });
      const purchased = await createInsurancePackagePurchase({
        supabaseAdmin,
        agentUserId: targetProfileId,
        packageTemplateId,
        notes: String(body?.notes || '').trim() || null,
      });
      return json(200, { ok: true, package: purchased });
    }

    const agencyName = String(body?.agency_name || '').trim();
    if (!agencyName) return json(400, { ok: false, error: 'Agency name is required.' });

    const vertical = normalizeInsuranceVertical(body?.vertical || body?.lead_type || 'life');
    const verticals = normalizeVerticals(body?.verticals || [vertical]);
    const leadPriceCents = Math.max(
      0,
      Math.round(Number(body?.lead_price_cents || dollarsToCents(body?.lead_price || 0) || INSURANCE_DEFAULT_LEAD_PRICE_CENTS))
    );
    const pricingPreview = buildInsurancePricingPreview({
      leadPriceCents,
      hasAffiliate: true,
      hasInfluencer: false,
      minLeadPriceCents: adminSettings.minLeadPriceCents,
      minBeezioFeeCents: adminSettings.minBeezioFeeCents,
      minAffiliatePayoutCents: adminSettings.minAffiliatePayoutCents,
    });
    if (!pricingPreview.ok) return json(400, { ok: false, error: pricingPreview.reason || 'Invalid lead price.' });

    const requestedSlug = slugify(String(body?.slug || agencyName));
    if (!requestedSlug) return json(400, { ok: false, error: 'A valid slug is required.' });

    const listingPayload = {
      agent_profile_id: targetProfileId,
      slug: requestedSlug,
      agency_name: agencyName,
      contact_name: String(body?.contact_name || '').trim() || null,
      contact_email: String(body?.contact_email || '').trim() || null,
      contact_phone: String(body?.contact_phone || '').trim() || null,
      website_url: String(body?.website_url || '').trim() || null,
      bio: String(body?.bio || '').trim() || null,
      specialties: normalizeList(body?.specialties),
      states_served: normalizeList(body?.states_served),
      verticals,
      lead_price: centsToDollars(leadPriceCents),
      lead_price_cents: leadPriceCents,
      hero_title: String(body?.hero_title || `${agencyName} on Beezio`).trim() || null,
      hero_subtitle: String(body?.hero_subtitle || `Qualified ${humanizeInsuranceVertical(vertical)} leads`).trim() || null,
      disclaimer: String(body?.disclaimer || 'By submitting, you agree a licensed agent may contact you about coverage options.').trim() || null,
      accepts_new_leads: body?.accepts_new_leads !== false,
      is_active: body?.is_active !== false,
      placement_rank: Math.max(1, Math.floor(Number(body?.placement_rank || 100))),
      is_admin_only: true,
      public_contact_blocked: true,
      website_enabled: true,
    };

    const { data: existingListing } = await supabaseAdmin
      .from('insurance_agent_listings')
      .select('id')
      .eq('agent_profile_id', targetProfileId)
      .maybeSingle();

    const listingQuery = existingListing?.id
      ? supabaseAdmin.from('insurance_agent_listings').update(listingPayload).eq('id', existingListing.id).select('*').single()
      : supabaseAdmin.from('insurance_agent_listings').insert(listingPayload).select('*').single();
    const { data: savedListing, error: listingSaveError } = await listingQuery;
    if (listingSaveError) return json(500, { ok: false, error: listingSaveError.message });

    await ensureInsuranceWallet(supabaseAdmin, targetProfileId);

    const campaignPayload = {
      listing_id: String((savedListing as any)?.id || ''),
      agent_user_id: targetProfileId,
      vertical,
      lead_type: String(body?.lead_type || 'quote_request').trim() || 'quote_request',
      max_cost_per_lead_cents: leadPriceCents,
      cost_per_lead_cents: leadPriceCents,
      affiliate_payout_cents: pricingPreview.affiliatePayoutCents,
      beezio_fee_cents: pricingPreview.beezioFeeCents,
      daily_cap: body?.daily_cap ? Math.max(1, Math.floor(Number(body.daily_cap))) : null,
      status: String(body?.campaign_status || body?.is_active !== false ? 'active' : 'paused'),
      targeting_json: {
        ...(body?.targeting_json && typeof body.targeting_json === 'object' ? body.targeting_json : {}),
        questionnaire: {
          ask_age_range: normalizeBoolean(body?.questionnaire?.ask_age_range, true),
          ask_timeline: normalizeBoolean(body?.questionnaire?.ask_timeline, true),
          ask_current_coverage: normalizeBoolean(body?.questionnaire?.ask_current_coverage, true),
          ask_best_contact_time: normalizeBoolean(body?.questionnaire?.ask_best_contact_time, true),
          ask_zip_code: normalizeBoolean(body?.questionnaire?.ask_zip_code, true),
          ask_notes: normalizeBoolean(body?.questionnaire?.ask_notes, true),
          ask_current_insurer: normalizeBoolean(body?.questionnaire?.ask_current_insurer, true),
          ask_vehicles_count: normalizeBoolean(body?.questionnaire?.ask_vehicles_count, true),
          ask_homeowner_status: normalizeBoolean(body?.questionnaire?.ask_homeowner_status, true),
          ask_dependents: normalizeBoolean(body?.questionnaire?.ask_dependents, true),
          ask_household_size: normalizeBoolean(body?.questionnaire?.ask_household_size, true),
        },
        consent: {
          single_agent_only: normalizeBoolean(body?.questionnaire?.single_agent_only, true),
          no_spam_calling: normalizeBoolean(body?.questionnaire?.no_spam_calling, true),
          twilio_verified_only: normalizeBoolean(body?.questionnaire?.twilio_verified_only, true),
        },
        quality_tiers: {
          verified: normalizeBoolean(body?.quality_tiers?.verified, true),
          qualified: normalizeBoolean(body?.quality_tiers?.qualified, true),
          high_intent: normalizeBoolean(body?.quality_tiers?.high_intent, true),
          default_tier: normalizeLeadTier(body?.quality_tiers?.default_tier),
        },
        testimonials: Array.isArray(body?.testimonials)
          ? body.testimonials
              .map((entry: any) => ({
                quote: String(entry?.quote || '').trim(),
                author: String(entry?.author || '').trim(),
                role: String(entry?.role || '').trim(),
              }))
              .filter((entry: any) => entry.quote)
              .slice(0, 3)
          : [],
        agency_profile: {
          years_in_business: String(body?.agency_profile?.years_in_business || '').trim(),
          response_time: String(body?.agency_profile?.response_time || '').trim(),
          licensed_states_text: String(body?.agency_profile?.licensed_states_text || '').trim(),
          service_area_summary: String(body?.agency_profile?.service_area_summary || '').trim(),
          cta_label: String(body?.agency_profile?.cta_label || 'Submit qualified lead').trim() || 'Submit qualified lead',
          logo_url: String(body?.agency_profile?.logo_url || '').trim(),
          banner_url: String(body?.agency_profile?.banner_url || '').trim(),
          theme_accent: String(body?.agency_profile?.theme_accent || '#131921').trim() || '#131921',
          gallery_urls: Array.isArray(body?.agency_profile?.gallery_urls)
            ? body.agency_profile.gallery_urls
                .map((value: unknown) => String(value || '').trim())
                .filter(Boolean)
                .slice(0, 3)
            : [],
          trust_points: Array.isArray(body?.agency_profile?.trust_points)
            ? body.agency_profile.trust_points
                .map((value: unknown) => String(value || '').trim())
                .filter(Boolean)
                .slice(0, 3)
            : [],
        },
      },
      pricing_mode: String(body?.pricing_mode || 'standard').trim().toLowerCase() === 'package' ? 'package' : 'standard',
      package_id: body?.package_id ? String(body.package_id) : null,
      min_affiliate_payout_cents: adminSettings.minAffiliatePayoutCents,
      min_beezio_fee_cents: adminSettings.minBeezioFeeCents,
    };

    const { data: existingCampaign } = await supabaseAdmin
      .from('insurance_lead_campaigns')
      .select('id')
      .eq('agent_user_id', targetProfileId)
      .eq('vertical', vertical)
      .maybeSingle();

    const campaignQuery = existingCampaign?.id
      ? supabaseAdmin.from('insurance_lead_campaigns').update(campaignPayload).eq('id', existingCampaign.id).select('*').single()
      : supabaseAdmin.from('insurance_lead_campaigns').insert(campaignPayload).select('*').single();
    const { data: savedCampaign, error: campaignSaveError } = await campaignQuery;
    if (campaignSaveError) return json(500, { ok: false, error: campaignSaveError.message });

    return json(200, {
      ok: true,
      listing: savedListing,
      campaign: savedCampaign,
      pricing_preview: pricingPreview,
      admin_settings: adminSettings,
      available_verticals: INSURANCE_VERTICALS,
    });
  } catch (error: any) {
    return json(Number(error?.statusCode) || 500, { ok: false, error: error?.message || 'Unexpected error' });
  }
};

export default handler;
