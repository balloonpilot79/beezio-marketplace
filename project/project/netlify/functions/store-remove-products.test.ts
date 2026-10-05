import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ auth: vi.fn(), owners: vi.fn(), remove: vi.fn(), db: {} }));
vi.mock('./_lib/supabase', () => ({ createSupabaseAdmin: () => mocks.db }));
vi.mock('./_lib/auth', () => ({ extractAuthHeader: (event: any) => event.headers.authorization || '', getAuthedUser: mocks.auth }));
vi.mock('./_lib/owned-profiles', () => ({ resolveOwnedProfileIdsForUser: mocks.owners }));
vi.mock('./_lib/store-product-removal', () => ({ removeStoreProducts: mocks.remove }));
import { handler } from './store-remove-products';
const id = 'b6d9fb96-1d1d-4b80-a467-762afc8b4068';
const event = (body: any, token = 'Bearer valid') => ({ httpMethod: 'POST', headers: { authorization: token }, body: JSON.stringify(body) });
async function run(input: any) { return await (handler as any)(input, {}); }
beforeEach(() => { vi.clearAllMocks(); mocks.auth.mockResolvedValue({ user: { id: 'auth-user' } }); mocks.owners.mockResolvedValue(['auth-user', 'profile']); mocks.remove.mockResolvedValue(undefined); });
describe('authenticated store removal', () => {
  it('ignores caller-supplied ownership and removes only JWT-owned selections', async () => {
    const result = await run(event({ role: 'affiliate', product_ids: [id], affiliate_id: 'victim', owner_ids: ['victim'] }));
    expect(result.statusCode).toBe(200);
    expect(mocks.remove).toHaveBeenCalledWith(mocks.db, ['auth-user', 'profile'], [id], 'affiliate');
  });
  it('rejects unauthenticated calls without a mutation', async () => {
    expect((await run(event({ role: 'affiliate', product_ids: [id] }, ''))).statusCode).toBe(401);
    expect(mocks.remove).not.toHaveBeenCalled();
  });
  it('rejects a forged or expired session', async () => {
    mocks.auth.mockResolvedValue({ user: null });
    expect((await run(event({ role: 'affiliate', product_ids: [id] }))).statusCode).toBe(401);
    expect(mocks.remove).not.toHaveBeenCalled();
  });
  it('rejects invalid ids and returns deletion failures', async () => {
    expect((await run(event({ role: 'affiliate', product_ids: ['bad'] }))).statusCode).toBe(400);
    mocks.remove.mockRejectedValue(new Error('Deletion failed'));
    const result = await run(event({ role: 'seller', product_ids: [id] }));
    expect(result.statusCode).toBe(500);
    expect(JSON.parse(result.body).ok).toBe(false);
  });
});
