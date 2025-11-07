# Fix Supabase Migration Issues

## Why `npx supabase migration up` is spinning:

1. **Wrong directory** - Must be in project root with supabase/config.toml
2. **Not logged in** - Need to run `supabase login` first  
3. **No local instance** - Need `supabase start` for local dev
4. **Network issues** - Trying to connect to remote but config is wrong

## SOLUTION: Skip migrations and run SQL directly

Instead of fighting with migrations, **run the SQL directly in Supabase dashboard**:

### Steps:
1. Go to https://supabase.com/dashboard
2. Select your **beezio-marketplace** project
3. Go to **SQL Editor** (left sidebar)  
4. Copy and paste the contents of `manual_database_setup.sql`
5. Click **Run** to execute all the SQL commands

This will:
✅ Add `affiliate_enabled` column to products table
✅ Add `sku` column for product SKUs  
✅ Create referrals system tables
✅ Set up RLS policies
✅ Generate referral codes for existing users

### Alternative (if you want to fix Supabase CLI):
```bash
# Navigate to project folder
cd "C:\Users\jason\OneDrive\Desktop\bz\project"

# Check if supabase is initialized
ls supabase/

# If no supabase folder, initialize:
npx supabase init

# Login (opens browser)
npx supabase login

# Link to your remote project
npx supabase link --project-ref YOUR_PROJECT_REF

# Then migrations would work:
npx supabase migration up
```

But honestly, **just run the SQL directly** - it's faster and more reliable! 🎯