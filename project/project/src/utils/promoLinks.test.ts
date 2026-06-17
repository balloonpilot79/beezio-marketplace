import { describe, expect, it } from 'vitest';
import { getInfluencerPublicCode, getPromoDisplayPrice, slugifyPromoValue } from './promoLinks';

describe('getPromoDisplayPrice', () => {
  it('prefers buyer-facing computed price over raw stored price', () => {
    expect(
      getPromoDisplayPrice({
        price: 25,
        seller_ask: 25,
        affiliate_commission_type: 'percent',
        affiliate_commission_value: 10,
      })
    ).toBeGreaterThan(25);
  });

  it('uses calculated customer price when present', () => {
    expect(
      getPromoDisplayPrice({
        price: 25,
        calculated_customer_price: 31.42,
      })
    ).toBe(31.42);
  });
});

describe('getInfluencerPublicCode', () => {
  it('prefers store slug over username and referral code', () => {
    expect(
      getInfluencerPublicCode({
        storeSlug: 'my-growth-link',
        username: 'someuser',
        referralCode: 'BZOABC123',
        profileId: '12345678-1234-1234-1234-1234567890ab',
      })
    ).toBe('my-growth-link');
  });

  it('falls back to username when slug is missing', () => {
    expect(
      getInfluencerPublicCode({
        username: 'someuser',
        referralCode: 'BZOABC123',
      })
    ).toBe('someuser');
  });

  it('slugifies store name before using referral code fallback', () => {
    expect(
      getInfluencerPublicCode({
        storeName: 'My Growth Store',
        referralCode: 'BZOABC123',
      })
    ).toBe(slugifyPromoValue('My Growth Store'));
  });
});