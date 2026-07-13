const PUBLIC_PARTNER_COPY_FLAG = 'NEXT_PUBLIC_PUBLIC_PARTNER_COPY';

const getEnvFlag = () => {
  const env = (import.meta as any)?.env || {};
  const value = String(env[PUBLIC_PARTNER_COPY_FLAG] ?? '').trim().toLowerCase();
  if (!value) return true;
  return value !== 'false' && value !== '0' && value !== 'off';
};

export const isPublicPartnerCopyEnabled = () => getEnvFlag();

export const getPartnerLabel = () => (isPublicPartnerCopyEnabled() ? 'Affiliates' : 'Affiliates');
export const getPartnerSingularLabel = () => (isPublicPartnerCopyEnabled() ? 'Affiliate' : 'Affiliate');
export const getPartnerProgramLabel = () => (isPublicPartnerCopyEnabled() ? 'Affiliate Program' : 'Affiliate Program');
export const getPartnerPromotionLabel = () =>
  (isPublicPartnerCopyEnabled() ? 'Affiliate Promotions' : 'Affiliate Promotions');
