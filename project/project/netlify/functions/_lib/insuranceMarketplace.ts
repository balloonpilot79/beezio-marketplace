import {
  INSURANCE_DEFAULT_LEAD_PRICE_CENTS,
  INSURANCE_DEFAULT_MIN_AFFILIATE_PAYOUT_CENTS,
  INSURANCE_DEFAULT_MIN_BEEZIO_FEE_CENTS,
  INSURANCE_DEFAULT_MIN_TOTAL_LEAD_PRICE_CENTS,
  InsuranceVertical,
  centsToDollars,
  computeInsuranceLeadSplitCents,
  dollarsToCents,
  humanizeInsuranceVertical,
  normalizeInsuranceVertical,
  validateInsuranceLeadPricing,
} from '../../../shared/insuranceLeads';

export type InsurancePricingContext = {
  leadPriceCents: number;
  hasAffiliate?: boolean;
  hasInfluencer?: boolean;
  minLeadPriceCents?: number;
  minBeezioFeeCents?: number;
  minAffiliatePayoutCents?: number;
};

export const DEFAULT_INSURANCE_ADMIN_SETTINGS = {
  minLeadPriceCents: INSURANCE_DEFAULT_MIN_TOTAL_LEAD_PRICE_CENTS,
  minBeezioFeeCents: INSURANCE_DEFAULT_MIN_BEEZIO_FEE_CENTS,
  minAffiliatePayoutCents: INSURANCE_DEFAULT_MIN_AFFILIATE_PAYOUT_CENTS,
};

export function buildInsurancePricingPreview(input: InsurancePricingContext) {
  const validation = validateInsuranceLeadPricing({
    leadPriceCents: input.leadPriceCents,
    minLeadPriceCents: input.minLeadPriceCents ?? DEFAULT_INSURANCE_ADMIN_SETTINGS.minLeadPriceCents,
    minBeezioFeeCents: input.minBeezioFeeCents ?? DEFAULT_INSURANCE_ADMIN_SETTINGS.minBeezioFeeCents,
    minAffiliatePayoutCents: input.minAffiliatePayoutCents ?? DEFAULT_INSURANCE_ADMIN_SETTINGS.minAffiliatePayoutCents,
    hasAffiliate: input.hasAffiliate ?? true,
    hasInfluencer: input.hasInfluencer ?? false,
  });

  return {
    ...validation,
    leadPrice: centsToDollars(validation.leadPriceCents),
    affiliatePayout: centsToDollars(validation.affiliatePayoutCents),
    influencerPayout: centsToDollars(validation.influencerPayoutCents),
    agentRetained: centsToDollars(validation.agentRetainedCents),
    beezioFee: centsToDollars(validation.beezioFeeCents),
    paypalFee: centsToDollars(validation.paypalFeeCents),
  };
}

export async function loadInsuranceAdminSettings(supabaseAdmin: any) {
  const { data } = await supabaseAdmin
    .from('insurance_admin_settings')
    .select('setting_key,setting_value')
    .in('setting_key', ['min_lead_price_cents', 'min_beezio_fee_cents', 'min_affiliate_payout_cents']);

  const map = new Map<string, any>();
  for (const row of (data as any[]) || []) {
    map.set(String(row?.setting_key || ''), row?.setting_value);
  }

  return {
    minLeadPriceCents: Number(map.get('min_lead_price_cents') || DEFAULT_INSURANCE_ADMIN_SETTINGS.minLeadPriceCents),
    minBeezioFeeCents: Number(map.get('min_beezio_fee_cents') || DEFAULT_INSURANCE_ADMIN_SETTINGS.minBeezioFeeCents),
    minAffiliatePayoutCents: Number(map.get('min_affiliate_payout_cents') || DEFAULT_INSURANCE_ADMIN_SETTINGS.minAffiliatePayoutCents),
  };
}

