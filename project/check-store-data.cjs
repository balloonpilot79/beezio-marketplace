const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://yemgssttxhkgrivuodbz.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InllbWdzc3R0eGhrZ3JpdnVvZGJ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE5MzQwMjEsImV4cCI6MjA2NzUxMDAyMX0.EyargNCg2m77Tz-JoO5qs6Auxdcd3StvDKx9ZHkKcNM';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkStore() {
  console.log('\n🔍 Checking store data...\n');
  
  const sellerId = '859afbaf-e844-492c-90eb-e882f7653361';
  
  // Check profile
  console.log('1. Checking profile...');
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', sellerId)
    .single();
  
  if (profileError) {
    console.error('❌ Profile error:', profileError.message);
  } else {
    console.log('✅ Profile found:', profile.full_name, profile.email);
  }
  
  // Check products
  console.log('\n2. Checking products...');
  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('id, title, price, seller_id')
    .eq('seller_id', sellerId);
  
  if (productsError) {
    console.error('❌ Products error:', productsError.message);
  } else {
    console.log(`✅ Found ${products.length} products`);
    products.forEach(p => console.log(`   - ${p.title} ($${p.price})`));
  }
  
  // Check store_settings table exists
  console.log('\n3. Checking store_settings table...');
  const { data: storeSettings, error: storeError } = await supabase
    .from('store_settings')
    .select('*')
    .eq('seller_id', sellerId)
    .maybeSingle();
  
  if (storeError) {
    console.error('❌ Store settings error:', storeError.message);
    console.log('   This table might not exist - need to create it');
  } else if (storeSettings) {
    console.log('✅ Store settings found');
  } else {
    console.log('⚠️  No store settings (table exists but no data)');
  }
  
  // Check seller_product_order table exists
  console.log('\n4. Checking seller_product_order table...');
  const { data: productOrder, error: orderError } = await supabase
    .from('seller_product_order')
    .select('*')
    .eq('seller_id', sellerId);
  
  if (orderError) {
    console.error('❌ Product order error:', orderError.message);
    console.log('   This table might not exist - need to create it');
  } else {
    console.log(`✅ Product order table exists (${productOrder.length} entries)`);
  }
}

checkStore().catch(console.error);
