import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { expect, it, vi } from 'vitest';
import { AffiliateProvider } from './AffiliateContext';
import { useAuth } from './AuthContextMultiRole';
import { supabase } from '../lib/supabase';

vi.mock('./AuthContextMultiRole', () => ({ useAuth: vi.fn() }));
vi.mock('../lib/supabase', () => ({ supabase: { from: vi.fn() } }));
vi.mock('../api/removeStoreProducts', () => ({ removeStoreProducts: vi.fn() }));
vi.mock('../api/affiliateStore', () => ({ addAffiliateProduct: vi.fn() }));

it('keeps affiliate reads stable across session updates and reloads after product edits', async () => {
  const events = new EventTarget();
  Object.defineProperty(events, 'location', { value: { origin: 'https://example.com' } });
  vi.stubGlobal('window', events);
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: vi.fn() });

  const auth = vi.mocked(useAuth);
  const from = vi.mocked(supabase.from);
  const profile = { id: 'affiliate-1', referral_code: 'DEMO' };
  const session = (id: string, profileData: typeof profile) =>
    ({ user: { id }, profile: profileData }) as ReturnType<typeof useAuth>;
  auth.mockReturnValue(session('user-1', profile));
  from.mockImplementation(() => ({
    select: () => ({
      eq: () => ({
        maybeSingle: async () => ({ data: null }),
        eq: async () => ({ data: [], error: null }),
      }),
    }),
  }) as unknown as ReturnType<typeof supabase.from>);

  const render = () => <AffiliateProvider><span /></AffiliateProvider>;
  let view: ReactTestRenderer | undefined;
  try {
    await act(async () => { view = create(render()); });
    expect(from.mock.calls.map(([table]) => table)).toEqual(['affiliate_store_settings', 'affiliate_products']);
    from.mockClear();

    auth.mockReturnValue(session('user-1', { ...profile }));
    await act(async () => { view?.update(render()); });
    expect(from).not.toHaveBeenCalled();

    await act(async () => { events.dispatchEvent(new Event('affiliate-products-changed')); });
    expect(from.mock.calls.map(([table]) => table)).toEqual(['affiliate_products']);
    from.mockClear();

    auth.mockReturnValue(session('user-2', { ...profile, id: 'affiliate-2' }));
    await act(async () => { view?.update(render()); });
    expect(from.mock.calls.map(([table]) => table)).toEqual(['affiliate_store_settings', 'affiliate_products']);
  } finally {
    await act(async () => { view?.unmount(); });
    vi.unstubAllGlobals();
  }
});
