import { supabase } from '../lib/supabase';

// Email notification types
export type EmailType =
  | 'welcome'
  | 'password_reset'
  | 'order_confirmation'
  | 'order_shipped'
  | 'order_delivered'
  | 'payment_received'
  | 'commission_earned'
  | 'product_sold'
  | 'new_affiliate_signup'
  | 'weekly_report'
  | 'account_verification'
  | 'support_ticket'
  | 'marketing_update';

interface EmailData {
  to: string;
  subject: string;
  html: string;
  type: EmailType;
  userId?: string;
  metadata?: Record<string, any>;
}

// Email templates
const emailTemplates = {
  welcome: (data: any) => ({
    subject: `Welcome to Beezio, ${data.name}! 🎉`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #f59e0b, #d97706); padding: 40px 20px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 28px;">🐝 Welcome to Beezio!</h1>
          <p style="color: white; margin: 10px 0 0 0; opacity: 0.9;">Your journey to success starts here</p>
        </div>
        <div style="background: white; padding: 40px 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <h2 style="color: #1f2937; margin-top: 0;">Hi ${data.name}!</h2>
          <p style="color: #6b7280; line-height: 1.6; margin-bottom: 20px;">
            Thank you for joining Beezio! We're excited to have you as part of our community where sellers move products and affiliates earn big.
          </p>

          <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #1f2937; margin-top: 0;">🎯 Your Next Steps:</h3>
            <ul style="color: #6b7280; padding-left: 20px;">
              <li>Complete your profile setup</li>
              <li>Explore the marketplace</li>
              <li>Start selling or earning as an affiliate</li>
            </ul>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${data.dashboardUrl}" style="background: #f59e0b; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Get Started</a>
          </div>

          <p style="color: #6b7280; font-size: 14px; text-align: center; margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 20px;">
            Need help? Contact our support team anytime.<br>
            Happy selling and earning! 🐝
          </p>
        </div>
      </div>
    `
  }),

  password_reset: (data: any) => ({
    subject: 'Reset Your Beezio Password 🔐',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #f59e0b, #d97706); padding: 40px 20px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 28px;">🔐 Password Reset</h1>
          <p style="color: white; margin: 10px 0 0 0; opacity: 0.9;">Reset your Beezio account password</p>
        </div>
        <div style="background: white; padding: 40px 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <h2 style="color: #1f2937; margin-top: 0;">Reset Your Password</h2>
          <p style="color: #6b7280; line-height: 1.6; margin-bottom: 20px;">
            We received a request to reset your password for your Beezio account. Click the button below to create a new password.
          </p>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${data.resetUrl}" style="background: #f59e0b; color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; font-size: 16px;">Reset Password</a>
          </div>

          <div style="background: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
            <h3 style="color: #92400e; margin-top: 0;">⚠️ Security Notice:</h3>
            <ul style="color: #92400e; margin: 10px 0; padding-left: 20px;">
              <li>This link will expire in 1 hour</li>
              <li>If you didn't request this reset, please ignore this email</li>
              <li>Your account security is important to us</li>
            </ul>
          </div>

          <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #1f2937; margin-top: 0;">Can't click the button?</h3>
            <p style="color: #6b7280; margin: 10px 0;">Copy and paste this link into your browser:</p>
            <p style="word-break: break-all; background: white; padding: 10px; border: 1px solid #e5e7eb; border-radius: 4px; font-family: monospace; font-size: 12px; color: #374151;">${data.resetUrl}</p>
          </div>

          <p style="color: #6b7280; font-size: 14px; text-align: center; margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 20px;">
            If you have any questions, contact our support team.<br>
            Stay safe and happy selling! 🐝
          </p>
        </div>
      </div>
    `
  }),

  order_confirmation: (data: any) => ({
    subject: `Order Confirmation - Order #${data.orderId}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #10b981; padding: 40px 20px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 28px;">✅ Order Confirmed!</h1>
          <p style="color: white; margin: 10px 0 0 0; opacity: 0.9;">Your order is being processed</p>
        </div>
        <div style="background: white; padding: 40px 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <h2 style="color: #1f2937; margin-top: 0;">Order #${data.orderId}</h2>
          <p style="color: #6b7280; margin-bottom: 20px;">Thank you for your purchase! Here's what you ordered:</p>

          <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            ${data.items.map((item: any) => `
              <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                <span>${item.name}</span>
                <span>$${item.price}</span>
              </div>
            `).join('')}
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 15px 0;">
            <div style="display: flex; justify-content: space-between; font-weight: bold;">
              <span>Total</span>
              <span>$${data.total}</span>
            </div>
          </div>

          <div style="background: #fef3c7; padding: 15px; border-radius: 6px; margin: 20px 0;">
            <p style="margin: 0; color: #92400e; font-size: 14px;">
              📦 <strong>Estimated Delivery:</strong> ${data.deliveryDate}<br>
              📍 <strong>Shipping to:</strong> ${data.shippingAddress}
            </p>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${data.trackingUrl}" style="background: #10b981; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Track Your Order</a>
          </div>
        </div>
      </div>
    `
  }),

  commission_earned: (data: any) => ({
    subject: `💰 Commission Earned - $${data.amount}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #10b981, #059669); padding: 40px 20px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 28px;">💰 Commission Earned!</h1>
          <p style="color: white; margin: 10px 0 0 0; opacity: 0.9;">You've earned $${data.amount}!</p>
        </div>
        <div style="background: white; padding: 40px 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <h2 style="color: #1f2937; margin-top: 0;">Congratulations!</h2>
          <p style="color: #6b7280; line-height: 1.6; margin-bottom: 20px;">
            You've earned a commission from your affiliate marketing efforts. Keep up the great work!
          </p>

          <div style="background: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981;">
            <h3 style="color: #065f46; margin-top: 0;">💵 Commission Details:</h3>
            <p style="margin: 5px 0; color: #065f46;"><strong>Amount:</strong> $${data.amount}</p>
            <p style="margin: 5px 0; color: #065f46;"><strong>Product:</strong> ${data.productName}</p>
            <p style="margin: 5px 0; color: #065f46;"><strong>Commission Rate:</strong> ${data.rate}%</p>
            <p style="margin: 5px 0; color: #065f46;"><strong>Order ID:</strong> ${data.orderId}</p>
          </div>

          <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #1f2937; margin-top: 0;">📊 Your Stats:</h3>
            <div style="display: flex; justify-content: space-between; margin-top: 15px;">
              <div style="text-align: center;">
                <div style="font-size: 24px; font-weight: bold; color: #10b981;">$${data.monthlyTotal}</div>
                <div style="font-size: 12px; color: #6b7280;">This Month</div>
              </div>
              <div style="text-align: center;">
                <div style="font-size: 24px; font-weight: bold; color: #10b981;">${data.totalClicks}</div>
                <div style="font-size: 12px; color: #6b7280;">Total Clicks</div>
              </div>
              <div style="text-align: center;">
                <div style="font-size: 24px; font-weight: bold; color: #10b981;">${data.conversionRate}%</div>
                <div style="font-size: 12px; color: #6b7280;">Conversion Rate</div>
              </div>
            </div>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${data.dashboardUrl}" style="background: #10b981; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">View Dashboard</a>
          </div>
        </div>
      </div>
    `
  }),

  product_sold: (data: any) => ({
    subject: `🎉 Product Sold - ${data.productName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #3b82f6, #1d4ed8); padding: 40px 20px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 28px;">🎉 Product Sold!</h1>
          <p style="color: white; margin: 10px 0 0 0; opacity: 0.9;">Congratulations on your sale!</p>
        </div>
        <div style="background: white; padding: 40px 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <h2 style="color: #1f2937; margin-top: 0;">Great news!</h2>
          <p style="color: #6b7280; line-height: 1.6; margin-bottom: 20px;">
            One of your products has been sold! Here's the details:
          </p>

          <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #1f2937; margin-top: 0;">📦 Sale Details:</h3>
            <p style="margin: 5px 0;"><strong>Product:</strong> ${data.productName}</p>
            <p style="margin: 5px 0;"><strong>Price:</strong> $${data.price}</p>
            <p style="margin: 5px 0;"><strong>Commission Paid:</strong> $${data.commission}</p>
            <p style="margin: 5px 0;"><strong>Order ID:</strong> ${data.orderId}</p>
            <p style="margin: 5px 0;"><strong>Customer:</strong> ${data.customerName}</p>
          </div>

          <div style="background: #fef3c7; padding: 15px; border-radius: 6px; margin: 20px 0;">
            <p style="margin: 0; color: #92400e;">
              📋 <strong>Next Steps:</strong><br>
              • Prepare the product for shipping<br>
              • Update the order status in your dashboard<br>
              • Contact the customer if needed
            </p>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${data.dashboardUrl}" style="background: #3b82f6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Manage Order</a>
          </div>
        </div>
      </div>
    `
  }),

  order_shipped: (data: any) => ({
    subject: `🚚 Your Order Has Shipped - Order #${data.orderId}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #8b5cf6; padding: 40px 20px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 28px;">🚚 Order Shipped!</h1>
          <p style="color: white; margin: 10px 0 0 0; opacity: 0.9;">Your package is on its way</p>
        </div>
        <div style="background: white; padding: 40px 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <h2 style="color: #1f2937; margin-top: 0;">Your order is on the way!</h2>
          <p style="color: #6b7280; line-height: 1.6; margin-bottom: 20px;">
            Great news! Your order has been shipped and is on its way to you.
          </p>

          <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #1f2937; margin-top: 0;">📦 Shipping Details:</h3>
            <p style="margin: 5px 0;"><strong>Order ID:</strong> ${data.orderId}</p>
            <p style="margin: 5px 0;"><strong>Carrier:</strong> ${data.carrier}</p>
            <p style="margin: 5px 0;"><strong>Tracking Number:</strong> ${data.trackingNumber}</p>
            <p style="margin: 5px 0;"><strong>Estimated Delivery:</strong> ${data.deliveryDate}</p>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${data.trackingUrl}" style="background: #8b5cf6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Track Package</a>
          </div>

          <p style="color: #6b7280; font-size: 14px; text-align: center; margin-top: 30px;">
            Questions about your order? Contact our support team.
          </p>
        </div>
      </div>
    `
  })
};

