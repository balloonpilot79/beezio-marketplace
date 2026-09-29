import type { User } from '@supabase/supabase-js';

// Email verification is intentionally disabled. Supabase creates an active
// session at signup, and Beezio must not add a second verification gate.
export const requiresBeezioEmailVerification = (_user: Pick<User, 'created_at' | 'user_metadata'>) => false;

export const isBeezioEmailVerified = (user: Pick<User, 'id'> | null | undefined) => Boolean(user);
