Deploying frontend to Netlify + backend (Edge Functions) to Supabase

1) Configure GitHub repo
- Add `NETLIFY_AUTH_TOKEN` and `NETLIFY_SITE_ID` to GitHub Actions secrets.
- Optional: Add CI environment variables (VITE_SUPABASE_URL, VITE_STRIPE_PUBLISHABLE_KEY) in the Netlify site settings or GitHub secrets and use in workflow.

2) Push to `main` to trigger frontend deploy
- The workflow `deploy-netlify.yml` builds and deploys `dist` to Netlify.

3) Deploy backend (Supabase Edge Functions) separately
- Install supabase CLI and login.
- From the project root, run the deploy wrapper (we added `scripts/deploy-supabase-functions.cmd`):
  - `scripts\deploy-supabase-functions.cmd <project-ref>`
- This will push secrets from your local `.env` and deploy Edge Functions to Supabase.

4) Configure Stripe webhooks for the Supabase endpoint:
- Use the Stripe dashboard or Stripe CLI to forward events to `https://<supabase-project>.functions.supabase.co/stripe-webhook`.
- Set `STRIPE_WEBHOOK_SECRET` as a Supabase secret (or ensure it's in your `.env` and push with the deploy script).

5) Test the flow
- Create seller/affiliate accounts (use the seller/affiliate dashboards to create/connect Stripe accounts).
- Use the storefront UI to create an order and checkout.
- Check Supabase tables: `orders`, `transactions`, `payment_distributions`, `payouts`, `payout_batches`.

If you want, I can now:
- Finalize the Supabase function edits and tests, and create a PR for the Netlify workflow changes.
- Or, deploy to Netlify now if you provide GitHub repo secrets (NETLIFY_AUTH_TOKEN and NETLIFY_SITE_ID) and confirm the repo is pushed to GitHub.
