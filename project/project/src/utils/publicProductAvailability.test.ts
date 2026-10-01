import { describe, expect, it } from 'vitest';
import { isPublicStoreProduct, isPublicAffiliateProduct, productAvailabilityNotice } from '../../shared/publicProductVisibility';
import { buildSellerStorefrontProducts } from './storefrontProducts';
const live = { id: 'product', is_active: true, status: 'active', is_promotable: true, affiliate_enabled: true, stock_quantity: 3 };
describe('platform product availability', () => {
  it.each([{ stock_quantity: 0 }, { stock_quantity: '0' }, { stock_quantity: -1 }, { stock_quantity: null, total_inventory: 0 }, { in_stock: false }])('hides sold-out items and retains a private notice: %j', (override) => {
    const product = { ...live, ...override };
    expect(isPublicStoreProduct(product)).toBe(false);
    expect(isPublicAffiliateProduct(product)).toBe(false);
    expect(productAvailabilityNotice(product)).toBe('Sold out — hidden from all stores');
  });
  it.each([{ is_active: false }, { status: 'archived' }, { status: 'draft' }, { status: 'inactive' }, { status: 'removed' }])('stale promotion flags cannot revive withdrawn items: %j', (override) => {
    const product = { ...live, ...override };
    expect(isPublicStoreProduct(product)).toBe(false);
    expect(isPublicAffiliateProduct(product)).toBe(false);
    expect(productAvailabilityNotice(product)).toBe('Withdrawn — hidden from all stores');
  });
  it('restocks without losing affiliate placements', () => {
    const sold = { ...live, stock_quantity: 0 };
    expect(buildSellerStorefrontProducts({ sellerOwnedProducts: [], curatedProducts: [sold], orderEntries: [] })).toEqual([]);
    expect(buildSellerStorefrontProducts({ sellerOwnedProducts: [], curatedProducts: [{ ...sold, stock_quantity: 2 }], orderEntries: [] })).toHaveLength(1);
  });
  it('allows store-only items in the owner store but excludes affiliate stores', () => {
    const product = { ...live, status: 'store_only', affiliate_enabled: false };
    expect(isPublicStoreProduct(product)).toBe(true);
    expect(isPublicAffiliateProduct(product)).toBe(false);
    expect(buildSellerStorefrontProducts({ sellerOwnedProducts: [], curatedProducts: [product], orderEntries: [] })).toEqual([]);
  });
  it('allows untracked and legacy stock but honors explicit sold-out flags', () => {
    expect(isPublicStoreProduct({ ...live, stock_quantity: 0, track_inventory: false })).toBe(true);
    expect(isPublicStoreProduct({ id: 'legacy' })).toBe(true);
    expect(isPublicStoreProduct({ ...live, stock_quantity: 0, track_inventory: false, in_stock: false })).toBe(false);
  });
});
