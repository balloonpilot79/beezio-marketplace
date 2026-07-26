import { describe, expect, it } from 'vitest';
import { calculateBeezioSplit } from './calculateBeezioSplit';
import { calculatePayouts, calculateSalePriceFromSellerAsk } from '../../src/utils/pricing';

describe('mock sale verification ($10 with affiliate + influencer)', () => {
  it('applies locked fee policy and tracking fields', () => {
    // Scenario:
    // - Buyer buys one $10 item (seller ask basis)
    // - Affiliate is connected
    // - Affiliate has influencer/referrer connected
    // - Affiliate rate for this product is 20%
    const split = calculateBeezioSplit({
      items_subtotal: 10,
      shipping_amount: 0,
      tax_amount: 0,
      affiliate_id: 'affiliate_123',
      referrer_id: 'influencer_123',
      isFundraiser: false,
      affiliate_rate: 2,
    });

    // Seller always gets ask (items subtotal)
    expect(split.seller_net_items_amount).toBe(10);

    // Affiliate gets the seller-selected fixed $2 payout.
    expect(split.affiliate_commission_amount).toBe(2);
    expect(split.affiliate_amount).toBe(2);

    // Under $25, Beezio has a fixed $1 platform fee plus the unused influencer slot.
    expect(split.referral_fee_amount).toBe(0.5);
    expect(split.referrer_amount).toBe(0.5);
    expect(split.beezio_fee_amount).toBe(1.5);
    expect(split.beezio_kept_amount).toBe(1.5);

    // Tracking fields present and coherent
    expect(split.validation_ok).toBe(true);
    expect(split.items_subtotal).toBe(10);
    expect(split.shipping_amount).toBe(0);
    expect(split.tax_amount).toBe(0);
  });

  it('computes buyer listing price and processing for the same scenario', () => {
    const sellerAsk = 10;
    const affiliatePayout = 2;

    const listingPrice = calculateSalePriceFromSellerAsk(sellerAsk, affiliatePayout, 'flat');
    const payouts = calculatePayouts(listingPrice, sellerAsk, {
      hasAffiliate: true,
      hasAffiliateReferrer: true,
      affiliateRate: affiliatePayout,
      affiliateType: 'flat',
    });

    expect(listingPrice).toBe(15.21);
    expect(payouts.sellerPayout).toBe(10);
    expect(payouts.affiliateCommission).toBe(2);
    expect(payouts.beezioGross).toBe(1);
    expect(payouts.referralBonus).toBe(0.5);
    expect(payouts.beezioNet).toBe(1);
    expect(payouts.processingFee).toBeCloseTo(1.21, 2);
  });

  it('applies the same split model for CJ-sourced products (commission input differs)', () => {
    // CJ path may provide commission differently via API/admin import, but
    // payout policy should remain identical once values are normalized.
    const split = calculateBeezioSplit({
      items_subtotal: 10,
      shipping_amount: 0,
      tax_amount: 0,
      affiliate_id: 'affiliate_123',
      referrer_id: 'influencer_123',
      isFundraiser: false,
      affiliate_rate: 3.5,
    });

    // Fixed affiliate payout => $3.50
    expect(split.affiliate_commission_amount).toBe(3.5);
    expect(split.referrer_amount).toBe(0.5);
    expect(split.beezio_kept_amount).toBe(1.5);
    expect(split.seller_net_items_amount).toBe(10);
    expect(split.validation_ok).toBe(true);
  });
});
