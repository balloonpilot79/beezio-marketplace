# Complete Product Lifecycle Test Guide
## Upload → List → Buy → Payment Split → Shipping

This guide walks you through testing the ENTIRE product flow from seller upload to buyer receipt.

---

## 🎯 **What We're Testing:**

1. ✅ Seller uploads product with images
2. ✅ Product appears in marketplace
3. ✅ Buyer can find and view product
4. ✅ Buyer can add to cart and checkout
5. ✅ Payment is processed correctly
6. ✅ Money is split correctly (Seller + Affiliate + Beezio + Stripe)
7. ✅ Seller sees order and can fulfill
8. ✅ Buyer gets shipping confirmation

---

## 📋 **Phase 1: Product Upload (Seller)**

### Step 1: Log in as Seller
1. Go to https://beezio.co
2. Click "Sign In"
3. Log in with seller account OR create new seller account

### Step 2: Create Product
1. Navigate to **Seller Dashboard**
2. Click **"Add New Product"** or **"Create Product"**
3. Fill in product details:
   - **Title:** "Test Product - Premium Widget"
   - **Description:** "High quality widget with premium features"
   - **Category:** Select from dropdown (should have 16 options)
   - **Your Desired Amount:** $50.00 (what YOU want to receive)
   
4. **Upload Images:**
   - Click image upload area
   - Select 1-5 product images
   - Should upload without "policy violation" errors ✅
   - See image thumbnails appear

5. **Set Shipping Options:**
   - Standard Shipping: $5.00 (3-5 days)
   - Express Shipping: $15.00 (1-2 days)
   - Free Shipping: $0.00 (5-7 days)

6. **Review Pricing Breakdown:**
   - Your amount: $50.00
   - Affiliate commission: $10.00 (20% of your $50)
   - Stripe fee: $1.80
   - Beezio platform fee: $6.18
   - **Customer sees: $68.00**

7. Click **"Create Product"**

### Expected Results:
- ✅ Success message appears
- ✅ Product appears in your seller dashboard
- ✅ Images are visible
- ✅ Pricing is calculated correctly

---

## 📋 **Phase 2: Product Discovery (Public/Buyer)**

### Step 3: View Product in Marketplace
1. Open new **incognito/private window**
2. Go to https://beezio.co
3. Browse marketplace or search for your product
4. Find "Test Product - Premium Widget"

### Step 4: View Product Details
1. Click on your product
2. Verify:
   - ✅ Images load correctly
   - ✅ Title and description display
   - ✅ Price shows **$68.00** (not your $50)
   - ✅ Shipping options visible
   - ✅ "Add to Cart" button works

---

## 📋 **Phase 3: Purchase Flow (Buyer)**

### Step 5: Log in as Buyer
1. Click **"Sign In"** (or Sign Up if new buyer)
2. Create/use buyer account
3. Navigate back to the product

### Step 6: Add to Cart
1. Select quantity (1)
2. Select shipping option (Standard - $5.00)
3. Click **"Add to Cart"**
4. Click cart icon (should show 1 item)

### Step 7: Checkout
1. Click **"Proceed to Checkout"**
3. Verify cart summary:
   - Product: $68.00
   - Shipping: $5.00
   - Tax: $4.76 (7% of product only, not shipping)
   - **Total: $77.76**

3. Enter shipping address:
   - Name
   - Address
   - City, State, ZIP
   - Email
   - Phone

4. Enter payment (use test card):
   ```
   Card Number: 4242 4242 4242 4242
   Exp: 12/34
   CVC: 123
   ZIP: 12345
   ```

5. Click **"Place Order"**

### Expected Results:
- ✅ Payment processes successfully
- ✅ Order confirmation appears
- ✅ Redirected to order success page
- ✅ Order number displayed

---

## 📋 **Phase 4: Payment Distribution (Backend)**

### Step 8: Verify Payment Split (Database Check)

Go to **Supabase Dashboard → SQL Editor** and run:

```sql
-- Check the most recent order
SELECT 
    o.id as order_id,
    o.total_amount as customer_paid,
    o.status,
    o.created_at,
    oi.product_id,
    oi.price as item_price,
    oi.quantity,
    oi.seller_amount,
    oi.affiliate_commission,
    oi.platform_fee,
    oi.stripe_fee
FROM orders o
JOIN order_items oi ON oi.order_id = o.id
ORDER BY o.created_at DESC
LIMIT 1;
```

### Expected Results:
```
customer_paid: $77.76 (product + shipping + tax)
seller_amount: $50.00 (exactly what you wanted)
affiliate_commission: $10.00 (20% of seller amount)
stripe_fee: $1.80 (3% of $60 + $0.60)
platform_fee: $6.18 (10% of $61.80)
tax: $4.76 (7% of product, held for state remittance)
```

**Verification Math:**
- Seller: $50.00 ✅
- Affiliate: $10.00 ✅
- Stripe: $1.80 ✅
- Beezio: $6.18 ✅
- Subtotal: $68.00 ✅
- Shipping: $5.00 ✅
- Tax: $4.76 ✅ (7% of $68 only, NOT shipping)
- **Total: $77.76** ✅

---

## 📋 **Phase 5: Order Fulfillment (Seller)**

### Step 9: Seller Views Order
1. Log back in as **seller**
2. Go to **Seller Dashboard**
3. Click **"Orders"** tab
4. See the new order:
   - Order #
   - Buyer name
   - Product
   - Amount you'll receive: **$50.00**
   - Shipping address
   - Status: "Pending Fulfillment"

### Step 10: Mark as Shipped
1. Click on the order
2. Enter tracking information:
   - Carrier: USPS/UPS/FedEx
   - Tracking #: 1234567890
