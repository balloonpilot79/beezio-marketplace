# Beezio Fee Structure - Complete Breakdown

## Overview
Beezio uses a transparent, fair fee structure that rewards sellers, affiliates, and ensures platform sustainability.

---

## Fee Breakdown by Scenario

### 1. **Normal Sale (No Affiliate Link)**
**Example:** Buyer browses marketplace and buys directly

**Fees Charged:**
- ✅ **Beezio Platform Fee:** 15% of subtotal
- ✅ **Stripe Processing:** ~2.9% + $0.30
- ✅ **Shipping:** Cost set by seller
- ✅ **Sales Tax:** 8% (varies by state)

**Fees NOT Charged:**
- ❌ **Affiliate Commission:** $0 (no affiliate involved)

**Seller Receives:** 85% of product price (minus Stripe fee)

---

### 2. **Affiliate Sale (Buyer Uses Affiliate Link)**
**Example:** Customer clicks affiliate's referral link and makes purchase

**Fees Charged:**
- ✅ **Affiliate Commission:** Varies by product (seller sets rate, e.g., 10-30%)
- ✅ **Beezio Platform Fee:** 15% of subtotal
- ✅ **Stripe Processing:** ~2.9% + $0.30
- ✅ **Shipping:** Cost set by seller
- ✅ **Sales Tax:** 8%

**Seller Receives:** 85% minus affiliate commission
**Affiliate Receives:** Their commission rate (e.g., 20% = $20 on $100 product)

---

### 3. **Seller Buys Own Product (Self-Purchase)**
**Example:** Seller lists iPhone, then buys it through their own store

**Fees Charged:**
- ✅ **Beezio Platform Fee:** 15% of subtotal
- ✅ **Stripe Processing:** ~2.9% + $0.30
- ✅ **Shipping:** Cost set by seller
- ✅ **Sales Tax:** 8%

