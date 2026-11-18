import { beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ candidates: [{ id: '1deb1c67-4058-4f34-8c7c-1f0a9ecf47db' }], eligible: true, from: vi.fn() }));
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ from: (...args: any[]) => state.from(...args) }) }));
vi.mock('../../netlify/functions/_lib/ambassador-eligibility', () => ({ loadAmbassadorProfile: async (_db: any, id: string) => state.eligible ? { id, full_name: 'Jason Loving' } : null }));
import { handler } from '../../netlify/functions/public-recruit-resolve';
beforeEach(() => {
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-only';
  state.candidates = [{ id: '1deb1c67-4058-4f34-8c7c-1f0a9ecf47db' }];
  state.eligible = true;
  state.from.mockReset();
  state.from.mockImplementation(() => {
    const query: any = { select: () => query, gte: () => query, lte: () => query,
      limit: async () => ({ data: state.candidates, error: null }) };
    return query;
  });
});
async function resolve(code: string) {
  const response: any = await handler({ queryStringParameters: { code } } as any, {} as any, () => {});
  return JSON.parse(response.body);
}
it('repairs a previously shared shortened invite and resolves its owner', async () => {
  expect(await resolve('bzo-1deb1c6740')).toMatchObject({ valid: true, referrerName: 'Jason Loving', referrerProfileId: state.candidates[0].id });
});
it('accepts a pasted /i/ invite URL', async () => {
  expect(await resolve('https://beezio.co/i/bzo-1deb1c6740')).toMatchObject({ valid: true });
});
it('rejects ambiguous or missing historical prefixes', async () => {
  state.candidates = [];
  expect(await resolve('bzo-1deb1c6740')).toMatchObject({ valid: false });
  state.candidates = [{ id: 'one' }, { id: 'two' }];
  expect(await resolve('bzo-1deb1c6740')).toMatchObject({ valid: false });
});
it('still requires an eligible referrer', async () => {
  state.eligible = false;
  expect(await resolve('bzo-1deb1c6740')).toMatchObject({ valid: false });
});
it('rejects filter syntax before querying profiles', async () => {
  expect(await resolve('%,role.eq.admin')).toMatchObject({ valid: false });
  expect(state.from).not.toHaveBeenCalled();
});
it('reports an unavailable lookup as retryable and does not cache it', async () => {
  const limit = async () => ({ data: null, error: { message: 'database unavailable' } });
  state.from.mockReturnValue({ select: () => ({ or: () => ({ limit }) }) });
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  try {
    const result: any = await handler({ queryStringParameters: { code: 'alice' } } as any, {} as any, () => {});
    expect(result.statusCode).toBe(503);
    expect(result.headers['Cache-Control']).toBe('no-store');
    expect(JSON.parse(result.body)).toEqual({ ok: false, error: 'Invite lookup temporarily unavailable' });
  } finally {
    log.mockRestore();
  }
});
