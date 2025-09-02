// Powerhouse Launch Script - Creates realistic marketplace activity
// Run this to populate your platform with convincing activity before launch

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Realistic seller profiles for your multiple accounts
const REALISTIC_SELLERS = [
  {
    email: 'sarah.techpro@gmail.com',
    full_name: 'Sarah Johnson',
    role: 'seller',
    location: 'San Francisco, CA',
    bio: 'Tech entrepreneur and software consultant with 8+ years helping businesses automate their workflows.',
    avatar_url: 'https://images.unsplash.com/photo-1494790108755-2616b612b04c?w=150',
    total_sales: 47,
    rating: 4.9,
    verified: true
  },
  {
    email: 'mike.fitnessguru@gmail.com',
    full_name: 'Mike Rodriguez',
    role: 'seller',
    location: 'Austin, TX',
    bio: 'Certified personal trainer and nutrition specialist. Helping people transform their health since 2015.',
    avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
    total_sales: 234,
    rating: 4.8,
    verified: true
  },
  {
    email: 'lisa.designstudio@gmail.com',
    full_name: 'Lisa Chen',
    role: 'seller',
    location: 'Seattle, WA',
    bio: 'Creative director and digital design expert. Specializing in brand identity and user experience design.',
    avatar_url: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150',
    total_sales: 156,
    rating: 4.9,
    verified: true
  },
  {
    email: 'david.marketingmaven@gmail.com',
    full_name: 'David Thompson',
    role: 'seller',
    location: 'New York, NY',
    bio: 'Digital marketing strategist and growth hacker. Built campaigns for Fortune 500 companies.',
    avatar_url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
    total_sales: 89,
    rating: 4.7,
    verified: true
  },
  {
    email: 'emma.businesscoach@gmail.com',
    full_name: 'Emma Wilson',
    role: 'seller',
    location: 'Chicago, IL',
    bio: 'Executive business coach and consultant. Helping entrepreneurs scale their businesses profitably.',
    avatar_url: 'https://images.unsplash.com/photo-1494790108755-2616b612b04c?w=150',
    total_sales: 67,
    rating: 4.8,
    verified: true
  }
];

// High-earning affiliate profiles
const REALISTIC_AFFILIATES = [
  {
    email: 'alex.topaffiliate@gmail.com',
    full_name: 'Alex Martinez',
    role: 'affiliate',
    location: 'Los Angeles, CA',
    bio: 'Top-performing affiliate marketer with $2M+ in sales. Specializing in high-ticket digital products.',
    avatar_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
    total_earnings: 127840.50,
    total_referrals: 1247,
    rating: 4.9
  },
  {
    email: 'jessica.socialmaven@gmail.com',
    full_name: 'Jessica Park',
    role: 'affiliate',
    location: 'Miami, FL',
    bio: 'Social media influencer and affiliate marketer. 500K+ followers across platforms.',
    avatar_url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150',
    total_earnings: 89650.25,
    total_referrals: 892,
    rating: 4.8
  },
  {
    email: 'robert.businessbuilder@gmail.com',
    full_name: 'Robert Kim',
    role: 'affiliate',
    location: 'Denver, CO',
    bio: 'Business development specialist and affiliate marketing expert. Focus on B2B software solutions.',
    avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
    total_earnings: 156720.75,
    total_referrals: 567,
    rating: 4.9
  },
  {
    email: 'jennifer.contentqueen@gmail.com',
    full_name: 'Jennifer Davis',
    role: 'affiliate',
    location: 'Portland, OR',
    bio: 'Content creator and email marketing specialist. Building audiences that convert into sales.',
    avatar_url: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=150',
    total_earnings: 73920.40,
    total_referrals: 1034,
    rating: 4.7
  }
];

// Realistic customer profiles
const REALISTIC_CUSTOMERS = [
  {
    email: 'john.entrepreneur@gmail.com',
    full_name: 'John Anderson',
    role: 'buyer',
    location: 'Nashville, TN',
    avatar_url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150'
  },
  {
    email: 'maria.smallbiz@gmail.com',
    full_name: 'Maria Gonzalez',
    role: 'buyer',
    location: 'Phoenix, AZ',
    avatar_url: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150'
  },
  {
    email: 'steve.techstart@gmail.com',
    full_name: 'Steve Johnson',
    role: 'buyer',
    location: 'Boston, MA',
    avatar_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150'
  }
];

async function createRealisticProfiles() {
  console.log('🚀 Creating realistic seller profiles...');
  
  for (const seller of REALISTIC_SELLERS) {
    try {
      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: seller.email,
        password: 'TempPassword123!',
        email_confirm: true,
        user_metadata: {
          full_name: seller.full_name,
          role: seller.role
        }
      });

      if (authError) {
        console.log(`ℹ️ User ${seller.email} might already exist, continuing...`);
        continue;
      }

      // Create profile
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert([{
          id: authData.user.id,
          ...seller
        }]);

      if (profileError) throw profileError;
      
      console.log(`✅ Created seller: ${seller.full_name}`);
    } catch (error) {
      console.error(`❌ Error creating seller ${seller.full_name}:`, error.message);
    }
  }

  console.log('🎯 Creating realistic affiliate profiles...');
  
  for (const affiliate of REALISTIC_AFFILIATES) {
    try {
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: affiliate.email,
        password: 'TempPassword123!',
        email_confirm: true,
        user_metadata: {
          full_name: affiliate.full_name,
          role: affiliate.role
        }
      });

      if (authError) {
        console.log(`ℹ️ User ${affiliate.email} might already exist, continuing...`);
        continue;
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .upsert([{
          id: authData.user.id,
          ...affiliate
        }]);

      if (profileError) throw profileError;
      
      console.log(`✅ Created affiliate: ${affiliate.full_name}`);
    } catch (error) {
      console.error(`❌ Error creating affiliate ${affiliate.full_name}:`, error.message);
    }
  }

  console.log('👥 Creating realistic customer profiles...');
  
  for (const customer of REALISTIC_CUSTOMERS) {
    try {
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: customer.email,
        password: 'TempPassword123!',
        email_confirm: true,
        user_metadata: {
          full_name: customer.full_name,
          role: customer.role
        }
      });

      if (authError) {
        console.log(`ℹ️ User ${customer.email} might already exist, continuing...`);
        continue;
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .upsert([{
          id: authData.user.id,
          ...customer
        }]);

      if (profileError) throw profileError;
      
      console.log(`✅ Created customer: ${customer.full_name}`);
    } catch (error) {
      console.error(`❌ Error creating customer ${customer.full_name}:`, error.message);
    }
  }
}

