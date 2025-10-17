# Affiliate Referral Program - Design Document

## 🎯 Program Overview

**Goal:** Encourage existing affiliates to recruit new affiliates by giving them 2% of Beezio's platform fee from all sales made by their referrals.

---

## 💰 Commission Structure

### Standard Sale (No Referral):
```
Customer Pays: $100 (product only)
├─ Seller: $70.00 (what they set)
├─ Affiliate: $14.00 (20% of seller amount)
├─ Stripe: $2.52 (3% + $0.60)
└─ Beezio: $8.48 (10% platform fee) ✅
```

### Sale with Referring Affiliate:
```
Customer Pays: $100 (product only)
├─ Seller: $70.00 (what they set)
├─ Affiliate (product promoter): $14.00 (20% of seller amount)
├─ Referring Affiliate: $1.90 (2% of total - comes from Beezio's cut)
├─ Stripe: $2.52 (3% + $0.60)
└─ Beezio: $6.58 (8% instead of 10%) ✅
```

**Key Points:**
- Referring affiliate gets 2% of the TOTAL transaction
- This comes out of Beezio's 10% platform fee
- Beezio keeps 8% instead of 10%
- Product-promoting affiliate still gets their full 20%

---

## 🔗 How It Works

### 1. Affiliate Gets Referral Link
```
https://beezio.co/signup?ref=JOHN123
```
- Each affiliate gets unique referral code (e.g., JOHN123)
- Code is tied to their affiliate account
- Can be shared via social media, email, etc.

### 2. New Affiliate Signs Up
- Clicks referral link
- Fills out affiliate signup form
- System automatically records "referred_by" = JOHN123
- New affiliate is now linked to referring affiliate

### 3. New Affiliate Makes Sales
- New affiliate (Sarah) promotes products
- Makes sale: $100 product
- Commission split:
  - Product affiliate (Sarah): $14.00
  - Referring affiliate (John): $2.00 (2% of $100)
  - Beezio: $6.58 (8% instead of 10%)

### 4. Referring Affiliate Gets Paid
- John sees "Referral Earnings" in dashboard
- Gets 2% from all Sarah's sales
- Passive income for life (or as long as Sarah is active)

---

## 📊 Database Schema

### New Table: `affiliate_referrals`
```sql
CREATE TABLE affiliate_referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id BIGINT REFERENCES users(id), -- Affiliate who referred
  referred_id BIGINT REFERENCES users(id), -- New affiliate who was referred
  referral_code TEXT NOT NULL,
  status TEXT DEFAULT 'active', -- active, inactive
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(referred_id) -- Each affiliate can only be referred once
);
```

### New Table: `referral_commissions`
```sql
CREATE TABLE referral_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id BIGINT REFERENCES users(id), -- Affiliate earning the 2%
  referred_affiliate_id BIGINT REFERENCES users(id), -- Affiliate who made the sale
  order_id BIGINT REFERENCES orders(id),
  sale_amount DECIMAL(10,2), -- Total transaction amount
  commission_amount DECIMAL(10,2), -- 2% of sale_amount
  status TEXT DEFAULT 'pending', -- pending, paid
  created_at TIMESTAMP DEFAULT NOW(),
  paid_at TIMESTAMP
);
```

### Update to `users` table:
```sql
ALTER TABLE users ADD COLUMN referral_code TEXT UNIQUE;
ALTER TABLE users ADD COLUMN referred_by_code TEXT;
```

---

## 🔧 Implementation Components

