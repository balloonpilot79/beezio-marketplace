import type { User } from '@supabase/supabase-js';

type EmailVerificationUser = Partial<Pick<User, 'id' | 'email_confirmed_at'>>;

// Use the server-owned confirmation timestamp. Editable signup metadata and
// the mere presence of a session never prove ownership of an email address.
export const isBeezioEmailVerified = (user: EmailVerificationUser | null | undefined) =>
  Boolean(user?.email_confirmed_at);

export const requiresBeezioEmailVerification = (user: EmailVerificationUser | null | undefined) =>
  Boolean(user) && !isBeezioEmailVerified(user);
