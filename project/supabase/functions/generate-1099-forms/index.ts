import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

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
    const { year = new Date().getFullYear() - 1 } = await req.json() // Default to last year

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const start = new Date(`${year}-01-01T00:00:00Z`).toISOString()
    const end = new Date(`${year}-12-31T23:59:59Z`).toISOString()

    // Query payouts joined with profiles and tax agreements
    const { data: payouts, error } = await supabase
      .from('payouts')
      .select(`
        id, user_id, amount, status, completed_at, stripe_transfer_id,
        profiles(id, full_name, email, stripe_account_id)
      `)
      .gte('completed_at', start)
      .lte('completed_at', end)
      .eq('status', 'completed')

    if (error) {
      console.error('Error querying payouts for 1099 generation:', error)
      return new Response(JSON.stringify({ error: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 })
    }

    // Get tax agreements for all users
    const userIds = [...new Set(payouts?.map(p => p.user_id) || [])]
    const { data: taxAgreements } = await supabase
      .from('tax_agreements')
      .select('user_id, agreement_type, signed_at')
      .in('user_id', userIds)
      .eq('agreement_type', '1099')

    // Aggregate payments by user
    const userPayments: Record<string, {
      userId: string
      name: string
      email: string
      totalPaid: number
      has1099Agreement: boolean
    }> = {}

    for (const payout of payouts || []) {
      const userId = payout.user_id
      const profile = payout.profiles || {}

      if (!userPayments[userId]) {
        const has1099Agreement = taxAgreements?.some(agreement =>
          agreement.user_id === userId
        ) || false

        userPayments[userId] = {
          userId,
          name: profile.full_name || '',
          email: profile.email || '',
          totalPaid: 0,
          has1099Agreement
        }
      }
      userPayments[userId].totalPaid += payout.amount
    }

    // Generate 1099 forms for eligible users (>$600 and have agreement)
    const eligibleUsers = Object.values(userPayments).filter(user =>
      user.totalPaid >= 600 && user.has1099Agreement
    )

    const generated1099s = []

    for (const user of eligibleUsers) {
      // Check if 1099 already exists for this year
      const { data: existing1099 } = await supabase
        .from('tax_1099_reports')
        .select('id')
        .eq('user_id', user.userId)
        .eq('tax_year', year)
        .single()

      if (!existing1099) {
        // Generate 1099 document (in production, this would create actual PDF)
        const documentUrl = `https://beezio-tax-reports.s3.amazonaws.com/1099/${year}/${user.userId}.pdf`

        const { data: new1099, error: insertError } = await supabase
          .from('tax_1099_reports')
          .insert({
            user_id: user.userId,
            tax_year: year,
            total_payments: user.totalPaid,
            document_url: documentUrl,
            status: 'issued'
          })
          .select()
          .single()

        if (!insertError && new1099) {
          generated1099s.push({
            userId: user.userId,
            email: user.email,
            amount: user.totalPaid,
            documentUrl
          })

          // Send email notification (integrate with email service)
          console.log(`1099-NEC generated for ${user.email}: $${user.totalPaid} for ${year}`)
        }
      }
    }

    return new Response(JSON.stringify({
      year,
      generated1099s,
      summary: {
        totalUsersProcessed: Object.keys(userPayments).length,
        eligibleFor1099: eligibleUsers.length,
        formsGenerated: generated1099s.length
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    })

  } catch (error) {
    console.error('Automatic 1099 generation error:', error)
    return new Response(JSON.stringify({ error: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })
  }
})