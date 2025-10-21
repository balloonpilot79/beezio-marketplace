# 🚀 Referral Commission System - Quick Start

## ✅ What Was Done

### 1. Database Schema Created
**File:** `referral-system-setup.sql`

Created tables:
- `referrals` - Track who referred whom
- `referral_earnings` - Individual commission payments  
- `platform_settings` - Configurable fee rates
- Updated `profiles` - Added referral_code and total_referral_earnings

### 2. Pricing Library Updated
**File:** `src/lib/pricing.ts`

**Fixed:**
- ✅ Stripe fee: Changed from 2.6% + $0.30 to **2.9% + $0.60**
- ✅ Platform fee: Made configurable **10-15%** (was hardcoded 10%)

**Added:**
- ✅ Referral commission tier (2-5%)
- ✅ New constants: MIN/MAX rates for platform and referral
- ✅ Updated interfaces: `PricingBreakdown` and `PricingInput`
- ✅ Updated calculations to include referral layer

### 3. Pricing Calculator Updated
**File:** `src/components/PricingCalculator.tsx`

**Added:**
- ✅ Referral commission input (0-5%)
- ✅ Platform fee input (10-15%)
- ✅ Display referral bonus in breakdown
- ✅ Updated fee descriptions with correct rates

---

## 📋 Next Steps to Activate

### 1. Run SQL in Supabase
```bash
# In Supabase SQL Editor:
# Paste contents of: referral-system-setup.sql
# Click "Run"
```

### 2. Test Pricing Calculator
- Open product creation form
- Enter a price (e.g., $100)
- Set affiliate rate (e.g., 15%)
- Try adjusting referral rate (0-5%)
- Try adjusting platform fee (10-15%)
- Verify breakdown shows all fees correctly

### 3. Deploy Code
```bash
git add .
git commit -m "Add referral commission system with updated pricing"
git push
```

---

## 💰 Example Calculation

**Input:**
- Seller wants: $100
- Affiliate rate: 15%
- Referral rate: 3%
- Platform fee: 10%

**Breakdown:**
```
Seller:       $100.00
Affiliate:    + $15.00  (15% of $100)
Referral:     + $3.45   (3% of $115)
Stripe:       + $4.04   (2.9% of $118.45 + $0.60)
Beezio:       + $12.25  (10% of $122.49)
Tax:          + $8.05   (7% of $115)
---------------------------------
Final Price:  $142.79  ← Buyer pays this
```

**What each party gets:**
- Seller: $100.00 (exactly what they wanted)
- Affiliate: $15.00 (for promoting)
- Referrer: $3.45 (for referring the seller)
- Beezio: $12.25 (platform fee)
- Stripe: $4.04 (payment processing)
- Government: $8.05 (sales tax)

---

## 🔍 How to Test

### Test 1: Basic Calculation
1. Open PricingCalculator
2. Enter listing price: $129.99
3. Affiliate rate: 20%
4. Leave referral at 0%
5. Should show breakdown without referral line

### Test 2: With Referral
1. Same as above
2. Set referral rate: 3%
3. Should show referral commission line
4. Final price should be slightly higher

### Test 3: Adjust Platform Fee
1. Change platform fee from 10% to 15%
2. Breakdown should update immediately
3. Beezio's cut should increase

### Test 4: Database Integration
1. Run SQL file in Supabase
2. Check tables exist:
   - `referrals`
   - `referral_earnings`
   - `platform_settings`
3. Check `profiles` has `referral_code` column
4. Check all functions exist

---

## ⚠️ Important Notes

### Pricing Model: eBay-Style
- Seller enters desired profit
- ALL fees added on top
- Buyer pays the sum of everything
- Seller receives exactly what they entered

### Fee Ranges
- **Beezio Platform:** 10-15% (configurable)
- **Referral Commission:** 2-5% (configurable)
- **Stripe Processing:** 2.9% + $0.60 (fixed by Stripe)
- **Sales Tax:** 7% (estimated, state-dependent)

### Multi-Tier Commissions
1. **Seller** lists product, sets affiliate rate
2. **Affiliate** promotes product, earns commission
3. **Referrer** (if exists) earns 2-5% for referring the seller/affiliate
4. **Beezio** earns 10-15% platform fee
5. **Stripe** processes payment (2.9% + $0.60)

---

## 📝 Files Modified

1. ✅ `referral-system-setup.sql` - NEW database schema
2. ✅ `src/lib/pricing.ts` - Updated calculations
3. ✅ `src/components/PricingCalculator.tsx` - Updated UI
4. ✅ `REFERRAL-COMMISSION-SYSTEM-COMPLETE.md` - Full documentation
5. ✅ `REFERRAL-QUICK-START.md` - This file

---

## 🐛 Troubleshooting

### SQL Errors
- Make sure all previous versions are dropped first
- Run `DROP TABLE IF EXISTS referrals CASCADE;` before re-running
- Check Supabase logs for specific error messages

### UI Not Updating
- Clear browser cache
- Hard refresh (Ctrl+Shift+R)
- Check console for TypeScript errors
- Verify pricing.ts exports are correct

### Wrong Calculations
- Verify Stripe fee shows 2.9% + $0.60
- Verify platform fee is configurable (not hardcoded 10%)
- Check referral is calculating on base amount (seller + affiliate)

---

## ✅ Success Criteria

- [ ] SQL executes without errors
- [ ] All tables visible in Supabase Table Editor
- [ ] PricingCalculator shows referral input
- [ ] Breakdown displays referral commission when > 0%
- [ ] Stripe fee shows 2.9% + $0.60
- [ ] Platform fee is adjustable 10-15%
- [ ] Final price calculation matches example above
- [ ] No TypeScript compilation errors (warnings OK)

---

## 🎯 Status

**COMPLETE AND READY TO DEPLOY**

All code has been updated:
- ✅ Database schema created
- ✅ Pricing calculations updated
- ✅ UI components updated
- ✅ Documentation complete

**Next Action:** Run `referral-system-setup.sql` in Supabase to activate!
