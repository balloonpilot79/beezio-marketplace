import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const VERSION_PREFIX = 'v1:';

function getKey(): Buffer {
  const raw = String(process.env.INTEGRATIONS_ENCRYPTION_KEY || '').trim();
  if (!raw) {
    throw new Error('Missing INTEGRATIONS_ENCRYPTION_KEY');
  }
  const buf = Buffer.from(raw, 'utf8');
  if (buf.length === 32) return buf;
  return crypto.createHash('sha256').update(buf).digest();
}

export function encryptSecret(value: string): string {
  if (!value) return '';
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  const payload = Buffer.concat([iv, tag, ciphertext]).toString('base64');
  return `${VERSION_PREFIX}${payload}`;
}

export function decryptSecret(value: string | null | undefined): string {
  if (!value) return '';
  if (!value.startsWith(VERSION_PREFIX)) {
    // Assume plaintext (legacy)
    return value;
  }
  const payload = value.slice(VERSION_PREFIX.length);
  const buf = Buffer.from(payload, 'base64');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ciphertext = buf.subarray(28);
  const key = getKey();
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString('utf8');
}

export function maskSecret(value: string | null | undefined): string | null {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const tail = raw.slice(-4);
  return `••••${tail}`;
}
