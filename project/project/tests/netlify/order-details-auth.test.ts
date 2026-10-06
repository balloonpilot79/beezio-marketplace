import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  authHeader: '',
  admin: false,
  ownerIds: ['random-profile'],
}));

const order = {
  id: '0af28d61-155a-4bfd-8b6b-290904967ed4',
  buyer_id: 'buyer-profile',
  seller_id: 'seller-profile',
  partner_id: 'affiliate-profile',
  affiliate_id: 'affiliate-profile',
  influencer_id: 'influencer-profile',
  user_id: 'buyer-auth-user',
  status: 'completed',
  payment_status: 'paid',
};

const db = {
  from: (table: string) => ({
    select: () => ({
      eq: () => ({
        maybeSingle: async () => ({
          data: table === 'orders' ? order : null,
          error: null,
        }),
      }),
    }),
  }),
};

vi.mock('../../netlify/functions/_lib/supabase', () => ({
  createSupabaseAdmin: () => db,
}));

vi.mock('../../netlify/functions/_lib/auth', () => ({
  extractAuthHeader: () => state.authHeader,
  getAuthedUser: async () => ({
    user: state.authHeader ? { id: 'random-auth-user' } : null,
    error: state.authHeader ? null : 'Unauthorized',
  }),
  requireAdmin: async () => {
    if (!state.admin) throw new Error('Forbidden');
  },
}));

vi.mock('../../netlify/functions/_lib/owned-profiles', () => ({
  resolveOwnedProfileIdsForUser: async () => state.ownerIds,
}));

import { handler } from '../../netlify/functions/order-details';

const invoke = async () =>
  handler(
    {
      httpMethod: 'GET',
      headers: state.authHeader ? { authorization: state.authHeader } : {},
      queryStringParameters: { id: order.id },
    } as any,
    {} as any,
    () => {}
  );

describe('order-details access control', () => {
  beforeEach(() => {
    state.authHeader = '';
    state.admin = false;
    state.ownerIds = ['random-profile'];
  });

  it('does not expose a paid order to an unauthenticated request', async () => {
    const result: any = await invoke();
    expect(result.statusCode).toBe(401);
  });

  it('does not expose a paid order to an unrelated signed-in account', async () => {
    state.authHeader = 'Bearer random-user-token';
    const result: any = await invoke();
    expect(result.statusCode).toBe(403);
  });
});
