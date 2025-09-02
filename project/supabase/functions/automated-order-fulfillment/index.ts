import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import Stripe from 'npm:stripe@14.21.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface OrderItem {
  id: string
  product_id: string
  seller_id: string
  affiliate_id?: string
  quantity: number
  unit_price: number
  total_price: number
}

interface Product {
  id: string
  title: string
  description: string
  images: string[]
  vendor_sku?: string
  vendor_id?: string
  supplier_info?: any
}

interface VendorOrder {
  vendor_id: string
  vendor_order_id: string
  items: Array<{
    sku: string
    quantity: number
    price: number
  }>
  shipping_address: any
  status: string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { orderId } = await req.json()

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2023-10-16',
    })

    // 1. Get order details with items
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (
          *,
          products (*),
          seller:profiles!seller_id (*),
          affiliate:profiles!affiliate_id (*)
        )
      `)
      .eq('id', orderId)
      .single()

    if (orderError || !order) {
      throw new Error(`Order not found: ${orderError?.message}`)
    }

    console.log('Processing automated fulfillment for order:', orderId)

    // 2. Send order confirmation emails
    await sendOrderConfirmationEmails(supabase, order)

    // 3. Process vendor orders (order from suppliers)
    const vendorOrders = await processVendorOrders(supabase, order)

    // 4. Create shipping labels and schedule pickup
    const shippingInfo = await createShippingLabels(supabase, order, vendorOrders)

    // 5. Update order with tracking information
    await updateOrderTracking(supabase, orderId, shippingInfo)

    // 6. Send shipping confirmation emails
    await sendShippingConfirmationEmails(supabase, order, shippingInfo)

    // 7. Schedule delivery tracking updates
    await scheduleDeliveryTracking(supabase, orderId, shippingInfo)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Automated order fulfillment initiated',
        orderId,
        vendorOrders: vendorOrders.length,
        trackingNumbers: shippingInfo.map(s => s.trackingNumber)
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Automated fulfillment error:', error)
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

async function sendOrderConfirmationEmails(supabase: any, order: any) {
  const { order_items } = order

  // Email buyer
  await sendEmail({
    to: order.billing_email,
    subject: `Order Confirmation - Order #${order.id.slice(-8)}`,
    template: 'order-confirmation-buyer',
    data: { order, items: order_items }
  })

  // Email sellers
  const sellerEmails = [...new Set(order_items.map((item: any) => item.seller.email))]
  for (const sellerEmail of sellerEmails) {
    const sellerItems = order_items.filter((item: any) => item.seller.email === sellerEmail)
    await sendEmail({
      to: sellerEmail,
      subject: `New Order - Order #${order.id.slice(-8)}`,
      template: 'order-confirmation-seller',
      data: { order, items: sellerItems }
    })
  }

  // Email affiliates
  const affiliateEmails = [...new Set(order_items
    .filter((item: any) => item.affiliate_id)
    .map((item: any) => item.affiliate.email)
  )]
  for (const affiliateEmail of affiliateEmails) {
    const affiliateItems = order_items.filter((item: any) => item.affiliate?.email === affiliateEmail)
    await sendEmail({
      to: affiliateEmail,
      subject: `Commission Earned - Order #${order.id.slice(-8)}`,
      template: 'order-confirmation-affiliate',
      data: { order, items: affiliateItems }
    })
  }
}

async function processVendorOrders(supabase: any, order: any): Promise<VendorOrder[]> {
  const vendorOrders: VendorOrder[] = []
  const { order_items } = order

  // Group items by vendor
  const vendorGroups = new Map<string, any[]>()

  for (const item of order_items) {
    const vendorId = item.products.vendor_id || 'default'
    if (!vendorGroups.has(vendorId)) {
      vendorGroups.set(vendorId, [])
    }
    vendorGroups.get(vendorId)!.push(item)
  }

  // Process each vendor order
  for (const [vendorId, items] of vendorGroups) {
    try {
      const vendorOrder = await createVendorOrder(vendorId, items, order)
      vendorOrders.push(vendorOrder)

      // Store vendor order in database
      await supabase.from('vendor_orders').insert({
        order_id: order.id,
        vendor_id: vendorId,
        vendor_order_id: vendorOrder.vendor_order_id,
        items: vendorOrder.items,
        status: 'ordered',
        shipping_address: vendorOrder.shipping_address
      })

    } catch (error) {
      console.error(`Failed to order from vendor ${vendorId}:`, error)
      // Continue with other vendors even if one fails
    }
  }

  return vendorOrders
}

