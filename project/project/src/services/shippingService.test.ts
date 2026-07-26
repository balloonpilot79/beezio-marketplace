import { describe, expect, it } from 'vitest';
import { normalizeProductOption } from './shippingService';

describe('sitewide free-shipping policy', () => {
  it('turns a legacy paid shipping option into free checkout shipping', () => {
    const option = normalizeProductOption({
      id: 'legacy-product',
      requires_shipping: true,
      is_digital: false,
      shipping_price: 9.99,
      shipping_cost: 9.99,
      shipping_options: [
        { name: 'Seller Shipping', cost: 9.99, estimated_days: '3-5 business days' },
      ],
    });

    expect(option.methodName).toBe('Free Shipping');
    expect(option.methodCode).toBe('free-shipping');
    expect(option.cost).toBe(0);
  });
});
