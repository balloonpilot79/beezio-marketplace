import { describe, expect, it } from 'vitest';
import { earningsBreakdown } from './earningsBreakdown';

describe('recorded earnings breakdown', () => {
  it('reconciles the $1 digital purchase without counting platform fee twice', () => {
    const result = earningsBreakdown({ total_charged: 1, tax_amount: .07, paypal_fee_estimate: .32,
      beezio_operating_profit: .41, platform_fee_gross_total: .05,
      payee_breakdown: { seller_payable_amount: .2, partner_amount: 0 } });
    expect(result?.reconciles).toBe(true);
    expect(result?.platformFee).toBe(.05);
    expect(result?.lines.reduce((sum, line) => sum + line.amount, 0)).toBeCloseTo(1);
  });
  it('uses total rewards instead of the individual payee reward in a shared snapshot', () => {
    const result = earningsBreakdown({ total_charged: 10, influencer_bonus_paid_total: 1, buyer_referral_total: .25,
      beezio_operating_profit: 1.75, paypal_fee_estimate: 1, tax_amount: 1,
      payee_breakdown: { seller_payable_amount: 4, partner_amount: 1, influencer_amount: .5 } });
    expect(result?.reconciles).toBe(true);
    expect(result?.lines[2].amount).toBe(1.25);
  });
  it('counts a seller self-sale affiliate commission once in the actual $1 allocation', () => {
    const result = earningsBreakdown({ total_charged: 1, tax_amount: .07, paypal_fee_estimate: .32,
      beezio_operating_profit: .41, platform_fee_gross_total: .05,
      affiliate_payout_paid_total: .1, affiliate_payout_paid_to_seller_total: .1,
      payee_breakdown: { seller_amount: .1, seller_payable_amount: .2, partner_amount: .1 } });
    expect(result?.reconciles).toBe(true);
    expect(result?.lines[0].amount).toBe(.1);
    expect(result?.lines[1].amount).toBe(.1);
  });
  it('does not invent historical breakdowns', () => {
    expect(earningsBreakdown({})).toBeNull();
    expect(earningsBreakdown({ total_charged: 1, payee_breakdown: {} })?.reconciles).toBe(false);
  });
});
