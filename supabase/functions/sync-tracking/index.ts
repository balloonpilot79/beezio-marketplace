// SYNC TRACKING - Poll supplier APIs for tracking updates
// This Edge Function runs periodically to check tracking status from suppliers

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log('🔄 Starting tracking sync...')

    // 1. Get all vendor orders that are still in transit
    const { data: vendorOrders, error: ordersError } = await supabase
      .from('vendor_orders')
      .select('*')
      .in('status', ['ordered', 'processing', 'shipped'])

    if (ordersError) throw ordersError

    console.log(`Found ${vendorOrders?.length || 0} orders to check`)

    const updates = []

    // 2. Check tracking for each vendor order
    for (const vendorOrder of vendorOrders || []) {
      try {
        const trackingInfo = await getTrackingFromSupplier(vendorOrder)
        
        if (trackingInfo) {
          // 3. Update vendor order status
          await supabase
            .from('vendor_orders')
            .update({
              status: trackingInfo.status,
              updated_at: new Date().toISOString()
            })
            .eq('id', vendorOrder.id)

          // 4. Create/update shipping label if we got tracking
          if (trackingInfo.tracking_number) {
            const { error: labelError } = await supabase
              .from('shipping_labels')
              .upsert({
                vendor_order_id: vendorOrder.id,
                tracking_number: trackingInfo.tracking_number,
                carrier: trackingInfo.carrier,
                shipping_cost: trackingInfo.shipping_cost,
                label_url: trackingInfo.label_url,
                created_at: new Date().toISOString()
              }, {
                onConflict: 'vendor_order_id'
              })

            if (labelError) {
              console.error('Error creating shipping label:', labelError)
            }
          }

          // 5. Update main order with tracking
          if (trackingInfo.tracking_number && trackingInfo.status === 'shipped') {
            await supabase
              .from('orders')
              .update({
                status: 'shipped',
                tracking_number: trackingInfo.tracking_number,
                shipped_at: new Date().toISOString(),
                fulfillment_status: 'fulfilled'
              })
              .eq('id', vendorOrder.order_id)

            // 6. Send shipping notification to customer
            await supabase.functions.invoke('send-notifications', {
              body: {
                order_id: vendorOrder.order_id,
                notification_type: 'order_shipped',
                tracking_number: trackingInfo.tracking_number,
                carrier: trackingInfo.carrier
              }
            })
          }

          // 7. If delivered, update status and send notification
          if (trackingInfo.status === 'delivered') {
            await supabase
              .from('orders')
              .update({
                status: 'delivered',
                delivered_at: new Date().toISOString()
              })
              .eq('id', vendorOrder.order_id)

            await supabase.functions.invoke('send-notifications', {
              body: {
                order_id: vendorOrder.order_id,
                notification_type: 'order_delivered'
              }
            })
          }

          updates.push({
            vendor_order_id: vendorOrder.id,
            status: trackingInfo.status,
            tracking_number: trackingInfo.tracking_number
          })
        }
      } catch (err) {
        console.error(`Error checking tracking for order ${vendorOrder.id}:`, err)
      }
    }

    console.log(`✅ Synced tracking for ${updates.length} orders`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        checked: vendorOrders?.length || 0,
        updated: updates.length,
        updates
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Error syncing tracking:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})

async function getTrackingFromSupplier(vendorOrder: any) {
  const vendorName = vendorOrder.vendor_name.toLowerCase()

  switch (vendorName) {
    case 'printful':
      return await getPrintfulTracking(vendorOrder.vendor_order_id)
    case 'printify':
      return await getPrintifyTracking(vendorOrder.vendor_order_id)
    case 'aliexpress':
      return await getAliExpressTracking(vendorOrder.vendor_order_id)
    default:
      return null
  }
}

async function getPrintfulTracking(orderId: string) {
  try {
    const response = await fetch(`https://api.printful.com/orders/${orderId}`, {
      headers: {
        'Authorization': `Bearer ${Deno.env.get('PRINTFUL_API_KEY')}`,
        'Content-Type': 'application/json'
      }
    })

    const data = await response.json()
    const order = data.result

    if (!order) return null

    return {
      status: mapPrintfulStatus(order.status),
      tracking_number: order.shipments?.[0]?.tracking_number,
      carrier: order.shipments?.[0]?.carrier,
      shipping_cost: order.costs?.shipping,
      label_url: order.shipments?.[0]?.tracking_url
    }
  } catch (err) {
    console.error('Printful tracking error:', err)
    return null
  }
}

async function getPrintifyTracking(orderId: string) {
  try {
    const response = await fetch(`https://api.printify.com/v1/shops/{shop_id}/orders/${orderId}.json`, {
      headers: {
        'Authorization': `Bearer ${Deno.env.get('PRINTIFY_API_KEY')}`,
        'Content-Type': 'application/json'
      }
    })

    const data = await response.json()

    if (!data) return null

    return {
      status: mapPrintifyStatus(data.status),
      tracking_number: data.shipments?.[0]?.tracking_number,
      carrier: data.shipments?.[0]?.carrier,
      shipping_cost: data.shipments?.[0]?.shipping_cost,
      label_url: data.shipments?.[0]?.tracking_url
    }
  } catch (err) {
    console.error('Printify tracking error:', err)
    return null
  }
}

async function getAliExpressTracking(orderId: string) {
  // AliExpress tracking via their API (requires OAuth)
  // For now, return mock data - implement actual API when credentials available
  console.log('AliExpress tracking check for:', orderId)
  return null
}

// Status mapping functions
function mapPrintfulStatus(status: string): string {
  const statusMap: { [key: string]: string } = {
    'pending': 'processing',
    'failed': 'failed',
    'canceled': 'cancelled',
    'onhold': 'processing',
    'inprocess': 'processing',
    'partial': 'shipped',
    'fulfilled': 'shipped'
  }
  return statusMap[status] || status
}

function mapPrintifyStatus(status: string): string {
  const statusMap: { [key: string]: string } = {
    'pending': 'processing',
    'in-production': 'processing',
    'shipped': 'shipped',
    'delivered': 'delivered',
    'canceled': 'cancelled'
  }
  return statusMap[status] || status
}
