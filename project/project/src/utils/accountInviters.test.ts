import { describe, expect, it, vi } from 'vitest';
import { loadAccountInviters } from './accountInviters';

function database(assignments: any[], profiles: any[] = [], failure?: any) {
  const select = vi.fn();
  const db = { from: vi.fn((table: string) => {
    const query: any = { select: (fields: string) => { select(table, fields); return query; },
      eq: (_field: string, value: string) => Promise.resolve({ data: assignments.filter(row => row.recruited_profile_id === value), error: failure }),
      in: (_field: string, values: string[]) => Promise.resolve({ data: profiles.filter(row => values.includes(row.id)), error: null }) };
    return query;
  }) };
  return { db, select };
}
describe('account inviter display data', () => {
  it('shows one inviter for the referred account with both role assignments', async () => {
    const { db, select } = database(['seller', 'affiliate'].map(role => ({ recruited_profile_id: 'test-account', influencer_profile_id: 'inviter', recruited_role: role })),
      [{ id: 'inviter', full_name: 'Jason Loving', referral_code: 'JASO7554' }]);
    expect(await loadAccountInviters(db, 'test-account')).toEqual([{ id: 'inviter', name: 'Jason Loving', code: 'JASO7554', roles: ['seller', 'affiliate'] }]);
    expect(select).toHaveBeenCalledWith('profile_directory', 'id,full_name,referral_code');
  });
  it('preserves different inviters for different roles and excludes other accounts', async () => {
    const { db } = database([
      { recruited_profile_id: 'buyer', influencer_profile_id: 'one', recruited_role: 'buyer' },
      { recruited_profile_id: 'buyer', influencer_profile_id: 'two', recruited_role: 'seller' },
      { recruited_profile_id: 'someone-else', influencer_profile_id: 'private', recruited_role: 'affiliate' },
    ]);
    expect((await loadAccountInviters(db, 'buyer')).map(row => [row.id, row.roles])).toEqual([['one', ['buyer']], ['two', ['seller']]]);
  });
  it('does not invent attribution for direct signups or self-referrals', async () => {
    const { db, select } = database([{ recruited_profile_id: 'self', influencer_profile_id: 'self', recruited_role: 'seller' }]);
    expect(await loadAccountInviters(db, 'direct')).toEqual([]);
    expect(await loadAccountInviters(db, 'self')).toEqual([]);
    expect(select).not.toHaveBeenCalledWith('profile_directory', expect.anything());
  });
  it('surfaces failed reads rather than claiming no inviter', async () => {
    const failure = new Error('offline');
    const { db } = database([], [], failure);
    await expect(loadAccountInviters(db, 'account')).rejects.toThrow('offline');
  });
});
