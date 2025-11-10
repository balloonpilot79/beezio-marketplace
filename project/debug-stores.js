import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

console.log('\n🔍 DEBUGGING CUSTOM STORES - FULL ANALYSIS\n');
console.log('='.repeat(60));

async function debugStores() {
  const testSellerId = '859afbaf-e844-492c-90eb-e882f7653361';
  
  console.log('\n1️⃣ Testing Profile Lookup');
  console.log('-'.repeat(60));
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', testSellerId)
    .single();
  
  if (profileError) {
    console.error('❌ Profile Error:', profileError.message);
  } else {
    console.log('✅ Profile Found:', profile.email, '| Role:', profile.role);
  }

  console.log('\n2️⃣ Testing Products');
  console.log('-'.repeat(60));
  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('*')
    .eq('seller_id', testSellerId);
  
  if (productsError) {
    console.error('❌ Products Error:', productsError.message);
  } else {
    console.log(`✅ Found ${products.length} products for this seller`);
  }

  console.log('\n3️⃣ Testing All Sellers with Products');
  console.log('-'.repeat(60));
  const { data: allSellers, error: sellersError } = await supabase
    .from('profiles')
    .select('id, email, role')
    .eq('role', 'seller');
  
  if (!sellersError && allSellers) {
    console.log(`Found ${allSellers.length} sellers:`);
    for (const seller of allSellers) {
      const { data: sellerProducts } = await supabase
        .from('products')
        .select('id')
        .eq('seller_id', seller.id);
      console.log(`  - ${seller.email}: ${sellerProducts?.length || 0} products`);
    }
  }

  console.log('\n4️⃣ Testing Affiliate Stores');
  console.log('-'.repeat(60));
  const { data: affStores, error: affError } = await supabase
    .from('affiliate_stores')
    .select('*');
  
  if (affError) {
    console.error('❌ Affiliate Stores Error:', affError.message);
  } else {
    console.log(`✅ Found ${affStores?.length || 0} affiliate stores`);
  }
}

debugStores().then(() => {
  console.log('\n' + '='.repeat(60));
  console.log('Debug complete!');
  process.exit(0);
});
