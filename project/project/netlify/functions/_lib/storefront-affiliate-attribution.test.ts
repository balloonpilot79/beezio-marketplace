import { describe, expect, it } from 'vitest';
import { resolvePlacedStorefrontAffiliate } from './storefront-affiliate-attribution';

const database = (placements: any[], owner = 'affiliate') => ({
  from: (table: string) => {
    const result = { data: table === 'storefronts' ? { owner_id: owner } : placements, error: null };
    const query: any = { select: () => query, eq: () => query, in: async () => result, maybeSingle: async () => result };
    return query;
  },
});

describe('curated storefront attribution', () => {
  it('credits the saved affiliate placement regardless of store layout', async () => {
    expect(await resolvePlacedStorefrontAffiliate(database([{ product_id: 'shirt', placement_source: 'affiliate', source_owner_id: 'affiliate' }]), 'store', ['shirt'], 'seller')).toBe('affiliate');
  });
  it('requires every purchased product to have that owner’s affiliate placement', async () => {
    expect(await resolvePlacedStorefrontAffiliate(database([{ product_id: 'shirt', placement_source: 'affiliate', source_owner_id: 'affiliate' }]), 'store', ['shirt', 'other'], 'seller')).toBeNull();
    expect(await resolvePlacedStorefrontAffiliate(database([{ product_id: 'shirt', placement_source: 'affiliate', source_owner_id: 'other' }]), 'store', ['shirt'], 'seller')).toBeNull();
  });
  it('does not assign affiliate credit to a seller’s own store', async () => {
    expect(await resolvePlacedStorefrontAffiliate(database([], 'seller'), 'store', ['shirt'], 'seller')).toBeNull();
  });
});
