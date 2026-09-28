import type { User } from '@supabase/supabase-js';

// Accounts created before Beezio's custom verification rollout keep using
// Supabase's historical email-confirmed value. New accounts must also carry
// the server-only app_metadata marker written by signup-confirm-email.
export const BEEZIO_EMAIL_VERIFICATION_ENFORCEMENT_START = Date.parse('2026-09-27T00:00:00.000Z');

export const requiresBeezioEmailVerification = (user: Pick<User, 'created_at' | 'user_metadata'>) => {
  if (user?.user_metadata?.beezio_verification_required === true) return true;
  const createdAt = Date.parse(String(user?.created_at || ''));
  return Number.isFinite(createdAt) && createdAt >= BEEZIO_EMAIL_VERIFICATION_ENFORCEMENT_START;
};

export const isBeezioEmailVerified = (
  user: Pick<User, 'created_at' | 'email_confirmed_at' | 'app_metadata' | 'user_metadata'> | null | undefined,
) => {
  if (!user) return false;
  if (user.app_metadata?.beezio_email_verified === true) return true;
  if (requiresBeezioEmailVerification(user)) return false;
  return Boolean(user.email_confirmed_at);
};
