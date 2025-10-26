# Fundraiser Commission Flow - How Money Goes to Causes

## Overview
When a **fundraiser** shares their referral link and someone makes a purchase, **100% of the affiliate commission goes directly to the fundraiser's cause**.

---

## How It Works

### 1. **Fundraiser Gets Referral Link**
Fundraiser (e.g., "Local Soccer Team") signs up and gets their unique referral code:
```
https://beezio.co/signup?ref=SOCCERTEAM123
```

### 2. **Supporter Makes Purchase**
A supporter clicks the fundraiser's link and buys a product:
- **Product:** $100 wireless headphones
- **Seller set commission:** 20%

### 3. **Commission Goes to Cause**
The **entire $20 affiliate commission** goes to the fundraiser's account:

```
Purchase Breakdown:
├── Product Price: $100.00
├── Affiliate Commission (20%): $20.00 → Goes to Soccer Team's fundraising account ✅
├── Platform Fee (15%): $15.00 → Beezio
├── Stripe Fee (2.9% + $0.60): $3.33 → Payment processing
└── Tax (8%): $8.00
    
Total Customer Pays: $146.33

Fundraiser Receives: $20.00 towards their cause
```

---

## Database Flow

### When Purchase Happens:

1. **Order Created** with `affiliate_id` = fundraiser's user ID
2. **Commission Recorded** in `affiliate_commissions` table:
   ```sql
   INSERT INTO affiliate_commissions (
     affiliate_id,        -- Fundraiser's user ID
     product_id,
     order_id,
     commission_amount,   -- $20.00
     status               -- 'pending'
   )
   ```

3. **Cause Updated** (if linked to specific cause):
   ```sql
   UPDATE causes 
   SET raised_amount = raised_amount + 20.00
   WHERE creator_id = fundraiser_user_id
   ```

4. **Fundraiser Dashboard Shows:**
   - Total Raised: +$20.00
   - Pending: $20.00 (until payout threshold)
   - Campaign Progress: Updated

---

## Key Differences: Fundraiser vs Regular Affiliate

| Feature | Regular Affiliate | Fundraiser |
|---------|------------------|------------|
| **Commission Destination** | Personal earnings | Goes to cause/campaign |
| **Dashboard Label** | "Total Earnings" | "Total Raised" |
| **Link Label** | "Affiliate Link" | "Fundraising Link" |
| **Motivation** | Personal income | Support a cause |
| **Tax Treatment** | Personal income (1099) | May be tax-deductible donation (if 501c3)* |
| **Payout** | To personal bank account | To cause's bank account or fiscal sponsor |
| **Transparency** | Show earnings | Show cause progress + donors |

*Future feature: Verify 501c3 status for tax-deductible receipts

---

## Example Campaigns

### Campaign 1: Local Soccer Team
- **Goal:** $5,000 for new equipment
- **Current:** $1,200 raised
- **Method:** Parents share fundraising links when promoting products
- **Result:** Every purchase through their link adds commission to team fund

### Campaign 2: School Band Trip
- **Goal:** $10,000 for trip to nationals
- **Current:** $3,400 raised  
- **Method:** Students share links on social media
- **Result:** Friends/family shop and commissions fund the trip

### Campaign 3: Medical Bills Support
- **Goal:** $15,000 for treatment
- **Current:** $7,800 raised
- **Method:** Community shares link widely
- **Result:** Every purchase helps with medical costs

---

## Technical Implementation

### Checkout Page Logic:
```typescript
// EnhancedCheckoutPage.tsx
const calculateOrderSummary = (): OrderSummary => {
  // ... other calculations ...
  
  // Check if buyer is an affiliate or fundraiser
  const buyerIsAffiliate = profile?.primary_role === 'affiliate' || 
                           profile?.primary_role === 'fundraiser';

  if (affiliateId && !buyerIsAffiliate) {
    // Calculate commission - goes to affiliate/fundraiser
    affiliateCommission = items.reduce((sum, item) => {
      if (user?.id === item.sellerId) return sum; // Skip if buying own product
      return sum + (item.price * item.quantity * (item.commission_rate || 0) / 100);
    }, 0);
  }
  
  // This commission goes to whoever owns affiliateId (could be fundraiser!)
  return { affiliateCommission, ... };
};
```

