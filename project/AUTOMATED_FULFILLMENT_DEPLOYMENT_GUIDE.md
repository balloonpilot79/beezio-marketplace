# Automated Order Fulfillment Deployment Guide

## Overview
This guide will help you deploy the complete automated order fulfillment system using Supabase Edge Functions. The system automates the entire process from customer payment to product delivery.

## Prerequisites
- Supabase project with database access
- Stripe account with webhook configuration
- Email service provider (SendGrid, Mailgun, or similar)
- Shipping provider API (Shippo, EasyShip, or similar)
- Vendor API credentials (AliExpress, Oberlo, SaleHoo, etc.)

## Step 1: Database Setup

### Run the Database Migration
Execute the following SQL in your Supabase SQL Editor:

```sql
-- Automated Order Fulfillment Tables
-- Run this in your Supabase SQL Editor

-- Vendor Orders Table
CREATE TABLE IF NOT EXISTS vendor_orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id TEXT NOT NULL,
  vendor_name TEXT NOT NULL,
  vendor_order_id TEXT,
  product_id TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'ordered',
  vendor_cost DECIMAL(10,2),
  shipping_cost DECIMAL(10,2),
  total_cost DECIMAL(10,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Shipping Labels Table
CREATE TABLE IF NOT EXISTS shipping_labels (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  vendor_order_id UUID REFERENCES vendor_orders(id),
  tracking_number TEXT NOT NULL,
  carrier TEXT NOT NULL,
  shipping_cost DECIMAL(10,2),
  label_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Email Notifications Table
CREATE TABLE IF NOT EXISTS email_notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  recipient_type TEXT NOT NULL, -- 'buyer', 'seller', 'affiliate'
  email_type TEXT NOT NULL, -- 'order_confirmation', 'shipping_update', 'delivery_confirmation'
  status TEXT NOT NULL DEFAULT 'pending',
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Delivery Tracking Table
CREATE TABLE IF NOT EXISTS delivery_tracking (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id TEXT NOT NULL,
  tracking_number TEXT NOT NULL,
  carrier TEXT NOT NULL,
  status TEXT NOT NULL,
  location TEXT,
  estimated_delivery TIMESTAMP WITH TIME ZONE,
  actual_delivery TIMESTAMP WITH TIME ZONE,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add fulfillment_status to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS fulfillment_status TEXT DEFAULT 'pending';

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_vendor_orders_order_id ON vendor_orders(order_id);
CREATE INDEX IF NOT EXISTS idx_vendor_orders_status ON vendor_orders(status);
CREATE INDEX IF NOT EXISTS idx_shipping_labels_vendor_order_id ON shipping_labels(vendor_order_id);
CREATE INDEX IF NOT EXISTS idx_email_notifications_order_id ON email_notifications(order_id);
CREATE INDEX IF NOT EXISTS idx_delivery_tracking_order_id ON delivery_tracking(order_id);
CREATE INDEX IF NOT EXISTS idx_orders_fulfillment_status ON orders(fulfillment_status);

-- Enable Row Level Security
ALTER TABLE vendor_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipping_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_tracking ENABLE ROW LEVEL SECURITY;

-- Create policies (adjust based on your user roles)
CREATE POLICY "Users can view their own vendor orders" ON vendor_orders
  FOR SELECT USING (auth.uid()::text = order_id);

CREATE POLICY "Users can view their own shipping labels" ON shipping_labels
  FOR SELECT USING (
    vendor_order_id IN (
      SELECT id FROM vendor_orders WHERE order_id = auth.uid()::text
    )
  );

-- Insert sample data for testing
INSERT INTO vendor_orders (order_id, vendor_name, product_id, quantity, status)
VALUES
  ('test-order-1', 'AliExpress', 'AE123456', 1, 'ordered'),
  ('test-order-2', 'Oberlo', 'OB789012', 2, 'processing')
ON CONFLICT DO NOTHING;
```

## Step 2: Supabase Edge Functions Setup

### Deploy Edge Functions

1. **Create the functions directory structure:**
```bash
supabase functions new automated-order-fulfillment
supabase functions new delivery-tracking
supabase functions new email-service
supabase functions new vendor-integration
```

2. **Deploy each function:**
```bash
supabase functions deploy automated-order-fulfillment
supabase functions deploy delivery-tracking
supabase functions deploy email-service
supabase functions deploy vendor-integration
```

### Function Files Structure
```
supabase/
  functions/
    automated-order-fulfillment/
      index.ts
    delivery-tracking/
      index.ts
    email-service/
      index.ts
    vendor-integration/
      index.ts
```

## Step 3: Environment Variables

### Set Environment Variables in Supabase
Go to your Supabase Dashboard → Project Settings → Edge Functions → Environment Variables

```bash
# Stripe Configuration
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Email Service Configuration
EMAIL_API_KEY=SG.xxx... (SendGrid)
EMAIL_FROM=noreply@yourdomain.com
EMAIL_FROM_NAME=Your Store Name

# Shipping Provider Configuration
SHIPPO_API_KEY=shippo_live_...
EASYSHIP_API_KEY=your_easyship_key

# Vendor API Configuration
ALIEXPRESS_API_KEY=your_aliexpress_key
ALIEXPRESS_SECRET=your_aliexpress_secret
OBERLO_API_KEY=your_oberlo_key
SALEHOO_API_KEY=your_salehoo_key
SPOCKET_API_KEY=your_spocket_key

# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Other Configuration
DOMAIN=https://yourdomain.com
SUPPORT_EMAIL=support@yourdomain.com
```

## Step 4: Stripe Webhook Configuration

