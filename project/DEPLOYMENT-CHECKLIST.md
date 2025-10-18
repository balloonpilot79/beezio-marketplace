# 🚀 Quick Deployment Checklist

## ⏱️ Total Time: ~30 minutes

---

## ✅ Step 1: Database Setup (5 minutes)

### 1.1 Fix Auto-Creation & Add Custom Domain Support
- [ ] Open Supabase Dashboard
- [ ] Go to SQL Editor → New Query
- [ ] Open `fix-auto-store-creation.sql` from project folder
- [ ] Copy ALL contents (200 lines)
- [ ] Paste into Supabase SQL Editor
- [ ] Click **RUN**
- [ ] Wait for completion (~10 seconds)

**Expected Result:**
```
✅ Trigger exists or created
✅ Custom domain columns added
✅ All sellers have store_settings
✅ All affiliates have affiliate_store_settings
✅ Missing stores count = 0
```

### 1.2 Test Auto-Creation (Optional - 3 minutes)
- [ ] New Query in Supabase SQL Editor
- [ ] Open `test-auto-store-creation.sql`
- [ ] Copy ALL contents (150 lines)
- [ ] Paste into Supabase SQL Editor
- [ ] Click **RUN**

**Expected Result:**
```
✅ SUCCESS: Store settings auto-created for seller
✅ SUCCESS: Affiliate store settings auto-created
✅ SUCCESS: Store settings auto-created when role changed
```

---

## ✅ Step 2: Frontend Deployment (10 minutes)

### 2.1 Verify New Files Exist
- [ ] `src/components/CustomDomainManager.tsx` exists
- [ ] `src/components/StoreCustomization.tsx` updated

### 2.2 Commit and Push
Open Command Prompt (cmd.exe):

```cmd
cd c:\Users\jason\OneDrive\Desktop\bz\project

git status

git add .

git commit -m "Add auto-store creation and custom domain support"

git push origin main
```

### 2.3 Monitor Netlify Deploy
- [ ] Go to Netlify Dashboard
- [ ] Click on your site (beezio-marketplace)
- [ ] Watch "Production deploys" section
- [ ] Wait for green checkmark (2-3 minutes)
- [ ] Click "Open production deploy" to test

**Build should succeed with:**
```
✅ Build completed
✅ No errors
✅ Site published
```

---

## ✅ Step 3: Test New User Signup (5 minutes)

### 3.1 Create Test Seller Account
- [ ] Go to https://beezio-marketplace.netlify.app/signup
- [ ] Email: `testseller1@test.com`
- [ ] Password: `Test123!`
- [ ] Full Name: `Test Seller`
- [ ] Role: **Seller**
- [ ] Click Sign Up

### 3.2 Verify Auto-Store Creation
- [ ] Login with test account
- [ ] Go to Dashboard
- [ ] Click **Store Customization**
- [ ] Should load immediately (**no spinning circle!**)
- [ ] Should see default store name: "Test Seller's Store"
- [ ] Should see all tabs: General, Appearance, Domain

**✅ SUCCESS = No errors, instant load, store settings visible**

---

## ✅ Step 4: Test Custom Domain Feature (5 minutes)

### 4.1 Add Custom Domain
- [ ] Stay logged in as test seller
- [ ] Go to Store Customization → **Domain** tab
- [ ] Enter domain: `myteststore.com`
- [ ] Click **Save**
- [ ] Should see success message
- [ ] DNS instructions should appear

### 4.2 Verify Database Update
- [ ] Go to Supabase → Table Editor
- [ ] Open `store_settings` table
- [ ] Find test seller's record
- [ ] Verify `custom_domain` = `myteststore.com`

### 4.3 Test Domain Removal
- [ ] Click **Remove** button in Domain tab
- [ ] Confirm removal
- [ ] Should clear the domain
- [ ] Verify in database (custom_domain = NULL)

**✅ SUCCESS = Domain saves, shows instructions, removes correctly**

---

## ✅ Step 5: Test Existing User (3 minutes)

### 5.1 Test Your Real Account
- [ ] Logout from test account
- [ ] Login with your actual seller account
- [ ] Go to Store Customization
- [ ] Should load immediately (no spinning circle)
- [ ] Click Domain tab
- [ ] Try adding a custom domain
- [ ] Verify DNS instructions appear

