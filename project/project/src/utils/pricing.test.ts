import { describe, expect, it } from 'vitest';
import { PLATFORM_FEE_PERCENT } from '../config/beezioConfig';
import {
  DEFAULT_AFFILIATE_RATE,
  REFERRAL_OF_BEEZIO_RATE,
  STRIPE_FLAT,
  STRIPE_PERCENT,
  calculatePayouts,
  calculateSalePriceFromSellerAsk,
  roundUpToTwoDecimals,
  roundToCurrency,
} from './pricing';

describe('pricing utilities', () => {
  it('roundUpToTwoDecimals rounds up as expected', () => {
    expect(roundUpToTwoDecimals(10.231)).toBe(10.24);
    expect(roundUpToTwoDecimals(10.2)).toBe(10.2);
  });

  it('calculateSalePriceFromSellerAsk computes sale price with baked-in fees', () => {
    const sellerAsk = 100;
    const salePrice = calculateSalePriceFromSellerAsk(sellerAsk, 0.2);

    // Unified ask-based pricing model (matches pricingEngine/beezioConfig):
    // - Platform fee: 15%
    // - Affiliate: 20% of ask
    // - Stripe: 2.9% + $0.30 (charged on final price)
    expect(salePrice).toBeCloseTo(139.34, 2);
  });

  it('calculatePayouts with affiliate and referrer', () => {
    const sellerAsk = 100;
    const salePrice = calculateSalePriceFromSellerAsk(sellerAsk, DEFAULT_AFFILIATE_RATE);
    const payouts = calculatePayouts(salePrice, sellerAsk, {
      hasAffiliate: true,
      hasAffiliateReferrer: true,
      affiliateRate: DEFAULT_AFFILIATE_RATE,
    });

    const expectedBeezioGross = roundToCurrency(sellerAsk * (PLATFORM_FEE_PERCENT / 100));
    const expectedAffiliate = roundToCurrency(sellerAsk * DEFAULT_AFFILIATE_RATE);
    const expectedReferral = roundToCurrency(expectedBeezioGross * REFERRAL_OF_BEEZIO_RATE);
    const expectedNet = roundToCurrency(expectedBeezioGross - expectedReferral);
    const expectedStripe = roundToCurrency(salePrice * STRIPE_PERCENT + STRIPE_FLAT);

    expect(payouts.sellerPayout).toBe(roundToCurrency(sellerAsk));
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
    expect(payouts.sellerPayout).toBe(roundToCurrency(sellerAsk));
  });
});
