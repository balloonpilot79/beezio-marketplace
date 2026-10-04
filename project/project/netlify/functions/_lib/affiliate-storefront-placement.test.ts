import { describe, expect, it, vi } from 'vitest';
import { ensureAffiliateStorefrontPlacement } from './affiliate-storefront-placement';
function mockDb(results: any[]) {
  const filters: any[] = [], inserts: any[] = [];
  const db = { from: vi.fn((table: string) => {
    const result = results.shift();
    const query: any = { select: () => query, eq: (key: string, value: string) => { filters.push([table,key,value]); return query; }, maybeSingle: () => Promise.resolve(result), limit: () => Promise.resolve(result), insert: (value: any) => { inserts.push(value); return Promise.resolve(result); } };
    return query;
  }) };
  return { db, filters, inserts };
}
describe('affiliate placement in a dedicated storefront', () => {
  it('adds to the configured storefront owned by the affiliate', async () => {
    const { db, filters, inserts } = mockDb([{data:{subdomain:'MareBelle'}},{data:{id:'store'}},{data:[]},{}]);
    await ensureAffiliateStorefrontPlacement(db, 'affiliate', 'product');
    expect(filters).toContainEqual(['storefronts','owner_id','affiliate']);
    expect(filters).toContainEqual(['storefronts','slug','marebelle']);
    expect(inserts).toEqual([{storefront_id:'store',product_id:'product',position:0,placement_source:'affiliate',source_owner_id:'affiliate'}]);
  });
  it('preserves an existing placement when adding again', async () => {
    const { db, inserts } = mockDb([{data:{subdomain:'marebelle'}},{data:{id:'store'}},{data:[{id:'placement'}]}]);
    await ensureAffiliateStorefrontPlacement(db, 'affiliate', 'product');
    expect(inserts).toEqual([]);
  });
  it('does not place products in another owners storefront', async () => {
    const { db, inserts } = mockDb([{data:{subdomain:'marebelle'}},{data:null}]);
    await ensureAffiliateStorefrontPlacement(db, 'other-affiliate', 'product');
    expect(inserts).toEqual([]);
  });
  it('reports a placement failure instead of claiming success', async () => {
    const { db } = mockDb([{data:{subdomain:'marebelle'}},{data:{id:'store'}},{data:[]},{error:{message:'write failed'}}]);
    await expect(ensureAffiliateStorefrontPlacement(db,'affiliate','product')).rejects.toThrow('write failed');
  });
});
