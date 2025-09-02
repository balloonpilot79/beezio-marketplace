-- Sample Custom Vendor Configurations
-- This file contains example configurations for popular vendor types
-- Copy and modify these for your specific vendor integrations

-- =====================================================
-- 1. E-COMMERCE PLATFORM INTEGRATIONS
-- =====================================================

-- Shopify Store Integration
INSERT INTO custom_vendors (
  vendor_name,
  vendor_type,
  api_endpoint,
  api_key,
  authentication_method,
  supported_features,
  request_format,
  response_format,
  rate_limits,
  is_active,
  test_mode
) VALUES (
  'My Shopify Store',
  'api',
  'https://your-store.myshopify.com/admin/api/2023-10',
  'your-shopify-admin-api-key',
  'api_key',
  '{
    "order_placement": true,
    "inventory_sync": true,
    "shipping_labels": true,
    "tracking_updates": true,
    "returns_handling": true
  }',
  'json',
  'json',
  '{"requests_per_minute": 40, "requests_per_hour": 2000}',
  true,
  true
);

-- WooCommerce Store Integration
INSERT INTO custom_vendors (
  vendor_name,
  vendor_type,
  api_endpoint,
  api_key,
  api_secret,
  authentication_method,
  supported_features,
  is_active,
  test_mode
) VALUES (
  'WooCommerce Vendor',
  'api',
  'https://vendor-site.com/wp-json/wc/v3',
  'consumer_key_here',
  'consumer_secret_here',
  'basic_auth',
  '{
    "order_placement": true,
    "inventory_sync": true,
    "shipping_labels": false,
    "tracking_updates": true,
    "returns_handling": false
  }',
  true,
  true
);

-- =====================================================
-- 2. PRINT-ON-DEMAND SERVICES
-- =====================================================

-- Printful Integration
INSERT INTO custom_vendors (
  vendor_name,
  vendor_type,
  api_endpoint,
  api_key,
  authentication_method,
  supported_features,
  is_active,
  test_mode
) VALUES (
  'Printful POD Service',
  'api',
  'https://api.printful.com',
  'printful-api-key',
  'bearer_token',
  '{
    "order_placement": true,
    "inventory_sync": true,
    "shipping_labels": true,
    "tracking_updates": true,
    "returns_handling": true
  }',
  true,
  true
);

-- Printify Integration
INSERT INTO custom_vendors (
  vendor_name,
  vendor_type,
  api_endpoint,
  api_key,
  authentication_method,
  supported_features,
  is_active,
  test_mode
) VALUES (
  'Printify POD',
  'api',
  'https://api.printify.com/v1',
  'printify-api-token',
  'bearer_token',
  '{
    "order_placement": true,
    "inventory_sync": true,
    "shipping_labels": true,
    "tracking_updates": true,
    "returns_handling": true
  }',
  true,
  true
);

-- =====================================================
-- 3. DROPSHIPPING SUPPLIERS
-- =====================================================

-- Generic Dropship Supplier API
INSERT INTO custom_vendors (
  vendor_name,
  vendor_type,
  api_endpoint,
  api_key,
  authentication_method,
  supported_features,
  is_active,
  test_mode
) VALUES (
  'Dropship Supplier Pro',
  'api',
  'https://api.dropshipsupplier.com/v2',
  'supplier-api-key-123',
  'api_key',
  '{
    "order_placement": true,
    "inventory_sync": true,
    "shipping_labels": false,
    "tracking_updates": true,
    "returns_handling": false
  }',
  true,
  true
);

-- AliExpress Custom Integration (beyond built-in)
INSERT INTO custom_vendors (
  vendor_name,
  vendor_type,
  api_endpoint,
  api_key,
  api_secret,
  authentication_method,
  supported_features,
  is_active,
  test_mode
) VALUES (
  'AliExpress Premium',
  'api',
  'https://api-sg.aliexpress.com/sync',
  'aliexpress-app-key',
  'aliexpress-app-secret',
  'oauth',
  '{
    "order_placement": true,
    "inventory_sync": true,
    "shipping_labels": true,
    "tracking_updates": true,
    "returns_handling": true
  }',
  true,
  true
);

-- =====================================================
-- 4. LOCAL/REGIONAL SUPPLIERS
-- =====================================================

