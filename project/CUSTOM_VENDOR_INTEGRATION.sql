-- Custom Vendor Integration System (SQL Server Compatible)
-- Extends the automated fulfillment system to support custom vendor integrations
-- Run this after the main automation setup

-- =====================================================
-- 1. CUSTOM VENDORS TABLE
-- =====================================================
-- Store information about custom vendor integrations

-- Check if custom_vendors table exists, create if not
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='custom_vendors' AND xtype='U')
BEGIN
  CREATE TABLE custom_vendors (
    id UNIQUEIDENTIFIER DEFAULT NEWID() PRIMARY KEY,
    vendor_name NVARCHAR(255) NOT NULL,
    vendor_type NVARCHAR(50) NOT NULL, -- 'api', 'webhook', 'ftp', 'email', 'manual'
    api_endpoint NVARCHAR(500),
    api_key NVARCHAR(500),
    api_secret NVARCHAR(500),
    webhook_url NVARCHAR(500),
    ftp_host NVARCHAR(255),
    ftp_username NVARCHAR(100),
    ftp_password NVARCHAR(100),
    email_address NVARCHAR(255),
    contact_info NVARCHAR(MAX), -- JSON string
    supported_features NVARCHAR(MAX), -- JSON string
    authentication_method NVARCHAR(50) DEFAULT 'api_key',
    request_format NVARCHAR(20) DEFAULT 'json',
    response_format NVARCHAR(20) DEFAULT 'json',
    rate_limits NVARCHAR(MAX), -- JSON string
    is_active BIT DEFAULT 1,
    test_mode BIT DEFAULT 1,
    created_by UNIQUEIDENTIFIER,
    created_at DATETIME DEFAULT GETDATE(),
    updated_at DATETIME DEFAULT GETDATE()
  );
END

-- =====================================================
-- 2. CUSTOM VENDOR PRODUCTS TABLE
-- =====================================================
-- Link products to custom vendors with flexible mapping

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='custom_vendor_products' AND xtype='U')
BEGIN
  CREATE TABLE custom_vendor_products (
    id UNIQUEIDENTIFIER DEFAULT NEWID() PRIMARY KEY,
    custom_vendor_id UNIQUEIDENTIFIER NOT NULL,
    product_id UNIQUEIDENTIFIER NOT NULL,
    vendor_product_id NVARCHAR(255) NOT NULL,
    vendor_sku NVARCHAR(100),
    vendor_product_name NVARCHAR(255),
    vendor_price DECIMAL(10,2),
    vendor_stock_quantity INT DEFAULT 0,
    vendor_category NVARCHAR(100),
    vendor_attributes NVARCHAR(MAX), -- JSON string
    mapping_rules NVARCHAR(MAX), -- JSON string
    last_synced DATETIME,
    sync_status NVARCHAR(20) DEFAULT 'pending',
    sync_error_message NVARCHAR(MAX),
    is_active BIT DEFAULT 1,
    created_at DATETIME DEFAULT GETDATE(),
    updated_at DATETIME DEFAULT GETDATE()
  );
END

-- =====================================================
-- 3. CUSTOM VENDOR API LOGS
-- =====================================================
-- Track all API interactions with custom vendors

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='custom_vendor_api_logs' AND xtype='U')
BEGIN
  CREATE TABLE custom_vendor_api_logs (
    id UNIQUEIDENTIFIER DEFAULT NEWID() PRIMARY KEY,
    custom_vendor_id UNIQUEIDENTIFIER,
    request_type NVARCHAR(10) NOT NULL,
    endpoint NVARCHAR(500) NOT NULL,
    request_headers NVARCHAR(MAX), -- JSON string
    request_body NVARCHAR(MAX), -- JSON string
    response_status INT,
    response_body NVARCHAR(MAX), -- JSON string
    response_time_ms INT,
    error_message NVARCHAR(MAX),
    success BIT DEFAULT 0,
    created_at DATETIME DEFAULT GETDATE()
  );
END

