import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handler } from '../signup-welcome';
import { createSupabaseAuthed, findSupabaseAdminForUser } from './supabase';
import { sendBusinessWelcome } from './business-welcome';

import { SIGNUP_GUIDE_LAUNCHED_AT } from '../../../src/content/signupWelcome';

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
  it('returns a retryable error when the email provider rejects delivery', async () => {
    const user = { id: 'real-user', email: 'real@example.com' };
    vi.mocked(createSupabaseAuthed).mockReturnValue({ auth: { getUser: async () => ({ data: { user }, error: null }) } } as any);
    vi.mocked(findSupabaseAdminForUser).mockResolvedValue({ supabaseAdmin: {}, authUser: user } as any);
    vi.mocked(sendBusinessWelcome).mockResolvedValue({ sent: false, reason: 'resend_error_503' });
    const result: any = await handler({ httpMethod: 'POST', headers: { authorization: 'Bearer valid' } } as any, {} as any, () => {});
    expect(result.statusCode).toBe(502);
  });
  it('persists completion on the authenticated account and reports it on later visits', async () => {
    const user = {
      id: 'real-user',
      email: 'real@example.com',
      created_at: new Date(SIGNUP_GUIDE_LAUNCHED_AT).toISOString(),
      email_confirmed_at: new Date().toISOString(),
      app_metadata: { shopper_welcome_sent_at: new Date().toISOString() },
    };
    const updateUserById = vi.fn(async (_id, changes) => {
      Object.assign(user.app_metadata, changes.app_metadata);
      return { error: null };
    });
    vi.mocked(createSupabaseAuthed).mockReturnValue({ auth: { getUser: async () => ({ data: { user } }) } } as any);
    vi.mocked(findSupabaseAdminForUser).mockResolvedValue({
      authUser: user,
      supabaseAdmin: { auth: { admin: { updateUserById } } },
    } as any);
    const request = (method: string) => handler({
      httpMethod: method, headers: { authorization: 'Bearer valid' }, body: '{"id":"another-user"}',
    } as any, {} as any, () => {});
    const before: any = await request('GET');
    expect(JSON.parse(before.body)).toEqual({ completed: false, emailed: true });
    const completion: any = await request('PATCH');
    expect(completion.statusCode).toBe(200);
    expect(updateUserById).toHaveBeenCalledWith(user.id, {
      app_metadata: { signup_welcome_completed_at: expect.any(String) },
    });
    const later: any = await request('GET');
    expect(JSON.parse(later.body)).toEqual({ completed: true, emailed: true });
    await request('PATCH');
    expect(updateUserById).toHaveBeenCalledTimes(1);
    expect(sendBusinessWelcome).not.toHaveBeenCalled();
  });
});
