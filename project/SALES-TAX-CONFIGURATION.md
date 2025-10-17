# Sales Tax Configuration - 7% Rate

## 🏛️ **Current Configuration**

✅ **Sales Tax Rate: 7%**
✅ **Applied at Checkout**
✅ **Only on Product Price** (not shipping)

---

## 📋 **Legal Requirements for Sales Tax**

### **When You MUST Collect Sales Tax:**

1. **Nexus in a State**
   - You have a physical presence (office, warehouse, employees)
   - You have economic nexus (sales threshold exceeded)
   - You store inventory in that state

2. **Economic Nexus Thresholds (Most States):**
   - $100,000 in sales in a state in the current/previous year
   - OR 200 transactions in a state in the current/previous year

3. **Remote Seller Rules (Post-Wayfair Decision):**
   - Even online-only businesses must collect tax in states where they have nexus
   - Each state has different thresholds

### **When You DON'T Need to Collect Sales Tax:**

❌ Sales in states where you have NO nexus
❌ Sales to tax-exempt organizations (with valid certificate)
❌ Sales of tax-exempt items (varies by state)
❌ B2B sales where buyer provides resale certificate

---

## 🔧 **Current Implementation**

### **File: `src/lib/pricing.ts`**
```typescript
// Sales tax rate (7% = 0.07)
export const TAX_RATE = 0.07;
```

### **Applied in Checkout:**
```typescript
const subtotal = getTotalPrice(); // Product total
const shipping = getShippingTotal(); // Shipping total
const tax = Math.round((subtotal * TAX_RATE) * 100) / 100; // 7% of products only
const total = subtotal + shipping + tax; // Final total
```

### **Key Points:**
✅ Tax is calculated on **product price only**
✅ Shipping is **NOT taxed** (varies by state, but generally correct)
✅ Tax is rounded to 2 decimal places
✅ Tax is added to customer total at checkout

---

## 💡 **Recommendations**

### **Option 1: Keep Fixed 7% (Simple)**
**Good for:**
- Starting out
- Single state nexus
- Low transaction volume

**Considerations:**
- May overcharge customers in lower-tax states
- May undercharge in higher-tax states
- Not compliant for multi-state nexus

### **Option 2: State-Based Tax Rates (Better)**
**Implementation:**
```typescript
// Add to pricing.ts
export const STATE_TAX_RATES: Record<string, number> = {
  'CA': 0.0725, // California
  'TX': 0.0625, // Texas
  'NY': 0.04,   // New York (varies by county)
  'FL': 0.06,   // Florida
  'WA': 0.065,  // Washington
  // ... add all states where you have nexus
  'DEFAULT': 0.07 // Default rate
};

// Update tax calculation
export const calculateTax = (subtotal: number, state: string): number => {
  const rate = STATE_TAX_RATES[state] || STATE_TAX_RATES['DEFAULT'];
  return Math.round((subtotal * rate) * 100) / 100;
};
```

**Benefits:**
- More accurate
- State-compliant
- Better customer experience

### **Option 3: Tax Service Integration (Best for Scale)**
**Services:**
- TaxJar
- Avalara
- TaxCloud (free for smaller businesses)

**Benefits:**
- Real-time tax rate lookup
- Nexus tracking
- Automatic filing
- Audit protection
- Handles all 50 states + localities

---

## 🎯 **Action Items Based on Your Situation**

### **If You're Just Starting (Revenue < $100k/year):**
✅ **Keep current 7% fixed rate**
- Simple
- Easy to manage
- Sufficient for single-state operations
- Update when you hit economic nexus thresholds

### **If You Have Multi-State Sales:**
⚠️ **Need to update to state-based rates**
- Determine which states you have nexus in
- Get registered in those states
- Implement state-based tax calculation
- File returns quarterly/monthly

### **If You're Scaling Fast (Revenue > $500k/year):**
🚀 **Integrate with tax service**
- TaxJar or Avalara recommended
- Automates everything
- Handles complexities
- Saves time and reduces risk

---

## 🔍 **Current Tax Behavior**

### **Example Order:**
```
Product Price: $68.00
Shipping: $5.00
-----------------------
Subtotal: $68.00
Tax (7% of $68): $4.76
Shipping: $5.00
-----------------------
TOTAL: $77.76
```

### **Tax Goes To:**
- Platform holds tax amount
- Remitted to state quarterly/annually
- NOT part of seller/affiliate/platform fee split
- Kept separate for tax filing

---

## 📊 **Tax in Payment Distribution**

```
Customer Pays: $77.76
├── Product: $68.00
│   ├── Seller: $50.00
│   ├── Affiliate: $10.00
│   ├── Stripe: $1.80
│   └── Beezio: $6.18
├── Shipping: $5.00 → Seller
└── Tax: $4.76 → HELD FOR TAX REMITTANCE ✅
```

**Tax is NOT distributed to:**
- ❌ Seller
- ❌ Affiliate
- ❌ Beezio operations
- ✅ Held separately for state tax payment

---

## ⚖️ **Legal Compliance Checklist**

- [ ] Determine which states you have nexus in
- [ ] Register for sales tax permit in those states
- [ ] Configure correct tax rates per state
- [ ] Collect tax on applicable transactions
- [ ] Track tax collected by state
- [ ] File returns on schedule (monthly/quarterly)
- [ ] Remit collected tax to states
- [ ] Keep records for 3-7 years (varies by state)

---

## 🚨 **Important Notes**

### **Shipping Taxability:**
- **Current:** Not taxed ✅
- **Some states require:** Tax on shipping if item is taxable
- **Check:** Your state's specific rules

### **Digital Products:**
- May have different tax rules
- Some states don't tax digital goods
- Some states tax at different rate

### **Tax-Exempt Customers:**
- Need system to handle resale certificates
- B2B sales may be exempt
- Non-profits with valid exemption certificate

### **Marketplace Facilitator Laws:**
- Some states consider you a "marketplace facilitator"
- You may need to collect tax for ALL sales (not just your own)
- Check if this applies to your platform

---

## 🔄 **How to Change Tax Rate**

### **Option 1: Change Global Rate**
Edit `src/lib/pricing.ts`:
```typescript
export const TAX_RATE = 0.08; // Change to 8%
```

### **Option 2: Disable Tax Temporarily**
```typescript
export const TAX_RATE = 0.00; // No tax
```

### **Option 3: Make it State-Based**
1. Add state field to checkout
2. Lookup tax rate by state
3. Apply correct rate

---

## 💼 **Professional Recommendation**

For now, the **7% fixed rate is fine** if:
- ✅ You're testing/launching
- ✅ Sales are under $100k/year
- ✅ Most customers in one state
- ✅ You have nexus in only 1-2 states

**Plan to upgrade when:**
- Revenue exceeds $100k in any state
- Selling to multiple states regularly
- Need to file returns in 3+ states

---

## 📞 **Need to Consult:**

- **State Revenue Department:** Nexus determination
- **CPA/Tax Professional:** Multi-state sales tax strategy
- **Tax Software:** TaxJar, Avalara consultation

---

## ✅ **Current Status: CONFIGURED & WORKING**

Your current 7% sales tax:
- ✅ Is applied at checkout
- ✅ Only taxes product (not shipping)
- ✅ Is held separately from fee distribution
- ✅ Is ready for remittance to state
- ✅ Is legal if you're registered in that state

**You're good to go with current setup!** Just make sure you:
1. Are registered for sales tax in your state
2. File returns on schedule
3. Remit collected tax
4. Keep records

---

**Questions about sales tax? Ask before launch!**
