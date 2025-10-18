# 🌐 Fix beezio.co Domain Configuration

## 🚨 Current Problem

- ✅ **beezio-marketplace.netlify.app** → Shows CORRECT dashboard
- ❌ **beezio.co** → Shows WRONG/outdated dashboard

This means beezio.co is either:
1. Pointing to the wrong Netlify site
2. Cached/propagating old content
3. Not configured in Netlify at all

---

## 🎯 Step-by-Step Fix

### Step 1: Check Netlify Domain Settings (5 minutes)

#### 1.1 Go to Your Netlify Dashboard
1. **Login** to Netlify: https://app.netlify.com
2. **Find your site**: Look for "beezio-marketplace" in the sites list
3. **Click on it**

#### 1.2 Check Domain Management
1. Click **"Domain management"** in the left sidebar (or under Site settings)
2. Look at the **"Custom domains"** section
3. Check if **beezio.co** is listed

**What you should see:**
```
Primary domain: beezio-marketplace.netlify.app

Custom domains:
├── beezio.co (should be here)
└── www.beezio.co (optional)
```

---

### Step 2: Possible Scenarios & Fixes

#### Scenario A: beezio.co is NOT in the list
**Problem**: Domain not added to this site  
**Fix**:
1. Click **"Add custom domain"**
2. Enter: `beezio.co`
3. Click **"Verify"**
4. Netlify will check DNS
5. Click **"Add domain"**

#### Scenario B: beezio.co IS in the list
**Problem**: May be pointing to wrong site or DNS cache  
**Fix**:
1. Check if HTTPS/SSL is enabled (green lock icon)
2. If pending, wait for SSL provisioning
3. Clear your browser cache or test in incognito
4. Wait 5-10 minutes for CDN cache to clear

#### Scenario C: You have MULTIPLE Netlify sites
**Problem**: beezio.co might be on a different site  
**Fix**:
1. Go back to Netlify dashboard home
2. Check ALL your sites (look for any other beezio sites)
3. If you find beezio.co on another site:
   - Go to that site → Domain management
   - **Remove** beezio.co from that site
   - Go back to beezio-marketplace site
   - Add beezio.co as custom domain

---

### Step 3: Verify DNS Records (At Your Domain Registrar)

#### 3.1 Where did you buy beezio.co?
Common registrars: GoDaddy, Namecheap, Google Domains, Cloudflare, etc.

#### 3.2 Login to your domain registrar
1. Find DNS settings (usually called "DNS Management" or "DNS Records")
2. Check the current records for beezio.co

#### 3.3 Required DNS Records
Your DNS should point to Netlify:

**Option A - A Record (Recommended):**
```
Type: A
Name: @ (or leave blank for root)
Value: 75.2.60.5
TTL: 3600 (or auto)
```

**Option B - CNAME (Alternative for www):**
```
Type: CNAME
Name: www
Value: beezio-marketplace.netlify.app
TTL: 3600 (or auto)
```

**For Apex Domain (beezio.co without www):**
Some registrars support ALIAS or ANAME records:
```
Type: ALIAS or ANAME
Name: @
Value: beezio-marketplace.netlify.app
```

#### 3.4 Common DNS Issues
- ❌ **Wrong IP**: Should be `75.2.60.5` (Netlify load balancer)
- ❌ **Points to old host**: Remove old A records
- ❌ **Multiple A records**: Should only have Netlify's IP
- ⏳ **DNS propagation**: Can take 5-48 hours

---

### Step 4: Force Clear Caches

#### 4.1 Clear Netlify Cache
In Netlify dashboard:
1. Go to **Deploys** tab
2. Click **"Trigger deploy"** dropdown
3. Select **"Clear cache and deploy site"**
4. Wait for deploy to complete (~2 minutes)

#### 4.2 Clear Browser Cache
```
Chrome/Edge: Ctrl + Shift + Delete
Firefox: Ctrl + Shift + Delete
Safari: Cmd + Option + E

OR just use Incognito/Private window
```

#### 4.3 Clear DNS Cache (On Your Computer)

**Windows (cmd.exe):**
```cmd
ipconfig /flushdns
```

**Mac/Linux:**
```bash
sudo dscacheutil -flushcache
```

