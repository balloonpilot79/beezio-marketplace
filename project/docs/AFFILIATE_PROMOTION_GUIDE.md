# Affiliate Promotion Guide

Use this checklist when affiliates want to share Beezio products with their audience. It covers how links are generated, what the buyer sees, and tips for maximizing conversions.

---

## 1. Select products to promote
1. **Log in** and open `/affiliate/products`.
2. Use the filters to find a relevant product.
3. Click the **"+"** button to add a product to the promotion list. Selected items highlight in blue.

You can select multiple products; they’ll all appear in the fixed bar at the bottom with your potential earnings.

---

## 2. Copy the affiliate link
1. On a selected product, tap **Copy Link**. This calls `generateAffiliateLink(productId)` and produces a URL like:
   ```
   https://yourdomain.com/product/<PRODUCT_ID>?ref=<AFFILIATE_ID>
   ```
2. The link is copied to the clipboard (the button briefly shows **Copied!**).
3. Share that link anywhere: social posts, email newsletters, DMs, blog articles, QR codes, etc.

> **Tip:** The link works for anonymous shoppers. They can browse the marketplace without an account and only need to sign up at checkout.

---

## 3. Buyer journey
1. A buyer clicks the link and lands on `/product/:id`.
2. The app stores the `ref` query value in `localStorage` so the affiliate stays credited through the entire session.
3. The buyer can add the product to their cart immediately (no login required yet).
4. When they go to `/checkout`, they’ll be prompted to sign in or create a Beezio account.
5. After purchase, `EnhancedCheckoutPage` calls `trackSale`, passing the affiliate ID, order total, and commission amount.

---

## 4. Where the commission data flows
- `affiliate_ref` is captured in `AppWorking.tsx` and `ProductDetailPageSimple.tsx`.
- Checkout retrieves it, calculates affiliate earnings, and fires `trackSale` (see `EnhancedCheckoutPage.tsx`).
- Future backend work should write this data to Supabase so it appears in dashboards and payouts.

---

## 5. Conversion best practices
- **Context:** Include a short benefit-driven blurb when sharing the link. Example: “🚀 Launch your brand in 7 days with Beezio’s Shopify Mastery playbook. Grab it here: <affiliate link>.”
- **Bundles:** Share multiple products in an email by listing each benefit and link.
- **Retargeting:** Use QR codes on posters or slides to drive traffic to the same affiliate URL.
- **Follow-up:** Remind your audience that they keep seeing curated products inside `/marketplace` after their first click—the affiliate ID stays attached, so you’re still credited.

---

## 6. Troubleshooting checklist
- If the copy button doesn’t work, the browser may block clipboard access. In that case, open the product via the “View” button and copy the URL manually.
- Make sure your audience loads the product page over HTTPS. Some browsers strip the `ref` query on mixed-content (HTTP) links.
- If you test locally, add `?ref=test-affiliate` to any product URL and verify the commission shows in the checkout summary.

---

## 7. What’s next
- Hook `trackSale` into a Supabase function or backend API for persistent reporting.
- Add a pre-written social caption generator near the **Copy Link** button to help affiliates share faster.
- Expand `/affiliate/:affiliateId` pages so affiliates have a branded storefront people can browse after one click.
