import { describe, expect, it } from 'vitest';
import { sanitizeSupplyLineProduct, sanitizeSupplyLineVariant } from './publicSupplyLineProduct';

describe('SupplyLine Plus public projection', () => {
  it('removes exact CJ identifiers and fulfillment economics from products', () => {
    const product = sanitizeSupplyLineProduct({
      id: 'product-1',
      title: 'Travel Mug',
      source_platform: 'cj',
      cj_product_id: 'CJ-PID-SECRET',
      cj_product_sku: 'CJ-SKU-SECRET',
      supplier_cost_amount: 4,
      seller_markup_amount: 10,
      shipping_reserve_amount: 6,
      affiliate_payout_amount: 5,
      calculated_customer_price: 29,
      sku: 'CJ-RAW-SKU',
    });

    expect(product).toMatchObject({
      id: 'product-1',
      source_platform: 'supplyline_plus',
      lineage: 'SupplyLine Plus',
      affiliate_payout_amount: 5,
      calculated_customer_price: 29,
    });
    expect(product).not.toHaveProperty('cj_product_id');
    expect(product).not.toHaveProperty('cj_product_sku');
    expect(product).not.toHaveProperty('supplier_cost_amount');
    expect(product).not.toHaveProperty('seller_markup_amount');
    expect(product).not.toHaveProperty('shipping_reserve_amount');
    expect(product).not.toHaveProperty('sku');
  });

  it('keeps shopper option data while removing the exact VID and SKU', () => {
    const variant = sanitizeSupplyLineVariant({
      id: 'variant-1',
      attributes: { Color: 'Blue' },
      price: 31,
      affiliate_payout_amount: 8,
      cj_vid: 'CJ-VID-SECRET',
      cj_variant_id: 'CJ-VARIANT-SECRET',
      variant_display_sku: 'CJ-DISPLAY-SECRET',
      supplier_cost_amount: 7,
    });

    expect(variant).toMatchObject({
      id: 'variant-1',
      attributes: { Color: 'Blue' },
      price: 31,
      affiliate_payout_amount: 8,
      source_platform: 'supplyline_plus',
    });
    expect(variant).not.toHaveProperty('cj_vid');
    expect(variant).not.toHaveProperty('cj_variant_id');
    expect(variant).not.toHaveProperty('variant_display_sku');
    expect(variant).not.toHaveProperty('supplier_cost_amount');
  });
});
