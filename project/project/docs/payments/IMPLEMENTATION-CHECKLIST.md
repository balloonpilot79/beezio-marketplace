# Beezio Payments + Payouts Implementation Checklist

This checklist matches the “do it all” pack and is written to fit *this repo’s* structure (Supabase + Netlify Functions).

## Phase 1 — Database
- [ ] Confirm existing tables in Supabase: `orders`, `order_items`, `payout_ledger`, `paypal_accounts`, `payout_batches`, `payout_items`, `paypal_webhook_events`
- [ ] Apply missing migrations to the target Supabase project (especially RLS-related migrations)
- [ ] Ensure RLS policies align with the repo’s profile model (`profiles.user_id = auth.uid()`)
- [ ] Decide whether you need a true multi-line ledger (`ledger_entries`) or whether `payout_ledger` + `payment_distributions` is sufficient for MVP

## Phase 2 — Checkout + ledger writes
- [ ] Single source of truth breakdown function
  - [ ] Confirm/standardize on one base: `base = subtotal (gross - tax - shipping)`
  - [ ] Confirm platform fee %, partner %, influencer override rules
- [ ] PayPal:
  - [ ] `POST /api/paypal/create-order`
  - [ ] `POST /api/paypal/capture-order`
  - [ ] `POST /api/paypal/webhook` (idempotent writes via `paypal_webhook_events`)
- [ ] Stripe (optional backup):
  - [ ] Add/verify create-session + webhook flows if desired
- [ ] On successful payment:
  - [ ] Create/update `orders` record
  - [ ] Create `payout_ledger` row(s) with hold release timestamp
  - [ ] (Optional) Create `payment_distributions` rows if you want per-payee line items for reporting

## Phase 3 — Fulfillment hooks
- [ ] CJ fulfillment enqueue after payment success
- [ ] Track shipping + delivery status updates into `orders`
- [ ] Dispute/refund events set appropriate flags and pause payouts

## Phase 4 — Payday engine
- [ ] Query: hold cleared and not disputed/refunded
- [ ] Aggregate payable totals per payee
- [ ] Create `payout_batches` + `payout_items`
- [ ] Execute PayPal Payouts:
  - [ ] Store provider batch + item IDs
  - [ ] Handle partial failures
- [ ] Sync payout statuses and mark `payout_ledger` rows paid

## Phase 5 — Cash snapshot (safe-to-transfer)
- [ ] Decide beta strategy: manual PayPal balance entry vs API
- [ ] Compute reserves for tax + unpaid payables
- [ ] Persist daily snapshot table (if adding) and surface in admin UI

## Phase 6 — UI
- [x] Payout email onboarding + settings UI (PayPal)
- [ ] Payout history page (show payouts to user)
- [ ] Earnings breakdown page (sum by type/time)

## Phase 7 — Admin controls
- [ ] “Pause payouts” kill-switch
- [ ] Preview payout batch (dry-run)
- [ ] Manual adjustment flow (admin-only)

## Phase 8 — Stripe backup
- [ ] Keep payday engine identical; mark payout_method MANUAL unless using Connect
