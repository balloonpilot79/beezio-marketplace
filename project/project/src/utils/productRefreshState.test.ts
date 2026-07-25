import { describe, expect, it } from 'vitest';
import { resolveProductRefreshFailure } from './productRefreshState';

describe('product refresh failure state', () => {
  it('keeps an already rendered product when background enrichment fails', () => {
    expect(resolveProductRefreshFailure(true, new Error('request timed out'))).toEqual({
      keepCurrentProduct: true,
      errorMessage: null,
    });
  });

  it('shows a blocking error when no product was ever loaded', () => {
    expect(resolveProductRefreshFailure(false, new Error('Product not found'))).toEqual({
      keepCurrentProduct: false,
      errorMessage: 'Product not found',
    });
  });
});
