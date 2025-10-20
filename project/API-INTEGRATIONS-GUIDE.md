# 🚀 API INTEGRATIONS SETUP GUIDE

## Overview
This guide will help you connect your existing e-commerce platforms to Beezio and automatically import your products.

## ✅ Benefits
- **Save Time**: Import hundreds of products in minutes
- **Auto-Sync**: Keep inventory automatically updated
- **Multi-Platform**: Sell across multiple channels
- **No Re-Listing**: Keep existing product data, images, and descriptions

---

## 🖨️ PRINTIFY SETUP (Print-on-Demand)

### Step 1: Get Your API Token
1. Log into your [Printify account](https://printify.com)
2. Go to **My Profile** → **Connections** → **API**
   - Direct link: https://printify.com/app/account/api
3. Click **"Generate New Token"**
4. Copy the Personal Access Token (starts with `eyJ...`)

### Step 2: Connect to Beezio
1. Go to your Beezio Dashboard → **Store Settings** → **API Integrations**
2. Find **Printify** card and click **"Connect"**
3. Paste your API token
4. Click **"Connect"**

### Step 3: Import Products
1. Click **"Import"** on the Printify card
2. Set your commission rate (default: 25%)
3. Choose import options:
   - ✅ Import all products
   - ✅ Enable auto-sync (recommended)
4. Click **"Import Products"**

**What Gets Imported:**
- Product title and description
- All product images
- Pricing information
- Variant options (sizes, colors)
- Print-on-demand fulfillment settings

---

## 📦 PRINTFUL SETUP (Print-on-Demand)

### Step 1: Get Your API Key
1. Log into [Printful](https://www.printful.com)
2. Go to **Store Settings** → **API**
   - Direct link: https://www.printful.com/dashboard/store
3. Click **"Enable API Access"**
4. Copy your API key (format: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)

### Step 2: Connect to Beezio
1. Beezio Dashboard → **Store Settings** → **API Integrations**
2. Find **Printful** and click **"Connect"**
3. Paste your API key
4. Click **"Connect"**

### Step 3: Import Products
1. Click **"Import"** 
2. Configure settings:
   - Commission rate
   - Auto-sync enabled
3. Import your catalog

**Features:**
- Mockup images automatically included
- Fulfillment integrated
- Shipping costs calculated
- Quality control included

---

## 🛍️ SHOPIFY SETUP

### Step 1: Create Custom App
1. Go to your **Shopify Admin**
2. Navigate to **Apps** → **"Develop apps"**
3. Click **"Create an app"**
4. Name it "Beezio Integration"

### Step 2: Configure API Access
1. Click **"Configure Admin API scopes"**
2. Enable these permissions:
   - ✅ `read_products`
   - ✅ `read_inventory`
   - ✅ `read_orders` (optional)
3. Click **"Save"**

### Step 3: Get Access Token
1. Click **"Install app"**
2. Copy the **Admin API access token** (starts with `shpat_...`)
3. Also note your **Shop URL** (e.g., `yourstore.myshopify.com`)

### Step 4: Connect to Beezio
1. Beezio → **API Integrations** → **Shopify** → **"Connect"**
2. Enter both:
   - API Key (access token)
   - Store URL
3. Click **"Connect"**

---

## 🎨 ETSY SETUP

### Step 1: Create Etsy App
1. Go to [Etsy Developer Portal](https://www.etsy.com/developers/your-apps)
2. Click **"Create a New App"**
3. Fill in app details:
   - App Name: "Beezio Integration"
   - Description: "Product sync for Beezio marketplace"

### Step 2: Get API Key
1. Once app is created, copy your **Keystring** (API Key)
2. Save it securely

### Step 3: Connect to Beezio
1. Beezio → **API Integrations** → **Etsy** → **"Connect"**
2. Paste your Keystring
3. Click **"Connect"**

**What's Imported:**
- All active listings
- Product photos
- Descriptions and tags
- Pricing and inventory
- Shipping profiles

---

## 🏪 WOOCOMMERCE SETUP

### Step 1: Generate API Keys
1. WordPress Admin → **WooCommerce** → **Settings**
2. Go to **Advanced** → **REST API**
3. Click **"Add Key"**
4. Configure:
   - Description: "Beezio Integration"
   - User: Your admin user
   - Permissions: **Read**
5. Click **"Generate API Key"**

### Step 2: Save Credentials
Copy and save:
- Consumer Key (starts with `ck_...`)
- Consumer Secret (starts with `cs_...`)

### Step 3: Connect to Beezio
1. Enter both Consumer Key and Secret in Beezio
2. Add your WordPress site URL
3. Connect and import

---

## 📊 CSV IMPORT (For Any Platform)

### Step 1: Prepare Your CSV
Download our template: [CSV Template](link-to-template)

**Required Columns:**
```
title, description, price, images, category, quantity, sku
```

**Example Row:**
```
"Premium T-Shirt", "High quality cotton tee", 24.99, "https://image1.jpg|https://image2.jpg", "Clothing", 100, "TEE-001"
```

### Step 2: Upload
1. Go to **API Integrations** → **CSV Import**
2. Click **"Choose File"**
3. Select your CSV file
4. Map columns if needed
5. Click **"Import"**

### Step 3: Review
- Products are imported with status: "Draft"
- Review each product
- Activate when ready

---

## ⚙️ COMMON SETTINGS

### Commission Rates
Set affiliate commission percentage (5-50%)
- **Default:** 25%
- **Recommended for Print-on-Demand:** 20-30%
- **Recommended for Physical Products:** 10-20%

### Auto-Sync
Enable automatic inventory sync:
- **Hourly:** Check for updates every hour
- **Daily:** Once per day at midnight
- **Real-time:** Instant updates (webhook required)
- **Manual:** Import only when you click sync

### Import Filters
Choose what to import:
- ✅ All products
- ⬜ Only specific categories
- ⬜ Only products above certain price
- ⬜ Only in-stock items

---

## 🔧 TROUBLESHOOTING

### "Connection Failed"
**Causes:**
- Invalid API key
- Expired credentials
- Wrong store URL
- Insufficient permissions

**Fix:**
1. Verify your API key is correct
2. Check API key hasn't expired
3. Ensure all required permissions are enabled
4. Try disconnecting and reconnecting

### "No Products Found"
**Causes:**
- Store has no products
- Products are in draft status
- API permission doesn't include product access

**Fix:**
1. Verify you have active products
2. Check product visibility settings
3. Ensure "read_products" permission is enabled

### "Import Stuck"
**Fix:**
1. Refresh the page
2. Check your internet connection
3. Try importing smaller batches
4. Contact support if issue persists

---

## 📞 NEED HELP?

### Support Channels
- **Email:** support@beezio.co
- **Live Chat:** Available in dashboard
- **Documentation:** https://docs.beezio.co
- **Video Tutorials:** https://youtube.com/beezio

### Common Questions
**Q: How often does auto-sync run?**
A: Based on your setting (hourly/daily/real-time)

**Q: Will this duplicate my products?**
A: No, we track external IDs to prevent duplicates

**Q: Can I edit imported products?**
A: Yes! Edit freely in your Beezio dashboard

**Q: What happens if I disconnect?**
A: Products remain but won't sync updates

**Q: Are my API keys secure?**
A: Yes, encrypted and never shared

---

## 🎯 BEST PRACTICES

### 1. Start Small
- Import 10-20 products first
- Verify everything looks correct
- Then import full catalog

### 2. Set Realistic Commissions
- Too high = Less profit for you
- Too low = Harder to attract affiliates
- Sweet spot: 20-30% for POD, 10-20% for physical

### 3. Enable Auto-Sync
- Keeps inventory accurate
- Prevents overselling
- Updates pricing automatically

### 4. Organize Categories
- Use consistent category names
- Map to Beezio categories
- Makes products easier to find

### 5. Optimize Product Data
- Write SEO-friendly titles
- Include detailed descriptions
- Use high-quality images
- Add relevant tags

---

## 🚀 NEXT STEPS

After importing products:

1. **Review Products**
   - Check all details imported correctly
   - Adjust pricing if needed
   - Verify images loaded

2. **Activate Products**
   - Change status from draft to active
   - Set affiliate commission rates
   - Enable in your store

3. **Promote Your Store**
   - Share your store URL
   - Recruit affiliates
   - Add products to marketplace

4. **Monitor Performance**
   - Track sales in dashboard
   - Review sync logs
   - Adjust commissions as needed

---

## 📋 PLATFORM COMPARISON

| Platform | Setup Time | Product Import | Auto-Sync | Best For |
|----------|-----------|----------------|-----------|----------|
| Printify | 5 min | ⚡ Instant | ✅ Yes | POD Products |
| Printful | 5 min | ⚡ Instant | ✅ Yes | POD + Quality Focus |
| Shopify | 10 min | ⚡ Fast | ✅ Yes | Existing Stores |
| Etsy | 8 min | ⚡ Fast | ✅ Yes | Handmade/Vintage |
| WooCommerce | 10 min | ⚡ Fast | ✅ Yes | WordPress Sites |
| CSV Import | 2 min | 📊 Manual | ❌ No | Any Platform |

---

## ✅ SUCCESS CHECKLIST

- [ ] Connected at least one platform
- [ ] Imported first batch of products
- [ ] Verified product details are correct
- [ ] Set commission rates
- [ ] Enabled auto-sync
- [ ] Activated products in store
- [ ] Tested product pages
- [ ] Shared store with affiliates
- [ ] Monitored first sales
- [ ] Optimized based on performance

---

**Last Updated:** October 19, 2025
**Version:** 1.0
**Support:** support@beezio.co
