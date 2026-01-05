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
    const { userId } = await req.json()

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get all completed payouts for the seller
    const { data: payouts, error: payoutsError } = await supabase
      .from('payouts')
      .select('amount, completed_at')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })

    if (payoutsError) throw payoutsError

    // Calculate earnings metrics
    const totalEarned = payouts?.reduce((sum, payout) => sum + payout.amount, 0) || 0

    // Get current month earnings
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const currentMonthEarnings = payouts
      ?.filter(payout => new Date(payout.completed_at) >= startOfMonth)
      ?.reduce((sum, payout) => sum + payout.amount, 0) || 0

    // Get last month earnings
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0)
    const lastMonthEarnings = payouts
      ?.filter(payout => {
        const payoutDate = new Date(payout.completed_at)
        return payoutDate >= startOfLastMonth && payoutDate <= endOfLastMonth
      })
      ?.reduce((sum, payout) => sum + payout.amount, 0) || 0

    // Get this year earnings
    const startOfYear = new Date(now.getFullYear(), 0, 1)
    const thisYearEarnings = payouts
      ?.filter(payout => new Date(payout.completed_at) >= startOfYear)
      ?.reduce((sum, payout) => sum + payout.amount, 0) || 0

    // Get pending payouts
    const { data: pendingPayouts, error: pendingError } = await supabase
      .from('payouts')
      .select('amount')
      .eq('user_id', userId)
      .eq('status', 'pending')

    if (pendingError) throw pendingError

    const pendingAmount = pendingPayouts?.reduce((sum, payout) => sum + payout.amount, 0) || 0

    return new Response(JSON.stringify({
      total_earned: totalEarned,
      this_month: currentMonthEarnings,
      last_month: lastMonthEarnings,
      this_year: thisYearEarnings,
      pending: pendingAmount,
      total_payouts: payouts?.length || 0
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    })

  } catch (error) {
    console.error('Error getting seller earnings:', error)
    return new Response(JSON.stringify({ error: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })
  }
})