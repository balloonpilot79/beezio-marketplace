# Beezio Sale Flow

This guide summarizes how a single product sale moves through the Beezio marketplace today.

## 1. Product discovery
- **Marketplace listing**: Public `/marketplace` route shows catalog from sample data (and later real inventory). No login required for browsing.
- **Affiliate link**: Affiliates share deep links such as `/product/:id?ref=AFFILIATE123`. The `ref` query parameter is captured immediately and stored in `localStorage` for later use.

## 2. Product detail & cart
- Guests and logged-in buyers view `/product/:id` for descriptions, ratings, and pricing.
- `Add to Cart` sends the product to `CartContext`, which persists contents in `localStorage`. Multiple items can be added before checkout.

## 3. Account requirement
- Checkout routes (`/checkout`, `EnhancedCheckoutPage`) require authentication. Non-authenticated buyers are redirected to `/signup?redirect=/checkout`.
- Once signed in, the cart is still available because it lives in `localStorage`.

## 4. Checkout & payment
- Checkout pages pull totals from `CartContext` (subtotal, shipping, tax) and render the Stripe Elements form.
- When payment succeeds, the order payload (items, customer, commissions) is logged (placeholder for future backend API).

## 5. Commission split
- If an affiliate `ref` is present, `EnhancedCheckoutPage` calculates an affiliate commission per item and records it via `trackSale`.
- Without a `ref`, the Beezio platform keeps the commission while the seller still receives the net proceeds.

## 6. Post-purchase
- Cart clears and the buyer is sent to `/order-confirmation` with order metadata.
- `affiliate_ref` remains cached so repeat purchases within the same session continue crediting the affiliate.

## Notes & next steps
- Replace sample data with live Supabase product data in `MarketplacePageSimple.tsx` when backend inventory is ready.
- Implement a backend endpoint to receive the order payload and trigger fulfillment, email receipts, and dashboard updates.
- Optional: allow guest checkout by removing the login guard on `/checkout` and capturing email later.
- Pair this reference with `docs/AFFILIATE_PROMOTION_GUIDE.md` so affiliates always know how to generate links and guide buyers to products.
- When you&apos;re ready for gamified badges and leaderboards, run the Supabase migrations in `supabase/migrations` (see `supabase/README.md`).
