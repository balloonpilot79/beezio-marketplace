# Printful + Printify Integration Setup (Beezio)

This guide connects Printful and Printify directly in the Seller Dashboard and enables:
- secure API connection
- product + variant import
- auto fulfillment after PayPal checkout
- webhook updates for fulfillment status

## 1) Environment variables (Netlify)

Required:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ANON_KEY` (or `VITE_SUPABASE_ANON_KEY`)
- `INTEGRATIONS_ENCRYPTION_KEY` (32+ chars; used to encrypt tokens)
- `PAYPAL_ENV=sandbox`
- `PAYPAL_CLIENT_ID` (sandbox app client id)
- `PAYPAL_CLIENT_SECRET` (sandbox app secret)
- `VITE_PAYPAL_CLIENT_ID` (optional; if omitted the app will read it from `/api/paypal/status`)
- `VITE_PAYMENTS_ENABLED=true`
- `VITE_PAYMENT_PROVIDER=paypal`

Optional but recommended:
- `PAYPAL_WEBHOOK_ID` (needed for verifying PayPal webhooks)
- `PRINTIFY_WEBHOOK_SECRET` (used to verify Printify webhooks)
- `PRINTFUL_WEBHOOK_SECRET` (used to verify Printful webhooks)
- `URL` (Netlify provides this automatically; used for webhook URLs)

Notes:
- `INTEGRATIONS_ENCRYPTION_KEY` should be a strong secret (32+ chars).
- Tokens are stored encrypted in `user_integrations.api_key`.

## 2) Database migrations

Run the latest migrations so variants support non-CJ providers:
- `20260130_printful_printify_variants.sql`

This allows:
- `product_variants.source_platform`
- `external_product_id` / `external_variant_id`
- inventory source values `printful` + `printify`

## 3) Seller setup (UI)

1. Sign in as Seller.
2. Go to **Dashboard -> Integrations** (some older UI labels still say "Partner Tools").
3. You should see multiple integrations, not just Printful/Printify:
   - Printful
   - Printify
   - Shopify
   - Etsy
   - Amazon Seller
   - eBay
   - WooCommerce
   - Square
   - BigCommerce
   - CSV Import
4. Choose **Printful** or **Printify**.
5. Paste the API key.
6. Click **Connect**.

We connect the first store/shop on the token.  
To switch stores, disconnect and reconnect with a token tied to the desired store.

## 4) Import products

1. Click **Import** on Printful/Printify.
2. Set the affiliate commission rate (seller-controlled).
3. Optionally enable **Auto Sync**.
4. Import.

Imported products:
- use Beezio checkout + commission model
- create variants mapped to Printful/Printify IDs
- default to $0 shipping (edit each product if you want to charge shipping)

## 5) Fulfillment after PayPal purchase

After PayPal capture:
- Beezio records the order
- `fulfillment-dispatch` creates Printful/Printify orders
- `vendor_orders` tracks provider order IDs + status

You can verify in:
- Seller Dashboard -> Orders & Shipping
- `vendor_orders` table

## 6) Webhooks

Endpoints:
- `/api/integrations/printify/webhook`
- `/api/integrations/printful/webhook`

These update `vendor_orders` + order `fulfillment_status`.

## 7) Troubleshooting

- **Import fails**: re-connect integration and try again.
- **No variants created**: confirm product has variants in provider.
- **Fulfillment not triggered**: confirm PayPal capture succeeded and order exists.
- **Webhook not firing**: verify `URL` is correct and webhook is registered.

