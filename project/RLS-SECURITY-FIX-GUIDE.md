# RLS Security Fix - Critical Security Issue

## 🚨 Issue Detected

**Table `public.users` is public, but RLS has not been enabled.**

This is a **CRITICAL SECURITY VULNERABILITY** that affects multiple tables in your database. Without Row Level Security (RLS), any authenticated or anonymous user could potentially:
- Read all user data
- Modify other users' profiles
- Access private information
- View all orders, products, and sensitive data

---

## ✅ Solution: Enable RLS on All Tables

I've created SQL scripts to fix this security issue for all critical tables.

---

## 📋 Step-by-Step Fix

### Step 1: Check Current RLS Status

Run this SQL in **Supabase SQL Editor**:

```sql
-- File: check-all-tables-rls.sql
```

This will show you which tables have RLS enabled and which don't.

### Step 2: Fix Users Table (Priority 1)

Run this SQL in **Supabase SQL Editor**:

**Copy the entire contents of:** `fix-users-table-rls.sql`

This will:
- ✅ Enable RLS on `users` table
- ✅ Allow users to view/edit only their own profile
- ✅ Allow public to view seller/affiliate public info
- ✅ Protect sensitive user data

### Step 3: Fix All Tables (Complete Security)

Run this SQL in **Supabase SQL Editor**:

**Copy the entire contents of:** `fix-all-tables-rls-security.sql`

This comprehensive script secures:
1. ✅ **users** - Profile data
2. ✅ **products** - Product listings
3. ✅ **orders** - Order data
4. ✅ **order_items** - Order details
5. ✅ **affiliate_links** - Affiliate tracking
6. ✅ **affiliate_clicks** - Click tracking
7. ✅ **affiliate_commissions** - Commission data
8. ✅ **seller_payouts** - Payout information
9. ✅ **stores** - Custom store pages
10. ✅ **reviews** - Product reviews
11. ✅ **cart_items** - Shopping cart data

---

## 🔒 What RLS Policies Do

### Users Table Policies:
- **Users can view their own profile** - Users see only their own data
- **Users can update their own profile** - Users can only edit themselves
- **Public can view seller/affiliate info** - Store pages work publicly
- **Users can insert their own profile** - Signup creates user record

### Products Table Policies:
- **Anyone can view active products** - Marketplace browsing works
- **Sellers can manage their own products** - Sellers control their listings

### Orders Table Policies:
- **Buyers can view their own orders** - Order history
- **Sellers can view orders for their products** - Fulfillment
- **Buyers can create orders** - Checkout process

### Affiliate Table Policies:
- **Affiliates can view their own data** - Dashboard analytics
- **Public can track clicks** - Affiliate links work
- **Commissions are private** - Only affiliate sees their earnings

---

## ⚠️ Important Notes

### Before Running:
1. **Backup your database** (optional but recommended)
2. **Test in a development environment first** (if available)
3. **Run during low-traffic time** (minimal user impact)

### After Running:
1. **Test all user flows:**
   - Sign up
   - Login
   - View profile
   - Create product (seller)
   - Place order (buyer)
   - View affiliate dashboard

2. **Check for errors:**
   - Open browser console (F12)
   - Look for "permission denied" or "RLS policy" errors
   - Test as different user roles

### If Something Breaks:
If you get permission errors after enabling RLS, you can temporarily disable RLS on a specific table:

```sql
ALTER TABLE public.tablename DISABLE ROW LEVEL SECURITY;
```

Then troubleshoot the policies and re-enable RLS.

---

## 🧪 Verification

After running the comprehensive fix script, run these verification queries:

```sql
-- Verify RLS is enabled
SELECT 
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public'
AND tablename IN ('users', 'products', 'orders', 'affiliate_commissions')
ORDER BY tablename;
```

Expected result: All tables should show `rowsecurity = true`

```sql
-- Verify policies exist
SELECT 
    tablename,
    COUNT(*) as policy_count
FROM pg_policies 
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY policy_count DESC;
```

Expected result: Each table should have 2-5 policies

---

## 📊 Security Status Before vs After

### BEFORE (Current State):
```
❌ users table: PUBLIC, NO RLS
❌ products table: PUBLIC, NO RLS (possibly)
❌ orders table: PUBLIC, NO RLS (possibly)
❌ All user data accessible to anyone
❌ CRITICAL SECURITY VULNERABILITY
```

### AFTER (Fixed State):
```
✅ users table: RLS ENABLED, 4 POLICIES
✅ products table: RLS ENABLED, 5 POLICIES
✅ orders table: RLS ENABLED, 4 POLICIES
✅ All data properly secured
✅ Users can only see their own data
✅ Public can only see intended public data
✅ SECURITY VULNERABILITY RESOLVED
```

---

## 🚀 Action Items

- [ ] Step 1: Run `check-all-tables-rls.sql` to see current status
- [ ] Step 2: Run `fix-users-table-rls.sql` to fix critical users table
- [ ] Step 3: Run `fix-all-tables-rls-security.sql` to fix all tables
- [ ] Step 4: Test signup, login, and profile viewing
- [ ] Step 5: Test seller product creation
- [ ] Step 6: Test buyer order placement
- [ ] Step 7: Test affiliate dashboard
- [ ] Step 8: Verify no permission errors in browser console
- [ ] Step 9: Run verification queries
- [ ] Step 10: Mark security issue as resolved

---

## 💡 Why This Matters

Without RLS:
- Any user could read all user emails, passwords (hashed), and personal data
- Competitors could scrape all your products and prices
- Users could see other users' order history
- Affiliates could see other affiliates' earnings
- **Massive privacy violation and potential legal issues**

With RLS:
- Each user sees only their own data
- Public pages work normally (store browsing, product viewing)
- Sellers manage only their products
- Buyers see only their orders
- Affiliates see only their commissions
- **Proper data privacy and security**

---

## 📞 Need Help?

If you encounter any issues:
1. Check the Supabase logs for specific error messages
2. Test with a new user account to isolate the issue
3. Review the specific policy that's causing problems
4. Adjust the policy's USING or WITH CHECK clause as needed

Let me know after you run these scripts and I'll help verify everything is working correctly!
