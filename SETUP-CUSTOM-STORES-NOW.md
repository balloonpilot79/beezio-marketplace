# 🚀 Setup Custom Stores - Action Plan

## What You Need to Do RIGHT NOW

### Step 1: Run SQL Migration in Supabase (5 minutes)

1. **Open Supabase Dashboard**
   - Go to: https://supabase.com/dashboard
   - Open your project: `yemgssttxhkgrivuodbz`

2. **Go to SQL Editor**
   - Click "SQL Editor" in left sidebar
   - Click "New Query"

3. **Copy and Paste This SQL**
   - Open file: `project/supabase/migrations/add_subdomain_support.sql`
   - Copy ALL the contents
   - Paste into SQL Editor
   - Click "RUN" button

4. **Verify Success**
   - Should see: ✅ "Subdomain support added successfully!"
   - Should see: 📋 "Subdomains will be auto-generated from email addresses"

---

### Step 2: Configure Netlify Wildcard Domain (5 minutes)

1. **Open Netlify Dashboard**
   - Go to: https://app.netlify.com
   - Find your `beezio-marketplace` site

2. **Add Wildcard Subdomain**
   - Click "Domain Settings"
   - Scroll to "Domain aliases"
   - Click "Add domain alias"
   - Enter: `*.beezio.co`
   - Click "Verify" and "Add"

3. **Wait for SSL**
   - Netlify will auto-provision SSL certificate
   - Takes 1-5 minutes
   - Green checkmark = ready!

---

### Step 3: Configure DNS (at your domain registrar)

**Where you bought beezio.co (GoDaddy, Namecheap, Cloudflare, etc.)**

1. **Find DNS Settings**
   - Log in to your domain registrar
   - Find DNS Management / DNS Records

2. **Add Wildcard CNAME Record**
   ```
   Type: CNAME
   Name: *
   Value: beezio-marketplace.netlify.app
   TTL: 3600 (or Auto)
   ```

3. **Save and Wait**
   - DNS changes take 5-30 minutes to propagate
   - Can take up to 48 hours in rare cases

---

### Step 4: Deploy Your Code Changes (2 minutes)

**Your code is updated locally, now push to deploy:**

```bash
cd C:\Users\jason\OneDrive\Desktop\bz

# Stage changes
git add -A

# Commit changes
git commit -m "Add automatic subdomain generation for custom stores"

# Push to deploy
git push origin main
```

**Netlify will automatically deploy** (takes 2-3 minutes)

---

### Step 5: Test It Works! (5 minutes)

1. **Create a Test Account**
   - Go to: https://beezio.co/signup
   - Sign up with: `teststore@gmail.com`
   - Choose role: Seller

2. **Check Your Subdomain**
   - Go to: Settings → Store Settings → Domain tab
   - Should see: `✨ Your Custom Subdomain: teststore.beezio.co`

3. **Visit Your Subdomain**
   - Click the "Open" button, or
   - Manually visit: `https://teststore.beezio.co`
   - Your store should load!

4. **Share Link Test**
   - Click the Share button on your store
   - Should copy: `teststore.beezio.co` (not `/store/abc-123`)

---

## ✅ Success Checklist

Check these off as you complete them:

- [ ] SQL migration run in Supabase (see success message)
- [ ] Wildcard domain `*.beezio.co` added in Netlify
- [ ] SSL certificate provisioned (green checkmark)
- [ ] DNS CNAME record `*.beezio.co` added at registrar
- [ ] Code committed and pushed to GitHub
- [ ] Netlify deployment completed successfully
- [ ] Test account created
- [ ] Subdomain shows in Domain settings tab
- [ ] Subdomain URL loads the store
- [ ] Share button copies subdomain URL

---

## 🎯 What This Achieves

### Before:
```
jason@beezio.co → https://beezio.co/store/abc-123-xyz-789
```
❌ Long, ugly, not memorable

### After:
```
jason@beezio.co → https://jason.beezio.co
```
✅ Short, professional, branded!

---

## 🔍 How to Verify Each Step

### Verify SQL Migration:
```sql
-- Run this in Supabase SQL Editor
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'store_settings' 
AND column_name = 'subdomain';
```
**Expected:** Should return `subdomain` column

### Verify Netlify Domain:
- Netlify Dashboard → Domain Settings
- Should see `*.beezio.co` listed under "Domain aliases"
- SSL status should be "Active" (green)

### Verify DNS:
```bash
# In PowerShell/Terminal
nslookup test.beezio.co
```
**Expected:** Should resolve to Netlify's IP

### Verify Code Deployed:
- Check: https://beezio.co
- Should be latest version with subdomain support
- Check git commit on GitHub (should match local)

---

## 🆘 Troubleshooting

### "Subdomain column not found"
**Fix:** SQL migration didn't run. Go back to Step 1.

### "SSL certificate pending"
**Fix:** Wait 5-10 minutes. Netlify auto-provisions SSL.

### "Domain doesn't resolve"
**Fix:** DNS not configured yet. Complete Step 3, then wait 30 minutes.

### "Store still shows /store/:id URL"
**Fix:** Code not deployed yet. Complete Step 4.

### Git commit fails (OneDrive mmap error)
**Fix:** Try this:
```bash
# Close OneDrive sync temporarily
git add -A
git commit -m "Add subdomain support"
git push
# Re-enable OneDrive
```

---

## 📞 Quick Commands Reference

### Check if dev server running:
```bash
cd C:\Users\jason\OneDrive\Desktop\bz
npm run dev
```

### Deploy to production:
```bash
git add -A
git commit -m "Add subdomain support"
git push origin main
```

### Check Netlify deploy status:
- Visit: https://app.netlify.com/sites/beezio-marketplace/deploys

---

## 🎉 After Setup Complete

Your users will:
1. Sign up with their email
2. Automatically get a branded subdomain
3. See it in Settings → Domain tab
4. Share their professional store URL
5. Optionally upgrade to custom domain later

**Total setup time: ~20 minutes** (plus DNS propagation wait)

---

## Next Steps After Custom Stores Work

Once subdomains work, you can:
- [ ] Test with real seller accounts
- [ ] Promote the subdomain feature to users
- [ ] Add custom domain upgrade option
- [ ] Monitor subdomain usage in analytics
- [ ] Create marketing materials showing `yourname.beezio.co`

**Start with Step 1 and work through in order!**
