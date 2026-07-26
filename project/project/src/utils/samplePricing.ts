import { computeFixedTierPricing } from '../../shared/customerPrice';

const SAMPLE_MARKUP_BASE = 2;
const SAMPLE_MARKUP_OVER_50 = 3;
const SAMPLE_MARKUP_STEP_OVER_50 = 3.5;
const SAMPLE_STEP_THRESHOLD = 50;

const roundToTwo = (value: number): number =>
  Math.round((Number.isFinite(value) ? value : 0 + Number.EPSILON) * 100) / 100;

export const calculateSamplePriceFromCost = (baseCost: number): number => {
  const clean = Number(baseCost);
  if (!Number.isFinite(clean) || clean <= 0) return 0;
  let markup = SAMPLE_MARKUP_BASE;
  if (clean > SAMPLE_STEP_THRESHOLD) {
    const steps = Math.floor((clean - SAMPLE_STEP_THRESHOLD) / SAMPLE_STEP_THRESHOLD) + 1;
    markup = SAMPLE_MARKUP_OVER_50 + SAMPLE_MARKUP_STEP_OVER_50 * steps;
  }
  return roundToTwo(computeFixedTierPricing({
    sellerPayout: clean + markup,
    affiliatePayout: 0,
  }).finalAdvertisedPrice);
};

type SamplePriceInput = {
  sample_enabled?: boolean | null;
  sample_price?: number | null;
  base_cost?: number | null;
};

export const resolveSamplePrice = (product: SamplePriceInput): number | null => {
  if (!product?.sample_enabled) return null;
  const explicit = Number(product.sample_price);
  if (Number.isFinite(explicit) && explicit > 0) {
    return roundToTwo(explicit);
  }
  const computed = calculateSamplePriceFromCost(Number(product.base_cost));
  return computed > 0 ? computed : null;
};
