# 🌐 Subdomain System - Complete Guide

## ✨ What Changed

Your custom stores now use **automatic subdomains** based on email addresses!

### Before:
- Seller store: `beezio.co/store/abc-123-xyz`
- Affiliate store: `beezio.co/affiliate/xyz-789-abc`

### After:
- `jason@beezio.co` → **`jason.beezio.co`**
- `seller@gmail.com` → **`seller.beezio.co`**
- `affiliate123@yahoo.com` → **`affiliate123.beezio.co`**

---

## 🚀 How It Works

### 1. **Auto-Generated from Email**
When a user signs up:
- Email: `john.doe@example.com`
- Auto-generates subdomain: `john-doe.beezio.co` (or `johndoe.beezio.co`)
- Removes special characters, keeps alphanumeric and hyphens

### 2. **Unique Subdomains**
If subdomain already exists, adds a number:
- First user: `jason.beezio.co`
- Second jason: `jason2.beezio.co`
- Third jason: `jason3.beezio.co`

### 3. **Three Store URLs**
Every store has THREE working URLs:

**Priority 1 - Custom Domain** (if set)
```
https://myawesomestore.com
```

**Priority 2 - Auto Subdomain** (always exists)
```
https://jason.beezio.co
```

**Priority 3 - Path-based Fallback**
```
https://beezio.co/store/user-id-here
```

---

## 📋 Database Changes

### New Columns Added:
- `store_settings.subdomain` (TEXT, UNIQUE)
- `affiliate_store_settings.subdomain` (TEXT, UNIQUE)

### Auto-Generated Values:
- Trigger runs on INSERT
- Extracts username from email
- Ensures uniqueness
- Stores in `subdomain` column

### Migration File:
`project/supabase/migrations/add_subdomain_support.sql`

**What it does:**
1. ✅ Adds subdomain columns
2. ✅ Creates `generate_subdomain_from_email()` function
3. ✅ Creates triggers for auto-generation
4. ✅ Backfills existing records
5. ✅ Adds RLS policies

---

## 🔧 What You Need to Do

### 1. Run the SQL Migration

**In Supabase Dashboard:**
1. Go to SQL Editor
2. Open: `project/supabase/migrations/add_subdomain_support.sql`
3. Click "Run"
4. Verify success message appears

**Or via command line:**
```bash
cd project
npx supabase db push
```

### 2. Configure Netlify for Wildcard Subdomains

**Option A: In Netlify Dashboard (Recommended)**
1. Go to your site → Domain Settings
2. Click "Add domain alias"
3. Add: `*.beezio.co`
4. Save

**Option B: Via DNS Only**
If you control beezio.co DNS:
1. Add CNAME record:
   ```
   Name: *
   Type: CNAME
   Value: beezio-marketplace.netlify.app
   TTL: 3600
   ```

### 3. Test Subdomain Routing

**Create a test user:**
```javascript
// Sign up with test@beezio.co
// This should auto-generate: test.beezio.co
```

**Verify it works:**
- Visit: `https://test.beezio.co`
- Should load their store (React Router handles the routing)
- Falls back to path-based URL if subdomain not configured yet

---

## 💻 Code Updates Made

### 1. **SellerStorePage.tsx**
- Now pulls `subdomain` from store_settings
- Uses subdomain URL in share function
- Priority: subdomain > custom_domain > path

### 2. **AffiliateStorePage.tsx**
- Same subdomain support
- Uses subdomain in store URL generation

### 3. **CustomDomainManager.tsx**
- Shows auto-generated subdomain prominently
- Displays three URL options:
  - 🌟 Subdomain (highlighted)
  - 🔗 Path-based (fallback)
  - 🌐 Custom domain (if set)

### 4. **StoreCustomization.tsx**
- Passes subdomain to CustomDomainManager
- Displays in Domain tab

---

## 🎯 User Experience

### For Sellers/Affiliates:

**When they first create account:**
```
1. Sign up with: seller@gmail.com
2. Go to Settings → Store Settings → Domain tab
3. See: "✨ Your Custom Subdomain: seller.beezio.co"
4. Can share this immediately - it's ready!
```

**What they see:**
```markdown
✨ Your Custom Subdomain:
[seller.beezio.co] [Copy] [Open]
🎉 This is your personal subdomain, auto-generated from your email!

Alternative Store URL:
[beezio.co/store/abc-123] [Copy] [Open]
This URL also works, but the subdomain above is shorter and more professional.

Custom Domain (Optional):
[Enter your own domain like mystore.com]
```

---

## 🔍 Testing Checklist

- [ ] Run SQL migration in Supabase
- [ ] Verify subdomain column exists in both tables
- [ ] Create test seller account → check subdomain generated
- [ ] Create test affiliate account → check subdomain generated
- [ ] Visit subdomain URL → loads store correctly
- [ ] Share button → copies subdomain URL
- [ ] Domain tab shows all three URL options
- [ ] Subdomain conflicts handled (jason vs jason2)
- [ ] Configure Netlify wildcard domain
- [ ] Test subdomain on production

---

## 📊 Examples

### Email → Subdomain Mapping:

| Email | Generated Subdomain |
|-------|-------------------|
| `jason@beezio.co` | `jason.beezio.co` |
| `john.doe@gmail.com` | `john-doe.beezio.co` |
| `seller_123@yahoo.com` | `seller123.beezio.co` |
| `affiliateUSA@hotmail.com` | `affiliateusa.beezio.co` |
| `jason@beezio.co` (2nd) | `jason2.beezio.co` |

### Character Handling:
- Dots (.) → Hyphens (-)
- Underscores (_) → Removed
- Special chars (!@#) → Removed
- Uppercase → Lowercase
- Leading/trailing hyphens → Trimmed

---

## 🌟 Benefits

### For Users:
✅ Professional branded URL  
✅ Auto-generated, no setup needed  
✅ Easy to remember and share  
✅ Based on their email identity  
✅ Still can upgrade to custom domain  

### For You:
✅ Automatic subdomain generation  
✅ No manual configuration per user  
✅ Unique constraint prevents conflicts  
✅ Backward compatible (path URLs still work)  
✅ Better branding than random IDs  

---

## 🚨 Important Notes

1. **Wildcard SSL**: Netlify auto-provisions SSL for `*.beezio.co` once configured
2. **DNS Propagation**: May take 5-30 minutes for new subdomains to work
3. **Backward Compatible**: Old `/store/:id` URLs still work
4. **Immutable**: Subdomain doesn't change even if user changes email
5. **Migration Safe**: Existing users get subdomains backfilled

---

## 🆘 Troubleshooting

### "Subdomain not found"
- Check migration ran successfully
- Verify subdomain column exists
- Check user has store_settings record

### "Subdomain doesn't load"
- Verify Netlify wildcard domain configured
- Check DNS propagation (use `dig *.beezio.co`)
- Ensure `netlify.toml` SPA redirect exists

### "Duplicate subdomain error"
- This is handled automatically
- Function adds number suffix (jason2, jason3, etc.)
- Check database constraints

---

## 📞 Next Steps

1. **Run the migration** (`add_subdomain_support.sql`)
2. **Configure Netlify** (add `*.beezio.co` domain alias)
3. **Test with new account**
4. **Deploy to production**
5. **Announce to users**: "You now have custom subdomains!"

**Your stores are now professional, branded, and auto-configured!** 🎉
