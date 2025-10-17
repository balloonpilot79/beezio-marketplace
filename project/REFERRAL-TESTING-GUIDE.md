# 🧪 Referral Program Testing Guide

## Overview
Complete step-by-step guide to test the 2-tier referral program end-to-end.

---

## ✅ Pre-Test Checklist

### Database Setup
- [ ] SQL script executed successfully in Supabase
- [ ] Tables created: `affiliate_referrals`, `referral_commissions`
- [ ] Columns added to `users`: `referral_code`, `referred_by_code`
- [ ] Function created: `generate_referral_code_flexible()`
- [ ] Trigger created: `trigger_auto_generate_referral_code`
- [ ] RLS enabled on new tables

### Code Deployment
- [ ] Frontend deployed with updated SignUpPage
- [ ] ReferralDashboard component deployed
- [ ] ReferredAffiliatesList component deployed
- [ ] AffiliateDashboardPage updated with new components
- [ ] Edge Function updated with referral commission logic

### Verify Tables
```sql
-- Check tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_name IN ('affiliate_referrals', 'referral_commissions');

-- Check columns exist
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'users' 
AND column_name IN ('referral_code', 'referred_by_code');
```

---

## 🧪 Test Case 1: Referral Code Generation

### Step 1: Create Test Affiliate
1. Go to `/signup`
2. Select role: **Affiliate**
3. Enter email: `test.affiliate.a@example.com`
4. Complete signup

### Step 2: Verify Code Created
**SQL Query:**
```sql
SELECT id, email, referral_code, current_role 
FROM users 
WHERE email = 'test.affiliate.a@example.com';
```

**Expected Result:**
- `referral_code` should be populated
- Format: 4 uppercase letters + 4 alphanumeric (e.g., `TEST4X9Z`)
- Code is unique

### Step 3: Check Dashboard
1. Login as test affiliate A
2. Go to affiliate dashboard
3. Scroll to "Referral Program" section

**Expected:**
- Referral code displayed
- Copy link button visible
- Stats show: 0 referrals, $0 earnings

### ✅ Pass Criteria
- [ ] Referral code auto-generated
- [ ] Code follows format (NAME4X9Z)
- [ ] Code is unique
- [ ] Dashboard displays code correctly

---

## 🧪 Test Case 2: Referral Signup Flow

### Step 1: Get Referral Link
1. Login as affiliate A
2. Copy referral link from dashboard
3. Should be: `https://beezio.co/signup?ref=TEST4X9Z`

### Step 2: Use Referral Link
1. Open incognito/private browser
2. Paste referral link
3. Navigate to signup page

**Expected:**
- Yellow banner appears: "You've been referred!"
- Shows: "test invited you to join"
- Shows code: `TEST4X9Z`
- Role auto-selected to "Affiliate"

### Step 3: Complete Signup
1. Enter email: `test.affiliate.b@example.com`
2. Enter password and other details
3. Submit form

### Step 4: Verify Database
**SQL Query:**
```sql
-- Check referred user
SELECT id, email, referral_code, referred_by_code 
FROM users 
WHERE email = 'test.affiliate.b@example.com';

-- Check referral relationship
SELECT referrer_id, referred_id, referral_code, status
FROM affiliate_referrals
WHERE referral_code = 'TEST4X9Z';
```

**Expected Result:**
- User B has `referred_by_code = 'TEST4X9Z'`
- User B has own `referral_code` generated
- `affiliate_referrals` record exists
- `referrer_id` = User A's ID
- `referred_id` = User B's ID
- `status = 'active'`

### ✅ Pass Criteria
- [ ] Referral banner shows on signup page
- [ ] referred_by_code stored in users table
- [ ] affiliate_referrals record created
- [ ] Referrer sees +1 in "Total Referrals" stat

---

## 🧪 Test Case 3: Referral Commission Calculation

### Step 1: Upload Product (Affiliate B)
1. Login as affiliate B
2. Upload a product:
   - Title: "Test Product"
   - Seller desired amount: $70
   - Affiliate commission: 20%
   - Affiliate ID: Affiliate B's ID

### Step 2: Make Test Purchase
1. Open buyer account or create new buyer
2. Add product to cart
3. Proceed to checkout
4. Complete payment with test card: `4242 4242 4242 4242`

### Step 3: Verify Commission Calculation

**SQL Query:**
```sql
-- Get the order
SELECT id, total_amount, status 
FROM orders 
WHERE status = 'completed' 
ORDER BY created_at DESC 
LIMIT 1;

-- Check referral commission
SELECT 
  referrer_id,
  referred_affiliate_id,
  order_id,
  sale_amount,
  commission_amount,
  commission_rate,
  status
FROM referral_commissions
WHERE order_id = '[ORDER_ID]';

-- Check updated totals
SELECT 
  referrer_id,
  referred_id,
  total_sales,
  total_commission
FROM affiliate_referrals
WHERE referred_id = '[AFFILIATE_B_ID]';
```

