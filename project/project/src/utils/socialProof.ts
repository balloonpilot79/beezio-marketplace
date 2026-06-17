import { PRELAUNCH_ZERO_SOCIAL_PROOF } from '../config/beezioConfig';

export const normalizeReviewCount = (value: unknown): number => {
  if (PRELAUNCH_ZERO_SOCIAL_PROOF) return 0;
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.floor(n));
};

export const normalizeAverageRating = (value: unknown, reviewCount?: unknown): number => {
  if (PRELAUNCH_ZERO_SOCIAL_PROOF) return 0;
  const reviews = normalizeReviewCount(reviewCount);
  if (reviews <= 0) return 0;
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(5, Math.max(0, n));
};

