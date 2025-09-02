# 🚀 Stripe & Supabase Setup & Testing Guide

## ✅ Current Status
- ✅ **Development Server**: Running on http://localhost:5173/
- ✅ **Environment Variables**: Configured (.env file)
- ✅ **Supabase**: Connected to https://yemgssttxhkgrivuodbz.supabase.co
- ✅ **Stripe**: Test mode configured

## 📋 Quick Setup Steps

### 1. Database Setup
Go to your Supabase dashboard: https://supabase.com/dashboard/project/yemgssttxhkgrivuodbz

1. Click **SQL Editor** in the sidebar
2. Copy and paste the contents of `database-setup.sql`
3. Click **RUN** to create all tables and policies

### 2. Test the Application

#### 🔐 User Registration & Authentication
1. Open http://localhost:5173/
2. Click **Sign Up** or any dashboard button
3. Create a new account with a real email
4. Check your email for verification link
5. Complete email verification

#### 🛍️ Test as a Buyer
1. Sign in to your account
2. Navigate to **Buyer Dashboard**
3. Try to add a payment method (use test card: `4242 4242 4242 4242`)
4. Browse the marketplace
5. Add items to cart

#### 💼 Test as a Seller
1. Go to **Seller Dashboard** 
2. Click **Connect Stripe Account**
3. Complete Stripe onboarding (use test data)
4. Create a new product with shipping options
5. Set different shipping methods (including free shipping)

#### 💰 Test as an Affiliate
1. Go to **Affiliate Dashboard**
2. Connect your Stripe account for payouts
3. Browse products with commission rates
4. Generate affiliate links

## 🧪 Stripe Test Data

### Test Credit Cards
- **Success**: `4242 4242 4242 4242`
- **Decline**: `4000 0000 0000 0002`
- **Requires 3D Secure**: `4000 0025 0000 3155`
- **Insufficient Funds**: `4000 0000 0000 9995`

### Test Details
- **Expiry**: Any future date (e.g., 12/25)
- **CVC**: Any 3 digits (e.g., 123)
- **ZIP**: Any valid ZIP (e.g., 12345)

### Stripe Connect Test Data
When setting up seller/affiliate accounts, use:
- **Business Type**: Individual
- **First Name**: Test
- **Last Name**: Seller
- **DOB**: 01/01/1990
- **Address**: 123 Test St, Test City, NY, 12345
- **Phone**: (555) 123-4567
- **SSN**: 000-00-0000 (test mode)

## 🔍 Testing Checklist

### Core Functionality
- [ ] User registration works
- [ ] Email verification works  
- [ ] Login/logout works
- [ ] Role switching works (buyer/seller/affiliate)

### Seller Features
- [ ] Stripe Connect onboarding
- [ ] Product creation with shipping options
- [ ] Free shipping configuration
- [ ] Paid shipping options
- [ ] Product images upload
- [ ] Inventory management

### Buyer Features  
- [ ] Payment method addition
- [ ] Shopping cart functionality
- [ ] Shipping option selection
- [ ] Checkout process
- [ ] Order confirmation
- [ ] Payment processing

### Affiliate Features
- [ ] Stripe Connect setup
- [ ] Commission tracking
- [ ] Affiliate link generation
- [ ] Earnings dashboard
- [ ] Payout requests

### Payment Flow
- [ ] Product price calculation
- [ ] Shipping cost addition at checkout
- [ ] Multi-party payment distribution
- [ ] Seller payouts
- [ ] Affiliate commissions
- [ ] Platform fees

## 🐛 Common Issues & Solutions

### "Table doesn't exist" errors
**Solution**: Run the `database-setup.sql` in Supabase SQL Editor

### Stripe Connect errors
**Solution**: Make sure you're using test mode keys and test business data

### Email verification not working
**Solution**: Check your email spam folder, or use a different email provider

### Payment failures
**Solution**: Use the test card numbers listed above, not real card numbers

### CORS errors
**Solution**: Make sure you're accessing via http://localhost:5173/ (not 127.0.0.1)

## 📊 Monitoring & Debugging

### Supabase Debugging
1. Go to **Logs** in Supabase dashboard
2. Filter by **Database**, **API**, or **Auth**
3. Look for error messages

### Stripe Debugging  
1. Open Stripe Dashboard: https://dashboard.stripe.com/test
2. Check **Events** for webhook activity
3. Review **Payments** for transaction status
4. Monitor **Connect** for account status

### Browser Console
1. Open Developer Tools (F12)
2. Check **Console** for JavaScript errors
3. Review **Network** tab for API failures

## 🎯 Success Metrics

When everything is working, you should be able to:

1. ✅ Create accounts for buyers, sellers, and affiliates
2. ✅ Connect bank accounts via Stripe
3. ✅ Create products with multiple shipping options
4. ✅ Process payments securely
5. ✅ Calculate and distribute commissions
6. ✅ Track earnings and request payouts
7. ✅ Manage shipping costs separately from product prices

## 🚀 Next Steps After Testing

1. **Production Setup**: Switch to live Stripe keys
2. **Domain Setup**: Configure custom domain
3. **Webhook Setup**: Add production webhook endpoints
4. **Email Setup**: Configure custom email templates
5. **SSL Setup**: Enable HTTPS for production
6. **Monitoring**: Set up error tracking and analytics

## 📞 Support

If you encounter issues:
1. Check this guide first
2. Review browser console for errors
3. Check Supabase logs
4. Verify Stripe dashboard events
5. Test with different browsers/devices

**Happy Testing! 🎉**