**Expected Result:**

**Sale Details:**
- Product price: $70 (seller desired)
- Customer paid: ~$95.83 (includes affiliate, stripe, platform fees)

**Commission Breakdown:**
- Seller: $70.00
- Product Affiliate (B): $14.00 (20%)
- Referring Affiliate (A): $1.92 (2% of $95.83)
- Stripe: $3.12 (3% + $0.60)
- Beezio: $6.79 (8% - reduced from 10%)

**Database Records:**
- `referral_commissions` record created
- `commission_amount = 1.92` (2% of sale)
- `commission_rate = 2.00`
- `status = 'pending'`
- `affiliate_referrals.total_sales` increased by $95.83
- `affiliate_referrals.total_commission` increased by $1.92

### ✅ Pass Criteria
- [ ] referral_commissions record created
- [ ] 2% commission calculated correctly
- [ ] Platform fee reduced from 10% to 8%
- [ ] affiliate_referrals totals updated
- [ ] Referrer sees $1.92 in "Pending Earnings"

---

## 🧪 Test Case 4: Dashboard Display

### Step 1: Check Affiliate A Dashboard
1. Login as affiliate A
2. Go to affiliate dashboard
3. Scroll to "Referral Program"

**Expected Stats:**
- Total Referrals: 1
- Active Referrals: 1
- Total Earnings: $0.00
- Pending Earnings: $1.92

### Step 2: Check Referred Affiliates List
Scroll down to "Your Referrals" section

**Expected Table:**
| Affiliate | Status | Total Sales | Your Commission | Joined |
|-----------|--------|-------------|-----------------|--------|
| test.affiliate.b@example.com | Active | $95.83 | $1.92 | [Date] |

### Step 3: Verify Summary
At bottom of referrals list:
- Total Referrals: 1
- Total Sales Generated: $95.83
- Total Commission Earned: $1.92

### ✅ Pass Criteria
- [ ] All stats display correctly
- [ ] Referred affiliate shown in list
- [ ] Sales and commission amounts accurate
- [ ] Summary totals match

---

## 🧪 Test Case 5: Multiple Referrals

### Goal: Test with 3 referrals making different amounts

