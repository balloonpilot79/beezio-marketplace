# Custom Store Auto-Creation & Custom Domain Setup Guide

## Overview
This guide will help you:
1. ✅ Ensure custom stores auto-create for ALL new users
2. ✅ Add custom domain functionality to store settings
3. ✅ Deploy the new Custom Domain Manager component

---

## Step 1: Database Setup (Supabase)

### 1.1 Run the Auto-Creation Fix Script

1. Go to Supabase Dashboard → SQL Editor
2. Open `fix-auto-store-creation.sql` from the project folder
3. Copy the entire contents and paste into SQL Editor
4. Click **Run** to execute

This script will:
- ✅ Verify the auto-creation trigger exists
- ✅ Add custom_domain column (if missing)
- ✅ Backfill store settings for existing users
- ✅ Show verification counts

### 1.2 Verify Results

After running the script, you should see:
```
Total Sellers: 5
Sellers with Store Settings: 5
Sellers WITHOUT Store Settings: 0
```

If you see any missing stores, the script automatically creates them.

---

## Step 2: Test Auto-Creation (Optional but Recommended)

1. Go to Supabase Dashboard → SQL Editor
2. Open `test-auto-store-creation.sql` from the project folder
3. Run the script to test:
   - ✅ New seller signup → store auto-created
   - ✅ New affiliate signup → store auto-created
   - ✅ Role change (buyer → seller) → store auto-created

You should see SUCCESS messages in the output:
```
SUCCESS: Store settings auto-created for seller <uuid>
SUCCESS: Affiliate store settings auto-created for affiliate <uuid>
SUCCESS: Store settings auto-created when role changed to seller
```

---

## Step 3: Frontend Deployment

### 3.1 Verify New Files

Make sure these files exist in your project:

```
project/src/components/
  ├── CustomDomainManager.tsx  ← NEW (Custom domain UI component)
  └── StoreCustomization.tsx   ← UPDATED (Now uses CustomDomainManager)
```

### 3.2 Deploy to Netlify

```bash
# Navigate to project directory
cd c:\Users\jason\OneDrive\Desktop\bz\project

# Add all changes
git add .

# Commit changes
git commit -m "Add custom store auto-creation and custom domain support"

# Push to GitHub (triggers Netlify deploy)
git push origin main
```

### 3.3 Wait for Deploy

- Go to Netlify Dashboard
- Wait for the build to complete (usually 2-3 minutes)
- Check deployment logs for any errors

---

## Step 4: Test the Complete Flow

### 4.1 Test Auto-Creation for New Users

1. **Create a new seller account:**
   - Go to https://beezio-marketplace.netlify.app/signup
   - Register with email: `newseller@test.com`
   - Select role: **Seller**
   - Complete signup

2. **Verify store was auto-created:**
   - Login with the new account
   - Go to Dashboard → Store Customization
   - You should see store settings already populated
   - **No spinning circle!**

### 4.2 Test Custom Domain Feature

1. **Access Custom Domain Tab:**
   - Login as a seller or affiliate
   - Go to Dashboard → Store Customization
   - Click on **Domain** tab

2. **Add a Custom Domain:**
   - Enter a domain: `mystore.com`
   - Click **Save**
   - Should see DNS setup instructions

3. **Verify Database Updated:**
   - Go to Supabase → Table Editor
   - Open `store_settings` table
   - Find your user's record
   - Verify `custom_domain` column has the domain you entered

---

## Step 5: How Custom Domains Work

### For Users:

1. **User enters custom domain** in Store Customization → Domain tab
2. **System validates** domain format (no duplicates allowed)
3. **DNS instructions shown** with CNAME record details:
   ```
   Type:  CNAME
   Name:  yourdomain.com (or subdomain)
   Value: beezio-marketplace.netlify.app
   ```

4. **User configures DNS** at their domain registrar (GoDaddy, Namecheap, etc.)
5. **DNS propagates** (5-48 hours)
6. **Domain becomes active** and points to their Beezio store

### Technical Details:

- **Domain Column**: `TEXT UNIQUE` - prevents duplicates
- **Validation**: Frontend validates domain format
- **DNS**: CNAME record points to Netlify app
- **SSL**: Netlify automatically provisions SSL certificates
- **Verification**: Future enhancement - check DNS records programmatically

---

