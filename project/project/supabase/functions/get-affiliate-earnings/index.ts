import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const safeNumber = (n: unknown) => {
  const v = Number(n)
  return Number.isFinite(v) ? v : 0
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const { userId } = await req.json()

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Prefer `user_earnings` (the canonical payout/earnings aggregate in this repo).
    const { data: row } = await supabase
      .from('user_earnings')
      .select('total_earned, current_balance, paid_out')
      .eq('user_id', userId)
      .eq('role', 'affiliate')
      .maybeSingle()

    const totalEarned = safeNumber((row as any)?.total_earned)
    const pendingCommission = safeNumber((row as any)?.current_balance)
    const paidCommission = safeNumber((row as any)?.paid_out)

    // Best-effort click/conversion stats; schemas vary, so default to 0 on missing tables.
    let totalClicks = 0
    let totalConversions = 0
    try {
      const { data: clicks } = await supabase.from('affiliate_clicks').select('id').eq('affiliate_id', userId)
      totalClicks = Array.isArray(clicks) ? clicks.length : 0
    } catch {
      totalClicks = 0
    }

    // Prefer affiliate_conversions if present; otherwise fall back to orders with affiliate_id.
    try {
      const { data: conversions } = await supabase.from('affiliate_conversions').select('id').eq('affiliate_id', userId)
      totalConversions = Array.isArray(conversions) ? conversions.length : 0
    } catch {
      try {
        const { data: orders } = await supabase.from('orders').select('id').eq('affiliate_id', userId).eq('status', 'completed')
        totalConversions = Array.isArray(orders) ? orders.length : 0
      } catch {
        totalConversions = 0
      }
    }

    const conversionRate = totalClicks > 0 ? (totalConversions / totalClicks) * 100 : 0

    // Current month earnings: not consistently available, so default to 0 unless we can infer from payouts.
    let currentMonthEarnings = 0
    try {
      const now = new Date()
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      const { data: payouts } = await supabase
        .from('payouts')
        .select('amount, completed_at')
        .eq('user_id', userId)
        .eq('status', 'completed')
      if (Array.isArray(payouts)) {
        currentMonthEarnings = payouts
          .filter((p: any) => p?.completed_at && new Date(p.completed_at) >= startOfMonth)
          .reduce((sum: number, p: any) => sum + safeNumber(p.amount), 0)
      }
    } catch {
      currentMonthEarnings = 0
    }

    return new Response(
      JSON.stringify({
        total_earnings: totalEarned,
        pending_commission: pendingCommission,
        paid_commission: paidCommission,
        current_month_earnings: currentMonthEarnings,
        total_clicks: totalClicks,
        total_conversions: totalConversions,
        conversion_rate: conversionRate,
        top_performing_product: '—',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    console.error('Error getting affiliate earnings:', error)
    return new Response(
      JSON.stringify({ error: (error as any)?.message || String(error) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})

