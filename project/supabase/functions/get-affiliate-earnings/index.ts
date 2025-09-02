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

    // Get affiliate earnings from database
    const { data: earningsData, error: earningsError } = await supabase
      .from('user_earnings')
      .select('*')
      .eq('user_id', userId)
      .eq('role', 'affiliate')
      .single()

    if (earningsError && earningsError.code !== 'PGRST116') {
      throw earningsError
    }

    // Get affiliate performance metrics
    const { data: clicksData } = await supabase
      .from('affiliate_clicks')
      .select('id')
      .eq('affiliate_id', userId)

    const { data: conversionsData } = await supabase
      .from('affiliate_conversions')
      .select('id, commission_amount')
      .eq('affiliate_id', userId)

    // Get top performing product
    const { data: topProductData } = await supabase
      .from('affiliate_conversions')
      .select(`
        products(title),
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
