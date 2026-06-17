type PromoAttributionInput = {
  promoterRole: 'affiliate' | 'seller';
  ownerId?: string | null;
  productSellerId?: string | null;
};

const normalize = (value: string | null | undefined): string => String(value || '').trim();

export function shouldAttachPromoterAffiliateRef(input: PromoAttributionInput): boolean {
  const ownerId = normalize(input.ownerId);
  const productSellerId = normalize(input.productSellerId);

  if (!ownerId) return false;
  if (input.promoterRole === 'affiliate') return true;
  if (input.promoterRole !== 'seller') return false;
  if (!productSellerId) return false;

  return ownerId !== productSellerId;
}

export function buildPromoterReferralParams(input: PromoAttributionInput): URLSearchParams {
  const ownerId = normalize(input.ownerId);
  const params = new URLSearchParams();

  if (!shouldAttachPromoterAffiliateRef(input) || !ownerId) return params;

  params.set('ref', ownerId);
  params.set('uid', ownerId);
  return params;
}
