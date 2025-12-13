# 🚀 Connect Supabase to VS Code - Quick Setup

## ✅ What's Already Installed

You already have:
- ✅ **Supabase VS Code Extension** - Official extension
- ✅ **SQL Server Extension** - For running SQL queries

---

## 🔧 Option 1: Run SQL Files Directly in VS Code

### **Step 1: Create a SQL Connection File**

Create a file: `.vscode/settings.json` (if it doesn't exist)

```json
{
  "mssql.connections": [
    {
      "server": "YOUR_SUPABASE_HOST.supabase.co",
      "database": "postgres",
      "authenticationType": "SqlLogin",
      "user": "postgres",
      "password": "YOUR_SUPABASE_PASSWORD",
      "emptyPasswordInput": false,
      "savePassword": true,
      "profileName": "Supabase Production"
    }
  ]
}
```

### **Step 2: Get Your Supabase Credentials**

1. Go to https://supabase.com/dashboard
2. Select your project
3. Go to **Settings** → **Database**
4. Copy:
   - **Host** (looks like: `db.xxx.supabase.co`)
   - **Database name** (usually `postgres`)
   - **Password** (your database password)

### **Step 3: Run SQL Files**

1. Open any `.sql` file (like `FIX-PRODUCTS-TABLE-FOR-CJ.sql`)
2. Press **Ctrl+Shift+P** (Command Palette)
3. Type: `MSSQL: Connect`
4. Select your Supabase profile
5. Press **Ctrl+Shift+E** to execute the SQL!

---

## 🔧 Option 2: Use Supabase Extension Directly

The Supabase extension gives you a sidebar where you can:

### **Step 1: Open Supabase Panel**

1. Click the **Supabase icon** in the left sidebar (looks like ⚡)
2. Or press **Ctrl+Shift+P** → type `Supabase: Show Panel`

### **Step 2: Connect Your Project**

You'll need to initialize Supabase in your project:

```powershell
# Run in terminal
cd c:\Users\jason\OneDrive\Desktop\bz\project\project
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
```

**Where to find PROJECT_REF:**
- Go to https://supabase.com/dashboard
- Select your project
- The URL looks like: `https://supabase.com/dashboard/project/YOUR_PROJECT_REF`
- Copy that `YOUR_PROJECT_REF` part

### **Step 3: Run Queries from VS Code**

Once linked, you can:
- Browse tables in the sidebar
- Run SQL queries directly
- See real-time data
- Execute migrations

---

## 🔧 Option 3: Quick Database Connection (PostgreSQL Extension)

Install the PostgreSQL extension for better Postgres support:

1. Press **Ctrl+Shift+X** (Extensions)
2. Search: `PostgreSQL` by `Chris Kolkman`
3. Click **Install**

Then:

1. Press **Ctrl+Shift+P**
2. Type: `PostgreSQL: New Query`
3. Enter connection details:
   - **Host**: `db.YOUR_PROJECT.supabase.co`
   - **User**: `postgres`
   - **Password**: `YOUR_DB_PASSWORD`
   - **Database**: `postgres`
   - **Port**: `5432`

---

## 🎯 FASTEST WAY (What I Recommend)

Just keep using the Supabase web dashboard SQL editor for now since:
- ✅ It's already working
- ✅ No setup needed
- ✅ You can run the SQL files immediately

**BUT** for future speed:

### Create a Quick Run Script

Create: `run-sql.js`

```javascript
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Read SQL file
const sqlFile = process.argv[2];
const sql = fs.readFileSync(sqlFile, 'utf8');

// Execute SQL
(async () => {
  const { data, error } = await supabase.rpc('exec_sql', { sql });
  
  if (error) {
    console.error('❌ Error:', error);
  } else {
    console.log('✅ Success:', data);
  }
})();
```

Then run from VS Code terminal:
```powershell
node run-sql.js FIX-PRODUCTS-TABLE-FOR-CJ.sql
```

---

## 💡 MY RECOMMENDATION

**For NOW (fastest):**
1. Keep using Supabase web SQL editor
2. Copy-paste from VS Code SQL files
3. Run directly in browser

**For LATER (when you have time):**
1. Install PostgreSQL extension
2. Set up connection profile
3. Run SQL directly from VS Code

---

## 🚀 IMMEDIATE ACTION

To fix your CJ import issue RIGHT NOW:

1. Open Supabase Dashboard → SQL Editor
2. Copy all 193 lines from `FIX-PRODUCTS-TABLE-FOR-CJ.sql`
3. Paste and click **RUN**
4. Then copy `TEST-CJ-PRODUCT-INSERT.sql`
5. Paste and click **RUN**

**Total time: 2 minutes**

Setting up VS Code SQL connection: ~10-15 minutes

---

## 📞 Need Help?

If you want to set up the VS Code connection, let me know and I'll walk you through it step-by-step!

But for speed right now, just use the web dashboard! 🚀
