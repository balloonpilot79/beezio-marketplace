import { describe, expect, it } from 'vitest';
import { buildPayPalLedgerPlan, summarizePayeeSnapshots } from './paypalPayoutLedger';
import {
  TEST_ITEM_AFFILIATE_AMOUNT,
  TEST_ITEM_BEEZIO_FEE,
  TEST_ITEM_INFLUENCER_FEE,
  TEST_ITEM_PRICE,
  TEST_ITEM_SELLER_AMOUNT,
} from '../../shared/testItemPricing';

const baseInput = {
  orderId: 'order-1',
  currency: 'USD',
  providerOrderId: 'paypal-order-1',
  providerCaptureId: 'capture-1',
  paidAt: '2026-03-27T12:00:00.000Z',
  holdReleaseAt: '2026-04-10T12:00:00.000Z',
  sellerId: 'seller-1',
  partnerId: null,
  sellerInfluencerId: null,
  partnerInfluencerId: null,
  items: [
    {
      id: 'item-1',
      quantity: 1,
      seller_ask_amount: 100,
      partner_rate: 0,
      computed_listing_price: 117,
      product_title: 'Standard product',
      product_id: 'product-1',
      variant_id: 'variant-1',
    },
  ],
};

describe('buildPayPalLedgerPlan', () => {
  it('builds seller-only payouts', () => {
    const plan = buildPayPalLedgerPlan(baseInput);

    expect(plan.aggregate.sellerEarnings).toBe(100);
    expect(plan.aggregate.partnerEarnings).toBe(0);
    expect(plan.aggregate.influencerEarnings).toBe(0);
    expect(plan.aggregate.beezioFeeGross).toBe(15);
    expect(plan.aggregate.beezioFeeNet).toBe(9.73);
    expect(plan.payees).toHaveLength(1);
    expect(plan.payees[0]).toMatchObject({
      payeeUserId: 'seller-1',
      payeeRole: 'SELLER',
      amount: 100,
      status: 'PENDING_HOLD',
      providerCaptureId: 'capture-1',
    });
  });

  it('builds seller plus affiliate payouts', () => {
    const plan = buildPayPalLedgerPlan({
      ...baseInput,
      partnerId: 'affiliate-1',
      items: [
        {
          ...baseInput.items[0],
          partner_rate: 0.1,
          computed_listing_price: 127,
        },
      ],
    });

    expect(plan.aggregate.sellerEarnings).toBe(100);
    expect(plan.aggregate.partnerEarnings).toBe(10);
    expect(plan.aggregate.influencerEarnings).toBe(0);
    expect(plan.aggregate.beezioFeeGross).toBe(15);
    expect(plan.aggregate.beezioFeeNet).toBe(9.33);
    expect(plan.payees.map((row) => `${row.payeeRole}:${row.amount}`)).toEqual([
      'SELLER:100',
      'PARTNER:10',
    ]);
  });

  it('keeps the unassigned influencer reserve with Beezio when no influencer is attached', () => {
    const plan = buildPayPalLedgerPlan({
      ...baseInput,
      partnerId: 'affiliate-1',
      items: [
        {
          ...baseInput.items[0],
          seller_ask_amount: 21,
          computed_listing_price: 28.86,
          partner_rate: 0.1,
        },
      ],
    });

    expect(plan.aggregate.influencerEarnings).toBe(0);
    expect(plan.aggregate.beezioFeeGross).toBeCloseTo(4, 2);
    expect(plan.aggregate.beezioFeeNet).toBeCloseTo(4, 2);
    expect(plan.aggregate.notes).toContain('influencer_bonus_pool_total=2.00');
  });

  it('keeps the unassigned under-$20 influencer reserve with Beezio when no influencer is attached', () => {
    const plan = buildPayPalLedgerPlan({
      ...baseInput,
      partnerId: 'affiliate-1',
      items: [
        {
          ...baseInput.items[0],
          seller_ask_amount: 18.5,
          computed_listing_price: 28.78,
          partner_rate: 5 / 18.5,
        },
      ],
    });

    expect(plan.aggregate.influencerEarnings).toBe(0);
    expect(plan.aggregate.notes).toContain('influencer_bonus_pool_total=1.00');
  });

  it('builds seller plus affiliate plus influencer payouts', () => {
    const plan = buildPayPalLedgerPlan({
      ...baseInput,
      partnerId: 'affiliate-1',
      partnerInfluencerId: 'influencer-1',
      items: [
        {
          ...baseInput.items[0],
          partner_rate: 0.1,
          computed_listing_price: 127,
        },
      ],
    });

    expect(plan.aggregate.partnerEarnings).toBe(10);
    expect(plan.aggregate.influencerEarnings).toBe(1);
    expect(plan.aggregate.beezioFeeGross).toBe(15);
    expect(plan.aggregate.beezioFeeNet).toBe(9.33);
    expect(plan.payees.map((row) => `${row.payeeRole}:${row.amount}`)).toEqual([
      'SELLER:100',
      'PARTNER:10',
      'INFLUENCER:1',
    ]);
  });

  it('applies seller influencer under $20 bonus at $0.50 per qualified item', () => {
    const plan = buildPayPalLedgerPlan({
      ...baseInput,
      sellerInfluencerId: 'influencer-1',
      items: [
        {
          ...baseInput.items[0],
          seller_ask_amount: 19.99,
          computed_listing_price: 24.58,
        },
      ],
    });

    expect(plan.aggregate.influencerEarnings).toBe(0.5);
    expect(plan.aggregate.beezioFeeGross).toBeCloseTo(4, 2);
    expect(plan.aggregate.beezioFeeNet).toBeCloseTo(4, 2);
    expect(plan.payees.map((row) => `${row.payeeRole}:${row.amount}`)).toEqual([
      'SELLER:19.99',
      'INFLUENCER:0.5',
    ]);
  });

  it('applies seller influencer $20 and over bonus at $1.00 per qualified item', () => {
    const plan = buildPayPalLedgerPlan({
      ...baseInput,
      sellerInfluencerId: 'influencer-1',
      items: [
        {
          ...baseInput.items[0],
          seller_ask_amount: 20,
          computed_listing_price: 25.63,
        },
      ],
    });

    expect(plan.aggregate.influencerEarnings).toBe(1);
    expect(plan.aggregate.beezioFeeGross).toBeCloseTo(4, 2);
    expect(plan.aggregate.beezioFeeNet).toBeCloseTo(4, 2);
    expect(plan.payees.map((row) => `${row.payeeRole}:${row.amount}`)).toEqual([
      'SELLER:20',
      'INFLUENCER:1',
    ]);
  });

  it('applies affiliate influencer under $20 bonus at $0.50 per qualified item', () => {
    const plan = buildPayPalLedgerPlan({
      ...baseInput,
      partnerId: 'affiliate-1',
      partnerInfluencerId: 'influencer-1',
      items: [
        {
          ...baseInput.items[0],
          seller_ask_amount: 19.99,
          computed_listing_price: 26.66,
          partner_rate: 0.1,
        },
      ],
    });

    expect(plan.aggregate.partnerEarnings).toBe(2);
    expect(plan.aggregate.influencerEarnings).toBe(0.5);
    expect(plan.aggregate.beezioFeeGross).toBeCloseTo(4, 2);
    expect(plan.aggregate.beezioFeeNet).toBeCloseTo(4, 2);
    expect(plan.payees.map((row) => `${row.payeeRole}:${row.amount}`)).toEqual([
      'SELLER:19.99',
      'PARTNER:2',
      'INFLUENCER:0.5',
    ]);
  });

  it('applies affiliate influencer $20 and over bonus at $1.00 per qualified item', () => {
    const plan = buildPayPalLedgerPlan({
      ...baseInput,
      partnerId: 'affiliate-1',
      partnerInfluencerId: 'influencer-1',
      items: [
        {
          ...baseInput.items[0],
          seller_ask_amount: 20,
          computed_listing_price: 27.71,
          partner_rate: 0.1,
        },
      ],
    });

    expect(plan.aggregate.partnerEarnings).toBe(2);
    expect(plan.aggregate.influencerEarnings).toBe(1);
    expect(plan.aggregate.beezioFeeGross).toBeCloseTo(4, 2);
    expect(plan.aggregate.beezioFeeNet).toBeCloseTo(4, 2);
    expect(plan.payees.map((row) => `${row.payeeRole}:${row.amount}`)).toEqual([
      'SELLER:20',
      'PARTNER:2',
      'INFLUENCER:1',
    ]);
  });

  it('logs and pays both influencer paths when both are attached to the same sale', () => {
    const plan = buildPayPalLedgerPlan({
      ...baseInput,
      partnerId: 'affiliate-1',
      sellerInfluencerId: 'seller-influencer-1',
      partnerInfluencerId: 'affiliate-influencer-1',
      items: [
        {
          ...baseInput.items[0],
          seller_ask_amount: 21,
          computed_listing_price: 28.86,
          partner_rate: 0.1,
        },
      ],
    });

    expect(plan.aggregate.influencerEarnings).toBe(2);
    expect(plan.aggregate.influencerId).toBe(null);
    expect(plan.aggregate.beezioFeeGross).toBeCloseTo(4, 2);
    expect(plan.aggregate.beezioFeeNet).toBeCloseTo(4, 2);
    expect(plan.payees.map((row) => `${row.payeeUserId}:${row.payeeRole}:${row.amount}`)).toEqual([
      'seller-1:SELLER:21',
      'affiliate-1:PARTNER:2.1',
      'seller-influencer-1:INFLUENCER:1',
      'affiliate-influencer-1:INFLUENCER:1',
    ]);
    expect(plan.moneyEntries.filter((entry) => entry.payeeType === 'influencer')).toHaveLength(2);
    expect(plan.aggregate.notes).toContain('selected_influencer_source=both');
  });

  it('pays the seller recruiter influencer on affiliate-driven sales from that seller', () => {
    const plan = buildPayPalLedgerPlan({
      ...baseInput,
      partnerId: 'affiliate-1',
      sellerInfluencerId: 'seller-recruiter-1',
      items: [
        {
          ...baseInput.items[0],
          seller_ask_amount: 50,
          computed_listing_price: 66,
          partner_rate: 0.1,
        },
      ],
    });

    expect(plan.aggregate.partnerEarnings).toBe(5);
    expect(plan.aggregate.influencerEarnings).toBe(1);
    expect(plan.payees.map((row) => `${row.payeeUserId}:${row.payeeRole}:${row.amount}`)).toEqual([
      'seller-1:SELLER:50',
      'affiliate-1:PARTNER:5',
      'seller-recruiter-1:INFLUENCER:1',
    ]);
    expect(plan.aggregate.notes).toContain('seller_influencer_id=seller-recruiter-1');
    expect(plan.aggregate.notes).toContain('partner_influencer_id=none');
  });

  it('pays the affiliate recruiter influencer on every affiliate sale', () => {
    const plan = buildPayPalLedgerPlan({
      ...baseInput,
      partnerId: 'affiliate-1',
      partnerInfluencerId: 'affiliate-recruiter-1',
      items: [
        {
          ...baseInput.items[0],
          seller_ask_amount: 50,
          computed_listing_price: 66,
          partner_rate: 0.1,
        },
      ],
    });

    expect(plan.aggregate.partnerEarnings).toBe(5);
    expect(plan.aggregate.influencerEarnings).toBe(1);
    expect(plan.payees.map((row) => `${row.payeeUserId}:${row.payeeRole}:${row.amount}`)).toEqual([
      'seller-1:SELLER:50',
      'affiliate-1:PARTNER:5',
      'affiliate-recruiter-1:INFLUENCER:1',
    ]);
    expect(plan.aggregate.notes).toContain('seller_influencer_id=none');
    expect(plan.aggregate.notes).toContain('partner_influencer_id=affiliate-recruiter-1');
  });

  it.each([
    {
      name: 'seller sale without influencer',
      input: {
        ...baseInput,
        items: [{ ...baseInput.items[0] }],
      },
      expectedInfluencerId: null,
      expectedInfluencerAmount: 0,
      expectedSource: 'none',
    },
    {
      name: 'seller sale with seller influencer',
      input: {
        ...baseInput,
        sellerInfluencerId: 'seller-influencer-1',
        items: [{ ...baseInput.items[0], seller_ask_amount: 20, computed_listing_price: 25.63 }],
      },
      expectedInfluencerId: 'seller-influencer-1',
      expectedInfluencerAmount: 1,
      expectedSource: 'seller_referral',
    },
    {
      name: 'affiliate sale without influencer',
      input: {
        ...baseInput,
        partnerId: 'affiliate-1',
        items: [{ ...baseInput.items[0], partner_rate: 0.1, computed_listing_price: 127 }],
      },
      expectedInfluencerId: null,
      expectedInfluencerAmount: 0,
      expectedSource: 'none',
    },
    {
      name: 'affiliate sale with both influencers',
      input: {
        ...baseInput,
        partnerId: 'affiliate-1',
        sellerInfluencerId: 'seller-influencer-1',
        partnerInfluencerId: 'affiliate-influencer-1',
        items: [{ ...baseInput.items[0], seller_ask_amount: 20, computed_listing_price: 27.71, partner_rate: 0.1 }],
      },
      expectedInfluencerId: null,
      expectedInfluencerAmount: 2,
      expectedSource: 'both',
    },
  ])('selects the correct influencer path for $name', ({ input, expectedInfluencerId, expectedInfluencerAmount, expectedSource }) => {
    const plan = buildPayPalLedgerPlan(input);

    expect(plan.aggregate.influencerId).toBe(expectedInfluencerId);
    expect(plan.aggregate.influencerEarnings).toBe(expectedInfluencerAmount);
    expect(plan.aggregate.notes).toContain(`selected_influencer_source=${expectedSource}`);
  });

  it('reconciles every cent of the buyer charge across payouts and tracked fees', () => {
    const plan = buildPayPalLedgerPlan({
      ...baseInput,
      partnerId: 'affiliate-1',
      sellerInfluencerId: 'seller-influencer-1',
      partnerInfluencerId: 'affiliate-influencer-1',
      items: [
        {
          ...baseInput.items[0],
          seller_ask_amount: 50,
          computed_listing_price: 67,
          partner_rate: 0.15,
        },
      ],
    });

    expect(plan.aggregate.sellerEarnings).toBe(50);
    expect(plan.aggregate.partnerEarnings).toBe(7.5);
    expect(plan.aggregate.influencerEarnings).toBe(2);
    expect(plan.aggregate.beezioFeeGross).toBe(7.5);
    expect(plan.aggregate.beezioFeeNet).toBe(4.23);
    expect(plan.aggregate.paypalFeeEstimate).toBe(3.27);
    expect(
      plan.moneyEntries.reduce((sum, entry) => sum + Number(entry.netAmount || 0), 0).toFixed(2)
    ).toBe('67.00');
  });

  it('uses the actual PayPal capture fee when PayPal returns one', () => {
    const plan = buildPayPalLedgerPlan({
      ...baseInput,
      paypalFeeAmount: 4.12,
    });

    expect(plan.aggregate.paypalFeeEstimate).toBe(4.12);
    expect(plan.aggregate.beezioFeeGross).toBe(15);
    expect(plan.aggregate.beezioFeeNet).toBe(10.88);
    expect(plan.moneyEntries.find((entry) => entry.payeeType === 'processor_fee')?.netAmount).toBe(4.12);
  });

  it('uses the fixed live test-item split for the admin PayPal test product', () => {
    const plan = buildPayPalLedgerPlan({
      ...baseInput,
      partnerId: 'affiliate-1',
      sellerInfluencerId: 'seller-influencer-1',
      partnerInfluencerId: 'affiliate-influencer-1',
      items: [
        {
          ...baseInput.items[0],
          seller_ask_amount: TEST_ITEM_SELLER_AMOUNT,
          partner_rate: TEST_ITEM_AFFILIATE_AMOUNT / TEST_ITEM_SELLER_AMOUNT,
          computed_listing_price: TEST_ITEM_PRICE,
          product_title: 'test item - paypal live split check',
        },
      ],
      paypalFeeAmount: 0.06,
    });

    expect(plan.aggregate.grossAmount).toBe(TEST_ITEM_PRICE);
    expect(plan.aggregate.sellerEarnings).toBe(TEST_ITEM_SELLER_AMOUNT);
    expect(plan.aggregate.partnerEarnings).toBe(TEST_ITEM_AFFILIATE_AMOUNT);
    expect(plan.aggregate.influencerEarnings).toBe(TEST_ITEM_INFLUENCER_FEE * 2);
    expect(plan.aggregate.beezioFeeGross).toBe(TEST_ITEM_BEEZIO_FEE);
    expect(plan.aggregate.paypalFeeEstimate).toBe(0.06);
    expect(
      plan.moneyEntries.reduce((sum, entry) => sum + Number(entry.grossAmount || 0), 0).toFixed(2)
    ).toBe('0.91');
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
    const summary = summarizePayeeSnapshots(rows, 'seller-1', 'SELLER');

    expect(summary.pending).toBe(100);
    expect(summary.available).toBe(25);
    expect(summary.paid).toBe(15);
    expect(summary.onHold).toBe(10);
    expect(summary.total).toBe(150);
    expect(summary.nextReleaseAt).toBe('2026-04-10T12:00:00.000Z');
  });

  it('is idempotent for duplicate webhook or refresh reads', () => {
    const first = summarizePayeeSnapshots(rows, 'seller-1', 'SELLER');
    const second = summarizePayeeSnapshots(rows, 'seller-1', 'SELLER');
    expect(second).toEqual(first);
  });

  it('drops canceled or refunded payouts from active totals', () => {
    const summary = summarizePayeeSnapshots([
      ...rows,
      { payee_user_id: 'seller-1', payee_role: 'SELLER' as const, amount: 40, status: 'CANCELED' },
    ], 'seller-1', 'SELLER');

    expect(summary.total).toBe(150);
  });

  it('preserves snapshot integrity data for each payee record', () => {
    const plan = buildPayPalLedgerPlan({
      ...baseInput,
      partnerId: 'affiliate-1',
      sellerInfluencerId: 'seller-influencer-1',
      partnerInfluencerId: 'affiliate-influencer-1',
      items: [{ ...baseInput.items[0], partner_rate: 0.1 }],
    });

    expect(plan.payees.every((snapshot) => snapshot.snapshot.provider_capture_id === 'capture-1')).toBe(true);
    expect(plan.payees.every((snapshot) => Array.isArray(snapshot.snapshot.items))).toBe(true);
  });
});
