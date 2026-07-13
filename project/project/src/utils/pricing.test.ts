import { describe, expect, it } from 'vitest';
import { getAssignedInfluencerPayoutTotal, getInfluencerReserveTotal } from '../../shared/referralBonus';
import {
  DEFAULT_AFFILIATE_RATE,
  PROCESSING_FLAT,
  PROCESSING_PERCENT,
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
    // - Platform fee: $2 under $25, otherwise 15% of ask
    // - Affiliate: 20% of ask
    // - Processing is baked into the listing price (buyer pays)
    // Includes baked-in influencer reserve for both seller and affiliate influencer slots:
    // - >= $25 ask => $2.00 reserve per sale
    expect(salePrice).toBeCloseTo(137, 2);
  });

  it('bakes in $1.00 total influencer reserve for products under $25', () => {
    const sellerAsk = 19.99;
    const salePrice = calculateSalePriceFromSellerAsk(sellerAsk, 0.2);
    expect(salePrice).toBeGreaterThan(0);
    expect(salePrice).toBeCloseTo(28.74, 2);
  });

  it('bakes in $2.00 total influencer reserve for products at or above $25', () => {
    const sellerAsk = 25;
    const salePrice = calculateSalePriceFromSellerAsk(sellerAsk, 0.2);
    expect(salePrice).toBeGreaterThan(0);
    expect(salePrice).toBeCloseTo(36.04, 2);
  });

  it('keeps the flat $2 Beezio fee through $24.99, then switches PayPal inside the platform pool at $25', () => {
    const belowThreshold = calculatePayouts(
      calculateSalePriceFromSellerAsk(24.99, DEFAULT_AFFILIATE_RATE),
      24.99,
      {
        hasAffiliate: true,
        hasAffiliateReferrer: true,
        affiliateRate: DEFAULT_AFFILIATE_RATE,
        influencerCount: 2,
      }
    );
    const atThreshold = calculatePayouts(
      calculateSalePriceFromSellerAsk(25, DEFAULT_AFFILIATE_RATE),
      25,
      {
        hasAffiliate: true,
        hasAffiliateReferrer: true,
        affiliateRate: DEFAULT_AFFILIATE_RATE,
        influencerCount: 2,
      }
    );

    expect(belowThreshold.beezioNet).toBe(2);
    expect(atThreshold.salePrice).toBe(36.04);
    expect(atThreshold.beezioNet).toBe(2);
  });

  it('calculatePayouts with affiliate and one influencer', () => {
    const sellerAsk = 100;
    const salePrice = calculateSalePriceFromSellerAsk(sellerAsk, DEFAULT_AFFILIATE_RATE);
    const payouts = calculatePayouts(salePrice, sellerAsk, {
      hasAffiliate: true,
      hasAffiliateReferrer: true,
      affiliateRate: DEFAULT_AFFILIATE_RATE,
    });

    const expectedAffiliate = roundToCurrency(sellerAsk * DEFAULT_AFFILIATE_RATE);
    const expectedBeezioGross = 17;
    const expectedReferral = getAssignedInfluencerPayoutTotal(sellerAsk, 1);
    const expectedProcessing = 6.07;
    const expectedNet = roundToCurrency(expectedBeezioGross - expectedReferral - expectedProcessing);

    expect(payouts.sellerPayout).toBe(roundToCurrency(sellerAsk));
    expect(payouts.affiliateCommission).toBe(expectedAffiliate);
    expect(payouts.beezioGross).toBe(expectedBeezioGross);
    expect(payouts.referralBonus).toBe(expectedReferral);
    expect(payouts.beezioNet).toBe(expectedNet);
    expect(payouts.processingFee).toBe(expectedProcessing);
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
    expect(payouts.beezioGross).toBe(9.5);
    expect(payouts.beezioNet).toBe(6.33);
  });

  it('uses the lower flat referral bonus under $25', () => {
    const sellerAsk = 19.99;
    const salePrice = calculateSalePriceFromSellerAsk(sellerAsk, DEFAULT_AFFILIATE_RATE);
    const payouts = calculatePayouts(salePrice, sellerAsk, {
      hasAffiliate: true,
      hasAffiliateReferrer: true,
      affiliateRate: DEFAULT_AFFILIATE_RATE,
    });

    expect(payouts.referralBonus).toBe(0.5);
  });

  it('pays both influencer slots when two influencers are assigned', () => {
    const sellerAsk = 19.99;
    const salePrice = calculateSalePriceFromSellerAsk(sellerAsk, DEFAULT_AFFILIATE_RATE);
    const payouts = calculatePayouts(salePrice, sellerAsk, {
      hasAffiliate: true,
      hasAffiliateReferrer: true,
      affiliateRate: DEFAULT_AFFILIATE_RATE,
      influencerCount: 2,
    });

    expect(payouts.referralBonus).toBe(getInfluencerReserveTotal(sellerAsk));
    expect(payouts.beezioNet).toBe(roundToCurrency(payouts.beezioGross - payouts.referralBonus));
    expect(payouts.beezioNet).toBe(2);
  });
});
