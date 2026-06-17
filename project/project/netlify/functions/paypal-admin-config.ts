import type { Handler } from '@netlify/functions';
import { requireAdmin } from './_lib/auth';
import { json, parseJson } from './_lib/http';
import { createSupabaseAdmin } from './_lib/supabase';
import { getPayPalAccessToken, getPayPalBaseUrl, getPayPalEnv, isPayPalEnabled } from './_lib/paypal';

type Body = {
  paypal_env?: 'sandbox' | 'live';
};

const stringifyPayPalError = (payload: any) => {
  const parts = [
    String(payload?.message || '').trim(),
    String(payload?.error_description || '').trim(),
    String(payload?.details?.[0]?.issue || '').trim(),
    String(payload?.details?.[0]?.description || '').trim(),
    String(payload?.name || '').trim(),
  ].filter(Boolean);
  return Array.from(new Set(parts)).join(' | ') || 'Unknown PayPal error';
};

const extractMissingColumnName = (message: string): string | null => {
  const msg = String(message || '');
  const pg = msg.match(/column\s+"([^"]+)"\s+of\s+relation\s+"[^"]+"\s+does\s+not\s+exist/i);
  if (pg?.[1]) return pg[1];
  const pgrst = msg.match(/Could not find the '([^']+)' column of '[^']+' in the schema cache/i);
  if (pgrst?.[1]) return pgrst[1];
  return null;
};

const upsertAdminSetting = async (key: string, value: string) => {
  const supabaseAdmin = createSupabaseAdmin();
  let payload: any = { key, value };
  let lastError: any = null;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { error } = await supabaseAdmin.from('admin_settings').upsert(payload);
    if (!error) return null;
    lastError = error;
    const missing = extractMissingColumnName(String((error as any)?.message || ''));
    if (missing && Object.prototype.hasOwnProperty.call(payload, missing)) {
      const clone = { ...payload };
      delete clone[missing];
      payload = clone;
      continue;
    }
    break;
  }

  return lastError;
};

export const handler: Handler = async (event) => {
  try {
    if (event.httpMethod === 'OPTIONS') return json(200, {});
    if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

    await requireAdmin(event as any);
    const body = parseJson<Body>(event.body);

    const requestedEnv = String(body?.paypal_env || '').trim().toLowerCase();
    if (requestedEnv) {
      if (requestedEnv !== 'sandbox' && requestedEnv !== 'live') {
        return json(400, { error: 'Invalid paypal_env. Use sandbox or live.' });
      }
      const settingError = await upsertAdminSetting('paypal_env', requestedEnv);
      if (settingError) {
        return json(500, { error: 'Failed to save PayPal environment', details: String((settingError as any)?.message || '') });
      }
    }

    const env = await getPayPalEnv();
    const clientId = env === 'live'
      ? String(process.env.PAYPAL_LIVE_CLIENT_ID || process.env.PAYPAL_CLIENT_ID || '').trim()
      : String(process.env.PAYPAL_SANDBOX_CLIENT_ID || process.env.PAYPAL_CLIENT_ID || '').trim();
    const secret = env === 'live'
      ? String(process.env.PAYPAL_LIVE_CLIENT_SECRET || process.env.PAYPAL_CLIENT_SECRET || '').trim()
      : String(process.env.PAYPAL_SANDBOX_CLIENT_SECRET || process.env.PAYPAL_CLIENT_SECRET || '').trim();

    let payoutsApi: {
      auth_ok: boolean;
      access_ok: boolean;
      checked_at: string;
      message: string;
      status?: number;
    } | null = null;

    if (clientId && secret) {
      try {
        const token = await getPayPalAccessToken();
        const baseUrl = await getPayPalBaseUrl();
        const payoutsRes = await fetch(`${baseUrl}/v1/payments/payouts?page=1&page_size=1`, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
        const payoutsPayload = await payoutsRes.json().catch(() => ({}));

        payoutsApi = payoutsRes.ok
          ? {
              auth_ok: true,
              access_ok: true,
              checked_at: new Date().toISOString(),
              status: payoutsRes.status,
              message: 'PayPal Standard Payouts API responded successfully for this account.',
            }
          : {
              auth_ok: true,
              access_ok: false,
              checked_at: new Date().toISOString(),
              status: payoutsRes.status,
              message: stringifyPayPalError(payoutsPayload),
            };
      } catch (probeError: any) {
        payoutsApi = {
          auth_ok: false,
          access_ok: false,
          checked_at: new Date().toISOString(),
          message: String(probeError?.message || 'Failed to authenticate to PayPal.'),
        };
      }
    }

    return json(200, {
      ok: true,
      enabled: isPayPalEnabled(),
      env,
      baseUrl: await getPayPalBaseUrl(),
      configured: {
        clientId: Boolean(clientId),
        clientSecret: Boolean(secret),
      },
      payoutsApi,
      payoutsPrerequisites: [
        'Use a PayPal business account.',
        'Request PayPal Standard Payouts access for the live account.',
        'Confirm identity, confirm email, and link a bank account in PayPal.',
        'Keep enough PayPal balance to cover payouts and fees.',
      ],
      links: {
        requestAccess: 'https://www.paypal.com/payoutsweb/landing',
        standardDocs: 'https://developer.paypal.com/docs/payouts/standard/',
      },
      publicClientId: clientId || null,
    });
  } catch (e: any) {
    const statusCode = Number(e?.statusCode) || 500;
    return json(statusCode, { error: e instanceof Error ? e.message : 'Unexpected error' });
  }
};

export default handler;

