# Netlify Deployment & Testing Checklist

## 📋 **Pre-Deployment Setup**

### ✅ **Local Build Test**
- [ ] Run `npm run build` successfully
- [ ] Test `npm run preview` to verify build works
- [ ] Check console for any warnings/errors

### ✅ **Environment Variables**
- [ ] Supabase URL and anon key ready
- [ ] Stripe publishable key (test mode)
- [ ] Stripe secret key (test mode) 
- [ ] Stripe webhook secret (if using webhooks)

## 🚀 **Netlify Deployment Steps**

### 1. **Manual Deploy (Recommended for first time)**
- [ ] Build project: `npm run build`
- [ ] Drag & drop `dist` folder to Netlify
- [ ] Configure environment variables in Netlify dashboard

### 2. **Git Deploy (Alternative)**
- [ ] Push code to GitHub/GitLab
- [ ] Connect repository to Netlify
- [ ] Set build command: `npm run build`
- [ ] Set publish directory: `dist`

## 🧪 **Critical Testing Areas**

### **🔐 Authentication & User Management**
- [ ] Sign up new account
- [ ] Login with existing account
- [ ] Test role switching (affiliate/seller/buyer)
- [ ] Password reset functionality
- [ ] Profile updates and settings

### **🛒 E-commerce & Products**
- [ ] Browse product categories
- [ ] View individual product pages
- [ ] Add products to cart
- [ ] Cart functionality (add/remove/update quantities)
- [ ] Search and filter products

### **💳 Payment Processing (CRITICAL)**
- [ ] Checkout flow with test cards
- [ ] Stripe test card: 4242424242424242
- [ ] Payment confirmation emails
- [ ] Order history appears correctly
- [ ] Commission calculations for affiliates

### **🤝 Affiliate System**
- [ ] Generate affiliate links
- [ ] Test commission tracking
- [ ] Affiliate dashboard data
- [ ] QR code generation for products
- [ ] Earnings calculations

### **📊 Fundraisers & Causes**
- [ ] Fundraiser page loads (no more infinite loading!)
- [ ] Create new fundraiser
- [ ] Donate to existing fundraisers
- [ ] Progress tracking and goal display

### **📱 Mobile & Responsive**
- [ ] Test on actual mobile devices
- [ ] Touch interactions work properly
- [ ] Forms are mobile-friendly
- [ ] Images load correctly on mobile

### **🐛 Bug Hunting Areas**
- [ ] Check browser console for JavaScript errors
- [ ] Test navigation between all pages
- [ ] Verify all buttons and links work
- [ ] Test form validations
- [ ] Check image loading and fallbacks

## 🔧 **Common Issues to Watch For**

### **Environment Variables**
- Missing VITE_ prefix for client-side variables
- Stripe keys not loading properly
- Supabase connection failures

### **Routing Issues**
- 404 errors on page refresh (needs netlify.toml redirects)
- Broken internal links
- Missing pages or components

### **Build Errors**
- Missing dependencies
- TypeScript errors in production
- Import/export issues

### **Performance Issues**
- Slow image loading
- Large bundle sizes
- Unoptimized assets

## 📝 **Post-Deployment Notes**

### **Stripe Setup**
- [ ] Add Netlify domain to Stripe dashboard
- [ ] Configure webhook endpoints if needed
- [ ] Test with real payment flow

### **Supabase Setup**
- [ ] Add Netlify domain to allowed origins
- [ ] Verify RLS policies work correctly
- [ ] Test database operations

### **DNS & Domain (if custom domain)**
- [ ] Configure custom domain in Netlify
- [ ] SSL certificate auto-generated
- [ ] HTTPS redirect working

## 🚨 **Red Flags to Fix Immediately**
- [ ] Any 500 server errors
- [ ] Payment processing failures
- [ ] Database connection errors
- [ ] Authentication not working
- [ ] Missing or broken images
- [ ] Mobile layout broken

## 📞 **Testing Contacts**
Test with real users if possible:
- [ ] Ask friends/family to test signup
- [ ] Test from different devices/browsers
- [ ] Get feedback on user experience

---

**🎯 Priority Order:**
1. Build and deploy successfully
2. Authentication works
3. Payments process correctly
4. Affiliate system functions
5. Mobile experience is good
6. All pages load without errors
