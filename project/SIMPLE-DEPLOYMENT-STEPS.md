# 🚀 AUTOMATIC DEPLOYMENT SETUP - Connect GitHub to Netlify

## ❗ One-Time Setup (15 minutes) - Then Never Drag & Drop Again!

### **STEP 1: Create GitHub Repository (5 minutes)**

1. **Go to GitHub**
   - Open: https://github.com
   - Log in to your account
   - Click the green "New" button (or "+" icon → "New repository")

2. **Create Repository**
   - Repository name: `beezio-marketplace`
   - Description: `Multi-role marketplace with buyer/seller/affiliate system`
   - Make it **Public** (recommended) or Private
   - **DO NOT** check "Add a README file" 
   - **DO NOT** check "Add .gitignore"
   - **DO NOT** check "Choose a license"
   - Click "Create repository"

3. **Copy the Repository URL**
   - After creation, you'll see commands like this:
   - Copy the HTTPS URL (looks like: `https://github.com/yourusername/beezio-marketplace.git`)

---

### **STEP 2: Upload Your Project to GitHub (5 minutes)**

1. **Open Terminal/Command Prompt**
   - Press Windows Key + R
   - Type `cmd` and press Enter

2. **Navigate to Your Project and Initialize Git**
   ```cmd
   cd /d "c:\Users\jason\OneDrive\Desktop\bz\project"
   git init
   git add .
   git commit -m "Initial commit - Multi-role marketplace"
   ```

3. **Connect to GitHub and Push**
   ```cmd
   git remote add origin YOUR_GITHUB_URL_HERE
   git branch -M main
   git push -u origin main
   ```
   - Replace `YOUR_GITHUB_URL_HERE` with the URL you copied from Step 1
   - You may need to enter your GitHub username and password/token

---

### **STEP 3: Connect Netlify to GitHub (5 minutes)**

1. **Go to Netlify Dashboard**
   - Open: https://app.netlify.com
   - Log in to your account

2. **Delete Your Current Site (if you have one)**
   - Find your beezio.co site
   - Click on it → Site settings → General → Delete this site
   - Type the site name to confirm deletion

3. **Create New Site from GitHub**
   - Click "Add new site" → "Import an existing project"
   - Click "Deploy with GitHub"
   - Authorize Netlify to access your GitHub (if prompted)
   - Find and select your `beezio-marketplace` repository
   - **Build settings:**
     - Build command: `npm run build`
     - Publish directory: `dist`
   - Click "Deploy site"

4. **Set Custom Domain**
   - After deployment, go to Site settings → Domain management
   - Click "Add custom domain"
   - Enter: `beezio.co`
   - Follow the DNS setup instructions

---

### **STEP 4: Update Your Database (Same as before)**

1. **Open Supabase Dashboard**
   - Go to: https://supabase.com/dashboard
   - Log in and select your project

2. **Run the SQL Setup**
   - Go to SQL Editor → New query
   - Copy and paste this SQL:

-- Multi-Role System Setup - Just run this once!
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

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS primary_role TEXT CHECK (primary_role IN ('buyer', 'seller', 'affiliate', 'fundraiser'));

UPDATE profiles SET primary_role = role WHERE primary_role IS NULL AND role IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_primary_role ON profiles(primary_role);

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own roles" ON user_roles;
CREATE POLICY "Users can manage own roles" ON user_roles
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

INSERT INTO user_roles (user_id, role, is_active, created_at)
SELECT user_id, COALESCE(primary_role::text, role::text, 'buyer'), true, created_at
FROM profiles
WHERE user_id IS NOT NULL
ON CONFLICT (user_id, role) DO NOTHING;

4. **Run the SQL**
   - Paste it into the SQL editor
   - Click the "Run" button
   - Should see "Success" message

---

### **STEP 2: Build Your Website (2 minutes)**

1. **Open Terminal/Command Prompt**
   - Press Windows Key + R
   - Type `cmd` and press Enter

2. **Navigate to Your Project**
   ```cmd
   cd "c:\Users\jason\OneDrive\Desktop\bz\project"
   ```

3. **Build the Website**
   ```cmd
   npm run build
   ```
   - Wait for it to finish (should take 1-2 minutes)
   - Should create a `dist` folder

---

### **STEP 3: Deploy to beezio.co (2 minutes)**

1. **Open Netlify**
   - Go to: https://app.netlify.com
   - Log in to your account
   - Find your site (should be beezio.co)

2. **Deploy**
   - Look for your `dist` folder (should be in: c:\Users\jason\OneDrive\Desktop\bz\project\dist)
   - Drag the ENTIRE `dist` folder onto your Netlify site
   - Wait for deployment to finish (green checkmark)

---

## ✅ **That's It! Your Site is Updated**

After these 3 steps, your users can:
- Sign up and pick any role (buyer/seller/affiliate/fundraiser)
- Switch between roles in their dashboard
- Add new roles without creating new accounts

## 🔍 **Test It Works**
1. Go to beezio.co
2. Try signing up with different roles
3. Log in and check the dashboard has role switching

## ❓ **Need Help?**
If anything goes wrong, just tell me:
- Which step you're on
- What error message you see
- I'll help you fix it!

**The key thing: You don't need to figure out what to add/delete. Just follow these 3 steps exactly as written!**
