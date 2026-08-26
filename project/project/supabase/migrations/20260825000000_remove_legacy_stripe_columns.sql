-- Beezio is PayPal-only. Remove legacy Stripe identifiers and fee fields.
-- IF EXISTS keeps this migration safe for environments where a column was already removed.
ALTER TABLE IF EXISTS public.checkout_intents DROP COLUMN IF EXISTS stripe_session_id;
ALTER TABLE IF EXISTS public.checkout_intents DROP COLUMN IF EXISTS stripe_payment_intent_id;
ALTER TABLE IF EXISTS public.customer_subscriptions DROP COLUMN IF EXISTS stripe_subscription_id;
ALTER TABLE IF EXISTS public.customer_subscriptions DROP COLUMN IF EXISTS stripe_customer_id;
ALTER TABLE IF EXISTS public.orders DROP COLUMN IF EXISTS stripe_payment_intent_id;
ALTER TABLE IF EXISTS public.orders DROP COLUMN IF EXISTS stripe_session_id;
ALTER TABLE IF EXISTS public.payment_distributions DROP COLUMN IF EXISTS stripe_transfer_id;
ALTER TABLE IF EXISTS public.payouts DROP COLUMN IF EXISTS stripe_transfer_id;
ALTER TABLE IF EXISTS public.products DROP COLUMN IF EXISTS stripe_fee;
ALTER TABLE IF EXISTS public.profiles DROP COLUMN IF EXISTS stripe_account_id;
ALTER TABLE IF EXISTS public.profiles DROP COLUMN IF EXISTS stripe_customer_id;
ALTER TABLE IF EXISTS public.referral_commissions DROP COLUMN IF EXISTS stripe_transfer_id;
ALTER TABLE IF EXISTS public.sellers DROP COLUMN IF EXISTS stripe_account_id;
ALTER TABLE IF EXISTS public.subscription_billings DROP COLUMN IF EXISTS stripe_invoice_id;
ALTER TABLE IF EXISTS public.transactions DROP COLUMN IF EXISTS stripe_payment_intent_id;
