import { getProductShipping } from './productShipping';
import { DOLLAR_CHECKOUT_TEST, isDollarCheckoutTest } from './dollarCheckoutTest';
import { computeCustomerListingPrice, type SharedAffiliateCommissionType } from './customerPrice';
import {
  TEST_ITEM_AFFILIATE_AMOUNT,
  TEST_ITEM_PRICE,
  TEST_ITEM_SELLER_AMOUNT,
  isTestItemTitle,
} from './testItemPricing';

const round2 = (value: number): number =>
  Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

const DEFAULT_ZERO_AFFILIATE_PERCENT = 0;

type ProductPricingLike = {
  id?: string | null;
  title?: string | null;
  price?: number | null;
  calculated_customer_price?: number | null;
  seller_ask?: number | null;
  seller_amount?: number | null;
  seller_ask_price?: number | null;
  affiliate_enabled?: boolean | null;
  affiliate_payout_amount?: number | null;
  shipping_reserve_amount?: number | null;
  shipping_price?: number | null;
  shipping_cost?: number | null;
  is_digital?: boolean | null;
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
  if (product?.affiliate_enabled === false) return { type: 'flat', value: 0 };
  const payout = product?.affiliate_payout_amount == null ? NaN : Number(product.affiliate_payout_amount);
  if (Number.isFinite(payout) && payout >= 0) return { type: 'flat', value: round2(payout) };
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

/** Public storefronts must preserve the published buyer price, including shipping. */
export function applyStorefrontProductPricing<T extends ProductPricingLike>(product: T) {
  const storedBuyerPrice = Number(product?.calculated_customer_price);
  if (Number.isFinite(storedBuyerPrice) && storedBuyerPrice > 0) {
    return { ...product, price: storedBuyerPrice, calculated_customer_price: storedBuyerPrice };
  }
  return applyCanonicalProductPricing(product);
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
  if (isDollarCheckoutTest(product?.id)) {
    const test = DOLLAR_CHECKOUT_TEST;
    return {
      ...product,
      price: test.finalAdvertisedPrice,
      calculated_customer_price: test.finalAdvertisedPrice,
      seller_ask: test.sellerPayout,
      seller_amount: test.sellerPayout,
      seller_ask_price: test.sellerPayout,
      affiliate_commission_type: 'flat',
      affiliate_commission_value: test.affiliatePayout,
    };
  }
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
        shippingIncluded: getProductShipping(product),
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
