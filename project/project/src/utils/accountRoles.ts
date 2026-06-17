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
