import { beforeEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ tables: {} as Record<string, any[]>, mutate: vi.fn() }));
vi.mock('../../netlify/functions/_lib/auth', () => ({
  requireSellerOrAdmin: async () => ({ profileId: 'seller' }),
  requireAdmin: async () => ({ profileId: 'seller' }),
}));
vi.mock('../../netlify/functions/_lib/supabase', () => ({ createSupabaseAdmin: () => ({
  from(table: string) {
    const filters: Array<(row: any) => boolean> = [];
    const result = () => ({ data: (state.tables[table] || []).filter(row => filters.every(filter => filter(row))), error: null });
    const query: any = {
      select: () => query, order: () => query, limit: () => query, or: () => query,
      eq: (field: string, value: any) => { filters.push(row => row[field] === value); return query; },
      in: (field: string, values: any[]) => { filters.push(row => values.includes(row[field])); return query; },
      maybeSingle: async () => ({ data: result().data[0] || null, error: null }),
      then: (resolve: any) => Promise.resolve(result()).then(resolve),
      update: state.mutate, insert: state.mutate,
    };
    return query;
  },
}) }));
import { handler } from '../../netlify/functions/manual-fulfillment-queue';

beforeEach(() => {
  state.mutate.mockReset();
  const item = { id: 'digital-item', order_id: 'order', product_id: 'digital-product', quantity: 1 };
  state.tables = {
    profiles: [{ id: 'seller', user_id: 'seller' }],
    orders: [{ id: 'order', seller_id: 'seller', fulfillment_method: 'shipping', payment_status: 'paid', status: 'completed', order_items: [item] }],
    order_items: [item],
    products: [{ id: 'digital-product', is_digital: true, title: 'Digital download' }],
    digital_download_entitlements: [{ order_id: 'order', order_item_id: 'digital-item', access_status: 'active', download_count: 1, download_limit: 5, first_access_at: '2026-11-17T17:30:13Z' }],
  };
});
const request = (body: any) => handler({ httpMethod: 'POST', headers: {}, body: JSON.stringify({ scope: 'seller', ...body }) } as any, {} as any, () => {});

describe('digital orders in seller fulfillment', () => {
  it('classifies a paid legacy shipping-default order by its actual download entitlement', async () => {
    const response: any = await request({ action: 'list' });
    expect(response.statusCode).toBe(200);
    const payload = JSON.parse(response.body);
    expect(payload.summary).toMatchObject({ needsOrdering: 0, ordered: 0, shipped: 0, digital: 1 });
    expect(payload.items[0]).toMatchObject({ fulfillmentMethod: 'digital', items: [{ isDigital: true, digitalDeliveryStatus: 'Downloaded', downloadCount: 1 }] });
  });
  it.each(['mark_shipped', 'mark_ordered'])('blocks %s without changing any order or vendor records', async action => {
    const response: any = await request({ action, orderId: 'order', trackingNumber: 'fake-tracking' });
    expect(response.statusCode).toBe(409);
    expect(response.body).toContain('delivered electronically');
    expect(state.mutate).not.toHaveBeenCalled();
  });
  it('keeps the physical portion of mixed orders in the shipment queue', async () => {
    state.tables.order_items.push({ id: 'physical-item', order_id: 'order', product_id: 'physical-product', quantity: 1 });
    state.tables.products.push({ id: 'physical-product', is_digital: false });
    const response: any = await request({ action: 'list' });
    const payload = JSON.parse(response.body);
    expect(payload.summary).toMatchObject({ needsOrdering: 1, digital: 0 });
    expect(payload.items[0].fulfillmentMethod).toBe('shipping');
  });
});
