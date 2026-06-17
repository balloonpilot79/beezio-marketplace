# Accountant Handoff (Beezio Payments + Payouts)

## What the accountant needs from Beezio
- Entity details: legal name, EIN, entity type, registered address, state nexus assumptions.
- Payment processor access:
  - PayPal business account (read-only/reporting access if possible)
  - Stripe account (if enabled)
- Reporting policy decisions:
  - Revenue recognition timing (order paid vs delivered vs after 14-day hold)
  - Platform fee definition base (gross vs subtotal)
  - Tax handling approach (collected vs remitted; reserve model)
  - Dispute/chargeback accounting treatment

## What Beezio should provide (exports)
Provide these on a predictable cadence (weekly/monthly):
- Orders export:
  - order id, order number, timestamps (paid/delivered/refunded), processor ids
  - gross totals, tax collected, shipping charged
- Payout obligations export:
  - by seller/partner/influencer: amounts accrued, amounts paid, amounts held
- Payout execution export:
  - payout batch id, pay date, recipient, amount, PayPal payout item id, status
- Disputes/refunds export:
  - dispute status, amounts reversed, hold events

In this repo, likely sources are:
- `public.orders` (+ `public.order_items`)
- `public.payout_ledger`
- `public.payout_batches` + `public.payout_items`
- (Optional) `public.payment_distributions` + `public.user_earnings`

## What Beezio needs back from the accountant
- Chart of accounts mapping for:
  - gross sales
  - processor fees
  - tax liabilities
  - payout liabilities (seller/partner/influencer)
  - platform revenue
  - refunds/chargebacks
- Recommended thresholds/controls:
  - minimum payout thresholds
  - reserve percentages (if any)
  - dispute hold rules

## Suggested monthly package (minimum viable)
- One CSV: orders for the month
- One CSV: payouts paid that month
- One CSV: unpaid liabilities at month-end (held + ready)
- One PDF: PayPal/Stripe monthly statement exports

## Notes (privacy/compliance)
- Do not store raw SSNs in product DB.
- If collecting W-9/W-8 forms, store only verification flags and the vendor record id from your tax vendor.
