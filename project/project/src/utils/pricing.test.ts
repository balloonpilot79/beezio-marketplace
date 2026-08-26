import { describe, expect, it } from 'vitest';
import { calculatePayouts, calculateSalePriceFromSellerAsk, roundUpToTwoDecimals } from './pricing';

describe('pricing utilities', () => {
  it('rounds processing allowances up to the next cent', () => {
    expect(roundUpToTwoDecimals(10.231)).toBe(10.24);
    expect(roundUpToTwoDecimals(10.2)).toBe(10.2);
  });
  it('adds a fixed affiliate payout and shipping above the seller payout', () => {
    const withoutShipping = calculateSalePriceFromSellerAsk(23.8, 5, 'flat', 0);
    const withShipping = calculateSalePriceFromSellerAsk(23.8, 5, 'flat', 9.99);
    expect(withoutShipping).toBe(34.79);
    expect(withShipping).toBe(45.2);
  });
  it('keeps the seller and affiliate payouts whole', () => {
    const salePrice = calculateSalePriceFromSellerAsk(100, 20, 'flat');
    const payouts = calculatePayouts(salePrice, 100, { hasAffiliate: true, hasAffiliateReferrer: true, affiliateRate: 20, affiliateType: 'flat', influencerCount: 2 });
    expect(payouts.salePrice).toBe(131.87);
    expect(payouts.sellerPayout).toBe(100);
    expect(payouts.affiliateCommission).toBe(20);
    expect(payouts.referralBonus).toBe(2);
    expect(payouts.beezioGross).toBe(4);
    expect(payouts.beezioNet).toBe(4);
    expect(payouts.processingFee).toBe(5.87);
  });
  it('uses the settled advertised price for the influencer threshold', () => {
    const underPrice = calculateSalePriceFromSellerAsk(15, 0, 'flat');
    const overPrice = calculateSalePriceFromSellerAsk(17, 0, 'flat');
    const under = calculatePayouts(underPrice, 15, { hasAffiliate: false, hasAffiliateReferrer: true, influencerCount: 2 });
    const over = calculatePayouts(overPrice, 17, { hasAffiliate: false, hasAffiliateReferrer: true, influencerCount: 2 });
    expect(underPrice).toBe(19.38);
    expect(under.referralBonus).toBe(1);
    expect(overPrice).toBeGreaterThanOrEqual(20);
    expect(over.referralBonus).toBe(2);
  });
});
