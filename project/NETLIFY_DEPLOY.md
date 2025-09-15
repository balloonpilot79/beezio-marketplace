Netlify deployment via GitHub Actions

This project builds a static frontend (Vite) and deploys the `dist` folder to Netlify via GitHub Actions.

Required repository secrets (set in GitHub repo settings -> Secrets):
- NETLIFY_AUTH_TOKEN - a Netlify personal access token with deploy permissions
- NETLIFY_SITE_ID - the Netlify site ID where the site will be deployed

How it works:
- Push to `main` triggers `.github/workflows/deploy-netlify.yml`.
- The workflow runs `npm ci`, `npm run build`, then uses Netlify CLI action to deploy `dist` to the site.

Important notes:
- Server-side functions (Supabase Edge Functions) are not deployed by this workflow. Continue to use Supabase CLI to deploy Edge Functions (create-stripe-account, create-payment-intent, stripe-webhook, etc.) and set their secrets in Supabase.
- Make sure `VITE_SUPABASE_URL` and other runtime values are set in Netlify's environment variables (Netlify UI) for the frontend to call the correct endpoints.
- For Stripe: set `VITE_STRIPE_PUBLISHABLE_KEY` in Netlify environment variables (publishable key is safe for client). Do NOT set `STRIPE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY` in Netlify env — those belong in Supabase secrets or server-only env.
