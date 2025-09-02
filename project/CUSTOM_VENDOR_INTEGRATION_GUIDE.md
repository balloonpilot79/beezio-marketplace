# Custom Vendor Integration System

## Overview

The Custom Vendor Integration System extends your automated fulfillment platform to support unlimited third-party vendor integrations beyond the predefined ones (AliExpress, Oberlo, SaleHoo, Spocket). This system allows you to connect with any vendor that provides an API, webhook, FTP, or email-based ordering system.

## 🚀 Key Features

- **Unlimited Vendor Support**: Connect with any vendor that has an API or integration method
- **Flexible Integration Types**: Support for APIs, webhooks, FTP, email, and manual processing
- **Product Mapping**: Map your products to vendor-specific product IDs and attributes
- **Real-time Monitoring**: Track API calls, success rates, and connection health
- **Order Field Mapping**: Customize how your order data maps to vendor requirements
- **Test Mode**: Safely test integrations before going live
- **Rate Limiting**: Built-in rate limit management to prevent API throttling

## 📋 Prerequisites

1. **Database Setup**: Run the `CUSTOM_VENDOR_INTEGRATION.sql` migration
2. **React Component**: Import and use the `CustomVendorManager` component
3. **Vendor API Credentials**: Obtain API keys/credentials from your vendors
4. **Testing Environment**: Test integrations in test mode first

## 🗄️ Database Schema

### Core Tables

#### `custom_vendors`
Main vendor configuration table with connection details and supported features.

#### `custom_vendor_products`
Maps your products to vendor-specific product information and sync status.

#### `custom_vendor_api_logs`
Tracks all API interactions for monitoring and debugging.

#### `custom_vendor_order_mappings`
Defines how your order fields map to vendor-specific field names.

## 🔧 Integration Types

### 1. API Integration
For vendors with REST/GraphQL APIs.

**Example Configuration:**
```json
{
  "vendor_name": "Custom Dropship Supplier",
  "vendor_type": "api",
  "api_endpoint": "https://api.customdropship.com/v1",
  "authentication_method": "api_key",
  "supported_features": {
    "order_placement": true,
    "inventory_sync": true,
    "shipping_labels": false,
    "tracking_updates": true
  }
}
```

### 2. Webhook Integration
For vendors that send order data via webhooks.

**Example Configuration:**
```json
{
  "vendor_name": "Local Warehouse",
  "vendor_type": "webhook",
  "webhook_url": "https://your-app.com/webhooks/vendor-orders",
  "authentication_method": "bearer_token",
  "supported_features": {
    "order_placement": true,
    "inventory_sync": true,
    "shipping_labels": true,
    "tracking_updates": true
  }
}
```

### 3. FTP/SFTP Integration
For vendors that accept orders via file uploads.

**Example Configuration:**
```json
{
  "vendor_name": "Bulk Supplier",
  "vendor_type": "ftp",
  "ftp_host": "ftp.bulk-supplier.com",
  "ftp_username": "your_username",
  "ftp_password": "your_password",
  "supported_features": {
    "order_placement": true,
    "inventory_sync": false,
    "shipping_labels": false,
    "tracking_updates": false
  }
}
```

### 4. Email Integration
For vendors that accept orders via email.

**Example Configuration:**
```json
{
  "vendor_name": "Artisan Vendor",
  "vendor_type": "email",
  "email_address": "orders@artisan-vendor.com",
  "supported_features": {
    "order_placement": true,
    "inventory_sync": false,
    "shipping_labels": false,
    "tracking_updates": false
  }
}
```

### 5. Manual Processing
For vendors that require manual order processing.

**Example Configuration:**
```json
{
  "vendor_name": "Custom Manufacturer",
  "vendor_type": "manual",
  "contact_info": {
    "phone": "+1-555-0123",
    "email": "orders@manufacturer.com"
  },
  "supported_features": {
    "order_placement": false,
    "inventory_sync": false,
    "shipping_labels": false,
    "tracking_updates": false
  }
}
```

## 🛠️ Usage Guide

### 1. Adding a New Custom Vendor

1. **Navigate to Vendor Management**
   ```jsx
   import CustomVendorManager from './components/CustomVendorManager';

   function App() {
     return (
       <div>
         <CustomVendorManager />
       </div>
     );
   }
   ```

2. **Click "Add Custom Vendor"**
3. **Fill in Vendor Details:**
   - Vendor name and type
   - API endpoint (if applicable)
   - Authentication credentials
   - Supported features
   - Rate limits

4. **Test Connection**
   - Click "Test" to verify the connection works
   - Review test results and error messages

### 2. Product Mapping

1. **Select a Vendor** from the vendor list
2. **Click "Manage"** to open the vendor management modal
3. **Add Product Mappings:**
   - Select your product from the dropdown
   - Enter the vendor's product ID/SKU
   - Set vendor-specific pricing and attributes

4. **Sync Products** to update inventory from the vendor

### 3. Order Field Mapping

Configure how your order data maps to vendor requirements:

```sql
INSERT INTO custom_vendor_order_mappings (
  custom_vendor_id,
  order_field,
  vendor_field,
  field_type,
  is_required
) VALUES
  ('vendor-uuid', 'customer_name', 'buyer_name', 'string', true),
  ('vendor-uuid', 'customer_email', 'buyer_email', 'string', true),
  ('vendor-uuid', 'total_amount', 'order_total', 'number', true);
```

## 🔍 Monitoring & Debugging

### API Logs
Monitor all API interactions in the `custom_vendor_api_logs` table:

