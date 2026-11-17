import { describe, expect, it } from 'vitest';
import { computeFixedTierPricing } from './customerPrice';
import { getReferrerBonusPerItem } from './referralBonus';
import { buildPayPalLedgerPlan } from '../server/payments/paypalPayoutLedger';

describe('seller asks through $5', () => {
  it.each([0.01, 1, 4.99, 5])('reserves quarters using the $%s seller ask, even with large commissions and shipping', ask => {
    const quote = computeFixedTierPricing({ sellerPayout: ask, affiliatePayout: 8, shippingIncluded: 10 });
    expect(quote.platformFee).toBe(0.75);
    expect(quote.influencerPerSlot).toBe(0.25);
    expect(quote.affiliatePayout).toBe(8);
    expect(quote.shippingIncluded).toBe(10);
  });
  it('prices a $1 ask without affiliate commission or shipping at $2.97 before tax', () => {
    const quote = computeFixedTierPricing({ sellerPayout: 1 });
    expect(quote.finalAdvertisedPrice).toBe(2.97);
    expect(quote.paypalProcessingAllowance).toBe(0.72);
  });
  it('keeps the existing schedule above $5', () => {
    const quote = computeFixedTierPricing({ sellerPayout: 5.01 });
    expect(quote.platformFee).toBe(1.25);
    expect(getReferrerBonusPerItem(5.01)).toBe(0.5);
    expect(getReferrerBonusPerItem(30)).toBe(0.5);
    expect(getReferrerBonusPerItem(30.01)).toBe(1);
  });
  it.each([1, 3])('funds all three referrers and retains 50 cents per unit for quantity %s', quantity => {
    const quote = computeFixedTierPricing({ sellerPayout: 1, affiliatePayout: 0.4 });
    const plan = buildPayPalLedgerPlan({ orderId: 'micro', currency: 'USD', providerOrderId: 'pp', providerCaptureId: 'cap', paidAt: '2026-11-17', holdReleaseAt: '2026-12-01', sellerId: 'seller', partnerId: 'affiliate', sellerInfluencerId: 'seller-referrer', partnerInfluencerId: 'affiliate-referrer', buyerReferrerId: 'buyer-referrer', subtotalListing: quote.finalAdvertisedPrice * quantity, items: [{ quantity, seller_ask_amount: 1, partner_rate: 0, computed_listing_price: quote.finalAdvertisedPrice, affiliate_payout_amount: 0.4, platform_fee_amount: quote.platformFee, influencer_allocation_amount: quote.influencerAllocation, paypal_processing_allowance: quote.paypalProcessingAllowance }] });
    expect(plan.aggregate.sellerEarnings).toBe(quantity);
    expect(plan.aggregate.partnerEarnings).toBeCloseTo(0.4 * quantity, 2);
    expect(plan.aggregate.beezioFeeNet).toBe(0.5 * quantity);
    for (const id of ['seller-referrer', 'affiliate-referrer', 'buyer-referrer']) {
      expect(plan.payees.find(row => row.payeeUserId === id)?.amount).toBe(0.25 * quantity);
    }
    expect(Math.round(plan.moneyEntries.reduce((sum, row) => sum + row.netAmount, 0) * 100)).toBe(Math.round(quote.finalAdvertisedPrice * quantity * 100));
  });
});
