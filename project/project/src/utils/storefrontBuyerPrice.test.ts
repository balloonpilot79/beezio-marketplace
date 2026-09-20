import { describe, expect, it } from 'vitest';
import { applyCanonicalProductPricing, applyStorefrontProductPricing } from '../../shared/productPricing';
import { getBuyerFacingProductPrice } from './buyerPrice';

describe('public storefront buyer prices', () => {
  const product = {
    id: 'published-product',
    title: 'Published product',
    price: 41.25,
    calculated_customer_price: 51.67,
    seller_ask: 30,
    affiliate_commission_type: 'flat' as const,
    affiliate_commission_value: 5,
    shipping_reserve_amount: 10,
  };

  it('keeps the same published price across marketplace, storefront cards, and cart input', () => {
    const storefrontProduct = applyStorefrontProductPricing(product);
    expect(storefrontProduct.price).toBe(51.67);
    expect(getBuyerFacingProductPrice(storefrontProduct)).toBe(getBuyerFacingProductPrice(product));
  });

  it('does not overwrite seller payout, commission, shipping, or product data', () => {
    const original = { ...product };
    expect(applyStorefrontProductPricing(product)).toEqual({ ...product, price: 51.67 });
    expect(product).toEqual(original);
  });

  it.each([undefined, null, 0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    'retains legacy pricing fallback when the published price is %s',
    (storedPrice) => {
      const legacyProduct = { ...product, calculated_customer_price: storedPrice };
      expect(applyStorefrontProductPricing(legacyProduct)).toEqual(applyCanonicalProductPricing(legacyProduct));
    },
  );
});
