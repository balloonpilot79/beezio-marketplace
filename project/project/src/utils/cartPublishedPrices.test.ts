import { describe, expect, it } from 'vitest';
import { refreshCartPublishedPrices } from './cartPublishedPrices';

describe('saved cart published prices', () => {
  const item = { productId: 'beetroot', price: 25.63, quantity: 2, affiliateId: 'affiliate' };
  it('refreshes a stale base price without changing quantity or attribution', () => {
    expect(refreshCartPublishedPrices([item], new Map([['beetroot', 30.31]]))).toEqual([{ ...item, price: 30.31 }]);
  });
  it('preserves separately priced variants and samples', () => {
    const items = [{ ...item, variantId: 'variant' }, { ...item, isSample: true }];
    expect(refreshCartPublishedPrices(items, new Map([['beetroot', 30.31]]))).toBe(items);
  });
  it('retains cart prices when the catalog response is missing or invalid', () => {
    const items = [item];
    for (const value of [undefined, 0, -1, Number.NaN]) {
      expect(refreshCartPublishedPrices(items, new Map([['beetroot', value as number]]))).toBe(items);
    }
  });
});
