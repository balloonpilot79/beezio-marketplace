export const CJ_IMPORT_ALLOWED_EMAILS = new Set(
  ['jason@beezio.co', 'jasonlovingsr@gmail.com'].map((email) => email.toLowerCase())
);

export const canAccessCJImport = (email?: string | null): boolean => {
  if (!email) return false;
  return CJ_IMPORT_ALLOWED_EMAILS.has(email.toLowerCase());
};