-- =====================================================
-- 4. CUSTOM VENDOR ORDER MAPPINGS
-- =====================================================
-- Map our order fields to custom vendor order formats

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='custom_vendor_order_mappings' AND xtype='U')
BEGIN
  CREATE TABLE custom_vendor_order_mappings (
    id UNIQUEIDENTIFIER DEFAULT NEWID() PRIMARY KEY,
    custom_vendor_id UNIQUEIDENTIFIER NOT NULL,
    order_field NVARCHAR(100) NOT NULL,
    vendor_field NVARCHAR(100) NOT NULL,
    field_type NVARCHAR(20) DEFAULT 'string',
    is_required BIT DEFAULT 0,
    default_value NVARCHAR(255),
    transformation_rule NVARCHAR(500),
    created_at DATETIME DEFAULT GETDATE()
  );
END

-- =====================================================
-- 5. ADD COLUMNS TO EXISTING TABLES
-- =====================================================

-- Add custom_vendor_id to vendor_orders table if it doesn't exist
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('vendor_orders') AND name = 'custom_vendor_id')
BEGIN
  ALTER TABLE vendor_orders ADD custom_vendor_id UNIQUEIDENTIFIER;
END

-- Add custom_vendor_configs to seller_automation_settings if it doesn't exist
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('seller_automation_settings') AND name = 'custom_vendor_configs')
BEGIN
  ALTER TABLE seller_automation_settings ADD custom_vendor_configs NVARCHAR(MAX);
END

-- =====================================================
-- 6. INDEXES FOR PERFORMANCE
-- =====================================================

-- Create indexes if they don't exist
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE object_id = OBJECT_ID('custom_vendors') AND name = 'idx_custom_vendors_is_active')
BEGIN
  CREATE INDEX idx_custom_vendors_is_active ON custom_vendors(is_active);
END

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE object_id = OBJECT_ID('custom_vendors') AND name = 'idx_custom_vendors_created_by')
BEGIN
  CREATE INDEX idx_custom_vendors_created_by ON custom_vendors(created_by);
END

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE object_id = OBJECT_ID('custom_vendor_products') AND name = 'idx_custom_vendor_products_vendor_id')
BEGIN
  CREATE INDEX idx_custom_vendor_products_vendor_id ON custom_vendor_products(custom_vendor_id);
END

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE object_id = OBJECT_ID('custom_vendor_products') AND name = 'idx_custom_vendor_products_product_id')
BEGIN
  CREATE INDEX idx_custom_vendor_products_product_id ON custom_vendor_products(product_id);
END

-- =====================================================
-- 7. SAMPLE DATA FOR TESTING
-- =====================================================

-- Insert sample custom vendors (only if they don't exist)
IF NOT EXISTS (SELECT * FROM custom_vendors WHERE vendor_name = 'Custom Dropship Supplier')
BEGIN
  INSERT INTO custom_vendors (
    vendor_name,
    vendor_type,
    api_endpoint,
    api_key,
    authentication_method,
    supported_features,
    test_mode
  ) VALUES (
    'Custom Dropship Supplier',
    'api',
    'https://api.customdropship.com/v1',
    'sample_api_key_123',
    'api_key',
    '{
      "order_placement": true,
      "inventory_sync": true,
      "shipping_labels": false,
      "tracking_updates": true,
      "returns_handling": false
    }',
    1
  );
END

IF NOT EXISTS (SELECT * FROM custom_vendors WHERE vendor_name = 'Local Warehouse API')
BEGIN
  INSERT INTO custom_vendors (
    vendor_name,
    vendor_type,
    api_endpoint,
    api_key,
    authentication_method,
    supported_features,
    test_mode
  ) VALUES (
    'Local Warehouse API',
    'webhook',
    'https://warehouse.local/api/orders',
    'warehouse_auth_token',
    'bearer_token',
    '{
      "order_placement": true,
      "inventory_sync": true,
      "shipping_labels": true,
      "tracking_updates": true,
      "returns_handling": true
    }',
    1
  );
END

-- =====================================================
-- SUMMARY
-- =====================================================
-- This migration adds comprehensive custom vendor support:
-- ✅ Custom vendors table with flexible configuration
-- ✅ Product mapping with vendor-specific attributes
-- ✅ API logging and monitoring
-- ✅ Order field mapping system
-- ✅ Performance indexes
-- ✅ Sample data for testing

-- The system now supports unlimited custom vendor integrations!

PRINT '🎉 Custom vendor integration system installed successfully!';
PRINT '📊 New tables created: custom_vendors, custom_vendor_products, custom_vendor_api_logs, custom_vendor_order_mappings';
PRINT '🔧 Extended existing tables with custom vendor support';
PRINT '🚀 Ready to add unlimited custom vendor integrations!';
