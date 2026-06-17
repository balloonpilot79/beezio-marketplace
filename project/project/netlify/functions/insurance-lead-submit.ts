import type { Handler } from '@netlify/functions';
import { createSupabaseAdmin } from './_lib/supabase';
import { assertPost, json, parseJson } from './_lib/http';
import { analyzeInsuranceLeadFraud } from './_lib/insuranceFraud';
import { loadInsuranceAdminSettings } from './_lib/insuranceMarketplace';
import {
  buildInsuranceLeadAgentEmail,
  buildInsuranceLeadCustomerEmail,
  buildInsuranceLowFundsEmail,
  sendTransactionalEmail,
} from './_lib/email';
import {
  computeInsuranceLeadSplitCents,
  normalizeEmail,
  normalizeInsuranceVertical,
  normalizePhone,
} from '../../shared/insuranceLeads';
import { resolveRecruiterInfluencerId } from './_lib/influencer-referrals';

const isUuid = (value: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const STATE_NAME_TO_CODE: Record<string, string> = {
  alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA', colorado: 'CO',
  connecticut: 'CT', delaware: 'DE', florida: 'FL', georgia: 'GA', hawaii: 'HI', idaho: 'ID',
  illinois: 'IL', indiana: 'IN', iowa: 'IA', kansas: 'KS', kentucky: 'KY', louisiana: 'LA',
  maine: 'ME', maryland: 'MD', massachusetts: 'MA', michigan: 'MI', minnesota: 'MN', mississippi: 'MS',
  missouri: 'MO', montana: 'MT', nebraska: 'NE', nevada: 'NV', 'new hampshire': 'NH', 'new jersey': 'NJ',
  'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC', 'north dakota': 'ND', ohio: 'OH',
  oklahoma: 'OK', oregon: 'OR', pennsylvania: 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
  'south dakota': 'SD', tennessee: 'TN', texas: 'TX', utah: 'UT', vermont: 'VT', virginia: 'VA',
  washington: 'WA', 'west virginia': 'WV', wisconsin: 'WI', wyoming: 'WY', 'district of columbia': 'DC', dc: 'DC',
};

const normalizeState = (value: unknown): string => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const upper = raw.toUpperCase();
  if (/^[A-Z]{2}$/.test(upper)) return upper;
  return STATE_NAME_TO_CODE[raw.toLowerCase()] || '';
};

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

