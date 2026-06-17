import { describe, expect, it } from 'vitest';
import {
  buildSearchableCodes,
  normalizeCjDetailPayload,
  normalizeCodeForSearch,
  validateCjVariantForOrdering,
} from './cjIdentity';

describe('cjIdentity', () => {
  it('builds searchable codes with original and uppercase forms', () => {
    expect(buildSearchableCodes([' ab-12 ', 'AB-12', null, ''])).toEqual(['ab-12', 'AB-12']);
  });

  it('normalizes a single-variant CJ detail payload', () => {
    const normalized = normalizeCjDetailPayload({
      pid: 'P100',
      productId: 'P100',
      productSku: 'SKU-PARENT',
      productSpu: 'SPU-1',
      productNameEn: 'Test Product',
      variants: [{ vid: 'V200', variantSku: 'SKU-RED', variantNameEn: 'Red', sku: 'SKU-RED' }],
    });

    expect(normalized.cj_pid).toBe('P100');
    expect(normalized.variants).toHaveLength(1);
    expect(normalized.variants[0].variant_display_sku).toBe('SKU-RED');
    expect(normalized.variants[0].order_reference_type).toBe('cj_vid');
    expect(normalized.searchable_codes).toContain('SKU-PARENT');
    expect(normalized.searchable_codes).toContain('V200');
  });

  it('prefers variant-level display code over parent product sku', () => {
    const normalized = normalizeCjDetailPayload({
      pid: 'P100',
      productSku: 'PARENT-SKU',
      variants: [{ vid: 'V1', variantCode: 'REAL-VARIANT-CODE' }],
    });

    expect(normalized.variants[0].variant_display_sku).toBe('REAL-VARIANT-CODE');
  });

  it('flags variants without orderable identifiers', () => {
    const normalized = normalizeCjDetailPayload({
      pid: 'P100',
      productSku: 'PARENT-SKU',
      variants: [{ variantSku: 'NO-ID-SKU' }],
    });

    expect(normalized.import_status).toBe('needs_review');
    expect(normalized.warnings.some((warning) => warning.code === 'missing_variant_reference')).toBe(true);
  });

  it('blocks ordering when only parent code exists', () => {
    const result = validateCjVariantForOrdering({
      source: 'cj',
      cj_vid: null,
      cj_variant_id: null,
      variant_display_sku: 'PARENT-SKU',
      searchable_codes: ['PARENT-SKU'],
    });

    expect(result.ok).toBe(false);
  });

  it('blocks ordering when displayed sku is not attached to the variant codes', () => {
    const result = validateCjVariantForOrdering({
      source: 'cj',
      cj_vid: 'V123',
      cj_variant_id: null,
      variant_display_sku: 'WRONG-SKU',
      searchable_codes: ['RIGHT-SKU', 'V123'],
    });

    expect(result.ok).toBe(false);
  });

  it('allows ordering when a CJ VID is present and display sku matches the saved variant', () => {
    const result = validateCjVariantForOrdering({
      source: 'cj',
      cj_vid: 'V123',
      cj_variant_id: null,
      variant_display_sku: 'RIGHT-SKU',
      searchable_codes: ['RIGHT-SKU', normalizeCodeForSearch('RIGHT-SKU'), 'V123'],
    });

    expect(result.ok).toBe(true);
    expect(result.orderReferenceType).toBe('cj_vid');
  });

  it('captures parent and variant codes for multi-variant searchability', () => {
    const normalized = normalizeCjDetailPayload({
      pid: 'P100',
      productSku: 'PARENT-SKU',
      productSpu: 'SPU-100',
      variants: [
        { vid: 'V1', variantSku: 'SKU-RED', variantNameEn: 'Red' },
        { vid: 'V2', variantCode: 'CODE-BLUE', variantNameEn: 'Blue' },
      ],
    });

    expect(normalized.searchable_codes).toEqual(expect.arrayContaining(['PARENT-SKU', 'SPU-100', 'SKU-RED', 'CODE-BLUE', 'V1', 'V2']));
  });

  it('falls back to cj_sku when no variant sku/code exists', () => {
    const normalized = normalizeCjDetailPayload({
      pid: 'P100',
      variants: [{ vid: 'V1', sku: 'CJ-SKU-1' }],
    });

    expect(normalized.variants[0].variant_display_sku).toBe('CJ-SKU-1');
  });

  it('falls back to cj_variant_id for order reference when cj_vid is missing', () => {
    const normalized = normalizeCjDetailPayload({
      pid: 'P100',
      variants: [{ variantId: 'VAR-1', variantSku: 'SKU-1' }],
    });

    expect(normalized.variants[0].order_reference_type).toBe('cj_variant_id');
    expect(normalized.variants[0].is_orderable).toBe(true);
  });

  it('flags a parent code shown as a variant display code', () => {
    const normalized = normalizeCjDetailPayload({
      pid: 'P100',
      productSku: 'PARENT-SKU',
      variants: [{ vid: 'V1', productSku: 'PARENT-SKU' }],
    });

    expect(normalized.warnings.some((warning) => warning.code === 'parent_code_shown_as_variant')).toBe(true);
    expect(normalized.import_status).toBe('needs_review');
  });

  it('flags duplicate displayed variant codes', () => {
    const normalized = normalizeCjDetailPayload({
      pid: 'P100',
      variants: [
        { vid: 'V1', variantSku: 'DUP-SKU' },
        { vid: 'V2', variantSku: 'DUP-SKU' },
      ],
    });

    expect(normalized.warnings.some((warning) => warning.code === 'duplicate_variant_display_code')).toBe(true);
  });

  it('supports case-insensitive matching in searchable codes', () => {
    const normalized = normalizeCjDetailPayload({
      pid: 'p100',
      productSku: 'ab-12',
      variants: [{ vid: 'v1', variantCode: 'blue-1' }],
    });

    expect(normalized.searchable_codes).toEqual(expect.arrayContaining(['ab-12', 'AB-12', 'blue-1', 'BLUE-1']));
  });

  it('allows non-cj variants to bypass cj-specific validation', () => {
    const result = validateCjVariantForOrdering({
      source: 'manual',
      cj_vid: null,
      cj_variant_id: null,
      variant_display_sku: null,
      searchable_codes: [],
    });

    expect(result.ok).toBe(true);
    expect(result.orderReferenceType).toBe('none');
  });
});
