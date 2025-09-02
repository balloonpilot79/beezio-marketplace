# 🗄️ BEEZIO DATABASE SETUP GUIDE

## Quick Setup Instructions

### Option 1: Use Supabase CLI (Recommended)
```bash
cd c:\Users\jason\OneDrive\Desktop\bz\project
supabase db reset
```
This will apply all migrations automatically.

### Option 2: Manual SQL Import
1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Open your project: yemgssttxhkgrivuodbz
3. Go to SQL Editor
4. Run these migration files in order:

**CRITICAL: Run in this exact order:**
1. `20250711033741_mute_peak.sql` - Core platform tables
2. `20250714155233_light_recipe.sql` - Additional features
3. `20250714155927_orange_moon.sql` - Extended functionality
4. `20250716023213_frosty_bread.sql` - Pricing system
5. `20250717001855_autumn_voice.sql` - Enhanced features
6. `20250721001855_add_chat_logs.sql` - Chat system
7. `20250722000000_add_reviews_and_ratings.sql` - Reviews
8. `20250722010000_add_badges_gamification.sql` - Gamification
9. `20250723000000_payment_distribution_system.sql` - Payments
10. `20250723000001_safe_payment_distribution_system.sql` - Safe payments
11. `20250729000001_store_settings.sql` - Store customization
12. `20250729000002_universal_integrations.sql` - API integrations
13. `20250729000003_complete_order_system.sql` - Order processing
14. `20250729000004_image_storage_system.sql` - Image handling
15. `20250729000005_subscription_vendor_system.sql` - Subscriptions
16. `20250729000006_powerhouse_launch_data.sql` - Sample data
17. `20250808000001_add_payout_requests.sql` - Payout system

### What These Create:
- ✅ User profiles (buyers, sellers, affiliates)
- ✅ Products with subscription support
- ✅ Vendor management system
- ✅ Order and payment processing
- ✅ Commission tracking
- ✅ Store customization
- ✅ API integrations (Shopify, etc.)
- ✅ Sample marketplace data

## After Setup:
Your site will have:
- 🛍️ 10+ realistic products with subscriptions
- 👥 Sample users (sellers, affiliates)
- 🏪 Vendor partnerships
- 💰 Commission tracking
- 🔧 All dashboard features working live
