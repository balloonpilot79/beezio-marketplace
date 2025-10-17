# Affiliate Referral Program - Quick Start Guide

## 🎯 What This Does

Creates a **2-tier affiliate program** where existing affiliates can recruit new affiliates and earn **2% of Beezio's platform fee** from all their referrals' sales.

---

## 💰 How It Works

### Example Scenario:

**John (existing affiliate)** gets referral link:
```
https://beezio.co/signup?ref=JOHN4X9Z
```

**Sarah (new person)** clicks John's link and signs up as affiliate

**Sarah promotes products** and makes a $100 sale:

**Standard Split (No Referral):**
- Seller: $70.00
- Product Affiliate (Sarah): $14.00 (20%)
- Stripe: $2.52
- **Beezio: $8.48 (10%)** ✅

**With Referral Split:**
- Seller: $70.00
- Product Affiliate (Sarah): $14.00 (20%)
- **Referring Affiliate (John): $2.00 (2%)** ✅ NEW!
- Stripe: $2.52
- **Beezio: $6.48 (8%)** ✅ (reduced by 2%)

**Result:** John earns $2 from every $100 sale Sarah makes, forever!

---

## 📊 Earnings Potential

### If John refers 3 affiliates:

| Affiliate | Monthly Sales | John's 2% |
|-----------|--------------|-----------|
| Sarah | $10,000 | $200 |
| Mike | $5,000 | $100 |
| Lisa | $8,000 | $160 |
| **TOTAL** | **$23,000** | **$460/month** 🎉 |

**That's $5,520/year passive income just from referrals!**

---

## 🔧 Setup Instructions

### Step 1: Run Database Script

1. Go to **Supabase Dashboard → SQL Editor**
2. Click **"New query"**
3. Copy **entire contents** of `setup-referral-program-database.sql`
4. Paste and click **"Run"**

This creates:
- ✅ Referral code column for each affiliate
- ✅ `affiliate_referrals` table (tracks who referred who)
- ✅ `referral_commissions` table (tracks 2% earnings)
- ✅ Auto-generates unique codes for existing affiliates
- ✅ RLS policies for security

### Step 2: Verify Setup

After running, check these queries show results:

```sql
-- See all affiliate referral codes
SELECT full_name, email, referral_code
FROM users
WHERE current_role = 'affiliate'
LIMIT 10;
```

Expected: Each affiliate has a unique code like `JOHN4X9Z`

```sql
-- Check tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_name IN ('affiliate_referrals', 'referral_commissions');
```

Expected: Both tables listed

---

## 🎨 What Gets Built (Frontend)

### 1. Affiliate Dashboard - New Card
```
┌────────────────────────────────────────────┐
│ 📢 Refer Affiliates & Earn 2%             │
├────────────────────────────────────────────┤
│ Your Referral Link:                        │
│ https://beezio.co/signup?ref=JOHN4X9Z      │
│ [Copy Link] [Share on Twitter] [Email]    │
├────────────────────────────────────────────┤
│ You've referred: 3 affiliates              │
│ Total referral earnings: $460.00           │
│ Pending: $120.00 | Paid: $340.00          │
└────────────────────────────────────────────┘
```

### 2. Referred Affiliates List
```
┌────────────────────────────────────────────┐
│ Your Referrals (3)                         │
├────────────────────────────────────────────┤
│ Sarah Johnson                              │
│ └─ Joined: Oct 1, 2025                    │
│ └─ Their Sales: $10,000                   │
│ └─ Your Earnings: $200.00                 │
├────────────────────────────────────────────┤
│ Mike Davis                                 │
│ └─ Joined: Oct 5, 2025                    │
│ └─ Their Sales: $5,000                    │
│ └─ Your Earnings: $100.00                 │
├────────────────────────────────────────────┤
│ Lisa Chen                                  │
│ └─ Joined: Oct 10, 2025                   │
│ └─ Their Sales: $8,000                    │
│ └─ Your Earnings: $160.00                 │
└────────────────────────────────────────────┘
```

