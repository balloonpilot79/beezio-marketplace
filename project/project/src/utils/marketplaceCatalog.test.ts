import { afterEach, describe, it, expect, vi } from 'vitest';
import { fetchMarketplaceCatalog } from './marketplaceCatalog';
afterEach(() => vi.unstubAllGlobals());
describe('complete marketplace catalog', () => {
  it('includes products past 500, handles empty filtered pages and deduplicates', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      const offset = Number(new URL(url, 'https://beezio.co').searchParams.get('offset'));
      const products = offset === 160 ? [] : Array.from({length: 160}, (_, i) => ({id: String(offset+i)}));
      return { ok: true, json: async () => ({ products, next_offset: offset < 640 ? offset + 160 : null }) };
    });
    vi.stubGlobal('fetch', fetchMock);
    const products = await fetchMarketplaceCatalog(new AbortController().signal);
    expect(products.some(p => p.id === '799')).toBe(true);
    expect(products.length).toBe(640);
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });
  it('rejects later page failures instead of silently hiding older products', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => ({
      ok: !url.includes('offset=160'), status: 503,
      json: async () => ({products: [{id: 'first'}], next_offset: 160}),
    })));
    await expect(fetchMarketplaceCatalog(new AbortController().signal)).rejects.toThrow('503');
  });
  it('rejects a non-advancing cursor', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ok: true, json: async () => ({products: [], next_offset: 0})})));
    await expect(fetchMarketplaceCatalog(new AbortController().signal)).rejects.toThrow('pagination');
  });
});
