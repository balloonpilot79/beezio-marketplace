const DEFAULT_ADMIN_EMAILS = ['jason@beezio.co', 'jasonlovingsr@gmail.com', 'shop@beezio.co'];

const normalizeEmail = (email?: string | null): string => String(email || '').trim().toLowerCase();

export const ADMIN_EMAIL_ALLOWLIST = new Set(DEFAULT_ADMIN_EMAILS.map(normalizeEmail).filter(Boolean));

export const isAllowedAdminEmail = (email?: string | null): boolean => {
  const normalized = normalizeEmail(email);
  return Boolean(normalized && ADMIN_EMAIL_ALLOWLIST.has(normalized));
};

export const buildAdminEmailAllowlist = (envValue?: string | null): string[] => {
  const envEmails = String(envValue || '')
    .split(',')
    .map(normalizeEmail)
    .filter(Boolean);

  return Array.from(new Set([...ADMIN_EMAIL_ALLOWLIST, ...envEmails]));
};
