import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

function json(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

function requireEnv(name: string, fallbacks: string[] = []): string {
  const keys = [name, ...fallbacks];
  for (const key of keys) {
    const value = String(process.env[key] || '').trim();
    if (value) return value;
  }
  throw new Error(`Missing ${name}${fallbacks.length ? ` (or ${fallbacks.join(', ')})` : ''}`);
}

function stripe(): Stripe {
  const key = requireEnv('STRIPE_SECRET_KEY');
  return new Stripe(key, { apiVersion: '2023-10-16' });
}

function buildOrigin(event: any): string {
  const proto = String(event.headers['x-forwarded-proto'] || 'https');
  const host = String(event.headers.host || '');
  return `${proto}://${host}`;
}

async function getAuthedUser(params: { supabaseUrl: string; anonKey: string; authHeader: string }) {
  const supabaseAuthed = createClient(params.supabaseUrl, params.anonKey, {
    global: { headers: { Authorization: params.authHeader } },
  });
  const { data, error } = await supabaseAuthed.auth.getUser();
  if (error || !data?.user) return { user: null, error: error?.message || 'Unauthorized' };
  return { user: data.user, error: null };
}

const handler: Handler = async (event) => {
  try {
    if (event.httpMethod === 'OPTIONS') return json(200, {});
    if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

    const supabaseUrl = requireEnv('SUPABASE_URL', ['VITE_SUPABASE_URL']);
    const anonKey = requireEnv('SUPABASE_ANON_KEY', ['VITE_SUPABASE_ANON_KEY']);
    const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

    const authHeader = String(event.headers.authorization || event.headers.Authorization || '').trim();
    if (!authHeader) return json(401, { error: 'Missing authorization header' });

    const { user, error: authErr } = await getAuthedUser({ supabaseUrl, anonKey, authHeader });
    if (!user) return json(401, { error: 'Unauthorized', details: authErr });

    const body = event.body ? JSON.parse(event.body) : {};
    const normalizedType = String(body?.type || '').toLowerCase().trim();
    const type = normalizedType === 'seller' || normalizedType === 'affiliate' || normalizedType === 'fundraiser' ? normalizedType : 'affiliate';
    const countryCode = String(body?.country || 'US').toUpperCase().trim() || 'US';

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    const { data: profiles, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, user_id, email, stripe_account_id')
      .or(`id.eq.${user.id},user_id.eq.${user.id}`)
      .limit(10);

    if (profileError) return json(500, { error: 'Failed to load profile', details: profileError.message });

    const rows = Array.isArray(profiles) ? profiles : (profiles ? [profiles] : []);
    const rowWithStripe = rows.find((r: any) => String(r?.stripe_account_id || '').trim().length > 0);
    const existingAccountId = rowWithStripe ? String((rowWithStripe as any).stripe_account_id).trim() : '';

    const primaryProfile =
      rows.find((r: any) => String(r?.id || '') === String(user.id)) ||
      rows.find((r: any) => String(r?.user_id || '') === String(user.id)) ||
      rows[0] ||
      null;

    const profileId = primaryProfile?.id ? String((primaryProfile as any).id) : null;
    if (!profileId) return json(400, { error: 'Missing profile for user' });

    const emailFromProfile = String((primaryProfile as any)?.email || '').trim();
    const email = emailFromProfile || String(user.email || '').trim();
    if (!email) return json(400, { error: 'Missing email on profile' });

    const stripeClient = stripe();
    const origin = buildOrigin(event);
    const returnUrl = `${origin}/stripe/return`;

    if (existingAccountId) {
      const accountLink = await stripeClient.accountLinks.create({
        account: existingAccountId,
        refresh_url: returnUrl,
        return_url: returnUrl,
        type: 'account_onboarding',
        collect: 'eventually_due',
      });
      return json(200, { account_id: existingAccountId, onboarding_url: accountLink.url, already_connected: true });
    }

    const account = await stripeClient.accounts.create({
      type: 'express',
      email,
      country: countryCode,
      metadata: {
        beezio_profile_id: profileId,
        beezio_user_id: user.id,
        beezio_user_type: type,
      },
      business_type: 'individual',
      capabilities: { transfers: { requested: true } },
    });

    const accountLink = await stripeClient.accountLinks.create({
      account: account.id,
      refresh_url: returnUrl,
      return_url: returnUrl,
      type: 'account_onboarding',
      collect: 'eventually_due',
    });

    // Backfill stripe_account_id into all matching profile rows.
    await supabaseAdmin.from('profiles').update({ stripe_account_id: account.id }).or(`id.eq.${user.id},user_id.eq.${user.id}`);

    try {
      await supabaseAdmin.from('stripe_account_creations').insert({
        stripe_account_id: account.id,
        user_email: email,
        user_type: type,
        profile_id: profileId,
        agreements_signed: true,
        onboarding_url: accountLink.url,
        created_at: new Date().toISOString(),
      } as any);
    } catch {
      // ignore
    }

    return json(200, { account_id: account.id, onboarding_url: accountLink.url, embedded: true });
  } catch (e) {
    return json(500, { error: 'Unexpected error', details: e instanceof Error ? e.message : String(e) });
  }
};

export { handler };
