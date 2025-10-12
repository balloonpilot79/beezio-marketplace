🚀 SUPABASE EDGE FUNCTIONS DEPLOYMENT GUIDE
============================================

🎯 GOAL: Deploy 4 Edge Functions to complete your checkout system

📋 FUNCTIONS TO DEPLOY:
======================
✅ create-payment-intent (Creates secure Stripe payment intents)
✅ complete-order-corrected (Processes completed orders)
✅ stripe-webhook (Handles Stripe payment confirmations)
✅ process-marketplace-payment (Manages payment distribution)

🔥 OPTION A: QUICK CLI DEPLOYMENT (5 minutes - RECOMMENDED)
===========================================================

STEP 1: Install Supabase CLI
----------------------------
Windows (PowerShell as Administrator):
```powershell
# Method 1: Using Scoop (if you have it)
scoop install supabase

# Method 2: Direct Download
# Go to: https://github.com/supabase/cli/releases
# Download supabase_windows_amd64.tar.gz
# Extract and add to PATH
```

STEP 2: Login to Supabase
--------------------------
```bash
supabase login
```
(This will open browser to authenticate)

STEP 3: Link Your Project
--------------------------
```bash
cd "C:\Users\jason\OneDrive\Desktop\bz\project"
supabase link --project-ref yemgssttxhkgrivuodbz
```

STEP 4: Deploy All Functions
-----------------------------
```bash
supabase functions deploy
```

STEP 5: Verify Deployment
--------------------------
```bash
supabase functions list
```

🖥️ OPTION B: MANUAL DASHBOARD DEPLOYMENT (20 minutes)
======================================================

STEP 1: Open Supabase Dashboard
-------------------------------
Go to: https://supabase.com/dashboard/project/yemgssttxhkgrivuodbz

STEP 2: Navigate to Edge Functions
----------------------------------
- Click "Edge Functions" in the left sidebar
- Click "Create a new function"

STEP 3: Deploy create-payment-intent
------------------------------------
1. Function name: create-payment-intent
2. Copy code from: supabase/functions/create-payment-intent/index.ts
3. Paste into editor
4. Click "Deploy function"

STEP 4: Deploy complete-order-corrected
---------------------------------------
1. Click "Create a new function"
2. Function name: complete-order-corrected
3. Copy code from: supabase/functions/complete-order-corrected/index.ts
4. Paste into editor
5. Click "Deploy function"

STEP 5: Deploy stripe-webhook
-----------------------------
1. Click "Create a new function"
2. Function name: stripe-webhook
3. Copy code from: supabase/functions/stripe-webhook/index.ts
4. Paste into editor
5. Click "Deploy function"

STEP 6: Deploy process-marketplace-payment
------------------------------------------
1. Click "Create a new function"
2. Function name: process-marketplace-payment
3. Copy code from: supabase/functions/process-marketplace-payment/index.ts
4. Paste into editor
5. Click "Deploy function"

🔧 ENVIRONMENT VARIABLES (IMPORTANT!)
=====================================
Make sure these are set in Supabase Dashboard > Settings > Edge Functions:

Required Variables:
- STRIPE_SECRET_KEY: sk_test_... (your Stripe secret key)
- SUPABASE_URL: https://yemgssttxhkgrivuodbz.supabase.co
- SUPABASE_SERVICE_ROLE_KEY: (your service role key)

📋 VERIFICATION STEPS
=====================
After deployment, run this to test:

```bash
cd "C:\Users\jason\OneDrive\Desktop\bz\project"
node comprehensive-checkout-verification.js
```

Should show:
✅ create-payment-intent function: WORKING
✅ complete-order-corrected function: WORKING
✅ stripe-webhook function: WORKING
✅ process-marketplace-payment function: WORKING

🎯 EXPECTED RESULT
==================
After successful deployment:
- Checkout system: 100% functional
- Payment processing: End-to-end working
- Order completion: Automatic
- Fee distribution: Accurate
- Email notifications: Active

⏱️ RECOMMENDATION: Try Option A (CLI) first - it's much faster!

🚀 READY? Let's deploy these functions and complete your marketplace!