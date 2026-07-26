// Each sale reserves two lifetime influencer slots: one for the seller's
// recruiter and one for the affiliate's recruiter. Slot values are based on
// the final advertised product price before sales tax.
export const REFERRER_BONUS_THRESHOLD = 20;
export const REFERRER_BONUS_UNDER_THRESHOLD = 0.5;
export const REFERRER_BONUS_AT_OR_ABOVE_THRESHOLD = 1;
export const INFLUENCER_BONUS_SLOT_COUNT = 2;

const roundToCurrency = (value: number): number =>
  Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

export function getReferrerBonusPerItem(finalAdvertisedPrice: number): number {
  const price = Number.isFinite(finalAdvertisedPrice)
    ? Math.max(0, finalAdvertisedPrice)
    : 0;
  return price < REFERRER_BONUS_THRESHOLD
    ? REFERRER_BONUS_UNDER_THRESHOLD
    : REFERRER_BONUS_AT_OR_ABOVE_THRESHOLD;
}

export function getReferrerBonusTotal(finalAdvertisedPrice: number, quantity: number): number {
  const normalizedQuantity = Number.isFinite(quantity) ? Math.max(0, Math.floor(quantity)) : 0;
  return roundToCurrency(getReferrerBonusPerItem(finalAdvertisedPrice) * normalizedQuantity);
}

export function getInfluencerBonusPerSlot(finalAdvertisedPrice: number): number {
  return getReferrerBonusPerItem(finalAdvertisedPrice);
}

export function getInfluencerReserveTotal(finalAdvertisedPrice: number, quantity = 1): number {
  const normalizedQuantity = Number.isFinite(quantity) ? Math.max(0, Math.floor(quantity)) : 0;
  return roundToCurrency(
    getInfluencerBonusPerSlot(finalAdvertisedPrice) *
      INFLUENCER_BONUS_SLOT_COUNT *
      normalizedQuantity
  );
}

export function getAssignedInfluencerPayoutTotal(
  finalAdvertisedPrice: number,
  assignedInfluencerCount: number,
  quantity = 1
): number {
  const normalizedCount = Math.min(
    INFLUENCER_BONUS_SLOT_COUNT,
    Math.max(0, Math.floor(Number(assignedInfluencerCount || 0)))
  );
  const normalizedQuantity = Number.isFinite(quantity) ? Math.max(0, Math.floor(quantity)) : 0;
  return roundToCurrency(
    getInfluencerBonusPerSlot(finalAdvertisedPrice) *
      normalizedCount *
      normalizedQuantity
  );
}

export function getUnassignedInfluencerReserveTotal(
  finalAdvertisedPrice: number,
  assignedInfluencerCount: number,
  quantity = 1
): number {
  return roundToCurrency(
    getInfluencerReserveTotal(finalAdvertisedPrice, quantity) -
      getAssignedInfluencerPayoutTotal(finalAdvertisedPrice, assignedInfluencerCount, quantity)
  );
}
