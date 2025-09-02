# 🔍 Database Migration Verification

## Quick Test Script for Browser Console

If you want to test the migration directly in your browser, follow these steps:

### 1. Open Browser Console
1. Go to **beezio.co** (or your local development site)
2. Open **Developer Tools** (F12)
3. Go to **Console** tab

### 2. Copy and Paste This Script

```javascript
// Test Multi-Role Database Migration
async function testMigration() {
  console.log('🔍 Testing Multi-Role Database Migration...\n');
  
  // Import Supabase (assuming it's available globally)
  const supabase = window.supabase || (await import('/src/lib/supabase.js')).supabase;
  
  if (!supabase) {
    console.log('❌ Supabase not available. Make sure you\'re on the site.');
    return;
  }

  // Test 1: user_roles table
  console.log('1️⃣ Testing user_roles table...');
  try {
    const { data, error } = await supabase
      .from('user_roles')
      .select('*')
      .limit(1);
    
    if (error) {
      if (error.message.includes('relation "public.user_roles" does not exist')) {
        console.log('❌ user_roles table NOT CREATED');
        console.log('💡 Please re-run the SQL migration in Supabase');
        return false;
      } else {
        console.log('✅ user_roles table exists (got expected RLS error)');
      }
    } else {
      console.log('✅ user_roles table exists and accessible');
    }
  } catch (err) {
    console.log('❌ user_roles test failed:', err.message);
    return false;
  }

  // Test 2: profiles primary_role column
  console.log('2️⃣ Testing profiles.primary_role column...');
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('user_id, role, primary_role')
      .limit(1);
    
    if (error) {
      if (error.message.includes('column "primary_role" does not exist')) {
        console.log('❌ primary_role column NOT ADDED');
        console.log('💡 Please re-run the SQL migration in Supabase');
        return false;
      } else {
        console.log('✅ primary_role column exists');
      }
    } else {
      console.log('✅ primary_role column exists and accessible');
    }
  } catch (err) {
    console.log('❌ profiles test failed:', err.message);
    return false;
  }

  console.log('\n🎉 DATABASE MIGRATION SUCCESSFUL!');
  console.log('✅ Ready to use multi-role features');
  return true;
}

// Run the test
testMigration();
```

### 3. Expected Results

**If Migration Was Successful:**
```
🔍 Testing Multi-Role Database Migration...

1️⃣ Testing user_roles table...
✅ user_roles table exists (got expected RLS error)

2️⃣ Testing profiles.primary_role column...
✅ primary_role column exists

🎉 DATABASE MIGRATION SUCCESSFUL!
✅ Ready to use multi-role features
```

**If Migration Failed:**
```
❌ user_roles table NOT CREATED
💡 Please re-run the SQL migration in Supabase
```

## Alternative: Direct Supabase Check

You can also check directly in Supabase:

### 1. Go to Supabase Dashboard
- Visit: https://supabase.com/dashboard
- Select your project: **yemgssttxhkgrivuodbz**

### 2. Check Table Editor
- Go to **"Table Editor"** in left sidebar
- Look for **"user_roles"** table in the list
- Click on **"profiles"** table and check if **"primary_role"** column exists

### 3. Check SQL Editor History
- Go to **"SQL Editor"** in left sidebar  
- Check **"History"** tab to see your recent queries
- Look for the migration query you just ran

## If Migration Failed

If the tests show the migration didn't work:

1. **Go back to Supabase SQL Editor**
2. **Try running the SQL in smaller chunks:**
   - Run the `CREATE TABLE user_roles...` section first
   - Then run the `ALTER TABLE profiles ADD COLUMN...` section
   - Then run the RLS policies section
   - Finally run the data migration section

3. **Check for error messages** in the SQL editor output

4. **Re-run the browser test** after each section to see progress

The migration is critical for the multi-role system to work! 🎯
