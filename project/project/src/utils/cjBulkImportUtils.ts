import Papa from 'papaparse';
import { calculateCustomerProductPrice } from './pricing';

export type PricingRules = {
  affiliate_percent: number;
  affiliate_floor_cents: number;
  affiliate_enabled: boolean;
  markup_type: 'flat' | 'percent';
  markup_value: number;
  paypal_fee_bps: number;
  paypal_fixed_cents: number;
};

export type ShippingTier = {
  min_oz: number;
  max_oz: number;
  shipping_cents: number;
};

export const DEFAULT_RULES: PricingRules = {
  affiliate_percent: 20,
  affiliate_floor_cents: 500,
  affiliate_enabled: true,
  markup_type: 'flat',
  markup_value: 800,
  paypal_fee_bps: 349,
  paypal_fixed_cents: 50,
};

export const DEFAULT_SHIPPING_TIERS: ShippingTier[] = [
  { min_oz: 0, max_oz: 8, shipping_cents: 499 },
  { min_oz: 9, max_oz: 32, shipping_cents: 699 },
  { min_oz: 33, max_oz: 80, shipping_cents: 999 },
  { min_oz: 81, max_oz: 160, shipping_cents: 1499 },
  { min_oz: 161, max_oz: 999999, shipping_cents: 1999 },
];

export const parseCsvPreview = (text: string) => {
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
  });
  return parsed.data || [];
};

export const calculateRetailPriceCents = (costCents: number, rules: PricingRules) => {
  const cost = Math.max(0, Math.round(costCents));
  const markup =
    rules.markup_type === 'percent'
      ? Math.max(Math.round(cost * (Math.max(0, rules.markup_value) / 100)), 300)
      : Math.max(Math.max(0, rules.markup_value), 300);
  const sellerAsk = (cost + markup) / 100;
  const affiliatePercent = rules.affiliate_enabled ? Math.max(0, rules.affiliate_percent) : 0;
  return Math.round(calculateCustomerProductPrice(sellerAsk, 'percent', affiliatePercent) * 100);
};

export const estimateShippingCents = (weightOz: number, tiers: ShippingTier[]) => {
  const weight = Math.max(0, Math.round(weightOz));
  for (const tier of tiers) {
    const min = Math.max(0, Math.round(tier.min_oz));
    const max = Math.max(min, Math.round(tier.max_oz));
    if (weight >= min && weight <= max) {
      return Math.max(0, Math.round(tier.shipping_cents));
    }
  }
  return 0;
};

export const deriveVariantInStock = (params: {
  is_active: boolean;
  inventory: number;
  inventory_policy: 'deny' | 'continue';
}) => {
  if (!params.is_active) return false;
  if (params.inventory_policy === 'continue') return true;
  return params.inventory > 0;
};

export const deriveProductStock = (params: {
  track_inventory: boolean;
  status: 'draft' | 'active' | 'archived';
  variants: Array<{ inventory: number; is_active: boolean; in_stock: boolean }>;
}) => {
  if (!params.track_inventory) {
    return {
      total_inventory: 0,
      in_stock: params.status !== 'archived',
    };
  }
  const activeVariants = params.variants.filter((v) => v.is_active);
  const totalInventory = activeVariants.reduce((acc, v) => acc + Math.max(0, v.inventory), 0);
  const inStock = activeVariants.some((v) => v.in_stock);
  return { total_inventory: totalInventory, in_stock: inStock };
};

export const resolveCategoryMapping = (
  cjCategoryPath: string | null | undefined,
  map: Record<string, string>,
  fallback: string | null
) => {
  if (!cjCategoryPath) return fallback;
  return map[cjCategoryPath] || fallback;
};
