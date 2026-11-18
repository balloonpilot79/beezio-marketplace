# Facebook Page publishing

Apply the outbox migration to the test database first. Events begin at migration time. Listing or activating a product and adding or reactivating an affiliate placement create separate receipts in the same database transaction. Previously active rows are not backfilled.

Configure the worker on the sandbox site with its own SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, FACEBOOK_WORKER_SECRET, FACEBOOK_LISTING_ORIGIN (the HTTPS test storefront), FACEBOOK_GRAPH_VERSION, FACEBOOK_PAGE_IDS and FACEBOOK_PAGE_TOKENS. The last two are server-side JSON maps. Page keys include main, ca, ca/orange and ca/orange/irvine; values are numeric Page IDs. Tokens are keyed by Page ID. Configure only test Page tokens during acceptance. Load validated ZIP-to-place records into facebook_zip_locations for county rollout. Ambiguous ZIPs use the most specific unambiguous match in the profile state.

Configure a trusted scheduler to POST to /.netlify/functions/facebook-share-worker with Authorization: Bearer followed by the worker secret. Each call drains one event. Scale calls to match listing volume. No automatic scheduler or production enablement is included in this branch.

Inspect facebook_share_attempts for status and returned Facebook post IDs. Preparation failures delay the next attempt by one minute. After an ambiguous HTTP result or an interrupted send, the worker holds the event for review; interrupted claims become unknown on a subsequent invocation after fifteen minutes. Check Page history before manually recording the existing post ID and marking it published. Requeue only after confirming Facebook did not create the post. Do not bulk-requeue unknown rows.

Acceptance requires a test Page and a PayPal sandbox storefront with its own database. List once, add from three affiliates, confirm four receipts and four Page posts, then buy through both California posts in separate buyer sessions. Match order IDs, captured payments, affiliate IDs and all applicable referral ledger rows.
