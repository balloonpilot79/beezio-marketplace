import { describe, expect, it } from 'vitest';
import { calculatePricing } from '../lib/pricing';
import { getPriceFit, pricingReviewIssue, pricingReviewKey } from './priceFit';

describe('buyer price budget', () => {
  it.each([19.99, 39.99, 49.99, 79.99, 105])('finds the greatest seller payout that fits $%s', target => {
    const fit = getPriceFit({ targetDeliveredPrice: target, sellerPayout: 35, affiliatePayout: 8, shipping: 5 })!;
    expect(fit.maxSellerPayout).not.toBeNull();
    expect(fit.fittedDeliveredPrice).toBeLessThanOrEqual(target);
    const next = calculatePricing({ sellerDesiredAmount: fit.maxSellerPayout! + .01, affiliateRate: 8, shippingIncludedAmount: 5 });
    expect(next.listingPrice).toBeGreaterThan(target);
  });
  it('includes shipping and preserves the chosen affiliate amount in the fit', () => {
    const fit = getPriceFit({ targetDeliveredPrice: 49.99, sellerPayout: 40, affiliatePayout: 10, shipping: 6.5 })!;
    const priced = calculatePricing({ sellerDesiredAmount: fit.maxSellerPayout!, affiliateRate: 10, shippingIncludedAmount: 6.5 });
    expect(priced.affiliateAmount).toBe(10);
    expect(priced.shippingIncludedAmount).toBe(6.5);
    expect(priced.listingPrice).toBe(fit.fittedDeliveredPrice);
    expect(fit.overTarget).toBe(true);
  });
  it('reports infeasible budgets without inventing a zero seller payout', () => {
    const fit = getPriceFit({ targetDeliveredPrice: 9.99, sellerPayout: 10, affiliatePayout: 8, shipping: 5 })!;
    expect(fit.maxSellerPayout).toBeNull();
    expect(fit.fittedDeliveredPrice).toBeNull();
  });
  it('flags a target below the known product cost and leaves unknown margins unspecified', () => {
    const input = { targetDeliveredPrice: 29.99, sellerPayout: 20, affiliatePayout: 8, shipping: 5 };
    expect(getPriceFit({ ...input, productCost: 20 })!.belowKnownCost).toBe(true);
    expect(getPriceFit({ ...input, productCost: 20 })!.marginAtTarget).toBeLessThan(0);
    expect(getPriceFit(input)!.marginAtTarget).toBeNull();
  });
  it.each([0, -1, NaN, Infinity])('ignores an invalid or empty budget: %s', target => {
    expect(getPriceFit({ targetDeliveredPrice: target, sellerPayout: 20, affiliatePayout: 8, shipping: 5 })).toBeNull();
  });
  it('retains support for small seller-chosen commissions and affiliate opt-out', () => {
    for (const affiliate of [0, .01, .5]) expect(getPriceFit({ targetDeliveredPrice: 5, sellerPayout: 1, affiliatePayout: affiliate, shipping: 0 })!.maxSellerPayout).toBeGreaterThan(0);
  });
});

describe('publishing price review', () => {
  const key = pricingReviewKey(20, 8, 5, 36.99, 10);
  it('requires a review and rejects a stale review after each pricing input changes', () => {
    expect(pricingReviewIssue(20, 10, key, '')).toMatch(/Confirm/);
    expect(pricingReviewIssue(20, 10, key, key)).toBeNull();
    for (const args of [[21,8,5,36.99,10],[20,9,5,36.99,10],[20,8,6,36.99,10],[20,8,5,37.99,10],[20,8,5,36.99,11]]) {
      const changed = pricingReviewKey(...args as [number,number,number,number,number]);
      expect(pricingReviewIssue(args[0],args[4],changed,key)).toMatch(/Confirm/);
    }
  });
  it('blocks payouts below known cost even after a review', () => {
    expect(pricingReviewIssue(9.99,10,key,key)).toMatch(/below/);
    expect(pricingReviewIssue(10,10,key,key)).toBeNull();
  });
});
