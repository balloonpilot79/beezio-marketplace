import { ADMIN_EMAIL_ALLOWLIST } from '../../shared/adminAccess';

export const canAccessCJImport = (email?: string | null): boolean => {
  if (!email) return false;
  return ADMIN_EMAIL_ALLOWLIST.has(email.toLowerCase());
};
