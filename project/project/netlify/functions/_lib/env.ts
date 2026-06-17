export function requireEnv(name: string, fallbacks: string[] = []): string {
  const keys = [name, ...fallbacks];
  for (const key of keys) {
    const value = String(process.env[key] || '').trim();
    if (value) return value;
  }
  throw new Error(`Missing ${name}${fallbacks.length ? ` (or ${fallbacks.join(', ')})` : ''}`);
}

export function getEnvNumber(name: string, fallback: number): number {
  const raw = String(process.env[name] || '').trim();
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function getEnvBool(name: string, fallback = false): boolean {
  const raw = String(process.env[name] || '').trim().toLowerCase();
  if (!raw) return fallback;
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
}

export function getPayoutHoldDays(minimumDays = 14): number {
  const configured = getEnvNumber('PAYOUT_HOLD_DAYS', getEnvNumber('BEEZIO_PAYOUT_HOLD_DAYS', minimumDays));
  return Math.max(minimumDays, configured);
}
