import { describe, expect, it } from 'vitest';
import { allocateCombinedShipping, applyShippingAllocations, getCombinedShippingPolicy, getCombinedShippingTotal } from './combinedShipping';
import { computeFixedTierPricing } from './customerPrice';
import { buildPayPalLedgerPlan } from '../server/payments/paypalPayoutLedger';
const item = (overrides = {}) => ({ quantity: 1, sellerId: 'seller', affiliateId: 'affiliate', storefrontScope: 'store:affiliate:shop', shippingCost: 5.99, combinedShipping: { additionalItemCost: 1.99 }, ...overrides });
describe('seller-controlled combined shipping', () => {
  it('charges full shipping unless the seller opts in', () => {
    expect(getCombinedShippingTotal([item({ quantity: 3, combinedShipping: null })])).toBe(17.97);
    expect(getCombinedShippingTotal([item()])).toBe(5.99);
    expect(getCombinedShippingTotal([item({ quantity: 3 })])).toBe(9.97);
  });
  it('combines opted-in products and variants from the same purchase channel', () => {
    expect(allocateCombinedShipping([item(), item()])).toEqual([5.99, 1.99]);
    expect(getCombinedShippingTotal([item(), item({ quantity: 2 })])).toBe(9.97);
  });
  it.each([{ sellerId: 'other' }, { affiliateId: 'other' }, { affiliateId: null }, { storefrontScope: 'store:seller:shop' }])('never combines different seller or affiliate routes: %j', overrides => {
    expect(getCombinedShippingTotal([item(), item(overrides)])).toBe(11.98);
  });
  it('does not include products without a bundle policy in another product bundle', () => {
    expect(getCombinedShippingTotal([item({ quantity: 2 }), item({ combinedShipping: null })])).toBe(13.97);
  });
  it('requires an explicit valid saved policy and excludes supplier quotes', () => {
    const product = { shipping_price: 5.99, shipping_options: [{ bundle_shipping: true, additional_item_cost: 1.99 }] };
    expect(getCombinedShippingPolicy(product)).toEqual({ additionalItemCost: 1.99 });
    expect(getCombinedShippingPolicy({ ...product, source_platform: 'cj' })).toBeNull();
    expect(getCombinedShippingPolicy({ ...product, shipping_options: [{ bundle_shipping: true }] })).toBeNull();
    expect(getCombinedShippingPolicy({ ...product, shipping_options: [{ bundle_shipping: true, additional_item_cost: 6 }] })).toBeNull();
    expect(getCombinedShippingPolicy({ ...product, shipping_options: [{ additional_item_cost: 0 }] })).toBeNull();
  });
  it('preserves cents, quantities, seller asks, and commissions in order snapshots', () => {
    const pricing = computeFixedTierPricing({ sellerPayout: 13.1, affiliatePayout: 5, shippingIncluded: 5.99 });
    const quantity = 3;
    const shipping = getCombinedShippingTotal([item({ quantity })]);
    const merchandise = Math.round((pricing.finalAdvertisedPrice - 5.99) * quantity * 100) / 100;
    const lines = applyShippingAllocations([{ quantity, shippingReserveUnit: 5.99 }], [shipping]);
    expect(lines.reduce((sum, row) => sum + row.quantity, 0)).toBe(3);
    expect(Math.round(lines.reduce((sum, row) => sum + row.quantity * row.shippingReserveUnit, 0) * 100) / 100).toBe(9.97);
    const plan = buildPayPalLedgerPlan({ orderId: 'order', currency: 'USD', providerOrderId: 'paypal', providerCaptureId: 'capture', paidAt: '2026-10-05', holdReleaseAt: '2026-10-19', sellerId: 'seller', partnerId: 'affiliate', sellerInfluencerId: 'seller-referrer', partnerInfluencerId: 'affiliate-referrer', subtotalListing: merchandise, shippingAmount: shipping, taxAmount: 0, items: lines.map(line => ({ quantity: line.quantity, seller_ask_amount: 13.1, affiliate_payout_amount: 5, shipping_reserve_amount: line.shippingReserveUnit, computed_listing_price: Math.round((pricing.finalAdvertisedPrice - 5.99 + line.shippingReserveUnit) * 100) / 100, platform_fee_amount: 2, influencer_allocation_amount: 2, paypal_processing_allowance: pricing.paypalProcessingAllowance })) });
    expect(plan.aggregate.sellerEarnings).toBe(49.27);
    expect(plan.aggregate.partnerEarnings).toBe(15);
    expect(plan.aggregate.influencerEarnings).toBe(6);
    expect(plan.aggregate.beezioFeeGross).toBe(6);
    expect(Math.round(plan.moneyEntries.reduce((sum, row) => sum + row.netAmount, 0) * 100) / 100).toBe(Math.round((merchandise + shipping) * 100) / 100);
  });
});
