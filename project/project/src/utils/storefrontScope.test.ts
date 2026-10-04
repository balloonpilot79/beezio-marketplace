import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadStorefrontBranding } from './storefrontScope';
afterEach(() => vi.unstubAllGlobals());
describe('shopping store branding', () => {
  it('retains MareBelle identity, contrast, and return path when navigating to cart', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ json: async () => ({ store_slug:'marebelle',seller:{full_name:'MareBelle'} }) }));
    const brand = await loadStorefrontBranding({kind:'seller',storeId:'store-id',raw:'store:seller:store-id'});
    expect(brand.name).toBe('MareBelle');
    expect(brand.inverseHeader).toBe(true);
    expect(brand.logoUrl).toBeTruthy();
    expect(brand.homePath).toBe('/store/marebelle');
    expect(brand.accentColor).toBeTruthy();
  });
  it('keeps marketplace shopping generic when there is no store scope', async () => {
    expect((await loadStorefrontBranding(null)).kind).toBe('generic');
  });
  it('preserves an affiliate store name and return link', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({json:async()=>({store_settings:{store_name:'Example shop',subdomain:'example-shop',primary_color:'#336699'}})}));
    const brand=await loadStorefrontBranding({kind:'affiliate',storeId:'affiliate-id',raw:'store:affiliate:affiliate-id'});
    expect(brand.name).toBe('Example shop');
    expect(brand.homePath).toBe('/store/example-shop');
    expect(brand.accentColor).toBe('#336699');
  });
});
