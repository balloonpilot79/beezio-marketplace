import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://yemgssttxhkgrivuodbz.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InllbWdzc3R0eGhrZ3JpdnVvZGJ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mjc2MzIxNzQsImV4cCI6MjA0MzIwODE3NH0.99m7vVVYgc0Z2bzbOLqXRoiuIJYQFSG0wpJuQQwQ96I';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAffiliateSchema() {
  console.log('🔍 Checking affiliate-related database schema...\n');

  try {
    // 1. Check commissions table
    console.log('📊 Checking commissions table structure:');
    const { data: commissionsData, error: commissionsError } = await supabase
      .from('commissions')
      .select('*')
      .limit(1);

    if (commissionsError && commissionsError.code === '42P01') {
      console.log('❌ commissions table does not exist');
    } else if (commissionsError) {
      console.log('❌ Error accessing commissions table:', commissionsError.message);
    } else {
      console.log('✅ commissions table exists');
      if (commissionsData && commissionsData.length > 0) {
        console.log('   Columns:', Object.keys(commissionsData[0]));
      }
    }

    // 2. Check affiliate_links table
    console.log('\n🔗 Checking affiliate_links table structure:');
    const { data: linksData, error: linksError } = await supabase
      .from('affiliate_links')
      .select('*')
      .limit(1);

    if (linksError && linksError.code === '42P01') {
      console.log('❌ affiliate_links table does not exist');
    } else if (linksError) {
      console.log('❌ Error accessing affiliate_links table:', linksError.message);
    } else {
      console.log('✅ affiliate_links table exists');
      if (linksData && linksData.length > 0) {
        console.log('   Columns:', Object.keys(linksData[0]));
      }
    }

    // 3. Check affiliate_earnings table
    console.log('\n💰 Checking affiliate_earnings table structure:');
    const { data: earningsData, error: earningsError } = await supabase
      .from('affiliate_earnings')
      .select('*')
      .limit(1);

    if (earningsError && earningsError.code === '42P01') {
      console.log('❌ affiliate_earnings table does not exist');
    } else if (earningsError) {
      console.log('❌ Error accessing affiliate_earnings table:', earningsError.message);
    } else {
      console.log('✅ affiliate_earnings table exists');
      if (earningsData && earningsData.length > 0) {
        console.log('   Columns:', Object.keys(earningsData[0]));
      }
    }

    // 4. Check for products table with affiliate fields
    console.log('\n🛍️ Checking products table for affiliate commission fields:');
    const { data: productsData, error: productsError } = await supabase
      .from('products')
      .select('id, title, price, commission_rate, commission_type')
      .limit(3);

    if (productsError) {
      console.log('❌ Error accessing products table:', productsError.message);
    } else {
      console.log('✅ products table accessible');
      if (productsData && productsData.length > 0) {
        console.log('   Sample product with commission data:');
        console.log('   ', productsData[0]);
        
        // Check if commission fields exist
        const hasCommissionRate = productsData[0].hasOwnProperty('commission_rate');
        const hasCommissionType = productsData[0].hasOwnProperty('commission_type');
        
        console.log(`   Commission fields: rate=${hasCommissionRate}, type=${hasCommissionType}`);
      }
    }

    // 5. Check profiles table for role validation
    console.log('\n👤 Checking profiles table for affiliate roles:');
    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('id, full_name, role')
      .eq('role', 'affiliate')
      .limit(3);

    if (profilesError) {
      console.log('❌ Error accessing profiles table:', profilesError.message);
    } else {
      console.log('✅ profiles table accessible');
      console.log(`   Found ${profilesData?.length || 0} affiliate profiles`);
      if (profilesData && profilesData.length > 0) {
        console.log('   Sample affiliate profile:', profilesData[0]);
      }
    }

    // 6. Check if any test data exists
    console.log('\n📈 Checking for existing affiliate test data:');
    
    // Check for any commission records
    const { count: commissionCount } = await supabase
      .from('commissions')
      .select('*', { count: 'exact', head: true });
    
    console.log(`   Total commission records: ${commissionCount || 0}`);

    // Check for any affiliate link records
    const { count: linkCount } = await supabase
      .from('affiliate_links')
      .select('*', { count: 'exact', head: true });
    
    console.log(`   Total affiliate link records: ${linkCount || 0}`);

    console.log('\n🎯 Schema check complete!');

  } catch (error) {
    console.error('❌ Error during schema check:', error);
  }
}

checkAffiliateSchema();