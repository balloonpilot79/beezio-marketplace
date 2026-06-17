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
    expect(split.beezio_fee_amount).toBe(17);
    expect(split.referral_fee_amount).toBe(0);
    expect(split.affiliate_commission_amount).toBe(0);
    expect(split.seller_net_items_amount).toBe(100);
    expect(split.seller_total_transfer_amount).toBe(110);
    expect(split.referrer_amount).toBe(0);
    expect(split.beezio_kept_amount).toBe(17);
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
    expect(split.beezio_kept_amount).toBe(17);
    expect(split.seller_net_items_amount).toBe(100);
  });

  it('referrer only (no affiliate) still leaves the reserve with Beezio', () => {
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
    expect(split.referrer_amount).toBe(0);
    expect(split.beezio_kept_amount).toBe(17);
    expect(split.seller_net_items_amount).toBe(100);
  });

  it('referrer path applies the flat referrer bonus when affiliate exists', () => {
    const split = calculateBeezioSplit({
      items_subtotal: 100,
      shipping_amount: 0,
      tax_amount: 0,
      affiliate_id: 'a',
      referrer_id: 'r',
      isFundraiser: false,
      affiliate_rate: 0.25,
    });

    expect(split.validation_ok).toBe(true);
    expect(split.referrer_amount).toBe(1);
    expect(split.beezio_kept_amount).toBe(16);
  });

  it('handles high affiliate rates without reducing seller ask', () => {
    const split = calculateBeezioSplit({
      items_subtotal: 10,
      shipping_amount: 0,
      tax_amount: 0,
      affiliate_id: 'a',
      referrer_id: null,
      isFundraiser: false,
      affiliate_rate: 1, // 100% commission (treated as fraction)
    });

    expect(split.validation_ok).toBe(true);
    expect(split.seller_net_items_amount).toBe(10);
  });
});
