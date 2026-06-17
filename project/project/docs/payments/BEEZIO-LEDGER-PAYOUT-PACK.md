# Beezio Ledger + Payout Pack (Copy/Paste)

This document is the full “do it all” pack in copy/paste format.

## Quick repo mapping (Beezio current codebase)
- Supabase already has payout tables + PayPal support migrations:
  - `supabase/migrations/20260120_add_paypal_payout_ledger.sql`
  - `supabase/migrations/20260121_paypal_mvp_netlify.sql`
  - `supabase/migrations/20260107_fix_payout_tables.sql`
  - `supabase/migrations/20260122_fix_paypal_accounts_rls.sql`
- Netlify API routes are defined in `netlify.toml` and already match these endpoints:
  - `POST /api/paypal/create-order`
  - `POST /api/paypal/capture-order`
  - `POST /api/paypal/webhook`
  - `POST /api/payouts/run-batch`
  - `POST /api/payouts/sync-status`

If you’re starting a brand new Supabase project (greenfield), the schema blueprint is also available as a file:
- `docs/payments/BEEZIO-LEDGER-PAYOUT-SCHEMA-GREENFIELD.sql`

---

# 1) DATABASE SCHEMA (SUPABASE / POSTGRES) — COPY & PASTE

## A. ENUMS (optional but recommended)
```sql
-- Order lifecycle
create type order_status as enum (
  'OPEN',
  'FULFILLING',
  'DELIVERED',
  'DISPUTED',
  'REFUNDED',
  'CANCELED',
  'MATURED',        -- 14-day hold cleared
  'CLOSED'
);

-- Ledger line types
create type ledger_line_type as enum (
  'GROSS_SALE',
  'PROCESSOR_FEE',
  'SALES_TAX',
  'SHIPPING_CHARGED',
  'COGS',                  -- cost of goods sold (CJ cost or seller cost if you model it)
  'BEEZIO_PLATFORM_FEE',
  'SELLER_NET_PAYABLE',
  'AFFILIATE_COMMISSION_PAYABLE',
  'INFLUENCER_OVERRIDE_PAYABLE',
  'REFUND',
  'CHARGEBACK',
  'ADJUSTMENT'
);

-- Payee roles
create type payee_role as enum ('SELLER','AFFILIATE','INFLUENCER','BEEZIO');

-- Payout batch status
create type payout_batch_status as enum ('DRAFT','READY','SENT','PARTIAL','FAILED','CANCELED');

-- Payout line status
create type payout_line_status as enum ('QUEUED','SENT','PAID','FAILED','CANCELED');

-- Payment processor
create type payment_processor as enum ('PAYPAL','STRIPE','MANUAL');

-- Fulfillment type
create type fulfillment_type as enum ('CJ','SELLER');
```

## B. USERS / PAYOUT PROFILES
```sql
create table public.user_payout_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  role payee_role not null,

  -- PayPal
  paypal_email text,

  -- Bank ACH (if you do bank payouts later)
  bank_routing_last4 text,
  bank_account_last4 text,
  bank_account_type text,

  -- Tax / compliance (minimal storage - you can store “received/verified” flags instead of raw SSN)
  tax_w9_status text default 'NOT_COLLECTED', -- NOT_COLLECTED | COLLECTED | VERIFIED
  tax_country text default 'US',
  tax_entity_type text, -- INDIVIDUAL | BUSINESS
  tax_last_verified_at timestamptz,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index on public.user_payout_profiles(user_id);
create index on public.user_payout_profiles(role);
```

## C. ORDERS (HIGH LEVEL)
```sql
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text unique not null,

  buyer_user_id uuid,
  storefront_user_id uuid,         -- whose store link was used
  product_id uuid,
  seller_user_id uuid,             -- null if CJ/Beezio-owned
  fulfillment fulfillment_type not null default 'CJ',

  processor payment_processor not null,
  processor_payment_id text,       -- PayPal capture id or Stripe payment_intent id
  processor_charge_id text,        -- Stripe charge id if needed

  currency text not null default 'USD',
  status order_status not null default 'OPEN',

  ordered_at timestamptz default now(),
  matured_at timestamptz,          -- ordered_at + 14 days (set when created)
  delivered_at timestamptz,
  refunded_at timestamptz,

  notes text,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index on public.orders(status);
create index on public.orders(processor);
create index on public.orders(seller_user_id);
create index on public.orders(storefront_user_id);
```

