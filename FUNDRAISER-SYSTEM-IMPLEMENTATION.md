# Fundraiser System Implementation Guide

## Overview
This implementation adds a complete fundraiser system to Beezio where fundraisers:
- Sign up with their own accounts (fundraiser role)
- Set fundraising goals with progress tracking
- Select products from the marketplace to promote (like affiliates)
- Earn 5% of Beezio's commission on each sale (from Beezio's 15% cut)
- Get auto-generated subdomain stores (e.g., `fundraiser.beezio.co`)
- Can use custom domains for white-label fundraising

## Database Changes

### New Tables Created

#### 1. `fundraiser_store_settings`
Stores all fundraiser store configuration:
- **Store branding**: name, description, logo, banner
- **Domains**: custom_domain, subdomain (auto-generated)
- **Goal tracking**: fundraiser_goal, current_raised, goal_description, goal_deadline
- **Theming**: primary_color, secondary_color, text_color
- **Social links**: facebook_url, instagram_url, twitter_url
- **Visibility**: show_goal_on_store, is_active

#### 2. `fundraiser_products`
Junction table linking fundraisers to marketplace products:
- fundraiser_id → auth.users
- product_id → products table
- custom_description (optional product description override)
- display_order, is_featured
- Unique constraint prevents duplicate product selections

### Auto-Subdomain Generation
- **Trigger**: `auto_set_fundraiser_subdomain()` runs on INSERT
- **Function**: Reuses existing `generate_subdomain_from_email()` 
- **Example**: user@beezio.co → `user.beezio.co` (fundraiser store)

### Row Level Security (RLS)
All tables have RLS enabled with policies for:
- ✅ Public can view active fundraiser stores
- ✅ Fundraisers can manage their own stores
- ✅ Admins can manage all fundraiser stores

## Frontend Components

### 1. `FundraiserStorePage.tsx`
Public-facing fundraiser store with:
- **Goal progress bar** showing current_raised / fundraiser_goal
- **Product grid** from fundraiser_products junction table
- **Impact messaging** explaining 5% donation on purchases
- **Social proof** and trust signals
- **Custom domain support** (white-label mode)
- **Owner customization** button (when logged in)

### 2. `FundraiserStoreCustomization.tsx`
Dashboard for fundraisers to:
- Set store name, description, branding
- Upload logo and banner images
- Configure fundraising goal and deadline
- Toggle goal visibility on storefront
- Customize colors and social links
- Manage custom domain (via `CustomDomainManager`)

### 3. Updated `CustomDomainHandler.tsx`
Now routes three store types:
- `seller` → SellerStorePage
- `affiliate` → AffiliateStorePage  
- `fundraiser` → FundraiserStorePage (NEW)

### 4. Updated `customDomainRouter.ts`
Checks three tables for custom domain/subdomain matches:
- store_settings (sellers)
- affiliate_store_settings (affiliates)
- fundraiser_store_settings (fundraisers) - NEW

## Installation Steps

### Step 1: Run Database Migration
Execute `add_fundraiser_store_support.sql` in Supabase SQL Editor:

```bash
Location: project/supabase/migrations/add_fundraiser_store_support.sql
```

This will:
- Create fundraiser_store_settings table
- Create fundraiser_products junction table
- Add indexes for performance
- Set up auto-subdomain trigger
- Enable RLS with proper policies

### Step 2: Verify User Roles
Ensure 'fundraiser' role exists in user_roles table:

```sql
-- Check if fundraiser role is available
SELECT DISTINCT role FROM user_roles;

-- The migration automatically adds fundraiser role to existing 
-- fundraiser_store_settings records
```

### Step 3: Deploy Frontend Code
All frontend components are created:
- ✅ `src/pages/FundraiserStorePage.tsx`
- ✅ `src/components/FundraiserStoreCustomization.tsx`
- ✅ Updated `src/components/CustomDomainHandler.tsx`
- ✅ Updated `src/utils/customDomainRouter.ts`

