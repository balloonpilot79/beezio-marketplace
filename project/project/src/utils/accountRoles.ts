export const normalizeAccountRole = (role: unknown) => {
  const normalized = String(role || '').trim().toLowerCase();
  return normalized === 'partner' ? 'affiliate' : normalized;
};

export const getNormalizedAccountRoles = (...sources: unknown[]) =>
  Array.from(
    new Set(
      sources
        .flatMap((source) => (Array.isArray(source) ? source : [source]))
        .map(normalizeAccountRole)
        .filter(Boolean)
    )
  );

export const isBuyerOnlyAccount = (roles: string[]) => {
  const normalized = getNormalizedAccountRoles(roles);
  if (!normalized.length) return true;
  return normalized.every((role) => role === 'buyer' || role === 'customer');
};

export const canUseStoreTools = (roles: string[]) => !isBuyerOnlyAccount(roles);

  
export const BUSINESS_ACCOUNT_ROLES = ['seller', 'affiliate', 'influencer'] as const;
export type BusinessAccountRole = (typeof BUSINESS_ACCOUNT_ROLES)[number];

export const getBusinessAccountRoles = (...sources: unknown[]): BusinessAccountRole[] => {
  const normalized = getNormalizedAccountRoles(...sources);
  return BUSINESS_ACCOUNT_ROLES.filter((role) => normalized.includes(role));
};

export const hasBusinessAccountAccess = (...sources: unknown[]) =>
  getBusinessAccountRoles(...sources).length > 0;
