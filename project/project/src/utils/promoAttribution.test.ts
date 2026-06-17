import { describe, expect, it } from 'vitest';
import { buildPromoterReferralParams, shouldAttachPromoterAffiliateRef } from './promoAttribution';

describe('promoAttribution', () => {
  it('attaches affiliate refs for affiliate promoters', () => {
    expect(
      shouldAttachPromoterAffiliateRef({
        promoterRole: 'affiliate',
        ownerId: 'affiliate-1',
        productSellerId: 'seller-1',
      })
    ).toBe(true);
  });

  it('attaches affiliate refs when a seller promotes another sellers product', () => {
    expect(
      shouldAttachPromoterAffiliateRef({
        promoterRole: 'seller',
        ownerId: 'seller-promoter',
        productSellerId: 'seller-owner',
      })
    ).toBe(true);
  });

  it('does not attach affiliate refs when a seller promotes their own product', () => {
    expect(
      shouldAttachPromoterAffiliateRef({
        promoterRole: 'seller',
        ownerId: 'seller-owner',
        productSellerId: 'seller-owner',
      })
    ).toBe(false);
  });

  it('builds ref and uid params when attribution should be attached', () => {
    const params = buildPromoterReferralParams({
      promoterRole: 'seller',
      ownerId: 'seller-promoter',
      productSellerId: 'seller-owner',
    });

    expect(params.get('ref')).toBe('seller-promoter');
    expect(params.get('uid')).toBe('seller-promoter');
  });
});
