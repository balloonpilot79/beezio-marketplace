import { describe, expect, it } from 'vitest';
import { buildSellerStorefrontProducts } from './storefrontProducts';

describe('buildSellerStorefrontProducts', () => {
  it('includes seller-owned products even when curated list exists', () => {
    const sellerOwnedProducts = [
      { id: 'own-1', created_at: '2026-01-01T00:00:00Z', title: 'Own 1' },
      { id: 'own-2', created_at: '2026-01-02T00:00:00Z', title: 'Own 2' },
    ];
    const curatedProducts = [{ id: 'mk-1', created_at: '2025-12-31T00:00:00Z', title: 'Market 1' }];
    const orderEntries = [{ product_id: 'mk-1', display_order: 0, is_featured: false }];

    const result = buildSellerStorefrontProducts({
      sellerOwnedProducts,
      curatedProducts,
      orderEntries,
    });

    const ids = result.map((p) => p.id);
    expect(ids).toEqual(expect.arrayContaining(['own-1', 'own-2', 'mk-1']));
  });

  it('dedupes by id and applies featured + display_order sorting', () => {
    const sellerOwnedProducts = [{ id: 'p1', created_at: '2026-01-01T00:00:00Z' }];
    const curatedProducts = [
      { id: 'p1', created_at: '2026-01-03T00:00:00Z' },
      { id: 'p2', created_at: '2026-01-02T00:00:00Z' },
      { id: 'p3', created_at: '2026-01-04T00:00:00Z' },
    ];
    const orderEntries = [
      { product_id: 'p2', display_order: 5, is_featured: true },
      { product_id: 'p3', display_order: 1, is_featured: false },
    ];

    const result = buildSellerStorefrontProducts({
      sellerOwnedProducts,
      curatedProducts,
      orderEntries,
    });

    // Featured first
    expect(result[0].id).toBe('p2');
    // Next lowest display_order
    expect(result[1].id).toBe('p3');
    // Remaining (p1) has default display_order=999 and sorts by created_at
    expect(result.map((p) => p.id)).toEqual(expect.arrayContaining(['p1']));

    const p1 = result.find((p) => p.id === 'p1');
    expect(p1?.display_order).toBe(999);
  });
});
