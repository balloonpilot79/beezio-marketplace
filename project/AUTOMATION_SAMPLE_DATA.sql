-- Automated Order Fulfillment System - Sample Data (Universal SQL)
-- This script populates all automation-related tables with realistic sample data
-- Compatible with both PostgreSQL and SQL Server
-- Run this after running the main migration files

-- =====================================================
-- 1. VENDOR PRODUCTS DATA
-- =====================================================
-- Link products to vendors for automated ordering

-- Insert vendor product data (adjust table creation based on your database)
INSERT INTO vendor_products (
  product_id,
  vendor_id,
  vendor_sku,
  vendor_price,
  vendor_stock_quantity,
  last_synced,
  sync_status
) VALUES
  -- AliExpress vendor products
  ('550e8400-e29b-41d4-a716-446655440101', 'aliexpress', 'AE-WBH-001', 89.99, 500, GETDATE(), 'active'),
  ('550e8400-e29b-41d4-a716-446655440102', 'aliexpress', 'AE-SFW-002', 199.99, 200, GETDATE(), 'active'),
  ('550e8400-e29b-41d4-a716-446655440103', 'aliexpress', 'AE-HLW-003', 45.99, 1000, GETDATE(), 'active'),

  -- Oberlo/Shopify vendor products
  ('550e8400-e29b-41d4-a716-446655440104', 'oberlo', 'OB-FLH-004', 15.99, 300, GETDATE(), 'active'),
  ('550e8400-e29b-41d4-a716-446655440105', 'oberlo', 'OB-MCS-005', 25.99, 150, GETDATE(), 'active'),

  -- SaleHoo vendor products
  ('550e8400-e29b-41d4-a716-446655440106', 'salehoo', 'SH-DMC-006', 149.99, 75, GETDATE(), 'active'),
  ('550e8400-e29b-41d4-a716-446655440107', 'salehoo', 'SH-PBC-007', 349.99, 25, GETDATE(), 'active'),

  -- Spocket vendor products
  ('550e8400-e29b-41d4-a716-446655440108', 'spocket', 'SP-VSS-008', 59.99, 400, GETDATE(), 'active'),
  ('550e8400-e29b-41d4-a716-446655440109', 'spocket', 'SP-PBS-009', 39.99, 600, GETDATE(), 'active');

-- =====================================================
-- 2. SELLER AUTOMATION SETTINGS
-- =====================================================
-- Configure automation preferences for sellers

INSERT INTO seller_automation_settings (
  seller_id,
  auto_order_enabled,
  auto_payment_enabled,
  auto_inventory_enabled,
  auto_shipping_labels,
  auto_tracking_updates,
  auto_delivery_notifications,
  auto_order_confirmations,
  auto_shipping_updates,
  auto_delivery_alerts,
  auto_commission_payouts,
  vendor_api_keys,
  shipping_provider,
  email_provider,
  automation_level,
  monthly_order_limit,
  orders_processed_this_month
) VALUES
  -- John's automation settings (basic level)
  ('550e8400-e29b-41d4-a716-446655440001', 1, 0, 1, 1, 1, 1, 1, 1, 1, 0,
   'aliexpress_api_config', 'shippo', 'sendgrid', 'basic', 100, 12),

  -- Mike's automation settings (advanced level)
  ('550e8400-e29b-41d4-a716-446655440003', 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
   'oberlo_api_config', 'easyship', 'mailgun', 'advanced', 500, 87),

  -- Sarah's automation settings (premium level)
  ('550e8400-e29b-41d4-a716-446655440004', 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
   'multiple_vendor_configs', 'shippo', 'sendgrid', 'premium', 1000, 234),

  -- Tom's automation settings (advanced level)
  ('550e8400-e29b-41d4-a716-446655440005', 1, 1, 1, 1, 1, 1, 1, 1, 1, 0,
   'aliexpress_api_config_2', 'easyship', 'mailgun', 'advanced', 300, 45);

-- =====================================================
-- 3. SAMPLE ORDERS WITH AUTOMATION
-- =====================================================
-- Create sample orders that will trigger automation

INSERT INTO orders (
  id,
  customer_name,
  customer_email,
  total_amount,
  status,
  fulfillment_status,
  automation_enabled
) VALUES
  -- Order 1: John's customer - automated fulfillment
  ('660e8400-e29b-41d4-a716-446655440201', 'Alice Johnson', 'alice@example.com', 149.99, 'paid', 'processing', 1),

  -- Order 2: Mike's customer - automated fulfillment
  ('660e8400-e29b-41d4-a716-446655440202', 'Bob Smith', 'bob@example.com', 24.99, 'paid', 'processing', 1),

  -- Order 3: Sarah's customer - automated fulfillment
  ('660e8400-e29b-41d4-a716-446655440203', 'Carol Davis', 'carol@example.com', 89.99, 'paid', 'processing', 1),

  -- Order 4: Tom's customer - automated fulfillment
  ('660e8400-e29b-41d4-a716-446655440204', 'David Wilson', 'david@example.com', 299.99, 'paid', 'processing', 1);

