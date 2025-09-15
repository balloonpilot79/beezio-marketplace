Stripe Connect & Supabase Edge Functions — Staging deploy checklist

This file documents the minimal steps to deploy the Stripe Connect staging flow and required secrets.

Secrets required (staging/test mode):
- SUPABASE_URL (readonly for functions that only need to call other functions; for admin ops use service role key)
- SUPABASE_SERVICE_ROLE_KEY (server-side only; **never** commit)
-- STRIPE_SECRET_KEY ([REDACTED_SK_TEST])
-- STRIPE_WEBHOOK_SECRET ([REDACTED_WHSEC])

Functions to deploy:
- create-stripe-account
- get-stripe-account-status
- create-payment-intent
- stripe-webhook
- complete-order-corrected

Minimum steps (Supabase Edge Functions):
1. Set environment variables in Supabase project -> Settings -> Environment variables. Add `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, and `STRIPE_WEBHOOK_SECRET`.
2. Deploy functions:
   - Using supabase CLI: `supabase functions deploy create-stripe-account --project-ref <project-ref>` (repeat for each function)
3. In Stripe Dashboard -> Developers -> Webhooks:
   - Add endpoint: `https://<your-supabase-project>.functions.supabase.co/stripe-webhook` (or the full functions URL returned after deploy)
   - Subscribe to events: `payment_intent.succeeded`, `payment_intent.payment_failed`, `transfer.*` and `checkout.session.completed` if using Checkout.
   - Copy the webhook signing secret and paste into `STRIPE_WEBHOOK_SECRET` in Supabase env.
4. Test with Stripe CLI:
   - `stripe listen --forward-to https://<your-func-url>/stripe-webhook`
   - Create test payment: use the `test-checkout-flow.js` script or use the frontend checkout.

Notes:
- The `create-payment-intent` function will attempt to detect the seller's `stripe_account_id` from the `profiles` table and create a direct charge (transfer_data.destination) with `application_fee_amount` set to 10% by default. Adjust logic if you prefer platform to take a different fee.
- Ensure `SUPABASE_SERVICE_ROLE_KEY` is only configured in server env and not exposed to client-side code.
- For production, switch `STRIPE_SECRET_KEY` to a live key and follow Stripe onboarding / identity verification flows for 1099 compliance.

If you want me to deploy to staging, provide deploy credentials or add secrets to the target environment and tell me which provider (Supabase, Netlify, Vercel).