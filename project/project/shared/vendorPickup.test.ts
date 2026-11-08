import { describe, expect, it } from 'vitest';
import { getCartPickupLocation } from './vendorPickup';

const item = { seller_id: 'seller', pickup_mode: 'both', pickup_state: 'IA', pickup_zip: '52501' };
describe('local pickup eligibility', () => {
  it('allows several items from the same seller at one location', () => {
    expect(getCartPickupLocation([item, { ...item, pickup_mode: 'pickup' }]))
      .toEqual({ country: 'US', state: 'IA', zip: '52501' });
  });
  it.each([
    { seller_id: 'other' }, { pickup_zip: '50309' }, { pickup_mode: 'shipping' },
    { is_digital: true }, { dropship_provider: 'cj' }, { source_platform: 'printify' },
  ])('rejects conflicting or supplier-fulfilled lines %j', changes => {
    expect(getCartPickupLocation([item, { ...item, ...changes }])).toBeNull();
  });
});
