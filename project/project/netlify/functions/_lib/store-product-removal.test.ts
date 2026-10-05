import { describe, expect, it, vi } from 'vitest';
import { removeStoreProducts } from './store-product-removal';

function memoryDb(failureTable?: string) {
  const rows: Record<string, any[]> = {
    storefronts: [{ id: 'mine', owner_id: 'profile' }, { id: 'other', owner_id: 'another-user' }],
    storefront_products: [{ storefront_id: 'mine', product_id: 'remove' }, { storefront_id: 'other', product_id: 'remove' }, { storefront_id: 'mine', product_id: 'keep' }],
    affiliate_products: [{ affiliate_id: 'profile', product_id: 'remove' }, { affiliate_id: 'auth-user', product_id: 'remove' }, { affiliate_id: 'another-user', product_id: 'remove' }],
    seller_product_order: [{ seller_id: 'profile', product_id: 'remove' }, { seller_id: 'another-user', product_id: 'remove' }],
  };
  const db = { from: vi.fn((table: string) => {
    let deleting = false;
    const filters: [string, string[]][] = [];
    const query: any = {
      select: () => query,
      delete: () => { deleting = true; return query; },
      in: (column: string, ids: string[]) => { filters.push([column, ids]); return query; },
      then: (resolve: any, reject: any) => {
        if (table === failureTable) return Promise.resolve({ error: { message: 'Database unavailable' } }).then(resolve, reject);
        const matches = (row: any) => filters.every(([column, ids]) => ids.includes(row[column]));
        const data = rows[table].filter(matches);
        if (deleting) rows[table] = rows[table].filter((row) => !matches(row));
        return Promise.resolve({ data, error: null }).then(resolve, reject);
      },
    };
    return query;
  }) };
  return { db, rows };
}

describe('store product removal', () => {
  it('removes the dedicated placement and every owned affiliate alias, preserving other users and products', async () => {
    const { db, rows } = memoryDb();
    await removeStoreProducts(db, ['auth-user', 'profile'], ['remove'], 'affiliate');
    expect(rows.storefront_products).toEqual([{ storefront_id: 'other', product_id: 'remove' }, { storefront_id: 'mine', product_id: 'keep' }]);
    expect(rows.affiliate_products).toEqual([{ affiliate_id: 'another-user', product_id: 'remove' }]);
    expect(rows.seller_product_order).toHaveLength(2);
    expect(db.from).not.toHaveBeenCalledWith('products');
  });
  it('also removes seller storefront selections and supports repeat removal', async () => {
    const { db, rows } = memoryDb();
    await removeStoreProducts(db, ['profile'], ['remove'], 'seller');
    await removeStoreProducts(db, ['profile'], ['remove'], 'seller');
    expect(rows.seller_product_order).toEqual([{ seller_id: 'another-user', product_id: 'remove' }]);
    expect(rows.affiliate_products).toHaveLength(3);
  });
  it('reports failed placement deletion instead of reporting success', async () => {
    const { db, rows } = memoryDb('storefront_products');
    await expect(removeStoreProducts(db, ['profile'], ['remove'], 'affiliate')).rejects.toThrow('Database unavailable');
    expect(rows.affiliate_products).toHaveLength(3);
  });
  it('refuses unscoped removal', async () => {
    const { db } = memoryDb();
    await expect(removeStoreProducts(db, [], ['remove'], 'affiliate')).rejects.toThrow('Missing removal scope');
    expect(db.from).not.toHaveBeenCalled();
  });
});
