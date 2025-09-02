-- Automated Order Fulfillment - Database Setup Script
-- This script helps you execute the sample data in your database
-- Run this in your database management tool (pgAdmin, SQL Server Management Studio, etc.)

-- =====================================================
-- INSTRUCTIONS
-- =====================================================
-- 1. Make sure you've run the main migration files first:
--    - 20250828000001_automated_order_fulfillment.sql
--    - SELLER_AUTOMATION_SETUP.sql
--
-- 2. Execute the AUTOMATION_SAMPLE_DATA.sql script
--
-- 3. Verify the data was inserted correctly

-- =====================================================
-- QUICK VERIFICATION QUERIES
-- =====================================================

-- Check vendor products
SELECT COUNT(*) as vendor_products_count FROM vendor_products;

-- Check seller automation settings
SELECT COUNT(*) as automation_settings_count FROM seller_automation_settings;

-- Check sample orders
SELECT COUNT(*) as sample_orders_count FROM orders WHERE automation_enabled = 1;

-- Check vendor orders
SELECT COUNT(*) as vendor_orders_count FROM vendor_orders;

-- Check shipping labels
SELECT COUNT(*) as shipping_labels_count FROM shipping_labels;

-- Check delivery tracking
SELECT COUNT(*) as tracking_records_count FROM delivery_tracking;

-- Check email notifications
SELECT COUNT(*) as email_notifications_count FROM email_notifications;

-- Check automation logs
SELECT COUNT(*) as automation_logs_count FROM seller_automation_logs;

-- Check automation stats
SELECT COUNT(*) as automation_stats_count FROM seller_automation_stats;

-- =====================================================
-- SAMPLE QUERY TO SEE COMPLETE WORKFLOW
-- =====================================================

-- View complete automation workflow for one order
SELECT
  o.id as order_id,
  o.customer_name,
  o.customer_email,
  o.total_amount,
  o.status as order_status,
  vo.vendor_id,
  vo.status as vendor_order_status,
  sl.tracking_number,
  sl.carrier,
  dt.status as delivery_status,
  en.notification_type,
  en.status as email_status
FROM orders o
LEFT JOIN vendor_orders vo ON o.id = vo.order_id
LEFT JOIN shipping_labels sl ON o.id = sl.order_id
LEFT JOIN delivery_tracking dt ON o.id = dt.order_id
LEFT JOIN email_notifications en ON o.id = en.order_id
WHERE o.automation_enabled = 1
ORDER BY o.id;

PRINT '✅ Database verification complete!';
PRINT '🎯 Your automated fulfillment system is ready for testing!';
