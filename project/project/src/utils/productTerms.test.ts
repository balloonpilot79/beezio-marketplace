import { describe, expect, it } from 'vitest';
import { getProductTerms, validateProductTerms } from './productTerms';

describe('per-item shipping and returns', () => {
  const terms = [{ estimated_days: '5–10 business days', shipping_policy: 'USA only.', return_policy: 'Returns within 14 days; buyer pays return shipping.' }];
  it('reads seller terms from stored JSON without replacing them with store defaults', () => {
    expect(getProductTerms(JSON.stringify(terms))).toEqual(terms[0]);
  });
  it('requires shipping and return terms and an estimate for shipped items', () => {
    expect(validateProductTerms(terms, true)).toBeNull();
    expect(validateProductTerms([{ ...terms[0], estimated_days: ' ' }], true)).toMatch(/estimated shipping time/);
    expect(validateProductTerms([{ ...terms[0], shipping_policy: '' }], true)).toMatch(/shipping terms/);
    expect(validateProductTerms([{ ...terms[0], return_policy: ' ' }], true)).toMatch(/return terms/);
  });
  it('does not invent terms for older or malformed products', () => {
    for (const raw of [null, [], '{}', 'bad JSON', [null]]) expect(getProductTerms(raw)).toEqual({});
  });
  it('keeps product-specific policies separate across listings', () => {
    expect(getProductTerms([{ ...terms[0], return_policy: 'No change-of-mind returns.' }]).return_policy).toBe('No change-of-mind returns.');
    expect(getProductTerms(terms).return_policy).toBe(terms[0].return_policy);
  });
});
