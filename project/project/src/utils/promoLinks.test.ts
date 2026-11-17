import { describe, expect, it } from 'vitest';
import { getInfluencerPublicCode, getPromoDisplayPrice } from './promoLinks';

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
  it('uses the permanent referral code regardless of asynchronously loaded store identity', () => {
    expect(
      getInfluencerPublicCode({
        storeSlug: 'my-growth-link',
        username: 'someuser',
        referralCode: 'BZOABC123',
        profileId: '12345678-1234-1234-1234-1234567890ab',
      })
    ).toBe('BZOABC123');
  });

  it('keeps the permanent code when store data is missing', () => {
    expect(
      getInfluencerPublicCode({
        username: 'someuser',
        referralCode: 'BZOABC123',
      })
    ).toBe('BZOABC123');
  });

  it('does not derive referral identity from the store name', () => {
    expect(
      getInfluencerPublicCode({
        storeName: 'My Growth Store',
        referralCode: 'BZOABC123',
      })
    ).toBe('BZOABC123');
  });
});
it('uses the complete deterministic fallback accepted by the resolver', () => {
  expect(getInfluencerPublicCode({ profileId: '1deb1c67-4058-4f34-8c7c-1f0a9ecf47db' })).toBe('BZO1DEB1C6740584F348C7C1F0A9ECF47DB');
  expect(getInfluencerPublicCode({ storeName: 'MareBelle', username: 'someone' })).toBe('');
});
