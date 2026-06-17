import crypto from 'crypto';

const base64UrlEncode = (value: string) =>
  Buffer.from(value, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');

const base64UrlDecode = (value: string) => {
  const normalized = String(value || '')
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  return Buffer.from(`${normalized}${padding}`, 'base64').toString('utf8');
};

const getSecret = () => {
  const secret = String(process.env.SIGNUP_VERIFY_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!secret) throw new Error('Missing SIGNUP_VERIFY_SECRET');
  return secret;
};

export function issueSignupVerifyToken(payload: { userId: string; email: string; exp: number }) {
  const body = base64UrlEncode(JSON.stringify(payload));
  const signature = crypto.createHmac('sha256', getSecret()).update(body).digest('base64url');
  return `${body}.${signature}`;
}

export function verifySignupVerifyToken(token: string): { userId: string; email: string; exp: number } {
  const [body, signature] = String(token || '').trim().split('.');
  if (!body || !signature) throw new Error('Invalid verification token');

  const expected = crypto.createHmac('sha256', getSecret()).update(body).digest('base64url');
  const providedBuffer = Buffer.from(signature, 'utf8');
  const expectedBuffer = Buffer.from(expected, 'utf8');
  if (providedBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(providedBuffer, expectedBuffer)) {
    throw new Error('Invalid verification token');
  }

  const parsed = JSON.parse(base64UrlDecode(body));
  const userId = String(parsed?.userId || '').trim();
  const email = String(parsed?.email || '').trim().toLowerCase();
  const exp = Number(parsed?.exp || 0);
  if (!userId || !email || !Number.isFinite(exp) || exp <= 0) {
    throw new Error('Invalid verification token');
  }
  if (Date.now() > exp) {
    throw new Error('Verification token expired');
  }

  return { userId, email, exp };
}