### 1. Referral Code Generation
```typescript
// Generate unique referral code for each affiliate
function generateReferralCode(userId: string, fullName: string): string {
  const namePrefix = fullName.split(' ')[0].toUpperCase().substring(0, 4);
  const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${namePrefix}${randomSuffix}`;
  // Example: JOHN4X9Z
}
```

### 2. Signup Page Changes
- Check URL for `?ref=CODE` parameter
- Validate referral code exists
- Store `referred_by_code` in user record
- Show message: "You're signing up with a referral from [Name]"

### 3. Payment Processing Update
When completing an order:
1. Check if product affiliate was referred by someone
2. If yes:
   - Calculate 2% referral commission
   - Reduce Beezio's cut from 10% to 8%
   - Create record in `referral_commissions`

### 4. Dashboard Components
**Affiliate Dashboard - New Sections:**
- "Your Referral Link"
- "Referred Affiliates" (list)
- "Referral Earnings" (total + breakdown)

---

## 💵 Payment Calculation Examples

### Example 1: $100 Product Sale
**Without Referral:**
- Seller: $70
- Affiliate: $14
- Stripe: $2.52
- Beezio: $8.48
- **Total: $95.00** (customer pays $100, $5 is already shipping/tax)

**With Referral:**
- Seller: $70
- Affiliate (promoter): $14
- Referring Affiliate: $2.00 (2%)
- Stripe: $2.52
- Beezio: $6.48 (8%)
- **Total: $95.00** (same - just redistributed)

### Example 2: Multiple Referred Affiliates
John refers:
- Sarah (makes $10,000 in sales/month)
- Mike (makes $5,000 in sales/month)
- Lisa (makes $8,000 in sales/month)

John's monthly referral income:
- From Sarah: $10,000 × 2% = $200
- From Mike: $5,000 × 2% = $100
- From Lisa: $8,000 × 2% = $160
- **Total: $460/month passive income** 🎉

---

## 🎨 UI/UX Components Needed

### 1. Referral Link Card (Dashboard)
```
┌─────────────────────────────────────────┐
│ 📢 Refer Other Affiliates & Earn 2%    │
├─────────────────────────────────────────┤
│ Your Referral Link:                     │
│ [https://beezio.co/signup?ref=JOHN123]  │
│ [Copy Link] [Share on Social]          │
├─────────────────────────────────────────┤
│ Earn 2% from all sales made by         │
│ affiliates you refer!                   │
└─────────────────────────────────────────┘
```

### 2. Referred Affiliates List
```
┌─────────────────────────────────────────┐
│ Your Referred Affiliates (3)           │
├─────────────────────────────────────────┤
│ Sarah Johnson                           │
│ └─ Total Sales: $10,000                │
│ └─ Your Earnings: $200.00              │
├─────────────────────────────────────────┤
│ Mike Davis                              │
│ └─ Total Sales: $5,000                 │
│ └─ Your Earnings: $100.00              │
├─────────────────────────────────────────┤
│ Lisa Chen                               │
│ └─ Total Sales: $8,000                 │
│ └─ Your Earnings: $160.00              │
└─────────────────────────────────────────┘
```

### 3. Signup Page Updates
```
┌─────────────────────────────────────────┐
│ Join Beezio Affiliate Program           │
├─────────────────────────────────────────┤
│ ✅ You're signing up with a referral    │
│    from: John Smith                     │
│                                         │
│ [Continue with Signup]                  │
└─────────────────────────────────────────┘
```

---

## 🔐 Security Considerations

1. **Prevent Self-Referral:**
   - Can't use your own referral code
   - Check IP addresses for suspicious patterns

2. **Referral Limit:**
   - Each affiliate can only be referred once
   - Can't change referrer after signup

3. **Commission Validation:**
   - Verify sales are legitimate
   - Prevent fake orders for commission fraud

4. **Terms & Conditions:**
   - Clear agreement on referral terms
   - Right to revoke for abuse

---

## 📈 Benefits

### For Referring Affiliates:
- ✅ Passive income stream
- ✅ Scales with network growth
- ✅ No extra work after initial referral
- ✅ Lifetime earnings from referrals

### For New Affiliates:
- ✅ Mentorship from referring affiliate
- ✅ Help getting started
- ✅ Part of a community
- ✅ Same earning potential as everyone

### For Beezio:
- ✅ Rapid affiliate network growth
- ✅ Reduced marketing costs
- ✅ Self-sustaining growth loop
- ✅ Still profitable (8% vs 10%)

---

## 🚀 Implementation Plan

### Phase 1: Database Setup (Today)
- [ ] Create `affiliate_referrals` table
- [ ] Create `referral_commissions` table
- [ ] Add columns to `users` table
- [ ] Generate referral codes for existing affiliates

### Phase 2: Backend (Tomorrow)
- [ ] Update order completion function
- [ ] Add referral commission calculation
- [ ] Create referral tracking queries
- [ ] Update payout calculations

### Phase 3: Frontend (2 days)
- [ ] Add referral link card to dashboard
- [ ] Update signup page to handle ?ref= parameter
- [ ] Create referred affiliates list
- [ ] Add referral earnings display

### Phase 4: Testing (1 day)
- [ ] Test referral signup flow
- [ ] Test commission calculations
- [ ] Test payout distribution
- [ ] Verify security measures

### Phase 5: Launch (1 day)
- [ ] Announce to existing affiliates
- [ ] Create marketing materials
- [ ] Monitor initial signups
- [ ] Adjust as needed

---

## 📊 Tracking & Analytics

### Metrics to Monitor:
1. **Referral Conversion Rate**
   - Clicks → Signups
   - Target: 10-20%

2. **Average Referrals per Affiliate**
   - How many new affiliates per existing affiliate
   - Target: 2-5 referrals

3. **Referred Affiliate Performance**
   - Do referred affiliates perform as well as organic?
   - Track sales volume

4. **Platform Fee Impact**
   - Net revenue change (lose 2% but gain more affiliates)
   - Break-even analysis

5. **Top Referrers**
   - Identify super-recruiters
   - Reward with bonuses

---

## 💡 Future Enhancements

### Tier 2 Referrals (Optional):
- John refers Sarah
- Sarah refers Mike
- John gets 0.5% from Mike's sales
- Creates deeper network effects

### Bonus Milestones:
- Refer 5 affiliates → $100 bonus
- Refer 10 affiliates → $250 bonus
- Refer 25 affiliates → $500 bonus

### Leaderboard:
- Top 10 referrers displayed publicly
- Competition drives more referrals
- Monthly prizes

---

Ready to implement this? Let me know and I'll start creating the database tables and code!
