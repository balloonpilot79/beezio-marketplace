# Beezio Insurance And Service Lab Plan

## Goal

Build a private-beta marketplace flow where Beezio can help local insurance agents, life insurance agents, and service providers get traffic while:

- Beezio earns platform revenue
- Affiliates earn commissions
- The local agent or provider gets the lead or sale
- The platform avoids pretending to be the carrier or agency

This should stay behind the current monetization lab gate until compliance, routing, and payout logic are complete.

## Recommended Business Model

Start with a lead marketplace, not a policy-binding marketplace.

Beezio should not try to sell the policy directly in phase 1. Beezio should:

- list an insurance offer
- capture a quote request or lead form
- send that lead to the local licensed agent
- track the lead outcome
- pay commissions only when the lead reaches the agreed milestone

This keeps the model much safer than trying to act like the insurer.

## Core Offer Types

Use the same hidden lab framework for all non-physical offers.

- `insurance`
  Purpose: quote request, callback booking, lead routing, local agent promotion
- `service`
  Purpose: local or remote professionals, consulting, coaching, home services
- `saas`
  Purpose: recurring subscriptions with affiliate payout logic
- `affiliate_offer`
  Purpose: third-party offer where Beezio tracks referral traffic and conversion events

## Insurance Monetization Model

The cleanest path is milestone payouts instead of instant checkout.

### Revenue events

- `lead_submitted`
  Buyer submits a quote request form
- `lead_qualified`
  Agent confirms valid contact + valid interest
- `appointment_booked`
  Lead books a call or consultation
- `policy_bound`
  Policy is actually sold

### Who gets paid

- Agent pays Beezio for traffic or validated leads
- Beezio pays affiliate from Beezio's revenue share
- Optional: Beezio can also charge premium placement or monthly subscription to agents

### Recommended payout rules for phase 1

- Beezio only pays affiliate on `lead_qualified` or later
- Do not pay on raw click
- Do not pay on unverified form submit
- Use reversible commissions until outcome is confirmed

Example:

- Agent agrees to pay Beezio `$40` per qualified life insurance lead
- Affiliate commission is `25%`
- Affiliate earns `$10`
- Beezio keeps `$30`

If policy-bound commissions become possible later:

- agent or agency reports closed policy event
- Beezio records payout basis
- affiliate can receive flat or percentage bonus on close

## Recommended Agent Pricing Options

Beezio should support several models because different agents will want different terms.

- Pay per qualified lead
- Pay per booked appointment
- Pay per closed policy
- Monthly subscription for listing + routing tools
- Premium listing fee + affiliate lead flow

Best starting option:

- pay per qualified lead
- optional monthly profile subscription

That is the easiest model to explain and track.

## Data Model To Add Later

Do not build all of this at once. This is the minimum useful structure.

### `provider_profiles`

Represents insurance agents, local businesses, and service providers.

Suggested fields:

- `id`
- `user_id`
- `business_name`
- `provider_type` (`insurance_agent`, `life_insurance_agent`, `service_provider`, `saas_vendor`)
- `license_number`
- `license_state`
- `service_areas`
- `is_verified`
- `lead_pricing_model`
- `lead_price_amount`
- `booking_price_amount`
- `closed_sale_price_amount`
- `accepting_new_leads`

### `provider_offers`

Represents the hidden-lab offer listing.

Suggested fields:

- `id`
- `provider_id`
- `product_id`
- `offer_type`
- `headline`
- `category_id`
- `coverage_types`
- `service_regions`
- `target_customer`
- `quote_form_enabled`
- `booking_enabled`
- `external_booking_url`
- `status`

### `lead_events`

Tracks each lead lifecycle step.

Suggested fields:

- `id`
- `offer_id`
- `provider_id`
- `affiliate_id`
- `buyer_id`
- `event_type`
- `event_value`
- `notes`
- `created_at`
- `verified_by`

### `lead_payout_rules`

Maps when Beezio and affiliates earn.

Suggested fields:

- `id`
- `offer_id`
- `trigger_event`
- `provider_charge_amount`
- `affiliate_payout_amount`
- `platform_net_amount`
- `is_recurring`

## MVP Product Flow

Phase 1 should look like this:

1. Local agent creates a hidden lab insurance offer
2. Affiliate gets a Beezio tracking link
3. Buyer lands on the offer page
4. Buyer submits quote request form
5. Lead enters `pending`
6. Agent marks lead `qualified` or `rejected`
7. If `qualified`, Beezio creates ledger entries
8. Affiliate dashboard shows pending/approved earnings

That gives you an insurance engine that behaves like affiliate physical products, but with lead milestones instead of cart checkout.

## Compliance Positioning

Beezio should not present itself as:

- the insurance carrier
- the licensed agency
- the advisor making policy recommendations

Beezio should present itself as:

- a marketplace
- a referral and lead-routing platform
- a promotion and affiliate network for licensed local agents

Minimum compliance language for MVP:

- Beezio is a marketing and referral platform
- insurance products are offered by licensed professionals or agencies
- coverage availability varies by state and carrier approval
- affiliates may not make misleading claims or quote policy terms
- commissions may depend on validated lead or sale outcomes

## What Makes This A Game Changer

This becomes differentiated when Beezio combines:

- local provider discovery
- affiliate traffic generation
- milestone-based payout tracking
- one platform for products, services, referrals, and recurring offers

The unique angle is not "we also list insurance."
The unique angle is "local agents and local service providers can grow through the same affiliate engine that sellers use."

## Implementation Order

Do this in order.

1. Keep lab hidden in the product form
2. Add provider profile model for agents/providers
3. Add quote request form and lead table
4. Add lead status workflow in dashboard
5. Add payout ledger for qualified leads
6. Add affiliate tracking for insurance offers
7. Add compliance copy and admin moderation
8. Only then consider public launch

## Immediate Next Build Target

The next concrete feature should be:

`Insurance Lead Intake MVP`

That should include:

- hidden insurance offer creation
- public lead form
- agent lead inbox
- qualified/rejected statuses
- ledger entries for Beezio and affiliate earnings

