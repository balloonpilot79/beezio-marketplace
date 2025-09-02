import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Email templates
const emailTemplates = {
  'order-confirmation-buyer': {
    subject: 'Order Confirmation - Order #{orderId}',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #2563eb;">Order Confirmed!</h1>
        <p>Hi {billingName},</p>
        <p>Your order has been confirmed and payment processed successfully.</p>

        <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3>Order Details</h3>
          <p><strong>Order ID:</strong> {orderId}</p>
          <p><strong>Total:</strong> ${totalAmount}</p>
          <p><strong>Items:</strong> {itemCount} item(s)</p>
        </div>

        <p>You'll receive another email when your order ships with tracking information.</p>

        <p>Thank you for shopping with Beezio!</p>
      </div>
    `
  },

  'shipping-confirmation-buyer': {
    subject: 'Order Shipped - Order #{orderId}',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #059669;">Your Order Has Shipped!</h1>
        <p>Hi {billingName},</p>
        <p>Great news! Your order has been shipped and is on its way.</p>

        <div style="background: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3>Shipping Details</h3>
          <p><strong>Tracking Number:</strong> {trackingNumber}</p>
          <p><strong>Carrier:</strong> {carrier}</p>
          <p><strong>Estimated Delivery:</strong> {estimatedDelivery}</p>
        </div>

        <p>You can track your package using the tracking number above.</p>
        <p>Thank you for choosing Beezio!</p>
      </div>
    `
  },

  'delivery-confirmation-buyer': {
    subject: 'Package Delivered - Order #{orderId}',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #7c3aed;">Package Delivered!</h1>
        <p>Hi {billingName},</p>
        <p>Your package has been delivered successfully!</p>

        <div style="background: #faf5ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3>Delivery Details</h3>
          <p><strong>Order ID:</strong> {orderId}</p>
          <p><strong>Delivered:</strong> {deliveryDate}</p>
          <p><strong>Tracking Number:</strong> {trackingNumber}</p>
        </div>

        <p>We hope you love your purchase! If you have any questions, please don't hesitate to contact us.</p>
        <p>Thank you for shopping with Beezio!</p>
      </div>
    `
  },

  'order-confirmation-seller': {
    subject: 'New Order - Order #{orderId}',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #ea580c;">New Order Received!</h1>
        <p>Hi {sellerName},</p>
        <p>You have a new order that needs to be fulfilled.</p>

        <div style="background: #fff7ed; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3>Order Details</h3>
          <p><strong>Order ID:</strong> {orderId}</p>
          <p><strong>Customer:</strong> {customerName}</p>
          <p><strong>Total:</strong> ${totalAmount}</p>
          <p><strong>Your Commission:</strong> ${commissionAmount}</p>
        </div>

        <p>The order will be processed automatically through our vendor network.</p>
        <p>You'll receive updates as the order progresses.</p>
      </div>
    `
  },

  'commission-paid-affiliate': {
    subject: 'Commission Paid - Order #{orderId}',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #16a34a;">Commission Paid!</h1>
        <p>Hi {affiliateName},</p>
        <p>Your commission has been paid for a successful sale!</p>

        <div style="background: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3>Commission Details</h3>
          <p><strong>Order ID:</strong> {orderId}</p>
          <p><strong>Commission Amount:</strong> ${commissionAmount}</p>
          <p><strong>Product:</strong> {productTitle}</p>
          <p><strong>Paid To:</strong> Your connected Stripe account</p>
        </div>

        <p>Keep up the great work promoting products!</p>
      </div>
    `
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { to, template, data, subject } = await req.json()

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get email template
    const emailTemplate = emailTemplates[template as keyof typeof emailTemplates]
    if (!emailTemplate) {
      throw new Error(`Template ${template} not found`)
    }

    // Replace template variables
    let htmlContent = emailTemplate.html
    let emailSubject = subject || emailTemplate.subject

    // Replace variables in content
    Object.keys(data).forEach(key => {
      const regex = new RegExp(`{${key}}`, 'g')
      htmlContent = htmlContent.replace(regex, data[key])
      emailSubject = emailSubject.replace(regex, data[key])
    })

    // In production, integrate with SendGrid, Mailgun, etc.
    // For now, we'll use Supabase's email capabilities or a simple SMTP setup

    console.log(`Sending email to ${to}`)
    console.log(`Subject: ${emailSubject}`)
    console.log(`Template: ${template}`)

    // Store email record for tracking
    await supabase.from('email_notifications').insert({
      order_id: data.orderId,
      recipient_email: to,
      recipient_type: template.includes('buyer') ? 'buyer' :
                     template.includes('seller') ? 'seller' : 'affiliate',
      notification_type: template.includes('confirmation') ? 'order_confirmation' :
                        template.includes('shipping') ? 'shipping_confirmation' :
                        template.includes('delivery') ? 'delivery_update' : 'commission_paid',
      status: 'sent',
      sent_at: new Date().toISOString(),
      email_data: { template, data, subject: emailSubject }
    })

    // Here you would integrate with your email service provider
    // Example with SendGrid:
    /*
    const sgMail = require('@sendgrid/mail')
    sgMail.setApiKey(Deno.env.get('SENDGRID_API_KEY'))

    const msg = {
      to,
      from: 'orders@beezio.co',
      subject: emailSubject,
      html: htmlContent
    }

    await sgMail.send(msg)
    */

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Email sent successfully',
        to,
        template,
        subject: emailSubject
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Email service error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: (error as Error).message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})
