import { describe, expect, it } from 'vitest';
import { calculateBeezioSplit } from './calculateBeezioSplit';
import { calculatePayouts, calculateSalePriceFromSellerAsk } from '../../src/utils/pricing';

describe('mock sale verification ($10 with affiliate + influencer)', () => {
  it('applies locked fee policy and tracking fields', () => {
    const split = calculateBeezioSplit({ items_subtotal: 10, shipping_amount: 0, tax_amount: 0, affiliate_id: 'affiliate_123', referrer_id: 'influencer_123', isFundraiser: false, affiliate_rate: 2 });
    expect(split.seller_net_items_amount).toBe(10);
    expect(split.affiliate_commission_amount).toBe(2);
    expect(split.affiliate_amount).toBe(2);
    expect(split.referral_fee_amount).toBe(0.5);
    expect(split.referrer_amount).toBe(0.5);
    expect(split.beezio_fee_amount).toBe(2.5);
    expect(split.beezio_kept_amount).toBe(2.5);
    expect(split.validation_ok).toBe(true);
    expect(split.items_subtotal).toBe(10);
    expect(split.shipping_amount).toBe(0);
    expect(split.tax_amount).toBe(0);
  });

  it('computes buyer listing price and processing for the same scenario', () => {
    const sellerAsk = 10;
    const affiliatePayout = 2;
    const listingPrice = calculateSalePriceFromSellerAsk(sellerAsk, affiliatePayout, 'flat');
    const payouts = calculatePayouts(listingPrice, sellerAsk, { hasAffiliate: true, hasAffiliateReferrer: true, affiliateRate: affiliatePayout, affiliateType: 'flat' });
    expect(listingPrice).toBe(16.25);
    expect(payouts.sellerPayout).toBe(10);
    expect(payouts.affiliateCommission).toBe(2);
    expect(payouts.beezioGross).toBe(2);
    expect(payouts.referralBonus).toBe(0.5);
    expect(payouts.beezioNet).toBe(2);
    expect(payouts.processingFee).toBeCloseTo(1.25, 2);
  });

  it('applies the same split model for CJ-sourced products (commission input differs)', () => {
    const split = calculateBeezioSplit({ items_subtotal: 10, shipping_amount: 0, tax_amount: 0, affiliate_id: 'affiliate_123', referrer_id: 'influencer_123', isFundraiser: false, affiliate_rate: 3.5 });
    expect(split.affiliate_commission_amount).toBe(3.5);
    expect(split.referrer_amount).toBe(0.5);
    expect(split.beezio_kept_amount).toBe(2.5);
    expect(split.seller_net_items_amount).toBe(10);
    expect(split.validation_ok).toBe(true);
  });
});
