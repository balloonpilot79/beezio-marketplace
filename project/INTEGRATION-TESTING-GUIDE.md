# 🔌 Universal Store Integration Testing Guide

## 📊 **Integration System Overview**

### ✅ **Supported Platforms for BOTH Sellers & Affiliates:**
- **🛍️ Shopify**: Full store import with product sync
- **🖨️ Printify**: Print-on-demand product integration
- **📦 Printful**: Custom product fulfillment
- **🎨 Etsy**: Handmade and vintage items
- **📱 Amazon Seller**: Product catalog import
- **🏷️ eBay**: Listings and auction integration
- **🌐 WooCommerce**: WordPress store connection
- **⬜ Square**: POS and online store sync
- **🏪 BigCommerce**: Multi-channel integration
- **📊 CSV Import**: Bulk product upload via file

### 🎯 **Key Features:**
- **Role-Based Access**: Different features for sellers vs affiliates
- **Bulk Import**: Import hundreds of products at once
- **Auto-Sync**: Real-time inventory and price updates
- **Commission Settings**: Set custom rates for imported products
- **Product Mapping**: Automatic category and tag assignment
- **Error Handling**: Comprehensive validation and retry logic

---

## 🧪 **Testing Scenarios**

### **📋 Test 1: Seller Store Integration**

#### **A. Access Integration Dashboard:**
1. **Login as Seller**
2. **Navigate to**: Dashboard → API Integration (or `/dashboard/integrations`)
3. **Verify**: See all available platforms for sellers

#### **B. Connect Shopify Store:**
1. **Click "Connect"** on Shopify integration
2. **Enter Credentials**:
   - API Key: `your-shopify-api-key`
   - Store URL: `https://yourstore.myshopify.com`
3. **Click "Connect"**
4. **Verify**: Connection status changes to "Active"

#### **C. Import Products:**
1. **Click "Import"** on connected Shopify integration
2. **Configure Import Settings**:
   - ✅ Import all products
   - Commission Rate: 25%
   - ✅ Enable automatic sync
3. **Click "Import Products"**
4. **Verify**: Products appear in seller's product list
5. **Check**: Products have correct commission rates and categories

#### **Expected Results:**
- ✅ Shopify connection established successfully
- ✅ Products imported with all metadata (images, descriptions, prices)
- ✅ Commission rates applied correctly
- ✅ Products appear in seller's store page
- ✅ Integration shows product count and last sync time

### **📋 Test 2: Affiliate Product Import**

#### **A. Access Affiliate Integrations:**
1. **Login as Affiliate**
2. **Navigate to**: Dashboard → Store Integrations
3. **Verify**: See affiliate-specific integration options

#### **B. Connect Print-on-Demand (Printify):**
1. **Click "Connect"** on Printify integration
2. **Enter API Key**: `printify-api-key-here`
3. **Save Connection**
4. **Verify**: Shows "Connected" status

#### **C. Import for Affiliate Promotion:**
1. **Click "Import"** on Printify integration
2. **Configure for Affiliate**:
   - ✅ Import all products
   - Commission Rate: 30%
   - ✅ Mark as affiliate products
   - ✅ Enable automatic sync
3. **Start Import Process**
4. **Verify**: Products imported as affiliate promotions

#### **D. Generate Affiliate Links:**
1. **Go to**: Affiliate dashboard
2. **Find imported products**
3. **Generate tracking links** for each product
4. **Test links** redirect properly with tracking codes

#### **Expected Results:**
- ✅ Printify products imported successfully
- ✅ Products marked as affiliate promotions
- ✅ Affiliate links generated with tracking
- ✅ Commission rates set correctly
- ✅ Products appear in affiliate store page

### **📋 Test 3: Multi-Platform Integration**

#### **A. Connect Multiple Platforms:**
1. **As Seller**: Connect Shopify + Etsy + Printful
2. **As Affiliate**: Connect Printify + eBay + CSV import
3. **Verify**: All platforms show as connected

#### **B. Bulk Import from Multiple Sources:**
1. **Import from each connected platform**
2. **Set different commission rates** per platform:
   - Shopify: 20%
   - Etsy: 35%
   - Printful: 25%
3. **Verify**: Products maintain source platform information

#### **C. Test Auto-Sync:**
1. **Enable auto-sync** on all integrations
2. **Make changes** in external platforms (price updates, new products)
3. **Wait for sync** (or trigger manually)
4. **Verify**: Changes reflected in Beezio platform

#### **Expected Results:**
- ✅ Multiple integrations work simultaneously
- ✅ Different commission rates per platform
- ✅ Source attribution maintained
- ✅ Auto-sync updates work correctly
- ✅ No conflicts between platforms

### **📋 Test 4: CSV Bulk Import**

