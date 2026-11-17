import { buildDeterministicReferralCode } from './referralCode';
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

export const getInfluencerPublicCode = ({ referralCode, profileId }: InfluencerCodeInput): string => {
  // Store aliases may arrive asynchronously or change. Only publish permanent
  // account identity; the resolver accepts both stored and full deterministic codes.
  const code = String(referralCode || '').trim();
  if (code) return code;
  return buildDeterministicReferralCode(String(profileId || '').trim());
};
