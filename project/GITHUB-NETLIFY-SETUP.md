# 🚀 MANUAL DEPLOYMENT SETUP - Upload to Netlify

## How to Deploy Your Site (No GitHub Required)

### 1. Build Your Project
Open Command Prompt and run:
```cmd
cd /d "c:\Users\jason\OneDrive\Desktop\bz\project"
npm run build
```
This will create a `dist` folder with your production site.

### 2. Upload to Netlify
1. Go to https://app.netlify.com
2. Log in to your account
3. Click "Add new site" → "Deploy manually"
4. Drag and drop the entire `dist` folder into the upload area
5. Wait for the upload and deployment to finish

### 3. Set Custom Domain (Optional)
- Go to Site settings → Domain management
- Click "Add custom domain"
- Enter: `beezio.co` (or your domain)
- Follow the DNS setup instructions

---

## ✅ To Update Your Site
1. Make your code changes
2. Run `npm run build` again (see above)
3. Upload the new `dist` folder to Netlify (replace the old one)

---

## ❓ Need Help?
If anything goes wrong, tell me:
- Which step you're on
- What error message you see
- I'll help you fix it immediately!

**You do NOT need GitHub for deployment. Just build and upload the `dist` folder to Netlify!**

---

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

### **STEP 2: Install Git & Upload Your Project to GitHub (10 minutes)**

1. **Install Git (if not already installed)**
   - Go to: https://git-scm.com/downloads
   - Click on "Windows" 
   - Download the "64-bit Git for Windows Setup" (should auto-download)
   - Run the installer with default settings (just keep clicking "Next")
   - **Important**: After installation, close all command prompts and open a new one

2. **Open Terminal/Command Prompt**
   - Press Windows Key + R
   - Type `cmd` and press Enter

3. **Navigate to Your Project and Initialize Git**
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

**💡 Troubleshooting:**
- If you get "'git' is not recognized" error: Git isn't installed, follow step 1 above
- If you get authentication errors: Use your GitHub username and a Personal Access Token (not your regular password)
- If you need help with Personal Access Tokens: 
  1. Go to GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
  2. Click "Generate new token (classic)"
  3. Name: `beezio-deployment`
  4. Expiration: Choose "No expiration" or "90 days"
  5. **Permissions needed**: Check the box for "repo" (gives full repository access)
  6. Click "Generate token" and copy it immediately
  7. Use this token as your password when Git prompts for authentication

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

```sql
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
```

3. **Run the SQL**
   - Paste it into the SQL editor
   - Click "Run" button
   - Should see "Success" message

---

## 🎉 **You're Done! Automatic Deployment is Now Active**

### **How It Works Now:**
- Every time you make changes to your code and push to GitHub, Netlify automatically:
  1. Detects the changes
  2. Runs `npm run build`
  3. Deploys the new version to beezio.co
  4. Usually takes 2-3 minutes total

### **To Make Future Updates:**
```cmd
cd /d "c:\Users\jason\OneDrive\Desktop\bz\project"
git add .
git commit -m "Description of your changes"
git push
```
That's it! No more drag and drop needed.

---

## ✅ **Test It Works**
1. Make a small change to any file
2. Run the git commands above
3. Watch Netlify automatically deploy at: https://app.netlify.com
4. Check beezio.co in 2-3 minutes

## 🔍 **Benefits of This Setup:**
- ✅ **Automatic deployment** - Just push code, site updates automatically
- ✅ **Version control** - All your changes are tracked and backed up
- ✅ **Rollback capability** - Can easily revert to previous versions
- ✅ **Collaboration ready** - Others can contribute to your project
- ✅ **Branch deployments** - Can test changes before going live

## ❓ **Need Help?**
If anything goes wrong, tell me:
- Which step you're on  
- What error message you see
- I'll help you fix it immediately!

**The key thing: After this one-time setup, you'll never need to drag and drop again. Just code → commit → push → automatic deployment!**