### Step 4: Add Routes (if needed)
Add fundraiser route to your main router:

```typescript
// In your router configuration
<Route path="/fundraiser/:fundraiserId" element={<FundraiserStorePage />} />
```

## How It Works

### For Fundraisers:

1. **Sign Up**: Create account and select "Fundraiser" role
2. **Set Goal**: Configure fundraising goal, deadline, description
3. **Add Products**: Browse marketplace and select products to promote
4. **Customize Store**: Set branding, colors, social links, custom domain
5. **Share**: Get auto-subdomain (e.g., `myteam.beezio.co`) or use custom domain
6. **Track Progress**: Watch goal progress bar as sales come in

### For Buyers:

1. **Visit Store**: Access via custom domain or subdomain
2. **See Impact**: Clear messaging about 5% going to fundraiser
3. **Shop Products**: Browse fundraiser's curated product selection
4. **Support Cause**: Purchase creates referral tracking for 5% donation

### Commission Structure:

**Per Transaction:**
- Buyer pays: Product Price × 1.15 (15% markup)
- Beezio receives: 15% total
- From Beezio's 15%:
  - Fundraiser gets: 5% (if applicable)
  - Stripe fees: 2.9% + $0.60
  - Beezio adds: $1.60 flat fee
  - Beezio keeps remainder (minimum $1 profit)

**Example: $100 Product**
- Buyer pays: $115
- Seller gets: $100
- Beezio's cut: $15
- Fundraiser gets: $5 (5% of $100)
- Stripe fee: ~$3.94 (2.9% of $115 + $0.60)
- Flat fee added: $1.60
- **Beezio's actual take**: $15 - $5 - $3.94 = $6.06, then adds $1.60 fee

## White-Label Custom Domains

Fundraisers can use their own domains:

1. **Get Subdomain**: Auto-generated on account creation
2. **Add Custom Domain**: In customization settings
3. **DNS Setup**: Point domain to beezio.co via CNAME
4. **Netlify Config**: Add domain in Netlify dashboard
5. **White-Label**: Store shows NO Beezio branding when accessed via custom domain

## Next Steps

### Immediate:
1. ✅ Run SQL migration in Supabase
2. ⚠️ Test fundraiser account creation flow
3. ⚠️ Add fundraiser registration option to sign-up flow
4. ⚠️ Create fundraiser dashboard/analytics page

### Future Enhancements:
- Email notifications when goal milestones reached
- Fundraiser leaderboard page
- Team fundraising (multiple fundraisers for one goal)
- Recurring donation option
- Fundraiser categories/causes
- Advanced analytics and reporting

## Files Created/Modified

### Created:
- `project/supabase/migrations/add_fundraiser_store_support.sql`
- `project/src/pages/FundraiserStorePage.tsx`
- `project/src/components/FundraiserStoreCustomization.tsx`
- `FUNDRAISER-SYSTEM-IMPLEMENTATION.md` (this file)

### Modified:
- `project/src/components/CustomDomainHandler.tsx`
- `project/src/utils/customDomainRouter.ts`

## Testing Checklist

- [ ] Create test fundraiser account
- [ ] Verify auto-subdomain generation
- [ ] Add products from marketplace
- [ ] Set fundraising goal
- [ ] Test goal progress display
- [ ] Verify 5% commission calculation
- [ ] Test custom domain routing
- [ ] Check white-label mode (no Beezio branding)
- [ ] Test social sharing
- [ ] Verify RLS policies work correctly

## Support

If you encounter issues:
1. Check Supabase logs for SQL errors
2. Verify all RLS policies are enabled
3. Ensure fundraiser role exists in user_roles
4. Check browser console for frontend errors
5. Verify subdomain trigger is active: `SELECT * FROM pg_trigger WHERE tgname = 'set_fundraiser_subdomain';`
