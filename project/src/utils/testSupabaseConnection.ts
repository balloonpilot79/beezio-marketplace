import { supabase } from '../lib/supabase';

export const testSupabaseConnection = async () => {
  try {
    console.log('🔍 Testing Supabase connection...');
    
    // Test 1: Basic connection
    const { data: connectionTest, error: connectionError } = await supabase
      .from('profiles')
      .select('count(*)')
      .limit(1);
    
    if (connectionError) {
      console.error('❌ Connection Error:', connectionError);
      return { success: false, error: connectionError };
    }
    
    console.log('✅ Basic connection successful');
    
    // Test 2: Check if essential tables exist
    const tablesToCheck = ['profiles', 'products', 'orders', 'commissions'];
    const tableResults = [];
    
    for (const table of tablesToCheck) {
      try {
        const { data, error } = await supabase
          .from(table)
          .select('count(*)')
          .limit(1);
        
        if (!error) {
          tableResults.push({ table, exists: true, count: data?.[0]?.count || 0 });
          console.log(`✅ Table '${table}' exists`);
        } else {
          tableResults.push({ table, exists: false, error: error.message });
          console.log(`❌ Table '${table}' not accessible:`, error.message);
        }
      } catch (err: any) {
        tableResults.push({ table, exists: false, error: err.message });
        console.log(`❌ Table '${table}' error:`, err.message);
      }
    }
    
    // Test 3: Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError) {
      console.log('⚠️  Authentication check failed:', authError.message);
    } else if (user) {
      console.log('✅ User authenticated:', user.email);
    } else {
      console.log('ℹ️  No user currently authenticated');
    }
    
    return {
      success: true,
      connection: 'working',
      tables: tableResults,
      user: user?.email || 'not authenticated'
    };
    
  } catch (error: any) {
    console.error('❌ Supabase test failed:', error);
    return { success: false, error: error.message };
  }
};
