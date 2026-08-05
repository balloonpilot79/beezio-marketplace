import { describe, expect, it } from 'vitest';
import { calculatePricing, validatePricingInput } from './pricing';

describe('seller-reviewed product pricing', () => {
  it('keeps seller payout whole and adds shipping as a separate reserve', () => {
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
    expect(withShipping.sellerAmount).toBe(23.8);
    expect(withShipping.sellerPayableAmount).toBe(33.79);
    expect(withShipping.affiliateAmount).toBe(5);
    expect(withShipping.listingPrice).toBeGreaterThan(withoutShipping.listingPrice);
  });

  it('rejects affiliate payouts below the launch minimum', () => {
    expect(validatePricingInput({ sellerDesiredAmount: 20, affiliateRate: 4.99 }))
      .toContain('Affiliate payout must be at least $5.00 when affiliates are enabled');
    expect(validatePricingInput({ sellerDesiredAmount: 20, affiliateRate: 5 })).toEqual([]);
    expect(validatePricingInput({ sellerDesiredAmount: 20, affiliateRate: 0 })).toEqual([]);
  });
});
