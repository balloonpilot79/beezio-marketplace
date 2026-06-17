export const REFERRER_BONUS_THRESHOLD = 20;
export const REFERRER_BONUS_UNDER_THRESHOLD = 0.5;
export const REFERRER_BONUS_AT_OR_ABOVE_THRESHOLD = 1;
export const INFLUENCER_BONUS_SLOT_COUNT = 2;

const roundToCurrency = (value: number): number =>
  Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

export function getReferrerBonusPerItem(amount: number): number {
  const normalizedAmount = Number.isFinite(amount) ? Math.max(0, amount) : 0;
  return normalizedAmount < REFERRER_BONUS_THRESHOLD
    ? REFERRER_BONUS_UNDER_THRESHOLD
    : REFERRER_BONUS_AT_OR_ABOVE_THRESHOLD;
}

export function getReferrerBonusTotal(amount: number, quantity: number): number {
  const normalizedQuantity = Number.isFinite(quantity) ? Math.max(0, Math.floor(quantity)) : 0;
  return roundToCurrency(getReferrerBonusPerItem(amount) * normalizedQuantity);
}

export function getInfluencerBonusPerSlot(amount: number): number {
  return getReferrerBonusPerItem(amount);
}

export function getInfluencerReserveTotal(amount: number, quantity = 1): number {
  const normalizedQuantity = Number.isFinite(quantity) ? Math.max(0, Math.floor(quantity)) : 0;
  return roundToCurrency(getInfluencerBonusPerSlot(amount) * INFLUENCER_BONUS_SLOT_COUNT * normalizedQuantity);
}

export function getAssignedInfluencerPayoutTotal(amount: number, assignedInfluencerCount: number, quantity = 1): number {
  const normalizedCount = Math.min(INFLUENCER_BONUS_SLOT_COUNT, Math.max(0, Math.floor(Number(assignedInfluencerCount || 0))));
  const normalizedQuantity = Number.isFinite(quantity) ? Math.max(0, Math.floor(quantity)) : 0;
  return roundToCurrency(getInfluencerBonusPerSlot(amount) * normalizedCount * normalizedQuantity);
}

export function getUnassignedInfluencerReserveTotal(amount: number, assignedInfluencerCount: number, quantity = 1): number {
  return roundToCurrency(
    getInfluencerReserveTotal(amount, quantity) -
      getAssignedInfluencerPayoutTotal(amount, assignedInfluencerCount, quantity)
  );
}
