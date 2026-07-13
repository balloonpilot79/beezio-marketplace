import { describe, expect, it } from 'vitest';
import { slugifyCollectionName } from './storeProductPlacement';

describe('slugifyCollectionName', () => {
  it('creates a stable store collection slug', () => {
    expect(slugifyCollectionName("MareBelle's Summer Picks")).toBe('marebelles-summer-picks');
  });

  it('removes leading separators and unsupported characters', () => {
    expect(slugifyCollectionName('  & RedTail / Outdoor Gear!  ')).toBe('redtail-outdoor-gear');
  });
});
