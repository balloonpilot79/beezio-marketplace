const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://yemgssttxhkgrivuodbz.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InllbWdzc3R0eGhrZ3JpdnVvZGJ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE5MzQwMjEsImV4cCI6MjA2NzUxMDAyMX0.EyargNCg2m77Tz-JoO5qs6Auxdcd3StvDKx9ZHkKcNM';

const supabase = createClient(supabaseUrl, supabaseKey);

const sellerId = '859afbaf-e844-492c-90eb-e882f7653361';

const sampleProducts = [
  {
    seller_id: sellerId,
    title: 'Premium Wireless Headphones',
    description: 'High-quality noise-canceling wireless headphones with 30-hour battery life. Perfect for music lovers and professionals who need focus.',
    price: 199.99,
    category: 'Electronics',
    images: ['https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800'],
    is_active: true,
    stock_quantity: 50,
    tags: ['electronics', 'audio', 'wireless']
  },
  {
    seller_id: sellerId,
    title: 'Smart Fitness Watch',
    description: 'Advanced fitness tracker with heart rate monitoring, GPS, and sleep tracking. Water-resistant up to 50m.',
    price: 299.99,
    category: 'Electronics',
    images: ['https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800'],
    is_active: true,
    stock_quantity: 30,
    tags: ['fitness', 'wearable', 'health']
  },
  {
    seller_id: sellerId,
    title: 'Organic Coffee Beans - Dark Roast',
    description: 'Premium single-origin organic coffee beans from Colombia. Rich, smooth flavor with notes of chocolate and caramel.',
    price: 24.99,
    category: 'Food & Beverages',
    images: ['https://images.unsplash.com/photo-1447933601403-0c6688de566e?w=800'],
    is_active: true,
    stock_quantity: 100,
    tags: ['coffee', 'organic', 'fair-trade']
  },
  {
    seller_id: sellerId,
    title: 'Handcrafted Leather Wallet',
    description: 'Genuine full-grain leather bifold wallet with RFID blocking. Handmade with precision and care.',
    price: 79.99,
    category: 'Fashion',
    images: ['https://images.unsplash.com/photo-1627123424574-724758594e93?w=800'],
    is_active: true,
    stock_quantity: 25,
    tags: ['leather', 'accessories', 'handmade']
  },
  {
    seller_id: sellerId,
    title: 'Ergonomic Office Chair',
    description: 'Premium ergonomic office chair with lumbar support, adjustable armrests, and breathable mesh back.',
    price: 349.99,
    category: 'Furniture',
    images: ['https://images.unsplash.com/photo-1580480055273-228ff5388ef8?w=800'],
    is_active: true,
    stock_quantity: 15,
    tags: ['furniture', 'office', 'ergonomic']
  },
  {
    seller_id: sellerId,
    title: 'Stainless Steel Water Bottle',
    description: 'Double-walled insulated water bottle keeps drinks cold for 24 hours, hot for 12 hours. BPA-free and eco-friendly.',
    price: 34.99,
    category: 'Sports & Outdoors',
    images: ['https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=800'],
    is_active: true,
    stock_quantity: 75,
    tags: ['hydration', 'eco-friendly', 'outdoor']
  },
  {
    seller_id: sellerId,
    title: 'Yoga Mat - Extra Thick',
    description: 'Premium 6mm thick yoga mat with excellent cushioning and grip. Non-slip surface and eco-friendly materials.',
    price: 49.99,
    category: 'Sports & Outdoors',
    images: ['https://images.unsplash.com/photo-1601925260368-ae2f83cf8b7f?w=800'],
    is_active: true,
    stock_quantity: 40,
    tags: ['yoga', 'fitness', 'wellness']
  },
  {
    seller_id: sellerId,
    title: 'Bluetooth Speaker - Waterproof',
    description: 'Portable Bluetooth speaker with 360° sound, 12-hour battery, and IPX7 waterproof rating. Perfect for outdoor adventures.',
    price: 89.99,
    category: 'Electronics',
    images: ['https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=800'],
    is_active: true,
    stock_quantity: 60,
    tags: ['audio', 'portable', 'waterproof']
  }
];

async function addProducts() {
  console.log('\n📦 Adding sample products...\n');
  
  const { data, error } = await supabase
    .from('products')
    .insert(sampleProducts)
    .select();
  
  if (error) {
    console.error('❌ Error adding products:', error.message);
    return;
  }
  
  console.log(`✅ Successfully added ${data.length} products!\n`);
  data.forEach(p => {
    console.log(`   ✓ ${p.title} - $${p.price}`);
  });
  
  console.log('\n🎉 Your store is now ready!');
  console.log(`   Visit: http://localhost:3000/store/${sellerId}`);
}

addProducts().catch(console.error);
