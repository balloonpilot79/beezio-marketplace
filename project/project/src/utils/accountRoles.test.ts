import { describe, expect, it } from 'vitest';
import {
  canUseStoreTools,
  getBusinessAccountRoles,
  getNormalizedAccountRoles,
  hasBusinessAccountAccess,
  isBuyerOnlyAccount,
} from './accountRoles';

describe('account role separation', () => {
  it('keeps buyer-only accounts out of business surfaces', () => {
    expect(isBuyerOnlyAccount(['buyer'])).toBe(true);
    expect(hasBusinessAccountAccess('buyer')).toBe(false);
    expect(getBusinessAccountRoles('buyer')).toEqual([]);
    expect(canUseStoreTools(['buyer'])).toBe(false);
  });

  it('grants business access for every business role', () => {
    expect(getBusinessAccountRoles(['seller', 'affiliate', 'influencer'])).toEqual([
      'seller',
      'affiliate',
      'influencer',
    ]);
    expect(hasBusinessAccountAccess(['seller'])).toBe(true);
    expect(hasBusinessAccountAccess(['affiliate'])).toBe(true);
    expect(hasBusinessAccountAccess(['influencer'])).toBe(true);
  });

  it('normalizes partner to affiliate', () => {
    expect(getNormalizedAccountRoles('partner')).toEqual(['affiliate']);
    expect(getBusinessAccountRoles('partner')).toEqual(['affiliate']);
  });

  it('keeps multi-role users in the business center', () => {
    expect(isBuyerOnlyAccount(['buyer', 'seller'])).toBe(false);
    expect(getBusinessAccountRoles(['buyer', 'seller'])).toEqual(['seller']);
  });
});
