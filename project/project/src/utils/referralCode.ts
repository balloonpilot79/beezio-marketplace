export const buildDeterministicReferralCode = (profileId: string): string => {
  const compact = String(profileId || '').replace(/-/g, '').toUpperCase();
  return compact ? `BZO${compact}` : '';
};
