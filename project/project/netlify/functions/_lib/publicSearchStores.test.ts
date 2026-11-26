import { describe, expect, it } from 'vitest';
import { loadPublicSearchStores } from './publicSearchStores';

describe('public store directory', () => {
  it('requires a live listing owned by the store for Discover', async () => {
    const tables: Record<string, object[]> = {
      storefronts: [
        { id: 'house', owner_id: 'seller', slug: 'house-jewelry' },
        { id: 'peer', owner_id: 'seller', slug: 'same-owner-picks' },
      ],
      store_settings: [
        { seller_id: 'member-profile', subdomain: 'member-shop' },
        { seller_id: 'empty', subdomain: 'empty-shop' },
      ],
      affiliate_store_settings: [{ affiliate_id: 'promoter', subdomain: 'promoter-shop' }],
      profiles: [{ id: 'member-profile', user_id: 'member-auth' }],
      products: [
        { id: 'jewelry', seller_id: 'seller', status: 'active', is_active: true, track_inventory: false },
        { id: 'shirt', seller_id: 'member-auth', status: 'active', is_active: true, track_inventory: false },
        { id: 'draft', seller_id: 'empty', status: 'draft', is_active: false },
      ],
      storefront_products: [
        { storefront_id: 'house', product_id: 'jewelry', placement_source: 'manual' },
        { storefront_id: 'peer', product_id: 'jewelry', placement_source: 'affiliate' },
      ],
      seller_product_order: [{ seller_id: 'empty', product_id: 'jewelry' }],
      affiliate_products: [{ affiliate_id: 'promoter', product_id: 'jewelry', is_active: true }],
    };
    const db = {
      from: (table: string) => ({
        select: () => ({ order: () => ({ range: async () => ({ data: tables[table] }) }) }),
      }),
    };

    const discover = await loadPublicSearchStores(db, { ownListingsOnly: true });
    expect(discover.map(store => store.slug)).toEqual(['house-jewelry', 'member-shop']);

    const sitemap = await loadPublicSearchStores(db);
    expect(sitemap.map(store => store.slug)).toContain('promoter-shop');
  });
});