### 3. Signup Page Enhancement
When someone visits `?ref=JOHN4X9Z`:
```
┌────────────────────────────────────────────┐
│ Join Beezio Affiliate Program              │
├────────────────────────────────────────────┤
│ ✅ You're signing up with a referral from: │
│    John Smith (@JOHN4X9Z)                  │
│                                            │
│ [Continue to Sign Up]                      │
└────────────────────────────────────────────┘
```

---

## 💻 Code Changes Needed

### 1. Update Order Completion Function
File: `supabase/functions/complete-order-corrected/index.ts`

Add after line 90:
```typescript
// Check if product affiliate was referred by someone
const { data: referralData } = await supabase
  .from('affiliate_referrals')
  .select('referrer_id')
  .eq('referred_id', item.affiliateId)
  .eq('status', 'active')
  .single();

if (referralData) {
  // Calculate 2% referral commission
  const referralCommission = totalListingPrice * 0.02;
  
  // Reduce platform fee by 2%
  platformFee = platformFee - referralCommission;
  
  // Create referral commission record
  await supabase
    .from('referral_commissions')
    .insert({
      referrer_id: referralData.referrer_id,
      referred_affiliate_id: item.affiliateId,
      order_id: orderId,
      sale_amount: totalListingPrice,
      commission_amount: referralCommission,
      status: 'pending'
    });
}
```

### 2. Create Referral Dashboard Component
File: `src/components/ReferralDashboard.tsx` (new file)

```typescript
// Display referral link, stats, and referred affiliates list
// Copy link to clipboard functionality
// Share on social media buttons
```

### 3. Update Signup Page
File: `src/pages/SignUpPage.tsx`

```typescript
// Check for ?ref= parameter in URL
// Validate referral code exists
// Store referred_by_code when creating user
// Show "Referred by" message
```

---

## 🚀 Benefits

### For Referring Affiliates:
- ✅ **Passive income** from all referrals' sales
- ✅ **Lifetime earnings** (as long as referral is active)
- ✅ **Scalable** - refer 10, 50, 100 affiliates
- ✅ **No extra work** after initial referral

### For New Affiliates:
- ✅ **Mentorship** from referring affiliate
- ✅ **Community** support
- ✅ **Same earnings** as any other affiliate
- ✅ **No disadvantage** for being referred

### For Beezio:
- ✅ **Viral growth** - affiliates recruit more affiliates
- ✅ **Reduced marketing costs** - affiliates do the work
- ✅ **Still profitable** - 8% is sustainable
- ✅ **Larger network** = more products promoted

---

## 📈 Growth Projections

### Conservative Scenario:
- 100 current affiliates
- Each refers 2 new affiliates
- **Result: 200 affiliates (100% growth)**

### Aggressive Scenario:
- 100 current affiliates
- Top 20 refer 10 each (200)
- Others refer 1 each (80)
- **Result: 380 affiliates (280% growth)**

### Impact on Revenue:
**Lose:** 2% per referred affiliate's sale  
**Gain:** 280% more affiliates promoting products  
**Net:** Massive increase in total sales volume

---

## ⚠️ Important Notes

### Commission Source:
- 2% comes from **Beezio's 10% platform fee**
- **NOT** from seller or product affiliate
- Beezio accepts 8% instead of 10%

### One-Time Referral:
- Each affiliate can only be referred **once**
- Cannot change referrer later
- Prevents gaming the system

### Active Status:
- Referral must be "active" to earn
- Can deactivate for policy violations
- Protects against abuse

### Payout Schedule:
- Referral commissions paid on same schedule as regular commissions
- Monthly or bi-weekly (configurable)

---

## 🎯 Next Steps

1. **Run database script** (5 minutes)
2. **Test with test accounts** (15 minutes)
3. **Build frontend components** (2-3 days)
4. **Update payment processing** (1 day)
5. **Test end-to-end** (1 day)
6. **Announce to affiliates** (launch!)

---

## 📞 Questions?

This system creates a powerful growth loop:
```
More Affiliates → More Products Promoted → More Sales → More Revenue
       ↑                                                      ↓
       └────────── Affiliates Recruit More ──────────────────┘
```

**Ready to implement? Run the database script first!**