#### **A. Prepare CSV File:**
```csv
title,description,price,image_url,category,tags,inventory
Premium Headphones,High-quality audio,199.99,https://example.com/headphones.jpg,Electronics,"audio,headphones,premium",50
Organic Coffee,Fair trade coffee beans,24.99,https://example.com/coffee.jpg,Food & Beverage,"coffee,organic,fair-trade",100
```

#### **B. Import via CSV:**
1. **Select CSV Import** integration
2. **Upload CSV file**
3. **Map columns** to product fields
4. **Set commission rate**: 20%
5. **Start import process**

#### **C. Verify Import:**
1. **Check product list** for new items
2. **Verify all fields** imported correctly
3. **Test product pages** display properly
4. **Confirm commission** settings applied

#### **Expected Results:**
- ✅ CSV file uploads successfully
- ✅ Column mapping works correctly
- ✅ All products imported with proper data
- ✅ Images and metadata preserved
- ✅ Bulk commission rates applied

### **📋 Test 5: Integration Management**

#### **A. Monitor Integration Status:**
1. **Check integration dashboard** for all connected platforms
2. **Verify status indicators**:
   - 🟢 Active: Working normally
   - 🟡 Syncing: Currently updating
   - 🔴 Error: Connection issue
3. **Review sync history** and product counts

#### **B. Handle Errors:**
1. **Disconnect and reconnect** integration
2. **Test with invalid API credentials**
3. **Verify error messages** are helpful
4. **Check retry mechanisms** work

#### **C. Manage Product Conflicts:**
1. **Import same product** from multiple platforms
2. **Verify duplicate detection**
3. **Test conflict resolution**
4. **Ensure data integrity**

#### **Expected Results:**
- ✅ Status monitoring works accurately
- ✅ Error handling is robust
- ✅ Duplicate detection prevents conflicts
- ✅ Easy disconnect/reconnect process
- ✅ Comprehensive sync history tracking

---

## 🚨 **Common Issues to Test**

### **API Connection Issues:**
- [ ] **Invalid API keys** show clear error messages
- [ ] **Network timeouts** handled gracefully
- [ ] **Rate limiting** respected by platform
- [ ] **Permission errors** clearly explained

### **Data Import Issues:**
- [ ] **Large product catalogs** import successfully
- [ ] **Special characters** in titles/descriptions preserved
- [ ] **Multiple images** per product handled correctly
- [ ] **Price formatting** works across currencies

### **Integration Conflicts:**
- [ ] **Same product from multiple platforms** handled properly
- [ ] **Different commission rates** don't conflict
- [ ] **Auto-sync timing** doesn't cause race conditions
- [ ] **Platform API changes** don't break connections

### **Performance Issues:**
- [ ] **Large imports** don't timeout or crash
- [ ] **Real-time sync** doesn't slow down platform
- [ ] **Multiple users** importing simultaneously works
- [ ] **Database performance** remains optimal

---

## 📊 **Success Metrics**

### **For Sellers:**
✅ **Can connect** to their existing e-commerce platforms
✅ **Import entire catalogs** with one click
✅ **Maintain sync** with external inventory
✅ **Set custom commissions** for affiliate programs
✅ **Track sales** from multiple sources

### **For Affiliates:**
✅ **Can import products** they want to promote
✅ **Generate tracking links** for imported items
✅ **Set commission expectations** before import
✅ **Build curated stores** from multiple sources
✅ **Track performance** across platforms

### **For Platform:**
✅ **Supports 10+ major e-commerce platforms**
✅ **Handles bulk imports** of 1000+ products
✅ **Maintains data integrity** across integrations
✅ **Provides real-time sync** capabilities
✅ **Offers comprehensive error handling**

---

## 🔧 **Integration API Examples**

### **Shopify API Integration:**
```javascript
// Example Shopify product fetch
const fetchShopifyProducts = async (apiKey, storeUrl) => {
  const response = await fetch(`${storeUrl}/admin/api/2023-07/products.json`, {
    headers: {
      'X-Shopify-Access-Token': apiKey,
      'Content-Type': 'application/json'
    }
  });
  return response.json();
};
```

### **Printify API Integration:**
```javascript
// Example Printify product import
const importPrintifyProducts = async (apiKey) => {
  const response = await fetch('https://api.printify.com/v1/shops/shop_id/products.json', {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }
  });
  return response.json();
};
```

---

## 🎯 **Conclusion**

The Universal Integration System enables both **sellers and affiliates** to:

1. **Connect existing stores** from 10+ major platforms
2. **Import products in bulk** with custom settings
3. **Maintain real-time sync** with external sources
4. **Set platform-specific commission rates**
5. **Build comprehensive product catalogs** quickly

This creates a powerful ecosystem where sellers can expand their reach and affiliates can build diverse, high-quality product portfolios from trusted sources.

**Ready for production testing with real API credentials and live store connections!**
