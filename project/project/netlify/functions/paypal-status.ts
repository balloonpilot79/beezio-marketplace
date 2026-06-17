import type { Handler } from '@netlify/functions';
import { json } from './_lib/http';
import { getPayPalBaseUrl, getPayPalEnv, isPayPalEnabled } from './_lib/paypal';

export const handler: Handler = async () => {
  try {
    const env = await getPayPalEnv();
    const enabled = isPayPalEnabled();
    const clientId = env === 'live'
      ? String(process.env.PAYPAL_LIVE_CLIENT_ID || process.env.PAYPAL_CLIENT_ID || '').trim()
      : String(process.env.PAYPAL_SANDBOX_CLIENT_ID || process.env.PAYPAL_CLIENT_ID || '').trim();
    const clientSecretPresent = env === 'live'
      ? Boolean(String(process.env.PAYPAL_LIVE_CLIENT_SECRET || process.env.PAYPAL_CLIENT_SECRET || '').trim())
      : Boolean(String(process.env.PAYPAL_SANDBOX_CLIENT_SECRET || process.env.PAYPAL_CLIENT_SECRET || '').trim());
    const webhookIdPresent = Boolean(String(process.env.PAYPAL_WEBHOOK_ID || '').trim());

    const configured = Boolean(clientId && clientSecretPresent);

    return json(200, {
      ok: enabled && configured,
      enabled,
      env,
      baseUrl: await getPayPalBaseUrl(),
      configured: {
        clientId: Boolean(clientId),
        clientSecret: clientSecretPresent,
        webhookId: webhookIdPresent,
      },
      publicClientId: clientId || null,
    });
  } catch (e) {
    return json(500, {
      ok: false,
      error: e instanceof Error ? e.message : 'Unexpected error',
    });
  }
};

export default handler;
