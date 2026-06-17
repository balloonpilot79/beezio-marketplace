import type { Handler } from '@netlify/functions';
import { json } from './_lib/http';
import { createSupabaseAdmin } from './_lib/supabase';
import { buildInsuranceMarketplaceRows, buildInsurancePricingPreview } from './_lib/insuranceMarketplace';

const isUuid = (value: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export const handler: Handler = async (event) => {
  try {
    const raw = String(event.queryStringParameters?.listing || event.queryStringParameters?.slug || event.queryStringParameters?.id || '').trim();
    if (!raw) return json(400, { ok: false, error: 'Missing listing' });

    const supabaseAdmin = createSupabaseAdmin();
    const marketplaceRows = await buildInsuranceMarketplaceRows(supabaseAdmin, false);
    const listing = marketplaceRows.find((row) => (isUuid(raw) ? row.id === raw : row.slug === raw.toLowerCase()));
    if (!listing) return json(404, { ok: false, error: 'Listing not found' });

    const { data: fullListing } = await supabaseAdmin
      .from('insurance_agent_listings')
      .select('*')
      .eq('id', listing.id)
      .maybeSingle();
    const { data: campaign } = await supabaseAdmin
      .from('insurance_lead_campaigns')
      .select('*')
      .eq('listing_id', listing.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const leadPriceCents = Number((campaign as any)?.cost_per_lead_cents || listing.lead_price_cents || 0);
    const affiliatePreview = buildInsurancePricingPreview({
      leadPriceCents,
      hasAffiliate: true,
      hasInfluencer: true,
    });
    const directPreview = buildInsurancePricingPreview({
      leadPriceCents,
      hasAffiliate: false,
      hasInfluencer: true,
    });

    return json(200, {
      ok: true,
      listing: {
        ...listing,
        hero_title: String((fullListing as any)?.hero_title || `${listing.agency_name} insurance quote request`),
        hero_subtitle: String((fullListing as any)?.hero_subtitle || 'Complete the guided quote form to generate a qualified lead.'),
        disclaimer: String((fullListing as any)?.disclaimer || 'By submitting, you agree a licensed agent may contact you about coverage options.'),
        bio: String((fullListing as any)?.bio || listing.bio || ''),
        specialties: Array.isArray((fullListing as any)?.specialties) ? (fullListing as any).specialties : [],
        website_url: String((fullListing as any)?.website_url || ''),
        states_served: Array.isArray((fullListing as any)?.states_served) ? (fullListing as any).states_served : [],
        verticals: Array.isArray((fullListing as any)?.verticals) ? (fullListing as any).verticals : listing.verticals,
        campaign_id: String((campaign as any)?.id || ''),
        daily_cap: Number((campaign as any)?.daily_cap || 0) || null,
        pricing_mode: String((campaign as any)?.pricing_mode || listing.pricing_mode || 'standard'),
        questionnaire_settings: ((campaign as any)?.targeting_json && typeof (campaign as any).targeting_json === 'object'
          ? (campaign as any).targeting_json
          : {}) || {},
        testimonials: Array.isArray((campaign as any)?.targeting_json?.testimonials)
          ? (campaign as any).targeting_json.testimonials
          : [],
        agency_profile:
          (campaign as any)?.targeting_json?.agency_profile &&
          typeof (campaign as any).targeting_json.agency_profile === 'object'
            ? (campaign as any).targeting_json.agency_profile
            : {},
        affiliate_preview: affiliatePreview,
        direct_preview: directPreview,
      },
    });
  } catch (error: any) {
    return json(Number(error?.statusCode) || 500, { ok: false, error: error?.message || 'Unexpected error' });
  }
};

export default handler;