-- Local Warehouse with Webhook
INSERT INTO custom_vendors (
  vendor_name,
  vendor_type,
  webhook_url,
  api_key,
  authentication_method,
  supported_features,
  is_active,
  test_mode
) VALUES (
  'Local Warehouse Co',
  'webhook',
  'https://your-app.com/webhooks/warehouse-orders',
  'warehouse-webhook-secret',
  'bearer_token',
  '{
    "order_placement": true,
    "inventory_sync": true,
    "shipping_labels": true,
    "tracking_updates": true,
    "returns_handling": true
  }',
  true,
  true
);

-- Regional Distributor
INSERT INTO custom_vendors (
  vendor_name,
  vendor_type,
  api_endpoint,
  api_key,
  authentication_method,
  supported_features,
  is_active,
  test_mode
) VALUES (
  'Regional Distributor',
  'api',
  'https://api.regionaldistributor.com/v1',
  'distributor-api-key',
  'api_key',
  '{
    "order_placement": true,
    "inventory_sync": true,
    "shipping_labels": false,
    "tracking_updates": true,
    "returns_handling": false
  }',
  true,
  true
);

-- =====================================================
-- 5. SPECIALTY SUPPLIERS
-- =====================================================

-- Custom Jewelry Manufacturer
INSERT INTO custom_vendors (
  vendor_name,
  vendor_type,
  email_address,
  contact_info,
  supported_features,
  is_active,
  test_mode
) VALUES (
  'Artisan Jewelry Co',
  'email',
  'orders@jewelry-artisan.com',
  '{
    "phone": "+1-555-JEWELRY",
    "contact_person": "Sarah Johnson",
    "order_instructions": "Email order details with customer requirements"
  }',
  '{
    "order_placement": true,
    "inventory_sync": false,
    "shipping_labels": false,
    "tracking_updates": false,
    "returns_handling": true
  }',
  true,
  true
);

-- Organic Food Supplier
INSERT INTO custom_vendors (
  vendor_name,
  vendor_type,
  api_endpoint,
  api_key,
  authentication_method,
  supported_features,
  is_active,
  test_mode
) VALUES (
  'Organic Foods Direct',
  'api',
  'https://api.organicfoods.com/orders',
  'organic-api-key',
  'api_key',
  '{
    "order_placement": true,
    "inventory_sync": true,
    "shipping_labels": true,
    "tracking_updates": true,
    "returns_handling": true
  }',
  true,
  true
);

-- =====================================================
-- 6. WHOLESALE SUPPLIERS
-- =====================================================

-- Bulk Electronics Supplier
INSERT INTO custom_vendors (
  vendor_name,
  vendor_type,
  ftp_host,
  ftp_username,
  ftp_password,
  contact_info,
  supported_features,
  is_active,
  test_mode
) VALUES (
  'Bulk Electronics Inc',
  'ftp',
  'ftp.bulk-electronics.com',
  'your-ftp-username',
  'your-ftp-password',
  '{
    "phone": "+1-800-ELECTRONICS",
    "email": "orders@bulk-electronics.com",
    "file_format": "CSV",
    "upload_frequency": "Daily"
  }',
  '{
    "order_placement": true,
    "inventory_sync": false,
    "shipping_labels": false,
    "tracking_updates": false,
    "returns_handling": false
  }',
  true,
  true
);

-- Furniture Wholesale
INSERT INTO custom_vendors (
  vendor_name,
  vendor_type,
  api_endpoint,
  api_key,
  authentication_method,
  supported_features,
  is_active,
  test_mode
) VALUES (
  'Furniture Wholesale Co',
  'api',
  'https://api.furniturewholesale.com/v1',
  'furniture-api-key',
  'oauth',
  '{
    "order_placement": true,
    "inventory_sync": true,
    "shipping_labels": true,
    "tracking_updates": true,
    "returns_handling": true
  }',
  true,
  true
);

-- =====================================================
-- 7. MANUAL PROCESSING VENDORS
-- =====================================================

-- Custom Manufacturer
INSERT INTO custom_vendors (
  vendor_name,
  vendor_type,
  contact_info,
  supported_features,
  is_active,
  test_mode
) VALUES (
  'Custom Widget Manufacturer',
  'manual',
  '{
    "phone": "+1-555-MANUFACTURE",
    "email": "orders@widget-maker.com",
    "contact_person": "Mike Manufacturing",
    "lead_time": "2-3 weeks",
    "minimum_order": 50
  }',
  '{
    "order_placement": false,
    "inventory_sync": false,
    "shipping_labels": false,
    "tracking_updates": false,
    "returns_handling": true
  }',
  true,
  true
);

-- =====================================================
-- SAMPLE ORDER MAPPINGS
-- =====================================================
-- These show how to map your order fields to vendor requirements