**Fees WAIVED:**
- 🎉 **Affiliate Commission:** $0 (waived - can't earn commission on own products)

**Result:** Seller pays platform fee + Stripe + shipping + tax, but NO affiliate commission

---

### 4. **Affiliate/Fundraiser Makes Any Purchase**
**Example:** An affiliate or fundraiser shops on the marketplace (any product, any seller)

**Fees Charged:**
- ✅ **Beezio Platform Fee:** 15% of subtotal
- ✅ **Stripe Processing:** ~2.9% + $0.30
- ✅ **Shipping:** Cost set by seller
- ✅ **Sales Tax:** 8%

**Fees WAIVED:**
- 🎉 **Affiliate Commission:** $0 (waived - affiliates shop commission-free as a perk)

**Result:** Affiliates and fundraisers get commission-free shopping on all purchases!

---

## Fee Logic Implementation

### Checkout Calculation (EnhancedCheckoutPage.tsx)

```typescript
const calculateOrderSummary = (): OrderSummary => {
  const subtotal = getTotalPrice();
  const shipping = getShippingTotal();
  const tax = subtotal * 0.08; // 8% tax rate
  
  let affiliateCommission = 0;
  let beezioCommission = 0;

  // Check if buyer is an affiliate or fundraiser
  const buyerIsAffiliate = profile?.primary_role === 'affiliate' || profile?.primary_role === 'fundraiser';

  if (affiliateId && !buyerIsAffiliate) {
    // If there's an affiliate AND buyer is not an affiliate/fundraiser
    affiliateCommission = items.reduce((sum, item) => {
      // Skip commission if buyer is the seller of this specific item
      if (user?.id === item.sellerId) {
        return sum;
      }
      return sum + (item.price * item.quantity * (item.commission_rate || 0) / 100);
    }, 0);
    beezioCommission = subtotal * 0.15; // 15% platform fee
  } else {
    // No affiliate commission
    affiliateCommission = 0;
    beezioCommission = subtotal * 0.15; // 15% platform fee still applies
  }

  const total = subtotal + shipping + tax;

  return { subtotal, shipping, tax, affiliateCommission, beezioCommission, total };
};
```

---

## Why This Structure?

### 1. **Fair to Sellers**
- Keep 85% of sales price
- Only pay affiliate commission when they actually bring customers
- No commission on self-purchases (makes sense - can't refer yourself)

### 2. **Rewards Affiliates**
- Earn commission on every referred sale
- Shop commission-free on the entire marketplace
- Incentivizes becoming an affiliate

### 3. **Sustainable Platform**
- 15% platform fee covers:
  - Server and hosting costs
  - Payment processing infrastructure
  - Customer support
  - Platform development and maintenance
  - Marketing and growth

### 4. **Transparent**
- Every fee is shown at checkout
- Buyers see exactly where their money goes
- No hidden charges

---

## Example Scenarios

### Scenario A: Regular Customer Buys $100 Product (20% Affiliate Commission)

**Product:** $100.00
**Shipping:** $5.00
**Tax (8%):** $8.00
**Affiliate Commission (20%):** $20.00
**Platform Fee (15%):** $15.00
**Total Paid by Customer:** $113.00

**Distribution:**
- Seller receives: $65.00 (85% - 20% affiliate commission)
- Affiliate receives: $20.00
- Beezio receives: $15.00
- Stripe receives: ~$3.27

---

### Scenario B: Affiliate Buys $100 Product (Same Product)

**Product:** $100.00
**Shipping:** $5.00
**Tax (8%):** $8.00
**Affiliate Commission:** 🎉 $0.00 (WAIVED)
**Platform Fee (15%):** $15.00
**Total Paid by Customer:** $113.00

**Distribution:**
- Seller receives: $85.00 (full 85%, no affiliate commission deducted)
- Affiliate receives: $0.00 (can't earn on own purchase)
- Beezio receives: $15.00
- Stripe receives: ~$3.27

**Affiliate Saves:** $20.00 compared to regular customers!

---

### Scenario C: Seller Buys Own $100 Product

**Product:** $100.00
**Shipping:** $5.00
**Tax (8%):** $8.00
**Affiliate Commission:** 🎉 $0.00 (WAIVED - own product)
**Platform Fee (15%):** $15.00
**Total Paid by Seller:** $113.00

**Result:** Seller effectively pays shipping + tax + platform fee only

---

## Benefits Summary

### For Sellers:
✅ Keep 85% of every sale
✅ No fee on self-purchases
✅ Control affiliate commission rates
✅ Transparent pricing

### For Affiliates:
✅ Earn commission on referrals
✅ Shop commission-free sitewide
✅ Multiple income streams
✅ Fair commission structure

### For Buyers:
✅ See all fees at checkout
✅ Support affiliates with purchases
✅ Fair, transparent pricing
✅ Secure payments via Stripe

### For Platform (Beezio):
✅ 15% covers all operational costs
✅ Sustainable business model
✅ Can invest in features and growth
✅ Support team and infrastructure

---

## Important Notes

1. **Platform fee is ALWAYS charged** (15%) - this is how Beezio operates
2. **Affiliate commission is OPTIONAL** - only charged when:
   - Affiliate link was used
   - Buyer is NOT an affiliate/fundraiser
   - Buyer is NOT the seller of that item
3. **Stripe fees are unavoidable** - payment processing costs
4. **Shipping is pass-through** - whatever seller charges
5. **Tax is legally required** - varies by location

---

## Database Fields to Track

### Orders Table:
- `subtotal` - Product total before fees
- `shipping_cost` - Shipping amount
- `tax_amount` - Sales tax
- `affiliate_commission` - Commission paid to affiliate (or 0)
- `platform_fee` - Beezio's 15% fee
- `total_amount` - Final amount charged
- `affiliate_id` - Reference to affiliate (null if none)
- `buyer_id` - User who made purchase
- `seller_id` - User who listed product

### Commission Tracking:
- Check `buyer_id` against `profiles.primary_role`
- Check `buyer_id` against `seller_id` for same user
- Calculate commission based on above rules

---

## Future Enhancements

1. **Volume Discounts:** Lower platform fee for high-volume sellers
2. **Premium Tiers:** Enhanced features for subscription members
3. **Dynamic Commission:** AI-suggested commission rates based on product category
4. **Loyalty Program:** Reward frequent buyers with commission-free shopping
5. **Charity Donations:** Option to donate affiliate commission to causes

---

Last Updated: October 25, 2025
