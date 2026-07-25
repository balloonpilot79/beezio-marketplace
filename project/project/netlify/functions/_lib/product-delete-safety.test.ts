import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('../product-delete.ts', import.meta.url), 'utf8');

describe('product delete safety', () => {
  it('never deletes orders or financial history to remove a product', () => {
    expect(source).not.toContain("from('orders').delete");
    expect(source).not.toContain('FORCE_DELETE_PRODUCT');
    expect(source).not.toContain('forceDeleteProductOrderHistory');
  });

  it('checks order references before cleaning product relations', () => {
    expect(source.indexOf('if (!guard.ok)')).toBeGreaterThan(source.indexOf('checkOrderItemReferences'));
    expect(source.indexOf('await cleanupProductRelations')).toBeGreaterThan(source.indexOf('if (!guard.ok)'));
  });
});
