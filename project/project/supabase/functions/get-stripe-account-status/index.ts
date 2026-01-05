import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import Stripe from 'npm:stripe@14.21.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2023-10-16',
    })

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    if (!supabaseUrl) {
      return new Response(JSON.stringify({ error: 'Missing SUPABASE_URL' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      })
    }
    if (!serviceRoleKey) {
      return new Response(JSON.stringify({ error: 'Missing SUPABASE_SERVICE_ROLE_KEY' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      })
    }

    const authHeader = req.headers.get('authorization') || ''
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
    }

    const supabaseAuthed = createClient(supabaseUrl, anonKey || serviceRoleKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: userData, error: userError } = await supabaseAuthed.auth.getUser()
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized', details: userError?.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
    }

    const supabase = createClient(
      supabaseUrl,
      serviceRoleKey
    )

    // Get user's Stripe account ID.
    // NOTE: Some deployments accidentally have multiple profile rows for the same auth user
    // (e.g., one where profiles.id == auth.users.id and another where profiles.user_id == auth.users.id).
    // Also, some stuck accounts have a Stripe account created (recorded in `stripe_account_creations`)
    // but `profiles.stripe_account_id` wasn't persisted (RLS/schema mismatch during write).
    const { data: profileRows, error: profileQueryError } = await supabase
      .from('profiles')
      .select('id, user_id, stripe_account_id, seller_verification_status, identity_verification_status, email')
      .or(`id.eq.${userData.user.id},user_id.eq.${userData.user.id}`)
      .limit(10)

    if (profileQueryError) {
      return new Response(JSON.stringify({ error: 'Failed to load profile', details: profileQueryError.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      })
    }

    const profiles = Array.isArray(profileRows) ? profileRows : (profileRows ? [profileRows] : [])
    const profileWithStripe = profiles.find((p: any) => String(p?.stripe_account_id || '').trim().length > 0)

    let stripeAccountId = profileWithStripe ? String((profileWithStripe as any).stripe_account_id).trim() : ''
    let sellerVerificationStatus: string | null =
      profileWithStripe ? String((profileWithStripe as any)?.seller_verification_status || '') || null : null
    let identityVerificationStatus: string | null =
      profileWithStripe ? String((profileWithStripe as any)?.identity_verification_status || '') || null : null

    // Recovery fallback: check `stripe_account_creations` if the profile wasn't updated.
    if (!stripeAccountId) {
      const email = profiles.find((p: any) => String(p?.email || '').trim().length > 0)?.email || userData.user.email || ''
      const profileIds = profiles.map((p: any) => String(p?.id || '')).filter(Boolean)

      try {
        let creations: any[] = []
        if (profileIds.length) {
          const { data } = await supabase
            .from('stripe_account_creations')
            .select('stripe_account_id, created_at')
            .in('profile_id', profileIds)
            .order('created_at', { ascending: false })
            .limit(1)
          creations = (data as any[]) || []
        }

        if (!creations.length && email) {
          const { data } = await supabase
            .from('stripe_account_creations')
            .select('stripe_account_id, created_at')
            .eq('user_email', String(email))
            .order('created_at', { ascending: false })
            .limit(1)
          creations = (data as any[]) || []
        }

        const recovered = creations.find((c: any) => String(c?.stripe_account_id || '').trim().length > 0)
        if (recovered) {
          stripeAccountId = String((recovered as any).stripe_account_id).trim()

          // Best-effort backfill into all matching profiles so future reads are fast and consistent.
          try {
            await supabase
              .from('profiles')
              .update({ stripe_account_id: stripeAccountId })
              .or(`id.eq.${userData.user.id},user_id.eq.${userData.user.id}`)
          } catch {
            // ignore
          }
        }
      } catch {
        // Non-fatal: if `stripe_account_creations` doesn't exist yet, proceed without recovery.
      }
    }

    if (!stripeAccountId) {
      return new Response(JSON.stringify({ error: 'No Stripe account found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      })
    }

    // Get account status from Stripe
    const account = await stripe.accounts.retrieve(stripeAccountId)
    
    // Get account balance
    const balance = await stripe.balance.retrieve({
      stripeAccount: stripeAccountId,
    })

    // Get upcoming payout (if any)
    let nextPayout = null
    try {
      const payouts = await stripe.payouts.list(
        { limit: 1 },
        { stripeAccount: stripeAccountId }
      )
      if (payouts.data.length > 0) {
        nextPayout = payouts.data[0]
      }
    } catch (error) {
      // Ignore payout errors for new accounts
    }

    const accountStatus = {
      account_id: account.id,
      charges_enabled: account.charges_enabled,
      payouts_enabled: account.payouts_enabled,
      details_submitted: account.details_submitted,
      requirements: account.requirements?.currently_due || [],
      business_name: account.business_profile?.name,
      business_url: account.business_profile?.url,
      balance_available: balance.available.reduce((sum, bal) => sum + bal.amount, 0) / 100,
      balance_pending: balance.pending.reduce((sum, bal) => sum + bal.amount, 0) / 100,
      next_payout_date: nextPayout ? new Date(nextPayout.arrival_date * 1000).toLocaleDateString() : null,
      next_payout_amount: nextPayout ? nextPayout.amount / 100 : null,
      seller_verification_status: sellerVerificationStatus,
      identity_verification_status: identityVerificationStatus,
    }

    return new Response(JSON.stringify(accountStatus), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('Error getting account status:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
