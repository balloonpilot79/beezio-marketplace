import { describe, expect, it } from 'vitest';
import { computeFixedBeezioPlatformFee } from './beezioFee';
import { computeFixedTierPricing } from './customerPrice';

describe('fixed-tier Beezio pricing contract', () => {
  it.each([
    [24.99, 1],
    [25, 2],
    [99.99, 2],
    [100, 4],
    [199.99, 4],
    [200, 6],
    [299.99, 6],
    [300, 8],
    [500, 12],
  ])('charges the correct platform fee at $%s', (price, expected) => {
    expect(computeFixedBeezioPlatformFee(price)).toBe(expected);
  });

  it('recalculates when PayPal pushes the final price into the next tier', () => {
    const result = computeFixedTierPricing({
      sellerPayout: 93,
      affiliatePayout: 0,
      shippingIncluded: 0,
    });

    expect(result.finalAdvertisedPrice).toBe(103.74);
    expect(result.platformFee).toBe(4);
    expect(result.influencerAllocation).toBe(2);
    expect(result.paypalProcessingAllowance).toBe(4.74);
    expect(result.iterations).toBeGreaterThan(1);
  });

  it('keeps seller, affiliate, and shipping buckets whole', () => {
    const result = computeFixedTierPricing({
      supplierCost: 23.8,
      sellerMarkup: 10,
      affiliatePayout: 5,
      shippingIncluded: 6.2,
      estimatedTaxRate: 0.07,
    });

    expect(result.sellerPayout).toBe(33.8);
    expect(result.affiliatePayout).toBe(5);
    expect(result.shippingIncluded).toBe(6.2);
    expect(result.finalAdvertisedPrice).toBe(51.67);
    expect(result.platformFee).toBe(2);
    expect(result.influencerAllocation).toBe(2);
    expect(result.paypalProcessingAllowance).toBe(2.67);
    expect(result.estimatedSalesTax).toBe(3.62);
    expect(result.estimatedCheckoutTotal).toBe(55.29);
  });

  it('allows the seller to offer an affiliate payout larger than the seller payout', () => {
    const result = computeFixedTierPricing({
      supplierCost: 4,
      sellerMarkup: 1,
      affiliatePayout: 8,
    });

    expect(result.sellerPayout).toBe(5);
    expect(result.affiliatePayout).toBe(8);
    expect(result.finalAdvertisedPrice).toBeGreaterThanOrEqual(13);
  });

  it('does not enforce markup or affiliate minimums', () => {
    const result = computeFixedTierPricing({
      supplierCost: 4,
      sellerMarkup: 0,
      affiliatePayout: 0,
    });

    expect(result.sellerMarkup).toBe(0);
    expect(result.affiliatePayout).toBe(0);
  });

  it('uses $1 total influencer allocation only when the settled price is under $20', () => {
    const under = computeFixedTierPricing({ sellerPayout: 15 });
    const crossed = computeFixedTierPricing({ sellerPayout: 17 });

    expect(under.finalAdvertisedPrice).toBe(18.34);
    expect(under.influencerAllocation).toBe(1);
    expect(under.influencerPerSlot).toBe(0.5);
    expect(crossed.finalAdvertisedPrice).toBeGreaterThanOrEqual(20);
    expect(crossed.influencerAllocation).toBe(2);
    expect(crossed.influencerPerSlot).toBe(1);
  });
});
