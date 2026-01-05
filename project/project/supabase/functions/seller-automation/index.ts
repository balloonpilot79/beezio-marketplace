import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    const { action, sellerId, orderData } = await req.json()

    console.log(`Seller Automation: ${action} for seller ${sellerId}`)

    switch (action) {
      case 'get_settings':
        return await getSellerAutomationSettings(supabaseClient, sellerId)

      case 'update_settings':
        return await updateSellerAutomationSettings(supabaseClient, sellerId, orderData)

      case 'process_order':
        return await processAutomatedOrder(supabaseClient, sellerId, orderData)

      case 'get_stats':
        return await getSellerAutomationStats(supabaseClient, sellerId)

      default:
        throw new Error(`Unknown action: ${action}`)
    }

  } catch (error) {
    console.error('Seller automation error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

async function getSellerAutomationSettings(supabaseClient: any, sellerId: string) {
  const { data: settings, error } = await supabaseClient
    .from('seller_automation_settings')
    .select('*')
    .eq('seller_id', sellerId)
    .single()

  if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
    throw error
  }

  // Return default settings if none exist
  const defaultSettings = {
    auto_order_enabled: false,
    auto_payment_enabled: false,
    auto_inventory_enabled: false,
    auto_shipping_labels: false,
    auto_tracking_updates: false,
    auto_delivery_notifications: false,
    auto_order_confirmations: false,
    auto_shipping_updates: false,
    auto_delivery_alerts: false,
    auto_commission_payouts: false,
    automation_level: 'basic',
    monthly_order_limit: 100,
    orders_processed_this_month: 0
  }

  return new Response(
    JSON.stringify({
      success: true,
      settings: settings || defaultSettings
    }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    }
  )
}

async function updateSellerAutomationSettings(supabaseClient: any, sellerId: string, settings: any) {
  const { data, error } = await supabaseClient
    .from('seller_automation_settings')
    .upsert({
      seller_id: sellerId,
      ...settings,
      updated_at: new Date().toISOString()
    })
    .select()
    .single()

  if (error) throw error

  // Log the settings change
  await supabaseClient
    .from('seller_automation_logs')
    .insert({
      seller_id: sellerId,
      automation_type: 'settings_update',
      status: 'success',
      details: { settings_updated: Object.keys(settings) }
    })

  return new Response(
    JSON.stringify({
      success: true,
      settings: data
    }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    }
  )
}

async function processAutomatedOrder(supabaseClient: any, sellerId: string, orderData: any) {
  // Get seller automation settings
  const { data: settings, error: settingsError } = await supabaseClient
    .from('seller_automation_settings')
    .select('*')
    .eq('seller_id', sellerId)
    .single()

  if (settingsError && settingsError.code !== 'PGRST116') {
    throw settingsError
  }

  if (!settings || !settings.auto_order_enabled) {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Automation not enabled for this seller'
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }

  // Check monthly limit
  if (settings.orders_processed_this_month >= settings.monthly_order_limit) {
    throw new Error('Monthly automation limit exceeded')
  }

  const automationSteps = []
  let orderProcessed = false

  try {
    // 1. Auto order from vendor (if enabled)
    if (settings.auto_order_enabled && orderData.vendor) {
      await processVendorOrder(supabaseClient, sellerId, orderData)
      automationSteps.push('vendor_order')
      orderProcessed = true
    }

    // 2. Auto payment processing (if enabled)
    if (settings.auto_payment_enabled && orderProcessed) {
      await processVendorPayment(supabaseClient, sellerId, orderData)
      automationSteps.push('payment')
    }

    // 3. Auto shipping label generation (if enabled)
    if (settings.auto_shipping_labels && orderProcessed) {
      await generateShippingLabel(supabaseClient, sellerId, orderData)
      automationSteps.push('shipping_label')
    }

    // 4. Send automated emails (if enabled)
    if (settings.auto_order_confirmations) {
      await sendOrderConfirmation(supabaseClient, sellerId, orderData)
      automationSteps.push('order_confirmation')
    }

    // Update order as automated
    await supabaseClient
      .from('orders')
      .update({
        automation_enabled: true,
        automated_by_seller: sellerId
      })
      .eq('id', orderData.orderId)

    // Update monthly counter
    await supabaseClient
      .from('seller_automation_settings')
      .update({
        orders_processed_this_month: settings.orders_processed_this_month + 1,
        updated_at: new Date().toISOString()
      })
      .eq('seller_id', sellerId)

    // Log successful automation
    await supabaseClient
      .from('seller_automation_logs')
      .insert({
        seller_id: sellerId,
        order_id: orderData.orderId,
        automation_type: 'order_processing',
        status: 'success',
        details: {
          steps_completed: automationSteps,
          automation_level: settings.automation_level
        }
      })

    return new Response(
      JSON.stringify({
        success: true,
        steps_completed: automationSteps,
        message: `Order processed successfully with ${automationSteps.length} automated steps`
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    // Log failed automation
    await supabaseClient
      .from('seller_automation_logs')
      .insert({
        seller_id: sellerId,
        order_id: orderData.orderId,
        automation_type: 'order_processing',
        status: 'failed',
        error_message: error.message,
        details: {
          steps_attempted: automationSteps,
          failed_at_step: automationSteps.length + 1
        }
      })

    throw error
  }
}

async function getSellerAutomationStats(supabaseClient: any, sellerId: string) {
  const currentMonth = new Date().toISOString().slice(0, 7) // YYYY-MM

  const { data: stats, error } = await supabaseClient
    .from('seller_automation_stats')
    .select('*')
    .eq('seller_id', sellerId)
    .eq('month_year', currentMonth)
    .single()

  if (error && error.code !== 'PGRST116') {
    throw error
  }

  // Get recent logs for additional insights
  const { data: recentLogs } = await supabaseClient
    .from('seller_automation_logs')
    .select('*')
    .eq('seller_id', sellerId)
    .order('created_at', { ascending: false })
    .limit(10)

  return new Response(
    JSON.stringify({
      success: true,
      stats: stats || {
        orders_automated: 0,
        orders_failed: 0,
        time_saved_hours: 0,
        cost_savings: 0,
        customer_satisfaction_score: 0
      },
      recent_activity: recentLogs || []
    }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    }
  )
}

// Helper functions for automation steps
async function processVendorOrder(supabaseClient: any, sellerId: string, orderData: any) {
  // Simulate vendor API call - replace with actual vendor integration
  console.log(`Processing vendor order for ${orderData.vendor}`)

  // Create vendor order record
  const { error } = await supabaseClient
    .from('vendor_orders')
    .insert({
      order_id: orderData.orderId,
      vendor_name: orderData.vendor,
      product_id: orderData.productId,
      quantity: orderData.quantity,
      status: 'ordered'
    })

  if (error) throw error
}

async function processVendorPayment(supabaseClient: any, sellerId: string, orderData: any) {
  // Simulate payment processing - replace with actual payment integration
  console.log(`Processing payment for order ${orderData.orderId}`)
}

async function generateShippingLabel(supabaseClient: any, sellerId: string, orderData: any) {
  // Simulate shipping label generation - replace with actual shipping API
  console.log(`Generating shipping label for order ${orderData.orderId}`)

  // Create shipping label record
  const { error } = await supabaseClient
    .from('shipping_labels')
    .insert({
      vendor_order_id: orderData.vendorOrderId,
      tracking_number: `AUTO${Date.now()}`,
      carrier: 'AutoShip',
      shipping_cost: 5.99
    })

  if (error) throw error
}

async function sendOrderConfirmation(supabaseClient: any, sellerId: string, orderData: any) {
  // Simulate email sending - replace with actual email service
  console.log(`Sending order confirmation for ${orderData.orderId}`)

  // Create email notification record
  const { error } = await supabaseClient
    .from('email_notifications')
    .insert({
      order_id: orderData.orderId,
      recipient_email: orderData.customerEmail,
      recipient_type: 'buyer',
      email_type: 'order_confirmation',
      status: 'sent'
    })

  if (error) throw error
}
