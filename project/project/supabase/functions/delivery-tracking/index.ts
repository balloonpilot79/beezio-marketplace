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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get all tracking records that need to be checked
    const { data: trackingRecords, error } = await supabase
      .from('delivery_tracking')
      .select(`
        *,
        orders (
          id,
          billing_email,
          billing_name,
          order_items (
            seller:profiles!seller_id (email, full_name),
            affiliate:profiles!affiliate_id (email, full_name)
          )
        )
      `)
      .lte('next_check', new Date().toISOString())
      .eq('status', 'in_transit')

    if (error) {
      throw error
    }

    const results = []

    for (const record of trackingRecords || []) {
      try {
        const trackingUpdate = await checkTrackingStatus(record)

        if (trackingUpdate.statusChanged) {
          // Update tracking record
          await supabase
            .from('delivery_tracking')
            .update({
              status: trackingUpdate.newStatus,
              last_checked: new Date().toISOString(),
              next_check: trackingUpdate.nextCheck,
              tracking_events: trackingUpdate.events,
              delivery_date: trackingUpdate.deliveryDate,
              updated_at: new Date().toISOString()
            })
            .eq('id', record.id)

          // Send notification emails if status changed
          await sendDeliveryUpdateEmails(supabase, record, trackingUpdate)

          results.push({
            trackingNumber: record.tracking_number,
            oldStatus: record.status,
            newStatus: trackingUpdate.newStatus,
            notified: true
          })
        } else {
          // Just update last checked time
          await supabase
            .from('delivery_tracking')
            .update({
              last_checked: new Date().toISOString(),
              next_check: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Check again in 24 hours
              updated_at: new Date().toISOString()
            })
            .eq('id', record.id)

          results.push({
            trackingNumber: record.tracking_number,
            status: record.status,
            checked: true
          })
        }

      } catch (error) {
        console.error(`Error checking tracking ${record.tracking_number}:`, error)
        results.push({
          trackingNumber: record.tracking_number,
          error: error.message
        })
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Checked ${results.length} tracking records`,
        results
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Delivery tracking error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})

async function checkTrackingStatus(record: any) {
  // This would integrate with carrier APIs (USPS, UPS, FedEx, etc.)
  // For now, simulate tracking updates

  const currentTime = Date.now()
  const orderTime = new Date(record.created_at).getTime()
  const hoursSinceOrder = (currentTime - orderTime) / (1000 * 60 * 60)

  let newStatus = record.status
  let statusChanged = false
  let deliveryDate = null
  const events = [...(record.tracking_events || [])]

  // Simulate realistic delivery progression
  if (hoursSinceOrder < 24) {
    // Still processing
    newStatus = 'in_transit'
  } else if (hoursSinceOrder < 48) {
    // Out for delivery
    if (record.status !== 'out_for_delivery') {
      newStatus = 'out_for_delivery'
      statusChanged = true
      events.push({
        status: 'out_for_delivery',
        description: 'Your package is out for delivery',
        timestamp: new Date().toISOString(),
        location: 'Local Delivery Facility'
      })
    }
  } else {
    // Delivered
    if (record.status !== 'delivered') {
      newStatus = 'delivered'
      statusChanged = true
      deliveryDate = new Date().toISOString()
      events.push({
        status: 'delivered',
        description: 'Package delivered successfully',
        timestamp: new Date().toISOString(),
        location: 'Delivered to recipient'
      })
    }
  }

  return {
    statusChanged,
    newStatus,
    nextCheck: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Check again in 24 hours
    events,
    deliveryDate
  }
}

async function sendDeliveryUpdateEmails(supabase: any, record: any, trackingUpdate: any) {
  const order = record.orders

  if (!order) return

  // Email buyer
  if (trackingUpdate.newStatus === 'delivered') {
    await sendEmail({
      to: order.billing_email,
      subject: `Package Delivered - Order #${order.id.slice(-8)}`,
      template: 'delivery-confirmation-buyer',
      data: {
        order,
        trackingNumber: record.tracking_number,
        carrier: record.carrier,
        deliveryDate: trackingUpdate.deliveryDate
      }
    })

    // Update order status to delivered
    await supabase
      .from('orders')
      .update({
        status: 'delivered',
        fulfillment_status: 'delivered',
        updated_at: new Date().toISOString()
      })
      .eq('id', order.id)

  } else if (trackingUpdate.newStatus === 'out_for_delivery') {
    await sendEmail({
      to: order.billing_email,
      subject: `Out for Delivery - Order #${order.id.slice(-8)}`,
      template: 'delivery-update-buyer',
      data: {
        order,
        trackingNumber: record.tracking_number,
        carrier: record.carrier,
        status: 'out_for_delivery'
      }
    })
  }

  // Email sellers about delivery status
  const sellerEmails = [...new Set(order.order_items?.map((item: any) => item.seller?.email).filter(Boolean) || [])]
  for (const sellerEmail of sellerEmails) {
    await sendEmail({
      to: sellerEmail,
      subject: `Order Delivery Update - Order #${order.id.slice(-8)}`,
      template: 'delivery-update-seller',
      data: {
        order,
        trackingNumber: record.tracking_number,
        carrier: record.carrier,
        status: trackingUpdate.newStatus
      }
    })
  }

  // Email affiliates about delivery status (for commission tracking)
  const affiliateEmails = [...new Set(order.order_items?.map((item: any) => item.affiliate?.email).filter(Boolean) || [])]
  for (const affiliateEmail of affiliateEmails) {
    await sendEmail({
      to: affiliateEmail,
      subject: `Commission Update - Order #${order.id.slice(-8)}`,
      template: 'delivery-update-affiliate',
      data: {
        order,
        trackingNumber: record.tracking_number,
        carrier: record.carrier,
        status: trackingUpdate.newStatus
      }
    })
  }
}

async function sendEmail({ to, subject, template, data }: {
  to: string
  subject: string
  template: string
  data: any
}) {
  // This would integrate with an email service like SendGrid, Mailgun, etc.
  console.log(`Sending email to ${to}: ${subject}`)
  console.log('Template:', template)
  console.log('Data:', data)

  // In production, this would send actual emails
  // Store email notification record
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  await supabase.from('email_notifications').insert({
    order_id: data.order.id,
    recipient_email: to,
    recipient_type: template.includes('buyer') ? 'buyer' :
                   template.includes('seller') ? 'seller' : 'affiliate',
    notification_type: template.includes('confirmation') ? 'order_confirmation' :
                      template.includes('delivery') ? 'delivery_update' : 'commission_paid',
    status: 'sent',
    sent_at: new Date().toISOString(),
    email_data: data
  })
}
