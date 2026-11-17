import { describe, expect, it } from 'vitest';
import { isBeezioEmailVerified, requiresBeezioEmailVerification } from './emailVerification';

const user = (overrides: Record<string, unknown> = {}) => ({
  id: 'account',
  created_at: '2026-11-17T00:00:00.000Z',
  email_confirmed_at: null,
  app_metadata: {},
  user_metadata: {},
  ...overrides,
}) as any;

describe('Beezio email ownership verification', () => {
  it('requires confirmation for an unconfirmed new signup even if a session exists', () => {
    expect(requiresBeezioEmailVerification(user())).toBe(true);
    expect(isBeezioEmailVerified(user())).toBe(false);
  });
  it('does not trust editable metadata or an unrelated confirmation marker', () => {
    expect(isBeezioEmailVerified(user({ user_metadata: { email_verified: true, beezio_email_verified: true } }))).toBe(false);
    expect(isBeezioEmailVerified(user({ app_metadata: { beezio_email_verified: true } }))).toBe(false);
  });
  it('accepts actual Supabase email confirmation', () => {
    const confirmed = user({ email_confirmed_at: '2026-11-17T01:00:00Z' });
    expect(isBeezioEmailVerified(confirmed)).toBe(true);
    expect(requiresBeezioEmailVerification(confirmed)).toBe(false);
  });
  it('preserves existing confirmed accounts and ignores stale signup metadata', () => {
    expect(isBeezioEmailVerified(user({ created_at: '2026-01-01T00:00:00Z', email_confirmed_at: '2026-01-01T00:00:01Z', user_metadata: { beezio_verification_required: true } }))).toBe(true);
  });
  it('does not treat a missing user as verified', () => {
    expect(isBeezioEmailVerified(null)).toBe(false);
    expect(isBeezioEmailVerified(undefined)).toBe(false);
  });
});
