import React from 'react';
import { act, create } from 'react-test-renderer';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MarketplacePage from './MarketplacePageDual';
const catalog = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock('../utils/marketplaceCatalog', () => ({ fetchMarketplaceCatalog: catalog.fetch }));
vi.mock('../contexts/AuthContextMultiRole', () => ({ useAuth: () => ({ user: null, profile: null, userRoles: [] }) }));
vi.mock('../lib/supabase', () => ({ supabase: { from: () => ({ select: () => ({ eq: () => ({ order: async () => ({ data: [] }) }) }) }) } }));
vi.mock('../components/ProductCard', () => ({ default: ({ product }: any) => <article>{product.title}</article> }));
vi.mock('../components/MarketplaceShelf', () => ({ default: () => null }));
const digital = { id: 'download', title: 'Printable shirt pattern', price: 10, is_digital: true,
  is_active: true, status: 'active', direct_marketplace_listing: true, affiliate_enabled: false, track_inventory: false };
const physical = { ...digital, id: 'shirt', title: 'Storm Chaser T-Shirt', is_digital: false };
beforeEach(() => {
  vi.stubGlobal('window', { setTimeout, clearTimeout });
  vi.stubGlobal('sessionStorage', { setItem: vi.fn() });
});
afterEach(() => vi.unstubAllGlobals());
describe('digital marketplace discovery', () => {
  it('finds the actual catalog seller name when it is absent from the product title', async () => {
    catalog.fetch.mockResolvedValue([
      { ...physical, profiles: { full_name: 'MareBelle' }, storefront_slug: 'marebelle' },
      { ...digital, profiles: { full_name: 'Other Store' } },
    ]);
    let view: any;
    await act(async () => { view = create(<MemoryRouter initialEntries={['/marketplace?q=MareBelle']}><MarketplacePage /></MemoryRouter>); });
    expect(view.root.findAllByType('article').map((row: any) => row.children.join(''))).toEqual([physical.title]);
    act(() => view.unmount());
  });
  it('keeps the Digital Products category available with an empty catalog', async () => {
    catalog.fetch.mockResolvedValue([]);
    let view: any;
    await act(async () => { view = create(<MemoryRouter initialEntries={['/marketplace?category=digital-products']}><MarketplacePage /></MemoryRouter>); });
    expect(JSON.stringify(view.toJSON())).toContain('Digital Products');
    expect(JSON.stringify(view.toJSON())).toContain('No digital downloads match these filters yet.');
    act(() => view.unmount());
  });
  it('shows eligible direct-listed downloads in Digital Products and excludes physical items', async () => {
    catalog.fetch.mockResolvedValue([digital, physical]);
    let view: any;
    await act(async () => { view = create(<MemoryRouter initialEntries={['/marketplace?category=digital-products']}><MarketplacePage /></MemoryRouter>); });
    expect(view.root.findAllByType('article').map((row: any) => row.children.join(''))).toEqual([digital.title]);
    act(() => view.unmount());
  });
  it('does not announce zero products while the catalog is still loading', async () => {
    catalog.fetch.mockReturnValue(new Promise(() => {}));
    let view: any;
    await act(async () => { view = create(<MemoryRouter><MarketplacePage /></MemoryRouter>); });
    expect(JSON.stringify(view.toJSON())).toContain('Loading products');
    expect(JSON.stringify(view.toJSON())).not.toContain('No products found.');
    act(() => view.unmount());
  });
});