## D. LEDGER (THE HEART) — ONE ORDER = MANY LINES
```sql
create table public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,

  line_type ledger_line_type not null,
  amount_cents bigint not null,         -- positive or negative
  currency text not null default 'USD',

  -- Who this line belongs to (if payable)
  payee_user_id uuid,
  payee_role payee_role,

  -- Useful tags
  metadata jsonb default '{}'::jsonb,

  created_at timestamptz default now()
);

create index on public.ledger_entries(order_id);
create index on public.ledger_entries(line_type);
create index on public.ledger_entries(payee_user_id);
```

## E. PAYOUT BATCHES + LINES (AUTOMATION OUTPUT)
```sql
create table public.payout_batches (
  id uuid primary key default gen_random_uuid(),
  processor payment_processor not null,       -- PAYPAL or MANUAL or STRIPE (if using bank, still MANUAL)
  status payout_batch_status not null default 'DRAFT',

  pay_period_start date not null,
  pay_period_end date not null,
  scheduled_pay_date date not null,

  created_by uuid,
  created_at timestamptz default now(),
  sent_at timestamptz,
  external_batch_id text,                     -- PayPal payouts batch id, etc.
  notes text
);

create table public.payout_lines (
  id uuid primary key default gen_random_uuid(),
  payout_batch_id uuid not null references public.payout_batches(id) on delete cascade,

  payee_user_id uuid not null,
  payee_role payee_role not null,
  payout_method payment_processor not null,   -- PAYPAL or MANUAL

  destination text,                           -- paypal email or bank token reference
  amount_cents bigint not null,
  currency text not null default 'USD',

  -- link back to orders for audit
  order_ids uuid[] not null default '{}'::uuid[],

  status payout_line_status not null default 'QUEUED',
  external_payout_id text,                    -- PayPal item id
  error text,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index on public.payout_lines(payout_batch_id);
create index on public.payout_lines(payee_user_id);
create index on public.payout_lines(status);
```

## F. DAILY CASH “SAFE TO MOVE” SNAPSHOT (DASHBOARD)
```sql
create table public.cash_snapshots (
  id uuid primary key default gen_random_uuid(),
  snapshot_date date not null unique,

  processor payment_processor not null default 'PAYPAL',
  processor_balance_cents bigint not null default 0,

  reserve_tax_cents bigint not null default 0,
  reserve_pending_seller_cents bigint not null default 0,
  reserve_pending_affiliate_cents bigint not null default 0,
  reserve_pending_influencer_cents bigint not null default 0,

  safe_to_transfer_cents bigint not null default 0,

  created_at timestamptz default now()
);
```

---

# 2) ORDER MATH (SINGLE SOURCE OF TRUTH) — COPY & PASTE

This is the exact breakdown Beezio should compute at checkout confirmation:

Inputs:
- gross_sale (what buyer pays)
- tax_collected
- shipping_charged
- processor_fee (PayPal/Stripe)
- fulfillment_type: CJ or SELLER
- cogs: CJ cost (if CJ) OR seller_cost if you track it
- beezio_platform_fee_rate = 15% of (item subtotal) OR (gross) — pick ONE definition and keep it consistent
- affiliate_commission_rate = seller-set OR beezio-set depending on listing
- influencer_override_rate = 5% of BEEZIO PLATFORM FEE (not of gross)

Compute:
1) beezio_platform_fee = base * 0.15
2) influencer_override = beezio_platform_fee * 0.05   (ONLY if influencer is attached)
3) beezio_net_platform_fee = beezio_platform_fee - influencer_override
4) affiliate_commission = base * affiliate_rate  (ONLY if affiliate involved)
5) seller_net = base - (seller_cost if used) - (affiliate_commission if seller-funded) - (beezio_platform_fee if seller-funded)
   NOTE: For your model: seller chooses what THEY get, so seller_net may be a fixed target and you solve backwards for final price.

Reserves:
- Tax reserve = tax_collected
- Payout reserves = seller_net + affiliate_commission + influencer_override (if any)
- Beezio immediately usable (CJ purchases) = gross_sale - reserves - processor_fee (but NEVER spend tax reserve)

Important: Pick one consistent base:

easiest: base = item_subtotal (gross minus tax minus shipping)

---

# 3) PAYPAL FLOW (END-TO-END) — COPY & PASTE

## PAYPAL SETUP (ON PAYPAL)
PAYPAL SETUP CHECKLIST:
1) Create/upgrade Beezio PayPal Business account
2) Confirm business info, EIN, address, phone
3) Add bank account for transfers
4) Enable PayPal Checkout (Smart Buttons)
5) Enable Webhooks:
   - CHECKOUT.ORDER.APPROVED
   - PAYMENT.CAPTURE.COMPLETED
   - PAYMENT.CAPTURE.DENIED
   - PAYMENT.CAPTURE.REFUNDED
   - CUSTOMER.DISPUTE.CREATED (if available)
