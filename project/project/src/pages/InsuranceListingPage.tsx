import React, { useEffect, useMemo, useState } from 'react';
import { Globe } from 'lucide-react';
import { useParams, useSearchParams } from 'react-router-dom';
import { matchesStatesServed } from '../utils/locationMatching';
import { getReferralData } from '../utils/referralTracking';

type Listing = {
  id: string;
  slug: string;
  agency_name: string;
  bio: string;
  verticals: string[];
  states_served: string[];
  lead_price: number;
  affiliate_payout: number;
  hero_title: string;
  hero_subtitle: string;
  disclaimer: string;
  campaign_id: string;
  pricing_mode: string;
  lead_delivery_enabled?: boolean;
  promotable_by_affiliates?: boolean;
  activation_status?: string;
  activation_label?: string;
  wallet_balance?: number;
  website_url?: string;
  specialties?: string[];
  daily_cap?: number | null;
  testimonials?: Array<{ quote?: string; author?: string; role?: string }>;
  agency_profile?: {
    years_in_business?: string;
    response_time?: string;
    licensed_states_text?: string;
    service_area_summary?: string;
    cta_label?: string;
    logo_url?: string;
    banner_url?: string;
    theme_accent?: string;
    gallery_urls?: string[];
    trust_points?: string[];
  };
  questionnaire_settings?: {
    questionnaire?: Record<string, boolean>;
    consent?: Record<string, boolean>;
    quality_tiers?: Record<string, boolean | string>;
  };
};

const formatMoney = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value || 0));

const VERTICAL_COPY: Record<string, {
  shopperTitle: string;
  shopperIntro: string;
  checklistTitle: string;
  checklist: string[];
  notesPlaceholder: string;
  benefit: string;
}> = {
  life: {
    shopperTitle: 'Life insurance quote request',
    shopperIntro: 'Answer a few questions about your household and coverage goals so this agent can review life insurance options that fit your situation.',
    checklistTitle: 'What this agent is reviewing',
    checklist: ['Household protection needs', 'Dependents and family situation', 'Current coverage status'],
    notesPlaceholder: 'Tell the agent what kind of life coverage or family protection you want help with',
    benefit: 'Built for families and dependents who want real coverage guidance instead of generic follow-up.',
  },
  health: {
    shopperTitle: 'Health coverage quote request',
    shopperIntro: 'Use this form to request health coverage help from this specific agent. The goal is to match needs, timing, and household size before contact happens.',
    checklistTitle: 'What this agent is reviewing',
    checklist: ['Household size and coverage needs', 'Current health plan status', 'When you need coverage to start'],
    notesPlaceholder: 'Tell the agent what kind of health coverage or plan help you need',
    benefit: 'Built for shoppers comparing plan options and wanting one qualified agent to follow up.',
  },
  auto: {
    shopperTitle: 'Auto insurance quote request',
    shopperIntro: 'Share your vehicle and current coverage details so this agent can review auto insurance options that make sense before calling you.',
    checklistTitle: 'What this agent is reviewing',
    checklist: ['Vehicle count and driver need', 'Current insurer details', 'Coverage timing and urgency'],
    notesPlaceholder: 'Tell the agent what you need help with on your auto insurance quote',
    benefit: 'Built for drivers who want quote help without having their number pushed into spam call lists.',
  },
  home: {
    shopperTitle: 'Home insurance quote request',
    shopperIntro: 'Complete this home coverage form so the agent can review your property situation and contact you with relevant options only after verification.',
    checklistTitle: 'What this agent is reviewing',
    checklist: ['Homeowner or renter status', 'Current insurer details', 'Property coverage timing'],
    notesPlaceholder: 'Tell the agent what you need help with for your home or renter coverage',
    benefit: 'Built for home and renter shoppers who want a verified one-agent quote process.',
  },
};

