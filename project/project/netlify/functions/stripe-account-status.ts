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

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Prefer a row that actually has a Stripe account id (schemas sometimes contain duplicates).
    const { data: profiles, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, user_id, stripe_account_id, seller_verification_status, identity_verification_status, email')
      .or(`id.eq.${user.id},user_id.eq.${user.id}`)
      .limit(10);

    if (profileError) return json(500, { error: 'Failed to load profile', details: profileError.message });

    const rows = Array.isArray(profiles) ? profiles : (profiles ? [profiles] : []);
    const rowWithStripe = rows.find((r: any) => String(r?.stripe_account_id || '').trim().length > 0);
    const stripeAccountId = rowWithStripe ? String((rowWithStripe as any).stripe_account_id).trim() : '';
    if (!stripeAccountId) return json(404, { error: 'No Stripe account found' });

    const stripeClient = stripe();
    const account = await stripeClient.accounts.retrieve(stripeAccountId);

    const requirements = (account.requirements?.currently_due || []).map(String);
    return json(200, {
      account_id: account.id,
      charges_enabled: Boolean(account.charges_enabled),
      payouts_enabled: Boolean(account.payouts_enabled),
      details_submitted: Boolean(account.details_submitted),
      requirements,
      seller_verification_status: (rowWithStripe as any)?.seller_verification_status || null,
      identity_verification_status: (rowWithStripe as any)?.identity_verification_status || null,
    });
  } catch (e) {
    return json(500, { error: 'Unexpected error', details: e instanceof Error ? e.message : String(e) });
  }
};

export { handler };
