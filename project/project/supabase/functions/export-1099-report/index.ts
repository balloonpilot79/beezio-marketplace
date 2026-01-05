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
    const { year } = await req.json()

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const start = new Date(`${year}-01-01T00:00:00Z`).toISOString()
    const end = new Date(`${year}-12-31T23:59:59Z`).toISOString()

    // Query payouts joined with profiles
    const { data, error } = await supabase
      .from('payouts')
      .select(`id, user_id, amount, status, completed_at, stripe_transfer_id, profiles(id, full_name, email, stripe_account_id)`)
      .gte('completed_at', start)
      .lte('completed_at', end)
      .eq('status', 'completed')

    if (error) {
      console.error('Error querying payouts for 1099 report:', error)
      return new Response(JSON.stringify({ error: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 })
    }

    // Aggregate by user
    const aggregates: Record<string, { userId: string; name: string; email: string; stripeAccount?: string; totalPaid: number }> = {}

    for (const row of data || []) {
      const userId = row.user_id
      const profile = row.profiles || {}
      if (!aggregates[userId]) {
        aggregates[userId] = {
          userId,
          name: profile.full_name || '',
          email: profile.email || '',
          stripeAccount: profile.stripe_account_id || '',
          totalPaid: 0,
        }
      }
      aggregates[userId].totalPaid += Number(row.amount || 0)
    }

    // Build CSV
    const header = ['user_id','name','email','stripe_account_id','total_paid']
    const lines = [header.join(',')]
    for (const k of Object.keys(aggregates)) {
      const a = aggregates[k]
      lines.push([a.userId, csvEscape(a.name), csvEscape(a.email), a.stripeAccount || '', a.totalPaid.toFixed(2)].join(','))
    }

    const csv = lines.join('\n')

    return new Response(csv, { headers: { ...corsHeaders, 'Content-Type': 'text/csv', 'Content-Disposition': `attachment; filename="1099-payouts-${year}.csv"` }, status: 200 })

  } catch (err) {
    console.error('Error generating 1099 report:', err)
    return new Response(JSON.stringify({ error: (err as Error).message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 })
  }
})

function csvEscape(v: any) {
  if (v === null || v === undefined) return ''
  const s = String(v)
  if (s.includes(',') || s.includes('\"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}
