# 🚀 Multi-Role System Deployment Guide for beezio.co

## ⚠️ IMPORTANT: Database Migration Required

The multi-role system needs database changes on your production Supabase instance. Here's what you need to do:

## 📋 **Pre-Deployment Checklist**

### 1. **Database Migration (CRITICAL)**
The multi-role system requires new database tables and columns. You need to run this SQL on your production Supabase database:

```sql
-- Multi-Role User System Setup
-- Run this in your Supabase SQL editor at https://supabase.com/dashboard

-- Create user_roles table to track multiple roles per user
CREATE TABLE IF NOT EXISTS user_roles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('buyer', 'seller', 'affiliate', 'fundraiser')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure a user can only have one record per role
  UNIQUE(user_id, role),
  
  -- Foreign key to auth.users
  CONSTRAINT fk_user_roles_user_id FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Add primary_role column to profiles (keeping role for backwards compatibility)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'primary_role'
    ) THEN
        ALTER TABLE profiles ADD COLUMN primary_role TEXT CHECK (primary_role IN ('buyer', 'seller', 'affiliate', 'fundraiser'));
    END IF;
END $$;

-- Update existing profiles to set primary_role = role
UPDATE profiles SET primary_role = role WHERE primary_role IS NULL AND role IS NOT NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_primary_role ON profiles(primary_role);

-- Enable RLS on user_roles table
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_roles table
DROP POLICY IF EXISTS "Users can read own roles" ON user_roles;
CREATE POLICY "Users can read own roles"
  ON user_roles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own roles" ON user_roles;
CREATE POLICY "Users can insert own roles"
  ON user_roles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own roles" ON user_roles;
CREATE POLICY "Users can update own roles"
  ON user_roles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Migrate existing users to have their current role in user_roles table
INSERT INTO user_roles (user_id, role, is_active, created_at)
SELECT user_id, COALESCE(primary_role::text, role::text, 'buyer'), true, created_at
FROM profiles
WHERE user_id IS NOT NULL
ON CONFLICT (user_id, role) DO NOTHING;

-- Add triggers to keep updated_at current
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_user_roles_updated_at ON user_roles;
CREATE TRIGGER update_user_roles_updated_at 
  BEFORE UPDATE ON user_roles 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add trigger to profiles if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.triggers 
        WHERE trigger_name = 'update_profiles_updated_at'
    ) THEN
        CREATE TRIGGER update_profiles_updated_at 
          BEFORE UPDATE ON profiles 
          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;
```

### 2. **How to Run the Migration**
1. Go to https://supabase.com/dashboard
2. Select your project (yemgssttxhkgrivuodbz)
3. Go to "SQL Editor" in the left sidebar
4. Create a new query
5. Copy and paste the entire SQL above
6. Click "Run" to execute

### 3. **Build for Production**
```bash
cd "c:\Users\jason\OneDrive\Desktop\bz\project"
npm run build
```

### 4. **Deploy to Netlify**
Option A - Drag & Drop:
1. Go to https://app.netlify.com
2. Find your beezio.co site
3. Drag the entire `dist/` folder to deploy

Option B - CLI:
```bash
netlify deploy --prod --dir=dist
```

## ✅ **What's Changed for Production**

### **New Features Available on beezio.co:**
- ✅ **Unified Dashboard**: Single `/dashboard` route with role switching
- ✅ **Multi-Role Authentication**: Users can have multiple roles
- ✅ **Simplified Signup**: New streamlined registration process
- ✅ **Role Switching**: Header dropdown to switch between roles
- ✅ **Add Roles**: Users can add new roles without separate accounts

### **Backwards Compatibility:**
- ✅ **Existing users**: Automatically get multi-role capabilities
- ✅ **Legacy routes**: `/dashboard` still works for existing users
- ✅ **Data preservation**: All existing orders, products, etc. remain

### **Environment Detection:**
The system automatically detects production vs development:
- **beezio.co**: Uses production Supabase and email redirect URLs
- **localhost**: Uses local development setup

## 🔧 **Verification Steps After Deployment**

### 1. **Test New User Registration**
1. Visit https://beezio.co
2. Click "Join Beezio" button
3. Should see new simplified signup modal with role selection
4. Try registering with different starting roles

### 2. **Test Role Switching**
1. Log in to existing account
2. Go to `/dashboard`
3. Should see role dropdown in header
4. Try switching between available roles
5. Try adding new roles via "+" button

### 3. **Test Existing User Migration**
1. Log in with existing account
2. Should automatically have their previous role available
3. Dashboard should work normally
4. Can add additional roles if desired

## ⚠️ **Potential Issues and Solutions**

### **Issue: Database Migration Fails**
- **Solution**: Run the SQL commands one section at a time
- **Check**: Make sure you're connected to the right Supabase project

### **Issue: New Signup Modal Not Showing**
- **Solution**: Clear browser cache and hard refresh
- **Check**: Make sure `dist/` folder was properly deployed

### **Issue: Role Switching Doesn't Work**
- **Solution**: Check browser console for errors
- **Check**: Ensure database migration completed successfully

### **Issue: Existing Users Can't Access Dashboard**
- **Solution**: They may need to log out and log back in once
- **Check**: Verify their role was migrated to `user_roles` table

## 📞 **If You Need Help**

If any issues occur during deployment:
1. **Check browser console** for error messages
2. **Check Supabase logs** in the dashboard
3. **Verify database migration** completed successfully
4. **Test with both new and existing user accounts**

The multi-role system is designed to be backwards compatible, so existing users should have a smooth transition while gaining access to the new multi-role capabilities.

## 🎉 **Post-Deployment Benefits**

Once deployed, your users will be able to:
- **Start with any role** during signup
- **Add new roles** as their needs evolve
- **Switch between roles** seamlessly
- **Maintain all data** across role changes
- **Explore the platform** without commitment to single role

This creates a much more flexible and user-friendly platform! 🚀