## Step 6: Fix Domain Configuration Issue (beezio.co)

### Current Issue:
- `beezio-marketplace.netlify.app` shows correct dashboard ✅
- `beezio.co` shows different/outdated dashboard ❌

### Solution:

1. **Go to Netlify Dashboard:**
   - Navigate to your site settings
   - Click on "Domain management"

2. **Check Custom Domain Settings:**
   - Verify `beezio.co` is listed as a custom domain
   - Check it's pointing to the CORRECT site
   - Look for "Primary domain" badge

3. **If beezio.co is pointing to wrong site:**
   - Remove `beezio.co` from old site
   - Add `beezio.co` to `beezio-marketplace` site
   - Wait for DNS propagation (up to 48 hours)

4. **Verify DNS Records:**
   - `beezio.co` should have:
     ```
     Type: A
     Name: @
     Value: 75.2.60.5 (Netlify IP)
     
     Type: CNAME
     Name: www
     Value: beezio-marketplace.netlify.app
     ```

---

## Features Included

### ✅ Auto-Store Creation
- **Trigger Function**: Automatically creates store settings when:
  - New user signs up as seller/affiliate
  - Existing user changes role to seller/affiliate
- **Default Settings**: 
  - Store name: "[User's Name]'s Store"
  - Description: "Welcome to my store!"
  - Theme: "modern"
  - Custom domain: NULL (to be set by user)

### ✅ Custom Domain Manager Component
- **Domain Input**: Clean, validated domain entry
- **DNS Instructions**: Step-by-step setup guide
- **Verification**: Visual status indicator
- **Benefits Display**: Shows why custom domains matter
- **Copy URL**: Quick copy default store URL
- **Remove Domain**: Easy domain removal

### ✅ Store Customization Integration
- **New Tab**: "Domain" tab added to store customization
- **Seamless UX**: Integrated with existing tabs
- **Auto-Refresh**: Updates when domain is changed

---

## Testing Checklist

### Database Tests:
- [ ] Run `fix-auto-store-creation.sql`
- [ ] Verify all sellers have store_settings
- [ ] Verify all affiliates have affiliate_store_settings
- [ ] Run `test-auto-store-creation.sql`
- [ ] All tests return SUCCESS

### Frontend Tests:
- [ ] New seller signup → store auto-created
- [ ] No spinning circle on Store Customization page
- [ ] Can access all tabs (General, Appearance, Domain)
- [ ] Can enter custom domain
- [ ] DNS instructions display correctly
- [ ] Can copy store URL
- [ ] Can remove custom domain

### Production Tests:
- [ ] Deploy to Netlify successful
- [ ] No build errors
- [ ] Test on beezio-marketplace.netlify.app
- [ ] Test custom domain save/remove
- [ ] Verify database updates

---

## Troubleshooting

### Issue: Spinning circle on Store Customization
**Solution**: Run `fix-auto-store-creation.sql` to create missing store settings

### Issue: "Domain already in use" error
**Solution**: Check `store_settings` table for duplicate custom_domain values

### Issue: DNS not working
**Solution**: 
1. Verify CNAME record points to `beezio-marketplace.netlify.app`
2. Wait 24-48 hours for DNS propagation
3. Use DNS checker tool: https://dnschecker.org/

### Issue: beezio.co shows wrong dashboard
**Solution**: 
1. Go to Netlify → Domain management
2. Verify beezio.co points to correct site
3. Wait for DNS cache to clear

---

## What's Next?

### Future Enhancements:
1. **DNS Verification API**: Automatically check if DNS is configured correctly
2. **SSL Certificate Status**: Show SSL provisioning status
3. **Domain Analytics**: Track traffic by custom domain
4. **Subdomain Support**: Allow users to create subdomains (shop.beezio.co)
5. **Email Forwarding**: Custom domain email addresses

---

## Support

If you encounter any issues:
1. Check Supabase logs for trigger errors
2. Check Netlify deploy logs for build errors
3. Verify RLS policies allow access to store_settings
4. Contact support: support@beezio.co

---

## Summary

You've successfully implemented:
✅ **Auto-store creation** for all new signups
✅ **Custom domain support** with DNS instructions
✅ **Professional Custom Domain Manager** component
✅ **Seamless integration** into Store Customization

Your marketplace is now ready for scale! 🚀