export async function ensureInsuranceWallet(supabaseAdmin: any, agentUserId: string) {
  const { data: existing } = await supabaseAdmin
    .from('insurance_agent_wallets')
    .select('*')
    .eq('agent_user_id', agentUserId)
    .maybeSingle();
  if (existing) return existing;

  const { data, error } = await supabaseAdmin
    .from('insurance_agent_wallets')
    .insert({
      agent_user_id: agentUserId,
      balance_cents: 0,
      currency: 'USD',
      status: 'active',
    })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function fundInsuranceWallet({
  supabaseAdmin,
  agentUserId,
  amountCents,
  notes,
  referenceType = 'manual_funding',
  referenceId = null,
}: {
  supabaseAdmin: any;
  agentUserId: string;
  amountCents: number;
  notes?: string | null;
  referenceType?: string;
  referenceId?: string | null;
}) {
  const normalizedAmount = Math.max(0, Math.round(amountCents));
  if (normalizedAmount <= 0) {
    throw new Error('Funding amount must be greater than zero.');
  }

  const { data: fundedWallet, error: rpcError } = await supabaseAdmin.rpc('fund_insurance_wallet', {
    p_agent_user_id: agentUserId,
    p_amount_cents: normalizedAmount,
    p_reference_type: referenceType,
    p_reference_id: referenceId,
    p_notes: notes || null,
  });

  if (!rpcError && fundedWallet) return fundedWallet;

  const wallet = await ensureInsuranceWallet(supabaseAdmin, agentUserId);
  const nextBalance = Math.max(0, Number(wallet.balance_cents || 0) + normalizedAmount);
  const { data: updated, error: updateError } = await supabaseAdmin
    .from('insurance_agent_wallets')
    .update({ balance_cents: nextBalance, status: 'active' })
    .eq('id', wallet.id)
    .select('*')
    .single();
  if (updateError) throw updateError;

  const { error: txnError } = await supabaseAdmin
    .from('insurance_wallet_transactions')
    .insert({
      wallet_id: wallet.id,
      type: 'funding',
      amount_cents: normalizedAmount,
      reference_type: referenceType,
      reference_id: referenceId,
      notes: notes || null,
    });
  if (txnError) throw txnError;

  return updated;
}

export async function createInsurancePackagePurchase({
  supabaseAdmin,
  agentUserId,
  packageTemplateId,
  notes,
}: {
  supabaseAdmin: any;
  agentUserId: string;
  packageTemplateId: string;
  notes?: string | null;
}) {
  const { data: rpcResult, error: rpcError } = await supabaseAdmin.rpc('purchase_insurance_lead_package', {
    p_agent_user_id: agentUserId,
    p_package_template_id: packageTemplateId,
    p_notes: notes || null,
  });

  const rpcPackage = rpcResult?.package || null;
  if (!rpcError && rpcPackage) {
    return rpcPackage;
  }

  const { data: template, error } = await supabaseAdmin
    .from('insurance_lead_package_templates')
    .select('*')
    .eq('id', packageTemplateId)
    .eq('is_active', true)
    .single();
  if (error) throw error;

  const leadCount = Math.max(1, Number((template as any)?.qualified_lead_count || 0));
  const packagePriceCents = Math.max(0, Number((template as any)?.package_price_cents || 0));
  const costPerLeadCents = Math.max(0, Number((template as any)?.implied_cost_per_lead_cents || 0));
  const affiliatePayoutCents = Math.max(0, Number((template as any)?.suggested_affiliate_payout_cents || 0));
  const beezioFeeCents = Math.max(0, Number((template as any)?.suggested_beezio_fee_cents || 0));

  const { data: agentPackage, error: packageError } = await supabaseAdmin
    .from('insurance_agent_lead_packages')
    .insert({
      agent_user_id: agentUserId,
      package_template_id: packageTemplateId,
      vertical: normalizeInsuranceVertical((template as any)?.vertical),
      purchased_lead_count: leadCount,
      delivered_lead_count: 0,
      remaining_lead_count: leadCount,
      package_price_cents: packagePriceCents,
      effective_cost_per_lead_cents: costPerLeadCents,
      affiliate_payout_cents: affiliatePayoutCents,
      beezio_fee_cents: beezioFeeCents,
      status: 'active',
      funded_at: new Date().toISOString(),
    })
    .select('*')
    .single();
  if (packageError) throw packageError;

  await fundInsuranceWallet({
    supabaseAdmin,
    agentUserId,
    amountCents: packagePriceCents,
    notes: notes || `Package funded: ${(template as any)?.name || humanizeInsuranceVertical((template as any)?.vertical as InsuranceVertical)}`,
    referenceType: 'package_funding',
    referenceId: String((agentPackage as any)?.id || ''),
  });

  return agentPackage;
}

export async function buildInsuranceMarketplaceRows(supabaseAdmin: any, adminOnly = true) {
  const { data: listings, error } = await supabaseAdmin
    .from('insurance_agent_listings')
    .select('*')
    .eq('is_active', true)
    .order('placement_rank', { ascending: true })
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw error;

  const list = (listings as any[]) || [];
  const agentIds = Array.from(new Set(list.map((row) => String(row?.agent_profile_id || '').trim()).filter(Boolean)));
  const profileMap = new Map<string, any>();
  const walletMap = new Map<string, any>();
  if (agentIds.length > 0) {
    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('id,full_name,avatar_url')
      .in('id', agentIds);
    for (const row of (profiles as any[]) || []) {
      profileMap.set(String(row?.id || '').trim(), row);
    }

    const { data: wallets } = await supabaseAdmin
      .from('insurance_agent_wallets')
      .select('*')
      .in('agent_user_id', agentIds);
    for (const row of (wallets as any[]) || []) {
      walletMap.set(String(row?.agent_user_id || '').trim(), row);
    }
  }

  const { data: campaigns } = await supabaseAdmin
    .from('insurance_lead_campaigns')
    .select('*')
    .in('listing_id', list.map((row) => row.id));
  const campaignMap = new Map<string, any>();
  for (const campaign of (campaigns as any[]) || []) {
    const listingId = String(campaign?.listing_id || '').trim();
    if (!listingId) continue;
    const current = campaignMap.get(listingId);
    if (!current || String(current?.status || '') !== 'active') {
      campaignMap.set(listingId, campaign);
    }
  }

  return list.map((listing) => {
    const campaign = campaignMap.get(String(listing?.id || '').trim());
    const leadPriceCents = Math.max(
      0,
      Number(campaign?.cost_per_lead_cents || listing?.lead_price_cents || dollarsToCents(Number(listing?.lead_price || 0)) || INSURANCE_DEFAULT_LEAD_PRICE_CENTS)
    );
    const split = computeInsuranceLeadSplitCents({
      leadPriceCents,
      hasAffiliate: true,
      hasInfluencer: false,
    });
    const profile = profileMap.get(String(listing?.agent_profile_id || '').trim());
    const wallet = walletMap.get(String(listing?.agent_profile_id || '').trim());
    const walletBalanceCents = Math.max(0, Number(wallet?.balance_cents || 0));
    const websiteEnabled = listing?.website_enabled !== false;
    const acceptsNewLeads = listing?.accepts_new_leads !== false;
    const activeCampaign = String(campaign?.status || '').toLowerCase() === 'active';
    const hasCredits = walletBalanceCents >= Math.max(leadPriceCents, 1);
    const leadDeliveryEnabled = Boolean(websiteEnabled && acceptsNewLeads && activeCampaign && hasCredits);
    const activationStatus = leadDeliveryEnabled
      ? 'credits_active'
      : !websiteEnabled
        ? 'website_disabled'
        : websiteEnabled && acceptsNewLeads && activeCampaign && !hasCredits
          ? 'out_of_credits'
        : !acceptsNewLeads || !activeCampaign
          ? 'paused'
          : 'website_only';
    const activationLabel =
      activationStatus === 'credits_active'
        ? 'Credits active'
        : activationStatus === 'out_of_credits'
          ? 'Out of credits'
        : activationStatus === 'paused'
          ? 'Lead delivery paused'
          : activationStatus === 'website_disabled'
            ? 'Website disabled'
            : 'Free website only';
    return {
      id: String(listing?.id || ''),
      slug: String(listing?.slug || ''),
      agency_name: String(listing?.agency_name || ''),
      bio: String(listing?.bio || ''),
      hero_subtitle: String(listing?.hero_subtitle || ''),
      verticals: Array.isArray(listing?.verticals) ? listing.verticals : [normalizeInsuranceVertical(campaign?.vertical || 'life')],
      states_served: Array.isArray(listing?.states_served) ? listing.states_served : [],
      lead_price_cents: leadPriceCents,
      lead_price: centsToDollars(leadPriceCents),
      affiliate_payout_cents: split.affiliatePayoutCents,
      affiliate_payout: centsToDollars(split.affiliatePayoutCents),
      payout_label: centsToDollars(split.affiliatePayoutCents).toFixed(2),
      campaign_status: String(campaign?.status || 'paused'),
      pricing_mode: String(campaign?.pricing_mode || 'standard'),
      website_enabled: websiteEnabled,
      accepts_new_leads: acceptsNewLeads,
      wallet_balance_cents: walletBalanceCents,
      wallet_balance: centsToDollars(walletBalanceCents),
      has_credits: hasCredits,
      lead_delivery_enabled: leadDeliveryEnabled,
      promotable_by_affiliates: leadDeliveryEnabled,
      activation_status: activationStatus,
      activation_label: activationLabel,
      placement_rank: Number(listing?.placement_rank || 100),
      contact_name: adminOnly ? String(profile?.full_name || listing?.contact_name || '') : '',
      avatar_url: String(profile?.avatar_url || ''),
      agency_profile:
        campaign?.targeting_json?.agency_profile && typeof campaign.targeting_json.agency_profile === 'object'
          ? campaign.targeting_json.agency_profile
          : {},
    };
  });
}
