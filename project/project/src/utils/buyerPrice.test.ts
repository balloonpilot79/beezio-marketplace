import { describe, expect, it } from 'vitest';
import { getBuyerFacingProductPrice } from './buyerPrice';
import { calculateSalePriceFromSellerAsk } from './pricing';

describe('getBuyerFacingProductPrice', () => {
  it('uses calculated_customer_price as the canonical buyer price when present', () => {
    const product = {
      price: 42,
      calculated_customer_price: 61.34,
      seller_ask: 42,
      commission_rate: 8,
      commission_type: 'flat_rate',
      affiliate_commission_type: 'flat' as const,
      affiliate_commission_value: 8,
      flat_commission_amount: 8,
    };

    expect(getBuyerFacingProductPrice(product)).toBe(61.34);
  });

  it('derives the same buyer-facing price from seller ask data used by marketplace and product detail views', () => {
    const product = {
      price: 0,
      seller_ask: 100,
      commission_rate: 20,
      commission_type: 'percentage' as const,
      affiliate_commission_type: 'percent' as const,
      affiliate_commission_value: 20,
    };

    expect(getBuyerFacingProductPrice(product)).toBe(calculateSalePriceFromSellerAsk(100, 20, 'percent'));
  });

  it('trusts the stored final buyer-facing price when it is already saved on the product', () => {
    const product = {
      price: 19.31,
      seller_ask: 19.99,
      commission_rate: 20,
      commission_type: 'percentage' as const,
      affiliate_commission_type: 'percent' as const,
      affiliate_commission_value: 20,
    };

    expect(getBuyerFacingProductPrice(product)).toBe(19.31);
  });
});
