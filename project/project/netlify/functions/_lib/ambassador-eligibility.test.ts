import { describe, expect, it } from 'vitest';
import { loadAmbassadorProfile } from './ambassador-eligibility';

function dbFor(profile: any, roles: any[]) {
  return { from(table: string) {
    const filters: Array<(row: any) => boolean> = [];
    const query: any = {
      select: () => query, limit: () => query,
      eq: (key: string, value: any) => { filters.push(row => row[key] === value); return query; },
      in: (key: string, values: any[]) => { filters.push(row => values.includes(row[key])); return query; },
      maybeSingle: async () => ({ data: (table === 'profiles' ? [profile].filter(Boolean) : roles).find(row => filters.every(f => f(row))) || null, error: null }),
    };
    return query;
  } };
}

describe('ambassador eligibility without business access', () => {
  it('accepts an active buyer without modifying roles', async () => {
    const profile = { id: 'profile', user_id: 'user', role: 'buyer' };
    const roles = [{ user_id: 'user', role: 'buyer', is_active: true }];
    expect(await loadAmbassadorProfile(dbFor(profile, roles), 'profile')).toEqual(profile);
    expect(roles).toEqual([{ user_id: 'user', role: 'buyer', is_active: true }]);
  });
  it.each([{roles: []}, {roles: [{ user_id: 'user', role: 'buyer', is_active: false }]}, {roles: [{ user_id: 'other', role: 'buyer', is_active: true }]}])('rejects buyers without an active owned role: %j', async ({roles}) => {
    expect(await loadAmbassadorProfile(dbFor({ id: 'profile', user_id: 'user', role: 'buyer' }, roles), 'profile')).toBeNull();
  });
  it('preserves existing business ambassador eligibility', async () => {
    expect(await loadAmbassadorProfile(dbFor({ id: 'profile', role: 'influencer' }, []), 'profile')).toMatchObject({ id: 'profile' });
  });
});