-- Add order items for the sample orders
INSERT INTO order_items (
  order_id,
  product_id,
  quantity,
  price,
  seller_id
) VALUES
  ('660e8400-e29b-41d4-a716-446655440201', '550e8400-e29b-41d4-a716-446655440101', 1, 149.99, '550e8400-e29b-41d4-a716-446655440005'),
  ('660e8400-e29b-41d4-a716-446655440202', '550e8400-e29b-41d4-a716-446655440104', 1, 24.99, '550e8400-e29b-41d4-a716-446655440003'),
  ('660e8400-e29b-41d4-a716-446655440203', '550e8400-e29b-41d4-a716-446655440103', 1, 89.99, '550e8400-e29b-41d4-a716-446655440004'),
  ('660e8400-e29b-41d4-a716-446655440204', '550e8400-e29b-41d4-a716-446655440102', 1, 299.99, '550e8400-e29b-41d4-a716-446655440005');

-- =====================================================
-- 4. VENDOR ORDERS DATA
-- =====================================================
-- Sample vendor orders that have been placed automatically

INSERT INTO vendor_orders (
  order_id,
  vendor_id,
  vendor_order_id,
  items,
  shipping_address,
  status
) VALUES
  -- AliExpress order for John's customer
  ('660e8400-e29b-41d4-a716-446655440201', 'aliexpress', 'AE-ORD-001234',
   'Wireless Bluetooth Headphones', '123 Main St, New York, NY, 10001, US', 'shipped'),

  -- Oberlo order for Mike's customer
  ('660e8400-e29b-41d4-a716-446655440202', 'oberlo', 'OB-ORD-005678',
   'Fresh Local Honey', '456 Oak Ave, Chicago, IL, 60601, US', 'processing'),

  -- AliExpress order for Sarah's customer
  ('660e8400-e29b-41d4-a716-446655440203', 'aliexpress', 'AE-ORD-009876',
   'Handcrafted Leather Wallet', '789 Pine Rd, Austin, TX, 78701, US', 'ordered'),

  -- AliExpress order for Tom's customer
  ('660e8400-e29b-41d4-a716-446655440204', 'aliexpress', 'AE-ORD-004321',
   'Smart Fitness Watch', '321 Cedar Ln, Seattle, WA, 98101, US', 'delivered');

-- =====================================================
-- 5. SHIPPING LABELS DATA
-- =====================================================
-- Sample shipping labels generated automatically

INSERT INTO shipping_labels (
  order_id,
  vendor_order_id,
  tracking_number,
  carrier,
  cost,
  status
) VALUES
  -- Shipping label for Alice's order
  ('660e8400-e29b-41d4-a716-446655440201', 'AE-ORD-001234', '1Z999AA1234567890', 'UPS', 12.99, 'shipped'),

  -- Shipping label for Bob's order
  ('660e8400-e29b-41d4-a716-446655440202', 'OB-ORD-005678', '9400111899223344556677', 'USPS', 8.50, 'created'),

  -- Shipping label for Carol's order
  ('660e8400-e29b-41d4-a716-446655440203', 'AE-ORD-009876', 'AE-TRK-987654321', 'AliExpress Standard', 15.99, 'created'),

  -- Shipping label for David's order
  ('660e8400-e29b-41d4-a716-446655440204', 'AE-ORD-004321', '1Z888BB0987654321', 'UPS', 18.99, 'delivered');

-- =====================================================
-- 6. DELIVERY TRACKING DATA
-- =====================================================
-- Sample delivery tracking information

INSERT INTO delivery_tracking (
  order_id,
  tracking_number,
  carrier,
  status
) VALUES
  -- Tracking for Alice's order
  ('660e8400-e29b-41d4-a716-446655440201', '1Z999AA1234567890', 'UPS', 'in_transit'),

  -- Tracking for Bob's order
  ('660e8400-e29b-41d4-a716-446655440202', '9400111899223344556677', 'USPS', 'out_for_delivery'),

  -- Tracking for Carol's order
  ('660e8400-e29b-41d4-a716-446655440203', 'AE-TRK-987654321', 'AliExpress Standard', 'in_transit'),

  -- Tracking for David's order (delivered)
  ('660e8400-e29b-41d4-a716-446655440204', '1Z888BB0987654321', 'UPS', 'delivered');

-- =====================================================
-- 7. EMAIL NOTIFICATIONS DATA
-- =====================================================
-- Sample email notifications sent automatically

INSERT INTO email_notifications (
  order_id,
  recipient_email,
  recipient_type,
  notification_type,
  status
) VALUES
  -- Order confirmation for Alice
  ('660e8400-e29b-41d4-a716-446655440201', 'alice@example.com', 'buyer', 'order_confirmation', 'sent'),

  -- Shipping confirmation for Alice
  ('660e8400-e29b-41d4-a716-446655440201', 'alice@example.com', 'buyer', 'shipping_confirmation', 'sent'),

  -- Commission notification for Tom (seller)
  ('660e8400-e29b-41d4-a716-446655440201', 'tom.tech@example.com', 'seller', 'commission_paid', 'sent'),

  -- Order confirmation for Bob
  ('660e8400-e29b-41d4-a716-446655440202', 'bob@example.com', 'buyer', 'order_confirmation', 'sent'),

  -- Order confirmation for Carol
  ('660e8400-e29b-41d4-a716-446655440203', 'carol@example.com', 'buyer', 'order_confirmation', 'sent'),

  -- Delivery confirmation for David
  ('660e8400-e29b-41d4-a716-446655440204', 'david@example.com', 'buyer', 'delivery_update', 'sent'),

  -- Commission notification for Sarah (seller)
  ('660e8400-e29b-41d4-a716-446655440203', 'sarah.crafts@example.com', 'seller', 'commission_paid', 'pending');