-- Insert sample mappings for the first vendor (Shopify)
INSERT INTO custom_vendor_order_mappings (
  custom_vendor_id,
  order_field,
  vendor_field,
  field_type,
  is_required,
  default_value,
  transformation_rule
) VALUES
  (
    (SELECT TOP 1 id FROM custom_vendors WHERE vendor_name = 'My Shopify Store'),
    'customer_name',
    'customer[first_name] + customer[last_name]',
    'string',
    true,
    NULL,
    'CONCAT(customer_first_name, '' '', customer_last_name)'
  ),
  (
    (SELECT TOP 1 id FROM custom_vendors WHERE vendor_name = 'My Shopify Store'),
    'customer_email',
    'customer[email]',
    'string',
    true,
    NULL,
    NULL
  ),
  (
    (SELECT TOP 1 id FROM custom_vendors WHERE vendor_name = 'My Shopify Store'),
    'shipping_address',
    'shipping_address',
    'json',
    true,
    NULL,
    NULL
  ),
  (
    (SELECT TOP 1 id FROM custom_vendors WHERE vendor_name = 'My Shopify Store'),
    'total_amount',
    'total_price',
    'number',
    true,
    NULL,
    NULL
  );

-- Insert mappings for WooCommerce vendor
INSERT INTO custom_vendor_order_mappings (
  custom_vendor_id,
  order_field,
  vendor_field,
  field_type,
  is_required
) VALUES
  (
    (SELECT TOP 1 id FROM custom_vendors WHERE vendor_name = 'WooCommerce Vendor'),
    'customer_name',
    'billing[first_name] + billing[last_name]',
    'string',
    true
  ),
  (
    (SELECT TOP 1 id FROM custom_vendors WHERE vendor_name = 'WooCommerce Vendor'),
    'customer_email',
    'billing[email]',
    'string',
    true
  ),
  (
    (SELECT TOP 1 id FROM custom_vendors WHERE vendor_name = 'WooCommerce Vendor'),
    'total_amount',
    'total',
    'number',
    true
  );

-- =====================================================
-- SAMPLE PRODUCT MAPPINGS
-- =====================================================
-- These show how to map your products to vendor products

-- Note: Replace the product_id values with actual UUIDs from your products table
-- and vendor_product_id with actual vendor product identifiers

/*
INSERT INTO custom_vendor_products (
  custom_vendor_id,
  product_id,
  vendor_product_id,
  vendor_sku,
  vendor_product_name,
  vendor_price,
  vendor_stock_quantity,
  sync_status
) VALUES
  (
    (SELECT TOP 1 id FROM custom_vendors WHERE vendor_name = 'My Shopify Store'),
    'your-product-uuid-1',
    'shopify-variant-id-123',
    'SHOPIFY-SKU-001',
    'Wireless Bluetooth Headphones',
    89.99,
    150,
    'active'
  ),
  (
    (SELECT TOP 1 id FROM custom_vendors WHERE vendor_name = 'Printful POD Service'),
    'your-product-uuid-2',
    'printful-product-id-456',
    'POD-TEE-001',
    'Custom Printed T-Shirt',
    24.99,
    500,
    'active'
  );
*/

-- =====================================================
-- TESTING QUERIES
-- =====================================================

-- View all configured custom vendors
SELECT
  vendor_name,
  vendor_type,
  is_active,
  test_mode,
  api_endpoint
FROM custom_vendors
ORDER BY created_at DESC;

-- Check vendor capabilities
SELECT
  vendor_name,
  JSON_VALUE(supported_features, '$.order_placement') as can_place_orders,
  JSON_VALUE(supported_features, '$.inventory_sync') as can_sync_inventory,
  JSON_VALUE(supported_features, '$.shipping_labels') as can_generate_labels,
  JSON_VALUE(supported_features, '$.tracking_updates') as can_track_shipments
FROM custom_vendors;

-- View order field mappings
SELECT
  cv.vendor_name,
  com.order_field,
  com.vendor_field,
  com.field_type,
  com.is_required
FROM custom_vendor_order_mappings com
JOIN custom_vendors cv ON com.custom_vendor_id = cv.id
ORDER BY cv.vendor_name, com.order_field;

PRINT '🎉 Sample custom vendor configurations loaded!';
PRINT '📝 Remember to:';
PRINT '   1. Update API keys with real credentials';
PRINT '   2. Replace sample UUIDs with actual product IDs';
PRINT '   3. Test connections before going live';
PRINT '   4. Configure order field mappings for your specific vendors';
PRINT '🚀 Ready to connect unlimited custom vendors!';
