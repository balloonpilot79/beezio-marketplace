import { describe, it, expect } from 'vitest';
import {
  calculateRetailPriceCents,
  estimateShippingCents,
  deriveVariantInStock,
  deriveProductStock,
  resolveCategoryMapping,
} from '../cjBulkImportUtils';

describe('cjBulkImportUtils', () => {
  it('calculates retail price with baked influencer reserve', () => {
    const cents = calculateRetailPriceCents(1000, {
      affiliate_percent: 20,
      affiliate_floor_cents: 0,
      affiliate_enabled: true,
      markup_type: 'flat',
      markup_value: 200,
      paypal_fee_bps: 350,
      paypal_fixed_cents: 65,
    });
    expect(cents).toBe(2000);
  });

  it('estimates shipping from weight tiers', () => {
    const tiers = [
      { min_oz: 0, max_oz: 8, shipping_cents: 499 },
      { min_oz: 9, max_oz: 32, shipping_cents: 699 },
    ];
    expect(estimateShippingCents(10, tiers)).toBe(699);
  });

  it('derives variant in_stock correctly', () => {
    expect(deriveVariantInStock({ is_active: false, inventory: 5, inventory_policy: 'deny' })).toBe(false);
    expect(deriveVariantInStock({ is_active: true, inventory: 0, inventory_policy: 'deny' })).toBe(false);
    expect(deriveVariantInStock({ is_active: true, inventory: 0, inventory_policy: 'continue' })).toBe(true);
  });

  it('derives product stock from variants', () => {
    const stock = deriveProductStock({
      track_inventory: true,
      status: 'active',
      variants: [
        { inventory: 0, is_active: true, in_stock: false },
        { inventory: 4, is_active: true, in_stock: true },
      ],
    });
    expect(stock.total_inventory).toBe(4);
    expect(stock.in_stock).toBe(true);
  });

  it('maps categories with fallback', () => {
    const map = { 'Home > Kitchen': 'cat-1' };
    expect(resolveCategoryMapping('Home > Kitchen', map, 'fallback')).toBe('cat-1');
    expect(resolveCategoryMapping('Unknown', map, 'fallback')).toBe('fallback');
  });
});