6) Apply for/enable PayPal Payouts (Mass Pay)
7) (Optional) enable PayPal Fraud Protection / risk tools

## PAYPAL FLOW (IN BEEZIO)
PAYPAL BUY FLOW:
1) Buyer clicks "Pay with PayPal" → create PayPal order (server)
2) Buyer approves → PayPal returns to Beezio
3) Beezio captures payment (server)
4) On CAPTURE COMPLETED:
   - create Orders row (status OPEN)
   - set matured_at = ordered_at + 14 days
   - write ledger lines:
     * GROSS_SALE +X
     * PROCESSOR_FEE -Y
     * SALES_TAX +T (reserve)
     * SHIPPING_CHARGED +S (if you charge it)
     * COGS -C (if CJ cost known now or later)
     * BEEZIO_PLATFORM_FEE +F
     * SELLER_NET_PAYABLE +SN (only if 3rd-party seller)
     * AFFILIATE_COMMISSION_PAYABLE +AC (if affiliate)
     * INFLUENCER_OVERRIDE_PAYABLE +IO (if influencer)
   - send fulfillment order to CJ (if CJ)
   - mark order FULFILLING

PAYDAY AUTOMATION (PAYPAL)
PAYDAY JOB (RUNS DAILY 7:00 AM CT):
A) Find all orders where:
   status in (DELIVERED, FULFILLING) AND matured_at <= now() AND not closed/refunded/disputed
B) Aggregate payable balances:
   - sellers: sum(SELLER_NET_PAYABLE) by seller_user_id
   - affiliates: sum(AFFILIATE_COMMISSION_PAYABLE) by affiliate_user_id
   - influencers: sum(INFLUENCER_OVERRIDE_PAYABLE) by influencer_user_id
C) Build payout_batch (status READY) with payout_lines:
   - destination = payee paypal_email
   - order_ids = list of included order ids
D) Execute PayPal Payouts API:
   - create batch
   - store external_batch_id
   - update each payout_line external_payout_id
E) Mark payout_lines SENT/PAID as callbacks arrive
F) Update orders:
   - If all payables for that order have been paid, set status = CLOSED

DAILY “SAFE TO TRANSFER” DASHBOARD
SAFE TO TRANSFER (DAILY):
1) Pull PayPal balance (manual for beta OR API later)
2) Compute reserves:
   tax_reserve = sum(SALES_TAX for OPEN/MATURED but not remitted)
   pending_seller = sum(SELLER_NET_PAYABLE unpaid)
   pending_affiliate = sum(AFFILIATE_COMMISSION_PAYABLE unpaid)
   pending_influencer = sum(INFLUENCER_OVERRIDE_PAYABLE unpaid)
3) safe_to_transfer = paypal_balance - (tax + pending_seller + pending_affiliate + pending_influencer)
4) Save in cash_snapshots
5) Display: “Move this much to bank” (or keep in PayPal for next pay run)

---

# 4) STRIPE FLOW (END-TO-END) — COPY & PASTE

## STRIPE SETUP (ON STRIPE)
STRIPE SETUP CHECKLIST:
1) Stripe account (Beezio as merchant)
2) Stripe Checkout enabled
3) Webhooks:
   - checkout.session.completed
   - payment_intent.succeeded
   - charge.refunded
   - charge.dispute.created
4) Payout schedule (daily/weekly) to bank
5) (Optional later) Stripe Connect ONLY if approved for your platform model

## STRIPE FLOW (IN BEEZIO)
STRIPE BUY FLOW:
1) Buyer checkout → Stripe Checkout Session created (server)
2) Webhook: checkout.session.completed / payment_intent.succeeded:
   - create Orders row (OPEN)
   - set matured_at = ordered_at + 14 days
   - write ledger lines same as PayPal
   - trigger fulfillment (CJ)

PAYDAY (STRIPE) — RECOMMENDED OPTION A (BANK ACH)
STRIPE PAYDAY MODEL:
- Stripe collects money
- Stripe pays Beezio bank on Stripe payout schedule
- Beezio runs payouts from bank (ACH) OR a contractor payroll tool

Beezio automation still builds payout_batches and payout_lines,
but payout_method = MANUAL (bank ACH) until you integrate an ACH provider.

Important:
- Stripe is NOT paying your sellers directly unless using Connect.
- You are paying sellers/affiliates/influencers as contractors.

