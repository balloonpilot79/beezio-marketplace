import { describe, expect, it } from 'vitest';
import {
  SUPPLYLINE_SEED_CANDIDATES,
  SUPPLYLINE_SEED_TARGET_COUNT,
  getRemainingSupplyLineSeedCandidates,
  getSupplyLineSeedPricing,
  isSupplyLineSeedProductComplete,
} from './cj-supplyline-seed';

describe('SupplyLine Plus launch seeding', () => {
  it('uses a bounded public candidate list with more fallbacks than the target', () => {
    expect(SUPPLYLINE_SEED_TARGET_COUNT).toBe(3);
    expect(SUPPLYLINE_SEED_CANDIDATES.length).toBeGreaterThan(SUPPLYLINE_SEED_TARGET_COUNT);
    expect(SUPPLYLINE_SEED_CANDIDATES.every((item) => /^https:\/\//.test(item.publicReferenceUrl))).toBe(true);
  });

  it('never imports a candidate already represented by an exact CJ product ID', () => {
    const existing = SUPPLYLINE_SEED_CANDIDATES[0].cjProductId;
    expect(getRemainingSupplyLineSeedCandidates([existing]).some((item) => item.cjProductId === existing)).toBe(false);
  });

  it('keeps the low-cost launch suggestion competitive and permits affiliate above markup', () => {
    expect(getSupplyLineSeedPricing(2.5)).toEqual({ markup: 3, affiliateCommission: 3.5 });
    expect(getSupplyLineSeedPricing(10)).toEqual({ markup: 5, affiliateCommission: 4 });
  });

  it('repairs mapped products until normalized pricing and a cached video are present', () => {
    const complete = {
      source_platform: 'cj',
      videos: ['https://storage.example/product.mp4'],
      retail_price_cents: 1419,
      base_cost_cents: 62,
      shipping_estimate_cents: 390,
      calculated_customer_price: 14.19,
      markup_value: 300,
      affiliate_floor_cents: 350,
    };
    expect(isSupplyLineSeedProductComplete(complete)).toBe(true);
    expect(isSupplyLineSeedProductComplete({ ...complete, videos: [] })).toBe(false);
    expect(isSupplyLineSeedProductComplete({ ...complete, retail_price_cents: 0 })).toBe(false);
    expect(isSupplyLineSeedProductComplete({ ...complete, source_platform: null })).toBe(false);
  });
});
