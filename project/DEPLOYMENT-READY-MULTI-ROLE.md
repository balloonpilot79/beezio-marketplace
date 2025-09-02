# 🚀 MULTI-ROLE SYSTEM - READY FOR BEEZIO.CO-- Migrate existing users
INSERT INTO user_roles (user_id, role, is_active, created_at)
SELECT user_id, COALESCE(primary_role::text, role::text, 'buyer'), true, created_at
FROM profiles WHERE user_id IS NOT NULL
ON CONFLICT (user_id, role) DO NOTHING;OYMENT

## ✅ **WHAT YOU NEED TO DO:**

### 1. **CRITICAL: Run Database Migration First** ⚠️
Before deploying the new code, you **MUST** run the database migration on your production Supabase:

1. Go to **https://supabase.com/dashboard**
2. Select your project: **yemgssttxhkgrivuodbz**
3. Click **"SQL Editor"** in the left sidebar  
4. Create a **new query**
5. **Copy and paste this SQL** (from `BEEZIO-CO-DEPLOYMENT-GUIDE.md`):

```sql
-- Create user_roles table
CREATE TABLE IF NOT EXISTS user_roles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('buyer', 'seller', 'affiliate', 'fundraiser')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, role),
  CONSTRAINT fk_user_roles_user_id FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Add primary_role to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS primary_role TEXT CHECK (primary_role IN ('buyer', 'seller', 'affiliate', 'fundraiser'));

-- Update existing profiles
UPDATE profiles SET primary_role = role WHERE primary_role IS NULL AND role IS NOT NULL;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role);

-- Enable RLS
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Add policies
CREATE POLICY "Users can read own roles" ON user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own roles" ON user_roles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own roles" ON user_roles FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Migrate existing users
INSERT INTO user_roles (user_id, role, is_active, created_at)
SELECT user_id, COALESCE(primary_role, role, 'buyer'), true, created_at
FROM profiles WHERE user_id IS NOT NULL
ON CONFLICT (user_id, role) DO NOTHING;
```

6. Click **"Run"** to execute
7. ✅ **Confirm success** - should see "Success. No rows returned"

### 2. **Deploy to Netlify**
Once database is updated:

**Option A - Drag & Drop (Easiest):**
1. Go to **https://app.netlify.com**
2. Find your **beezio.co** site
3. **Drag the entire `dist/` folder** to the deploy area
4. Wait for deployment complete

**Option B - CLI:**
```bash
cd "c:\Users\jason\OneDrive\Desktop\bz\project"
netlify deploy --prod --dir=dist
```

---

## 🎉 **WHAT USERS WILL GET:**

### **New Signup Experience**
- Beautiful modal with role selection cards
- Choose: Buyer, Seller, Affiliate, or Fundraiser
- Minimal required fields (email + password)
- Instant access to full dashboard

### **Multi-Role Dashboard**
- Header shows current active role with colored badge
- Click role dropdown to switch instantly
- "Add New Role" to expand capabilities
- All existing features preserved

### **Flexible User Journey**
- Start as buyer → add seller role later
- Switch between roles without losing data
- One account for all platform features
- No separate signups needed

---

## 🔧 **TESTING CHECKLIST**

After deployment, test:

### ✅ **New Users**
1. Visit beezio.co
2. Click "Join Beezio" 
3. Should see new role selection modal
4. Try different starting roles
5. Verify dashboard loads correctly

### ✅ **Existing Users** 
1. Login with existing account
2. Should see role dropdown in header
3. Can add new roles via "+" button
4. All existing data preserved

### ✅ **Role Switching**
1. Switch between available roles
2. Dashboard content changes appropriately
3. No data loss during switches
4. Header updates role indicator

---

## ⚠️ **BACKUP PLAN**

If anything goes wrong:
1. **Revert deployment**: Use Netlify's rollback feature
2. **Database is safe**: Migration only adds tables/columns
3. **Existing users**: Will continue working with single roles
4. **New signups**: Will fall back to legacy modal if needed

---

## 🎯 **BUSINESS IMPACT**

This update will:
- ✅ **Increase user engagement** - easier to try multiple roles
- ✅ **Reduce barriers to entry** - simpler signup process  
- ✅ **Improve retention** - users invested in multiple capabilities
- ✅ **Generate more revenue** - cross-role monetization opportunities

---

## 📞 **NEED HELP?**

If you encounter any issues:
1. Check browser console for errors
2. Verify database migration completed successfully  
3. Test with both new and existing accounts
4. Use Netlify's rollback if needed

**The system is backwards compatible** - existing users will automatically get multi-role capabilities while new users get the streamlined experience! 🚀
