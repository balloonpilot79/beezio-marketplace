import { describe, expect, it } from 'vitest';
import { getOrderUnitSavings, getCartUnitPrice, getOrderSavings } from './orderPricing';
import { computeFixedTierPricing } from './customerPrice';
import { buildPayPalLedgerPlan } from '../server/payments/paypalPayoutLedger';

describe('one payment per cart pricing', () => {
  it.each([1,2,3,7])('covers one fixed processing charge for %s units', quantity => {
    const item = { productId: 'product', title: 'Shirt', quantity, price: 28.07 };
    const discount = getOrderUnitSavings([item]);
    expect(discount).toBeGreaterThanOrEqual(0);
    expect(0.6 * quantity - discount * quantity).toBeGreaterThanOrEqual(0.6 - 0.000001);
    expect(getCartUnitPrice(item, [item])).toBe(Math.round((28.07 - discount) * 100) / 100);
    expect(getOrderSavings([item])).toBe(Math.round(discount * quantity * 100) / 100);
  });
  it('uses the same quantity across different product lines', () => {
    expect(getOrderUnitSavings([{ title: 'Shirt', quantity: 1 }, { title: 'Mug', quantity: 1 }])).toBe(0.3);
  });
  it('preserves special test and sample prices', () => {
    expect(getOrderUnitSavings([{ productId: '82ab459c-f29b-49b3-ac81-e5f95c1c48e9', title: 'Beezio $1 Checkout Test', quantity: 2 }])).toBe(0);
    expect(getOrderUnitSavings([{ title: 'Shirt', quantity: 2, isSample: true }])).toBe(0);
  });
  it('reconciles discounted payment without reducing any promised payout', () => {
    const pricing = computeFixedTierPricing({ sellerPayout: 15.1, affiliatePayout: 7, shippingIncluded: 5.99 });
    const quantity = 3;
    const credit = getOrderUnitSavings([{ title: 'Shirt', quantity }]);
    const unitPrice = Math.round((pricing.finalAdvertisedPrice - credit) * 100) / 100;
    const subtotal = Math.round((unitPrice - 5.99) * quantity * 100) / 100;
    const shipping = 17.97;
    const plan = buildPayPalLedgerPlan({ orderId:'order', currency:'USD', providerOrderId:'paypal', providerCaptureId:'capture', paidAt:'2026-10-05', holdReleaseAt:'2026-10-19', sellerId:'seller', partnerId:'affiliate', sellerInfluencerId:'seller-referrer', partnerInfluencerId:'affiliate-referrer', subtotalListing:subtotal, shippingAmount:shipping, taxAmount:0, items:[{ quantity, seller_ask_amount:15.1, partner_rate:0, computed_listing_price:unitPrice, affiliate_payout_amount:7, shipping_reserve_amount:5.99, platform_fee_amount:pricing.platformFee, influencer_allocation_amount:pricing.influencerAllocation, paypal_processing_allowance:pricing.paypalProcessingAllowance - credit, product_title:'Shirt' }] });
    expect(plan.aggregate.sellerEarnings).toBe(63.27);
    expect(plan.aggregate.partnerEarnings).toBe(21);
    expect(plan.aggregate.influencerEarnings).toBe(6);
    expect(plan.aggregate.beezioFeeGross).toBe(3);
    expect(plan.aggregate.beezioProfit).toBeGreaterThanOrEqual(3);
    expect(Math.round(plan.moneyEntries.reduce((sum, row) => sum + row.netAmount,0)*100)/100).toBe(Math.round((subtotal+shipping)*100)/100);
  });
});
