# 🚀 QUICK DEPLOYMENT REFERENCE - TOMORROW

## **PHASE 1: NETLIFY SETUP (15 minutes)**

### **Step 1: Connect Repository**
1. Go to https://app.netlify.com
2. Click "Add new site" → "Import from Git"
3. Connect your GitHub repository
4. Select main branch

### **Step 2: Build Configuration**
```
Build command: npm run build
Publish directory: dist
Node version: 18
```

### **Step 3: Environment Variables**
```
VITE_SUPABASE_URL=https://yemgssttxhkgrivuodbz.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InllbWdzc3R0eGhrZ3JpdnVvZGJ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE5MzQwMjEsImV4cCI6MjA2NzUxMDAyMX0.EyargNCg2m77Tz-JoO5qs6Auxdcd3StvDKx9ZHkKcNM
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_51RmQ5ZGfNVbOuQlVyEEB8hvXCPgeBKhfnOOUUASIYubRwB1eNvpdhvY1cYjoqfF76Jd7607GFvxIAeJOb2Qr4L0M001Two7BPP
```

## **PHASE 2: TESTING CHECKLIST (10 minutes)**

### **Must Test:**
- [ ] **Signup** → Create new account
- [ ] **Login** → Sign in with new account
- [ ] **Add Product** → Go to `/seller/products/new`
- [ ] **Browse Marketplace** → Check product listings
- [ ] **Mobile View** → Test on phone
- [ ] **Logout** → Sign out successfully

### **Quick Test URLs:**
- **Home**: /
- **Marketplace**: /marketplace
- **Seller Products**: /seller/products
- **Add Product**: /seller/products/new
- **Dashboard**: /dashboard

## **PHASE 3: DOMAIN SETUP (5 minutes)**

1. Go to Site Settings → Domain management
2. Add custom domain: `beezio.co`
3. Configure DNS records as instructed
4. Wait for SSL certificate (usually instant)

## **🚨 QUICK FIXES:**

### **If Build Fails:**
- Check environment variables are correct
- Verify Node version is 18
- Check GitHub repository is accessible

### **If Site Doesn't Load:**
- Check domain DNS propagation
- Verify environment variables
- Check Supabase connection

### **If Features Don't Work:**
- Check browser console for errors
- Verify database tables exist
- Test Supabase connection

## **🎯 SUCCESS CHECKLIST:**

- [ ] Site loads at beezio.co ✅
- [ ] Users can sign up ✅
- [ ] Users can login/logout ✅
- [ ] Sellers can add products ✅
- [ ] Marketplace shows products ✅
- [ ] Mobile works perfectly ✅
- [ ] No console errors ✅

## **📞 SUPPORT RESOURCES:**

- **Netlify Docs**: https://docs.netlify.com
- **Supabase Status**: https://status.supabase.com
- **GitHub Repo**: Your repository URL

---

**DEPLOYMENT TIME ESTIMATE: 30 minutes**
**GO-LIVE TIME: 10:00 AM tomorrow!** 🚀
