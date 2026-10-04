import { describe, expect, it } from 'vitest';
import { DOLLAR_CHECKOUT_TEST as pricing, DOLLAR_CHECKOUT_TEST_ID } from './dollarCheckoutTest';
import { applyCanonicalProductPricing } from './productPricing';
import { buildPayPalLedgerPlan } from '../server/payments/paypalPayoutLedger';

describe('designated one-dollar live checkout', () => {
  it('publishes 93 cents only for the designated product', () => {
    const product = { id: DOLLAR_CHECKOUT_TEST_ID, title: 'Beezio $1 Checkout Test', seller_ask: 0.10, affiliate_commission_type: 'flat' as const, affiliate_commission_value: 0.10 };
    expect(applyCanonicalProductPricing(product).price).toBe(0.93);
    expect(applyCanonicalProductPricing({ ...product, id: 'ordinary-product' }).price).toBeGreaterThan(0.93);
    expect(Math.round(pricing.finalAdvertisedPrice * 107) / 100).toBe(1);
  });
  it.each([true, false])('conserves the dollar with influencer assignment %s', assigned => {
    const plan = buildPayPalLedgerPlan({
      orderId: 'test-order', currency: 'USD', providerOrderId: 'paypal-order', providerCaptureId: 'capture',
      paidAt: '2026-10-04T00:00:00Z', holdReleaseAt: '2026-10-18T00:00:00Z',
      sellerId: 'seller', partnerId: 'affiliate', sellerInfluencerId: assigned ? 'seller-recruiter' : null,
      partnerInfluencerId: assigned ? 'affiliate-recruiter' : null,
      subtotalListing: 0.93, shippingAmount: 0, taxAmount: 0.07, paypalFeeAmount: 0.64,
      items: [{ product_id: DOLLAR_CHECKOUT_TEST_ID, product_title: 'Beezio $1 Checkout Test', quantity: 1,
        seller_ask_amount: 0.10, partner_rate: 1, computed_listing_price: 0.93,
        affiliate_payout_amount: 0.10, shipping_reserve_amount: 0,
        influencer_allocation_amount: 0.04, platform_fee_amount: 0.05, paypal_processing_allowance: 0.64 }],
    });
    expect(plan.aggregate.sellerEarnings).toBe(0.10);
    expect(plan.aggregate.partnerEarnings).toBe(0.10);
    expect(plan.aggregate.influencerEarnings).toBe(assigned ? 0.04 : 0);
    expect(plan.aggregate.beezioProfit).toBe(assigned ? 0.05 : 0.09);
    expect(Math.round(plan.moneyEntries.reduce((sum, row) => sum + row.netAmount, 0) * 100)).toBe(100);
  });
});