3. Click **"Mark as Shipped"**

### Expected Results:
- ✅ Order status changes to "Shipped"
- ✅ Buyer receives shipping notification email
- ✅ You can see your earnings: $50.00

---

## 📋 **Phase 6: Buyer Receives Order**

### Step 11: Buyer Tracks Shipment
1. Log in as **buyer**
2. Go to **"My Orders"**
3. See order with:
   - Status: "Shipped"
   - Tracking number: 1234567890
   - Carrier: [selected carrier]
   - Estimated delivery date

### Step 12: Mark as Delivered (Optional)
1. Once buyer receives item
2. Click **"Mark as Delivered"**
3. Option to leave review

---

## 📋 **Phase 7: Payout Verification**

### Step 13: Check Seller Payout (Database)

```sql
-- Check seller payouts
SELECT 
    seller_id,
    order_id,
    amount,
    status,
    created_at
FROM seller_payouts
ORDER BY created_at DESC
LIMIT 5;
```

### Expected Results:
- ✅ Payout record created for seller
- ✅ Amount: $50.00 (exactly what you wanted)
- ✅ Status: "pending" (will be paid on schedule)

### Step 14: Check Affiliate Commission (if applicable)

```sql
-- Check affiliate commissions
SELECT 
    affiliate_id,
    order_id,
    commission_amount,
    status,
    created_at
FROM affiliate_commissions
ORDER BY created_at DESC
LIMIT 5;
```

### Expected Results:
- ✅ Commission record created
- ✅ Amount: $10.00 (20% of $50)
- ✅ Status: "pending"

### Step 15: Check Platform Revenue (Beezio)

```sql
-- Check platform fee collection
SELECT 
    SUM(platform_fee) as total_beezio_revenue,
    COUNT(*) as order_count
FROM order_items
WHERE created_at > NOW() - INTERVAL '24 hours';
```

### Expected Results:
- ✅ Platform fee collected: $6.18
- ✅ This goes to Beezio operations

---

## ✅ **Complete Checklist**

Use this checklist to verify everything works:

- [ ] **Product Upload**
  - [ ] Images upload without policy violations
  - [ ] Category dropdown works
  - [ ] Pricing calculator shows correct amounts
  - [ ] Product saves successfully

- [ ] **Product Listing**
  - [ ] Product appears in marketplace
  - [ ] Images display correctly
  - [ ] Price shows customer-facing amount
  - [ ] Shipping options visible

- [ ] **Purchase Flow**
  - [ ] Add to cart works
  - [ ] Cart shows correct totals
  - [ ] Checkout processes payment
  - [ ] Order confirmation appears

- [ ] **Payment Distribution**
  - [ ] Seller gets exact desired amount ($50)
  - [ ] Affiliate gets 20% commission ($10)
  - [ ] Stripe gets processing fee ($1.80)
  - [ ] Beezio gets 10% platform fee ($6.18)
  - [ ] Customer pays correct total ($78.11 with shipping/tax)

- [ ] **Order Fulfillment**
  - [ ] Seller sees order in dashboard
  - [ ] Shipping address provided
  - [ ] Can mark as shipped
  - [ ] Buyer receives notification

- [ ] **Buyer Experience**
  - [ ] Can track order
  - [ ] Sees shipping status
  - [ ] Can leave review
  - [ ] Order history accessible

---

## 🐛 **Common Issues & Solutions**

### Issue: Images won't upload
**Solution:** Storage bucket policies fixed ✅ Should work now

### Issue: Category dropdown empty
**Solution:** Categories table populated ✅ Should show 16 categories

### Issue: Payment fails
**Solution:** Check Stripe keys are set in Netlify environment variables

### Issue: Wrong payment amounts
**Solution:** Verify pricing calculation in ProductForm uses new formula

### Issue: Order doesn't appear in seller dashboard
**Solution:** Check RLS policies - seller should see orders for their products ✅

### Issue: Buyer can't see order
**Solution:** Check RLS policies - buyer should see their own orders ✅

---

## 📊 **Expected Payment Flow**

```
Customer Pays: $78.11
├── Product Price: $68.00
│   ├── Seller Gets: $50.00 ✅ (Your desired amount)
│   ├── Affiliate Gets: $10.00 ✅ (20% commission)
│   ├── Stripe Fee: $1.80 ✅ (3% + $0.60)
│   └── Beezio Fee: $6.18 ✅ (10% platform fee)
├── Shipping: $5.00 → Goes to seller for shipping costs
└── Tax: $5.11 → Goes to platform for tax remittance
```

---

## 🎉 **Success Criteria**

All of these should be TRUE:

1. ✅ Seller can upload product with images
2. ✅ Product appears publicly with correct price
3. ✅ Buyer can complete purchase
4. ✅ Payment is processed successfully
5. ✅ Seller receives **exact** desired amount ($50)
6. ✅ Affiliate receives correct commission ($10)
7. ✅ Beezio receives platform fee ($6.18)
8. ✅ Stripe receives processing fee ($1.80)
9. ✅ Seller can fulfill order with tracking
10. ✅ Buyer receives order confirmation and tracking

---

## 🚀 **Next Steps After Testing**

If all tests pass:
- ✅ System is ready for real products
- ✅ System is ready for real transactions
- ✅ Payment splits are working correctly
- ✅ You can launch to real customers

If any tests fail:
- ❌ Document the specific failure
- ❌ Check error messages
- ❌ Review database logs
- ❌ Let me know and I'll help fix it

---

**Start testing now and let me know the results at each phase!** 🎯
