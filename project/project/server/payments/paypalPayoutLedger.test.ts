import { describe, expect, it } from 'vitest';
import { computeFixedTierPricing } from '../../shared/customerPrice';
import { buildPayPalLedgerPlan, summarizePayeeSnapshots } from './paypalPayoutLedger';

const makeInput = (overrides: Record<string, unknown> = {}) => {
  const pricing = computeFixedTierPricing({
    supplierCost: 23.8,
    sellerMarkup: 10,
    affiliatePayout: 5,
    shippingIncluded: 6.2,
  });

  return {
    orderId: 'order-1',
    currency: 'USD',
    providerOrderId: 'paypal-order-1',
    providerCaptureId: 'capture-1',
    paidAt: '2026-03-27T12:00:00.000Z',
    holdReleaseAt: '2026-04-10T12:00:00.000Z',
    sellerId: 'seller-1',
    partnerId: 'affiliate-1',
    sellerInfluencerId: 'influencer-1',
    partnerInfluencerId: 'influencer-2',
    subtotalListing: pricing.finalAdvertisedPrice,
    shippingAmount: 0,
    taxAmount: 0,
    items: [{
      id: 'item-1',
      quantity: 1,
      seller_ask_amount: pricing.sellerPayout,
      partner_rate: pricing.affiliatePayout / pricing.sellerPayout,
      computed_listing_price: pricing.finalAdvertisedPrice,
      supplier_cost_amount: pricing.supplierCost,
      seller_markup_amount: pricing.sellerMarkup,
      affiliate_payout_amount: pricing.affiliatePayout,
      shipping_reserve_amount: pricing.shippingIncluded,
      influencer_allocation_amount: pricing.influencerAllocation,
      platform_fee_amount: pricing.platformFee,
      paypal_processing_allowance: pricing.paypalProcessingAllowance,
      product_title: 'Fixed-tier product',
      product_id: 'product-1',
    }],
    ...overrides,
  };
};

describe('buildPayPalLedgerPlan fixed-tier accounting', () => {
  it('preserves every seller-controlled payout bucket', () => {
    const plan = buildPayPalLedgerPlan(makeInput());

    expect(plan.aggregate.sellerEarnings).toBe(40);
    expect(plan.aggregate.partnerEarnings).toBe(5);
    expect(plan.aggregate.influencerEarnings).toBe(2);
    expect(plan.aggregate.beezioFeeGross).toBe(2);
    expect(plan.aggregate.beezioFeeNet).toBe(2);
    expect(plan.payees.map((row) => `${row.payeeRole}:${row.amount}`)).toEqual([
      'SELLER:40',
      'PARTNER:5',
      'INFLUENCER:1',
      'INFLUENCER:1',
    ]);
  });

  it('keeps each unfilled influencer slot with Beezio', () => {
    const plan = buildPayPalLedgerPlan(makeInput({
      sellerInfluencerId: null,
      partnerInfluencerId: null,
    }));

    expect(plan.aggregate.influencerEarnings).toBe(0);
    expect(plan.aggregate.notes).toContain('influencer_bonus_retained_total=2.00');
    expect(plan.aggregate.beezioProfit).toBe(4.01);
  });

  it('uses the final advertised price for the under-$20 influencer tier', () => {
    const pricing = computeFixedTierPricing({ sellerPayout: 15 });
    const plan = buildPayPalLedgerPlan(makeInput({
      partnerId: null,
      partnerInfluencerId: null,
      subtotalListing: pricing.finalAdvertisedPrice,
      items: [{
        id: 'item-low',
        quantity: 1,
        seller_ask_amount: 15,
        partner_rate: 0,
        computed_listing_price: pricing.finalAdvertisedPrice,
        affiliate_payout_amount: 0,
        shipping_reserve_amount: 0,
        influencer_allocation_amount: pricing.influencerAllocation,
        platform_fee_amount: pricing.platformFee,
        paypal_processing_allowance: pricing.paypalProcessingAllowance,
      }],
    }));

    expect(pricing.finalAdvertisedPrice).toBeLessThan(20);
    expect(plan.aggregate.influencerEarnings).toBe(0.5);
    expect(plan.aggregate.beezioFeeGross).toBe(1);
  });

  it('uses the full tax-inclusive capture amount for actual PayPal cost', () => {
    const plan = buildPayPalLedgerPlan(makeInput({
      taxAmount: 3.62,
      paypalFeeAmount: null,
    }));

    expect(plan.aggregate.paypalFeeEstimate).toBe(2.81);
    expect(plan.aggregate.sellerEarnings).toBe(40);
    expect(plan.aggregate.partnerEarnings).toBe(5);
    expect(plan.aggregate.beezioFeeNet).toBe(2);
  });

  it('uses PayPal capture fee data without reducing platform earnings', () => {
    const plan = buildPayPalLedgerPlan(makeInput({ paypalFeeAmount: 3.12 }));

    expect(plan.aggregate.paypalFeeEstimate).toBe(3.12);
    expect(plan.aggregate.beezioFeeGross).toBe(2);
    expect(plan.aggregate.beezioFeeNet).toBe(2);
    expect(plan.moneyEntries.find((row) => row.payeeType === 'processor_fee')?.grossAmount).toBe(3.12);
  });

  it('freezes itemized cost, markup, shipping, affiliate, and fee data', () => {
    const plan = buildPayPalLedgerPlan(makeInput());
    const snapshot = plan.payees[0].snapshot as any;

    expect(snapshot.items[0]).toMatchObject({
      supplier_cost_amount: 23.8,
      seller_markup_amount: 10,
      shipping_reserve_amount: 6.2,
      partner_line_total: 5,
      beezio_fee_gross_line_total: 2,
    });
    expect(snapshot.provider_capture_id).toBe('capture-1');
  });
});

describe('summarizePayeeSnapshots', () => {
  const rows = [
    { payee_user_id: 'seller-1', payee_role: 'SELLER' as const, amount: 100, status: 'PENDING_HOLD', hold_release_at: '2026-04-10T12:00:00.000Z' },
    { payee_user_id: 'seller-1', payee_role: 'SELLER' as const, amount: 25, status: 'READY_TO_PAY', hold_release_at: '2026-04-01T12:00:00.000Z' },
    { payee_user_id: 'seller-1', payee_role: 'SELLER' as const, amount: 15, status: 'PAID', paid_at: '2026-04-15T12:00:00.000Z' },
    { payee_user_id: 'seller-1', payee_role: 'SELLER' as const, amount: 10, status: 'ON_HOLD_DISPUTE' },
  ];

  it('splits pending, on-hold, available, and paid totals', () => {
    expect(summarizePayeeSnapshots(rows, 'seller-1', 'SELLER')).toEqual({
      pending: 100,
      onHold: 10,
      available: 25,
      paid: 15,
      nextReleaseAt: '2026-04-10T12:00:00.000Z',
      total: 150,
    });
  });

  it('is idempotent and excludes canceled rows', () => {
    const withCanceled = [
      ...rows,
      { payee_user_id: 'seller-1', payee_role: 'SELLER' as const, amount: 40, status: 'CANCELED' },
    ];
    const first = summarizePayeeSnapshots(withCanceled, 'seller-1', 'SELLER');
    const second = summarizePayeeSnapshots(withCanceled, 'seller-1', 'SELLER');

    expect(second).toEqual(first);
    expect(second.total).toBe(150);
  });
});
