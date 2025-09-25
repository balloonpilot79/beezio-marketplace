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
    // This function is designed to be called by a cron job at the end of each tax year
    // It will automatically generate 1099-NEC forms for all eligible users

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const currentYear = new Date().getFullYear()
    const taxYear = currentYear - 1 // Generate for previous year

    console.log(`Starting automatic 1099-NEC generation for tax year ${taxYear}`)

    // Call the existing generate-1099-forms function
    const { data, error } = await supabase.functions.invoke('generate-1099-forms', {
      body: { year: taxYear }
    })

    if (error) {
      console.error('Error in automatic 1099 generation:', error)
      return new Response(JSON.stringify({ error: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 })
    }

    // Send summary email to admin
    const summary = {
      taxYear,
      generated1099s: data.generated1099s.length,
      totalEligible: data.summary.eligibleFor1099,
      timestamp: new Date().toISOString()
    }

    console.log('1099 generation completed:', summary)

    // In production, you would send an email notification here
    // await sendAdminNotification(summary)

    return new Response(JSON.stringify({
      success: true,
      summary,
      message: `Successfully generated ${data.generated1099s.length} 1099-NEC forms for tax year ${taxYear}`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    })

  } catch (error) {
    console.error('Automatic 1099 generation error:', error)
    return new Response(JSON.stringify({ error: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })
  }
})