import { describe, expect, it } from 'vitest';
import { injectProductShareMetadata, productShareImage, productShareUrl, sharedProductId } from './productShareMetadata';
import share from '../netlify/edge-functions/product-share';

const id = '82ab459c-f29b-49b3-ac81-e5f95c1c48e9';
const html = '<html><head><title>Beezio</title><meta name="description" content="generic" /></head><body><div id="root"></div><script src="/assets/app.js"></script></body></html>';
const product = { title: 'Horse & Stable', description: '<p>Shop this horse shirt.</p>', images: ['https://images.example/horse.jpg'] };

describe('shared product previews', () => {
  it('recognizes direct and storefront product routes without catching edit or promo pages', () => {
    for (const prefix of ['', '/marebelle', '/store/marebelle', '/seller/marebelle', '/partner/marebelle', '/affiliate/jason']) {
      expect(sharedProductId(`${prefix}/product/${id}`)).toBe(id);
    }
    expect(sharedProductId('/dashboard/products/edit/' + id)).toBeNull();
    expect(sharedProductId('/promo/product/' + id)).toBe(id);
    expect(sharedProductId('/product/not-a-product')).toBeNull();
  });
  it('includes product title, public image, description and the attributed destination in initial HTML', () => {
    const url = `https://beezio.co/marebelle/product/${id}?ref=jason&code=abc`;
    const result = injectProductShareMetadata(html, product, url, 'https://storage.example');
    expect(result).toContain('<title>Horse &amp; Stable | Beezio</title>');
    expect(result).toContain('property="og:image" content="https://images.example/horse.jpg"');
    expect(result).toContain('name="twitter:card" content="summary_large_image"');
    expect(result).toContain('?ref=jason&amp;code=abc');
    expect(result).toContain('Shop this horse shirt.');
    expect(result).not.toContain('content="generic"');
    expect(result).toContain('<div id="root"></div><script src="/assets/app.js"></script>');
  });
  it('escapes seller text without injecting markup', () => {
    const result = injectProductShareMetadata(html, { title: '"><script>alert(1)</script>', images: [] }, 'https://beezio.co/product/' + id, 'https://storage.example');
    expect(result).toContain('&lt;script&gt;');
    expect(result).not.toContain('<script>alert(1)');
  });
  it('resolves storage paths and rejects non-public image schemes', () => {
    expect(productShareImage({ images: ['javascript:alert(1)', 'product-images/a/horse.jpg'] }, 'https://beezio.co', 'https://storage.example')).toBe('https://storage.example/storage/v1/object/public/product-images/a/horse.jpg');
    expect(productShareImage({ images: ['data:image/png;base64,abc'] }, 'https://beezio.co', 'https://storage.example')).toBeNull();
  });
  it('does not advertise a withdrawn product', () => {
    const result = injectProductShareMetadata(html, null, 'https://beezio.co/product/' + id, 'https://storage.example');
    expect(result).toContain('Product unavailable');
    expect(result).not.toContain('og:image');
  });
  it('preserves store and referral attribution in card share links', () => {
    expect(productShareUrl('https://beezio.co', id, `/marebelle/product/${id}?code=abc&uid=owner`, 'jason')).toBe(`https://beezio.co/marebelle/product/${id}?code=abc&uid=owner&ref=jason`);
    expect(productShareUrl('https://beezio.co', id, '//evil.example')).toBe(`https://beezio.co/product/${id}`);
  });
  it('falls back to the original page if public metadata is unavailable', async () => {
    const { vi } = await import('vitest');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    const response = new Response(html, { headers: { 'content-type': 'text/html' } });
    try {
      const result = await share(new Request('https://beezio.co/product/' + id), { next: async () => response });
      expect(await result?.text()).toBe(html);
    } finally { vi.unstubAllGlobals(); }
  });
});
