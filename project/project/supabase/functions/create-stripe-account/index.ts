

// Supabase Edge Function: create-stripe-account
// Creates a Stripe Express account and returns onboarding URL

// @ts-ignore: Deno remote import, safe for Supabase Edge Functions
import { serve } from 'https://deno.land/x/sift@0.6.0/mod.ts';

serve({
  async POST(request) {
    try {
      const body = await request.json();
      const { email } = body;
      if (!email) {
        return new Response(JSON.stringify({ error: 'Missing email' }), {
          headers: { 'Content-Type': 'application/json' },
          status: 400,
        });
      }

      // Import Stripe

      // @ts-ignore: Deno npm import, safe for Supabase Edge Functions
      const Stripe = (await import('npm:stripe')).default;
      // @ts-ignore: Deno global, safe for Supabase Edge Functions
      const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'), {
        apiVersion: '2024-04-10',
      });

      // Create Express account
      const account = await stripe.accounts.create({
        type: 'express',
        email,
      });

      // Create account link (onboarding URL)
      const accountLink = await stripe.accountLinks.create({
        account: account.id,
        refresh_url: 'https://beezio.com/dashboard',
        return_url: 'https://beezio.com/dashboard',
        type: 'account_onboarding',
      });

      return new Response(
        JSON.stringify({ onboarding_url: accountLink.url, account_id: account.id }),
        {
          headers: { 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        headers: { 'Content-Type': 'application/json' },
        status: 500,
      });
    }
  },

  async OPTIONS() {
    // CORS preflight
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
      status: 204,
    });
  },
});
