const PUBLIC_PARTNER_COPY_FLAG = 'NEXT_PUBLIC_PUBLIC_PARTNER_COPY';

const getEnvFlag = () => {
  const env = (import.meta as any)?.env || {};
  const value = String(env[PUBLIC_PARTNER_COPY_FLAG] ?? '').trim().toLowerCase();
  if (!value) return true;
  return value !== 'false' && value !== '0' && value !== 'off';
};

export const isPublicPartnerCopyEnabled = () => getEnvFlag();

export const getPartnerLabel = () => (isPublicPartnerCopyEnabled() ? 'Partners' : 'Partners');
export const getPartnerSingularLabel = () => (isPublicPartnerCopyEnabled() ? 'Partner' : 'Partner');
export const getPartnerProgramLabel = () => (isPublicPartnerCopyEnabled() ? 'Partner Program' : 'Partner Program');
export const getPartnerPromotionLabel = () =>
  (isPublicPartnerCopyEnabled() ? 'Partner Promotions' : 'Partner Promotions');
