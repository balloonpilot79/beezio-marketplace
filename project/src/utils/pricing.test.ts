import { describe, expect, it } from 'vitest';
import {
  DEFAULT_AFFILIATE_RATE,
  REFERRAL_OF_BEEZIO_RATE,
  STRIPE_FLAT,
  STRIPE_PERCENT,
  calculatePayouts,
  calculateSalePriceFromSellerAsk,
  getPlatformRate,
  roundUpToTwoDecimals,
} from './pricing';

describe('pricing utilities', () => {
  it('roundUpToTwoDecimals rounds up as expected', () => {
    expect(roundUpToTwoDecimals(10.231)).toBe(10.24);
    expect(roundUpToTwoDecimals(10.2)).toBe(10.2);
  });

  it('calculateSalePriceFromSellerAsk computes sale price with baked-in fees', () => {
    const sellerAsk = 100;
    const salePrice = calculateSalePriceFromSellerAsk(sellerAsk, 0.2);

    // Seller ask 100, platform 10%, affiliate 20% of ask, Stripe 2.9% + $0.60 baked in
    expect(salePrice).toBeCloseTo(134.51, 2);
  });

  it('calculatePayouts with affiliate and referrer', () => {
    const sellerAsk = 100;
    const salePrice = calculateSalePriceFromSellerAsk(sellerAsk, DEFAULT_AFFILIATE_RATE);
    const payouts = calculatePayouts(salePrice, sellerAsk, {
      hasAffiliate: true,
      hasAffiliateReferrer: true,
      affiliateRate: DEFAULT_AFFILIATE_RATE,
    });

    const expectedBeezioGross = roundUpToTwoDecimals(sellerAsk * getPlatformRate(sellerAsk));
    const expectedAffiliate = roundUpToTwoDecimals(sellerAsk * (DEFAULT_AFFILIATE_RATE * 100) / 100);
    const expectedReferral = roundUpToTwoDecimals(expectedBeezioGross * REFERRAL_OF_BEEZIO_RATE);
    const expectedNet = roundUpToTwoDecimals(expectedBeezioGross - expectedReferral);
    const expectedStripe = roundUpToTwoDecimals(salePrice * STRIPE_PERCENT + STRIPE_FLAT);

    expect(payouts.sellerPayout).toBe(roundUpToTwoDecimals(sellerAsk));
    expect(payouts.affiliateCommission).toBe(expectedAffiliate);
    expect(payouts.beezioGross).toBe(expectedBeezioGross);
    expect(payouts.referralBonus).toBe(expectedReferral);
    expect(payouts.beezioNet).toBe(expectedNet);
    expect(payouts.stripeFee).toBe(expectedStripe);
  });

  it('calculatePayouts without affiliate', () => {
    const sellerAsk = 50;
    const salePrice = calculateSalePriceFromSellerAsk(sellerAsk, 0.1);
    const payouts = calculatePayouts(salePrice, sellerAsk, {
      hasAffiliate: false,
      hasAffiliateReferrer: false,
      affiliateRate: 0.1,
    });

    expect(payouts.affiliateCommission).toBe(0);
    expect(payouts.referralBonus).toBe(0);
    expect(payouts.sellerPayout).toBe(roundUpToTwoDecimals(sellerAsk));
  });
});
