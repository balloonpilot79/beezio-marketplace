import { describe, expect, it, vi } from 'vitest';
import { buildStoreInsuranceListings } from './storeInsurance';

describe('store insurance storefront fallback', () => {
  it('returns an empty optional section when the insurance tables are unavailable', async () => {
    const query: any = {
      select: vi.fn(() => query),
      eq: vi.fn(() => query),
      order: vi.fn(() => query),
      limit: vi.fn(async () => ({
        data: null,
        error: { code: 'PGRST205', message: 'insurance_agent_listings was not found' },
      })),
    };
    const supabaseAdmin = { from: vi.fn(() => query) };

    await expect(buildStoreInsuranceListings(supabaseAdmin, null, 6)).resolves.toEqual([]);
  });
});
