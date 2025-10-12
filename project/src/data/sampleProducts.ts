// Sample Products Data - Easily toggleable sample data system
// Set ENABLE_SAMPLE_DATA to false to disable all sample data

import { isProductSampleDataEnabled } from '../config/sampleDataConfig';

export const ENABLE_SAMPLE_DATA = isProductSampleDataEnabled();

export interface SampleProduct {
  id: string;
  name: string;
  price: number;
  image: string;
  images?: string[];
  rating: number;
  category: string;
  description: string;
  seller: string;
  sellerId?: string;
  reviews: number;
  commission_rate: number;
  commission_type?: 'percentage' | 'flat_rate';
  flat_commission_amount?: number;
  shipping_cost?: number;
  stock_quantity?: number;
  created_at: string;
}

// High quality Unsplash images for each category
export const SAMPLE_PRODUCTS: SampleProduct[] = [
  // MOCK SELLER POST - New listing for demo
  {
    id: 'mock-seller-1',
    name: 'Professional Bluetooth Gaming Headset - Limited Edition',
    price: 189.99,
    image: 'https://images.unsplash.com/photo-1599669454699-248893623440?w=400&h=300&fit=crop&crop=center',
    rating: 4.9,
    category: 'Electronics',
    description: 'Brand new professional gaming headset with crystal-clear audio, RGB lighting, and ultra-comfortable memory foam ear cushions. Perfect for competitive gaming and streaming. Features advanced noise cancellation and a premium detachable microphone. Only 100 units available in this limited edition colorway!',
    seller: 'MockSeller Pro',
    reviews: 23,
    commission_rate: 30, // 30% commission as requested
    created_at: '2025-08-10T14:30:00Z' // Just posted today
  },
  
  // Electronics Category
  {
    id: 'elec-1',
    name: 'Wireless Noise-Canceling Headphones',
    price: 299.99,
    image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=300&fit=crop&crop=center',
    rating: 4.8,
    category: 'Electronics',
    description: 'Premium wireless headphones with active noise cancellation and 30-hour battery life.',
    seller: 'AudioTech Pro',
    reviews: 1247,
    commission_rate: 25,
    created_at: '2024-08-05T10:00:00Z'
  },
  {
    id: 'elec-2',
    name: 'Smartphone Camera Lens Kit',
    price: 89.99,
    image: 'https://images.unsplash.com/photo-1512499617640-c74ae3a79d37?w=400&h=300&fit=crop&crop=center',
    rating: 4.6,
    category: 'Electronics',
    description: 'Professional camera lens attachments for smartphones - wide angle, macro, and fisheye.',
    seller: 'MobilePhoto',
    reviews: 689,
    commission_rate: 35,
    created_at: '2024-08-04T15:30:00Z'
  },
  {
    id: 'elec-3',
    name: 'Wireless Charging Station',
    price: 49.99,
  image: '/bumblebee.svg',
    rating: 4.7,
    category: 'Electronics',
    description: 'Fast wireless charging pad for multiple devices - phones, earbuds, and smartwatches.',
    seller: 'ChargeTech',
    reviews: 432,
    commission_rate: 30,
    created_at: '2024-08-03T09:15:00Z'
  },
  {
    id: 'elec-4',
    name: 'Bluetooth Speaker Waterproof',
    price: 79.99,
    image: 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=400&h=300&fit=crop&crop=center',
    rating: 4.9,
    category: 'Electronics',
    description: 'Portable waterproof Bluetooth speaker with 360-degree sound and 12-hour battery.',
    seller: 'SoundWave',
    reviews: 892,
    commission_rate: 28,
    created_at: '2024-08-02T14:20:00Z'
  },
  {
    id: 'elec-5',
    name: 'Smart Home Security Camera',
    price: 129.99,
    image: 'https://images.unsplash.com/photo-1558002038-1055907df827?w=400&h=300&fit=crop&crop=center',
    rating: 4.5,
    category: 'Electronics',
    description: 'WiFi security camera with night vision, motion detection, and smartphone alerts.',
    seller: 'SecureHome',
    reviews: 756,
    commission_rate: 22,
    created_at: '2024-08-01T11:45:00Z'
  },

  // Fashion Category
  {
    id: 'fashion-1',
    name: 'Designer Leather Handbag',
    price: 189.99,
    image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400&h=300&fit=crop&crop=center',
    rating: 4.7,
    category: 'Fashion',
    description: 'Handcrafted genuine leather handbag with premium finish and multiple compartments.',
    seller: 'LuxeLeather',
    reviews: 324,
    commission_rate: 45,
    created_at: '2024-08-06T16:00:00Z'
  },
  {
    id: 'fashion-2',
    name: 'Vintage Denim Jacket',
    price: 79.99,
    image: 'https://images.unsplash.com/photo-1544966503-7cc5ac882d5f?w=400&h=300&fit=crop&crop=center',
    rating: 4.6,
    category: 'Fashion',
    description: 'Classic vintage-style denim jacket with authentic wash and comfortable fit.',
    seller: 'RetroStyle',
    reviews: 567,
    commission_rate: 40,
    created_at: '2024-08-05T12:30:00Z'
  },
  {
    id: 'fashion-3',
    name: 'Sustainable Cotton T-Shirt Set',
    price: 45.99,
    image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400&h=300&fit=crop&crop=center',
    rating: 4.8,
    category: 'Fashion',
    description: 'Pack of 3 organic cotton t-shirts in various colors, ethically sourced and eco-friendly.',
    seller: 'EcoWear',
    reviews: 1123,
    commission_rate: 50,
    created_at: '2024-08-04T08:45:00Z'
  },
  {
    id: 'fashion-4',
    name: 'Designer Sunglasses',
    price: 149.99,
    image: 'https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=400&h=300&fit=crop&crop=center',
    rating: 4.9,
    category: 'Fashion',
    description: 'Premium designer sunglasses with UV protection and polarized lenses.',
    seller: 'SunStyle',
    reviews: 445,
    commission_rate: 38,
    created_at: '2024-08-03T13:15:00Z'
  },
  {
    id: 'fashion-5',
    name: 'Luxury Silk Scarf',
    price: 89.99,
    image: 'https://images.unsplash.com/photo-1601924994987-69e26d50dc26?w=400&h=300&fit=crop&crop=center',
    rating: 4.7,
    category: 'Fashion',
    description: 'Hand-painted silk scarf with unique artistic patterns and premium silk material.',
    seller: 'SilkArt',
    reviews: 278,
    commission_rate: 42,
    created_at: '2024-08-02T17:20:00Z'
  },

  // Home & Garden Category
  {
    id: 'home-1',
    name: 'Modern Table Lamp Set',
    price: 119.99,
    image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=300&fit=crop&crop=center',
    rating: 4.6,
    category: 'Home & Garden',
    description: 'Set of 2 contemporary table lamps with adjustable brightness and USB charging ports.',
    seller: 'ModernHome',
    reviews: 634,
    commission_rate: 32,
    created_at: '2024-08-07T10:30:00Z'
  },
  {
    id: 'home-2',
    name: 'Succulent Garden Starter Kit',
    price: 39.99,
    image: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=400&h=300&fit=crop&crop=center',
    rating: 4.8,
    category: 'Home & Garden',
    description: 'Complete succulent garden kit with 6 plants, pots, soil, and care instructions.',
    seller: 'GreenThumb',
    reviews: 892,
    commission_rate: 35,
    created_at: '2024-08-06T14:45:00Z'
  },
  {
    id: 'home-3',
    name: 'Aromatherapy Diffuser',
    price: 69.99,
    image: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=400&h=300&fit=crop&crop=center',
    rating: 4.7,
    category: 'Home & Garden',
    description: 'Ultrasonic essential oil diffuser with LED lights and timer function.',
    seller: 'ZenSpace',
    reviews: 756,
    commission_rate: 40,
    created_at: '2024-08-05T09:20:00Z'
  },
  {
    id: 'home-4',
    name: 'Handwoven Throw Blanket',
    price: 79.99,
    image: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=400&h=300&fit=crop&crop=center',
    rating: 4.9,
    category: 'Home & Garden',
    description: 'Cozy handwoven throw blanket made from premium organic cotton in neutral tones.',
    seller: 'CozyHome',
    reviews: 423,
    commission_rate: 38,
    created_at: '2024-08-04T16:10:00Z'
  },
  {
    id: 'home-5',
    name: 'Bamboo Kitchen Utensil Set',
    price: 29.99,
    image: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&h=300&fit=crop&crop=center',
    rating: 4.5,
    category: 'Home & Garden',
    description: 'Eco-friendly bamboo kitchen utensil set with holder - spoons, spatulas, and tongs.',
    seller: 'EcoKitchen',
    reviews: 1089,
    commission_rate: 45,
    created_at: '2024-08-03T11:35:00Z'
  },

  // Books Category
  {
    id: 'books-1',
    name: 'Digital Marketing Mastery Guide',
    price: 34.99,
    image: 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=400&h=300&fit=crop&crop=center',
    rating: 4.8,
    category: 'Books',
    description: 'Complete guide to modern digital marketing strategies, SEO, and social media growth.',
    seller: 'MarketingGuru',
    reviews: 1567,
    commission_rate: 60,
    created_at: '2024-08-08T07:00:00Z'
  },
  {
    id: 'books-2',
    name: 'Mindfulness & Meditation Workbook',
    price: 24.99,
    image: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=400&h=300&fit=crop&crop=center',
    rating: 4.9,
    category: 'Books',
    description: 'Practical workbook with exercises and techniques for daily mindfulness and stress relief.',
    seller: 'WellnessBooks',
    reviews: 823,
    commission_rate: 55,
    created_at: '2024-08-07T15:45:00Z'
  },
  {
    id: 'books-3',
    name: 'Photography Composition Handbook',
    price: 29.99,
    image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=300&fit=crop&crop=center',
    rating: 4.7,
    category: 'Books',
    description: 'Master photography composition with this comprehensive guide featuring examples and exercises.',
    seller: 'PhotoEducation',
    reviews: 445,
    commission_rate: 50,
    created_at: '2024-08-06T12:20:00Z'
  },
  {
    id: 'books-4',
    name: 'Entrepreneurship Success Blueprint',
    price: 39.99,
    image: 'https://images.unsplash.com/photo-1589829085413-56de8ae18c73?w=400&h=300&fit=crop&crop=center',
    rating: 4.6,
    category: 'Books',
    description: 'Step-by-step guide to building a successful business from idea to profitable venture.',
    seller: 'BusinessMentor',
    reviews: 692,
    commission_rate: 65,
    created_at: '2024-08-05T18:30:00Z'
  },
  {
    id: 'books-5',
    name: 'Healthy Cooking Recipe Collection',
    price: 27.99,
    image: 'https://images.unsplash.com/photo-1476718406336-bb5a9690ee2a?w=400&h=300&fit=crop&crop=center',
    rating: 4.8,
    category: 'Books',
    description: '100+ healthy recipes with nutritional information and meal planning guides.',
    seller: 'HealthyEats',
    reviews: 934,
    commission_rate: 52,
    created_at: '2024-08-04T13:15:00Z'
  },

  // Sports Category
  {
    id: 'sports-1',
    name: 'Yoga Mat Premium Non-Slip',
    price: 49.99,
    image: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=400&h=300&fit=crop&crop=center',
    rating: 4.7,
    category: 'Sports',
    description: 'Extra thick premium yoga mat with superior grip and eco-friendly materials.',
    seller: 'YogaLife',
    reviews: 1234,
    commission_rate: 35,
    created_at: '2024-08-08T09:15:00Z'
  },
  {
    id: 'sports-2',
    name: 'Resistance Band Set',
    price: 29.99,
    image: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&h=300&fit=crop&crop=center',
    rating: 4.6,
    category: 'Sports',
    description: 'Complete resistance band workout set with multiple resistance levels and door anchor.',
    seller: 'FitGear',
    reviews: 789,
    commission_rate: 40,
    created_at: '2024-08-07T11:30:00Z'
  },
  {
    id: 'sports-3',
    name: 'Running Shoes Ultra Lightweight',
    price: 129.99,
    image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&h=300&fit=crop&crop=center',
    rating: 4.8,
    category: 'Sports',
    description: 'Professional running shoes with advanced cushioning and breathable mesh upper.',
    seller: 'RunTech',
    reviews: 567,
    commission_rate: 30,
    created_at: '2024-08-06T08:45:00Z'
  },
  {
    id: 'sports-4',
    name: 'Adjustable Dumbbell Set',
    price: 199.99,
    image: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&h=300&fit=crop&crop=center',
    rating: 4.9,
    category: 'Sports',
    description: 'Space-saving adjustable dumbbells with quick weight change system, 5-50 lbs each.',
    seller: 'HomeGym',
    reviews: 423,
    commission_rate: 25,
    created_at: '2024-08-05T14:20:00Z'
  },
  {
    id: 'sports-5',
    name: 'Cycling Computer GPS',
    price: 89.99,
    image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=300&fit=crop&crop=center',
    rating: 4.5,
    category: 'Sports',
    description: 'Advanced GPS cycling computer with navigation, heart rate monitoring, and smartphone sync.',
    seller: 'CycleTrack',
    reviews: 312,
    commission_rate: 28,
    created_at: '2024-08-04T10:10:00Z'
  },

  // Beauty Category
  {
    id: 'beauty-1',
    name: 'Organic Skincare Set',
    price: 79.99,
    image: 'https://images.unsplash.com/photo-1556228578-8c89e6adf883?w=400&h=300&fit=crop&crop=center',
    rating: 4.8,
    category: 'Beauty',
    description: 'Complete organic skincare routine with cleanser, toner, serum, and moisturizer.',
    seller: 'NaturalGlow',
    reviews: 1456,
    commission_rate: 48,
    created_at: '2024-08-08T16:00:00Z'
  },
  {
    id: 'beauty-2',
    name: 'Professional Makeup Brush Set',
    price: 59.99,
    image: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=400&h=300&fit=crop&crop=center',
    rating: 4.7,
    category: 'Beauty',
    description: '24-piece professional makeup brush set with synthetic bristles and travel case.',
    seller: 'BeautyPro',
    reviews: 892,
    commission_rate: 45,
    created_at: '2024-08-07T13:45:00Z'
  },
  {
    id: 'beauty-3',
    name: 'LED Face Mask Therapy',
    price: 149.99,
    image: 'https://images.unsplash.com/photo-1616683693504-3ea7e9ad6fec?w=400&h=300&fit=crop&crop=center',
    rating: 4.6,
    category: 'Beauty',
    description: 'Professional LED light therapy face mask for anti-aging and acne treatment.',
    seller: 'SkinTech',
    reviews: 334,
    commission_rate: 35,
    created_at: '2024-08-06T09:30:00Z'
  },
  {
    id: 'beauty-4',
    name: 'Essential Oil Aromatherapy Kit',
    price: 49.99,
    image: 'https://images.unsplash.com/photo-1608571424040-b31b4ccc8127?w=400&h=300&fit=crop&crop=center',
    rating: 4.9,
    category: 'Beauty',
    description: 'Set of 6 pure essential oils - lavender, eucalyptus, peppermint, and more.',
    seller: 'PureEssence',
    reviews: 678,
    commission_rate: 55,
    created_at: '2024-08-05T16:45:00Z'
  },
  {
    id: 'beauty-5',
    name: 'Hair Treatment Mask Set',
    price: 39.99,
    image: 'https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=400&h=300&fit=crop&crop=center',
    rating: 4.7,
    category: 'Beauty',
    description: 'Nourishing hair mask collection for different hair types - repair, hydrate, and strengthen.',
    seller: 'HairCare',
    reviews: 723,
    commission_rate: 50,
    created_at: '2024-08-04T12:00:00Z'
  },

  // Health & Wellness Category
  {
    id: 'health-1',
    name: 'Smart Fitness Tracker',
    price: 99.99,
    image: 'https://images.unsplash.com/photo-1575311373937-040b8e1fd5b6?w=400&h=300&fit=crop&crop=center',
    rating: 4.6,
    category: 'Health & Wellness',
    description: 'Advanced fitness tracker with heart rate monitoring, sleep tracking, and GPS.',
    seller: 'FitTrack',
    reviews: 956,
    commission_rate: 25,
    created_at: '2024-08-08T14:20:00Z'
  },
  {
    id: 'health-2',
    name: 'Vitamin D3 + K2 Supplement',
    price: 24.99,
    image: 'https://images.unsplash.com/photo-1559757175-0eb30cd8c063?w=400&h=300&fit=crop&crop=center',
    rating: 4.8,
    category: 'Health & Wellness',
    description: 'Premium vitamin D3 and K2 supplement for bone health and immune support.',
    seller: 'PureVitamins',
    reviews: 1234,
    commission_rate: 60,
    created_at: '2024-08-07T10:15:00Z'
  },

  // Technology Category
  {
    id: 'tech-1',
    name: 'Mechanical Gaming Keyboard',
    price: 159.99,
    image: 'https://images.unsplash.com/photo-1541140532154-b024d705b90a?w=400&h=300&fit=crop&crop=center',
    rating: 4.8,
    category: 'Technology',
    description: 'RGB backlit mechanical keyboard with tactile switches and programmable keys.',
    seller: 'GameTech',
    reviews: 743,
    commission_rate: 32,
    created_at: '2024-08-08T12:30:00Z'
  },
  {
    id: 'tech-2',
    name: 'Wireless Gaming Mouse',
    price: 79.99,
    image: 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=400&h=300&fit=crop&crop=center',
    rating: 4.7,
    category: 'Technology',
    description: 'High-precision wireless gaming mouse with customizable DPI and RGB lighting.',
    seller: 'ProGamer',
    reviews: 567,
    commission_rate: 35,
    created_at: '2024-08-06T15:45:00Z'
  },

  // Arts & Crafts Category
  {
    id: 'arts-1',
    name: 'Watercolor Paint Set Professional',
    price: 89.99,
    image: 'https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?w=400&h=300&fit=crop&crop=center',
    rating: 4.9,
    category: 'Arts & Crafts',
    description: '48-color professional watercolor set with brushes and watercolor paper pad.',
    seller: 'ArtSupplies',
    reviews: 445,
    commission_rate: 40,
    created_at: '2024-08-07T09:00:00Z'
  },

  // Automotive Category
  {
    id: 'auto-1',
    name: 'Car Phone Mount Dashboard',
    price: 19.99,
    image: 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=400&h=300&fit=crop&crop=center',
    rating: 4.5,
    category: 'Automotive',
    description: 'Universal car phone mount with 360-degree rotation and strong magnetic hold.',
    seller: 'CarAccessories',
    reviews: 789,
    commission_rate: 45,
    created_at: '2024-08-05T11:20:00Z'
  },

  // Pet Supplies Category
  {
    id: 'pet-1',
    name: 'Interactive Dog Puzzle Toy',
    price: 34.99,
    image: 'https://images.unsplash.com/photo-1601758228041-f3b2795255f1?w=400&h=300&fit=crop&crop=center',
    rating: 4.7,
    category: 'Pet Supplies',
    description: 'Mental stimulation puzzle toy for dogs with treat dispensing and difficulty levels.',
    seller: 'PetPlay',
    reviews: 623,
    commission_rate: 38,
    created_at: '2024-08-06T13:40:00Z'
  },

  // Toys & Games Category
  {
    id: 'toys-1',
    name: 'Educational STEM Building Kit',
    price: 69.99,
    image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=300&fit=crop&crop=center',
    rating: 4.8,
    category: 'Toys & Games',
    description: 'STEM learning kit with 200+ pieces for building robots, vehicles, and structures.',
    seller: 'EduToys',
    reviews: 512,
    commission_rate: 42,
    created_at: '2024-08-04T14:55:00Z'
  }
];

// Function to get products by category
export const getProductsByCategory = (category: string): SampleProduct[] => {
  if (!ENABLE_SAMPLE_DATA) return [];
  
  if (category === 'All' || category === '') {
    return SAMPLE_PRODUCTS;
  }
  
  return SAMPLE_PRODUCTS.filter(product => 
    product.category.toLowerCase() === category.toLowerCase()
  );
};

// Function to get all sample products
export const getAllSampleProducts = (): SampleProduct[] => {
  return ENABLE_SAMPLE_DATA ? SAMPLE_PRODUCTS : [];
};

// Function to get random products for sliders
export const getRandomProducts = (count: number = 6): SampleProduct[] => {
  if (!ENABLE_SAMPLE_DATA) return [];
  
  const shuffled = [...SAMPLE_PRODUCTS].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
};

export default SAMPLE_PRODUCTS;

// Export products as alias for SAMPLE_PRODUCTS for backward compatibility
export const products = SAMPLE_PRODUCTS;