---

# 5) API ENDPOINTS (BACKEND) — COPY & PASTE

Use these exact endpoints to keep it clean.

AUTH REQUIRED for all except webhooks.

PAYPAL:
POST   /api/paypal/create-order
POST   /api/paypal/capture-order
POST   /api/paypal/webhook

STRIPE:
POST   /api/stripe/create-checkout-session
POST   /api/stripe/webhook

LEDGER/ORDERS:
GET    /api/orders/:id
GET    /api/orders?status=OPEN
GET    /api/ledger?order_id=...

PAYOUTS:
POST   /api/payouts/run-payday        (admin)
GET    /api/payouts/batches
GET    /api/payouts/batches/:id
POST   /api/payouts/batches/:id/send  (admin)

DASHBOARD:
POST   /api/cash/snapshot/run         (admin or scheduled)
GET    /api/cash/snapshot/latest

Repo mapping (this codebase):
- Current payout runner routes are:
  - `POST /api/payouts/run-batch`
  - `POST /api/payouts/sync-status`

---

# 6) COPILOT / CODEX TODO LIST (IMPLEMENT EVERYTHING) — COPY & PASTE

BEEZIO PAYMENTS + PAYOUTS IMPLEMENTATION TODO (PAYPAL + STRIPE)

PHASE 1 — DATABASE
[ ] Add enums: order_status, ledger_line_type, payee_role, payout_batch_status, payout_line_status, payment_processor, fulfillment_type
[ ] Create tables: user_payout_profiles, orders, ledger_entries, payout_batches, payout_lines, cash_snapshots
[ ] Add indexes and foreign keys
[ ] Add RLS policies (admin writes; users read their own payouts/ledger)

PHASE 2 — CHECKOUT + LEDGER WRITES
[ ] Implement "calculate_order_breakdown()" (single source of truth)
[ ] PayPal: create-order + capture-order endpoints
[ ] Stripe: create-checkout-session endpoint
[ ] On successful payment:
    - insert order row
    - set matured_at = ordered_at + interval '14 days'
    - insert ledger lines for every component (gross, fee, tax, seller payable, affiliate payable, influencer payable, platform fee)
[ ] Add idempotency guard so webhook replays don’t double-write ledger

PHASE 3 — FULFILLMENT HOOKS
[ ] For CJ fulfillment:
    - after payment success, enqueue CJ purchase job
    - store CJ order id in orders.notes or metadata
[ ] Update order status: OPEN → FULFILLING → DELIVERED (as tracking updates)

PHASE 4 — PAYDAY ENGINE (MOST IMPORTANT)
[ ] Build query: "matured, not disputed/refunded, unpaid payables"
[ ] Aggregate totals by payee:
    - seller totals
    - affiliate totals
    - influencer totals
[ ] Create payout_batch row with pay_period_start/end and scheduled_pay_date
[ ] Create payout_lines with destination (paypal_email) and included order_ids
[ ] PayPal payouts integration:
    - send payout batch
    - store external_batch_id
    - update payout_lines with external ids
[ ] Webhook handling for payout status updates:
    - payout item success/failure → update payout_line status

PHASE 5 — CASH SNAPSHOT DASHBOARD
[ ] Create function "compute_reserves()"
[ ] Daily job: save cash_snapshots record
[ ] Admin UI: show breakdown + "safe_to_transfer" amount
[ ] Show “pending obligations” totals per category

PHASE 6 — SELLER/AFFILIATE/INFLUENCER UI
[ ] Profile page: collect PayPal email + tax status flags
[ ] Payout history page: show payout_lines where payee_user_id = me
[ ] Earnings page: sum ledger_entries by type and timeframe
[ ] Order attribution page: show which orders credited commissions

PHASE 7 — ADMIN CONTROLS (BETA SAFETY)
[ ] Admin toggle: "pause payouts"
[ ] Admin: regenerate payout batch preview without sending
[ ] Admin: exclude disputed orders from payouts automatically
[ ] Admin: manual adjustments ledger line type ADJUSTMENT

PHASE 8 — STRIPE BACKUP
[ ] Implement Stripe webhook + ledger insert (same breakdown function)
[ ] Set processor = STRIPE on orders
[ ] Keep payday engine identical but mark payout_method MANUAL (bank)

Repo checklist (this codebase):
- The repo-specific checklist lives in `docs/payments/IMPLEMENTATION-CHECKLIST.md`.

---

# 7) ACCOUNTANT HANDOFF DOC

Use: `docs/payments/ACCOUNTANT-HANDOFF.md`