**✅ SUCCESS = Your existing account works perfectly**

---

## ✅ Step 6: Fix beezio.co Issue (5+ minutes)

### 6.1 Check Netlify Domain Settings
- [ ] Go to Netlify Dashboard
- [ ] Click your site (beezio-marketplace)
- [ ] Click **Domain management**
- [ ] Look for `beezio.co` in custom domains list

### 6.2 Verify Correct Site
- [ ] If `beezio.co` is listed on WRONG site:
  - [ ] Remove it from wrong site
  - [ ] Add it to `beezio-marketplace` site
  - [ ] Wait for DNS propagation

### 6.3 Check DNS Records (at your domain registrar)
- [ ] Login to where you bought beezio.co
- [ ] Go to DNS settings
- [ ] Verify A record:
  ```
  Type: A
  Name: @
  Value: 75.2.60.5
  ```
- [ ] Verify CNAME record:
  ```
  Type: CNAME
  Name: www
  Value: beezio-marketplace.netlify.app
  ```

**⏳ Note: DNS changes take 5-48 hours to propagate**

---

## 📊 Verification Matrix

| Test | Expected Result | Status |
|------|----------------|--------|
| Database trigger exists | ✅ Trigger created | ☐ |
| All sellers have stores | ✅ Missing = 0 | ☐ |
| New seller signup | ✅ Store auto-created | ☐ |
| Store Customization loads | ✅ No spinning circle | ☐ |
| Domain tab visible | ✅ Tab appears | ☐ |
| Can add domain | ✅ Saves successfully | ☐ |
| DNS instructions show | ✅ CNAME details visible | ☐ |
| Can remove domain | ✅ Clears successfully | ☐ |
| Frontend deploys | ✅ No errors | ☐ |
| beezio.co points correctly | ⏳ After DNS propagation | ☐ |

---

## 🚨 Troubleshooting

### Problem: Database script fails
**Solution**: 
- Check if you're using PostgreSQL (not MySQL)
- Verify you're in Supabase SQL Editor
- Check for error messages in output

### Problem: Spinning circle still appears
**Solution**:
- Verify `fix-auto-store-creation.sql` ran successfully
- Check Supabase logs for trigger errors
- Run verification query:
  ```sql
  SELECT * FROM store_settings WHERE seller_id = '<your-user-id>';
  ```

### Problem: Can't save custom domain
**Solution**:
- Check browser console for errors
- Verify RLS policies allow updates
- Check if domain is already taken (unique constraint)

### Problem: Build fails on Netlify
**Solution**:
- Check deploy logs for specific error
- Verify `CustomDomainManager.tsx` has no syntax errors
- Check import path in `StoreCustomization.tsx`

### Problem: beezio.co still shows wrong dashboard
**Solution**:
- Wait 24-48 hours for DNS propagation
- Clear browser cache
- Use incognito/private window to test
- Verify Netlify domain settings

---

## 📞 Need Help?

### Check These First:
1. `CUSTOM-STORE-DOMAIN-SETUP.md` - Detailed setup guide
2. `CUSTOM-STORE-IMPLEMENTATION-COMPLETE.md` - Complete documentation
3. Supabase logs - Database errors
4. Netlify logs - Build errors
5. Browser console - Frontend errors

### Still Stuck?
- Email: support@beezio.co
- Include: Error messages, screenshots, steps to reproduce

---

## 🎉 Success!

When all checkboxes are checked:
- ✅ Database trigger is working
- ✅ Auto-store creation is live
- ✅ Custom domain feature is deployed
- ✅ All tests pass
- ✅ Ready for production users!

**Your marketplace is now fully automated and ready to scale!** 🚀

---

## 📝 Post-Deployment

### Monitor for 24 Hours:
- [ ] Check Supabase logs for trigger errors
- [ ] Monitor new user signups
- [ ] Verify stores are auto-created
- [ ] Check for any error reports

### Document:
- [ ] Take screenshots of working features
- [ ] Note any issues or edge cases
- [ ] Plan future enhancements

---

*Last updated: Day 2 - Evening Session*
*Next review: After first 10 new signups*
