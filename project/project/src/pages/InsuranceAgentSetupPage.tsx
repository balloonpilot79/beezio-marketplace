import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { copyTextToClipboard } from '../utils/clipboard';
import ImageUploader from '../components/ImageUploader';
import {
  INSURANCE_VERTICALS,
  computeInsuranceLeadSplitCents,
  dollarsToCents,
  humanizeInsuranceVertical,
  validateInsuranceLeadPricing,
} from '../../shared/insuranceLeads';

const formatMoney = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value || 0));

const VERTICAL_PREVIEW: Record<string, {
  shopperTitle: string;
  shopperIntro: string;
  checklist: string[];
  notesPlaceholder: string;
}> = {
  life: {
    shopperTitle: 'Life insurance quote request',
    shopperIntro: 'Answer a few questions about household protection and dependents so this agent can review life insurance options that fit the situation.',
    checklist: ['Household protection needs', 'Dependents and family situation', 'Current coverage status'],
    notesPlaceholder: 'Tell the agent what kind of life coverage or family protection you want help with',
  },
  health: {
    shopperTitle: 'Health coverage quote request',
    shopperIntro: 'Use this form to request health coverage help from this agent. The goal is to match needs, timing, and household size before contact happens.',
    checklist: ['Household size and coverage needs', 'Current health plan status', 'When coverage should start'],
    notesPlaceholder: 'Tell the agent what kind of health coverage or plan help you need',
  },
  auto: {
    shopperTitle: 'Auto insurance quote request',
    shopperIntro: 'Share vehicle and current coverage details so this agent can review auto insurance options before calling you.',
    checklist: ['Vehicle count and driver need', 'Current insurer details', 'Coverage timing and urgency'],
    notesPlaceholder: 'Tell the agent what you need help with on your auto insurance quote',
  },
  home: {
    shopperTitle: 'Home insurance quote request',
    shopperIntro: 'Complete this home coverage form so the agent can review the property situation and contact you with relevant options only after verification.',
    checklist: ['Homeowner or renter status', 'Current insurer details', 'Property coverage timing'],
    notesPlaceholder: 'Tell the agent what you need help with for your home or renter coverage',
  },
};

const VERTICAL_PRICE_GUIDE: Record<string, {
  recommended: number;
  range: string;
  reason: string;
  presets: number[];
}> = {
  life: {
    recommended: 20,
    range: '$18 to $30',
    reason: 'Life leads usually need enough payout to motivate affiliates while still leaving room for a solid qualified-lead margin.',
    presets: [18, 20, 30],
  },
  health: {
    recommended: 22,
    range: '$20 to $32',
    reason: 'Health leads often need slightly stronger pricing because shoppers compare options and affiliates need a meaningful payout to push volume.',
    presets: [20, 22, 32],
  },
  auto: {
    recommended: 15,
    range: '$12 to $22',
    reason: 'Auto can often work at a lower total price if the questionnaire is clean and the offer is local and relevant.',
    presets: [12, 15, 22],
  },
  home: {
    recommended: 18,
    range: '$15 to $28',
    reason: 'Home and renter leads usually need a mid-range price so the qualified lead is worth the follow-up and worth promoting.',
    presets: [15, 18, 28],
  },
};

const TIER_PRICE_MULTIPLIER: Record<'verified' | 'qualified' | 'high_intent', number> = {
  verified: 0.85,
  qualified: 1,
  high_intent: 1.3,
};

const TIER_LABELS: Record<'verified' | 'qualified' | 'high_intent', string> = {
  verified: 'Verified',
  qualified: 'Qualified',
  high_intent: 'High Intent',
};

const SETUP_STEPS = [
  { id: 'basics', label: 'Basics', description: 'Agency details, vertical, and pricing' },
  { id: 'branding', label: 'Branding', description: 'Banner, logo, gallery, and hero copy' },
  { id: 'proof', label: 'Proof', description: 'Credibility points and testimonials' },
  { id: 'rules', label: 'Lead Rules', description: 'Questionnaire, compliance, and go-live settings' },
] as const;

type SetupStepId = typeof SETUP_STEPS[number]['id'];

const InsuranceAgentSetupPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [funding, setFunding] = useState(false);
  const [templateSaving, setTemplateSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState<'direct' | 'affiliate' | null>(null);
  const [walletBalance, setWalletBalance] = useState(0);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [packages, setPackages] = useState<any[]>([]);
  const [walletTransactions, setWalletTransactions] = useState<any[]>([]);
  const [packageTemplates, setPackageTemplates] = useState<any[]>([]);
  const [disputes, setDisputes] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [agentAnalytics, setAgentAnalytics] = useState<any>(null);
  const [adminSettings, setAdminSettings] = useState<any>(null);
  const [leadFilter, setLeadFilter] = useState<'all' | 'review' | 'delivered' | 'invalid'>('all');
  const [actingLeadId, setActingLeadId] = useState<string | null>(null);
  const [leadActionNotes, setLeadActionNotes] = useState<Record<string, string>>({});
  const [selectedVertical, setSelectedVertical] = useState('life');
  const [currentSetupStep, setCurrentSetupStep] = useState<SetupStepId>('basics');
  const [fundAmount, setFundAmount] = useState('100');
  const [templateForm, setTemplateForm] = useState({
    name: '',
    vertical: 'life',
    qualified_lead_count: '25',
    package_price: '250',
  });
  const [testimonials, setTestimonials] = useState([
    { quote: '', author: '', role: '' },
    { quote: '', author: '', role: '' },
    { quote: '', author: '', role: '' },
  ]);
  const [agencyProfile, setAgencyProfile] = useState({
    years_in_business: '',
    response_time: '',
    licensed_states_text: '',
    service_area_summary: '',
    cta_label: 'Submit qualified lead',
    logo_url: '',
    banner_url: '',
    theme_accent: '#131921',
    gallery_urls: ['', '', ''],
    trust_points: ['', '', ''],
  });
  const [questionnaire, setQuestionnaire] = useState({
    ask_age_range: true,
    ask_timeline: true,
    ask_current_coverage: true,
    ask_best_contact_time: true,
    ask_zip_code: true,
    ask_notes: true,
    ask_current_insurer: true,
    ask_vehicles_count: true,
    ask_homeowner_status: true,
    ask_dependents: true,
    ask_household_size: true,
    single_agent_only: true,
    no_spam_calling: true,
    twilio_verified_only: true,
  });
  const [qualityTiers, setQualityTiers] = useState({
    verified: true,
    qualified: true,
    high_intent: true,
    default_tier: 'qualified' as 'verified' | 'qualified' | 'high_intent',
  });
  const [form, setForm] = useState({
    agency_name: '',
    slug: '',
    contact_name: '',
    contact_email: '',
    contact_phone: '',
    website_url: '',
    bio: '',
    specialties: 'Life, Health',
    states_served: 'TX, OK',
    lead_price: '10.00',
    verticals: 'life, health',
    daily_cap: '10',
    hero_title: '',
    hero_subtitle: '',
    disclaimer: '',
    accepts_new_leads: true,
    is_active: true,
    pricing_mode: 'standard',
  });

  const loadPage = async () => {
    setError(null);
    const { data: sessionData } = await supabase.auth.getSession();
    const token = String(sessionData?.session?.access_token || '').trim();
    if (!token) throw new Error('Please sign in as a seller or admin.');
    const [setupRes, templatesRes, disputesRes, leadsRes, analyticsRes] = await Promise.all([
      fetch('/api/insurance/agent-listing', {
        headers: { Authorization: `Bearer ${token}` },
      }),
      fetch('/api/insurance/package-templates', {
        headers: { Authorization: `Bearer ${token}` },
      }),
      fetch('/api/insurance/disputes', {
        headers: { Authorization: `Bearer ${token}` },
      }),
      fetch('/api/insurance/leads', {
        headers: { Authorization: `Bearer ${token}` },
      }),
      fetch('/api/insurance/agent-analytics', {
        headers: { Authorization: `Bearer ${token}` },
      }),
    ]);
    const setupPayload = await setupRes.json().catch(() => ({}));
    const templatesPayload = await templatesRes.json().catch(() => ({}));
    const disputesPayload = await disputesRes.json().catch(() => ({}));
    const leadsPayload = await leadsRes.json().catch(() => ({}));
    const analyticsPayload = await analyticsRes.json().catch(() => ({}));
    if (!setupRes.ok) throw new Error(String(setupPayload?.error || 'Unable to load insurance setup'));
    if (!templatesRes.ok) throw new Error(String(templatesPayload?.error || 'Unable to load package templates'));
    if (!disputesRes.ok) throw new Error(String(disputesPayload?.error || 'Unable to load insurance disputes'));
    if (!leadsRes.ok) throw new Error(String(leadsPayload?.error || 'Unable to load insurance leads'));
    if (!analyticsRes.ok) throw new Error(String(analyticsPayload?.error || 'Unable to load insurance analytics'));

    setWalletBalance(Number(setupPayload?.wallet?.balance_cents || 0) / 100);
    setCampaigns(Array.isArray(setupPayload?.campaigns) ? setupPayload.campaigns : []);
    setPackages(Array.isArray(setupPayload?.packages) ? setupPayload.packages : []);
    setWalletTransactions(Array.isArray(setupPayload?.wallet_transactions) ? setupPayload.wallet_transactions : []);
    setPackageTemplates(Array.isArray(templatesPayload?.templates) ? templatesPayload.templates : []);
    setDisputes(Array.isArray(disputesPayload?.disputes) ? disputesPayload.disputes : []);
    setLeads(Array.isArray(leadsPayload?.leads) ? leadsPayload.leads : []);
    setAgentAnalytics(analyticsPayload?.analytics || null);
    setAdminSettings(setupPayload?.admin_settings || null);

    if (setupPayload?.listing) {
      const listing = setupPayload.listing;
      const leadPrice = Number(listing.lead_price_cents || 0) / 100;
      const matchingCampaign = (setupPayload?.campaigns || [])[0];
      const targeting = matchingCampaign?.targeting_json && typeof matchingCampaign.targeting_json === 'object' ? matchingCampaign.targeting_json : {};
      const questionnaireConfig = targeting.questionnaire && typeof targeting.questionnaire === 'object' ? targeting.questionnaire : {};
      const consentConfig = targeting.consent && typeof targeting.consent === 'object' ? targeting.consent : {};
      const qualityTierConfig = targeting.quality_tiers && typeof targeting.quality_tiers === 'object' ? targeting.quality_tiers : {};
      const agencyProfileConfig = targeting.agency_profile && typeof targeting.agency_profile === 'object' ? targeting.agency_profile : {};
      setForm({
        agency_name: String(listing.agency_name || ''),
        slug: String(listing.slug || ''),
        contact_name: String(listing.contact_name || ''),
        contact_email: String(listing.contact_email || ''),
        contact_phone: String(listing.contact_phone || ''),
        website_url: String(listing.website_url || ''),
        bio: String(listing.bio || ''),
        specialties: Array.isArray(listing.specialties) ? listing.specialties.join(', ') : '',
        states_served: Array.isArray(listing.states_served) ? listing.states_served.join(', ') : '',
        lead_price: leadPrice ? leadPrice.toFixed(2) : '10.00',
        verticals: Array.isArray(listing.verticals) ? listing.verticals.join(', ') : 'life',
        daily_cap: String(matchingCampaign?.daily_cap || '10'),
        hero_title: String(listing.hero_title || ''),
        hero_subtitle: String(listing.hero_subtitle || ''),
        disclaimer: String(listing.disclaimer || ''),
        accepts_new_leads: listing.accepts_new_leads !== false,
        is_active: listing.is_active !== false,
        pricing_mode: String(matchingCampaign?.pricing_mode || 'standard'),
      });
      setQuestionnaire({
        ask_age_range: questionnaireConfig.ask_age_range !== false,
        ask_timeline: questionnaireConfig.ask_timeline !== false,
        ask_current_coverage: questionnaireConfig.ask_current_coverage !== false,
        ask_best_contact_time: questionnaireConfig.ask_best_contact_time !== false,
        ask_zip_code: questionnaireConfig.ask_zip_code !== false,
        ask_notes: questionnaireConfig.ask_notes !== false,
        ask_current_insurer: questionnaireConfig.ask_current_insurer !== false,
        ask_vehicles_count: questionnaireConfig.ask_vehicles_count !== false,
        ask_homeowner_status: questionnaireConfig.ask_homeowner_status !== false,
        ask_dependents: questionnaireConfig.ask_dependents !== false,
        ask_household_size: questionnaireConfig.ask_household_size !== false,
        single_agent_only: consentConfig.single_agent_only !== false,
        no_spam_calling: consentConfig.no_spam_calling !== false,
        twilio_verified_only: consentConfig.twilio_verified_only !== false,
      });
      setQualityTiers({
        verified: qualityTierConfig.verified !== false,
        qualified: qualityTierConfig.qualified !== false,
        high_intent: qualityTierConfig.high_intent !== false,
        default_tier: qualityTierConfig.default_tier === 'verified' || qualityTierConfig.default_tier === 'high_intent' ? qualityTierConfig.default_tier : 'qualified',
      });
      const rawTestimonials = Array.isArray(targeting.testimonials) ? targeting.testimonials.slice(0, 3) : [];
      setTestimonials([
        rawTestimonials[0] || { quote: '', author: '', role: '' },
        rawTestimonials[1] || { quote: '', author: '', role: '' },
        rawTestimonials[2] || { quote: '', author: '', role: '' },
      ]);
      const trustPoints = Array.isArray((agencyProfileConfig as any).trust_points)
        ? (agencyProfileConfig as any).trust_points.slice(0, 3).map((value: unknown) => String(value || ''))
        : [];
      const galleryUrls = Array.isArray((agencyProfileConfig as any).gallery_urls)
        ? (agencyProfileConfig as any).gallery_urls.slice(0, 3).map((value: unknown) => String(value || ''))
        : [];
      setAgencyProfile({
        years_in_business: String((agencyProfileConfig as any).years_in_business || ''),
        response_time: String((agencyProfileConfig as any).response_time || ''),
        licensed_states_text: String((agencyProfileConfig as any).licensed_states_text || ''),
        service_area_summary: String((agencyProfileConfig as any).service_area_summary || ''),
        cta_label: String((agencyProfileConfig as any).cta_label || 'Submit qualified lead'),
        logo_url: String((agencyProfileConfig as any).logo_url || ''),
        banner_url: String((agencyProfileConfig as any).banner_url || ''),
        theme_accent: String((agencyProfileConfig as any).theme_accent || '#131921'),
        gallery_urls: [galleryUrls[0] || '', galleryUrls[1] || '', galleryUrls[2] || ''],
        trust_points: [trustPoints[0] || '', trustPoints[1] || '', trustPoints[2] || ''],
      });
      if (matchingCampaign?.vertical) setSelectedVertical(String(matchingCampaign.vertical));
    }
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        await loadPage();
      } catch (err: any) {
        if (!alive) return;
        setError(err?.message || 'Unable to load insurance setup');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const pricingPreview = useMemo(() => {
    const leadPrice = Number(form.lead_price || 0);
    const leadPriceCents = dollarsToCents(leadPrice);
    const affiliateScenario = computeInsuranceLeadSplitCents({
      leadPriceCents,
      hasAffiliate: true,
      hasInfluencer: true,
      minBeezioFeeCents: Number(adminSettings?.minBeezioFeeCents || 100),
    });
    const directScenario = computeInsuranceLeadSplitCents({
      leadPriceCents,
      hasAffiliate: false,
      hasInfluencer: true,
      minBeezioFeeCents: Number(adminSettings?.minBeezioFeeCents || 100),
    });
    return {
      leadPrice,
      affiliateScenario: {
        beezio: affiliateScenario.beezioFeeCents / 100,
        paypal: affiliateScenario.paypalFeeCents / 100,
        influencer: affiliateScenario.influencerPayoutCents / 100,
        affiliate: affiliateScenario.affiliatePayoutCents / 100,
      },
      directScenario: {
        beezio: directScenario.beezioFeeCents / 100,
        paypal: directScenario.paypalFeeCents / 100,
        influencer: directScenario.influencerPayoutCents / 100,
        agentRetained: directScenario.agentRetainedCents / 100,
      },
    };
  }, [form.lead_price, adminSettings]);

  const pricingGuidance = useMemo(() => {
    const leadPrice = Number(form.lead_price || 0);
    const leadPriceCents = dollarsToCents(leadPrice);
    const validation = validateInsuranceLeadPricing({
      leadPriceCents,
      minLeadPriceCents: Number(adminSettings?.minLeadPriceCents || 500),
      minBeezioFeeCents: Number(adminSettings?.minBeezioFeeCents || 100),
      minAffiliatePayoutCents: Number(adminSettings?.minAffiliatePayoutCents || 200),
      hasAffiliate: true,
      hasInfluencer: true,
    });

    if (!leadPrice || leadPrice <= 0) {
      return {
        tone: 'neutral',
        title: 'Enter a lead price',
        message: 'Set the total amount you want to pay for each qualified lead.',
      };
    }

    if (!validation.ok) {
      return {
        tone: 'danger',
        title: 'Price is too low',
        message: validation.reason || 'Increase the lead price so the split works.',
      };
    }

    if (pricingPreview.affiliateScenario.affiliate < 10) {
      return {
        tone: 'warn',
        title: 'Weak affiliate pull',
        message: 'This may work, but it is on the low side if you want affiliates to actively promote the offer.',
      };
    }

    if (pricingPreview.affiliateScenario.affiliate < 17) {
      return {
        tone: 'good',
        title: 'Workable pricing',
        message: 'This is a reasonable middle range for qualified lead campaigns.',
      };
    }

    return {
      tone: 'strong',
      title: 'Strong affiliate-facing price',
      message: 'This price should be easier to promote because the affiliate-side payout is meaningful.',
    };
  }, [adminSettings, form.lead_price, pricingPreview.affiliateScenario.affiliate]);

  const walletLeadCapacity = useMemo(() => {
    const leadPrice = Number(form.lead_price || 0);
    if (!leadPrice || leadPrice <= 0) return 0;
    return Math.floor(walletBalance / leadPrice);
  }, [form.lead_price, walletBalance]);

  const verticalPriceGuide = useMemo(
    () => {
      const baseGuide = VERTICAL_PRICE_GUIDE[selectedVertical] || VERTICAL_PRICE_GUIDE.life;
      const multiplier = TIER_PRICE_MULTIPLIER[qualityTiers.default_tier] || 1;
      return {
        ...baseGuide,
        recommended: Math.round(baseGuide.recommended * multiplier),
        presets: baseGuide.presets.map((value) => Math.round(value * multiplier)),
        range: qualityTiers.default_tier === 'verified'
          ? `${baseGuide.range} entry-tier`
          : qualityTiers.default_tier === 'high_intent'
            ? `${baseGuide.range} premium-tier`
            : `${baseGuide.range} standard-tier`,
      };
    },
    [qualityTiers.default_tier, selectedVertical]
  );

  const storefrontLinks = useMemo(() => {
    const slug = String(form.slug || '').trim();
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const path = slug ? `/insurance/${encodeURIComponent(slug)}` : '';
    const direct = slug && origin ? `${origin}${path}` : '';
    const affiliate = direct ? `${direct}?ref=affiliate-id` : '';
    return { direct, affiliate };
  }, [form.slug]);

  const storefrontPreview = useMemo(() => {
    const preview = VERTICAL_PREVIEW[selectedVertical] || VERTICAL_PREVIEW.life;
    const visibleFields = [
      'First name',
      'Last name',
      'Email',
      'Phone',
      'State',
      questionnaire.ask_zip_code ? 'ZIP code' : null,
      questionnaire.ask_age_range ? 'Age range' : null,
      questionnaire.ask_timeline ? 'Coverage timeline' : null,
      questionnaire.ask_current_coverage ? 'Current coverage' : null,
      questionnaire.ask_best_contact_time ? 'Best contact time' : null,
      selectedVertical === 'auto' && questionnaire.ask_current_insurer ? 'Current auto insurer' : null,
      selectedVertical === 'auto' && questionnaire.ask_vehicles_count ? 'Vehicle count' : null,
      selectedVertical === 'home' && questionnaire.ask_homeowner_status ? 'Homeowner or renter' : null,
      selectedVertical === 'home' && questionnaire.ask_current_insurer ? 'Current home insurer' : null,
      selectedVertical === 'life' && questionnaire.ask_dependents ? 'Dependents' : null,
      selectedVertical === 'health' && questionnaire.ask_household_size ? 'Household size' : null,
      questionnaire.ask_notes ? 'Notes for the agent' : null,
    ].filter(Boolean) as string[];

    const trustLine = [
      questionnaire.single_agent_only ? 'Only this agent can contact the shopper.' : null,
      questionnaire.no_spam_calling ? 'No spam calls or random agent blast.' : null,
      questionnaire.twilio_verified_only ? 'Twilio phone verification required before submit.' : null,
    ].filter(Boolean).join(' ');

    return {
      ...preview,
      visibleFields,
      trustLine,
    };
  }, [questionnaire, selectedVertical]);

  const pricingExamples = useMemo(() => {
    return [15, 20, 30].map((leadPrice) => {
      const leadPriceCents = dollarsToCents(leadPrice);
      const affiliateScenario = computeInsuranceLeadSplitCents({
        leadPriceCents,
        hasAffiliate: true,
        hasInfluencer: true,
        minBeezioFeeCents: Number(adminSettings?.minBeezioFeeCents || 100),
      });
      const directScenario = computeInsuranceLeadSplitCents({
        leadPriceCents,
        hasAffiliate: false,
        hasInfluencer: true,
        minBeezioFeeCents: Number(adminSettings?.minBeezioFeeCents || 100),
      });
      return {
        leadPrice,
        beezio: affiliateScenario.beezioFeeCents / 100,
        paypal: affiliateScenario.paypalFeeCents / 100,
        influencer: affiliateScenario.influencerPayoutCents / 100,
        affiliate: affiliateScenario.affiliatePayoutCents / 100,
        directRetained: directScenario.agentRetainedCents / 100,
      };
    });
  }, [adminSettings]);

  const leadStats = useMemo(() => {
    return {
      total: leads.length,
      review: leads.filter((lead) => {
        const status = String(lead?.status || '').toLowerCase();
        const reviewStatus = String(lead?.review_status || '').toLowerCase();
        return status !== 'delivered' && status !== 'invalid' && (reviewStatus === 'flagged' || status === 'submitted');
      }).length,
      delivered: leads.filter((lead) => String(lead?.status || '').toLowerCase() === 'delivered').length,
      invalid: leads.filter((lead) => String(lead?.status || '').toLowerCase() === 'invalid').length,
    };
  }, [leads]);

  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      const status = String(lead?.status || '').toLowerCase();
      const reviewStatus = String(lead?.review_status || '').toLowerCase();
      if (leadFilter === 'review') return status !== 'delivered' && status !== 'invalid' && (reviewStatus === 'flagged' || status === 'submitted');
      if (leadFilter === 'delivered') return status === 'delivered';
      if (leadFilter === 'invalid') return status === 'invalid';
      return true;
    });
  }, [leadFilter, leads]);

  const analyticsOverview = agentAnalytics?.overview || {};
  const analyticsByVertical = Array.isArray(agentAnalytics?.by_vertical) ? agentAnalytics.by_vertical : [];
  const analyticsByDay = Array.isArray(agentAnalytics?.by_day) ? agentAnalytics.by_day : [];
  const analyticsCampaigns = Array.isArray(agentAnalytics?.campaigns) ? agentAnalytics.campaigns : [];
  const currentStepIndex = Math.max(SETUP_STEPS.findIndex((step) => step.id === currentSetupStep), 0);
  const activeStepMeta = SETUP_STEPS[currentStepIndex] || SETUP_STEPS[0];

  const handleCopyLink = async (kind: 'direct' | 'affiliate') => {
    const value = kind === 'direct' ? storefrontLinks.direct : storefrontLinks.affiliate;
    const copied = await copyTextToClipboard(value);
    if (!copied) {
      setError('Unable to copy link.');
      return;
    }
    setCopiedLink(kind);
    setTimeout(() => {
      setCopiedLink((current) => (current === kind ? null : current));
    }, 1800);
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = String(sessionData?.session?.access_token || '').trim();
      if (!token) throw new Error('Please sign in as a seller or admin.');

      const res = await fetch('/api/insurance/agent-listing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...form,
          vertical: selectedVertical,
          lead_price: Number(form.lead_price || 0),
          daily_cap: Number(form.daily_cap || 0) || null,
          questionnaire,
          quality_tiers: qualityTiers,
          testimonials,
          agency_profile: agencyProfile,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String(payload?.error || 'Unable to save insurance listing'));
      setSuccess('Insurance campaign saved.');
      await loadPage();
    } catch (err: any) {
      setError(err?.message || 'Unable to save insurance listing');
    } finally {
      setSaving(false);
    }
  };

  const handleFundWallet = async () => {
    setFunding(true);
    setError(null);
    setSuccess(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = String(sessionData?.session?.access_token || '').trim();
      if (!token) throw new Error('Please sign in as a seller or admin.');
      const res = await fetch('/api/insurance/agent-listing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: 'fund_wallet',
          amount: Number(fundAmount || 0),
          notes: 'Admin-funded prepaid wallet',
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String(payload?.error || 'Unable to fund wallet'));
      setSuccess('Wallet funded.');
      await loadPage();
    } catch (err: any) {
      setError(err?.message || 'Unable to fund wallet');
    } finally {
      setFunding(false);
    }
  };

  const handleBuyPackage = async (packageTemplateId: string) => {
    setError(null);
    setSuccess(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = String(sessionData?.session?.access_token || '').trim();
      if (!token) throw new Error('Please sign in as a seller or admin.');
      const res = await fetch('/api/insurance/agent-listing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: 'buy_package',
          package_template_id: packageTemplateId,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String(payload?.error || 'Unable to buy package'));
      setSuccess('Package purchased and funded.');
      await loadPage();
    } catch (err: any) {
      setError(err?.message || 'Unable to buy package');
    }
  };

  const handleSaveTemplate = async (event: React.FormEvent) => {
    event.preventDefault();
    setTemplateSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = String(sessionData?.session?.access_token || '').trim();
      if (!token) throw new Error('Please sign in as a seller or admin.');
      const res = await fetch('/api/insurance/package-templates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: templateForm.name,
          vertical: templateForm.vertical,
          qualified_lead_count: Number(templateForm.qualified_lead_count || 0),
          package_price: Number(templateForm.package_price || 0),
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String(payload?.error || 'Unable to save template'));
      setSuccess('Package template saved.');
      setTemplateForm({
        name: '',
        vertical: 'life',
        qualified_lead_count: '25',
        package_price: '250',
      });
      await loadPage();
    } catch (err: any) {
      setError(err?.message || 'Unable to save template');
    } finally {
      setTemplateSaving(false);
    }
  };

  const handleResolveDispute = async (disputeId: string, resolution: 'approved' | 'denied') => {
    setError(null);
    setSuccess(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = String(sessionData?.session?.access_token || '').trim();
      if (!token) throw new Error('Please sign in as a seller or admin.');
      const res = await fetch('/api/insurance/disputes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: 'resolve',
          dispute_id: disputeId,
          resolution,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String(payload?.error || 'Unable to resolve dispute'));
      setSuccess(`Dispute ${resolution}.`);
      await loadPage();
    } catch (err: any) {
      setError(err?.message || 'Unable to resolve dispute');
    }
  };

  const handleLeadAction = async (leadId: string, action: 'approve' | 'reject') => {
    setActingLeadId(leadId);
    setError(null);
    setSuccess(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = String(sessionData?.session?.access_token || '').trim();
      if (!token) throw new Error('Please sign in as a seller or admin.');
      const res = await fetch('/api/insurance/leads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action,
          lead_id: leadId,
          notes: String(leadActionNotes[leadId] || '').trim() || null,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String(payload?.error || `Unable to ${action} lead`));
      if (action === 'approve') {
        const reason = String(payload?.processed?.reason || '').trim();
        setSuccess(reason && reason !== 'already_delivered' ? `Lead approval processed: ${reason}.` : 'Lead approved.');
      } else {
        setSuccess('Lead rejected.');
      }
      setLeadActionNotes((current) => ({ ...current, [leadId]: '' }));
      await loadPage();
    } catch (err: any) {
      setError(err?.message || `Unable to ${action} lead`);
    } finally {
      setActingLeadId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#eaeded]">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">Separate Insurance Workflow</p>
          <h1 className="mt-3 text-4xl font-black text-slate-900">Insurance agent control panel</h1>
          <p className="mt-4 max-w-4xl text-slate-600">
            Build a free public insurance website first, then activate Beezio lead delivery by funding credits. This separate workspace handles the storefront, wallet credits, and agent-side campaign flow.
          </p>
          <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
            You set one total price per qualified lead. Internal splits stay on the Beezio side so platform pricing can improve over time without broadcasting trade-sensitive details. Agents are only charged after Twilio phone verification, qualification checks, and successful lead delivery.
          </div>
          <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Product custom stores use cart checkout and fulfillment. Insurance agent pages use verified lead intake, qualified delivery, wallet charging, and dispute handling.
          </div>
          <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
            Your insurance store can be shared two ways: affiliate links and your direct agent link. The same verified questionnaire page is used in both cases, but the system now tracks whether the lead came from an affiliate or from your own direct storefront traffic.
          </div>
          <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
            Each agent page acts like a custom insurance site. The site can stay live as free content, but Beezio only routes leads after the wallet has enough credits to cover delivery.
          </div>
        </div>

        {error && <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        {success && <div className="mt-6 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{success}</div>}

        <div className="mt-8 grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <form className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm" onSubmit={handleSave}>
            <h2 className="text-2xl font-bold text-slate-900">Agent site and campaign</h2>
            <div className="mt-3 text-sm text-slate-600">
              Build the storefront in steps so the page reads like a real insurance website instead of one long admin form.
            </div>
            <div className="mt-5 rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap gap-3">
                {SETUP_STEPS.map((step, index) => {
                  const isActive = step.id === currentSetupStep;
                  const isComplete = index < currentStepIndex;
                  return (
                    <button
                      key={step.id}
                      type="button"
                      onClick={() => setCurrentSetupStep(step.id)}
                      className={`flex min-w-[180px] flex-1 rounded-2xl border px-4 py-3 text-left ${
                        isActive
                          ? 'border-[#131921] bg-[#131921] text-white'
                          : isComplete
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                            : 'border-slate-200 bg-white text-slate-700'
                      }`}
                    >
                      <span>
                        <span className="block text-[11px] font-semibold uppercase tracking-[0.2em] opacity-70">Step {index + 1}</span>
                        <span className="mt-1 block text-sm font-semibold">{step.label}</span>
                        <span className="mt-1 block text-xs opacity-80">{step.description}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="mt-4 rounded-2xl bg-white px-4 py-3 text-sm text-slate-700">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Current step</div>
                <div className="mt-1 font-semibold text-slate-900">{activeStepMeta.label}</div>
                <div className="mt-1 text-xs text-slate-500">{activeStepMeta.description}</div>
              </div>
            </div>
            <div className="mt-6 space-y-4">
              {currentSetupStep === 'basics' && (
                <>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                    Start with the business details and the lead offer. This is the operational layer that determines what kind of insurance page you are building.
                  </div>
                  <input className="w-full rounded-2xl border border-gray-300 px-4 py-3" placeholder="Agency name" value={form.agency_name} onChange={(e) => setForm((current) => ({ ...current, agency_name: e.target.value }))} />
                  <input className="w-full rounded-2xl border border-gray-300 px-4 py-3" placeholder="Slug" value={form.slug} onChange={(e) => setForm((current) => ({ ...current, slug: e.target.value }))} />
                  <div className="grid gap-4 md:grid-cols-2">
                    <input className="rounded-2xl border border-gray-300 px-4 py-3" placeholder="Contact name" value={form.contact_name} onChange={(e) => setForm((current) => ({ ...current, contact_name: e.target.value }))} />
                    <input className="rounded-2xl border border-gray-300 px-4 py-3" placeholder="Contact email" value={form.contact_email} onChange={(e) => setForm((current) => ({ ...current, contact_email: e.target.value }))} />
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <input className="rounded-2xl border border-gray-300 px-4 py-3" placeholder="Contact phone" value={form.contact_phone} onChange={(e) => setForm((current) => ({ ...current, contact_phone: e.target.value }))} />
                    <input className="rounded-2xl border border-gray-300 px-4 py-3" placeholder="Website URL" value={form.website_url} onChange={(e) => setForm((current) => ({ ...current, website_url: e.target.value }))} />
                  </div>
                  <textarea className="min-h-[100px] w-full rounded-2xl border border-gray-300 px-4 py-3" placeholder="Bio" value={form.bio} onChange={(e) => setForm((current) => ({ ...current, bio: e.target.value }))} />
                  <div className="grid gap-4 md:grid-cols-2">
                    <input className="rounded-2xl border border-gray-300 px-4 py-3" placeholder="Specialties" value={form.specialties} onChange={(e) => setForm((current) => ({ ...current, specialties: e.target.value }))} />
                    <input className="rounded-2xl border border-gray-300 px-4 py-3" placeholder="States served" value={form.states_served} onChange={(e) => setForm((current) => ({ ...current, states_served: e.target.value }))} />
                  </div>
                  <div className="grid gap-4 md:grid-cols-3">
                    <select className="rounded-2xl border border-gray-300 px-4 py-3" value={selectedVertical} onChange={(e) => setSelectedVertical(e.target.value)}>
                      {INSURANCE_VERTICALS.map((vertical) => (
                        <option key={vertical} value={vertical}>{humanizeInsuranceVertical(vertical)}</option>
                      ))}
                    </select>
                    <input className="rounded-2xl border border-gray-300 px-4 py-3" placeholder="Lead price" value={form.lead_price} onChange={(e) => setForm((current) => ({ ...current, lead_price: e.target.value }))} />
                    <input className="rounded-2xl border border-gray-300 px-4 py-3" placeholder="Daily cap" value={form.daily_cap} onChange={(e) => setForm((current) => ({ ...current, daily_cap: e.target.value }))} />
                  </div>
                  <div
                    className={`rounded-2xl px-4 py-3 text-sm ${
                      pricingGuidance.tone === 'danger'
                        ? 'border border-red-200 bg-red-50 text-red-700'
                        : pricingGuidance.tone === 'warn'
                          ? 'border border-amber-200 bg-amber-50 text-amber-800'
                          : pricingGuidance.tone === 'strong'
                            ? 'border border-emerald-200 bg-emerald-50 text-emerald-800'
                            : pricingGuidance.tone === 'good'
                              ? 'border border-sky-200 bg-sky-50 text-sky-800'
                              : 'border border-slate-200 bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="font-semibold">{pricingGuidance.title}</div>
                    <div className="mt-1">{pricingGuidance.message}</div>
                    {Number(form.lead_price || 0) > 0 && (
                      <div className="mt-2 text-xs">
                        Current wallet can cover about <strong>{walletLeadCapacity}</strong> lead{walletLeadCapacity === 1 ? '' : 's'} at this price.
                      </div>
                    )}
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                    <div className="text-sm font-semibold text-slate-900">{humanizeInsuranceVertical(selectedVertical)} lead pricing guide</div>
                    <div className="mt-1">Suggested range: <strong>{verticalPriceGuide.range}</strong></div>
                    <div className="mt-1">Recommended starting price for {TIER_LABELS[qualityTiers.default_tier]}: <strong>{formatMoney(verticalPriceGuide.recommended)}</strong></div>
                    <div className="mt-2 text-xs text-slate-600">{verticalPriceGuide.reason}</div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {verticalPriceGuide.presets.map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setForm((current) => ({ ...current, lead_price: preset.toFixed(2) }))}
                          className="rounded-full border border-[#131921] px-4 py-2 text-xs font-semibold text-[#131921]"
                        >
                          Use {formatMoney(preset)}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
              {currentSetupStep === 'branding' && (
                <>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                    This is the actual site-builder step. Upload the hero images, add gallery photos, and tighten the headline so affiliates have a page that looks promotable.
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm font-semibold text-slate-900">Storefront branding and photos</div>
                <p className="mt-1 text-xs text-slate-600">
                  This is the custom insurance site builder section. Add a banner, logo, and accent color so your page looks like a real branded storefront instead of a generic lead form.
                </p>
                <div className="mt-4 grid gap-6 lg:grid-cols-2">
                  <ImageUploader
                    currentImageUrl={agencyProfile.banner_url}
                    onImageUpload={(url) => setAgencyProfile((current) => ({ ...current, banner_url: url }))}
                    label="Hero banner"
                    aspectRatio="banner"
                    bucketName="store-banners"
                    folderPath="insurance-banners"
                  />
                  <ImageUploader
                    currentImageUrl={agencyProfile.logo_url}
                    onImageUpload={(url) => setAgencyProfile((current) => ({ ...current, logo_url: url }))}
                    label="Agency logo"
                    aspectRatio="logo"
                    bucketName="store-branding"
                    folderPath="insurance-logos"
                  />
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-[180px_1fr]">
                  <label className="flex flex-col gap-2 text-sm text-slate-700">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Accent color</span>
                    <input
                      type="color"
                      className="h-12 w-full rounded-xl border border-gray-300 bg-white p-1"
                      value={agencyProfile.theme_accent || '#131921'}
                      onChange={(e) => setAgencyProfile((current) => ({ ...current, theme_accent: e.target.value }))}
                    />
                  </label>
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600">
                    Use the banner for the hero section, the logo for your brand mark, and the accent color for buttons and callout panels. This gives affiliates a cleaner page to promote and makes the agent site feel like a real insurance website.
                  </div>
                </div>
                    <div className="mt-4">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Supporting image gallery</div>
                      <div className="mt-2 text-xs text-slate-600">
                        Add office photos, family-service imagery, or brand proof to make the storefront feel like a real agency website.
                      </div>
                      <div className="mt-4 grid gap-6 lg:grid-cols-3">
                        {agencyProfile.gallery_urls.map((imageUrl, index) => (
                          <ImageUploader
                            key={`insurance-gallery-${index}`}
                            currentImageUrl={imageUrl}
                            onImageUpload={(url) =>
                              setAgencyProfile((current) => ({
                                ...current,
                                gallery_urls: current.gallery_urls.map((entry, entryIndex) => entryIndex === index ? url : entry),
                              }))
                            }
                            label={`Gallery image ${index + 1}`}
                            aspectRatio="square"
                            bucketName="store-branding"
                            folderPath="insurance-gallery"
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <input className="rounded-2xl border border-gray-300 px-4 py-3" placeholder="Hero title" value={form.hero_title} onChange={(e) => setForm((current) => ({ ...current, hero_title: e.target.value }))} />
                    <input className="rounded-2xl border border-gray-300 px-4 py-3" placeholder="Hero subtitle" value={form.hero_subtitle} onChange={(e) => setForm((current) => ({ ...current, hero_subtitle: e.target.value }))} />
                  </div>
                  <textarea className="min-h-[90px] w-full rounded-2xl border border-gray-300 px-4 py-3" placeholder="Disclaimer" value={form.disclaimer} onChange={(e) => setForm((current) => ({ ...current, disclaimer: e.target.value }))} />
                </>
              )}
              {currentSetupStep === 'proof' && (
                <>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                    This step is where the page becomes persuasive. Give shoppers reasons to choose this agent and give affiliates talking points worth sharing.
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm font-semibold text-slate-900">Agency credibility and why shoppers should choose you</div>
                <p className="mt-1 text-xs text-slate-600">
                  These fields give affiliates something real to promote and tell vetted shoppers why they should speak with you instead of another insurance page.
                </p>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <input className="rounded-2xl border border-gray-300 px-4 py-3" placeholder="Years in business" value={agencyProfile.years_in_business} onChange={(e) => setAgencyProfile((current) => ({ ...current, years_in_business: e.target.value }))} />
                  <input className="rounded-2xl border border-gray-300 px-4 py-3" placeholder="Typical response time" value={agencyProfile.response_time} onChange={(e) => setAgencyProfile((current) => ({ ...current, response_time: e.target.value }))} />
                  <input className="rounded-2xl border border-gray-300 px-4 py-3" placeholder="Licensed states text" value={agencyProfile.licensed_states_text} onChange={(e) => setAgencyProfile((current) => ({ ...current, licensed_states_text: e.target.value }))} />
                  <input className="rounded-2xl border border-gray-300 px-4 py-3" placeholder="CTA button label" value={agencyProfile.cta_label} onChange={(e) => setAgencyProfile((current) => ({ ...current, cta_label: e.target.value }))} />
                </div>
                <textarea className="mt-3 min-h-[90px] w-full rounded-2xl border border-gray-300 px-4 py-3" placeholder="Service area summary" value={agencyProfile.service_area_summary} onChange={(e) => setAgencyProfile((current) => ({ ...current, service_area_summary: e.target.value }))} />
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  {agencyProfile.trust_points.map((entry, index) => (
                    <input
                      key={index}
                      className="rounded-2xl border border-gray-300 px-4 py-3"
                      placeholder={`Why choose you point ${index + 1}`}
                      value={entry}
                      onChange={(e) =>
                        setAgencyProfile((current) => ({
                          ...current,
                          trust_points: current.trust_points.map((point, pointIndex) => pointIndex === index ? e.target.value : point),
                        }))
                      }
                    />
                  ))}
                </div>
                <div className="mt-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600">
                  Strong examples: local specialization, policy review approach, fast response window, family coverage focus, bilingual support, or a clear no-spam single-agent promise.
                </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm font-semibold text-slate-900">Client quotes and proof</div>
                <p className="mt-1 text-xs text-slate-600">
                  If the agent has legitimate review or quote data, add up to three proof quotes to make the page look more established and trustworthy.
                </p>
                <div className="mt-4 space-y-3">
                  {testimonials.map((entry, index) => (
                    <div key={index} className="rounded-2xl bg-white p-4">
                      <textarea
                        className="min-h-[90px] w-full rounded-2xl border border-gray-300 px-4 py-3"
                        placeholder={`Quote ${index + 1}`}
                        value={entry.quote}
                        onChange={(e) =>
                          setTestimonials((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, quote: e.target.value } : item))
                        }
                      />
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <input
                          className="rounded-2xl border border-gray-300 px-4 py-3"
                          placeholder="Customer or source name"
                          value={entry.author}
                          onChange={(e) =>
                            setTestimonials((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, author: e.target.value } : item))
                          }
                        />
                        <input
                          className="rounded-2xl border border-gray-300 px-4 py-3"
                          placeholder="Role, city, or proof label"
                          value={entry.role}
                          onChange={(e) =>
                            setTestimonials((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, role: e.target.value } : item))
                          }
                        />
                      </div>
                    </div>
                  ))}
                </div>
                  </div>
                </>
              )}
              {currentSetupStep === 'rules' && (
                <>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                    Finalize the lead intake rules, the compliance language, and whether the page is ready to accept live traffic.
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm font-semibold text-slate-900">Questionnaire controls</div>
                <p className="mt-1 text-xs text-slate-600">
                  Choose what appears on the public insurance form. The consent language below tells the shopper that only this agent will contact them after Twilio phone verification, not random callers.
                </p>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {[
                    ['ask_age_range', 'Ask age range'],
                    ['ask_timeline', 'Ask coverage timeline'],
                    ['ask_current_coverage', 'Ask current coverage'],
                    ['ask_best_contact_time', 'Ask best contact time'],
                    ['ask_zip_code', 'Ask ZIP code'],
                    ['ask_notes', 'Ask needs / notes'],
                    ['ask_current_insurer', 'Ask current insurer'],
                    ['ask_vehicles_count', 'Ask vehicle count'],
                    ['ask_homeowner_status', 'Ask homeowner / renter'],
                    ['ask_dependents', 'Ask dependents'],
                    ['ask_household_size', 'Ask household size'],
                  ].map(([key, label]) => (
                    <label key={key} className="flex items-start gap-3 rounded-2xl bg-white px-4 py-3 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={Boolean((questionnaire as any)[key])}
                        onChange={(e) => setQuestionnaire((current) => ({ ...current, [key]: e.target.checked }))}
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <label className="flex items-start gap-3 rounded-2xl bg-white px-4 py-3 text-sm text-slate-700">
                    <input type="checkbox" checked={questionnaire.single_agent_only} onChange={(e) => setQuestionnaire((current) => ({ ...current, single_agent_only: e.target.checked }))} />
                    <span>Tell shoppers only this agent will contact them</span>
                  </label>
                  <label className="flex items-start gap-3 rounded-2xl bg-white px-4 py-3 text-sm text-slate-700">
                    <input type="checkbox" checked={questionnaire.no_spam_calling} onChange={(e) => setQuestionnaire((current) => ({ ...current, no_spam_calling: e.target.checked }))} />
                    <span>Show no spam or cold calling promise</span>
                  </label>
                  <label className="flex items-start gap-3 rounded-2xl bg-white px-4 py-3 text-sm text-slate-700">
                    <input type="checkbox" checked={questionnaire.twilio_verified_only} onChange={(e) => setQuestionnaire((current) => ({ ...current, twilio_verified_only: e.target.checked }))} />
                    <span>Highlight Twilio phone verification</span>
                  </label>
                </div>
              </div>
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <div className="text-sm font-semibold text-slate-900">Compliance and moderation guardrails</div>
                <p className="mt-1 text-xs text-slate-700">
                  This insurance page is for vetted warm inbound quote requests only. Affiliates and agents should not position this as cold lead traffic, a bought lead list, or guaranteed approval.
                </p>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl bg-white p-4 text-sm text-slate-700">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Allowed positioning</div>
                    <div className="mt-2">Verified inbound shoppers</div>
                    <div className="mt-1">One-agent contact after qualification</div>
                    <div className="mt-1">Phone verified and screened before delivery</div>
                    <div className="mt-1">Coverage guidance and quote review, not spam outreach</div>
                  </div>
                  <div className="rounded-2xl bg-white p-4 text-sm text-slate-700">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Do not promise</div>
                    <div className="mt-2">Guaranteed approval or guaranteed coverage</div>
                    <div className="mt-1">Cold leads, lead lists, or bulk contact data</div>
                    <div className="mt-1">Random multi-agent blast distribution</div>
                    <div className="mt-1">Government or regulatory approval you do not actually hold</div>
                  </div>
                </div>
                <div className="mt-4 rounded-2xl bg-white p-4 text-sm text-slate-700">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Billing rule</div>
                  <div className="mt-2">Lead balance is used only after qualification and delivery.</div>
                  <div className="mt-1">Unused balance stays on the account until used.</div>
                  <div className="mt-1">Approved invalid-lead disputes restore credit to the wallet instead of issuing a cash refund.</div>
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm font-semibold text-slate-900">Lead quality tiers</div>
                <p className="mt-1 text-xs text-slate-600">
                  You can offer all three tiers on the same insurance store. The default tier drives the main pricing guidance and storefront language.
                </p>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <label className="flex items-start gap-3 rounded-2xl bg-white px-4 py-3 text-sm text-slate-700">
                    <input type="checkbox" checked={qualityTiers.verified} onChange={(e) => setQualityTiers((current) => ({ ...current, verified: e.target.checked }))} />
                    <span><strong>Verified</strong><br />Twilio verified, consented, screened.</span>
                  </label>
                  <label className="flex items-start gap-3 rounded-2xl bg-white px-4 py-3 text-sm text-slate-700">
                    <input type="checkbox" checked={qualityTiers.qualified} onChange={(e) => setQualityTiers((current) => ({ ...current, qualified: e.target.checked }))} />
                    <span><strong>Qualified</strong><br />Balanced quality and volume for most campaigns.</span>
                  </label>
                  <label className="flex items-start gap-3 rounded-2xl bg-white px-4 py-3 text-sm text-slate-700">
                    <input type="checkbox" checked={qualityTiers.high_intent} onChange={(e) => setQualityTiers((current) => ({ ...current, high_intent: e.target.checked }))} />
                    <span><strong>High Intent</strong><br />Stricter intake for stronger buyer signals.</span>
                  </label>
                </div>
                <div className="mt-4">
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Default storefront tier</label>
                  <select
                    className="mt-2 w-full rounded-2xl border border-gray-300 px-4 py-3"
                    value={qualityTiers.default_tier}
                    onChange={(e) => setQualityTiers((current) => ({ ...current, default_tier: e.target.value as 'verified' | 'qualified' | 'high_intent' }))}
                  >
                    {(['verified', 'qualified', 'high_intent'] as const)
                      .filter((tier) => qualityTiers[tier])
                      .map((tier) => (
                        <option key={tier} value={tier}>{TIER_LABELS[tier]}</option>
                      ))}
                  </select>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="flex items-start gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  <input type="checkbox" checked={form.accepts_new_leads} onChange={(e) => setForm((current) => ({ ...current, accepts_new_leads: e.target.checked }))} />
                  <span>Accept new leads</span>
                </label>
                <label className="flex items-start gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  <input type="checkbox" checked={form.is_active} onChange={(e) => setForm((current) => ({ ...current, is_active: e.target.checked }))} />
                  <span>Campaign active</span>
                </label>
              </div>
              </>
              )}
              <div className="flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-xs text-slate-500">
                  Step {currentStepIndex + 1} of {SETUP_STEPS.length}
                </div>
                <div className="flex flex-wrap gap-3">
                  {currentStepIndex > 0 && (
                    <button
                      type="button"
                      onClick={() => setCurrentSetupStep(SETUP_STEPS[currentStepIndex - 1].id)}
                      className="rounded-full border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700"
                    >
                      Back
                    </button>
                  )}
                  {currentStepIndex < SETUP_STEPS.length - 1 ? (
                    <button
                      type="button"
                      onClick={() => setCurrentSetupStep(SETUP_STEPS[currentStepIndex + 1].id)}
                      className="rounded-full bg-[#131921] px-5 py-3 text-sm font-semibold text-white"
                    >
                      Next step
                    </button>
                  ) : (
                    <button type="submit" disabled={saving || loading} className="rounded-full bg-[#131921] px-5 py-4 text-sm font-semibold text-white disabled:opacity-60">
                      {saving ? 'Saving...' : 'Save listing and campaign'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </form>

          <div className="space-y-6">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-2xl font-bold text-slate-900">Storefront sharing</h2>
              <div className="mt-4 space-y-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Direct agent storefront</div>
                  <div className="mt-2 break-all font-medium text-slate-900">
                    {storefrontLinks.direct || 'Save a slug first to generate the direct storefront link.'}
                  </div>
                  <div className="mt-2 text-xs text-slate-500">
                    Share this when the agent is driving their own traffic. The lead stays on the direct storefront path with the same qualification and billing rules.
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopyLink('direct')}
                    disabled={!storefrontLinks.direct}
                    className="mt-3 rounded-full border border-[#131921] px-4 py-2 text-xs font-semibold text-[#131921] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {copiedLink === 'direct' ? 'Copied' : 'Copy direct link'}
                  </button>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Affiliate share pattern</div>
                  <div className="mt-2 break-all font-medium text-slate-900">
                    {storefrontLinks.affiliate || 'Save a slug first to generate the affiliate share pattern.'}
                  </div>
                  <div className="mt-2 text-xs text-slate-500">
                    Affiliates share this same storefront page with their own `ref` value attached so attribution can route correctly after a qualified delivery.
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopyLink('affiliate')}
                    disabled={!storefrontLinks.affiliate}
                    className="mt-3 rounded-full border border-[#131921] px-4 py-2 text-xs font-semibold text-[#131921] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {copiedLink === 'affiliate' ? 'Copied' : 'Copy affiliate pattern'}
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-2xl font-bold text-slate-900">Live storefront preview</h2>
              <div className="mt-4 rounded-3xl border border-slate-200 bg-slate-50 p-5">
                {agencyProfile.banner_url && (
                  <div className="mb-4 overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white">
                    <img src={agencyProfile.banner_url} alt="Storefront banner preview" className="h-40 w-full object-cover" />
                  </div>
                )}
                <div className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">Insurance storefront preview</div>
                {agencyProfile.logo_url && (
                  <img
                    src={agencyProfile.logo_url}
                    alt="Agency logo preview"
                    className="mt-4 h-16 w-16 rounded-2xl border border-slate-200 bg-white object-cover p-1 shadow-sm"
                  />
                )}
                <div className="mt-3 text-2xl font-black text-slate-900">
                  {form.hero_title || form.agency_name || 'Your agent insurance storefront'}
                </div>
                <div className="mt-2 text-sm text-slate-600">
                  {form.hero_subtitle || storefrontPreview.shopperIntro}
                </div>
                <div className="mt-4 rounded-2xl border border-[#ffcb05] bg-[#fff8d9] px-4 py-3 text-sm text-[#5f4a00]">
                  {storefrontPreview.trustLine || 'Verified form flow with one-agent contact promise.'}
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {(agencyProfile.years_in_business || agencyProfile.response_time) && (
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Agency credibility</div>
                      {agencyProfile.years_in_business && <div className="mt-2"><strong>{agencyProfile.years_in_business}</strong> in business</div>}
                      {agencyProfile.response_time && <div className="mt-1">Typical response: <strong>{agencyProfile.response_time}</strong></div>}
                    </div>
                  )}
                {(agencyProfile.licensed_states_text || agencyProfile.service_area_summary) && (
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Service area</div>
                    {agencyProfile.licensed_states_text && <div className="mt-2 font-medium text-slate-900">{agencyProfile.licensed_states_text}</div>}
                    {agencyProfile.service_area_summary && <div className="mt-1">{agencyProfile.service_area_summary}</div>}
                  </div>
                )}
              </div>
              {agencyProfile.gallery_urls.some((entry) => entry.trim()) && (
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  {agencyProfile.gallery_urls.filter((entry) => entry.trim()).map((entry, index) => (
                    <div key={`${entry}-${index}`} className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white">
                      <img src={entry} alt={`Storefront gallery preview ${index + 1}`} className="h-36 w-full object-cover" />
                    </div>
                  ))}
                </div>
              )}
              {agencyProfile.trust_points.some((entry) => entry.trim()) && (
                <div className="mt-4 grid gap-2 md:grid-cols-3">
                  {agencyProfile.trust_points.filter((entry) => entry.trim()).map((entry) => (
                    <div key={entry} className="rounded-2xl bg-white px-4 py-3 text-sm font-medium text-slate-800">{entry}</div>
                  ))}
                  </div>
                )}
                <div className="mt-4 flex flex-wrap gap-2">
                  {(['verified', 'qualified', 'high_intent'] as const)
                    .filter((tier) => qualityTiers[tier])
                    .map((tier) => (
                      <span
                        key={tier}
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${qualityTiers.default_tier === tier ? 'bg-[#131921] text-white' : 'bg-slate-200 text-slate-700'}`}
                      >
                        {TIER_LABELS[tier]}
                      </span>
                    ))}
                </div>
                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  This page is designed to be shared by the agent directly, by affiliates, and by influencers. Beezio keeps the same influencer fee logic here that the rest of the platform uses.
                </div>
                <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="font-semibold text-slate-900">{storefrontPreview.shopperTitle}</div>
                  <div className="mt-2 text-sm text-slate-600">{storefrontPreview.shopperIntro}</div>
                  <div className="mt-4 grid gap-2 md:grid-cols-3">
                    {storefrontPreview.checklist.map((item) => (
                      <div key={item} className="rounded-2xl bg-slate-50 px-3 py-2 text-sm font-medium text-slate-800">{item}</div>
                    ))}
                  </div>
                  <div className="mt-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Visible form fields</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {storefrontPreview.visibleFields.map((field) => (
                        <span key={field} className="rounded-full bg-[#131921] px-3 py-1 text-xs font-semibold text-white">{field}</span>
                      ))}
                    </div>
                  </div>
                  {testimonials.some((entry) => entry.quote.trim()) && (
                    <div className="mt-4">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Proof quotes preview</div>
                      <div className="mt-2 grid gap-3">
                        {testimonials.filter((entry) => entry.quote.trim()).map((entry, index) => (
                          <div key={index} className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
                            <div className="font-medium text-slate-900">"{entry.quote}"</div>
                            <div className="mt-2 text-xs text-slate-500">{entry.author || 'Customer'}{entry.role ? ` • ${entry.role}` : ''}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {questionnaire.ask_notes && (
                    <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                      Notes prompt: {storefrontPreview.notesPlaceholder}
                    </div>
                  )}
                  <div className="mt-4 text-xs text-slate-500">
                    Shopper consent line preview: {form.disclaimer || 'By submitting, you agree a licensed agent may contact you about coverage options.'}
                  </div>
                  <div className="mt-4">
                    <button
                      type="button"
                      className="rounded-full px-5 py-3 text-sm font-semibold text-white"
                      style={{ backgroundColor: agencyProfile.theme_accent || '#131921' }}
                    >
                      {agencyProfile.cta_label || 'Submit qualified lead'}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-2xl font-bold text-slate-900">Wallet and billing overview</h2>
              <div className="mt-4 rounded-2xl bg-[#131921] px-5 py-4 text-white">
                <div className="text-[11px] uppercase tracking-wide text-white/65">Current wallet balance</div>
                <div className="mt-2 text-3xl font-black">{formatMoney(walletBalance)}</div>
              </div>
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                <div className="text-sm font-semibold text-slate-900">How agent pricing works</div>
                <div className="mt-2">You choose one total price for each qualified lead.</div>
                <div className="mt-1">Beezio handles the internal platform split privately so agent pricing can improve over time without exposing trade-sensitive details.</div>
                <div className="mt-1">Affiliate, influencer, and direct-storefront attribution still run automatically based on the link source.</div>
                <div className="mt-1">Your view stays focused on total lead cost, wallet coverage, and whether the offer is attractive enough to promote.</div>
              </div>
              <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
                <div className="text-sm font-semibold text-slate-900">How agent payment works</div>
                <div className="mt-2">1. Publish the free insurance website.</div>
                <div className="mt-1">2. Fund the wallet when you want Beezio to route leads.</div>
                <div className="mt-1">3. A shopper completes the questionnaire and verifies the phone with Twilio.</div>
                <div className="mt-1">4. Fraud, duplicate, and qualification checks run.</div>
                <div className="mt-1">5. Only qualified delivered leads charge wallet credits.</div>
                <div className="mt-1">6. Affiliate and influencer amounts stay in hold during the dispute window.</div>
                <div className="mt-1">7. Approved disputes should credit the wallet back before release.</div>
              </div>
              <div className="mt-4 grid gap-2 text-sm text-slate-700">
                <div>Agent pays per delivered lead: <strong>{formatMoney(pricingPreview.leadPrice)}</strong></div>
                <div>Estimated wallet coverage at this price: <strong>{walletLeadCapacity}</strong> lead{walletLeadCapacity === 1 ? '' : 's'}</div>
                <div>Affiliate promotion strength: <strong>{pricingGuidance.title}</strong></div>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Affiliate-shared lead</div>
                  <div className="mt-2 font-semibold text-slate-900">Attribution and earnings are handled behind the scenes.</div>
                  <div className="mt-1 text-xs text-slate-500">Use this when affiliates share your insurance store page.</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Direct storefront lead</div>
                  <div className="mt-2 font-semibold text-slate-900">Direct traffic stays in the agent-owned path without exposing the internal split.</div>
                  <div className="mt-1 text-xs text-slate-500">Use this when you share your own insurance store page directly.</div>
                </div>
              </div>
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                Protection: affiliate earnings should stay on hold until the lead clears the dispute window. Approved disputes should credit the agent wallet back before funds are released out.
              </div>
              <div className="mt-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                Billing sequence: questionnaire completed, Twilio phone verified, fraud and duplicate checks passed, qualified lead delivered, wallet charged, payout hold starts.
              </div>
              <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-sm font-semibold text-slate-900">Example total lead prices</div>
                <div className="mt-3 space-y-3">
                  {pricingExamples.map((example) => (
                    <div key={example.leadPrice} className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
                      <div className="font-semibold text-slate-900">{formatMoney(example.leadPrice)} total lead price</div>
                      <div className="mt-2">Use this to compare total campaign price points while Beezio keeps the internal split private.</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-4 flex gap-3">
                <input className="flex-1 rounded-2xl border border-gray-300 px-4 py-3" value={fundAmount} onChange={(e) => setFundAmount(e.target.value)} />
                <button type="button" onClick={handleFundWallet} disabled={funding} className="rounded-2xl bg-[#ffcb05] px-4 py-3 text-sm font-semibold text-[#131921] disabled:opacity-60">
                  {funding ? 'Funding…' : 'Fund wallet'}
                </button>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-2xl font-bold text-slate-900">Package templates</h2>
              <form className="mt-4 space-y-3" onSubmit={handleSaveTemplate}>
                <input className="w-full rounded-2xl border border-gray-300 px-4 py-3" placeholder="Template name" value={templateForm.name} onChange={(e) => setTemplateForm((current) => ({ ...current, name: e.target.value }))} />
                <div className="grid gap-3 md:grid-cols-3">
                  <select className="rounded-2xl border border-gray-300 px-4 py-3" value={templateForm.vertical} onChange={(e) => setTemplateForm((current) => ({ ...current, vertical: e.target.value }))}>
                    {INSURANCE_VERTICALS.map((vertical) => (
                      <option key={vertical} value={vertical}>{humanizeInsuranceVertical(vertical)}</option>
                    ))}
                  </select>
                  <input className="rounded-2xl border border-gray-300 px-4 py-3" placeholder="Lead count" value={templateForm.qualified_lead_count} onChange={(e) => setTemplateForm((current) => ({ ...current, qualified_lead_count: e.target.value }))} />
                  <input className="rounded-2xl border border-gray-300 px-4 py-3" placeholder="Package price" value={templateForm.package_price} onChange={(e) => setTemplateForm((current) => ({ ...current, package_price: e.target.value }))} />
                </div>
                <button type="submit" disabled={templateSaving} className="w-full rounded-full border border-[#131921] px-5 py-3 text-sm font-semibold text-[#131921] disabled:opacity-60">
                  {templateSaving ? 'Saving…' : 'Save package template'}
                </button>
              </form>

              <div className="mt-5 space-y-3">
                {packageTemplates.map((template) => (
                  <div key={template.id} className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-slate-900">{template.name}</div>
                        <div className="text-sm text-slate-600">
                          {humanizeInsuranceVertical(template.vertical)} · {template.qualified_lead_count} leads · {formatMoney(Number(template.package_price_cents || 0) / 100)}
                        </div>
                      </div>
                      <button type="button" onClick={() => handleBuyPackage(template.id)} className="rounded-full bg-[#131921] px-4 py-2 text-xs font-semibold text-white">
                        Buy package
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-2">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-bold text-slate-900">Campaigns</h2>
            <div className="mt-4 space-y-3">
              {campaigns.length === 0 && <div className="text-sm text-slate-600">No campaigns saved yet.</div>}
              {campaigns.map((campaign) => (
                <div key={campaign.id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="font-semibold text-slate-900">{humanizeInsuranceVertical(campaign.vertical)}</div>
                  <div className="mt-1 text-sm text-slate-600">
                    Cost per lead {formatMoney(Number(campaign.cost_per_lead_cents || 0) / 100)} · Attribution handled privately · Status {campaign.status}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-bold text-slate-900">Wallet activity</h2>
            <div className="mt-4 space-y-3">
              {walletTransactions.length === 0 && <div className="text-sm text-slate-600">No wallet transactions yet.</div>}
              {walletTransactions.map((txn) => (
                <div key={txn.id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="font-semibold text-slate-900">{txn.type}</div>
                  <div className="mt-1 text-sm text-slate-600">
                    {formatMoney(Number(txn.amount_cents || 0) / 100)} · {txn.notes || 'No notes'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Insurance analytics</h2>
              <div className="mt-1 text-sm text-slate-600">
                Last 30 days of funnel, source mix, and wallet burn for the active insurance campaigns.
              </div>
            </div>
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
              Wallet balance {formatMoney(Number(analyticsOverview.wallet_balance_cents || 0) / 100)}
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Clicks</div>
              <div className="mt-2 text-2xl font-black text-slate-900">{Number(analyticsOverview.clicks_30d || 0)}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Leads</div>
              <div className="mt-2 text-2xl font-black text-slate-900">{Number(analyticsOverview.leads_30d || 0)}</div>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Delivered</div>
              <div className="mt-2 text-2xl font-black text-emerald-800">{Number(analyticsOverview.delivered_30d || 0)}</div>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-amber-700">Review</div>
              <div className="mt-2 text-2xl font-black text-amber-800">{Number(analyticsOverview.review_30d || 0)}</div>
            </div>
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-rose-700">Rejected</div>
              <div className="mt-2 text-2xl font-black text-rose-800">{Number(analyticsOverview.rejected_30d || 0)}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Fraud Avg</div>
              <div className="mt-2 text-2xl font-black text-slate-900">{Number(analyticsOverview.avg_fraud_score_30d || 0)}</div>
            </div>
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-3xl border border-slate-200 p-5">
              <h3 className="text-lg font-semibold text-slate-900">Funnel and source mix</h3>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
                  <div>Click to lead rate: <strong>{((Number(analyticsOverview.click_to_lead_rate_30d || 0)) * 100).toFixed(1)}%</strong></div>
                  <div className="mt-1">Lead delivery rate: <strong>{((Number(analyticsOverview.delivery_rate_30d || 0)) * 100).toFixed(1)}%</strong></div>
                  <div className="mt-1">Wallet spend: <strong>{formatMoney(Number(analyticsOverview.wallet_spend_30d_cents || 0) / 100)}</strong></div>
                  <div className="mt-1">Wallet funding: <strong>{formatMoney(Number(analyticsOverview.wallet_funding_30d_cents || 0) / 100)}</strong></div>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
                  <div>Affiliate-sourced leads: <strong>{Number(analyticsOverview.affiliate_leads_30d || 0)}</strong></div>
                  <div className="mt-1">Direct leads: <strong>{Number(analyticsOverview.direct_leads_30d || 0)}</strong></div>
                  <div className="mt-1">Delivered revenue: <strong>{formatMoney(Number(analyticsOverview.delivered_revenue_30d_cents || 0) / 100)}</strong></div>
                  <div className="mt-1">Affiliate exposure: <strong>{formatMoney(Number(analyticsOverview.affiliate_exposure_30d_cents || 0) / 100)}</strong></div>
                </div>
              </div>
              <div className="mt-4 space-y-3">
                {analyticsByDay.length === 0 && <div className="text-sm text-slate-600">No recent day-level activity yet.</div>}
                {analyticsByDay.slice(-7).map((day: any) => (
                  <div key={day.day} className="grid grid-cols-[0.9fr_1fr] gap-4 rounded-2xl border border-slate-200 p-3 text-sm text-slate-700 md:grid-cols-[0.8fr_1fr_1fr_1fr]">
                    <div className="font-semibold text-slate-900">{day.day}</div>
                    <div>Clicks <strong>{Number(day.clicks || 0)}</strong></div>
                    <div>Leads <strong>{Number(day.submitted || 0)}</strong></div>
                    <div>Delivered <strong>{Number(day.delivered || 0)}</strong></div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 p-5">
              <h3 className="text-lg font-semibold text-slate-900">Vertical performance</h3>
              <div className="mt-4 space-y-3">
                {analyticsByVertical.length === 0 && <div className="text-sm text-slate-600">No vertical analytics yet.</div>}
                {analyticsByVertical.map((row: any) => (
                  <div key={row.vertical} className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-semibold text-slate-900">{humanizeInsuranceVertical(String(row.vertical || 'life'))}</div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{Number(row.clicks || 0)} clicks</div>
                    </div>
                    <div className="mt-2 grid gap-2 md:grid-cols-2">
                      <div>Leads <strong>{Number(row.leads || 0)}</strong></div>
                      <div>Delivered <strong>{Number(row.delivered || 0)}</strong></div>
                      <div>Flagged <strong>{Number(row.flagged || 0)}</strong></div>
                      <div>Revenue <strong>{formatMoney(Number(row.revenue_cents || 0) / 100)}</strong></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-3xl border border-slate-200 p-5">
            <h3 className="text-lg font-semibold text-slate-900">Campaign health</h3>
            <div className="mt-4 space-y-3">
              {analyticsCampaigns.length === 0 && <div className="text-sm text-slate-600">No campaign analytics yet.</div>}
              {analyticsCampaigns.map((campaign: any) => (
                <div key={campaign.id} className="rounded-2xl border border-slate-200 p-4 text-sm text-slate-700">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div className="font-semibold text-slate-900">{humanizeInsuranceVertical(String(campaign.vertical || 'life'))}</div>
                    <div className={`rounded-full px-3 py-1 text-xs font-semibold ${String(campaign.status || '').toLowerCase() === 'active' ? 'bg-emerald-100 text-emerald-800' : String(campaign.status || '').toLowerCase() === 'out_of_funds' ? 'bg-orange-100 text-orange-800' : 'bg-slate-100 text-slate-700'}`}>
                      {String(campaign.status || 'unknown')}
                    </div>
                  </div>
                  <div className="mt-2 grid gap-2 md:grid-cols-3 xl:grid-cols-6">
                    <div>Clicks 30d <strong>{Number(campaign.clicks_30d || 0)}</strong></div>
                    <div>Leads 30d <strong>{Number(campaign.leads_30d || 0)}</strong></div>
                    <div>Delivered 30d <strong>{Number(campaign.delivered_30d || 0)}</strong></div>
                    <div>CPL <strong>{formatMoney(Number(campaign.cost_per_lead_cents || 0) / 100)}</strong></div>
                    <div>Attribution <strong>Private</strong></div>
                    <div>Daily cap <strong>{campaign.daily_cap ?? 'none'}</strong></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {packages.length > 0 && (
          <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-bold text-slate-900">Purchased packages</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {packages.map((pkg) => (
                <div key={pkg.id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="font-semibold text-slate-900">{humanizeInsuranceVertical(pkg.vertical)}</div>
                  <div className="mt-1 text-sm text-slate-600">
                    Purchased {pkg.purchased_lead_count} · Delivered {pkg.delivered_lead_count} · Remaining {pkg.remaining_lead_count}
                  </div>
                  <div className="mt-2 text-sm font-semibold text-slate-900">{formatMoney(Number(pkg.package_price_cents || 0) / 100)}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Lead inbox</h2>
              <div className="mt-1 text-sm text-slate-600">
                Review flagged or submitted leads, manually qualify them into delivery, or reject bad traffic before it reaches payout release.
              </div>
            </div>
            <div className="flex flex-wrap gap-2 text-xs font-semibold">
              <button type="button" onClick={() => setLeadFilter('all')} className={`rounded-full px-4 py-2 ${leadFilter === 'all' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'}`}>All {leadStats.total}</button>
              <button type="button" onClick={() => setLeadFilter('review')} className={`rounded-full px-4 py-2 ${leadFilter === 'review' ? 'bg-amber-500 text-white' : 'bg-amber-50 text-amber-800'}`}>Needs review {leadStats.review}</button>
              <button type="button" onClick={() => setLeadFilter('delivered')} className={`rounded-full px-4 py-2 ${leadFilter === 'delivered' ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-800'}`}>Delivered {leadStats.delivered}</button>
              <button type="button" onClick={() => setLeadFilter('invalid')} className={`rounded-full px-4 py-2 ${leadFilter === 'invalid' ? 'bg-rose-600 text-white' : 'bg-rose-50 text-rose-800'}`}>Rejected {leadStats.invalid}</button>
            </div>
          </div>
          <div className="mt-5 space-y-4">
            {filteredLeads.length === 0 && <div className="text-sm text-slate-600">No insurance leads in this view yet.</div>}
            {filteredLeads.map((lead) => {
              const sourceType = String(lead?.payload_json?.source_type || '').trim() || (lead?.affiliate_user_id ? 'affiliate' : 'direct_agent');
              const affiliateProfile = lead?.affiliate_profile;
              const firstDispute = Array.isArray(lead?.disputes) ? lead.disputes[0] : null;
              const firstEarning = Array.isArray(lead?.earnings) ? lead.earnings[0] : null;
              const status = String(lead?.status || 'unknown');
              const reviewStatus = String(lead?.review_status || 'unknown');
              const canApprove = status !== 'delivered' && status !== 'invalid';
              const canReject = status !== 'delivered' && status !== 'invalid';
              return (
                <div key={lead.id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-lg font-semibold text-slate-900">
                          {String(lead.first_name || '').trim()} {String(lead.last_name || '').trim()}
                        </div>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{String(lead.vertical || 'life')}</span>
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${status === 'delivered' ? 'bg-emerald-100 text-emerald-800' : status === 'invalid' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'}`}>{status}</span>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">Review {reviewStatus}</span>
                      </div>
                      <div className="mt-2 grid gap-2 text-sm text-slate-600 md:grid-cols-2 xl:grid-cols-4">
                        <div>Email: <strong>{lead.email}</strong></div>
                        <div>Phone: <strong>{lead.phone}</strong></div>
                        <div>State: <strong>{String(lead?.payload_json?.state || lead?.zip_code || 'unknown')}</strong></div>
                        <div>Created: <strong>{new Date(lead.created_at).toLocaleString()}</strong></div>
                        <div>Source: <strong>{sourceType}</strong></div>
                        <div>Lead price: <strong>{formatMoney(Number(lead.lead_price || 0))}</strong></div>
                        <div>Affiliate payout: <strong>{formatMoney(Number(lead.affiliate_payout || 0))}</strong></div>
                        <div>Influencer payout: <strong>{formatMoney(Number(lead.influencer_payout || 0))}</strong></div>
                        <div>Beezio fee: <strong>{formatMoney(Number(lead.beezio_fee_gross || lead.beezio_fee_net || 0))}</strong></div>
                        <div>Fraud score: <strong>{Number(lead.fraud_score || 0)}</strong></div>
                        <div>Affiliate: <strong>{affiliateProfile?.full_name || affiliateProfile?.email || 'none'}</strong></div>
                        <div>Delivered: <strong>{lead.delivered_at ? new Date(lead.delivered_at).toLocaleString() : 'not yet'}</strong></div>
                      </div>
                      {lead.notes && <div className="mt-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">{lead.notes}</div>}
                      {Array.isArray(lead?.fraud_flags_json) && lead.fraud_flags_json.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {lead.fraud_flags_json.map((flag: string) => (
                            <span key={flag} className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">{flag}</span>
                          ))}
                        </div>
                      )}
                      {(firstDispute || firstEarning) && (
                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                          {firstEarning && (
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                              Affiliate earning: <strong>{formatMoney(Number(firstEarning.amount_cents || 0) / 100)}</strong> · {String(firstEarning.status || 'unknown')}
                            </div>
                          )}
                          {firstDispute && (
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                              Dispute: <strong>{String(firstDispute.reason_code || 'open')}</strong> · {String(firstDispute.status || 'unknown')}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="w-full xl:w-[320px]">
                      <textarea
                        className="min-h-[96px] w-full rounded-2xl border border-gray-300 px-4 py-3 text-sm"
                        placeholder="Agent review notes or rejection reason"
                        value={leadActionNotes[lead.id] || ''}
                        onChange={(e) => setLeadActionNotes((current) => ({ ...current, [lead.id]: e.target.value }))}
                      />
                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          disabled={!canApprove || actingLeadId === lead.id}
                          onClick={() => handleLeadAction(lead.id, 'approve')}
                          className="flex-1 rounded-full bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
                        >
                          {actingLeadId === lead.id ? 'Working...' : 'Approve and deliver'}
                        </button>
                        <button
                          type="button"
                          disabled={!canReject || actingLeadId === lead.id}
                          onClick={() => handleLeadAction(lead.id, 'reject')}
                          className="rounded-full border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 disabled:opacity-60"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-bold text-slate-900">Dispute review</h2>
          <div className="mt-4 space-y-3">
            {disputes.length === 0 && <div className="text-sm text-slate-600">No insurance disputes yet.</div>}
            {disputes.map((dispute) => (
              <div key={dispute.id} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="font-semibold text-slate-900">{dispute.reason_code}</div>
                    <div className="mt-1 text-sm text-slate-600">
                      {dispute.reason_text || 'No additional dispute notes.'}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      Lead status {dispute.insurance_leads?.status || 'unknown'} · Review {dispute.insurance_leads?.review_status || 'unknown'} · Fraud {dispute.insurance_leads?.fraud_score ?? 0}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {dispute.status === 'open' ? (
                      <>
                        <button type="button" onClick={() => handleResolveDispute(dispute.id, 'approved')} className="rounded-full bg-[#131921] px-4 py-2 text-xs font-semibold text-white">
                          Approve credit
                        </button>
                        <button type="button" onClick={() => handleResolveDispute(dispute.id, 'denied')} className="rounded-full border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700">
                          Deny
                        </button>
                      </>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700">{dispute.status}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default InsuranceAgentSetupPage;
