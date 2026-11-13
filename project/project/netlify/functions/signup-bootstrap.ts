import type { Handler } from '@netlify/functions';
import { findSupabaseAdminForUser } from './_lib/supabase';
import { sendBusinessWelcome } from './_lib/business-welcome';

function json(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

function safeRole(value: unknown) {
  const role = String(value || '').trim().toLowerCase();
  return ['buyer', 'seller', 'affiliate', 'influencer', 'fundraiser'].includes(role) ? role : 'buyer';
}

function isUuid(value: unknown) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || '').trim());
}

function cleanSlug(value: unknown) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
}

async function slugAvailable(supabaseAdmin: any, slug: string, userId: string) {
  if (!slug) return '';
  const [seller, affiliate] = await Promise.all([
    supabaseAdmin.from('store_settings').select('seller_id').eq('subdomain', slug).maybeSingle(),
    supabaseAdmin.from('affiliate_store_settings').select('affiliate_id').eq('subdomain', slug).maybeSingle(),
  ]);
  if (seller.data?.seller_id && String(seller.data.seller_id) !== userId) return '';
  if (affiliate.data?.affiliate_id && String(affiliate.data.affiliate_id) !== userId) return '';
  return slug;
}

export const handler: Handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

    const body = JSON.parse(event.body || '{}');
    const userId = String(body.userId || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    if (!userId || !email) return json(400, { error: 'Missing userId or email' });

    const { supabaseAdmin, authUser, error: userError } = await findSupabaseAdminForUser(userId, email);
    if (!supabaseAdmin || !authUser) return json(404, { error: 'Auth user not found', details: userError?.message });
    const createdAt = new Date(String(authUser.created_at || 0)).getTime();
    // Keep bootstrap limited to newly created accounts while allowing enough
    // time for a user to finish the signup form or recover from a brief delay.
    const recentEnough = Number.isFinite(createdAt) && Date.now() - createdAt < 24 * 60 * 60 * 1000;
    if (!recentEnough) return json(403, { error: 'Signup bootstrap window expired' });

    const metadata = (authUser.user_metadata || {}) as Record<string, unknown>;
    const requestedRole = safeRole(metadata.role);
    const { data: grants, error: grantsError } = await supabaseAdmin
      .from('user_roles').select('role').eq('user_id', userId).eq('is_active', true);
    if (grantsError) return json(500, { error: 'Failed to verify registration roles' });

    const activeRoles = new Set((grants || []).map((grant: { role: string }) => grant.role));
    const businessRoles = ['seller', 'affiliate', 'influencer'];
    const businessRole = businessRoles.includes(requestedRole) && activeRoles.has(requestedRole)
      ? requestedRole
      : businessRoles.find((role) => activeRoles.has(role));
    const primaryRole = businessRole === 'influencer' && activeRoles.has('seller')
      ? 'seller'
      : businessRole || (activeRoles.has('fundraiser') ? 'fundraiser' : 'buyer');
    const isBuyerSignup = primaryRole === 'buyer';
    const assignedRoles = businessRole ? businessRoles.filter((role) => activeRoles.has(role)) : [primaryRole];
    const fullName = String(metadata.full_name || body.fullName || email.split('@')[0] || 'User').trim();
    const storeName = String(metadata.store_name || body.storeName || fullName || email.split('@')[0] || 'My Store').trim();
    const requestedSlug = cleanSlug(metadata.store_slug || body.storeSlug || storeName || email.split('@')[0]);
    const storeSlug = await slugAvailable(supabaseAdmin, requestedSlug, userId);
    const city = String(body.city || '').trim();
    const state = String(body.state || '').trim();
    const location = [city, state].filter(Boolean).join(', ') || null;
    const paypalEmail = String(metadata.paypal_email || body.paypalEmail || '').trim();
    const paypalConfirmed = Boolean(metadata.paypal_confirmed ?? body.paypalConfirmed) && paypalEmail.includes('@');
    const requestedReferrerProfileId = String(metadata.referrer_profile_id || body.referrerProfileId || '').trim();
    const independentContractorAcknowledged = Boolean(body.independentContractorAcknowledged);
    const taxDeliveryAcknowledged = Boolean(body.taxDeliveryAcknowledged);
    const taxComplianceVersion = String(body.taxComplianceVersion || authUser.user_metadata?.tax_compliance_version || '2026.03').trim();

    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('id,recruited_by_influencer_id')
      .eq('id', userId)
      .maybeSingle();

    let referrerProfileId = '';
    if (isUuid(requestedReferrerProfileId) && requestedReferrerProfileId !== userId) {
      const { data: referrerProfile } = await supabaseAdmin
        .from('profiles')
        .select('id,user_id,role,primary_role')
        .eq('id', requestedReferrerProfileId)
        .maybeSingle();
      const referrerUserId = String((referrerProfile as any)?.user_id || '').trim();
      const directInfluencerRole = ['role', 'primary_role'].some(
        (column) => String((referrerProfile as any)?.[column] || '').toLowerCase() === 'influencer'
      );
      const { data: influencerRole } = referrerUserId
        ? await supabaseAdmin
            .from('user_roles')
            .select('user_id')
            .eq('user_id', referrerUserId)
            .eq('role', 'influencer')
            .eq('is_active', true)
            .maybeSingle()
        : { data: null };
      if ((referrerProfile as any)?.id && (directInfluencerRole || (influencerRole as any)?.user_id)) {
        referrerProfileId = requestedReferrerProfileId;
      }
    }

    const profilePayload: any = {
      id: userId,
      user_id: userId,
      email,
      full_name: fullName,
      role: primaryRole,
      primary_role: primaryRole,
      phone: String(body.phone || '').trim() || null,
      location,
      zip_code: String(body.zipCode || body.zip_code || '').trim() || null,
      ...(!existingProfile?.recruited_by_influencer_id && referrerProfileId
        ? { recruited_by_influencer_id: referrerProfileId }
        : {}),
    };

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert(profilePayload, { onConflict: 'id' })
      .select('id')
      .maybeSingle();
    if (profileError) return json(500, { error: 'Failed to create profile', details: profileError.message });

    const profileId = String(profile?.id || userId);

    if (assignedRoles.includes('seller')) {
      await supabaseAdmin
        .from('store_settings')
        .upsert({ seller_id: profileId, store_name: storeName, ...(storeSlug ? { subdomain: storeSlug } : {}) }, { onConflict: 'seller_id' });
    }

    if (assignedRoles.includes('affiliate')) {
      await supabaseAdmin
        .from('affiliate_store_settings')
        .upsert({ affiliate_id: profileId, store_name: storeName, ...(storeSlug ? { subdomain: storeSlug } : {}), is_active: true }, { onConflict: 'affiliate_id' });
    }

    if (!isBuyerSignup && isUuid(referrerProfileId) && referrerProfileId !== profileId) {
      await Promise.all(
        ['seller', 'affiliate'].map(async (recruitedRole) => {
          const { error } = await supabaseAdmin
            .from('influencer_referrals')
            .insert({
              recruited_profile_id: profileId,
              recruited_role: recruitedRole,
              influencer_profile_id: referrerProfileId,
            });
          if (error && String(error.code) !== '23505') throw error;
        })
      );
    }

    if (!isBuyerSignup && paypalConfirmed) {
      await supabaseAdmin
        .from('paypal_accounts')
        .upsert(
          [
            { user_id: profileId, role: 'SELLER', paypal_email: paypalEmail, is_verified: false },
            { user_id: profileId, role: 'PARTNER', paypal_email: paypalEmail, is_verified: false },
            { user_id: profileId, role: 'INFLUENCER', paypal_email: paypalEmail, is_verified: false },
          ],
          { onConflict: 'user_id,role' }
        );
    }

    if (!isBuyerSignup) {
      const agreementTime = new Date().toISOString();
      await supabaseAdmin.from('tax_profiles').upsert(
        {
          user_id: profileId,
          legal_name: fullName,
          delivery_email: email,
          street_address: String(body.streetAddress || '').trim() || null,
          city: city || null,
          state_region: state || null,
          postal_code: String(body.zipCode || body.zip_code || '').trim() || null,
          country: 'US',
          tax_country: 'US',
          certification_name: fullName,
          independent_contractor_ack_at: independentContractorAcknowledged ? agreementTime : null,
          independent_contractor_version: independentContractorAcknowledged ? taxComplianceVersion : null,
          electronic_delivery_ack_at: taxDeliveryAcknowledged ? agreementTime : null,
        },
        { onConflict: 'user_id' }
      );

      const agreementRows = [
        independentContractorAcknowledged
          ? {
              user_id: profileId,
              agreement_type: 'independent_contractor',
              document_version: taxComplianceVersion,
              details: { source: 'signup_bootstrap' },
            }
          : null,
        taxDeliveryAcknowledged
          ? {
              user_id: profileId,
              agreement_type: 'electronic_delivery',
              document_version: taxComplianceVersion,
              details: { source: 'signup_bootstrap' },
            }
          : null,
      ].filter(Boolean);

      if (agreementRows.length) {
        await supabaseAdmin.from('tax_agreements').insert(agreementRows as any);
      }
    }

    // Do not couple email delivery to whether the auth trigger already created a profile.
    const welcomeEmail = await sendBusinessWelcome(supabaseAdmin, authUser);

    return json(200, {
      ok: true,
      welcomeEmail,
      profileId,
      role: primaryRole,
      roles: assignedRoles,
      storeSlug,
      createdProfile: !existingProfile?.id,
    });
  } catch (e) {
    return json(500, { error: 'Unexpected error', details: e instanceof Error ? e.message : String(e) });
  }
};
