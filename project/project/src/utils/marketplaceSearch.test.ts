import { describe, expect, it } from 'vitest';
import { matchesMarketplaceSearch } from './marketplaceSearch';

describe('marketplace product search', () => {
  const shirt = { title: 'Shelf Cloud Social Club — Storm Chaser Softstyle T-Shirt', description: 'Independent apparel', derivedCategory: 'Clothing' };
  it('finds a live catalog title, partial title, and category', () => {
    for (const query of [shirt.title, 'shirt', 'clothing', '  SHIRT  ', 't shirt', 'storm   shirt', 'shirt storm']) {
      expect(matchesMarketplaceSearch(shirt, query), query).toBe(true);
    }
  });
  it('finds words across title and description', () => {
    expect(matchesMarketplaceSearch(shirt, 'storm apparel')).toBe(true);
    expect(matchesMarketplaceSearch(shirt, 'storm necklace')).toBe(false);
  });
  it('finds digital products through the derived category and accented titles', () => {
    const download = { title: 'Café planner', description: 'Printable PDF', derivedCategory: 'Digital Products' };
    expect(matchesMarketplaceSearch(download, 'digital planner')).toBe(true);
    expect(matchesMarketplaceSearch(download, 'cafe pdf')).toBe(true);
  });
  it('handles empty searches and missing fields', () => {
    expect(matchesMarketplaceSearch({}, '  ')).toBe(true);
    expect(matchesMarketplaceSearch({}, 'shirt')).toBe(false);
  });
});
