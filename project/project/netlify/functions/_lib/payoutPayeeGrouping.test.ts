import { describe, expect, it } from 'vitest';
import { groupOrderPayeeCredits } from './payoutPayeeGrouping';

describe('groupOrderPayeeCredits', () => {
  it('combines shopper and seller referral rewards for the same person and preserves other payees and orders', () => {
    const seller = { orderId: 'one', userId: 'seller', role: 'SELLER', amount: 60, orderMoneyLedgerId: 'seller-credit' };
    const affiliate = { orderId: 'one', userId: 'affiliate', role: 'PARTNER', amount: 12, orderMoneyLedgerId: 'affiliate-credit' };
    const sellerReferral = { orderId: 'one', userId: 'ambassador', role: 'INFLUENCER', amount: 1.5, orderMoneyLedgerId: 'seller-referral' };
    const shopperReferral = { ...sellerReferral, amount: 0.75, orderMoneyLedgerId: 'shopper-referral' };
    const affiliateReferral = { ...sellerReferral, userId: 'other-ambassador', amount: 1.5, orderMoneyLedgerId: 'affiliate-referral' };
    const secondOrder = { ...shopperReferral, orderId: 'two', orderMoneyLedgerId: 'second-order-referral' };

    expect(groupOrderPayeeCredits([seller, affiliate, sellerReferral, shopperReferral, affiliateReferral, secondOrder])).toEqual([
      seller, affiliate, { ...sellerReferral, amount: 2.25, orderMoneyLedgerId: null }, affiliateReferral, secondOrder,
    ]);
  });
});
