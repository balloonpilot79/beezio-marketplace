import type { Handler } from '@netlify/functions';
import { json, assertPost, parseJson } from './_lib/http';
import { createSupabaseAdmin } from './_lib/supabase';
import { extractAuthHeader, getAuthedUser, resolveProfileId } from './_lib/auth';
import { getPayPalBaseUrl, isPayPalEnabled } from './_lib/paypal';

type Body = {
  code?: string;
  state?: string;
  expected_nonce?: string;
};

const fromBase64Url = (input: string): string => Buffer.from(input, 'base64url').toString('utf8');

const decodeJwtPayload = (token: string): Record<string, any> | null => {
  const parts = String(token || '').split('.');
  if (parts.length < 2) return null;
  try {
    const raw = Buffer.from(parts[1], 'base64url').toString('utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
};

const getOriginFromEvent = (event: Parameters<Handler>[0]): string => {
  const proto = String(event.headers['x-forwarded-proto'] || 'https').split(',')[0].trim() || 'https';
  const host = String(event.headers['x-forwarded-host'] || event.headers.host || '').split(',')[0].trim();
  if (!host) throw new Error('Missing host header');
  return `${proto}://${host}`;
};

export const handler: Handler = async (event) => {
  try {
    assertPost(event.httpMethod);
    if (!isPayPalEnabled()) return json(503, { error: 'Payments are temporarily unavailable.', code: 'PAYMENTS_PAUSED' });

    const authHeader = extractAuthHeader(event);
    if (!authHeader) return json(401, { error: 'Unauthorized' });
    const { user, error } = await getAuthedUser(authHeader);
    if (!user || error) return json(401, { error: error || 'Unauthorized' });

    const clientId = String(process.env.PAYPAL_CONNECT_CLIENT_ID || process.env.PAYPAL_CLIENT_ID || '').trim();
    const secret = String(process.env.PAYPAL_CONNECT_CLIENT_SECRET || process.env.PAYPAL_CLIENT_SECRET || '').trim();
    if (!clientId || !secret) return json(503, { error: 'PayPal is not configured.', code: 'PAYPAL_NOT_CONFIGURED' });

    const body = parseJson<Body>(event.body);
    const code = String(body?.code || '').trim();
    const stateRaw = String(body?.state || '').trim();
    const expectedNonce = String(body?.expected_nonce || '').trim();
    if (!code) return json(400, { error: 'Missing code' });
    if (!stateRaw) return json(400, { error: 'Missing state' });
    if (!expectedNonce) return json(400, { error: 'Missing expected nonce' });

    let state: { nonce?: string; returnTo?: string; iat?: number; uid?: string } = {};
    try {
      state = JSON.parse(fromBase64Url(stateRaw));
    } catch {
      return json(400, { error: 'Invalid state' });
    }

    const nonce = String(state?.nonce || '').trim();
    const issuedAt = Number(state?.iat || 0);
    const stateUserId = String(state?.uid || '').trim();
    const returnTo = String(state?.returnTo || '/dashboard').trim() || '/dashboard';

    if (!nonce || nonce !== expectedNonce) return json(400, { error: 'Invalid nonce' });
    if (!issuedAt || Date.now() - issuedAt > 15 * 60 * 1000) return json(400, { error: 'State has expired' });
    if (stateUserId && stateUserId !== String(user.id)) return json(403, { error: 'State does not match current user' });

    const baseUrl = await getPayPalBaseUrl();
    const redirectUri =
      String(process.env.PAYPAL_CONNECT_REDIRECT_URI || '').trim() ||
      `${getOriginFromEvent(event)}/paypal/connect/callback`;
    const auth = Buffer.from(`${clientId}:${secret}`).toString('base64');

    const tokenRes = await fetch(`${baseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `grant_type=authorization_code&code=${encodeURIComponent(code)}&redirect_uri=${encodeURIComponent(redirectUri)}`,
    });

    const tokenData = await tokenRes.json().catch(() => ({}));
    if (!tokenRes.ok) {
      return json(400, {
        error: 'PayPal authorization failed',
        details: String((tokenData as any)?.error_description || (tokenData as any)?.error || 'unknown'),
      });
    }

    const idToken = String((tokenData as any)?.id_token || '').trim();
    const idPayload = decodeJwtPayload(idToken);

    const email = String(idPayload?.email || '').trim().toLowerCase();
    const emailVerified = Boolean(idPayload?.email_verified);
    const payerId = String(idPayload?.payer_id || idPayload?.sub || '').trim() || null;

    if (!email) {
      return json(400, {
        error: 'PayPal did not return an email address. Please try again and allow email scope.',
      });
    }

    const profileId = await resolveProfileId(user as any);
    if (!profileId) return json(400, { error: 'Unable to resolve profile id' });

    const supabaseAdmin = createSupabaseAdmin();
    const rows = [
      { user_id: profileId, role: 'SELLER', paypal_email: email, is_verified: emailVerified },
      { user_id: profileId, role: 'PARTNER', paypal_email: email, is_verified: emailVerified },
      { user_id: profileId, role: 'INFLUENCER', paypal_email: email, is_verified: emailVerified },
    ];

    const { error: upsertError } = await supabaseAdmin
      .from('paypal_accounts')
      .upsert(rows as any, { onConflict: 'user_id,role' });

    if (upsertError) {
      return json(500, { error: `Failed to save PayPal account: ${upsertError.message}` });
    }

    return json(200, {
      ok: true,
      paypalEmail: email,
      emailVerified,
      payerId,
      returnTo: returnTo.startsWith('/') ? returnTo : '/dashboard',
    });
  } catch (e: any) {
    const statusCode = Number(e?.statusCode) || 500;
    return json(statusCode, { error: e instanceof Error ? e.message : 'Unexpected error' });
  }
};

export default handler;