### Step 1: Create 2 More Referrals
Repeat Test Case 2 with:
- `test.affiliate.c@example.com` (using A's link)
- `test.affiliate.d@example.com` (using A's link)

### Step 2: Make Sales
- Affiliate B sells: $100
- Affiliate C sells: $200
- Affiliate D sells: $50

### Step 3: Verify Totals
**SQL Query:**
```sql
SELECT 
  u.email,
  ar.total_sales,
  ar.total_commission,
  ar.status
FROM affiliate_referrals ar
JOIN users u ON ar.referred_id = u.id
WHERE ar.referrer_id = '[AFFILIATE_A_ID]'
ORDER BY ar.created_at;
```

**Expected:**
- Total Referrals: 3
- Total Sales: $350
- Total Commission: $7.00 (2% of $350)
- All showing as "Active"

### ✅ Pass Criteria
- [ ] All 3 referrals tracked
- [ ] Individual commissions calculated correctly
- [ ] Running totals accurate
- [ ] Dashboard shows all 3 in list

---

## 🧪 Test Case 6: Invalid Referral Code

### Step 1: Use Invalid Code
1. Go to `/signup?ref=INVALID999`

**Expected:**
- Red error banner: "Invalid or expired referral code"
- User can still sign up normally
- No referral relationship created

### Step 2: Verify Database
**SQL Query:**
```sql
SELECT * FROM affiliate_referrals 
WHERE referral_code = 'INVALID999';
```

**Expected:** No records

### ✅ Pass Criteria
- [ ] Error message shows for invalid code
- [ ] Signup still works
- [ ] No referral record created

---

## 🧪 Test Case 7: Copy Link Functionality

### Step 1: Test Copy Button
1. Login as affiliate A
2. Go to referral dashboard
3. Click "Copy Link" button

**Expected:**
- Button changes to "Copied!" with green background
- Link copied to clipboard
- Reverts to "Copy Link" after 2 seconds

### Step 2: Paste and Verify
1. Open new tab
2. Paste (Ctrl+V)

**Expected:**
- Full URL pasted: `https://beezio.co/signup?ref=TEST4X9Z`
- URL is valid and navigable

### ✅ Pass Criteria
- [ ] Copy button works
- [ ] Visual feedback shown
- [ ] Correct URL copied
- [ ] URL contains referral code

---

## 🧪 Test Case 8: Chain Referrals (2-Tier Limit)

### Goal: Verify only 2 tiers work (no 3rd tier)

### Step 1: Create Chain
- Affiliate A refers Affiliate B (✅ B referred by A)
- Affiliate B refers Affiliate C (✅ C referred by B)
- Affiliate C makes a sale

### Step 2: Verify Commissions
**SQL Query:**
```sql
-- Check who gets commission from C's sale
SELECT 
  referrer_id,
  referred_affiliate_id,
  sale_amount,
  commission_amount
FROM referral_commissions
WHERE referred_affiliate_id = '[AFFILIATE_C_ID]';
```

**Expected:**
- Affiliate B gets 2% commission (✅)
- Affiliate A gets NO commission (✅ - only 2 tiers)

### ✅ Pass Criteria
- [ ] B earns commission from C's sales
- [ ] A does NOT earn from C's sales
- [ ] Only 2-tier commission enforced

---

## 🧪 Test Case 9: RLS Security

### Goal: Verify users can only see their own referrals

### Step 1: Test as Affiliate A
**SQL Query (run as A):**
```sql
SELECT * FROM affiliate_referrals;
```

**Expected:**
- Only sees referrals where `referrer_id = A's ID`
- Cannot see other affiliates' referrals

### Step 2: Test as Affiliate B
**SQL Query (run as B):**
```sql
SELECT * FROM affiliate_referrals;
```

**Expected:**
- Sees where `referrer_id = B's ID` (their recruits)
- Sees where `referred_id = B's ID` (who referred them)

### ✅ Pass Criteria
- [ ] RLS policies enforced
- [ ] Users only see own data
- [ ] No unauthorized access

---

## 📊 Performance Tests

### Test 1: Large Number of Referrals
- Create 100 referrals under one affiliate
- Check dashboard load time
- **Target:** < 2 seconds

### Test 2: Concurrent Signups
- 10 users signup with same referral code simultaneously
- Verify all 10 relationships created
- No duplicate code errors

### Test 3: High Volume Sales
- 1000 sales with referral commissions
- Verify all commissions calculated
- Check database performance

---

## 🐛 Common Issues & Solutions

### Issue: Referral code not generated
**Solution:**
```sql
-- Manually trigger code generation
UPDATE users 
SET referral_code = generate_referral_code_flexible(id, email)
WHERE current_role = 'affiliate' AND referral_code IS NULL;
```

### Issue: Commission not calculated
**Check:**
1. Is affiliate_referrals record active?
2. Is order completion function deployed?
3. Check Edge Function logs

### Issue: Dashboard shows wrong stats
**Solution:**
```sql
-- Recalculate totals
UPDATE affiliate_referrals ar
SET 
  total_sales = (
    SELECT COALESCE(SUM(sale_amount), 0)
    FROM referral_commissions
    WHERE referrer_id = ar.referrer_id
    AND referred_affiliate_id = ar.referred_id
  ),
  total_commission = (
    SELECT COALESCE(SUM(commission_amount), 0)
    FROM referral_commissions
    WHERE referrer_id = ar.referrer_id
    AND referred_affiliate_id = ar.referred_id
  );
```

---

## ✅ Final Checklist

### Functionality
- [ ] Referral codes auto-generate
- [ ] Signup with ?ref parameter works
- [ ] Referral relationships created
- [ ] 2% commissions calculated
- [ ] Platform fee reduced to 8%
- [ ] Dashboard displays correctly
- [ ] Copy button works
- [ ] Invalid codes handled gracefully

### Database
- [ ] Tables created
- [ ] Columns added
- [ ] Functions working
- [ ] Triggers firing
- [ ] RLS policies enforced
- [ ] Indexes created

### UI/UX
- [ ] Referral banner looks good
- [ ] Dashboard stats accurate
- [ ] Table displays properly
- [ ] Copy button has feedback
- [ ] Mobile responsive
- [ ] Loading states work

### Security
- [ ] RLS protects data
- [ ] No SQL injection vulnerabilities
- [ ] Referral codes validated
- [ ] Commission calculations secure

### Performance
- [ ] Dashboard loads quickly
- [ ] Queries optimized
- [ ] Indexes used
- [ ] No N+1 queries

---

## 📝 Test Report Template

```
# Referral Program Test Report
Date: [DATE]
Tester: [NAME]
Environment: [Production/Staging/Dev]

## Results
✅ Test Case 1: Referral Code Generation - PASS
✅ Test Case 2: Referral Signup Flow - PASS
✅ Test Case 3: Referral Commission Calculation - PASS
✅ Test Case 4: Dashboard Display - PASS
✅ Test Case 5: Multiple Referrals - PASS
✅ Test Case 6: Invalid Referral Code - PASS
✅ Test Case 7: Copy Link Functionality - PASS
✅ Test Case 8: Chain Referrals - PASS
✅ Test Case 9: RLS Security - PASS

## Issues Found
[List any issues discovered]

## Notes
[Any additional observations]

## Recommendation
[Ready for production / Needs fixes / etc.]
```

---

**🎯 Once all tests pass, your referral program is ready for launch!**