```sql
SELECT
  cv.vendor_name,
  cal.request_type,
  cal.endpoint,
  cal.response_status,
  cal.success,
  cal.created_at
FROM custom_vendor_api_logs cal
JOIN custom_vendors cv ON cal.custom_vendor_id = cv.id
ORDER BY cal.created_at DESC
LIMIT 50;
```

### Connection Health
Check vendor connection health:

```sql
SELECT
  vendor_name,
  is_active,
  test_mode,
  (
    SELECT COUNT(*)
    FROM custom_vendor_api_logs
    WHERE custom_vendor_id = cv.id
    AND success = 1
    AND created_at >= NOW() - INTERVAL '24 hours'
  ) as successful_calls_24h,
  (
    SELECT COUNT(*)
    FROM custom_vendor_api_logs
    WHERE custom_vendor_id = cv.id
    AND success = 0
    AND created_at >= NOW() - INTERVAL '24 hours'
  ) as failed_calls_24h
FROM custom_vendors cv;
```

## ⚙️ Configuration Examples

### Popular Vendor Integrations

#### Shopify Store
```json
{
  "vendor_name": "My Shopify Store",
  "vendor_type": "api",
  "api_endpoint": "https://your-store.myshopify.com/admin/api/2023-10",
  "authentication_method": "api_key",
  "supported_features": {
    "order_placement": true,
    "inventory_sync": true,
    "shipping_labels": true,
    "tracking_updates": true
  }
}
```

#### WooCommerce Store
```json
{
  "vendor_name": "WooCommerce Vendor",
  "vendor_type": "api",
  "api_endpoint": "https://vendor-site.com/wp-json/wc/v3",
  "authentication_method": "basic_auth",
  "supported_features": {
    "order_placement": true,
    "inventory_sync": true,
    "shipping_labels": false,
    "tracking_updates": true
  }
}
```

#### Print-on-Demand Service
```json
{
  "vendor_name": "Printful",
  "vendor_type": "api",
  "api_endpoint": "https://api.printful.com",
  "authentication_method": "oauth",
  "supported_features": {
    "order_placement": true,
    "inventory_sync": true,
    "shipping_labels": true,
    "tracking_updates": true
  }
}
```

## 🔐 Security Best Practices

1. **API Key Management**
   - Store API keys securely (consider encryption)
   - Rotate keys regularly
   - Use different keys for test/production

2. **Rate Limiting**
   - Respect vendor API rate limits
   - Implement exponential backoff for retries
   - Monitor API usage patterns

3. **Data Validation**
   - Validate all input data before sending to vendors
   - Sanitize vendor responses
   - Log all API interactions for audit trails

4. **Access Control**
   - Restrict vendor management to authorized users
   - Implement row-level security in the database
   - Audit all vendor configuration changes

## 🚨 Troubleshooting

### Common Issues

#### Connection Test Fails
- Verify API endpoint URL is correct
- Check authentication credentials
- Ensure vendor API is accessible from your server
- Check for firewall/proxy issues

#### Product Sync Issues
- Verify product IDs match vendor catalog
- Check vendor API documentation for correct endpoints
- Ensure proper authentication for sync operations
- Review API logs for detailed error messages

#### Order Placement Errors
- Verify order field mappings are correct
- Check vendor-specific requirements (required fields, formats)
- Ensure product mappings are up-to-date
- Review rate limiting and retry logic

### Debug Mode
Enable test mode for new integrations:
```sql
UPDATE custom_vendors
SET test_mode = 1
WHERE id = 'your-vendor-id';
```

## 📊 Analytics & Reporting

### Vendor Performance Metrics
```sql
SELECT
  cv.vendor_name,
  COUNT(DISTINCT vp.product_id) as mapped_products,
  AVG(CASE WHEN cal.success THEN 1 ELSE 0 END) as success_rate,
  COUNT(cal.*) as total_api_calls,
  MAX(cal.created_at) as last_activity
FROM custom_vendors cv
LEFT JOIN custom_vendor_products vp ON cv.id = vp.custom_vendor_id
LEFT JOIN custom_vendor_api_logs cal ON cv.id = cal.custom_vendor_id
  AND cal.created_at >= NOW() - INTERVAL '30 days'
GROUP BY cv.id, cv.vendor_name;
```

### Order Fulfillment Success
```sql
SELECT
  cv.vendor_name,
  COUNT(vo.*) as total_orders,
  SUM(CASE WHEN vo.status = 'delivered' THEN 1 ELSE 0 END) as successful_deliveries,
  AVG(vo.total_cost) as avg_order_cost,
  AVG(EXTRACT(EPOCH FROM (NOW() - vo.created_at))/86400) as avg_fulfillment_days
FROM custom_vendors cv
JOIN vendor_orders vo ON cv.id = vo.custom_vendor_id
WHERE vo.created_at >= NOW() - INTERVAL '30 days'
GROUP BY cv.id, cv.vendor_name;
```

## 🔄 Future Enhancements

- **Webhook Processing**: Automated handling of vendor webhooks
- **Bulk Operations**: Batch order processing for multiple vendors
- **Advanced Mapping**: Complex field transformations and calculations
- **Integration Marketplace**: Pre-built configurations for popular vendors
- **AI-Powered Mapping**: Automatic field mapping suggestions
- **Real-time Dashboards**: Live monitoring of all vendor integrations

## 📞 Support

For issues or questions about custom vendor integrations:

1. Check the API logs in `custom_vendor_api_logs` table
2. Review vendor-specific documentation
3. Test connections using the built-in test functionality
4. Check rate limits and authentication settings

---

**🎉 Your automated fulfillment system now supports unlimited custom vendor integrations!**
