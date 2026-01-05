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
    const siteUrl = String(
      Deno.env.get('SITE_URL') ||
        req.headers.get('origin') ||
        'https://beezio-marketplace.netlify.app'
    )
      .trim()
      .replace(/\/$/, '')

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

    const { type, agreements_signed, country } = await req.json()
    const normalizedType = String(type || '').toLowerCase().trim()
    if (normalizedType !== 'seller' && normalizedType !== 'affiliate' && normalizedType !== 'fundraiser') {
      return new Response(JSON.stringify({ error: 'Invalid type' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2023-10-16',
    })

    const supabase = createClient(supabaseUrl, serviceRoleKey)

    // Enforce agreement signing server-side (avoid client bypass by sending agreements_signed=true).
    // If the table doesn't exist yet (older DB), fall back to the boolean flag.
    const requiredAgreementTypes = ['1099', 'independent_contractor', 'tax_withholding'] as const
    try {
      const { data: agreementRows, error: agreementError } = await supabaseAuthed
        .from('tax_agreements')
        .select('agreement_type')
        .eq('user_id', userData.user.id)

      if (agreementError) {
        const msg = String((agreementError as any)?.message || '')
        const code = String((agreementError as any)?.code || '')
        const missingTable = code === '42P01' || /tax_agreements/i.test(msg) && /does not exist/i.test(msg)
        if (!missingTable && !agreements_signed) {
          return new Response(
            JSON.stringify({ error: 'Signed agreements required', details: agreementError.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          )
        }
        if (missingTable && !agreements_signed) {
          return new Response(JSON.stringify({ error: 'Signed agreements required' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
          })
        }
      } else {
        const signed = new Set(
          (agreementRows || [])
            .map((r: any) => String(r?.agreement_type || '').trim())
            .filter(Boolean)
        )
        const missing = requiredAgreementTypes.filter((t) => !signed.has(t))
        if (missing.length) {
          return new Response(
            JSON.stringify({ error: 'Missing required signed agreements', missing }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          )
        }
      }
    } catch (_e) {
      if (!agreements_signed) {
        return new Response(JSON.stringify({ error: 'Signed agreements required' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        })
      }
    }

    // Resolve profile id (schemas vary); also pull email from DB as the source of truth.
    // Guard against deployments with duplicate profile rows for a user by fetching a small set and selecting the best candidate.
    const { data: profileRows } = await supabase
      .from('profiles')
      .select('id, user_id, email, role, primary_role, stripe_account_id')
      .or(`id.eq.${userData.user.id},user_id.eq.${userData.user.id}`)
      .limit(10)

    const rows = Array.isArray(profileRows) ? profileRows : (profileRows ? [profileRows] : [])
    const rowsWithStripe = rows.filter((r: any) => String(r?.stripe_account_id || '').trim().length > 0)
    const existingAccountId = rowsWithStripe.length ? String((rowsWithStripe[0] as any).stripe_account_id).trim() : ''

    const preferredRow =
      rows.find((r: any) => String(r?.id || '') === String(userData.user.id)) ||
      rows.find((r: any) => String(r?.user_id || '') === String(userData.user.id)) ||
      rows[0] ||
      null

    const profileId = preferredRow?.id ? String((preferredRow as any).id) : null
    if (!profileId) {
      return new Response(JSON.stringify({ error: 'Missing profile for user' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // If already connected, just return account status so the UI can continue.
    if (existingAccountId) {
      const accountLink = await stripe.accountLinks.create({
        account: existingAccountId,
        refresh_url: `${siteUrl}/stripe/return`,
        return_url: `${siteUrl}/stripe/return`,
        type: 'account_onboarding',
        collect: 'eventually_due',
      })
      return new Response(JSON.stringify({
        account_id: existingAccountId,
        embedded: true,
        already_connected: true,
        onboarding_url: accountLink.url,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    const emailFromProfile = (preferredRow as any)?.email ? String((preferredRow as any).email) : ''
    const emailFromAuth = userData.user.email ? String(userData.user.email) : ''
    const email = emailFromProfile || emailFromAuth
    if (!email) {
      return new Response(JSON.stringify({ error: 'Missing email on profile' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    const countryCode = String(country || 'US').toUpperCase().trim()

    // Create Express account with enhanced metadata
    const account = await stripe.accounts.create({
      type: 'express',
      email,
      country: countryCode,
      metadata: {
        beezio_profile_id: profileId,
        beezio_user_id: userData.user.id,
        beezio_user_type: normalizedType, // 'seller' | 'affiliate' | 'fundraiser'
        agreements_signed: 'true',
        signup_date: new Date().toISOString(),
        platform: 'beezio-marketplace'
      },
      business_type: 'individual',
      capabilities: {
        transfers: { requested: true },
      },
    })

    // Create account link for embedded onboarding
      const accountLink = await stripe.accountLinks.create({
        account: account.id,
        refresh_url: `${siteUrl}/stripe/return`,
        return_url: `${siteUrl}/stripe/return`,
        type: 'account_onboarding',
        collect: 'eventually_due', // Collect all required information
      })

    // Save to profile(s).
    // IMPORTANT: Some deployments only have `stripe_account_id` and not the extended Stripe status columns.
    // Always write `stripe_account_id` first so the UI stops looping back to Stripe setup.
    // Also update ALL matching profile rows (some deployments accidentally have duplicates).
    const { error: minimalUpdateError } = await supabase
      .from('profiles')
      .update({ stripe_account_id: account.id })
      .or(`id.eq.${userData.user.id},user_id.eq.${userData.user.id}`)

    if (minimalUpdateError) {
      console.warn('Failed to persist stripe_account_id on profile:', minimalUpdateError)
    }

    // Best-effort extended status fields (ignore unknown-column errors).
    const extendedUpdate: Record<string, unknown> = {
      stripe_charges_enabled: account.charges_enabled || false,
      stripe_payouts_enabled: account.payouts_enabled || false,
      stripe_details_submitted: account.details_submitted || false,
      stripe_requirements_currently_due: account.requirements?.currently_due || [],
      stripe_requirements_past_due: account.requirements?.past_due || [],
      verification_updated_at: new Date().toISOString(),
      ...(normalizedType === 'seller' ? { seller_verification_status: 'pending_stripe' } : {}),
    }

    try {
      const { error: extendedError } = await supabase
        .from('profiles')
        .update(extendedUpdate)
        .or(`id.eq.${userData.user.id},user_id.eq.${userData.user.id}`)

      if (extendedError) {
        const msg = String((extendedError as any)?.message || '')
        if (!/column .* does not exist/i.test(msg)) {
          console.warn('Failed to persist extended Stripe fields on profile:', extendedError)
        }
      }
    } catch (_e) {
      // Non-fatal; `stripe_account_id` is what prevents onboarding loops.
    }

    try {
      await supabase.from('seller_verification_events').insert({
        seller_id: profileId,
        event_type: 'connect.account_created',
        details: { stripe_account_id: account.id, type: normalizedType, country: countryCode },
      })
    } catch (_e) {
      // Non-fatal: audit logging should not block onboarding.
    }

    // Store account creation in database
    const { error: dbError } = await supabase
      .from('stripe_account_creations')
      .insert({
        stripe_account_id: account.id,
        user_email: email,
        user_type: normalizedType,
        profile_id: profileId,
        agreements_signed: true,
        onboarding_url: accountLink.url,
        created_at: new Date().toISOString()
      })

    if (dbError) {
      console.error('Error storing account creation:', dbError)
      // Don't fail the request for this
    }

    return new Response(JSON.stringify({
      account_id: account.id,
      onboarding_url: accountLink.url,
      embedded: true,
      requirements: {
        currently_due: account.requirements?.currently_due || [],
        eventually_due: account.requirements?.eventually_due || [],
        pending_verification: account.requirements?.pending_verification || []
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('Embedded Stripe account creation error:', error)
    return new Response(JSON.stringify({
      error: error.message
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