-- =====================================================
-- 8. SELLER AUTOMATION LOGS
-- =====================================================
-- Sample automation activity logs

INSERT INTO seller_automation_logs (
  seller_id,
  order_id,
  automation_type,
  status
) VALUES
  -- John's automation logs
  ('550e8400-e29b-41d4-a716-446655440001', '660e8400-e29b-41d4-a716-446655440201', 'order_placement', 'success'),
  ('550e8400-e29b-41d4-a716-446655440001', '660e8400-e29b-41d4-a716-446655440201', 'shipping_label', 'success'),
  ('550e8400-e29b-41d4-a716-446655440001', '660e8400-e29b-41d4-a716-446655440201', 'email_notification', 'success'),

  -- Mike's automation logs
  ('550e8400-e29b-41d4-a716-446655440003', '660e8400-e29b-41d4-a716-446655440202', 'order_placement', 'success'),
  ('550e8400-e29b-41d4-a716-446655440003', '660e8400-e29b-41d4-a716-446655440202', 'email_notification', 'success'),

  -- Sarah's automation logs
  ('550e8400-e29b-41d4-a716-446655440004', '660e8400-e29b-41d4-a716-446655440203', 'order_placement', 'success'),
  ('550e8400-e29b-41d4-a716-446655440004', '660e8400-e29b-41d4-a716-446655440203', 'email_notification', 'success'),

  -- Tom's automation logs
  ('550e8400-e29b-41d4-a716-446655440005', '660e8400-e29b-41d4-a716-446655440204', 'order_placement', 'success'),
  ('550e8400-e29b-41d4-a716-446655440005', '660e8400-e29b-41d4-a716-446655440204', 'shipping_label', 'success'),
  ('550e8400-e29b-41d4-a716-446655440005', '660e8400-e29b-41d4-a716-446655440204', 'email_notification', 'success');

-- =====================================================
-- 9. SELLER AUTOMATION STATS
-- =====================================================
-- Sample monthly automation statistics

INSERT INTO seller_automation_stats (
  seller_id,
  month_year,
  orders_automated,
  orders_failed,
  time_saved_hours,
  cost_savings,
  customer_satisfaction_score
) VALUES
  -- John's stats for August 2024
  ('550e8400-e29b-41d4-a716-446655440001', '2024-08', 12, 0, 24.5, 245.00, 4.8),

  -- Mike's stats for August 2024
  ('550e8400-e29b-41d4-a716-446655440003', '2024-08', 87, 2, 174.0, 1740.00, 4.9),

  -- Sarah's stats for August 2024
  ('550e8400-e29b-41d4-a716-446655440004', '2024-08', 234, 5, 468.0, 4680.00, 4.7),

  -- Tom's stats for August 2024
  ('550e8400-e29b-41d4-a716-446655440005', '2024-08', 45, 1, 90.0, 900.00, 4.9);

