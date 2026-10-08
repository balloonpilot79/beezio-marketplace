// Each sale reserves two lifetime influencer slots: one for the seller's
// recruiter and one for the affiliate's recruiter. Slot values are based only
// on the seller ask, never on affiliate, shipping, Beezio, processing, or tax.
export const REFERRER_BONUS_THRESHOLD = 30;
export const REFERRER_BONUS_UNDER_THRESHOLD = 0.5;
export const REFERRER_BONUS_AT_OR_ABOVE_THRESHOLD = 1;
export const REFERRER_BONUS_REALLOCATION_MIN = Number.MAX_SAFE_INTEGER;
export const REFERRER_BONUS_REALLOCATION_TO_PLATFORM = 0;
export const INFLUENCER_BONUS_SLOT_COUNT = 2;

const roundToCurrency = (value: number): number =>
  Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

export function getReferrerBonusPerItem(sellerAsk: number): number {
  const price = Number.isFinite(sellerAsk)
    ? Math.max(0, sellerAsk)
    : 0;
  return price <= REFERRER_BONUS_THRESHOLD
    ? REFERRER_BONUS_UNDER_THRESHOLD
    : REFERRER_BONUS_AT_OR_ABOVE_THRESHOLD;
}

export function getSmallOrderPlatformReallocation(sellerAsk: number): number {
  const price = Number.isFinite(sellerAsk)
    ? Math.max(0, sellerAsk)
    : 0;
  return price >= REFERRER_BONUS_REALLOCATION_MIN && price <= REFERRER_BONUS_THRESHOLD
    ? REFERRER_BONUS_REALLOCATION_TO_PLATFORM
    : 0;
}

export function getReferrerBonusTotal(finalAdvertisedPrice: number, quantity: number): number {
  const normalizedQuantity = Number.isFinite(quantity) ? Math.max(0, Math.floor(quantity)) : 0;
  return roundToCurrency(getReferrerBonusPerItem(finalAdvertisedPrice) * normalizedQuantity);
}

export function getInfluencerBonusPerSlot(sellerAsk: number): number {
  return getReferrerBonusPerItem(sellerAsk);
}

export function getInfluencerReserveTotal(sellerAsk: number, quantity = 1): number {
  const normalizedQuantity = Number.isFinite(quantity) ? Math.max(0, Math.floor(quantity)) : 0;
  return roundToCurrency(
    getInfluencerBonusPerSlot(sellerAsk) *
      INFLUENCER_BONUS_SLOT_COUNT *
      normalizedQuantity
  );
}

export function getAssignedInfluencerPayoutTotal(
  sellerAsk: number,
  assignedInfluencerCount: number,
  quantity = 1
): number {
  const normalizedCount = Math.min(
    INFLUENCER_BONUS_SLOT_COUNT,
    Math.max(0, Math.floor(Number(assignedInfluencerCount || 0)))
  );
  const normalizedQuantity = Number.isFinite(quantity) ? Math.max(0, Math.floor(quantity)) : 0;
  return roundToCurrency(
    getInfluencerBonusPerSlot(sellerAsk) *
      normalizedCount *
      normalizedQuantity
  );
}

export function getUnassignedInfluencerReserveTotal(
  sellerAsk: number,
  assignedInfluencerCount: number,
  quantity = 1
): number {
  return roundToCurrency(
    getInfluencerReserveTotal(sellerAsk, quantity) -
      getAssignedInfluencerPayoutTotal(sellerAsk, assignedInfluencerCount, quantity)
  );
}
