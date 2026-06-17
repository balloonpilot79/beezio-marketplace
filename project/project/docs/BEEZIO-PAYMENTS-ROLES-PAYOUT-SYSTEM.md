# Beezio Payments, Roles, & Payout System (FINAL – PayPal Approved Model)

**Updated:** January 20, 2026

## 1) Platform Role Definitions (Wording Locked)

### Beezio

Beezio is a marketplace platform that facilitates transactions between buyers and independent sellers.

Beezio is not an employer, not an escrow service, and not an investment platform.

Beezio charges a platform fee for facilitating transactions, payment processing, and marketplace services.

### Seller

Sellers are independent sellers responsible for listing, pricing, fulfillment, and customer satisfaction.

Sellers set their own product prices and Partner commission rates.

Sellers are paid after a standard payout review period.

### Partner (formerly Affiliate)

Partners are independent contractors who promote products listed on Beezio.

Partners may add products from the Beezio marketplace to their own storefronts or links.

Partner commissions are set by the seller, not Beezio.

Partners are paid only on valid, completed sales.

### Influencer

Influencers are independent contractors who refer Partners to the Beezio platform.

Influencers earn a portion of Beezio’s platform fee, not seller or partner earnings.

Influencers do not set prices, commissions, or product terms.

## 2) Platform Fee & Earnings Structure (Locked)

Every sale follows this structure:

- **Gross Sale Amount = 100%**
- **Beezio Platform Fee = 15% TOTAL**
- This fee is never increased due to influencer involvement.

If **NO influencer** is involved:

- Beezio keeps **15%**

If an **influencer IS** involved:

- Influencer receives **5%**
- Beezio keeps **10%**
- Total platform fee remains **15%**

Influencer earnings are paid only from Beezio’s platform fee, never from seller or partner funds.

## 3) Seller & Partner Payout Logic

Seller earnings are calculated after:

- Platform fee
- Partner commission (seller-defined)
- Taxes and shipping rules (if applicable)

Partner commission percentage is:

- Set per product or seller default
- Paid only on completed, undisputed sales

Influencer earnings do not affect seller or partner payouts.

## 4) Payments & Payout Flow (PayPal)

### Checkout

- Buyer completes checkout using PayPal.
- Payment is captured to Beezio’s PayPal Business account.
- Order and payout records are created immediately.

### 14-Day Payout Review Period (Fraud Prevention)

Seller, Partner, and Influencer payouts are subject to a standard review period of up to **14 days**.

This period allows time to detect:

- Fraud
- Chargebacks
- Buyer disputes

During the review period:

- Funds remain in PayPal.
- No payouts are released.
- If a dispute or chargeback occurs, payouts are paused.

## 5) Payout Release & Batch Payments

After 14 days (and if no disputes exist):

- Earnings become eligible for payout
- Payouts are issued using PayPal batch payouts
- Multiple Sellers, Partners, and Influencers are paid at once
- No manual entry per person

Payout requirements:

- Valid PayPal email on file
- Minimum payout threshold (e.g., $25)
- Account in good standing

## 6) Disputes & Chargebacks

If a dispute or chargeback is opened:

- Associated payouts are paused
- Status is marked **ON HOLD – DISPUTE**
- Funds are released only after resolution

If a dispute is lost:

- Related earnings may be reversed or canceled

## 7) Required Payout Notice (Use Site-Wide)

**Payout Timing Notice**

> “To help prevent fraud and handle disputes, seller, partner, and influencer payouts are issued after a standard risk review period of up to 14 days. Payouts may be delayed or canceled if a chargeback, dispute, or suspected fraud is detected.”

## 8) Independent Contractor Status

- Sellers, Partners, and Influencers are independent contractors, not employees.
- Beezio does not guarantee earnings.
- Earnings depend on actual completed sales.
- Beezio does not provide financial, tax, or investment advice.

## 9) Prohibited Language (Do Not Use)

Do **NOT** use:

- Investment
- Passive income
- Guaranteed earnings
- Downline
- Overrides
- Multi-level
- Revenue sharing
- Escrow
- Profit sharing

Use instead:

- Platform fee
- Commission
- Independent contractor
- Payout review period
- Marketplace services

## 10) Compliance Summary (For Processors)

- Beezio facilitates transactions; PayPal processes payments.
- Payout timing is disclosed and contractually agreed.
- Influencers are paid only from Beezio’s platform fee.
- Sellers set prices and commissions.
- Beezio does not custody funds outside PayPal.
- Fraud and dispute controls are in place.

## 11) System Implementation Notes (For Codex)

- Store all payout math at time of sale.
- Never recalculate earnings later.
- Use ledger-based accounting with payout status tracking.
- Never describe funds as “held for sellers”; use “payout review period.”
