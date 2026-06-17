import { computeCustomerListingPrice, type SharedAffiliateCommissionType } from './customerPrice';
import {
  TEST_ITEM_AFFILIATE_AMOUNT,
  TEST_ITEM_PRICE,
  TEST_ITEM_SELLER_AMOUNT,
  isTestItemTitle,
} from './testItemPricing';

const round2 = (value: number): number =>
  Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

const DEFAULT_ZERO_AFFILIATE_PERCENT = 30;

type ProductPricingLike = {
  title?: string | null;
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

const pickPositiveNumber = (...values: unknown[]): number => {
  for (const value of values) {
    const num = Number(value);
    if (Number.isFinite(num) && num > 0) return num;
  }
  return 0;
};

export function resolveStoredAffiliateCommission(product: ProductPricingLike): {
  type: SharedAffiliateCommissionType;
  value: number;
} {
  const affiliateCommissionType = String(product?.affiliate_commission_type || '').trim().toLowerCase();
  const commissionType = String(product?.commission_type || '').trim().toLowerCase();
  const flatCommissionAmount = Number(product?.flat_commission_amount ?? 0);
  const hasFlatAmount = Number.isFinite(flatCommissionAmount) && flatCommissionAmount > 0;
  const normalizedType: SharedAffiliateCommissionType =
    affiliateCommissionType === 'flat' ||
    commissionType === 'flat_rate' ||
    commissionType === 'fixed' ||
    hasFlatAmount
      ? 'flat'
      : 'percent';

  if (normalizedType === 'flat') {
    const flatValue = pickPositiveNumber(
      product?.flat_commission_amount,
      affiliateCommissionType === 'flat' || commissionType === 'flat_rate' || commissionType === 'fixed'
        ? pickPositiveNumber(product?.affiliate_commission_value, product?.affiliate_commission_rate, product?.commission_rate)
        : 0,
    );

    if (!(flatValue > 0)) {
      return { type: 'percent', value: DEFAULT_ZERO_AFFILIATE_PERCENT };
    }

    return {
      type: 'flat',
      value: round2(flatValue),
    };
  }

  const rawPercent = pickPositiveNumber(
    product?.affiliate_commission_value,
    product?.affiliate_commission_rate,
    product?.commission_rate,
    DEFAULT_ZERO_AFFILIATE_PERCENT,
  );

  const percent =
    Number.isFinite(rawPercent) && rawPercent > 0
      ? rawPercent > 1
        ? rawPercent
        : rawPercent * 100
      : DEFAULT_ZERO_AFFILIATE_PERCENT;

  return {
    type: 'percent',
    value: round2(percent),
  };
}

export function applyCanonicalProductPricing<T extends ProductPricingLike>(product: T): T & {
  price: number;
  calculated_customer_price: number;
  seller_ask: number;
  seller_amount: number;
  seller_ask_price: number;
  affiliate_commission_type: SharedAffiliateCommissionType;
  affiliate_commission_value: number;
} {
  if (isTestItemTitle(product?.title)) {
    return {
      ...product,
      price: round2(TEST_ITEM_PRICE),
      calculated_customer_price: round2(TEST_ITEM_PRICE),
      seller_ask: round2(TEST_ITEM_SELLER_AMOUNT),
      seller_amount: round2(TEST_ITEM_SELLER_AMOUNT),
      seller_ask_price: round2(TEST_ITEM_SELLER_AMOUNT),
      affiliate_commission_type: 'flat',
      affiliate_commission_value: round2(TEST_ITEM_AFFILIATE_AMOUNT),
    };
  }

  const sellerAsk = round2(
    pickPositiveNumber(
      product?.seller_ask,
      product?.seller_amount,
      product?.seller_ask_price,
      0,
    )
  );

  const affiliate = resolveStoredAffiliateCommission(product);
  const canonicalPrice = sellerAsk > 0
    ? computeCustomerListingPrice({
        sellerAsk,
        affiliateType: affiliate.type,
        affiliateValue: affiliate.value,
      })
    : round2(Number(product?.price ?? product?.calculated_customer_price ?? 0) || 0);

  return {
    ...product,
    price: round2(canonicalPrice),
    calculated_customer_price: round2(canonicalPrice),
    seller_ask: sellerAsk,
    seller_amount: sellerAsk,
    seller_ask_price: sellerAsk,
    affiliate_commission_type: affiliate.type,
    affiliate_commission_value: affiliate.value,
  };
}
