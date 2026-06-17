export type CheckoutAttribution = {
  affiliate_id: string | null;
  storefront_id: string | null;
  orderSource: string | null;
};

type CheckoutAttributionInput = {
  referralAffiliateId?: string | null;
  storeScope?: string | null;
  cartAffiliateIds?: Array<string | null | undefined>;
};

const resolveSingleCartAffiliateId = (cartAffiliateIds: Array<string | null | undefined> | undefined): string | null => {
  const uniqueIds = Array.from(
    new Set(
      (Array.isArray(cartAffiliateIds) ? cartAffiliateIds : [])
        .map((value) => String(value || '').trim())
        .filter(Boolean)
    )
  );

  return uniqueIds.length === 1 ? uniqueIds[0] : null;
};

export function resolveCheckoutAttribution(input: CheckoutAttributionInput): CheckoutAttribution {
  const storeScope = String(input.storeScope || '').trim();
  const referralAffiliateId = String(input.referralAffiliateId || '').trim() || null;
  const cartAffiliateId = resolveSingleCartAffiliateId(input.cartAffiliateIds);
  let affiliate_id = referralAffiliateId || cartAffiliateId || null;
  let storefront_id: string | null = null;
  let orderSource: string | null = null;

  if (storeScope.startsWith('store:seller:')) {
    storefront_id = storeScope.slice('store:seller:'.length).trim() || null;
    orderSource = 'seller_storefront';
  } else if (storeScope.startsWith('store:affiliate:')) {
    storefront_id = storeScope.slice('store:affiliate:'.length).trim() || null;
    orderSource = 'affiliate_storefront';
    if (!affiliate_id && storefront_id) {
      affiliate_id = storefront_id;
    }
  }

  return {
    affiliate_id,
    storefront_id,
    orderSource,
  };
}
