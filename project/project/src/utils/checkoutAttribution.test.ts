import { describe, expect, it } from 'vitest';
import { resolveCheckoutAttribution } from './checkoutAttribution';

describe('resolveCheckoutAttribution', () => {
  it('retains the cart origin after refresh, sign-in, or browser scope changes', () => {
    for (const storeScope of [null, 'global', 'store:affiliate:unrelated']) {
      const saved = JSON.parse(JSON.stringify({ storefrontScope: 'store:seller:marebelle', affiliateId: 'marebelle-owner' }));
      expect(resolveCheckoutAttribution({ storeScope, referralAffiliateId: 'stale-referral',
        cartStoreScopes: [saved.storefrontScope], cartAffiliateIds: [saved.affiliateId] })).toEqual({
        affiliate_id: 'marebelle-owner', storefront_id: 'marebelle', orderSource: 'seller_storefront',
      });
    }
  });
  it('stops a checkout containing multiple store origins rather than miscrediting it', () => {
    expect(() => resolveCheckoutAttribution({ cartStoreScopes: ['store:seller:a', 'store:seller:b'] })).toThrow('one store at a time');
  });
  it('keeps single-product direct sales seller-only when there is no referral or storefront scope', () => {
    expect(resolveCheckoutAttribution({ referralAffiliateId: null, storeScope: null })).toEqual({
      affiliate_id: null,
      storefront_id: null,
      orderSource: 'marketplace_direct',
    });
  });

  it('keeps single-product affiliate referrals without pretending they came from a storefront', () => {
    expect(resolveCheckoutAttribution({ referralAffiliateId: 'affiliate-1', storeScope: null })).toEqual({
      affiliate_id: 'affiliate-1',
      storefront_id: null,
      orderSource: 'affiliate_link',
    });
  });

  it('marks seller custom-store sales without assigning an affiliate', () => {
    expect(resolveCheckoutAttribution({ referralAffiliateId: null, storeScope: 'store:seller:seller-1' })).toEqual({
      affiliate_id: null,
      storefront_id: 'seller-1',
      orderSource: 'seller_storefront',
    });
  });

  it('marks affiliate custom-store sales and defaults affiliate credit to the store owner', () => {
    expect(resolveCheckoutAttribution({ referralAffiliateId: null, storeScope: 'store:affiliate:affiliate-1' })).toEqual({
      affiliate_id: 'affiliate-1',
      storefront_id: 'affiliate-1',
      orderSource: 'affiliate_storefront',
    });
  });

  it('preserves an explicit affiliate referral on affiliate storefront sales', () => {
    expect(resolveCheckoutAttribution({ referralAffiliateId: 'affiliate-2', storeScope: 'store:affiliate:affiliate-1' })).toEqual({
      affiliate_id: 'affiliate-2',
      storefront_id: 'affiliate-1',
      orderSource: 'affiliate_storefront',
    });
  });

  it('falls back to a single cart-level affiliate when browser referral state is missing', () => {
    expect(
      resolveCheckoutAttribution({
        referralAffiliateId: null,
        storeScope: null,
        cartAffiliateIds: ['affiliate-3'],
      })
    ).toEqual({
      affiliate_id: 'affiliate-3',
      storefront_id: null,
      orderSource: 'affiliate_link',
    });
  });

  it('refuses to guess when the cart contains mixed affiliate ownership', () => {
    expect(
      resolveCheckoutAttribution({
        referralAffiliateId: null,
        storeScope: null,
        cartAffiliateIds: ['affiliate-3', 'affiliate-4'],
      })
    ).toEqual({
      affiliate_id: null,
      storefront_id: null,
      orderSource: 'marketplace_direct',
    });
  });
});
