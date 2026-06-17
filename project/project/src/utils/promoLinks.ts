import { getBuyerFacingProductPrice } from './buyerPrice';

type PromoPriceProduct = {
  price?: number | null;
  calculated_customer_price?: number | null;
  seller_ask?: number | null;
  seller_amount?: number | null;
  seller_ask_price?: number | null;
  commission_rate?: number | null;
  affiliate_commission_rate?: number | null;
  commission_type?: string | null;
  flat_commission_amount?: number | null;
  affiliate_commission_type?: 'percent' | 'flat' | null;
  affiliate_commission_value?: number | null;
};

type InfluencerCodeInput = {
  username?: string | null;
  storeSlug?: string | null;
  storeName?: string | null;
  referralCode?: string | null;
  profileId?: string | null;
};

export const slugifyPromoValue = (value: string): string =>
  String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);

export const getPromoDisplayPrice = (product: PromoPriceProduct): number => getBuyerFacingProductPrice(product || {});

export const getInfluencerPublicCode = ({ username, storeSlug, storeName, referralCode, profileId }: InfluencerCodeInput): string => {
  const slug = String(storeSlug || '').trim();
  if (slug) return slug;

  const normalizedUsername = String(username || '').trim();
  if (normalizedUsername) return normalizedUsername;

  const normalizedStoreName = String(storeName || '').trim();
  if (normalizedStoreName) return slugifyPromoValue(normalizedStoreName);

  const normalizedReferralCode = String(referralCode || '').trim();
  if (normalizedReferralCode) return normalizedReferralCode;

  const id = String(profileId || '').trim();
  const compact = id.replace(/-/g, '').toLowerCase();
  return compact ? `bzo-${compact.slice(0, 10)}` : '';
};