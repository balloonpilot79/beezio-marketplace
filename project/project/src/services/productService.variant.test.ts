import { describe, expect, it } from 'vitest';
import { resolveVariant } from './productService';

const variant = (id: string, attributes: Record<string, string>) => ({
  id,
  product_id: 'product-1',
  provider: 'CJ',
  cj_product_id: '',
  cj_variant_id: '',
  sku: id,
  price: 10,
  compare_at_price: null,
  currency: 'USD',
  image_url: null,
  attributes,
  inventory: 10,
  is_active: true,
  created_at: '2026-08-14T00:00:00.000Z',
  updated_at: '2026-08-14T00:00:00.000Z',
}) as any;

describe('resolveVariant exact matching', () => {
  const variants = [
    variant('small-red', { Size: 'Small', Color: 'Red' }),
    variant('large-blue', { Size: 'Large', Color: 'Blue' }),
  ];

  it('returns the exact saved variant for a valid option combination', () => {
    expect(resolveVariant(variants, { Size: 'Small', Color: 'Red' })?.id).toBe('small-red');
    expect(resolveVariant(variants, { Size: 'Large', Color: 'Blue' })?.id).toBe('large-blue');
  });

  it('never falls back to the first variant for an impossible combination', () => {
    expect(resolveVariant(variants, { Size: 'Small', Color: 'Blue' })).toBeNull();
    expect(resolveVariant(variants, { Size: 'Large', Color: 'Red' })).toBeNull();
  });

  it('does not auto-select when multiple variants exist and nothing is chosen', () => {
    expect(resolveVariant(variants, {})).toBeNull();
  });

  it('does auto-select when there is exactly one saved variant', () => {
    expect(resolveVariant([variants[0]], {})?.id).toBe('small-red');
  });

  it('returns null if a selection ambiguously matches multiple saved variants', () => {
    expect(resolveVariant(variants, { Size: 'Small' })).toBeNull();
  });
});
