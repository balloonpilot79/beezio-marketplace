# Lifetime buyer influencer referrals — implementation contract

Status: approved product direction; implementation and production deployment pending.

## Invariants
- Existing seller and affiliate lifetime influencer attribution and payouts remain unchanged.
- Buyer accounts remain buyer-only; ambassadors use existing business accounts and referral links.
- One permanent referring ambassador per buyer, assigned on registration via verified referral token. Do not overwrite an existing attribution. Prevent self-referrals and circular attribution.
- Pay $0.25 per qualifying *order* (not per item) on every future completed purchase by that buyer, subject to refund/dispute reversals and fraud rules.
- Fund solely from Beezio's existing platform fee; do not increase buyer prices or reduce seller/affiliate payouts. The existing $0.25 internal reserve is separate and must not be silently repurposed.
- Do not award if the platform's fee after other obligations cannot safely cover $0.25; establish a deterministic low-priced-item policy before launch.
- Use integer cents and idempotent unique ledger entries keyed by order and commission type. Server-side verified PayPal capture is the source of truth. Refunds/chargebacks reverse or hold commissions exactly once.
- Maintain existing 14-day hold and $5 role payout threshold.
- No public display of internal fee allocations or influencer payout amounts.

## Implementation checklist
1. Audit live buyer signup, existing referral token capture, influencer_referrals, order capture webhook, commission ledger and payout jobs.
2. Add permanent buyer-attribution storage with restrictive RLS and an immutable unique buyer key. Backfill only where attribution is provable.
3. On buyer registration, validate and bind inviter exactly once, never by mutable client-side user metadata.
4. On verified paid order, resolve the buyer's inviter, check net available Beezio fee and create one pending $0.25 ledger entry transactionally.
5. Integrate the existing hold/reversal/payout logic and display buyer referral earnings in the ambassador dashboard.
6. Test first purchase, repeat purchase, no referral, duplicate webhook, multi-item order, refund, partial refund, self-referral, simultaneous registration, $1 item, existing seller/affiliate commissions, and PayPal flow.
7. Deploy only after migration, tests, production data review and explicit release verification. No Stripe reintroduction.

## Acceptance criteria
- A buyer referred once generates $0.25 per qualifying future order for the same ambassador.
- The buyer is not converted into a business account.
- No existing seller/affiliate payout changes.
- No double credit, payout on unpaid orders, or checkout price changes.
