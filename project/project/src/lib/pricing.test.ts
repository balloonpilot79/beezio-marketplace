import { describe, expect, it } from 'vitest';
import { calculatePricing } from './pricing';

describe('seller-reviewed product pricing', () => {
  it('adds shipping to seller proceeds before calculating the final listing price', () => {
    const withoutShipping = calculatePricing({
      sellerDesiredAmount: 23.8,
      affiliateRate: 5,
      affiliateType: 'flat_rate',
      shippingIncludedAmount: 0,
    });
    const withShipping = calculatePricing({
      sellerDesiredAmount: 23.8,
      affiliateRate: 5,
      affiliateType: 'flat_rate',
      shippingIncludedAmount: 9.99,
    });

    expect(withShipping.sellerBaseAmount).toBe(23.8);
    expect(withShipping.shippingIncludedAmount).toBe(9.99);
    expect(withShipping.sellerAmount).toBe(33.79);
    expect(withShipping.affiliateAmount).toBe(5);
    expect(withShipping.listingPrice).toBeGreaterThan(withoutShipping.listingPrice);
  });
});
