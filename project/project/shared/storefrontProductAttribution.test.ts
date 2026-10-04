import { describe, expect, it } from 'vitest';
import { isSellerStorefrontSale, storefrontProductAttribution } from './storefrontProductAttribution';

describe('storefront purchase provenance', () => {
  it('credits the affiliate portion to the seller in their own store, regardless of buyer identity', () => {
    expect(isSellerStorefrontSale('seller', 'store', 'seller')).toBe(true);
    expect(isSellerStorefrontSale('seller', 'marebelle', 'affiliate')).toBe(false);
    expect(isSellerStorefrontSale('seller', null, 'seller')).toBe(false);
  });
  const placement = { product_id: 'product', placement_source: 'affiliate', source_owner_id: 'affiliate' };
  const product = { id: 'product', seller_id: 'seller' };
  it.each(['seller', 'affiliate'])('credits a verified affiliate placement in a %s layout', type => {
    expect(storefrontProductAttribution({ id: 'store', owner_id: 'affiliate', type }, placement, product)).toEqual({
      affiliate_id: 'affiliate', storefront_id: 'store', storefront_scope: `store:${type}:store`,
    });
  });
  it('never guesses affiliate ownership from a product or another placement', () => {
    const store = { id: 'store', owner_id: 'affiliate' };
    expect(storefrontProductAttribution(store, null, product)).toEqual({});
    expect(storefrontProductAttribution(store, { ...placement, product_id: 'other' }, product)).toEqual({});
    expect(storefrontProductAttribution(store, { ...placement, source_owner_id: 'other' }, product)).not.toHaveProperty('affiliate_id');
    expect(storefrontProductAttribution(store, placement, { ...product, affiliate_enabled: false })).not.toHaveProperty('affiliate_id');
    expect(storefrontProductAttribution({ ...store, owner_id: 'seller' }, { ...placement, source_owner_id: 'seller' }, product)).not.toHaveProperty('affiliate_id');
  });
});
