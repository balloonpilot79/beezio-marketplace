import { describe, expect, it } from 'vitest';
import { normalizeProductImagePath, normalizeProductImages, normalizeProductVideos, resolveProductImageFromList } from './imageHelpers';

describe('imageHelpers', () => {
  it('treats JSON array strings as external URLs (no supabase wrapping)', () => {
    const url = 'https://example.com/a.jpg';
    expect(normalizeProductImagePath(`["${url}"]`)).toBe(url);
    expect(resolveProductImageFromList(`["${url}"]`, 'seed')).toBe(url);
  });

  it('treats URL-encoded JSON array strings as external URLs', () => {
    const encoded = '%5B%22https%3A%2F%2Fexample.com%2Fa.jpg%22%5D';
    expect(normalizeProductImages(encoded)).toEqual(['https://example.com/a.jpg']);
    expect(resolveProductImageFromList(encoded, 'seed')).toBe('https://example.com/a.jpg');
  });

  it('normalizes product video storage paths into public URLs', () => {
    expect(normalizeProductVideos('seller-1/product-videos/demo.mp4')).toEqual([
      expect.stringContaining('/storage/v1/object/public/product-images/seller-1/product-videos/demo.mp4'),
    ]);
  });

  it('parses JSON video arrays', () => {
    const url = 'https://example.com/demo.mp4';
    expect(normalizeProductVideos(`["${url}"]`)).toEqual([url]);
  });
});