---

### Step 5: Test Domain Configuration

#### 5.1 DNS Propagation Checker
Use online tool to check DNS globally:
- https://dnschecker.org
- Enter: `beezio.co`
- Check if it shows Netlify IP: `75.2.60.5`

#### 5.2 Direct Test
```
Open browser
Go to: https://beezio.co
Force refresh: Ctrl + Shift + R (Windows) or Cmd + Shift + R (Mac)
```

#### 5.3 What You Should See
Both URLs should show the SAME dashboard:
- https://beezio-marketplace.netlify.app/dashboard ✅
- https://beezio.co/dashboard ✅

---

## 🔧 Quick Diagnosis Checklist

Run through this checklist:

### In Netlify Dashboard:
- [ ] beezio-marketplace site exists
- [ ] beezio.co is in Custom Domains list
- [ ] SSL certificate shows "Secured" (green)
- [ ] No other sites have beezio.co attached

### In Domain Registrar DNS:
- [ ] A record points to 75.2.60.5
- [ ] No old/conflicting A records
- [ ] DNS changes saved

### Testing:
- [ ] Incognito window shows correct dashboard
- [ ] dnschecker.org shows Netlify IP
- [ ] Both URLs load same content
- [ ] No SSL certificate errors

---

## 🚨 Common Issues & Solutions

### Issue 1: "Domain already registered on Netlify"
**Cause**: Domain is on another Netlify account/site  
**Fix**: 
- Remove from old site first
- Wait 5 minutes
- Add to beezio-marketplace

### Issue 2: SSL certificate pending for hours
**Cause**: DNS not pointing correctly  
**Fix**:
- Verify DNS A record = 75.2.60.5
- Wait for DNS propagation
- Can take up to 24 hours

### Issue 3: Shows old site even after changes
**Cause**: Browser/CDN cache  
**Fix**:
- Clear browser cache
- Clear Netlify cache (trigger deploy)
- Test in incognito
- Wait 10-15 minutes

### Issue 4: beezio.co redirects to netlify.app
**Cause**: Primary domain not set correctly  
**Fix**:
- In Netlify → Domain management
- Make sure beezio.co shows as custom domain
- Don't set it as "primary" (keep .netlify.app as primary for now)

---

## 📋 What Information to Share

If you need help, share:

1. **Netlify Dashboard Screenshot**:
   - Domain management section
   - Show custom domains list
   - Show SSL status

2. **DNS Records Screenshot**:
   - From your domain registrar
   - Show all A, CNAME, ALIAS records for beezio.co

3. **What You See**:
   - URL you're testing (beezio.co/dashboard)
   - Screenshot of what loads
   - Any error messages

4. **Browser Console Errors**:
   - Press F12 → Console tab
   - Screenshot any red errors

---

## ⏱️ Time Expectations

| Action | Time |
|--------|------|
| Add domain in Netlify | 2 minutes |
| Update DNS records | 5 minutes |
| DNS propagation | 5 minutes - 48 hours |
| SSL certificate provision | 5 minutes - 24 hours |
| CDN cache clear | 5-10 minutes |

**Fastest scenario**: 15-20 minutes  
**Typical scenario**: 1-2 hours  
**Worst case**: 24-48 hours (DNS propagation)

---

## ✅ Success Criteria

You'll know it's fixed when:

1. ✅ beezio.co loads without errors
2. ✅ SSL shows green lock (HTTPS)
3. ✅ Dashboard at beezio.co/dashboard looks identical to beezio-marketplace.netlify.app/dashboard
4. ✅ Same navigation, same features, same data
5. ✅ Works in incognito/private window
6. ✅ dnschecker.org shows consistent results globally

---

## 🎯 Let's Start!

**Tell me which scenario applies to you:**

A. "I need to check Netlify dashboard - not sure if beezio.co is added"
B. "beezio.co IS in Netlify but showing wrong content"
C. "I need to update DNS records at my registrar"
D. "Everything looks right but still not working"

**Or just share screenshots of:**
1. Netlify Domain Management page
2. Your DNS records at domain registrar

I'll help you fix it! 🚀

---

*Next: After fixing domain, we'll deploy the new CustomDomainManager frontend*
