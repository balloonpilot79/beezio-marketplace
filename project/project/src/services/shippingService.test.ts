import { describe, expect, it } from 'vitest';
import { normalizeProductOption } from './shippingService';

describe('separate checkout shipping', () => {
  it('uses the seller shipping cost without including it twice', () => {
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

    expect(option.methodName).toBe('Standard shipping');
    expect(option.methodCode).toBe('standard-shipping');
    expect(option.cost).toBe(9.99);
  });
});
