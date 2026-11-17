import type { Handler } from '@netlify/functions';
import { json, assertPost, parseJson } from './_lib/http';
import { createSupabaseAdmin } from './_lib/supabase';
import { extractAuthHeader, getAuthedUser, resolveProfileId } from './_lib/auth';
import { getPayPalBaseUrl, isPayPalEnabled } from './_lib/paypal';
import { getVerifiedPayPalIdentity, paypalConnectCredentials, paypalConnectRedirectUri, verifyPayPalConnectState } from './_lib/paypalConnect';

export const handler: Handler = async (event) => {
  try {
    assertPost(event.httpMethod);
    if (!isPayPalEnabled()) return json(503, { error: 'Payments are temporarily unavailable.', code: 'PAYMENTS_PAUSED' });
    const authHeader = extractAuthHeader(event);
    if (!authHeader) return json(401, { error: 'Unauthorized' });
    const { user, error } = await getAuthedUser(authHeader);
    if (!user || error) return json(401, { error: error || 'Unauthorized' });
    const { clientId, secret } = paypalConnectCredentials();
    const body = parseJson<{ code?: string; state?: string; expected_nonce?: string }>(event.body);
    const code = String(body.code || '').trim();
    if (!code) return json(400, { error: 'Missing PayPal authorization code. Please connect again.' });
    let state: { returnTo: string };
    try {
      state = verifyPayPalConnectState(String(body.state || ''), String(body.expected_nonce || ''), String(user.id), secret);
    } catch (e: any) { return json(400, { error: e.message }); }
    const baseUrl = await getPayPalBaseUrl();
    const tokenRes = await fetch(`${baseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${clientId}:${secret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: paypalConnectRedirectUri() }).toString(),
      signal: AbortSignal.timeout(12000),
    });
    if (!tokenRes.ok) return json(400, { error: 'PayPal authorization failed. Please connect again. If this persists, contact Beezio support to check the PayPal app configuration.' });
    const tokenData = await tokenRes.json();
    let identity: { email: string; payerId: string };
    try { identity = await getVerifiedPayPalIdentity(baseUrl, String(tokenData?.access_token || '')); }
    catch (e: any) { return json(400, { error: e.message, emailVerified: false }); }
    const profileId = await resolveProfileId(user);
    if (!profileId) return json(400, { error: 'Unable to resolve your Beezio profile.' });
    const roles = ['SELLER', 'PARTNER', 'INFLUENCER'];
    const { data, error: saveError } = await createSupabaseAdmin().from('paypal_accounts')
      .upsert(roles.map(role => ({ user_id: profileId, role, paypal_email: identity.email, is_verified: true })), { onConflict: 'user_id,role' })
      .select('role,paypal_email,is_verified');
    if (saveError) return json(500, { error: 'Unable to save your verified PayPal connection. Please try again.' });
    if (data?.length !== 3 || !roles.every(role => data.some(row => row.role === role && row.is_verified === true && row.paypal_email === identity.email))) {
      return json(500, { error: 'Your PayPal verification could not be confirmed in Beezio. Please contact support.', emailVerified: false });
    }
    return json(200, { ok: true, paypalEmail: identity.email, emailVerified: true, returnTo: state.returnTo });
  } catch (e: any) {
    return json(Number(e?.statusCode) || 500, { error: e instanceof Error ? e.message : 'Unexpected error' });
  }
};
export default handler;
