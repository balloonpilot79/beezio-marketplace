import { describe, expect, it, vi } from 'vitest';
import { loadPayPalCaptureOrder } from './paypal-capture-order-record';

describe('capture order lookup', () => {
  it('loads a saved order with the production customer schema before capture', async () => {
    const fields = new Set('id,buyer_id,customer_email,seller_id,partner_id,influencer_id,currency,subtotal_listing,shipping_amount,tax_amount,total_charged,shipping_address,status,payment_status,provider_capture_id,paid_at'.split(','));
    const select = vi.fn((columns: string) => ({ eq: (key: string, value: string) => ({ maybeSingle: async () => {
      expect(key).toBe('provider_order_id');
      expect(value).toBe('existing-payment');
      const missing = columns.split(',').find(column => !fields.has(column));
      return missing ? { data: null, error: { message: `column orders.${missing} does not exist` } } : { data: { id: 'saved-order', customer_email: 'buyer@example.com' }, error: null };
    } }) }));
    const result = await loadPayPalCaptureOrder({ from: () => ({ select }) }, 'existing-payment');
    expect(result.error).toBeNull();
    expect(result.data.id).toBe('saved-order');
    expect(result.data.customer_email).toBe('buyer@example.com');
  });
});
