export const PASSWORD_REQUIREMENT_MESSAGE =
  'Password must be at least 8 characters and include uppercase, lowercase, a number, and a symbol.';

export const validatePasswordPolicy = (password: string): string | null => {
  if (password.length < 8) return PASSWORD_REQUIREMENT_MESSAGE;
  if (!/[a-z]/.test(password)) return PASSWORD_REQUIREMENT_MESSAGE;
  if (!/[A-Z]/.test(password)) return PASSWORD_REQUIREMENT_MESSAGE;
  if (!/\d/.test(password)) return PASSWORD_REQUIREMENT_MESSAGE;
  if (!/[^a-zA-Z\d]/.test(password)) return PASSWORD_REQUIREMENT_MESSAGE;
  return null;
};

