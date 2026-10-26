import { describe, it, expect } from 'vitest';
import { rotateCatalog, catalogRotationSlot } from './catalogRotation';

describe('catalog rotation', () => {
  it('gives all 637 products each front position without losing or duplicating products', () => {
    const rows = Array.from({length: 637}, (_, i) => ({id: `product-${i}`}));
    const front = new Set<string>();
    for (let slot = 0; slot < rows.length; slot++) {
      const rotated = rotateCatalog(rows, slot);
      front.add(rotated[0].id);
      expect(new Set(rotated.map(p => p.id)).size).toBe(rows.length);
    }
    expect(front.size).toBe(rows.length);
  });
  it('is stable regardless of server order and never mutates input', () => {
    const rows = [{id:'c'}, {id:'a'}, {id:'b'}];
    expect(rotateCatalog(rows, 1)).toEqual(rotateCatalog([...rows].reverse(), 1));
    expect(rows[0].id).toBe('c');
    expect(rotateCatalog([], 4)).toEqual([]);
    expect(catalogRotationSlot(15 * 60 * 1000)).toBe(1);
  });
});