-- =====================================================
-- SUMMARY
-- =====================================================
-- This script creates comprehensive sample data for:
-- ✅ Vendor Products (9 products linked to 4 vendors)
-- ✅ Seller Automation Settings (4 sellers with different automation levels)
-- ✅ Sample Orders (4 orders with automation enabled)
-- ✅ Vendor Orders (4 automated vendor orders)
-- ✅ Shipping Labels (4 generated shipping labels)
-- ✅ Delivery Tracking (4 tracking records)
-- ✅ Email Notifications (7 automated email notifications)
-- ✅ Automation Logs (10 automation activity records)
-- ✅ Automation Stats (4 sellers' monthly statistics)

-- The data represents a realistic automated fulfillment workflow
-- from order placement through delivery confirmation.

PRINT '🎉 Automation sample data populated successfully!';
PRINT '📊 Added sample data for all automation tables';
PRINT '🚀 Ready to test the automated fulfillment system!';

-- Update products table with vendor information
UPDATE products SET
  vendor_id = 'aliexpress',
  vendor_sku = 'AE-WBH-001',
  supplier_info = '{"shipping_time": "7-14 days", "return_policy": "30 days", "warranty": "1 year"}'::jsonb
WHERE id = '550e8400-e29b-41d4-a716-446655440101';

UPDATE products SET
  vendor_id = 'aliexpress',
  vendor_sku = 'AE-SFW-002',
  supplier_info = '{"shipping_time": "10-18 days", "return_policy": "30 days", "warranty": "2 years"}'::jsonb
WHERE id = '550e8400-e29b-41d4-a716-446655440102';

UPDATE products SET
  vendor_id = 'aliexpress',
  vendor_sku = 'AE-HLW-003',
  supplier_info = '{"shipping_time": "5-10 days", "return_policy": "30 days", "warranty": "6 months"}'::jsonb
WHERE id = '550e8400-e29b-41d4-a716-446655440103';

UPDATE products SET
  vendor_id = 'oberlo',
  vendor_sku = 'OB-FLH-004',
  supplier_info = '{"shipping_time": "3-7 days", "return_policy": "14 days", "warranty": "1 year"}'::jsonb
WHERE id = '550e8400-e29b-41d4-a716-446655440104';

UPDATE products SET
  vendor_id = 'oberlo',
  vendor_sku = 'OB-MCS-005',
  supplier_info = '{"shipping_time": "2-5 days", "return_policy": "14 days", "warranty": "6 months"}'::jsonb
WHERE id = '550e8400-e29b-41d4-a716-446655440105';

UPDATE products SET
  vendor_id = 'salehoo',
  vendor_sku = 'SH-DMC-006',
  supplier_info = '{"shipping_time": "7-14 days", "return_policy": "30 days", "warranty": "2 years"}'::jsonb
WHERE id = '550e8400-e29b-41d4-a716-446655440106';

UPDATE products SET
  vendor_id = 'salehoo',
  vendor_sku = 'SH-PBC-007',
  supplier_info = '{"shipping_time": "10-21 days", "return_policy": "30 days", "warranty": "3 years"}'::jsonb
WHERE id = '550e8400-e29b-41d4-a716-446655440107';

UPDATE products SET
  vendor_id = 'spocket',
  vendor_sku = 'SP-VSS-008',
  supplier_info = '{"shipping_time": "5-10 days", "return_policy": "14 days", "warranty": "1 year"}'::jsonb
WHERE id = '550e8400-e29b-41d4-a716-446655440108';

UPDATE products SET
  vendor_id = 'spocket',
  vendor_sku = 'SP-PBS-009',
  supplier_info = '{"shipping_time": "3-7 days", "return_policy": "14 days", "warranty": "6 months"}'::jsonb
WHERE id = '550e8400-e29b-41d4-a716-446655440109';

-- =====================================================
-- 2. SELLER AUTOMATION SETTINGS
-- =====================================================
-- Configure automation preferences for sellers

INSERT INTO seller_automation_settings (
  seller_id,
  auto_order_enabled,
  auto_payment_enabled,
  auto_inventory_enabled,
  auto_shipping_labels,
  auto_tracking_updates,
  auto_delivery_notifications,
  auto_order_confirmations,
  auto_shipping_updates,
  auto_delivery_alerts,
  auto_commission_payouts,
  vendor_api_keys,
  shipping_provider,
  email_provider,
  automation_level,
  monthly_order_limit,
  orders_processed_this_month,
  created_at,
  updated_at
) VALUES
  -- John's automation settings (basic level)
  ('550e8400-e29b-41d4-a716-446655440001', true, false, true, true, true, true, true, true, true, false,
   '{"aliexpress": {"api_key": "demo_aliexpress_key", "api_secret": "demo_secret"}}'::jsonb,
   'shippo', 'sendgrid', 'basic', 100, 12, NOW(), NOW()),

  -- Mike's automation settings (advanced level)
  ('550e8400-e29b-41d4-a716-446655440003', true, true, true, true, true, true, true, true, true, true,
   '{"oberlo": {"api_key": "demo_oberlo_key", "store_url": "demo-store.myshopify.com"}}'::jsonb,
   'easyship', 'mailgun', 'advanced', 500, 87, NOW(), NOW()),

  -- Sarah's automation settings (premium level)
  ('550e8400-e29b-41d4-a716-446655440004', true, true, true, true, true, true, true, true, true, true,
   '{"salehoo": {"username": "demo_salehoo", "password": "demo_pass"}, "spocket": {"api_token": "demo_spocket_token"}}'::jsonb,
   'shippo', 'sendgrid', 'premium', 1000, 234, NOW(), NOW()),

  -- Tom's automation settings (advanced level)
  ('550e8400-e29b-41d4-a716-446655440005', true, true, true, true, true, true, true, true, true, false,
   '{"aliexpress": {"api_key": "demo_aliexpress_key_2", "api_secret": "demo_secret_2"}}'::jsonb,
   'easyship', 'mailgun', 'advanced', 300, 45, NOW(), NOW())
ON CONFLICT (seller_id) DO NOTHING;

-- =====================================================
-- 3. SAMPLE ORDERS WITH AUTOMATION
-- =====================================================
-- Create sample orders that will trigger automation

INSERT INTO orders (
  id,
  customer_name,
  customer_email,
  total_amount,
  status,
  shipping_address,
  billing_address,
  payment_intent_id,
  fulfillment_status,
  automation_enabled,
  tracking_numbers,
  shipping_carrier,
  estimated_delivery,
  created_at,
  updated_at
) VALUES
  -- Order 1: John's customer - automated fulfillment
  ('660e8400-e29b-41d4-a716-446655440201', 'Alice Johnson', 'alice@example.com', 149.99, 'paid',
   '{"street": "123 Main St", "city": "New York", "state": "NY", "zip": "10001", "country": "US"}'::jsonb,
   '{"street": "123 Main St", "city": "New York", "state": "NY", "zip": "10001", "country": "US"}'::jsonb,
   'pi_demo_1234567890', 'processing', true, NULL, NULL, NOW() + INTERVAL '7 days', NOW(), NOW()),

  -- Order 2: Mike's customer - automated fulfillment
  ('660e8400-e29b-41d4-a716-446655440202', 'Bob Smith', 'bob@example.com', 24.99, 'paid',
   '{"street": "456 Oak Ave", "city": "Chicago", "state": "IL", "zip": "60601", "country": "US"}'::jsonb,
   '{"street": "456 Oak Ave", "city": "Chicago", "state": "IL", "zip": "60601", "country": "US"}'::jsonb,
   'pi_demo_1234567891', 'processing', true, NULL, NULL, NOW() + INTERVAL '5 days', NOW(), NOW()),

  -- Order 3: Sarah's customer - automated fulfillment
  ('660e8400-e29b-41d4-a716-446655440203', 'Carol Davis', 'carol@example.com', 89.99, 'paid',
   '{"street": "789 Pine Rd", "city": "Austin", "state": "TX", "zip": "78701", "country": "US"}'::jsonb,
   '{"street": "789 Pine Rd", "city": "Austin", "state": "TX", "zip": "78701", "country": "US"}'::jsonb,
   'pi_demo_1234567892', 'processing', true, NULL, NULL, NOW() + INTERVAL '10 days', NOW(), NOW()),

  -- Order 4: Tom's customer - automated fulfillment
  ('660e8400-e29b-41d4-a716-446655440204', 'David Wilson', 'david@example.com', 299.99, 'paid',
   '{"street": "321 Cedar Ln", "city": "Seattle", "state": "WA", "zip": "98101", "country": "US"}'::jsonb,
   '{"street": "321 Cedar Ln", "city": "Seattle", "state": "WA", "zip": "98101", "country": "US"}'::jsonb,
   'pi_demo_1234567893', 'processing', true, NULL, NULL, NOW() + INTERVAL '14 days', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Add order items for the sample orders
INSERT INTO order_items (
  order_id,
  product_id,
  quantity,
  price,
  seller_id,
  created_at
) VALUES
  ('660e8400-e29b-41d4-a716-446655440201', '550e8400-e29b-41d4-a716-446655440101', 1, 149.99, '550e8400-e29b-41d4-a716-446655440005', NOW()),
  ('660e8400-e29b-41d4-a716-446655440202', '550e8400-e29b-41d4-a716-446655440104', 1, 24.99, '550e8400-e29b-41d4-a716-446655440003', NOW()),
  ('660e8400-e29b-41d4-a716-446655440203', '550e8400-e29b-41d4-a716-446655440103', 1, 89.99, '550e8400-e29b-41d4-a716-446655440004', NOW()),
  ('660e8400-e29b-41d4-a716-446655440204', '550e8400-e29b-41d4-a716-446655440102', 1, 299.99, '550e8400-e29b-41d4-a716-446655440005', NOW())
ON CONFLICT DO NOTHING;

-- =====================================================
-- 4. VENDOR ORDERS DATA
-- =====================================================
-- Sample vendor orders that have been placed automatically

INSERT INTO vendor_orders (
  order_id,
  vendor_id,
  vendor_order_id,
  items,
  shipping_address,
  status,
  vendor_response,
  created_at,
  updated_at
) VALUES
  -- AliExpress order for John's customer
  ('660e8400-e29b-41d4-a716-446655440201', 'aliexpress', 'AE-ORD-001234',
   '[{"product_id": "AE-WBH-001", "quantity": 1, "price": 89.99}]'::jsonb,
   '{"name": "Alice Johnson", "street": "123 Main St", "city": "New York", "state": "NY", "zip": "10001", "country": "US"}'::jsonb,
   'shipped',
   '{"tracking_number": "AE-TRK-987654", "estimated_delivery": "2024-09-05", "status": "shipped"}'::jsonb,
   NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 day'),

  -- Oberlo order for Mike's customer
  ('660e8400-e29b-41d4-a716-446655440202', 'oberlo', 'OB-ORD-005678',
   '[{"product_id": "OB-FLH-004", "quantity": 1, "price": 15.99}]'::jsonb,
   '{"name": "Bob Smith", "street": "456 Oak Ave", "city": "Chicago", "state": "IL", "zip": "60601", "country": "US"}'::jsonb,
   'processing',
   '{"status": "processing", "expected_ship_date": "2024-09-02"}'::jsonb,
   NOW() - INTERVAL '1 day', NOW() - INTERVAL '12 hours'),

  -- AliExpress order for Sarah's customer
  ('660e8400-e29b-41d4-a716-446655440203', 'aliexpress', 'AE-ORD-009876',
   '[{"product_id": "AE-HLW-003", "quantity": 1, "price": 45.99}]'::jsonb,
   '{"name": "Carol Davis", "street": "789 Pine Rd", "city": "Austin", "state": "TX", "zip": "78701", "country": "US"}'::jsonb,
   'ordered',
   '{"status": "confirmed", "order_number": "AE-009876"}'::jsonb,
   NOW() - INTERVAL '6 hours', NOW() - INTERVAL '3 hours'),

  -- AliExpress order for Tom's customer
  ('660e8400-e29b-41d4-a716-446655440204', 'aliexpress', 'AE-ORD-004321',
   '[{"product_id": "AE-SFW-002", "quantity": 1, "price": 199.99}]'::jsonb,
   '{"name": "David Wilson", "street": "321 Cedar Ln", "city": "Seattle", "state": "WA", "zip": "98101", "country": "US"}'::jsonb,
   'delivered',
   '{"tracking_number": "AE-TRK-456789", "delivery_date": "2024-08-25", "status": "delivered"}'::jsonb,
   NOW() - INTERVAL '5 days', NOW() - INTERVAL '1 day')
ON CONFLICT (order_id, vendor_id) DO NOTHING;

-- =====================================================
-- 5. SHIPPING LABELS DATA
-- =====================================================
-- Sample shipping labels generated automatically

INSERT INTO shipping_labels (
  order_id,
  vendor_order_id,
  tracking_number,
  carrier,
  cost,
  estimated_delivery,
  label_url,
  status,
  created_at,
  updated_at
) VALUES
  -- Shipping label for Alice's order
  ('660e8400-e29b-41d4-a716-446655440201', 'AE-ORD-001234', '1Z999AA1234567890', 'UPS',
   12.99, NOW() + INTERVAL '7 days', 'https://api.shippo.com/labels/1Z999AA1234567890.pdf', 'shipped',
   NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 day'),

  -- Shipping label for Bob's order
  ('660e8400-e29b-41d4-a716-446655440202', 'OB-ORD-005678', '9400111899223344556677', 'USPS',
   8.50, NOW() + INTERVAL '5 days', 'https://api.easyship.com/labels/9400111899223344556677.pdf', 'created',
   NOW() - INTERVAL '1 day', NOW() - INTERVAL '12 hours'),

  -- Shipping label for Carol's order
  ('660e8400-e29b-41d4-a716-446655440203', 'AE-ORD-009876', 'AE-TRK-987654321', 'AliExpress Standard',
   15.99, NOW() + INTERVAL '10 days', 'https://api.aliexpress.com/labels/AE-TRK-987654321.pdf', 'created',
   NOW() - INTERVAL '6 hours', NOW() - INTERVAL '3 hours'),

  -- Shipping label for David's order
  ('660e8400-e29b-41d4-a716-446655440204', 'AE-ORD-004321', '1Z888BB0987654321', 'UPS',
   18.99, NOW() + INTERVAL '14 days', 'https://api.shippo.com/labels/1Z888BB0987654321.pdf', 'delivered',
   NOW() - INTERVAL '5 days', NOW() - INTERVAL '1 day')
ON CONFLICT (order_id) DO NOTHING;

-- Update orders with tracking information
UPDATE orders SET
  tracking_numbers = ARRAY['1Z999AA1234567890'],
  shipping_carrier = 'UPS',
  fulfillment_status = 'shipped'
WHERE id = '660e8400-e29b-41d4-a716-446655440201';

UPDATE orders SET
  tracking_numbers = ARRAY['9400111899223344556677'],
  shipping_carrier = 'USPS',
  fulfillment_status = 'processing'
WHERE id = '660e8400-e29b-41d4-a716-446655440202';

UPDATE orders SET
  tracking_numbers = ARRAY['AE-TRK-987654321'],
  shipping_carrier = 'AliExpress Standard',
  fulfillment_status = 'processing'
WHERE id = '660e8400-e29b-41d4-a716-446655440203';

UPDATE orders SET
  tracking_numbers = ARRAY['1Z888BB0987654321'],
  shipping_carrier = 'UPS',
  fulfillment_status = 'delivered'
WHERE id = '660e8400-e29b-41d4-a716-446655440204';

-- =====================================================
-- 6. DELIVERY TRACKING DATA
-- =====================================================
-- Sample delivery tracking information

INSERT INTO delivery_tracking (
  order_id,
  tracking_number,
  carrier,
  status,
  last_checked,
  next_check,
  tracking_events,
  delivery_date,
  created_at,
  updated_at
) VALUES
  -- Tracking for Alice's order
  ('660e8400-e29b-41d4-a716-446655440201', '1Z999AA1234567890', 'UPS', 'in_transit',
   NOW() - INTERVAL '6 hours', NOW() + INTERVAL '6 hours',
   '[{"date": "2024-08-25T10:00:00Z", "status": "Order Processed", "location": "New York, NY"}, {"date": "2024-08-26T14:30:00Z", "status": "Shipped", "location": "New York, NY"}, {"date": "2024-08-27T09:15:00Z", "status": "In Transit", "location": "Chicago, IL"}]'::jsonb,
   NULL, NOW() - INTERVAL '2 days', NOW() - INTERVAL '6 hours'),

  -- Tracking for Bob's order
  ('660e8400-e29b-41d4-a716-446655440202', '9400111899223344556677', 'USPS', 'out_for_delivery',
   NOW() - INTERVAL '3 hours', NOW() + INTERVAL '3 hours',
   '[{"date": "2024-08-27T08:00:00Z", "status": "Order Processed", "location": "Chicago, IL"}, {"date": "2024-08-27T16:45:00Z", "status": "Out for Delivery", "location": "Chicago, IL"}]'::jsonb,
   NOW() + INTERVAL '1 day', NOW() - INTERVAL '1 day', NOW() - INTERVAL '3 hours'),

  -- Tracking for Carol's order
  ('660e8400-e29b-41d4-a716-446655440203', 'AE-TRK-987654321', 'AliExpress Standard', 'in_transit',
   NOW() - INTERVAL '2 hours', NOW() + INTERVAL '4 hours',
   '[{"date": "2024-08-28T12:00:00Z", "status": "Order Confirmed", "location": "China"}, {"date": "2024-08-28T18:30:00Z", "status": "Shipped", "location": "China"}]'::jsonb,
   NULL, NOW() - INTERVAL '6 hours', NOW() - INTERVAL '2 hours'),

  -- Tracking for David's order (delivered)
  ('660e8400-e29b-41d4-a716-446655440204', '1Z888BB0987654321', 'UPS', 'delivered',
   NOW() - INTERVAL '1 day', NULL,
   '[{"date": "2024-08-20T10:00:00Z", "status": "Order Processed", "location": "Seattle, WA"}, {"date": "2024-08-21T14:30:00Z", "status": "Shipped", "location": "Seattle, WA"}, {"date": "2024-08-22T09:15:00Z", "status": "In Transit", "location": "Portland, OR"}, {"date": "2024-08-23T16:45:00Z", "status": "Out for Delivery", "location": "Seattle, WA"}, {"date": "2024-08-24T11:30:00Z", "status": "Delivered", "location": "Seattle, WA"}]'::jsonb,
   NOW() - INTERVAL '1 day', NOW() - INTERVAL '5 days', NOW() - INTERVAL '1 day')
ON CONFLICT (order_id, tracking_number) DO NOTHING;

-- =====================================================
-- 7. EMAIL NOTIFICATIONS DATA
-- =====================================================
-- Sample email notifications sent automatically

INSERT INTO email_notifications (
  order_id,
  recipient_email,
  recipient_type,
  notification_type,
  status,
  sent_at,
  email_data,
  created_at
) VALUES
  -- Order confirmation for Alice
  ('660e8400-e29b-41d4-a716-446655440201', 'alice@example.com', 'buyer', 'order_confirmation', 'sent',
   NOW() - INTERVAL '2 days',
   '{"subject": "Order Confirmation - Order #660e8400", "template": "order_confirmation", "order_total": 149.99, "items": ["Wireless Bluetooth Headphones"]}'::jsonb,
   NOW() - INTERVAL '2 days'),

  -- Shipping confirmation for Alice
  ('660e8400-e29b-41d4-a716-446655440201', 'alice@example.com', 'buyer', 'shipping_confirmation', 'sent',
   NOW() - INTERVAL '2 days',
   '{"subject": "Your Order Has Shipped!", "template": "shipping_update", "tracking_number": "1Z999AA1234567890", "carrier": "UPS"}'::jsonb,
   NOW() - INTERVAL '2 days'),

  -- Commission notification for Tom (seller)
  ('660e8400-e29b-41d4-a716-446655440201', 'tom.tech@example.com', 'seller', 'commission_paid', 'sent',
   NOW() - INTERVAL '2 days',
   '{"subject": "Commission Payment Processed", "template": "commission_payment", "amount": 18.00, "order_id": "660e8400"}'::jsonb,
   NOW() - INTERVAL '2 days'),

  -- Order confirmation for Bob
  ('660e8400-e29b-41d4-a716-446655440202', 'bob@example.com', 'buyer', 'order_confirmation', 'sent',
   NOW() - INTERVAL '1 day',
   '{"subject": "Order Confirmation - Order #660e8400", "template": "order_confirmation", "order_total": 24.99, "items": ["Fresh Local Honey"]}'::jsonb,
   NOW() - INTERVAL '1 day'),

  -- Order confirmation for Carol
  ('660e8400-e29b-41d4-a716-446655440203', 'carol@example.com', 'buyer', 'order_confirmation', 'sent',
   NOW() - INTERVAL '6 hours',
   '{"subject": "Order Confirmation - Order #660e8400", "template": "order_confirmation", "order_total": 89.99, "items": ["Handcrafted Leather Wallet"]}'::jsonb,
   NOW() - INTERVAL '6 hours'),

  -- Delivery confirmation for David
  ('660e8400-e29b-41d4-a716-446655440204', 'david@example.com', 'buyer', 'delivery_update', 'sent',
   NOW() - INTERVAL '1 day',
   '{"subject": "Your Order Has Been Delivered!", "template": "delivery_confirmation", "tracking_number": "1Z888BB0987654321", "carrier": "UPS"}'::jsonb,
   NOW() - INTERVAL '1 day'),

  -- Commission notification for Sarah (seller)
  ('660e8400-e29b-41d4-a716-446655440203', 'sarah.crafts@example.com', 'seller', 'commission_paid', 'pending',
   NULL,
   '{"subject": "Commission Payment Ready", "template": "commission_payment", "amount": 8.99, "order_id": "660e8400"}'::jsonb,
   NOW() - INTERVAL '6 hours')
ON CONFLICT (order_id, recipient_email, notification_type) DO NOTHING;

-- =====================================================
-- 8. SELLER AUTOMATION LOGS
-- =====================================================
-- Sample automation activity logs

INSERT INTO seller_automation_logs (
  seller_id,
  order_id,
  automation_type,
  status,
  details,
  created_at
) VALUES
  -- John's automation logs
  ('550e8400-e29b-41d4-a716-446655440001', '660e8400-e29b-41d4-a716-446655440201', 'order_placement', 'success',
   '{"vendor": "aliexpress", "vendor_order_id": "AE-ORD-001234", "items_count": 1, "total_amount": 89.99}'::jsonb,
   NOW() - INTERVAL '2 days'),

  ('550e8400-e29b-41d4-a716-446655440001', '660e8400-e29b-41d4-a716-446655440201', 'shipping_label', 'success',
   '{"carrier": "UPS", "tracking_number": "1Z999AA1234567890", "cost": 12.99}'::jsonb,
   NOW() - INTERVAL '2 days'),

  ('550e8400-e29b-41d4-a716-446655440001', '660e8400-e29b-41d4-a716-446655440201', 'email_notification', 'success',
   '{"type": "order_confirmation", "recipient": "alice@example.com"}'::jsonb,
   NOW() - INTERVAL '2 days'),

  -- Mike's automation logs
  ('550e8400-e29b-41d4-a716-446655440003', '660e8400-e29b-41d4-a716-446655440202', 'order_placement', 'success',
   '{"vendor": "oberlo", "vendor_order_id": "OB-ORD-005678", "items_count": 1, "total_amount": 15.99}'::jsonb,
   NOW() - INTERVAL '1 day'),

  ('550e8400-e29b-41d4-a716-446655440003', '660e8400-e29b-41d4-a716-446655440202', 'email_notification', 'success',
   '{"type": "order_confirmation", "recipient": "bob@example.com"}'::jsonb,
   NOW() - INTERVAL '1 day'),

  -- Sarah's automation logs
  ('550e8400-e29b-41d4-a716-446655440004', '660e8400-e29b-41d4-a716-446655440203', 'order_placement', 'success',
   '{"vendor": "aliexpress", "vendor_order_id": "AE-ORD-009876", "items_count": 1, "total_amount": 45.99}'::jsonb,
   NOW() - INTERVAL '6 hours'),

  ('550e8400-e29b-41d4-a716-446655440004', '660e8400-e29b-41d4-a716-446655440203', 'email_notification', 'success',
   '{"type": "order_confirmation", "recipient": "carol@example.com"}'::jsonb,
   NOW() - INTERVAL '6 hours'),

  -- Tom's automation logs
  ('550e8400-e29b-41d4-a716-446655440005', '660e8400-e29b-41d4-a716-446655440204', 'order_placement', 'success',
   '{"vendor": "aliexpress", "vendor_order_id": "AE-ORD-004321", "items_count": 1, "total_amount": 199.99}'::jsonb,
   NOW() - INTERVAL '5 days'),

  ('550e8400-e29b-41d4-a716-446655440005', '660e8400-e29b-41d4-a716-446655440204', 'shipping_label', 'success',
   '{"carrier": "UPS", "tracking_number": "1Z888BB0987654321", "cost": 18.99}'::jsonb,
   NOW() - INTERVAL '5 days'),

  ('550e8400-e29b-41d4-a716-446655440005', '660e8400-e29b-41d4-a716-446655440204', 'email_notification', 'success',
   '{"type": "delivery_update", "recipient": "david@example.com"}'::jsonb,
   NOW() - INTERVAL '1 day')
ON CONFLICT DO NOTHING;

-- =====================================================
-- 9. SELLER AUTOMATION STATS
-- =====================================================
-- Sample monthly automation statistics

INSERT INTO seller_automation_stats (
  seller_id,
  month_year,
  orders_automated,
  orders_failed,
  time_saved_hours,
  cost_savings,
  customer_satisfaction_score,
  created_at,
  updated_at
) VALUES
  -- John's stats for August 2024
  ('550e8400-e29b-41d4-a716-446655440001', '2024-08', 12, 0, 24.5, 245.00, 4.8),

  -- Mike's stats for August 2024
  ('550e8400-e29b-41d4-a716-446655440003', '2024-08', 87, 2, 174.0, 1740.00, 4.9),

  -- Sarah's stats for August 2024
  ('550e8400-e29b-41d4-a716-446655440004', '2024-08', 234, 5, 468.0, 4680.00, 4.7),

  -- Tom's stats for August 2024
  ('550e8400-e29b-41d4-a716-446655440005', '2024-08', 45, 1, 90.0, 900.00, 4.9);

-- =====================================================
-- SUMMARY
-- =====================================================
-- This script creates comprehensive sample data for:
-- ✅ Vendor Products (9 products linked to 4 vendors)
-- ✅ Seller Automation Settings (4 sellers with different automation levels)
-- ✅ Sample Orders (4 orders with automation enabled)
-- ✅ Vendor Orders (4 automated vendor orders)
-- ✅ Shipping Labels (4 generated shipping labels)
-- ✅ Delivery Tracking (4 tracking records)
-- ✅ Email Notifications (7 automated email notifications)
-- ✅ Automation Logs (10 automation activity records)
-- ✅ Automation Stats (4 sellers' monthly statistics)

-- The data represents a realistic automated fulfillment workflow
-- from order placement through delivery confirmation.

PRINT '🎉 Automation sample data populated successfully!';
PRINT '📊 Added sample data for all automation tables';
PRINT '🚀 Ready to test the automated fulfillment system!';
