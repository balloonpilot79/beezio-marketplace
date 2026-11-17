import { beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ user: {} as any, database: vi.fn() }));
vi.mock('../../netlify/functions/_lib/supabase', () => ({
  findSupabaseAdminForUser: async () => ({ authUser: state.user, supabaseAdmin: { from: state.database } }),
}));
vi.mock('../../netlify/functions/_lib/business-welcome', () => ({ sendBusinessWelcome: vi.fn() }));
import { handler as bootstrap } from '../../netlify/functions/signup-bootstrap';
import { handler as check } from '../../netlify/functions/signup-check-verification';
const request = (handler: any) => handler({ httpMethod: 'POST', body: JSON.stringify({ userId: 'account', email: 'test@example.test' }) }, {});
beforeEach(() => {
  state.database.mockReset();
  state.user = { id: 'account', created_at: new Date().toISOString(), email_confirmed_at: null, user_metadata: { email_verified: true } };
});
it('blocks server-side account setup before email ownership is proven', async () => {
  const response = await request(bootstrap);
  expect(response.statusCode).toBe(403);
  expect(JSON.parse(response.body).code).toBe('EMAIL_NOT_VERIFIED');
  expect(state.database).not.toHaveBeenCalled();
});
it('does not mistake user-editable metadata for confirmation', async () => {
  const response = await request(check);
  expect(JSON.parse(response.body).confirmed).toBe(false);
});
it('recognizes a native Supabase confirmation without requiring the legacy custom marker', async () => {
  state.user.email_confirmed_at = new Date().toISOString();
  const response = await request(check);
  expect(JSON.parse(response.body).confirmed).toBe(true);
});
