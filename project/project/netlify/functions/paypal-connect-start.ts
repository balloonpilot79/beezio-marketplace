import type { Handler } from '@netlify/functions';
import { json, assertPost, parseJson } from './_lib/http';
import { extractAuthHeader, getAuthedUser } from './_lib/auth';
import { getPayPalBaseUrl, isPayPalEnabled } from './_lib/paypal';

type Body = {
  return_to?: string;
};

const isSafeReturnPath = (value: string): boolean => {
  if (!value) return false;
  if (!value.startsWith('/')) return false;
  if (value.startsWith('//')) return false;
  if (value.includes('://')) return false;
  return true;
};

const toBase64Url = (input: string): string => Buffer.from(input, 'utf8').toString('base64url');

const getOriginFromEvent = (event: Parameters<Handler>[0]): string => {
  const proto = String(event.headers['x-forwarded-proto'] || 'https').split(',')[0].trim() || 'https';
  const host = String(event.headers['x-forwarded-host'] || event.headers.host || '').split(',')[0].trim();
  if (!host) throw new Error('Missing host header');
  return `${proto}://${host}`;
};

const getAuthorizeBase = async (): Promise<string> => {
  const apiBase = await getPayPalBaseUrl();
  if (apiBase.includes('sandbox')) return 'https://www.sandbox.paypal.com/signin/authorize';
  return 'https://www.paypal.com/signin/authorize';
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
    if (!clientId) return json(503, { error: 'PayPal is not configured.', code: 'PAYPAL_NOT_CONFIGURED' });

    const body = parseJson<Body>(event.body);
    const requestedReturnTo = String(body?.return_to || '/dashboard').trim();
    const returnTo = isSafeReturnPath(requestedReturnTo) ? requestedReturnTo : '/dashboard';

    const nonce = globalThis.crypto?.randomUUID?.() || `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const payload = {
      nonce,
      returnTo,
      iat: Date.now(),
      uid: String(user.id),
    };

    const state = toBase64Url(JSON.stringify(payload));
    const origin = getOriginFromEvent(event);
    const redirectUri = String(process.env.PAYPAL_CONNECT_REDIRECT_URI || '').trim() || `${origin}/paypal/connect/callback`;
    const scopes = String(process.env.PAYPAL_CONNECT_SCOPES || 'openid email profile');

    const authUrl = new URL(await getAuthorizeBase());
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', scopes);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('state', state);

    return json(200, {
      ok: true,
      authUrl: authUrl.toString(),
      nonce,
      returnTo,
    });
  } catch (e: any) {
    const statusCode = Number(e?.statusCode) || 500;
    return json(statusCode, { error: e instanceof Error ? e.message : 'Unexpected error' });
  }
};

export default handler;
