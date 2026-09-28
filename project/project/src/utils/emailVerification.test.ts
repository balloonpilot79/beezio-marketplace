import { describe, expect, it } from 'vitest';
import { isBeezioEmailVerified, requiresBeezioEmailVerification } from './emailVerification';

const user = (overrides: Record<string, unknown> = {}) => ({
  created_at: '2026-09-28T00:00:00.000Z',
  email_confirmed_at: '2026-09-28T00:00:01.000Z',
  app_metadata: {},
  user_metadata: {},
  ...overrides,
}) as any;

describe('Beezio email verification', () => {
  it('does not trust Supabase auto-confirmation for new accounts', () => {
    expect(requiresBeezioEmailVerification(user())).toBe(true);
    expect(isBeezioEmailVerified(user())).toBe(false);
  });

  it('accepts the server-only Beezio verification marker', () => {
    expect(isBeezioEmailVerified(user({ app_metadata: { beezio_email_verified: true } }))).toBe(true);
  });

  it('keeps historically confirmed accounts working', () => {
    expect(isBeezioEmailVerified(user({ created_at: '2026-01-01T00:00:00.000Z' }))).toBe(true);
  });

  it('requires verification when signup explicitly requests it', () => {
    expect(isBeezioEmailVerified(user({
      created_at: '2026-01-01T00:00:00.000Z',
      user_metadata: { beezio_verification_required: true },
    }))).toBe(false);
  });
});
