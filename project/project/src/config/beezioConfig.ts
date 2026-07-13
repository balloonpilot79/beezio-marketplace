// Beezio business rules and payout constants live here so everything stays in sync.
// Keep these values centralized to avoid hard-coding percentages across the app.

import {
  DEFAULT_BEEZIO_LARGE_ORDER_FLAT_FEE,
  DEFAULT_BEEZIO_LARGE_ORDER_THRESHOLD,
  DEFAULT_BEEZIO_PERCENT_RATE_THRESHOLD,
  DEFAULT_BEEZIO_PLATFORM_FEE_CAP,
  DEFAULT_BEEZIO_PLATFORM_FEE_MIN,
  DEFAULT_BEEZIO_PLATFORM_RATE,
  DEFAULT_BEEZIO_UNDER_THRESHOLD_FLAT_FEE,
} from '../../shared/beezioFee';

export const PLATFORM_FEE_PERCENT = DEFAULT_BEEZIO_PLATFORM_RATE * 100; // Platform fee % applied to seller ask
export const PLATFORM_FEE_UNDER_20_SURCHARGE = DEFAULT_BEEZIO_UNDER_THRESHOLD_FLAT_FEE;
export const PLATFORM_FEE_UNDER_20_THRESHOLD = DEFAULT_BEEZIO_PERCENT_RATE_THRESHOLD;
export const MIN_PLATFORM_FEE = DEFAULT_BEEZIO_PLATFORM_FEE_MIN;
export const MAX_PLATFORM_FEE = DEFAULT_BEEZIO_PLATFORM_FEE_CAP;
export const LARGE_ORDER_PLATFORM_FEE_THRESHOLD = DEFAULT_BEEZIO_LARGE_ORDER_THRESHOLD;
export const LARGE_ORDER_PLATFORM_FEE = DEFAULT_BEEZIO_LARGE_ORDER_FLAT_FEE;
export const MIN_AFFILIATE_PAYOUT = 0;
export const SELLER_REFERRER_BONUS_PER_ITEM = 0.5;
export const AFFILIATE_REFERRER_BONUS_PER_ITEM = 0.5;
// Referral bonuses are fixed per sold item:
// - under $25 ask => $0.50 per eligible referral slot
// - $25 and above ask => $1.00 per eligible referral slot
export const INFLUENCER_SHARE_OF_PLATFORM_FEE_PERCENT = 0;
// Backward-compatible alias used by existing pricing utilities.
export const REFERRAL_OVERRIDE_PERCENT_OF_SALE = INFLUENCER_SHARE_OF_PLATFORM_FEE_PERCENT;
export const PROCESSING_PERCENT = 3.99; // PayPal processing variable fee %
export const PROCESSING_FIXED_FEE = 0.6; // Card processing fixed fee per item/order (see pricing model)
export const DEFAULT_AFFILIATE_COMMISSION_PERCENT = 10;
export const INFLUENCER_BONUS_THRESHOLD = 25;
export const INFLUENCER_BONUS_UNDER_THRESHOLD = 0.5;
export const INFLUENCER_BONUS_AT_OR_ABOVE_THRESHOLD = 1;
// Prelaunch guardrail: keep ratings/reviews/social-proof counters at zero unless real data exists post-launch.
export const PRELAUNCH_ZERO_SOCIAL_PROOF = true;

export interface PayoutSettings {
  affiliatePercent: number; // % of seller ask (seller-controlled)
  platformPercent: number; // typically 15
}

// Helpful default object for areas that need sane fallbacks.
export const DEFAULT_PAYOUT_SETTINGS: PayoutSettings = {
  affiliatePercent: DEFAULT_AFFILIATE_COMMISSION_PERCENT,
  platformPercent: PLATFORM_FEE_PERCENT,
};
