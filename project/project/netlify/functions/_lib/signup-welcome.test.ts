import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handler } from '../signup-welcome';
import { createSupabaseAuthed, findSupabaseAdminForUser } from './supabase';
import { sendBusinessWelcome } from './business-welcome';

vi.mock('./supabase', () => ({ createSupabaseAuthed: vi.fn(), findSupabaseAdminForUser: vi.fn() }));
vi.mock('./business-welcome', () => ({ sendBusinessWelcome: vi.fn() }));
beforeEach(() => vi.clearAllMocks());

describe('signup welcome endpoint', () => {
  it('rejects an unauthenticated request before looking up any recipient', async () => {
    const result: any = await handler({ httpMethod: 'POST', headers: {}, body: '{"email":"other@example.com"}' } as any, {} as any, () => {});
    expect(result.statusCode).toBe(401);
    expect(sendBusinessWelcome).not.toHaveBeenCalled();
  });
  it('rejects invalid sessions', async () => {
    vi.mocked(createSupabaseAuthed).mockReturnValue({ auth: { getUser: async () => ({ data: {}, error: 'invalid' }) } } as any);
    const result: any = await handler({ httpMethod: 'POST', headers: { authorization: 'Bearer invalid' } } as any, {} as any, () => {});
    expect(result.statusCode).toBe(401);
    expect(sendBusinessWelcome).not.toHaveBeenCalled();
  });
  it('uses the authenticated account and ignores a client-supplied destination', async () => {
    const user = { id: 'real-user', email: 'real@example.com' };
    const db = {};
    vi.mocked(createSupabaseAuthed).mockReturnValue({ auth: { getUser: async () => ({ data: { user }, error: null }) } } as any);
    vi.mocked(findSupabaseAdminForUser).mockResolvedValue({ supabaseAdmin: db, authUser: user } as any);
    vi.mocked(sendBusinessWelcome).mockResolvedValue({ sent: true });
    const result: any = await handler({ httpMethod: 'POST', headers: { authorization: 'Bearer valid' }, body: '{"email":"other@example.com"}' } as any, {} as any, () => {});
    expect(result.statusCode).toBe(200);
    expect(findSupabaseAdminForUser).toHaveBeenCalledWith(user.id, user.email);
    expect(sendBusinessWelcome).toHaveBeenCalledWith(db, user);
  });
});
