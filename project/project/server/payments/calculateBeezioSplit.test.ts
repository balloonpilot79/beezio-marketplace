import { describe, expect, it } from 'vitest';
import { calculateBeezioSplit } from './calculateBeezioSplit';

describe('calculateBeezioSplit', () => {
  it('no affiliate, no referrer', () => {
    const split = calculateBeezioSplit({
      items_subtotal: 100,
      shipping_amount: 10,
      tax_amount: 5,
      affiliate_id: null,
      referrer_id: null,
      isFundraiser: false,
      affiliate_rate: 0.2,
    });

    expect(split.validation_ok).toBe(true);
    expect(split.beezio_fee_amount).toBe(15);
    expect(split.referral_fee_amount).toBe(0);
    expect(split.affiliate_commission_amount).toBe(0);
    expect(split.seller_net_items_amount).toBe(85);
    expect(split.seller_total_transfer_amount).toBe(95);
    expect(split.referrer_amount).toBe(0);
    expect(split.beezio_kept_amount).toBe(15);
  });

  it('affiliate only creates affiliate amount', () => {
    const split = calculateBeezioSplit({
      items_subtotal: 100,
      shipping_amount: 0,
      tax_amount: 0,
      affiliate_id: 'a',
      referrer_id: null,
      isFundraiser: false,
      affiliate_rate: 0.1,
    });

    expect(split.validation_ok).toBe(true);
    expect(split.affiliate_amount).toBe(10);
    expect(split.beezio_kept_amount).toBe(15);
    expect(split.seller_net_items_amount).toBe(75);
  });

  it('referrer only splits Beezio fee (10% Beezio, 5% referrer)', () => {
    const split = calculateBeezioSplit({
      items_subtotal: 100,
      shipping_amount: 0,
      tax_amount: 0,
      affiliate_id: null,
      referrer_id: 'r',
      isFundraiser: false,
      affiliate_rate: 0.25,
    });

    expect(split.validation_ok).toBe(true);
    expect(split.referrer_amount).toBe(5);
    expect(split.beezio_kept_amount).toBe(10);
    expect(split.seller_net_items_amount).toBe(85);
  });

  it('fundraiser path still allocates the 5% override amount', () => {
    const split = calculateBeezioSplit({
      items_subtotal: 100,
      shipping_amount: 0,
      tax_amount: 0,
      affiliate_id: null,
      referrer_id: 'r',
      isFundraiser: true,
      affiliate_rate: 0.25,
    });

    expect(split.validation_ok).toBe(true);
    expect(split.referrer_amount).toBe(5);
    expect(split.beezio_kept_amount).toBe(10);
  });

  it('blocks if seller net would be negative', () => {
    const split = calculateBeezioSplit({
      items_subtotal: 10,
      shipping_amount: 0,
      tax_amount: 0,
      affiliate_id: 'a',
      referrer_id: null,
      isFundraiser: false,
      affiliate_rate: 1, // 100% commission (treated as fraction)
    });

    expect(split.validation_ok).toBe(false);
    expect(split.validation_reason).toMatch(/negative/i);
  });
});
