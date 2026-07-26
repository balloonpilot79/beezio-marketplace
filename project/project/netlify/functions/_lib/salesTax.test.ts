import { describe, expect, it } from 'vitest';
import { resolveLocationTaxRate } from './salesTax';

describe('resolveLocationTaxRate', () => {
  it('prefers postal, then state, then country tax configuration', () => {
    const rates = {
      'US-IL-60601': 0.1025,
      'US-IL': 0.0625,
      US: 0,
    };

    expect(resolveLocationTaxRate({
      country: 'us',
      state: 'il',
      postalCode: '60601',
      configuredRatesJson: rates,
    })).toEqual({ rate: 0.1025, source: 'location:US-IL-60601' });
    expect(resolveLocationTaxRate({
      country: 'US',
      state: 'IL',
      postalCode: '62901',
      configuredRatesJson: rates,
    })).toEqual({ rate: 0.0625, source: 'location:US-IL' });
  });

  it('uses the configured fallback or the seven-percent default', () => {
    expect(resolveLocationTaxRate({ fallbackRate: 0.07 })).toEqual({
      rate: 0.07,
      source: 'configured_fallback',
    });
    expect(resolveLocationTaxRate({ configuredRatesJson: 'invalid' }).rate).toBe(0.07);
    expect(resolveLocationTaxRate({ disabled: true, fallbackRate: 0.07 }).rate).toBe(0);
  });
});
