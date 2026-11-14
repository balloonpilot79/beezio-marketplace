# Beezio POD fulfillment and repricing controls — 2026-11-13

## Current order-source record
See `pod-supplier-order-source-audit-2026-11-13.csv`. This is a snapshot of existing supplier mappings, **not** proof that any replacement supplier is connected. The original mappings remain authoritative for existing live orders until verified migration.

## Required per-product supplier record
- Beezio product ID and variant ID
- Design/artwork source and print file requirements
- Supplier company and fulfillment country
- Supplier product and variant identifiers; SKU and size/color mapping
- Unit production cost and destination-specific shipping
- Any import duties/tariffs/taxes, and confirmation of DDP or domestic fulfillment
- Processing and platform fee policy
- Seller earnings, affiliate payout, all applicable ambassador allocations, processing reserve
- Total checkout price, seller payout, Beezio net margin
- Supplier API credentials connection status (never store secrets here)
- Order submission method: API auto-submit or **manual order required**
- Verified sample/test order ID and date, shipping ETA, tracking and cancellation/returns process

## Pricing gate
Do not change a live price based on advertised base production prices. Require a verified quote for the exact garment/size/color/print placement and shipping destination, including all supplier costs and any duties. Recalculate price using the *current production pricing code*, retaining the established seller/affiliate/ambassador payouts, Beezio tiered fees, PayPal processing, and reserves. Check each variant for nonnegative net margin. Do not expose private commission/fee breakdown publicly.

## Fulfillment gate
Do not change the `dropship_provider`, external product/variant identifiers, or order routing until artwork is uploaded, supplier accepts orders, and a real end-to-end test confirms order submission, tracking, refunds, and customer notifications. If fulfillment is manual, mark that explicitly and do not represent it as automatic.

## Buyer promise
Free standard shipping should mean zero shipping collected from the buyer at checkout; all shipping cost must be included in the retail price. For international suppliers require DDP or equivalent confirmed handling so buyers are not billed import duties on delivery. Aim for 7–14 days but do not promise that without a supplier SLA.

## Migration priority
1. Existing shirts
2. Hoodies and other apparel
3. Rugs and blankets
4. Stickers/decals and wall art
5. New equestrian, racing, and original retro-humor designs

## Current status
Supplier snapshot created. Replacement supplier pricing, product mapping, account access, and test orders **not yet verified**. Do not alter live listings until gates pass.
