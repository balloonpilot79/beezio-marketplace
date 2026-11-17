import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export function safePayPalReturnPath(value: unknown): string {
  const path = String(value || '');
  if (!path.startsWith('/') || path.startsWith('//') || /[\\\s\x00-\x1f]/.test(path)) return '/dashboard';
  return path;
}
export function paypalConnectCredentials() {
  const clientId = String(process.env.PAYPAL_CONNECT_CLIENT_ID || process.env.PAYPAL_CLIENT_ID || '').trim();
  const secret = String(process.env.PAYPAL_CONNECT_CLIENT_SECRET || process.env.PAYPAL_CLIENT_SECRET || '').trim();
  if (!clientId || !secret) throw new Error('PayPal connection is not configured. Please contact support.');
  return { clientId, secret };
}
export function paypalConnectRedirectUri() {
  return String(process.env.PAYPAL_CONNECT_REDIRECT_URI || 'https://beezio.co/paypal/connect/callback').trim();
}
export function createPayPalConnectState(uid: string, returnTo: string, secret: string, now = Date.now()) {
  const nonce = randomBytes(32).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ uid, nonce, returnTo: safePayPalReturnPath(returnTo), iat: now })).toString('base64url');
  const signature = createHmac('sha256', secret).update(payload).digest('base64url');
  return { state: `${payload}.${signature}`, nonce };
}
export function verifyPayPalConnectState(raw: string, nonce: string, uid: string, secret: string, now = Date.now()) {
  const parts = raw.split('.');
  if (parts.length !== 2) throw new Error('Invalid connection request. Please connect PayPal again.');
  const expected = createHmac('sha256', secret).update(parts[0]).digest();
  const supplied = Buffer.from(parts[1], 'base64url');
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) throw new Error('Invalid connection request. Please connect PayPal again.');
  const state = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
  if (!nonce || state.nonce !== nonce || state.uid !== uid) throw new Error('Connection request does not match your session. Please connect PayPal again.');
  if (!Number.isFinite(state.iat) || now < state.iat || now - state.iat > 15 * 60 * 1000) throw new Error('Connection request expired. Please connect PayPal again.');
  return { returnTo: safePayPalReturnPath(state.returnTo) };
}
// Read identity directly from PayPal. An unvalidated decoded id_token is not identity evidence.
export async function getVerifiedPayPalIdentity(baseUrl: string, accessToken: string) {
  if (!accessToken) throw new Error('PayPal did not return an access token. Please connect again.');
  const res = await fetch(`${baseUrl}/v1/identity/openidconnect/userinfo?schema=openid`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error('Unable to verify your PayPal identity. Please connect again and allow email access.');
  const identity = await res.json();
  const email = String(identity?.email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !String(identity?.sub || identity?.user_id || '').trim()) {
    throw new Error('PayPal did not return your identity and email. Please connect again and allow email access.');
  }
  if (identity.email_verified !== true) throw new Error('Confirm your email in PayPal, then connect again. Your Beezio payout settings have not been changed.');
  return { email, payerId: String(identity.payer_id || identity.sub || identity.user_id) };
}
