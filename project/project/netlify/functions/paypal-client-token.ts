import type { Handler } from '@netlify/functions';
import { json } from './_lib/http';
import { getPayPalBaseUrl, getPayPalEnv, isPayPalEnabled } from './_lib/paypal';

const resolveCredentials = async () => {
  const env = await getPayPalEnv();
  if (env === 'live') {
    return {
      clientId: String(process.env.PAYPAL_LIVE_CLIENT_ID || process.env.PAYPAL_CLIENT_ID || '').trim(),
      clientSecret: String(process.env.PAYPAL_LIVE_CLIENT_SECRET || process.env.PAYPAL_CLIENT_SECRET || '').trim(),
    };
  }
  return {
    clientId: String(process.env.PAYPAL_SANDBOX_CLIENT_ID || process.env.PAYPAL_CLIENT_ID || '').trim(),
    clientSecret: String(process.env.PAYPAL_SANDBOX_CLIENT_SECRET || process.env.PAYPAL_CLIENT_SECRET || '').trim(),
  };
};

export const handler: Handler = async () => {
  try {
    if (!isPayPalEnabled()) {
      return json(503, { error: 'PayPal is disabled.' });
    }

    const { clientId, clientSecret } = await resolveCredentials();
    if (!clientId || !clientSecret) {
      return json(400, { error: 'PayPal credentials are not configured.' });
    }

    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const baseUrl = await getPayPalBaseUrl();

    const res = await fetch(`${baseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials&response_type=client_token',
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const message = String((data as any)?.error_description || (data as any)?.message || 'Token request failed');
      return json(res.status, { error: `PayPal client token request failed: ${message}` });
    }

    const clientToken = String((data as any)?.access_token || '').trim();
    if (!clientToken) {
      return json(500, { error: 'PayPal did not return a client token.' });
    }

    return json(200, {
      clientToken,
      expiresIn: Number((data as any)?.expires_in || 0),
      tokenType: String((data as any)?.token_type || '').trim() || 'Bearer',
    });
  } catch (err) {
    return json(500, {
      error: err instanceof Error ? err.message : 'Unexpected error',
    });
  }
};

export default handler;