async function createVendorOrder(vendorId: string, items: any[], order: any): Promise<VendorOrder> {
  // This would integrate with actual vendor APIs
  // For now, simulate vendor ordering

  const vendorOrder: VendorOrder = {
    vendor_id: vendorId,
    vendor_order_id: `VENDOR-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    items: items.map(item => ({
      sku: item.products.vendor_sku || item.products.id,
      quantity: item.quantity,
      price: item.unit_price
    })),
    shipping_address: {
      name: order.billing_name,
      email: order.billing_email,
      address: order.shipping_address
    },
    status: 'ordered'
  }

  // Simulate API call to vendor
  console.log(`Ordering from vendor ${vendorId}:`, vendorOrder)

  // In production, this would make actual API calls to vendors like:
  // - AliExpress API
  // - Oberlo
  // - SaleHoo
  // - Wholesale suppliers

  return vendorOrder
}

async function createShippingLabels(supabase: any, order: any, vendorOrders: VendorOrder[]) {
  const shippingInfo = []

  // Use Shippo or similar service for shipping
  for (const vendorOrder of vendorOrders) {
    try {
      const label = await createShippingLabel(vendorOrder, order)

      shippingInfo.push({
        vendorOrderId: vendorOrder.vendor_order_id,
        trackingNumber: label.trackingNumber,
        carrier: label.carrier,
        shippingCost: label.cost,
        estimatedDelivery: label.estimatedDelivery,
        labelUrl: label.labelUrl
      })

      // Store shipping info
      await supabase.from('shipping_labels').insert({
        order_id: order.id,
        vendor_order_id: vendorOrder.vendor_order_id,
        tracking_number: label.trackingNumber,
        carrier: label.carrier,
        cost: label.cost,
        estimated_delivery: label.estimatedDelivery,
        label_url: label.labelUrl,
        status: 'created'
      })

    } catch (error) {
      console.error('Failed to create shipping label:', error)
    }
  }

  return shippingInfo
}

async function createShippingLabel(vendorOrder: VendorOrder, order: any) {
  // Integrate with shipping provider (Shippo, EasyShip, etc.)
  // This is a simulation - in production would call actual API

  const label = {
    trackingNumber: `TRK${Date.now()}${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
    carrier: 'USPS', // or UPS, FedEx, etc.
    cost: 5.99,
    estimatedDelivery: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days
    labelUrl: `https://shipping-label.example.com/${vendorOrder.vendor_order_id}`
  }

  console.log('Created shipping label:', label)
  return label
}

async function updateOrderTracking(supabase: any, orderId: string, shippingInfo: any[]) {
  await supabase
    .from('orders')
    .update({
      status: 'shipped',
      tracking_numbers: shippingInfo.map(s => s.trackingNumber),
      shipping_carrier: shippingInfo[0]?.carrier || 'USPS',
      estimated_delivery: shippingInfo[0]?.estimatedDelivery,
      updated_at: new Date().toISOString()
    })
    .eq('id', orderId)
}

async function sendShippingConfirmationEmails(supabase: any, order: any, shippingInfo: any[]) {
  // Email buyer with tracking info
  await sendEmail({
    to: order.billing_email,
    subject: `Order Shipped - Order #${order.id.slice(-8)}`,
    template: 'shipping-confirmation-buyer',
    data: { order, shippingInfo }
  })

  // Email sellers
  const { order_items } = order
  const sellerEmails = [...new Set(order_items.map((item: any) => item.seller.email))]
  for (const sellerEmail of sellerEmails) {
    await sendEmail({
      to: sellerEmail,
      subject: `Order Shipped - Order #${order.id.slice(-8)}`,
      template: 'shipping-confirmation-seller',
      data: { order, shippingInfo }
    })
  }
}

async function scheduleDeliveryTracking(supabase: any, orderId: string, shippingInfo: any[]) {
  // Schedule a function to check delivery status periodically
  // This could be done with Supabase cron or scheduled functions

  for (const info of shippingInfo) {
    await supabase.from('delivery_tracking').insert({
      order_id: orderId,
      tracking_number: info.trackingNumber,
      carrier: info.carrier,
      status: 'in_transit',
      last_checked: new Date().toISOString(),
      next_check: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // Check daily
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
  // For now, we'll use Supabase's built-in email or a simple SMTP setup

  console.log(`Sending email to ${to}: ${subject}`)
  console.log('Template:', template)
  console.log('Data:', data)

  // In production, this would send actual emails
  // Example with SendGrid:
  /*
  const sgMail = require('@sendgrid/mail')
  sgMail.setApiKey(process.env.SENDGRID_API_KEY)

  const msg = {
    to,
    from: 'orders@beezio.co',
    subject,
    templateId: getTemplateId(template),
    dynamicTemplateData: data
  }

  await sgMail.send(msg)
  */
}
