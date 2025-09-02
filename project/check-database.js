// Quick script to check your current database structure
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://yemgssttxhkgrivuodbz.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InllbWdzc3R0eGhrZ3JpdnVvZGJ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzMwNzg5NjQsImV4cCI6MjA0ODY1NDk2NH0.JZaEy7pFJGkZNJhNq0dWQ2ZrQAYg6oOQQdTk6EJuYOA';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDatabase() {
  console.log('🔍 Checking your database structure...\n');
  
  try {
    // Check if user_roles table exists
    const { data: userRolesData, error: userRolesError } = await supabase
      .from('user_roles')
      .select('*')
      .limit(1);
    
    if (userRolesError) {
      console.log('❌ user_roles table: NOT FOUND (needs to be created)');
    } else {
      console.log('✅ user_roles table: EXISTS');
    }
    
    // Check if profiles table has primary_role column
    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('primary_role')
      .limit(1);
    
    if (profilesError && profilesError.message.includes('primary_role')) {
      console.log('❌ profiles.primary_role column: NOT FOUND (needs to be added)');
    } else {
      console.log('✅ profiles.primary_role column: EXISTS');
    }
    
    // Check existing profiles
    const { data: allProfiles, error: allProfilesError } = await supabase
      .from('profiles')
      .select('id, role, primary_role')
      .limit(5);
    
    if (!allProfilesError && allProfiles) {
      console.log(`\n📊 Found ${allProfiles.length} existing profiles`);
      if (allProfiles.length > 0) {
        console.log('Sample profile structure:', allProfiles[0]);
      }
    }
    
  } catch (error) {
    console.log('Error checking database:', error.message);
  }
}

checkDatabase();