const loadProfileContact = async (supabaseAdmin: any, profileId: string | null | undefined) => {
  const rawId = String(profileId || '').trim();
  if (!rawId) return null;
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('id,full_name,email')
    .or(`id.eq.${rawId},user_id.eq.${rawId}`)
    .limit(1)
    .maybeSingle();
  return data || null;
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
    assertPost(event.httpMethod);

    const body = parseJson<any>(event.body);
    const listingId = String(body?.listing_id || '').trim();
    if (!listingId) return json(400, { ok: false, error: 'Missing listing_id' });

    const supabaseAdmin = createSupabaseAdmin();
    const adminSettings = await loadInsuranceAdminSettings(supabaseAdmin);

    const { data: campaign, error: campaignError } = await supabaseAdmin
      .from('insurance_lead_campaigns')
      .select('*')
      .eq('listing_id', listingId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (campaignError) return json(500, { ok: false, error: campaignError.message });
    if (!campaign) return json(404, { ok: false, error: 'Campaign not found for this insurance listing.' });

    const { data: listing, error: listingError } = await supabaseAdmin
      .from('insurance_agent_listings')
      .select('*')
      .eq('id', listingId)
      .maybeSingle();
    if (listingError) return json(500, { ok: false, error: listingError.message });
    if (!listing || !(listing as any).is_active || !(listing as any).accepts_new_leads) {
      return json(404, { ok: false, error: 'This insurance listing is not accepting leads right now.' });
    }
    const firstName = String(body?.first_name || '').trim();
    const lastName = String(body?.last_name || '').trim();
    const email = normalizeEmail(body?.email);
    const phone = normalizePhone(body?.phone);
    const consentToContact = body?.consent_to_contact === true;
    const verificationId = String(body?.verification_id || '').trim();
    const vertical = normalizeInsuranceVertical(body?.vertical || (campaign as any)?.vertical || 'life');
    const submittedState = normalizeState(body?.state || body?.vertical_answers?.state || '');
    const servedStates = Array.isArray((listing as any)?.states_served)
      ? ((listing as any).states_served as unknown[]).map((value) => normalizeState(value)).filter(Boolean)
      : [];
    if (servedStates.length > 0 && (!submittedState || !servedStates.includes(submittedState))) {
      return json(400, { ok: false, error: 'This insurance store is not accepting leads from that state.' });
    }
    const formStartedAt = body?.form_started_at ? new Date(body.form_started_at).toISOString() : null;
    const submittedAt = new Date().toISOString();
    if (!firstName || !lastName || !email || !phone) {
      return json(400, { ok: false, error: 'First name, last name, email, and phone are required.' });
    }
    if (!consentToContact) {
      return json(400, { ok: false, error: 'Consent to contact is required.' });
    }
    if (!verificationId) {
      return json(400, { ok: false, error: 'Phone verification is required before submitting.' });
    }

    const { data: verification, error: verificationError } = await supabaseAdmin
      .from('insurance_phone_verifications')
      .select('*')
      .eq('id', verificationId)
      .maybeSingle();
    if (verificationError) return json(500, { ok: false, error: verificationError.message });
    if (!verification || String((verification as any)?.status || '') !== 'verified') {
      return json(400, { ok: false, error: 'Phone verification must be completed before submitting.' });
    }
    if (String((verification as any)?.phone_normalized || '') !== phone) {
      return json(400, { ok: false, error: 'Verified phone does not match the submitted phone number.' });
    }

    const affiliateId = await resolveAffiliateId(supabaseAdmin, String(body?.affiliate_id || body?.affiliate_ref || '').trim());
    const sourceType = affiliateId ? 'affiliate' : 'direct_agent';
    const agentUserId = String((campaign as any)?.agent_user_id || (listing as any)?.agent_profile_id || '').trim();
    const { data: wallet } = await supabaseAdmin
      .from('insurance_agent_wallets')
      .select('balance_cents,status')
      .eq('agent_user_id', agentUserId)
      .maybeSingle();
    const walletBalanceCents = Math.max(0, Number((wallet as any)?.balance_cents || 0));
    const requiredLeadCreditsCents = Math.max(1, Number((campaign as any)?.cost_per_lead_cents || 0));
    const campaignActive = String((campaign as any)?.status || '').toLowerCase() === 'active';
    const hasCredits = walletBalanceCents >= requiredLeadCreditsCents;
    if (affiliateId && (!campaignActive || !hasCredits)) {
      return json(409, {
        ok: false,
        error: 'This insurance page is out of credits right now, so affiliates cannot route leads to it until the agent funds credits again.',
        code: 'INSURANCE_OUT_OF_CREDITS',
      });
    }
    const influencerId =
      (await resolveRecruiterInfluencerId(supabaseAdmin, affiliateId, 'affiliate')) ||
      (await resolveRecruiterInfluencerId(supabaseAdmin, String((campaign as any)?.agent_user_id || '').trim(), 'seller')) ||
      null;

    const clientIp = getIpAddress(event);
    const fraud = await analyzeInsuranceLeadFraud({
      supabaseAdmin,
      campaignId: String((campaign as any)?.id || ''),
      affiliateId,
      email,
      phone,
      ipAddress: clientIp,
      userAgent: String(event.headers['user-agent'] || '').trim(),
      formStartedAt,
      submittedAt,
      honeypotValue: String(body?.nickname || body?.website || '').trim(),
      humanCheckAnswer: String(body?.human_check_answer || '').trim(),
    });

    const split = computeInsuranceLeadSplitCents({
      leadPriceCents: Number((campaign as any)?.cost_per_lead_cents || 0),
      hasAffiliate: Boolean(affiliateId),
      hasInfluencer: Boolean(influencerId),
      minBeezioFeeCents: adminSettings.minBeezioFeeCents,
    });

    const payloadJson = {
      age_range: String(body?.age_range || '').trim() || null,
      timeline: String(body?.timeline || '').trim() || null,
      current_coverage: String(body?.current_coverage || '').trim() || null,
      best_contact_time: String(body?.best_contact_time || '').trim() || null,
      state: submittedState || null,
      source_type: sourceType,
      consent_to_contact: consentToContact,
      vertical_answers: body?.vertical_answers && typeof body.vertical_answers === 'object' ? body.vertical_answers : {},
      source_url: String(body?.source_url || event.headers.referer || '').trim() || null,
    };

    const awaitingCreditFunding = !affiliateId && (!campaignActive || !hasCredits);
    const queuedReason = !campaignActive ? 'awaiting_campaign_activation' : 'awaiting_credit_funding';

    const { data: lead, error: leadError } = await supabaseAdmin
      .from('insurance_leads')
      .insert({
        listing_id: listingId,
        campaign_id: String((campaign as any)?.id || ''),
        vertical,
        agent_profile_id: String((listing as any)?.agent_profile_id || ''),
        agent_user_id: String((campaign as any)?.agent_user_id || (listing as any)?.agent_profile_id || ''),
        affiliate_id: affiliateId,
        affiliate_user_id: affiliateId,
        influencer_id: influencerId,
        first_name: firstName,
        last_name: lastName,
        email,
        phone,
        zip_code: String(body?.zip_code || '').trim() || null,
        notes: String(body?.notes || '').trim() || null,
        source_url: payloadJson.source_url,
        ip_hash: fraud.ipHash,
        submitted_ip_hash: fraud.ipHash,
        duplicate_hash: fraud.duplicateHash,
        user_agent: String(event.headers['user-agent'] || '').trim() || null,
        lead_price: split.leadPriceCents / 100,
        lead_price_cents: split.leadPriceCents,
        affiliate_payout: split.affiliatePayoutCents / 100,
        affiliate_payout_cents: split.affiliatePayoutCents,
        influencer_payout: split.influencerPayoutCents / 100,
        influencer_payout_cents: split.influencerPayoutCents,
        paypal_fee_estimate: split.paypalFeeCents / 100,
        paypal_fee_cents: split.paypalFeeCents,
        beezio_fee_gross: split.beezioFeeCents / 100,
        beezio_fee_net: split.beezioFeeCents / 100,
        beezio_fee_cents: split.beezioFeeCents,
        payload_json: payloadJson,
        metadata: {
          agency_name: String((listing as any)?.agency_name || ''),
          campaign_id: String((campaign as any)?.id || ''),
          source_type: sourceType,
        },
        phone_verification_id: verificationId,
        phone_verified_at: (verification as any)?.verified_at || new Date().toISOString(),
        consent_to_contact: consentToContact,
        form_started_at: formStartedAt,
        submitted_at: submittedAt,
        completion_seconds: fraud.completionSeconds,
        honeypot_value: String(body?.nickname || body?.website || '').trim() || null,
        anti_bot_passed: fraud.antiBotPassed,
        fraud_score: fraud.fraudScore,
        fraud_flags_json: fraud.fraudFlags,
        review_status: awaitingCreditFunding ? 'queued' : fraud.reviewStatus,
        status: awaitingCreditFunding ? 'submitted' : fraud.status,
        is_duplicate: fraud.isDuplicate,
        duplicate_lead_id: fraud.duplicateLeadId,
        status_reason: awaitingCreditFunding ? queuedReason : fraud.statusReason,
      })
      .select('*')
      .single();
    if (leadError) return json(500, { ok: false, error: leadError.message });

    const agentProfile = await loadProfileContact(supabaseAdmin, String((listing as any)?.agent_profile_id || (campaign as any)?.agent_user_id || ''));
    const agentName = String((agentProfile as any)?.full_name || (listing as any)?.agency_name || 'Beezio agent').trim();
    const agentEmail = String((agentProfile as any)?.email || '').trim();
    const listingName = String((listing as any)?.agency_name || (listing as any)?.title || 'Beezio insurance').trim();
    const stateLabel = submittedState || String(body?.state || body?.vertical_answers?.state || '').trim();
    const leadName = `${firstName} ${lastName}`.trim();

    const sendBestEffort = async (to: string, payload: { subject: string; html: string }) => {
      try {
        const result = await sendTransactionalEmail({ to, subject: payload.subject, html: payload.html });
        if (!result.sent) {
          console.warn('[insurance-lead-submit] email skipped:', result.reason);
        }
      } catch (emailErr) {
        console.warn('[insurance-lead-submit] email failed (non-fatal):', emailErr);
      }
    };

    if (agentEmail && !awaitingCreditFunding) {
      const statusLabel =
        fraud.reviewStatus === 'flagged'
          ? 'flagged for review'
          : fraud.reviewStatus === 'rejected' || fraud.status === 'invalid'
            ? 'rejected by fraud screening'
            : 'submitted';
      await sendBestEffort(
        agentEmail,
        buildInsuranceLeadAgentEmail({
          agentName,
          leadName,
          leadEmail: email,
          leadPhone: phone,
          vertical,
          listingName,
          state: stateLabel,
          statusLabel,
          notes: fraud.statusReason || null,
        })
      );
    }

    await sendBestEffort(
      email,
      buildInsuranceLeadCustomerEmail({
        customerName: leadName,
        agentName,
        vertical,
        statusLabel: awaitingCreditFunding
          ? 'received and held'
          : fraud.reviewStatus === 'flagged'
            ? 'received and queued for review'
            : 'received',
        listingName,
        notes: awaitingCreditFunding
          ? 'This agent website is live, but lead delivery is paused until credits are funded. Your request has been safely recorded and will stay on hold until activation.'
          : fraud.reviewStatus === 'flagged'
            ? 'Your request needs a manual review before delivery.'
            : null,
      })
    );

    if (awaitingCreditFunding) {
      if (agentEmail) {
        await sendBestEffort(
          agentEmail,
          buildInsuranceLowFundsEmail({
            agentName,
            listingName,
            balanceCents: walletBalanceCents,
            leadCostCents: Number((campaign as any)?.cost_per_lead_cents || 0),
          })
        );
      }

      return json(200, {
        ok: true,
        lead_id: String((lead as any)?.id || ''),
        review_status: 'queued',
        status: 'submitted',
        delivered: false,
        source_type: sourceType,
        reason: queuedReason,
      });
    }

    if (fraud.reviewStatus === 'rejected' || fraud.status === 'invalid') {
      return json(200, {
        ok: true,
        lead_id: String((lead as any)?.id || ''),
        review_status: fraud.reviewStatus,
        status: 'invalid',
        delivered: false,
        source_type: sourceType,
        reason: fraud.statusReason || 'rejected',
      });
    }

    if (fraud.reviewStatus === 'flagged') {
      return json(200, {
        ok: true,
        lead_id: String((lead as any)?.id || ''),
        review_status: 'flagged',
        status: 'submitted',
        delivered: false,
        source_type: sourceType,
        reason: fraud.statusReason || 'manual_review_required',
      });
    }

    const { data: processed, error: processError } = await supabaseAdmin
      .rpc('process_insurance_approved_lead', { p_lead_id: String((lead as any)?.id || '') });
    if (processError) return json(500, { ok: false, error: processError.message });

    const processOk = Boolean((processed as any)?.ok);
    if (processOk) {
      await sendBestEffort(
        email,
        buildInsuranceLeadCustomerEmail({
          customerName: leadName,
          agentName,
          vertical,
          statusLabel: 'approved',
          listingName,
        })
      );
    } else if (String((processed as any)?.reason || '') === 'insufficient_funds' && agentEmail) {
      const { data: wallet } = await supabaseAdmin
        .from('insurance_agent_wallets')
        .select('balance_cents')
        .eq('agent_user_id', String((campaign as any)?.agent_user_id || (listing as any)?.agent_profile_id || ''))
        .limit(1)
        .maybeSingle();

      await sendBestEffort(
        agentEmail,
        buildInsuranceLowFundsEmail({
          agentName,
          listingName,
          balanceCents: Number((wallet as any)?.balance_cents || 0),
          leadCostCents: Number((campaign as any)?.cost_per_lead_cents || 0),
        })
      );
    }

    return json(200, {
      ok: true,
      lead_id: String((lead as any)?.id || ''),
      source_type: sourceType,
      processed,
      delivered: Boolean((processed as any)?.ok),
      split: {
        lead_price: split.leadPriceCents / 100,
        affiliate_payout: split.affiliatePayoutCents / 100,
        influencer_payout: split.influencerPayoutCents / 100,
        paypal_fee_estimate: split.paypalFeeCents / 100,
        beezio_fee_gross: split.beezioFeeCents / 100,
      },
    });
  } catch (error: any) {
    return json(Number(error?.statusCode) || 500, { ok: false, error: error?.message || 'Unexpected error' });
  }
};

export default handler;
