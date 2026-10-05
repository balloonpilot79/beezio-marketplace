import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getBuyerFacingProductPrice } from '../../src/utils/buyerPrice';

const state = vi.hoisted(() => ({ product: {} as any }));
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: (table: string) => {
      const query: any = {
        select: () => query,
        eq: () => query,
        maybeSingle: async () => ({ data: table === 'products' ? state.product : null, error: null }),
        limit: async () => ({ data: [], error: null }),
      };
      return query;
    },
  }),
}));
import { handler } from '../../netlify/functions/public-product-get';

describe('public product details', () => {
  beforeEach(() => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-only';
    state.product = {
      id: '30e51467-eb3a-4c49-a4e0-4aa88776d97f',
      title: 'Loving Nutrition Beetroot',
      is_active: true, status: 'active', seller_id: 'seller',
      price: 30.31, calculated_customer_price: 30.31, seller_ask: 15,
      flat_commission_amount: 5, affiliate_commission_type: 'flat',
      shipping_reserve_amount: 4.5,
    };
  });
  it('separates shipping from the displayed and cart price while preserving the stored total', async () => {
    const result: any = await handler({ queryStringParameters: { id: state.product.id } } as any, {} as any, () => {});
    const body = JSON.parse(result.body);
    expect(result.statusCode).toBe(200);
    expect(body.product.price).toBe(30.31);
    expect(getBuyerFacingProductPrice(body.product)).toBe(25.81);
    expect(body.product.shipping_reserve_amount).toBe(4.5);
    expect(body.product.shipping_options[0].cost).toBe(4.5);
  });
  it('rejects the known test item even if accidentally reactivated', async () => {
    state.product.id = '721f1a14-645b-4aee-97b2-ec9ae780eeca';
    const result: any = await handler({ queryStringParameters: { id: state.product.id } } as any, {} as any, () => {});
    expect(result.statusCode).toBe(404);
  });
  it.each([{ stock_quantity: 0 }, { in_stock: false }, { is_active: false, is_promotable: true }, { status: 'inactive', is_promotable: true }, { status: 'archived', is_active: true }])('direct links cannot expose unavailable items: %j', async (override) => {
    Object.assign(state.product, override);
    const result: any = await handler({ queryStringParameters: { id: state.product.id } } as any, {} as any, () => {});
    expect(result.statusCode).toBe(404);
    expect(JSON.parse(result.body).product).toBeUndefined();
    expect(result.headers['Cache-Control']).toBe('no-store');
  });

});
