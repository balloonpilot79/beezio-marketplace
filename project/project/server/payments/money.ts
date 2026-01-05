export function toCents(amount: number): number {
  if (!Number.isFinite(amount)) return 0;
  return Math.round((amount + Number.EPSILON) * 100);
}

export function centsToStripeAmount(cents: number): number {
  if (!Number.isFinite(cents)) return 0;
  return Math.max(0, Math.round(cents));
}

