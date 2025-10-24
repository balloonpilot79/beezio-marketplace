// SEND NOTIFICATIONS - Auto-send emails to customers, sellers, affiliates
// This Edge Function handles all email notifications

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

    const { order_id, notification_type, recipient_email, tracking_number, carrier } = await req.json()

    console.log(`📧 Sending ${notification_type} notification for order ${order_id}`)

    // 1. Get order details
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        *,
        buyer:buyer_id(email, profiles(full_name)),
        order_items(
          quantity,
          price,
          products(title, images)
        )
      `)
      .eq('id', order_id)
      .single()

    if (orderError) throw orderError

    // 2. Determine recipients based on notification type
    const recipients = []
    
    switch (notification_type) {
      case 'order_placed':
        // Notify buyer
        recipients.push({
          email: recipient_email || order.buyer.email,
          type: 'buyer',
          subject: '✅ Order Confirmation - Beezio Marketplace',
          template: 'order_confirmation'
        })
        break

      case 'order_shipped':
        // Notify buyer with tracking
        recipients.push({
          email: order.buyer.email,
          type: 'buyer',
          subject: '📦 Your order has shipped!',
          template: 'order_shipped'
        })
        break

      case 'order_delivered':
        // Notify buyer
        recipients.push({
          email: order.buyer.email,
          type: 'buyer',
          subject: '🎉 Your order has been delivered!',
          template: 'order_delivered'
        })
        break

      case 'payout_ready':
        // Notify seller/affiliate
        recipients.push({
          email: recipient_email,
          type: 'seller',
          subject: '💰 Payout Available - Beezio',
          template: 'payout_notification'
        })
        break
    }

    // 3. Send emails to all recipients
    const emailResults = []
    
    for (const recipient of recipients) {
      const emailContent = generateEmailContent(
        recipient.template,
        order,
        { tracking_number, carrier }
      )

      // Send via your email provider (Resend, SendGrid, etc.)
      const emailResult = await sendEmail({
        to: recipient.email,
        subject: recipient.subject,
        html: emailContent
      })

      // 4. Log notification in database
      await supabase
        .from('email_notifications')
        .insert({
          order_id,
          recipient_email: recipient.email,
          recipient_type: recipient.type,
          email_type: notification_type,
          status: emailResult.success ? 'sent' : 'failed',
          sent_at: emailResult.success ? new Date().toISOString() : null,
          created_at: new Date().toISOString()
        })

      emailResults.push(emailResult)
    }

    console.log(`✅ Sent ${emailResults.length} notifications`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        notifications_sent: emailResults.length,
        results: emailResults
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Error sending notifications:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})

function generateEmailContent(template: string, order: any, extras: any) {
  const baseUrl = 'https://beezio.co'
  
  switch (template) {
    case 'order_confirmation':
      return `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #f97316 0%, #f59e0b 100%); color: white; padding: 30px; text-align: center; border-radius: 10px; }
            .content { background: white; padding: 30px; border: 1px solid #e5e7eb; border-radius: 10px; margin-top: 20px; }
            .order-items { margin: 20px 0; }
            .item { display: flex; padding: 15px; border-bottom: 1px solid #e5e7eb; }
            .button { display: inline-block; background: #f97316; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; margin: 20px 0; }
            .footer { text-align: center; color: #6b7280; margin-top: 30px; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎉 Order Confirmed!</h1>
              <p>Thank you for shopping with Beezio</p>
            </div>
            
            <div class="content">
              <h2>Hi ${order.buyer.profiles.full_name},</h2>
              <p>Your order has been confirmed and is being processed. You'll receive another email when it ships.</p>
              
              <div class="order-items">
                <h3>Order Details</h3>
                ${order.order_items.map((item: any) => `
                  <div class="item">
                    <div>
                      <strong>${item.products.title}</strong><br>
                      Quantity: ${item.quantity} × $${item.price}
                    </div>
                  </div>
                `).join('')}
              </div>
              
              <p><strong>Order Total:</strong> $${order.total_amount}</p>
              <p><strong>Order ID:</strong> ${order.id}</p>
              
              <a href="${baseUrl}/orders/${order.id}" class="button">View Order Status</a>
              
              <p>Questions? Reply to this email or visit our <a href="${baseUrl}/support">Support Center</a></p>
            </div>
            
            <div class="footer">
              <p>© 2025 Beezio Marketplace. All rights reserved.</p>
              <p>Supporting local businesses and affiliates</p>
            </div>
          </div>
        </body>
        </html>
      `

    case 'order_shipped':
      return `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%); color: white; padding: 30px; text-align: center; border-radius: 10px; }
            .content { background: white; padding: 30px; border: 1px solid #e5e7eb; border-radius: 10px; margin-top: 20px; }
            .tracking-box { background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center; }
            .tracking-number { font-size: 24px; font-weight: bold; color: #1f2937; letter-spacing: 2px; }
            .button { display: inline-block; background: #3b82f6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; margin: 20px 0; }
            .footer { text-align: center; color: #6b7280; margin-top: 30px; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>📦 Your Order Has Shipped!</h1>
              <p>It's on its way to you</p>
            </div>
            
            <div class="content">
              <h2>Hi ${order.buyer.profiles.full_name},</h2>
              <p>Great news! Your order has been shipped and is on its way.</p>
              
              <div class="tracking-box">
                <p style="margin: 0 0 10px 0; color: #6b7280;">Tracking Number</p>
                <div class="tracking-number">${extras.tracking_number}</div>
                <p style="margin: 10px 0 0 0; color: #6b7280;">Carrier: ${extras.carrier}</p>
              </div>
              
              <p><strong>Order ID:</strong> ${order.id}</p>
              
              <a href="https://track.example.com/${extras.tracking_number}" class="button">Track Your Package</a>
              
              <p>Expected delivery: 3-7 business days</p>
            </div>
            
            <div class="footer">
              <p>© 2025 Beezio Marketplace. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `

    case 'order_delivered':
      return `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; text-align: center; border-radius: 10px; }
            .content { background: white; padding: 30px; border: 1px solid #e5e7eb; border-radius: 10px; margin-top: 20px; }
            .button { display: inline-block; background: #10b981; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; margin: 20px 0; }
            .footer { text-align: center; color: #6b7280; margin-top: 30px; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎉 Delivered!</h1>
              <p>Your order has arrived</p>
            </div>
            
            <div class="content">
              <h2>Hi ${order.buyer.profiles.full_name},</h2>
              <p>Your order has been successfully delivered. We hope you love it!</p>
              
              <p><strong>Order ID:</strong> ${order.id}</p>
              
              <a href="${baseUrl}/orders/${order.id}/review" class="button">Leave a Review</a>
              
              <p>Had a great experience? Share it with others and earn referral rewards!</p>
              
              <p>Questions or issues? Contact our <a href="${baseUrl}/support">support team</a></p>
            </div>
            
            <div class="footer">
              <p>© 2025 Beezio Marketplace. All rights reserved.</p>
              <p>Thank you for supporting local businesses!</p>
            </div>
          </div>
        </body>
        </html>
      `

    default:
      return `<p>Notification for order ${order.id}</p>`
  }
}

async function sendEmail(params: { to: string; subject: string; html: string }) {
  // Using Resend (popular email API for Supabase)
  // You can also use SendGrid, Mailgun, AWS SES, etc.
  
  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
  
  if (!RESEND_API_KEY) {
    console.warn('No email API key configured, skipping email send')
    return { success: false, error: 'No API key' }
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Beezio Marketplace <orders@beezio.co>',
        to: params.to,
        subject: params.subject,
        html: params.html
      })
    })

    const result = await response.json()
    
    return {
      success: response.ok,
      id: result.id,
      error: result.error?.message
    }
  } catch (err) {
    console.error('Email send error:', err)
    return { success: false, error: err.message }
  }
}
