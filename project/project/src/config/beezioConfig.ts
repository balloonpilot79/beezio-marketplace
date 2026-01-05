// Beezio business rules and payout constants live here so everything stays in sync.
// Keep these values centralized to avoid hard-coding percentages across the app.

export const PLATFORM_FEE_PERCENT = 15; // Beezio fee as % of sale
// Additional platform fee rule: for low-priced items ($20 and under), add a $1 fixed fee to the Beezio fee.
export const PLATFORM_FEE_UNDER_20_SURCHARGE = 1;
export const PLATFORM_FEE_UNDER_20_THRESHOLD = 20;
export const REFERRAL_OVERRIDE_PERCENT_OF_SALE = 5; // Paid to referrer, funded out of platform fee
export const STRIPE_PERCENT = 2.9; // Stripe variable fee %
export const STRIPE_FIXED_FEE = 0.3; // Stripe fixed fee per order
export const DEFAULT_AFFILIATE_COMMISSION_PERCENT = 10;
export const DEFAULT_FUNDRAISER_PERCENT = 0;

export interface PayoutSettings {
  affiliatePercent: number; // % of final sale price
  platformPercent: number; // typically 15
  fundraiserPercent?: number; // optional, defaults to 0
}

// Helpful default object for areas that need sane fallbacks.
export const DEFAULT_PAYOUT_SETTINGS: PayoutSettings = {
  affiliatePercent: DEFAULT_AFFILIATE_COMMISSION_PERCENT,
  platformPercent: PLATFORM_FEE_PERCENT,
  fundraiserPercent: DEFAULT_FUNDRAISER_PERCENT,
};
