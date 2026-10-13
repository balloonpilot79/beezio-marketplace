import { describe, expect, it } from 'vitest';
import { getOwnedProductStorefront, getPublicSellerName } from './publicSellerIdentity';
import { buildPublicStoreDirectory } from './publicStoreDirectory';

describe('public seller identity', () => {
  it('uses the seller business name consistently instead of their personal name', () => {
    expect(getPublicSellerName('Jason Loving', { store_name: 'MareBelle' })).toBe('MareBelle');
    expect(getPublicSellerName('Independent Seller', null)).toBe('Independent Seller');
  });
  it('never labels an external seller as the brand promoting their product', () => {
    const stores = [{ owner_id: 'promoter', slug: 'marebelle', name: 'MareBelle' }];
    const owned = getOwnedProductStorefront(stores, 'actual-seller');
    expect(owned).toBeNull();
    expect(getPublicSellerName('Actual Seller', { store_name: 'Actual Shop' }, owned)).toBe('Actual Shop');
  });
  it('retains branding for a product in its seller-owned brand store', () => {
    const store = { owner_id: 'seller', slug: 'marebelle', name: 'Old name' };
    expect(getPublicSellerName('Jason', null, getOwnedProductStorefront([store], 'seller'))).toBe('MareBelle');
  });
});

describe('public store discovery', () => {
  const product = { id: 'shirt', seller_id: 'seller', is_active: true, is_promotable: true, affiliate_enabled: true, status: 'active', images: ['/shirt.png'] };
  it('lists live brand and affiliate stores, without leaking private settings', () => {
    const settings = new Map([['seller', { subdomain: 'own-shop', store_name: 'Own Shop', email: 'private@example.com', payout_email: 'secret@example.com' }]]);
    const result = buildPublicStoreDirectory([product], settings, new Map(), [{ subdomain: 'affiliate-shop', store_name: 'Affiliate Shop', productIds: ['shirt'] }]);
    expect(result.map(store => store.slug)).toEqual(['own-shop', 'affiliate-shop']);
    expect(JSON.stringify(result)).not.toContain('example.com');
    expect(Object.keys(result[0]).sort()).toEqual(['image', 'name', 'productCount', 'slug']);
  });
  it('excludes hidden tests, withdrawn products, sold-out products and empty stores', () => {
    const products = [ { ...product, id: '721f1a14-645b-4aee-97b2-ec9ae780eeca' }, { ...product, id: 'withdrawn', is_active: false }, { ...product, id: 'sold-out', in_stock: false } ];
    expect(buildPublicStoreDirectory(products, new Map([['seller', { subdomain: 'own-shop' }]]), new Map(), [{ subdomain: 'empty-shop', productIds: ['missing'] }])).toEqual([]);
  });
  it('counts each live brand product once and ignores unsafe store paths', () => {
    const store = { slug: 'marebelle', name: 'MareBelle', owner_id: 'seller', is_active: true };
    const stores = buildPublicStoreDirectory([product, product], new Map([['seller', { subdomain: 'marebelle' }]]), new Map([['shirt', [store, store, { slug: '../admin' }]]]));
    expect(stores).toEqual([{ slug: 'marebelle', name: 'MareBelle', image: '/shirt.png', productCount: 1 }]);
  });
});