const InsuranceListingPage: React.FC = () => {
  const { slug = '' } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitState, setSubmitState] = useState<'idle' | 'submitting' | 'submitted'>('idle');
  const [result, setResult] = useState<any>(null);
  const [verificationState, setVerificationState] = useState<'idle' | 'sending' | 'sent' | 'checking' | 'verified'>('idle');
  const [verificationId, setVerificationId] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [formStartedAt] = useState(() => new Date().toISOString());
  const [form, setForm] = useState({
    vertical: 'life',
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    state: '',
    zip_code: '',
    age_range: '',
    timeline: '',
    current_coverage: '',
    best_contact_time: '',
    notes: '',
    consent_to_contact: false,
    human_check_answer: '',
    nickname: '',
    vertical_answers: {
      current_insurer: '',
      vehicles_count: '',
      homeowner_status: '',
      household_size: '',
      dependents: '',
      state: '',
    },
  });

  const affiliateRef = useMemo(() => {
    const direct = String(searchParams.get('ref') || '').trim();
    if (direct) return direct;
    return getReferralData().affiliateId || '';
  }, [searchParams]);
  const sourceType = affiliateRef ? 'affiliate' : 'direct_agent';

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/public/insurance/listing?slug=${encodeURIComponent(slug)}`);
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(String(payload?.error || 'Unable to load insurance listing'));
        if (!alive) return;
        setListing(payload?.listing || null);
        setForm((current) => ({
          ...current,
          vertical: String((payload?.listing?.verticals || [])[0] || 'life'),
        }));
      } catch (err: any) {
        if (!alive) return;
        setError(err?.message || 'Unable to load insurance listing');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [slug]);

  useEffect(() => {
    if (!listing || !affiliateRef) return;
    const sessionKey = `insurance_affiliate_click:${listing.id}:${affiliateRef}`;
    if (sessionStorage.getItem(sessionKey)) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/.netlify/functions/insurance-affiliate-click', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            listing_id: listing.id,
            affiliate_ref: affiliateRef,
            source_url: window.location.href,
            referrer: document.referrer || '',
          }),
        });
        if (!cancelled && res.ok) {
          sessionStorage.setItem(sessionKey, '1');
        }
      } catch {
        // Attribution should not block the shopper flow.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [affiliateRef, listing]);

  const submitLead = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!listing) return;
    if (affiliateRef && listing.promotable_by_affiliates === false) {
      setError('This insurance page is out of credits right now, so affiliate traffic cannot route leads to it until the agent funds credits again.');
      return;
    }

    setError(null);
    setSubmitState('submitting');
    try {
      const res = await fetch('/api/insurance/lead-submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          listing_id: listing.id,
          affiliate_ref: affiliateRef || null,
          source_url: window.location.href,
          form_started_at: formStartedAt,
          verification_id: verificationId,
          ...form,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String(payload?.error || 'Lead submission failed'));
      setResult(payload);
      setSubmitState('submitted');
    } catch (err: any) {
      setError(err?.message || 'Lead submission failed');
      setSubmitState('idle');
    }
  };

  const startVerification = async () => {
    if (affiliateRef && listing?.promotable_by_affiliates === false) {
      setError('This insurance page is out of credits right now, so affiliate traffic cannot route leads to it until the agent funds credits again.');
      return;
    }
    setError(null);
    setVerificationState('sending');
    try {
      const res = await fetch('/api/insurance/verification/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phone: form.phone }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String(payload?.error || 'Unable to send verification code'));
      setVerificationId(String(payload?.verification_id || ''));
      setVerificationState('sent');
    } catch (err: any) {
      setError(err?.message || 'Unable to send verification code');
      setVerificationState('idle');
    }
  };

  const checkVerification = async () => {
    if (affiliateRef && listing?.promotable_by_affiliates === false) {
      setError('This insurance page is out of credits right now, so affiliate traffic cannot route leads to it until the agent funds credits again.');
      return;
    }
    setError(null);
    setVerificationState('checking');
    try {
      const res = await fetch('/api/insurance/verification/check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          verification_id: verificationId,
          code: verificationCode,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String(payload?.error || 'Unable to verify code'));
      if (String(payload?.status || '') !== 'verified') throw new Error('Verification code was not approved.');
      setVerificationState('verified');
    } catch (err: any) {
      setError(err?.message || 'Unable to verify code');
      setVerificationState('sent');
    }
  };

  const vertical = String(form.vertical || (listing?.verticals || [])[0] || 'life').toLowerCase();
  const specialties = Array.isArray(listing?.specialties) ? listing.specialties.filter(Boolean) : [];
  const stateRestricted = Array.isArray(listing?.states_served) && listing.states_served.length > 0;
  const selectedStateAllowed = !stateRestricted || matchesStatesServed(form.state, listing?.states_served);
  const questionnaire = listing?.questionnaire_settings?.questionnaire || {};
  const consentSettings = listing?.questionnaire_settings?.consent || {};
  const askZipCode = questionnaire.ask_zip_code !== false;
  const askAgeRange = questionnaire.ask_age_range !== false;
  const askTimeline = questionnaire.ask_timeline !== false;
  const askCurrentCoverage = questionnaire.ask_current_coverage !== false;
  const askBestContactTime = questionnaire.ask_best_contact_time !== false;
  const askNotes = questionnaire.ask_notes !== false;
  const askCurrentInsurer = questionnaire.ask_current_insurer !== false;
  const askVehiclesCount = questionnaire.ask_vehicles_count !== false;
  const askHomeownerStatus = questionnaire.ask_homeowner_status !== false;
  const askDependents = questionnaire.ask_dependents !== false;
  const askHouseholdSize = questionnaire.ask_household_size !== false;
  const singleAgentOnly = consentSettings.single_agent_only !== false;
  const noSpamCalling = consentSettings.no_spam_calling !== false;
  const twilioVerifiedOnly = consentSettings.twilio_verified_only !== false;
  const qualityTierSettings = listing?.questionnaire_settings?.quality_tiers || {};
  const agencyProfile = listing?.agency_profile || {};
  const themeAccent = String(agencyProfile.theme_accent || '#131921').trim() || '#131921';
  const trustPoints = Array.isArray(agencyProfile.trust_points)
    ? agencyProfile.trust_points.map((value) => String(value || '').trim()).filter(Boolean)
    : [];
  const galleryUrls = Array.isArray(agencyProfile.gallery_urls)
    ? agencyProfile.gallery_urls.map((value) => String(value || '').trim()).filter(Boolean)
    : [];
  const defaultTier =
    qualityTierSettings.default_tier === 'verified' || qualityTierSettings.default_tier === 'high_intent'
      ? String(qualityTierSettings.default_tier)
      : 'qualified';
  const enabledTiers = (['verified', 'qualified', 'high_intent'] as const).filter((tier) => qualityTierSettings[tier] !== false);
  const verticalCopy = VERTICAL_COPY[vertical] || VERTICAL_COPY.life;
  const leadDeliveryEnabled = listing?.lead_delivery_enabled !== false;
  const affiliatePromotable = listing?.promotable_by_affiliates !== false;
  const directQueueAllowed = !affiliateRef && String(listing?.activation_status || '').toLowerCase() === 'out_of_credits';
  const quoteFlowEnabled = leadDeliveryEnabled || directQueueAllowed;
  const leadActivationLabel = String(listing?.activation_label || (leadDeliveryEnabled ? 'Credits active' : 'Free website only'));

  return (
    <div className="min-h-screen bg-[#eaeded]">
      {loading && <div className="mx-auto max-w-5xl px-4 py-16 text-sm text-slate-600">Loading insurance store...</div>}
      {error && !listing && <div className="mx-auto max-w-5xl px-4 py-16 text-sm text-red-700">{error}</div>}

      {listing && (
        <>
          <section className="border-b border-slate-200 bg-white">
            <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
              {agencyProfile.banner_url && (
                <div className="mb-6 overflow-hidden rounded-[2rem] border border-slate-200 bg-slate-100">
                  <img
                    src={agencyProfile.banner_url}
                    alt={`${listing.agency_name} banner`}
                    className="h-48 w-full object-cover sm:h-64"
                  />
                </div>
              )}
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-3xl">
                  {agencyProfile.logo_url && (
                    <img
                      src={agencyProfile.logo_url}
                      alt={`${listing.agency_name} logo`}
                      className="mb-4 h-16 w-16 rounded-2xl border border-slate-200 bg-white object-cover p-1 shadow-sm"
                    />
                  )}
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">Insurance Store</p>
                  <h1 className="mt-3 text-4xl font-black text-slate-900">{listing.hero_title || listing.agency_name}</h1>
                  <p className="mt-4 text-lg text-slate-600">{listing.hero_subtitle || listing.bio}</p>
                  {affiliateRef && (
                    <div className="mt-4 inline-flex rounded-full bg-[#fff3c4] px-4 py-2 text-sm font-semibold text-[#6b5200]">
                      Shared through affiliate link {affiliateRef}
                    </div>
                  )}
                  {!affiliateRef && (
                    <div className="mt-4 inline-flex rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
                      Direct agent storefront link
                    </div>
                  )}
                </div>
                <div className="rounded-3xl px-6 py-5 text-white" style={{ backgroundColor: themeAccent }}>
                  <div className="text-[11px] uppercase tracking-wide text-white/65">
                    {leadDeliveryEnabled ? (sourceType === 'affiliate' ? 'Affiliate-ready storefront' : 'Direct storefront') : 'Free insurance website'}
                  </div>
                  <div className="mt-2 text-2xl font-black">
                    {leadDeliveryEnabled ? (sourceType === 'affiliate' ? 'Shared with attribution' : 'Agent-owned traffic') : 'Website live, leads inactive'}
                  </div>
                  <div className="mt-1 text-sm text-white/70">
                    {leadDeliveryEnabled
                      ? (sourceType === 'affiliate'
                        ? 'Affiliates can promote this like a product page while the shopper still goes through Beezio qualification before contact.'
                        : 'Direct traffic uses the same verified quote flow without exposing any internal payout or pricing split.')
                      : 'This site can be published for free first. Lead routing turns on only after the agent funds credits.'}
                  </div>
                </div>
              </div>
              <div className="mt-6 flex flex-wrap gap-3 text-sm">
                <span className="rounded-full bg-slate-100 px-4 py-2 text-slate-700">Store type: insurance lead storefront</span>
                <span className="rounded-full bg-slate-100 px-4 py-2 text-slate-700">Billing: credits used only on delivered qualified leads</span>
                <span className="rounded-full bg-slate-100 px-4 py-2 text-slate-700">States: {listing.states_served.join(', ') || 'Nationwide'}</span>
                <span className="rounded-full bg-[#131921] px-4 py-2 text-white">Default tier: {defaultTier.replace('_', ' ')}</span>
                <span className={`rounded-full px-4 py-2 ${leadDeliveryEnabled ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'}`}>{leadActivationLabel}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                {enabledTiers.map((tier) => (
                  <span key={tier} className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700">
                    {tier.replace('_', ' ')}
                  </span>
                ))}
              </div>
            </div>
          </section>

          <section className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:px-8">
            <div className="space-y-6">
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-2xl font-bold text-slate-900">About this insurance store</h2>
                <p className="mt-3 text-sm text-slate-600">
                  This page is the insurance storefront affiliates can send shoppers to. It presents the offer like a product page, captures a guided quote request, and sends only qualified leads into the agent delivery flow.
                </p>
                <div className="mt-5 rounded-2xl border border-[#ffcb05] bg-[#fff8d9] p-4 text-sm text-[#5f4a00]">
                  <div className="text-xs font-semibold uppercase tracking-wide">Coverage focus</div>
                  <div className="mt-2 font-semibold">{verticalCopy.benefit}</div>
                </div>
                <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
                  This Beezio insurance page is built to be shared by the agent, by affiliates, and by influencers. The same standard Beezio influencer fee structure applies here as it does across the rest of the platform.
                </div>
                {!leadDeliveryEnabled && (
                  <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                    {affiliateRef && !affiliatePromotable
                      ? 'This insurance website is out of credits right now. Affiliates can no longer route leads to it until the agent funds credits again.'
                      : directQueueAllowed
                        ? 'This insurance website is out of credits right now, but direct visitors can still submit a request. Beezio will hold it safely until the agent activates credits again.'
                        : 'This insurance website is live as free content, but Beezio lead delivery is not active yet. The agent must fund credits before quote requests can be routed.'}
                  </div>
                )}
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Coverage focus</div>
                    <div className="mt-2 text-sm font-semibold text-slate-800">{listing.verticals.join(', ')}</div>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Store protection</div>
                    <div className="mt-2 text-sm font-semibold text-slate-800">Duplicate, speed, honeypot, IP rate limits, and affiliate trust caps</div>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Store details</div>
                    <div className="mt-2 text-sm font-semibold text-slate-800">{listing.bio || 'This insurance storefront is set up for qualified lead delivery.'}</div>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Specialties</div>
                    <div className="mt-2 text-sm font-semibold text-slate-800">{specialties.length > 0 ? specialties.join(', ') : 'Coverage guidance and quote matching'}</div>
                  </div>
                </div>
                {(agencyProfile.years_in_business || agencyProfile.response_time || agencyProfile.licensed_states_text || agencyProfile.service_area_summary) && (
                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 p-4 text-sm text-slate-700">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Agency credibility</div>
                      {agencyProfile.years_in_business && <div className="mt-2"><strong>{agencyProfile.years_in_business}</strong> in business</div>}
                      {agencyProfile.response_time && <div className="mt-1">Typical response time: <strong>{agencyProfile.response_time}</strong></div>}
                      {agencyProfile.licensed_states_text && <div className="mt-1">{agencyProfile.licensed_states_text}</div>}
                    </div>
                    <div className="rounded-2xl border border-slate-200 p-4 text-sm text-slate-700">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Service area and process</div>
                      <div className="mt-2">{agencyProfile.service_area_summary || 'This store is built for direct verified insurance requests instead of broad cold-call distribution.'}</div>
                    </div>
                  </div>
                )}
                {(trustPoints.length > 0 || agencyProfile.response_time) && (
                  <div className="mt-5 rounded-3xl border border-slate-200 bg-white p-6">
                    <h3 className="text-xl font-bold text-slate-900">Why speak with this agent</h3>
                    <p className="mt-2 text-sm text-slate-600">
                      These leads are vetted before contact. This section explains why this agent is worth speaking with once your quote request qualifies.
                    </p>
                    {agencyProfile.response_time && (
                      <div className="mt-4 rounded-2xl bg-[#131921] px-4 py-3 text-sm font-semibold text-white">
                        Typical response time: {agencyProfile.response_time}
                      </div>
                    )}
                    {trustPoints.length > 0 && (
                      <div className="mt-4 grid gap-3 md:grid-cols-3">
                        {trustPoints.map((point) => (
                          <div key={point} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-800">
                            {point}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {galleryUrls.length > 0 && (
                  <div className="mt-5 rounded-3xl border border-slate-200 bg-white p-6">
                    <h3 className="text-xl font-bold text-slate-900">Agency photos and brand highlights</h3>
                    <p className="mt-2 text-sm text-slate-600">
                      A more polished storefront helps shoppers feel like they are speaking with a real agency, not a generic lead form.
                    </p>
                    <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {galleryUrls.map((imageUrl, index) => (
                        <div key={`${imageUrl}-${index}`} className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-slate-100">
                          <img src={imageUrl} alt={`${listing.agency_name} gallery ${index + 1}`} className="h-48 w-full object-cover" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {(listing.website_url || listing.disclaimer) && (
                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    {listing.website_url && (
                      <div className="rounded-2xl border border-slate-200 p-4">
                        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                          <Globe className="h-4 w-4" />
                          Brand site
                        </div>
                        <a
                          href={listing.website_url}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 block text-sm font-semibold text-[#0f6cbf]"
                        >
                          {listing.website_url}
                        </a>
                      </div>
                    )}
                    {listing.disclaimer && (
                      <div className="rounded-2xl border border-slate-200 p-4 text-sm text-slate-600">
                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Store notice</div>
                        <div className="mt-2">{listing.disclaimer}</div>
                      </div>
                    )}
                  </div>
                )}
                {Array.isArray(listing.testimonials) && listing.testimonials.filter((entry) => String(entry?.quote || '').trim()).length > 0 && (
                  <div className="mt-5 rounded-3xl border border-slate-200 bg-white p-6">
                    <h3 className="text-xl font-bold text-slate-900">Client quotes</h3>
                    <div className="mt-4 grid gap-4 md:grid-cols-3">
                      {listing.testimonials
                        .filter((entry) => String(entry?.quote || '').trim())
                        .map((entry, index) => (
                          <div key={index} className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
                            <div className="font-medium text-slate-900">"{String(entry.quote || '').trim()}"</div>
                            <div className="mt-3 text-xs text-slate-500">
                              {String(entry.author || '').trim() || 'Customer'}
                              {String(entry.role || '').trim() ? ` • ${String(entry.role || '').trim()}` : ''}
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-2xl font-bold text-slate-900">Request a quote</h2>
              <p className="mt-2 text-sm text-slate-600">{verticalCopy.shopperIntro}</p>
              <div className="mt-3 rounded-2xl border border-[#ffcb05] bg-[#fff8d9] px-4 py-3 text-sm text-[#5f4a00]">
                {singleAgentOnly
                  ? 'This form goes to this agent only. Your information is not a cold-call list and is not meant for spam calling.'
                  : 'This form is reviewed as a verified insurance lead before the agent is charged.'}
                {noSpamCalling ? ' No spam calls and no random agent blast.' : ''}
                {twilioVerifiedOnly ? ' Every lead requires Twilio phone verification before it can be submitted.' : ''}
              </div>
              <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                Every submission is treated as a warm inbound insurance request. The shopper is actively searching for coverage, the phone is verified, and the lead is screened before this agent is expected to follow up.
              </div>
              <div className="mt-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                Beezio does not sell cold lead lists through this page. This request is intended for this agent only after qualification, and affiliates are not authorized to promise guaranteed approval, guaranteed coverage, or mass-agent distribution.
              </div>
              <div className="mt-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                Lead packages are consumed only when a vetted lead is delivered. If a disputed lead is approved against delivery, the value is restored as Beezio account credit instead of a cash refund.
              </div>
              <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{verticalCopy.checklistTitle}</div>
                <div className="mt-2 grid gap-2 md:grid-cols-3">
                  {verticalCopy.checklist.map((item) => (
                    <div key={item} className="rounded-2xl bg-slate-50 px-3 py-2 font-medium text-slate-800">{item}</div>
                  ))}
                </div>
              </div>
              <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                {sourceType === 'affiliate'
                  ? (affiliatePromotable
                    ? 'This visit is attached to an affiliate share link, so attribution can be recorded if the lead qualifies.'
                    : 'This visit is attached to an affiliate share link, but this insurance page is out of credits and is not accepting affiliate-routed leads right now.')
                  : (directQueueAllowed
                    ? 'This visit is using the direct agent storefront link. Requests can still be submitted, but they stay on hold until the agent funds credits again.'
                    : 'This visit is using the direct agent storefront link, so it stays in the direct agent traffic path.')}
              </div>

              {submitState === 'submitted' ? (
                <div className="mt-6 rounded-2xl border border-green-200 bg-green-50 p-5">
                  <div className="text-lg font-bold text-green-900">Lead recorded</div>
                  <p className="mt-2 text-sm text-green-800">
                    {result?.delivered
                      ? 'This lead passed the current checks and was processed against prepaid balance.'
                      : 'This lead was saved but did not auto-deliver. Check the review or funding state below.'}
                  </p>
                  <div className="mt-4 space-y-1 text-sm text-green-900">
                    <div>Status: {String(result?.processed?.reason || result?.review_status || 'submitted')}</div>
                    <div>Lead ID: {String(result?.lead_id || '')}</div>
                    <div>Lead source: {String(result?.source_type || sourceType)}</div>
                    <div>Phone verification: complete before submission</div>
                    <div>Questionnaire state: {form.state || 'Not provided'}</div>
                  </div>
                  <div className="mt-4 rounded-2xl border border-green-200 bg-white/70 px-4 py-3 text-sm text-green-900">
                    {sourceType === 'affiliate'
                      ? 'This was submitted through an affiliate-shared insurance storefront. If the lead clears review and the dispute hold window, platform attribution can complete behind the scenes.'
                      : (String(result?.reason || '') === 'awaiting_credit_funding' || String(result?.reason || '') === 'awaiting_campaign_activation'
                        ? 'This was submitted through the direct agent storefront and is now being held until the agent activates credits again.'
                        : 'This was submitted through the direct agent storefront. If the lead clears review and the dispute hold window, the direct storefront delivery path completes behind the scenes.')}
                  </div>
                </div>
              ) : (
                <form className="mt-6 space-y-4" onSubmit={submitLead}>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                    <div className="font-semibold text-slate-900">{verticalCopy.shopperTitle}</div>
                    <div className="mt-1">
                      {directQueueAllowed
                        ? 'Finish this verified questionnaire and Beezio will hold the request until this agent activates credits again.'
                        : 'Finish this verified questionnaire and, if it qualifies, this agent can follow up with you directly.'}
                    </div>
                  </div>
                  <select
                    className="w-full rounded-2xl border border-gray-300 px-4 py-3"
                    value={form.vertical}
                    onChange={(e) => setForm((current) => ({ ...current, vertical: e.target.value }))}
                  >
                    {(listing.verticals || ['life']).map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>

                  <div className="grid gap-4 md:grid-cols-2">
                    <input className="rounded-2xl border border-gray-300 px-4 py-3" placeholder="First name" value={form.first_name} onChange={(e) => setForm((current) => ({ ...current, first_name: e.target.value }))} />
                    <input className="rounded-2xl border border-gray-300 px-4 py-3" placeholder="Last name" value={form.last_name} onChange={(e) => setForm((current) => ({ ...current, last_name: e.target.value }))} />
                  </div>

                  <input className="w-full rounded-2xl border border-gray-300 px-4 py-3" placeholder="Email" type="email" value={form.email} onChange={(e) => setForm((current) => ({ ...current, email: e.target.value }))} />
                  <div className="grid gap-4 md:grid-cols-2">
                    <input className="rounded-2xl border border-gray-300 px-4 py-3" placeholder="Phone" value={form.phone} onChange={(e) => setForm((current) => ({ ...current, phone: e.target.value }))} />
                    {askZipCode ? (
                      <input className="rounded-2xl border border-gray-300 px-4 py-3" placeholder="ZIP code" value={form.zip_code} onChange={(e) => setForm((current) => ({ ...current, zip_code: e.target.value }))} />
                    ) : (
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                        Only this verified agent will contact you if your quote request qualifies.
                      </div>
                    )}
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <input className="rounded-2xl border border-gray-300 px-4 py-3" placeholder="State" value={form.state} onChange={(e) => setForm((current) => ({ ...current, state: e.target.value }))} />
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                      {stateRestricted
                        ? `This store currently accepts leads in ${listing.states_served.join(', ')}.`
                        : 'This store is not limited to a specific state list.'}
                    </div>
                  </div>

                  {stateRestricted && form.state && !selectedStateAllowed && (
                    <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                      This insurance store is not accepting leads from that state.
                    </div>
                  )}

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-sm font-semibold text-slate-900">Phone verification</div>
                    <p className="mt-1 text-xs text-slate-600">
                      We only count verified, consent-based warm leads. Twilio verifies the phone number before a lead can be submitted, and only this agent should contact the shopper afterward.
                      {directQueueAllowed ? ' Because this page is out of credits, your verified request will be held until the agent activates delivery again.' : ''}
                    </p>
                    <div className="mt-3 flex flex-col gap-3 md:flex-row">
                      <button
                        type="button"
                        onClick={startVerification}
                        disabled={!quoteFlowEnabled || !form.phone || verificationState === 'sending' || verificationState === 'verified'}
                        className="rounded-full border border-[#131921] px-4 py-2 text-sm font-semibold text-[#131921] disabled:opacity-60"
                      >
                        {verificationState === 'sending' ? 'Sending...' : verificationState === 'verified' ? 'Phone verified' : 'Send code'}
                      </button>
                      <input
                        className="flex-1 rounded-2xl border border-gray-300 px-4 py-3"
                        placeholder="Verification code"
                        value={verificationCode}
                        onChange={(e) => setVerificationCode(e.target.value)}
                        disabled={!quoteFlowEnabled || verificationState === 'verified'}
                      />
                      <button
                        type="button"
                        onClick={checkVerification}
                        disabled={!quoteFlowEnabled || !verificationId || !verificationCode || verificationState === 'checking' || verificationState === 'verified'}
                        className="rounded-full bg-[#131921] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                      >
                        {verificationState === 'checking' ? 'Checking...' : verificationState === 'verified' ? 'Verified' : 'Verify code'}
                      </button>
                    </div>
                  </div>

                  {(askAgeRange || askTimeline) && (
                    <div className="grid gap-4 md:grid-cols-2">
                      {askAgeRange && (
                        <select className="rounded-2xl border border-gray-300 px-4 py-3" value={form.age_range} onChange={(e) => setForm((current) => ({ ...current, age_range: e.target.value }))}>
                          <option value="">Age range</option>
                          <option value="18-24">18-24</option>
                          <option value="25-34">25-34</option>
                          <option value="35-44">35-44</option>
                          <option value="45-54">45-54</option>
                          <option value="55-64">55-64</option>
                          <option value="65+">65+</option>
                        </select>
                      )}
                      {askTimeline && (
                        <select className="rounded-2xl border border-gray-300 px-4 py-3" value={form.timeline} onChange={(e) => setForm((current) => ({ ...current, timeline: e.target.value }))}>
                          <option value="">Need coverage</option>
                          <option value="today">Today</option>
                          <option value="this_week">This week</option>
                          <option value="this_month">This month</option>
                          <option value="researching">Just researching</option>
                        </select>
                      )}
                    </div>
                  )}

                  {(askCurrentCoverage || askBestContactTime) && (
                    <div className="grid gap-4 md:grid-cols-2">
                      {askCurrentCoverage && (
                        <select className="rounded-2xl border border-gray-300 px-4 py-3" value={form.current_coverage} onChange={(e) => setForm((current) => ({ ...current, current_coverage: e.target.value }))}>
                          <option value="">Current coverage</option>
                          <option value="yes">Yes</option>
                          <option value="no">No</option>
                          <option value="not_sure">Not sure</option>
                        </select>
                      )}
                      {askBestContactTime && (
                        <select className="rounded-2xl border border-gray-300 px-4 py-3" value={form.best_contact_time} onChange={(e) => setForm((current) => ({ ...current, best_contact_time: e.target.value }))}>
                          <option value="">Best contact time</option>
                          <option value="morning">Morning</option>
                          <option value="afternoon">Afternoon</option>
                          <option value="evening">Evening</option>
                        </select>
                      )}
                    </div>
                  )}

                  {vertical === 'auto' && (askCurrentInsurer || askVehiclesCount) && (
                    <div className="grid gap-4 md:grid-cols-2">
                      {askCurrentInsurer && <input className="rounded-2xl border border-gray-300 px-4 py-3" placeholder="Current auto insurer" value={form.vertical_answers.current_insurer} onChange={(e) => setForm((current) => ({ ...current, vertical_answers: { ...current.vertical_answers, current_insurer: e.target.value } }))} />}
                      {askVehiclesCount && <input className="rounded-2xl border border-gray-300 px-4 py-3" placeholder="How many vehicles need coverage?" value={form.vertical_answers.vehicles_count} onChange={(e) => setForm((current) => ({ ...current, vertical_answers: { ...current.vertical_answers, vehicles_count: e.target.value } }))} />}
                    </div>
                  )}

                  {vertical === 'home' && (askHomeownerStatus || askCurrentInsurer) && (
                    <div className="grid gap-4 md:grid-cols-2">
                      {askHomeownerStatus && <input className="rounded-2xl border border-gray-300 px-4 py-3" placeholder="Are you a homeowner or renter?" value={form.vertical_answers.homeowner_status} onChange={(e) => setForm((current) => ({ ...current, vertical_answers: { ...current.vertical_answers, homeowner_status: e.target.value } }))} />}
                      {askCurrentInsurer && <input className="rounded-2xl border border-gray-300 px-4 py-3" placeholder="Current home insurer" value={form.vertical_answers.current_insurer} onChange={(e) => setForm((current) => ({ ...current, vertical_answers: { ...current.vertical_answers, current_insurer: e.target.value } }))} />}
                    </div>
                  )}

                  {vertical === 'life' && askDependents && (
                    <div className="grid gap-4 md:grid-cols-2">
                      <input className="rounded-2xl border border-gray-300 px-4 py-3" placeholder="How many dependents rely on this coverage?" value={form.vertical_answers.dependents} onChange={(e) => setForm((current) => ({ ...current, vertical_answers: { ...current.vertical_answers, dependents: e.target.value } }))} />
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">This verified quote goes only to this agent.</div>
                    </div>
                  )}

                  {vertical === 'health' && askHouseholdSize && (
                    <div className="grid gap-4 md:grid-cols-2">
                      <input className="rounded-2xl border border-gray-300 px-4 py-3" placeholder="How many people need coverage?" value={form.vertical_answers.household_size} onChange={(e) => setForm((current) => ({ ...current, vertical_answers: { ...current.vertical_answers, household_size: e.target.value } }))} />
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">Qualified leads are verified first so the agent does not receive spam calls or fake submissions.</div>
                    </div>
                  )}

                  {askNotes && <textarea className="min-h-[120px] w-full rounded-2xl border border-gray-300 px-4 py-3" placeholder={verticalCopy.notesPlaceholder} value={form.notes} onChange={(e) => setForm((current) => ({ ...current, notes: e.target.value }))} />}
                  <input
                    type="text"
                    value={form.nickname}
                    onChange={(e) => setForm((current) => ({ ...current, nickname: e.target.value }))}
                    className="hidden"
                    tabIndex={-1}
                    autoComplete="off"
                  />
                  <input className="w-full rounded-2xl border border-gray-300 px-4 py-3" placeholder="Type 'beezio' to confirm you are human" value={form.human_check_answer} onChange={(e) => setForm((current) => ({ ...current, human_check_answer: e.target.value }))} />

                  <label className="flex items-start gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                    <input type="checkbox" checked={form.consent_to_contact} onChange={(e) => setForm((current) => ({ ...current, consent_to_contact: e.target.checked }))} />
                    <span>
                      {listing.disclaimer}
                      {singleAgentOnly ? ' Only this agent may contact you about this request.' : ''}
                      {noSpamCalling ? ' No spam calls, no cold-call list, and no random agent blast.' : ''}
                    </span>
                  </label>

                  {error && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

                  <button
                    type="submit"
                    disabled={!quoteFlowEnabled || submitState === 'submitting' || !form.consent_to_contact || verificationState !== 'verified' || !selectedStateAllowed}
                    className="w-full rounded-full px-5 py-4 text-sm font-semibold text-white disabled:opacity-60"
                    style={{ backgroundColor: themeAccent }}
                  >
                    {!quoteFlowEnabled
                      ? 'Credits required before lead delivery'
                      : submitState === 'submitting'
                        ? 'Submitting...'
                        : directQueueAllowed
                          ? 'Submit request and hold until credits are active'
                          : String(agencyProfile.cta_label || 'Submit qualified lead')}
                  </button>
                </form>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
};

export default InsuranceListingPage;