// Email service class
class EmailService {
  private async sendEmail(emailData: EmailData): Promise<boolean> {
    try {
      // For now, we'll log the email and simulate sending
      // In production, you'd integrate with an email service like SendGrid, Mailgun, etc.

      console.log('📧 Sending email:', {
        to: emailData.to,
        subject: emailData.subject,
        type: emailData.type,
        userId: emailData.userId
      });

      // Store email in database for tracking
      const { error } = await supabase
        .from('email_notifications')
        .insert({
          user_id: emailData.userId,
          email_type: emailData.type,
          recipient_email: emailData.to,
          subject: emailData.subject,
          content: emailData.html,
          metadata: emailData.metadata,
          sent_at: new Date().toISOString(),
          status: 'sent'
        });

      if (error) {
        console.error('Error storing email notification:', error);
      }

      // TODO: Integrate with actual email service
      // Example: SendGrid, Mailgun, AWS SES, etc.

      return true;
    } catch (error) {
      console.error('Error sending email:', error);
      return false;
    }
  }

  // Welcome email for new users
  async sendWelcomeEmail(userId: string, userEmail: string, userName: string): Promise<boolean> {
    const template = emailTemplates.welcome({
      name: userName,
      dashboardUrl: `${window.location.origin}/dashboard`
    });

    return this.sendEmail({
      to: userEmail,
      subject: template.subject,
      html: template.html,
      type: 'welcome',
      userId,
      metadata: { userName }
    });
  }

