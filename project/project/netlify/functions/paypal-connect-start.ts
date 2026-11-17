import type { Handler } from '@netlify/functions';
import { json, assertPost, parseJson } from './_lib/http';
import { extractAuthHeader, getAuthedUser } from './_lib/auth';
import { getPayPalBaseUrl, isPayPalEnabled } from './_lib/paypal';
import { createPayPalConnectState, paypalConnectCredentials, paypalConnectRedirectUri } from './_lib/paypalConnect';

export const handler: Handler = async (event) => {
  try {
    assertPost(event.httpMethod);
    if (!isPayPalEnabled()) return json(503, { error: 'Payments are temporarily unavailable.', code: 'PAYMENTS_PAUSED' });
    const authHeader = extractAuthHeader(event);
    if (!authHeader) return json(401, { error: 'Unauthorized' });
    const { user, error } = await getAuthedUser(authHeader);
    if (!user || error) return json(401, { error: error || 'Unauthorized' });
    const { clientId, secret } = paypalConnectCredentials();
    const body = parseJson<{ return_to?: string }>(event.body);
    const { state, nonce } = createPayPalConnectState(String(user.id), body.return_to || '/dashboard', secret);
    const baseUrl = await getPayPalBaseUrl();
    const authUrl = new URL(baseUrl.includes('sandbox') ? 'https://www.sandbox.paypal.com/connect' : 'https://www.paypal.com/connect');
    authUrl.searchParams.set('flowEntry', 'static');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', 'openid email');
    authUrl.searchParams.set('redirect_uri', paypalConnectRedirectUri());
    authUrl.searchParams.set('state', state);
    return json(200, { ok: true, authUrl: authUrl.toString(), nonce });
  } catch (e: any) {
    return json(Number(e?.statusCode) || 500, { error: e instanceof Error ? e.message : 'Unexpected error' });
  }
};
export default handler;
