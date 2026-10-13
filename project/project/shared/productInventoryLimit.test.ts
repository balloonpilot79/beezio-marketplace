import { describe, expect, it } from 'vitest';
import { getProductInventoryLimit } from './productInventoryLimit';

describe('product purchase inventory limits', () => {
  it('allows made-to-order shirts with untracked zero variant stock', () => {
    expect(getProductInventoryLimit({ track_inventory: false, stock_quantity: 1, in_stock: true }, { inventory: 0, is_active: true })).toBeNull();
  });
  it('keeps real tracked stock limits and blocks sold-out variants', () => {
    expect(getProductInventoryLimit({ track_inventory: true, stock_quantity: 10 }, { inventory: 0 })).toBe(0);
    expect(getProductInventoryLimit({ track_inventory: true, stock_quantity: 10 }, { inventory: 3 })).toBe(3);
  });
  it('honors explicit withdrawal and sold-out flags even without tracking', () => {
    expect(getProductInventoryLimit({ track_inventory: false, in_stock: false })).toBe(0);
    expect(getProductInventoryLimit({ track_inventory: false }, { is_active: false })).toBe(0);
    expect(getProductInventoryLimit({ track_inventory: false }, { in_stock: false })).toBe(0);
  });
  it('uses product stock only when variant stock is unknown', () => {
    expect(getProductInventoryLimit({ stock_quantity: 5 }, { inventory: null })).toBe(5);
    expect(getProductInventoryLimit({ stock_quantity: 0 })).toBe(0);
    expect(getProductInventoryLimit({ stock_quantity: null, total_inventory: 2 })).toBe(2);
    expect(getProductInventoryLimit({ stock_quantity: null }, { inventory: null })).toBeUndefined();
  });
});