  // Order confirmation email
  async sendOrderConfirmation(
    userId: string,
    userEmail: string,
    orderData: {
      orderId: string;
      items: Array<{ name: string; price: number }>;
      total: number;
      deliveryDate: string;
      shippingAddress: string;
      trackingUrl: string;
    }
  ): Promise<boolean> {
    const template = emailTemplates.order_confirmation(orderData);

    return this.sendEmail({
      to: userEmail,
      subject: template.subject,
      html: template.html,
      type: 'order_confirmation',
      userId,
      metadata: orderData
    });
  }

  // Commission earned notification
  async sendCommissionEarned(
    userId: string,
    userEmail: string,
    commissionData: {
      amount: number;
      productName: string;
      rate: number;
      orderId: string;
      monthlyTotal: number;
      totalClicks: number;
      conversionRate: number;
      dashboardUrl: string;
    }
  ): Promise<boolean> {
    const template = emailTemplates.commission_earned(commissionData);

    return this.sendEmail({
      to: userEmail,
      subject: template.subject,
      html: template.html,
      type: 'commission_earned',
      userId,
      metadata: commissionData
    });
  }

  // Password reset email
  async sendPasswordResetEmail(
    userId: string,
    userEmail: string,
    resetData: {
      resetUrl: string;
    }
  ): Promise<boolean> {
    const template = emailTemplates.password_reset(resetData);

    return this.sendEmail({
      to: userEmail,
      subject: template.subject,
      html: template.html,
      type: 'password_reset',
      userId,
      metadata: resetData
    });
  }

  // Order shipped notification
  async sendOrderShipped(
    userId: string,
    userEmail: string,
    shippingData: {
      orderId: string;
      carrier: string;
      trackingNumber: string;
      deliveryDate: string;
      trackingUrl: string;
    }
  ): Promise<boolean> {
    const template = emailTemplates.order_shipped(shippingData);

    return this.sendEmail({
      to: userEmail,
      subject: template.subject,
      html: template.html,
      type: 'order_shipped',
      userId,
      metadata: shippingData
    });
  }

  // Generic email sender for custom notifications
  async sendCustomEmail(
    userId: string,
    userEmail: string,
    subject: string,
    htmlContent: string,
    type: EmailType,
    metadata?: Record<string, any>
  ): Promise<boolean> {
    return this.sendEmail({
      to: userEmail,
      subject,
      html: htmlContent,
      type,
      userId,
      metadata
    });
  }
}

// Export singleton instance
export const emailService = new EmailService();

// Helper functions for common email scenarios
export const sendWelcomeEmail = (userId: string, email: string, name: string) =>
  emailService.sendWelcomeEmail(userId, email, name);

export const sendOrderConfirmation = (userId: string, email: string, orderData: any) =>
  emailService.sendOrderConfirmation(userId, email, orderData);

export const sendCommissionNotification = (userId: string, email: string, commissionData: any) =>
  emailService.sendCommissionEarned(userId, email, commissionData);

export const sendSaleNotification = async (userId: string, email: string, saleData: any) => {
  const template = emailTemplates.product_sold(saleData);
  return emailService.sendCustomEmail(userId, email, template.subject, template.html, 'product_sold', saleData);
};

export const sendShippingNotification = (userId: string, email: string, shippingData: any) =>
  emailService.sendOrderShipped(userId, email, shippingData);

export const sendPasswordResetEmail = (userId: string, email: string, resetData: any) =>
  emailService.sendPasswordResetEmail(userId, email, resetData);
