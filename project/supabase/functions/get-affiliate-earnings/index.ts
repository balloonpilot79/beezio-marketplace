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

    // Get all completed payouts for the affiliate
    const { data: payouts, error: payoutsError } = await supabase
      .from('payouts')
      .select('amount, completed_at')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })

    if (payoutsError) throw payoutsError

    const totalEarnings = payouts?.reduce((sum, payout) => sum + payout.amount, 0) || 0

    // Get pending commission
    const { data: pendingPayouts, error: pendingError } = await supabase
      .from('payouts')
      .select('amount')
      .eq('user_id', userId)
      .eq('status', 'pending')

    if (pendingError) throw pendingError

    const pendingCommission = pendingPayouts?.reduce((sum, payout) => sum + payout.amount, 0) || 0

    // Get paid commission
    const paidCommission = totalEarnings

    // Get current month earnings
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const currentMonthEarnings = payouts
      ?.filter(payout => new Date(payout.completed_at) >= startOfMonth)
      ?.reduce((sum, payout) => sum + payout.amount, 0) || 0

    // Get affiliate performance metrics
    const { data: clicks, error: clicksError } = await supabase
      .from('affiliate_clicks')
      .select('id')
      .eq('affiliate_id', userId)

    if (clicksError) throw clicksError

    const totalClicks = clicks?.length || 0

    // Get conversions (purchases through affiliate)
    const { data: conversions, error: conversionsError } = await supabase
      .from('purchases')
      .select('id')
      .eq('affiliate_id', userId)
      .eq('status', 'completed')

    if (conversionsError) throw conversionsError

    const totalConversions = conversions?.length || 0
    const conversionRate = totalClicks > 0 ? (totalConversions / totalClicks) * 100 : 0

    // Get top performing product
    const { data: topProduct, error: topProductError } = await supabase
      .from('affiliate_clicks')
      .select(`
        product_id,
        products(name)
      `)
      .eq('affiliate_id', userId)
      .order('clicked_at', { ascending: false })
      .limit(1)
      .single()

    const topPerformingProduct = topProduct?.products?.name || 'No promotions yet'

    return new Response(JSON.stringify({
      total_earnings: totalEarnings,
      pending_commission: pendingCommission,
      paid_commission: paidCommission,
      current_month_earnings: currentMonthEarnings,
      total_clicks: totalClicks,
      total_conversions: totalConversions,
      conversion_rate: conversionRate,
      top_performing_product: topPerformingProduct
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    })

  } catch (error) {
    console.error('Error getting affiliate earnings:', error)
    return new Response(JSON.stringify({ error: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })
  }
})
        commission_amount
      `)
      .eq('affiliate_id', userId)
      .order('commission_amount', { ascending: false })
      .limit(1)

    const totalClicks = clicksData?.length || 0
    const totalConversions = conversionsData?.length || 0
    const conversionRate = totalClicks > 0 ? (totalConversions / totalClicks) * 100 : 0

    // Get current month earnings
    const currentMonth = new Date().toISOString().slice(0, 7) // YYYY-MM
    const { data: monthlyEarnings } = await supabase
      .from('affiliate_conversions')
      .select('commission_amount')
      .eq('affiliate_id', userId)
      .gte('created_at', `${currentMonth}-01`)
      .lt('created_at', `${currentMonth}-32`)

    const currentMonthEarnings = monthlyEarnings?.reduce((sum, conv) => sum + (conv.commission_amount || 0), 0) || 0

    const earnings = {
      total_earnings: earningsData?.total_earned || 0,
      pending_commission: earningsData?.current_balance || 0,
      paid_commission: earningsData?.paid_out || 0,
      current_month_earnings: currentMonthEarnings,
      total_clicks: totalClicks,
      total_conversions: totalConversions,
      conversion_rate: conversionRate,
      top_performing_product: topProductData?.[0]?.products?.title || 'No sales yet'
    }

    return new Response(JSON.stringify(earnings), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('Error getting affiliate earnings:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
