import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

function json(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

function requireEnv(name: string, fallbacks: string[] = []): string {
  for (const key of [name, ...fallbacks]) {
    const value = String(process.env[key] || '').trim();
    if (value) return value;
  }
  throw new Error(`Missing ${name}`);
}

function safeRole(value: unknown) {
  const role = String(value || '').trim().toLowerCase();
  return ['buyer', 'seller', 'affiliate', 'influencer', 'fundraiser'].includes(role) ? role : 'buyer';
}

function uniqueRoles(values: string[]) {
  return Array.from(new Set(values.map((value) => safeRole(value)).filter(Boolean)));
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

    const supabaseUrl = requireEnv('SUPABASE_URL', ['VITE_SUPABASE_URL']);
    const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId);
    const authUser = userData?.user;
    if (userError || !authUser) return json(404, { error: 'Auth user not found', details: userError?.message });
    if (String(authUser.email || '').trim().toLowerCase() !== email) return json(403, { error: 'Email mismatch' });
    if (!authUser.email_confirmed_at) {
      return json(403, { error: 'Email must be confirmed before account setup can complete' });
    }

    const createdAt = new Date(String(authUser.created_at || 0)).getTime();
    const recentEnough = Number.isFinite(createdAt) && Date.now() - createdAt < 60 * 60 * 1000;
    if (!recentEnough) return json(403, { error: 'Signup bootstrap window expired' });

    const role = safeRole(body.role);
    const isBuyerSignup = role === 'buyer' && !body.bundleBusinessRoles;
    const primaryRole = isBuyerSignup ? 'buyer' : 'seller';
    const assignedRoles = isBuyerSignup ? ['buyer'] : uniqueRoles(['seller', 'affiliate', 'influencer']);
    const fullName = String(body.fullName || authUser.user_metadata?.full_name || email.split('@')[0] || 'User').trim();
    const storeName = String(body.storeName || fullName || email.split('@')[0] || 'My Store').trim();
    const requestedSlug = cleanSlug(body.storeSlug || storeName || email.split('@')[0]);
    const storeSlug = await slugAvailable(supabaseAdmin, requestedSlug, userId);
    const city = String(body.city || '').trim();
    const state = String(body.state || '').trim();
    const location = [city, state].filter(Boolean).join(', ') || null;
    const paypalEmail = String(body.paypalEmail || '').trim();
    const paypalConfirmed = Boolean(body.paypalConfirmed) && paypalEmail.includes('@');
    const referrerProfileId = String(body.referrerProfileId || '').trim();
    const independentContractorAcknowledged = Boolean(body.independentContractorAcknowledged);
    const taxDeliveryAcknowledged = Boolean(body.taxDeliveryAcknowledged);
    const taxComplianceVersion = String(body.taxComplianceVersion || authUser.user_metadata?.tax_compliance_version || '2026.03').trim();

    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle();

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
      ...(isUuid(referrerProfileId) && referrerProfileId !== userId ? { recruited_by_influencer_id: referrerProfileId } : {}),
    };

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert(profilePayload, { onConflict: 'id' })
      .select('id')
      .maybeSingle();
    if (profileError) return json(500, { error: 'Failed to create profile', details: profileError.message });

    const profileId = String(profile?.id || userId);

    for (const assignedRole of assignedRoles) {
      await supabaseAdmin.from('user_roles').insert({ user_id: userId, role: assignedRole, is_active: true }).then(({ error }: any) => {
        if (error && String(error.code) !== '23505') console.warn('signup-bootstrap user_roles:', error.message);
      });
    }

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
        ['seller', 'affiliate'].map((recruitedRole) =>
          supabaseAdmin
            .from('influencer_referrals')
            .upsert(
              {
                recruited_profile_id: profileId,
                recruited_role: recruitedRole,
                influencer_profile_id: referrerProfileId,
              },
              { onConflict: 'recruited_profile_id,recruited_role' }
            )
        )
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

    return json(200, {
      ok: true,
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