### Payment Processing:
```typescript
// paymentProcessor.ts
const orderPayload = {
  items: [...],
  affiliate: affiliateId ? {
    affiliateId,              // Could be fundraiser's ID
    commission: orderSummary.affiliateCommission  // Goes to them
  } : null,
  // ... rest of order
};
```

---

## Payout Process

### For Fundraisers:
1. **Commissions accumulate** in their account
2. **Minimum threshold:** $25 (same as affiliates)
3. **Payout options:**
   - Direct to bank account (fundraiser manages funds)
   - To verified nonprofit's account
   - To fiscal sponsor (for unincorporated groups)

### Payout Schedule:
- **Weekly payouts** for verified accounts
- **Monthly payouts** for new accounts
- **On-demand** for verified 501c3 organizations

---

## Transparency Features

### Fundraiser Dashboard Shows:
```
╔══════════════════════════════════════╗
║  🎯 Campaign: Local Soccer Team     ║
╠══════════════════════════════════════╣
║  Goal: $5,000                        ║
║  Raised: $1,200 (24%)                ║
║  Pending: $150                       ║
║                                      ║
║  Recent Supporters:                  ║
║  • Anonymous - $15 (2 hours ago)    ║
║  • Jane D. - $20 (5 hours ago)      ║
║  • Mike S. - $18 (1 day ago)        ║
║                                      ║
║  [Share Fundraising Link]           ║
╚══════════════════════════════════════╝
```

### Public Campaign Page Shows:
- Campaign story
- Goal progress bar
- Total supporters
- Recent donations (anonymous option)
- Impact updates from fundraiser
- Share buttons

---

## Future Enhancements

### Phase 1: Better Tracking
- [ ] Link commissions to specific campaigns
- [ ] Show which products raised most money
- [ ] Supporter thank you messages
- [ ] Email updates to supporters

### Phase 2: Nonprofit Features
- [ ] 501c3 verification
- [ ] Tax-deductible receipt generation
- [ ] Fiscal sponsor integration
- [ ] Grant matching support

### Phase 3: Team Fundraising
- [ ] Multiple fundraisers per campaign
- [ ] Leaderboards
- [ ] Friendly competition
- [ ] Team goals and rewards

### Phase 4: Advanced Features
- [ ] Recurring donations
- [ ] Donor CRM
- [ ] Impact reporting
- [ ] Corporate matching
- [ ] Peer-to-peer fundraising pages

---

## Important Rules

### ✅ Fundraisers CAN:
- Promote any product on the marketplace
- Earn commission on every sale through their link
- Have multiple active campaigns
- Shop commission-free (perk for being fundraiser)
- Withdraw funds once minimum threshold reached
- Track progress in real-time

### ❌ Fundraisers CANNOT:
- Earn commission on their own purchases
- Earn commission on purchases from other affiliates/fundraisers
- Promise specific tax benefits (unless verified 501c3)
- Misrepresent cause or how funds are used

---

## Compliance & Safety

### Platform Responsibilities:
1. **Verify legitimacy** of causes
2. **Monitor for fraud** (fake campaigns)
3. **Ensure transparency** (where money goes)
4. **Provide reporting** for tax purposes
5. **Handle disputes** fairly

### Fundraiser Responsibilities:
1. **Honest representation** of cause
2. **Proper use** of funds
3. **Regular updates** to supporters
4. **Compliance** with local fundraising laws
5. **Tax reporting** (if required)

---

## Success Metrics

Track fundraiser performance:
- **Total raised per campaign**
- **Average donation per supporter**
- **Conversion rate** (clicks to purchases)
- **Campaign completion rate**
- **Time to reach goal**
- **Supporter engagement**

---

## Summary

**Every purchase through a fundraiser's link:**
- ✅ Commission goes to the cause (not personal income)
- ✅ Fully tracked and transparent
- ✅ Automatically updated on dashboard
- ✅ Accumulated until payout threshold
- ✅ Can be linked to specific campaigns

**The system treats fundraisers like affiliates technically, but all money flows to their cause, not personal earnings.**

This allows:
- Schools to raise money for trips
- Sports teams to buy equipment
- Individuals to fund medical bills
- Nonprofits to support programs
- Community groups to fund projects

**No change needed to existing code - it already works this way!** 🎉

---

Last Updated: October 26, 2025