### Update Your Stripe Webhook
1. Go to Stripe Dashboard → Webhooks
2. Add or update your webhook endpoint:
   - URL: `https://your-project.supabase.co/functions/v1/stripe-webhook`
   - Events to listen for:
     - `checkout.session.completed`
     - `payment_intent.succeeded`
     - `payment_intent.payment_failed`

### Test Webhook
```bash
# Test with Stripe CLI
stripe listen --forward-to https://your-project.supabase.co/functions/v1/stripe-webhook
```

## Step 5: Email Service Setup

### SendGrid Setup (Recommended)
1. Create SendGrid account
2. Verify your domain
3. Create API key
4. Set up email templates:
   - Order Confirmation
   - Shipping Update
   - Delivery Confirmation
   - Commission Payment

### Email Templates
Create the following dynamic templates in your email service:

**Order Confirmation Template:**
```html
<h1>Order Confirmed!</h1>
<p>Hi {{customer_name}},</p>
<p>Your order #{{order_id}} has been confirmed and is being processed.</p>
<p>Order Details:</p>
<ul>
  <li>Product: {{product_name}}</li>
  <li>Quantity: {{quantity}}</li>
  <li>Total: ${{total}}</li>
</ul>
<p>We'll send you shipping updates soon!</p>
```

**Shipping Update Template:**
```html
<h1>Your Order is on the Way!</h1>
<p>Hi {{customer_name}},</p>
<p>Your order #{{order_id}} has been shipped!</p>
<p>Tracking Information:</p>
<ul>
  <li>Carrier: {{carrier}}</li>
  <li>Tracking Number: {{tracking_number}}</li>
  <li>Estimated Delivery: {{estimated_delivery}}</li>
</ul>
<p>Track your package: {{tracking_url}}</p>
```

## Step 6: Shipping Provider Setup

### Shippo Setup
1. Create Shippo account
2. Get API credentials
3. Configure shipping rates
4. Set up webhook for tracking updates

### EasyShip Setup
1. Create EasyShip account
2. Configure shipping zones
3. Set up API integration
4. Enable tracking webhooks

## Step 7: Vendor API Integration

### AliExpress Integration
1. Register for AliExpress API
2. Get API credentials
3. Configure product sync
4. Set up order webhook

### Oberlo Integration
1. Install Oberlo app on Shopify
2. Connect your store
3. Configure automated ordering
4. Set up webhook notifications

### SaleHoo Integration
1. Create SaleHoo account
2. Get API access
3. Configure supplier connections
4. Set up automated ordering

## Step 8: Testing the System

### Test Order Flow
1. **Create a test order** in your application
2. **Trigger payment** through Stripe
3. **Verify webhook** receives the event
4. **Check vendor order** creation in database
5. **Verify email** notifications sent
6. **Monitor shipping** label generation
7. **Track delivery** status updates

### Test Commands
```bash
# Test automated fulfillment function
curl -X POST https://your-project.supabase.co/functions/v1/automated-order-fulfillment \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"orderId": "test-order-123"}'

# Test email service
curl -X POST https://your-project.supabase.co/functions/v1/email-service \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "test@example.com",
    "type": "order_confirmation",
    "orderData": {"order_id": "123", "customer_name": "Test User"}
  }'

# Test vendor integration
curl -X POST https://your-project.supabase.co/functions/v1/vendor-integration \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "vendor": "aliexpress",
    "action": "place_order",
    "orderData": {"product_id": "AE123", "quantity": 1}
  }'
```

## Step 9: Monitoring and Maintenance

### Set Up Monitoring
1. **Enable Supabase function logs**
2. **Set up error alerting**
3. **Monitor email delivery rates**
4. **Track shipping success rates**
5. **Monitor vendor API health**

### Regular Maintenance Tasks
- **Weekly:** Review failed orders and retry
- **Monthly:** Update shipping rates and vendor APIs
- **Quarterly:** Review and optimize email templates
- **Annually:** Renew API credentials and certificates

## Step 10: Production Deployment

### Pre-Launch Checklist
- [ ] All environment variables configured
- [ ] Database tables created and populated
- [ ] Edge functions deployed and tested
- [ ] Stripe webhooks configured and tested
- [ ] Email service configured and tested
- [ ] Shipping provider integrated and tested
- [ ] Vendor APIs configured and tested
- [ ] Monitoring and alerting set up
- [ ] Backup procedures documented

### Go-Live Process
1. **Enable production mode** in all services
2. **Update webhook URLs** to production endpoints
3. **Configure production API keys**
4. **Test end-to-end flow** with real payment
5. **Monitor first orders** closely
6. **Scale resources** as needed

## Troubleshooting

### Common Issues

**Webhook not triggering:**
- Check Stripe webhook URL is correct
- Verify webhook secret matches
- Check Supabase function logs

**Email not sending:**
- Verify API key is correct
- Check email service quota
- Review email template variables

**Vendor order failing:**
- Check vendor API credentials
- Verify product availability
- Review vendor API rate limits

**Shipping label error:**
- Check shipping provider API key
- Verify address format
- Review shipping zone configuration

### Support Resources
- Supabase Documentation: https://supabase.com/docs
- Stripe Webhooks Guide: https://stripe.com/docs/webhooks
- SendGrid Documentation: https://sendgrid.com/docs
- Shippo API Docs: https://goshippo.com/docs

## Cost Estimation

### Monthly Costs (Estimated)
- **Supabase:** $25-100 (depending on usage)
- **Stripe:** 2.9% + 30¢ per transaction
- **SendGrid:** $15-60 (depending on email volume)
- **Shippo:** $0.05-0.10 per label
- **Vendor APIs:** Varies by vendor and volume

### Scaling Considerations
- Monitor function execution times
- Set up database connection pooling
- Implement rate limiting for vendor APIs
- Consider function optimization for high volume

---

**Need Help?** Contact support@yourdomain.com or check the troubleshooting section above.
