import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import { AccountInviterDetails } from './AccountInviterCard';

vi.mock('../contexts/AuthContextMultiRole', () => ({ useAuth: () => ({}) }));
vi.mock('../lib/supabase', () => ({ supabase: {} }));

it('shows the saved inviter once with both assignments and no private profile fields', () => {
  const html = renderToStaticMarkup(<AccountInviterDetails inviters={[{ id: 'private-profile-id', name: 'Jason Loving', code: 'JASO7554', roles: ['seller', 'affiliate'] }]} />);
  expect(html.match(/Invited by Jason Loving/g)).toHaveLength(1);
  expect(html).toContain('Referral code: JASO7554');
  expect(html).toContain('Selling · Affiliate promotion');
  expect(html).not.toContain('private-profile-id');
});
it('does not show an inviter for direct signups', () => {
  expect(renderToStaticMarkup(<AccountInviterDetails inviters={[]} />)).toBe('');
});
