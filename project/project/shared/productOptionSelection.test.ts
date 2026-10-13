import { describe, expect, it } from 'vitest';
import { shouldOpenProductDetailsBeforePurchase } from './productOptionSelection';

describe('catalog purchase option safety', () => {
  it.each([{}, { variants: [] }, { has_variants: null }, { has_variants: true }])('loads details when variant metadata is unknown or options are present: %j', product => {
    expect(shouldOpenProductDetailsBeforePurchase(product)).toBe(true);
  });
  it('allows direct purchase only when the catalog explicitly identifies a product without options', () => {
    expect(shouldOpenProductDetailsBeforePurchase({ has_variants: false, variants: [], product_variants: [] })).toBe(false);
  });
  it.each([{ variants: [{ id: 'large' }] }, { product_variants: [{ id: 'white' }] }, { variants: { Size: ['L'] } }])('requires details when actual options override a stale no-variants flag: %j', options => {
    expect(shouldOpenProductDetailsBeforePurchase({ has_variants: false, ...options })).toBe(true);
  });
});