async function createRealisticActivity() {
  console.log('📈 Creating realistic marketplace activity...');

  // Get all profiles
  const { data: profiles } = await supabase
    .from('profiles')
    .select('*');

  const affiliates = profiles.filter(p => p.role === 'affiliate');
  const customers = profiles.filter(p => p.role === 'buyer');

  // Get all subscription products
  const { data: products } = await supabase
    .from('products')
    .select('*')
    .eq('is_subscription', true);

  if (!products || products.length === 0) {
    console.log('❌ No subscription products found. Run the migration first.');
    return;
  }

  console.log(`📊 Found ${products.length} subscription products`);

  // Create realistic subscriptions for each product
  for (const product of products) {
    const subscriberCount = Math.floor(Math.random() * 50) + 20; // 20-70 subscribers per product
    
    console.log(`Creating ${subscriberCount} subscriptions for: ${product.title}`);

    for (let i = 0; i < subscriberCount; i++) {
      const randomCustomer = customers[Math.floor(Math.random() * customers.length)];
      const randomAffiliate = affiliates[Math.floor(Math.random() * affiliates.length)];
      
      // Random subscription start date (last 60 days)
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - Math.floor(Math.random() * 60));
      
      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + 1);

      const status = Math.random() > 0.15 ? 'active' : (Math.random() > 0.5 ? 'trial' : 'cancelled');

      try {
        const { data: subscription, error: subError } = await supabase
          .from('customer_subscriptions')
          .insert([{
            customer_id: randomCustomer.id,
            product_id: product.id,
            affiliate_id: randomAffiliate.id,
            status: status,
            current_period_start: startDate.toISOString(),
            current_period_end: endDate.toISOString(),
            next_billing_date: status === 'active' ? endDate.toISOString() : null,
            subscription_price: product.subscription_price
          }])
          .select()
          .single();

        if (subError) throw subError;

        // Create commission record for active subscriptions
        if (status === 'active') {
          const commissionAmount = product.subscription_price * (product.commission_rate / 100);
          
          await supabase
            .from('affiliate_commissions')
            .insert([{
              affiliate_id: randomAffiliate.id,
              product_id: product.id,
              order_id: `order_${Math.random().toString(36).substr(2, 9)}`,
              commission_amount: commissionAmount,
              commission_rate: product.commission_rate,
              status: 'paid',
              subscription_id: subscription.id,
              is_recurring: true,
              commission_type: 'recurring'
            }]);
        }
      } catch (error) {
        console.error(`Error creating subscription:`, error.message);
      }
    }
  }

  // Update product subscriber counts
  for (const product of products) {
    const { data: subs } = await supabase
      .from('customer_subscriptions')
      .select('id')
      .eq('product_id', product.id)
      .eq('status', 'active');

    await supabase
      .from('products')
      .update({ current_subscribers: subs ? subs.length : 0 })
      .eq('id', product.id);
  }

  // Update affiliate earnings
  for (const affiliate of affiliates) {
    const { data: commissions } = await supabase
      .from('affiliate_commissions')
      .select('commission_amount')
      .eq('affiliate_id', affiliate.id)
      .eq('status', 'paid');

    const totalEarnings = commissions 
      ? commissions.reduce((sum, c) => sum + parseFloat(c.commission_amount), 0)
      : 0;

    await supabase
      .from('profiles')
      .update({ 
        total_earnings: totalEarnings,
        total_referrals: commissions ? commissions.length : 0
      })
      .eq('id', affiliate.id);
  }

  console.log('✅ Marketplace activity created successfully!');
}

async function runPowerhouseLaunch() {
  console.log('🚀 BEEZIO POWERHOUSE LAUNCH SETUP');
  console.log('===================================');
  
  try {
    await createRealisticProfiles();
    console.log('\n');
    await createRealisticActivity();
    
    console.log('\n🎉 POWERHOUSE LAUNCH SETUP COMPLETE!');
    console.log('');
    console.log('📊 Your platform now has:');
    console.log('• Verified vendors with real-looking products');
    console.log('• High-earning affiliates with track records');
    console.log('• Active subscription customers');
    console.log('• Realistic transaction history');
    console.log('• Transparent pricing breakdowns');
    console.log('');
    console.log('💰 Ready for launch with convincing marketplace activity!');
    
  } catch (error) {
    console.error('❌ Error during setup:', error);
  }
}

// Run the script
if (require.main === module) {
  runPowerhouseLaunch();
}

module.exports = { runPowerhouseLaunch };
