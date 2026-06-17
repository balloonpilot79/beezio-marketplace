import { createSupabaseAdmin } from './supabase';
import { requireEnv, getEnvBool } from './env';

export type PayPalEnv = 'sandbox' | 'live';

let cachedEnv: { value: PayPalEnv; expiresAt: number } | null = null;

async function readPayPalEnvOverride(): Promise<PayPalEnv | null> {
  try {
    const supabaseAdmin = createSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from('admin_settings')
      .select('value')
      .eq('key', 'paypal_env')
      .maybeSingle();
    if (error) return null;
    const raw = String((data as any)?.value || '').trim().toLowerCase();
    if (raw === 'live' || raw === 'sandbox') return raw;
    return null;
  } catch {
    return null;
  }
}

export async function getPayPalEnv(): Promise<PayPalEnv> {
  const now = Date.now();
  if (cachedEnv && cachedEnv.expiresAt > now) return cachedEnv.value;

  const envFromDb = await readPayPalEnvOverride();
  const env =
    envFromDb ||
    (String(process.env.PAYPAL_ENV || 'sandbox').trim().toLowerCase() === 'live' ? 'live' : 'sandbox');
  cachedEnv = { value: env, expiresAt: now + 60_000 };
  return env;
}

export async function getPayPalBaseUrl(): Promise<string> {
  const base = String(process.env.PAYPAL_API_BASE || '').trim();
  if (base) return base;
  const env = await getPayPalEnv();
  return env === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
}

function getPayPalCredentialsForEnv(env: PayPalEnv): { clientId: string; secret: string } {
  if (env === 'live') {
    const clientId = String(process.env.PAYPAL_LIVE_CLIENT_ID || process.env.PAYPAL_CLIENT_ID || '').trim();
    const secret = String(process.env.PAYPAL_LIVE_CLIENT_SECRET || process.env.PAYPAL_CLIENT_SECRET || '').trim();
    return { clientId, secret };
  }
  const clientId = String(process.env.PAYPAL_SANDBOX_CLIENT_ID || process.env.PAYPAL_CLIENT_ID || '').trim();
  const secret = String(process.env.PAYPAL_SANDBOX_CLIENT_SECRET || process.env.PAYPAL_CLIENT_SECRET || '').trim();
  return { clientId, secret };
}

export async function getPayPalAccessToken(): Promise<string> {
  const env = await getPayPalEnv();
  const baseUrl = await getPayPalBaseUrl();
  const creds = getPayPalCredentialsForEnv(env);
  const clientId = creds.clientId || requireEnv('PAYPAL_CLIENT_ID');
  const secret = creds.secret || requireEnv('PAYPAL_CLIENT_SECRET');
  const auth = Buffer.from(`${clientId}:${secret}`).toString('base64');

  const res = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`PayPal auth failed (${res.status}): ${String((data as any)?.error_description || (data as any)?.message || 'unknown')}`);
  }

  const token = String((data as any)?.access_token || '').trim();
  if (!token) throw new Error('PayPal auth failed: missing access_token');
  return token;
}

export function paypalRequestId(prefix = 'bzo'): string {
  const cryptoAny: any = globalThis.crypto as any;
  if (cryptoAny?.randomUUID) return `${prefix}_${cryptoAny.randomUUID()}`;
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export async function verifyPayPalWebhookSignature(args: {
  headers: Record<string, string | undefined>;
  rawBody: string;
}): Promise<boolean> {
  const webhookId = String(process.env.PAYPAL_WEBHOOK_ID || '').trim();
  if (!webhookId) return false;

  const baseUrl = await getPayPalBaseUrl();
  const token = await getPayPalAccessToken();

  const h = args.headers;
  const transmissionId = String(h['paypal-transmission-id'] || h['PayPal-Transmission-Id'] || '').trim();
  const transmissionTime = String(h['paypal-transmission-time'] || h['PayPal-Transmission-Time'] || '').trim();
  const certUrl = String(h['paypal-cert-url'] || h['PayPal-Cert-Url'] || '').trim();
  const authAlgo = String(h['paypal-auth-algo'] || h['PayPal-Auth-Algo'] || '').trim();
  const transmissionSig = String(h['paypal-transmission-sig'] || h['PayPal-Transmission-Sig'] || '').trim();

  if (!transmissionId || !transmissionTime || !certUrl || !authAlgo || !transmissionSig) {
    return false;
  }

  const event = JSON.parse(args.rawBody);

  const res = await fetch(`${baseUrl}/v1/notifications/verify-webhook-signature`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      auth_algo: authAlgo,
      cert_url: certUrl,
      transmission_id: transmissionId,
      transmission_sig: transmissionSig,
      transmission_time: transmissionTime,
      webhook_id: webhookId,
      webhook_event: event,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) return false;

  const status = String((data as any)?.verification_status || '').toUpperCase();
  return status === 'SUCCESS';
}

export function isPayPalEnabled(): boolean {
  return !getEnvBool('PAYPAL_DISABLED', false);
}
