// Fallback sample products for when database is not available
export const SAMPLE_PRODUCTS = [
  {
    id: 'sample-1',
    title: 'Wireless Bluetooth Headphones',
    description: 'Premium quality wireless headphones with noise cancellation and 30-hour battery life.',
    price: 149.99,
    category: 'electronics',
    images: ['https://images.pexels.com/photos/3587478/pexels-photo-3587478.jpeg?auto=compress&cs=tinysrgb&w=500'],
    videos: [],
    commission_rate: 25.0,
    commission_type: 'percentage' as const,
    flat_commission_amount: 0,
    seller_id: 'sample-seller-1',
    profiles: {
      full_name: 'Tech Store Pro',
      location: 'Seattle, WA'
    },
    shipping_cost: 5.99,
    is_subscription: false,
    subscription_interval: undefined,
    average_rating: 4.8,
    review_count: 24
  },
  {
    id: 'sample-2', 
    title: 'Handcrafted Leather Wallet',
    description: 'Genuine leather wallet handcrafted with precision. Multiple card slots and bill compartments.',
    price: 89.99,
    category: 'fashion',
    images: ['https://images.pexels.com/photos/1240892/pexels-photo-1240892.jpeg?auto=compress&cs=tinysrgb&w=500'],
    videos: [],
    commission_rate: 30.0,
    commission_type: 'percentage' as const,
    flat_commission_amount: 0,
    seller_id: 'sample-seller-2',
    profiles: {
      full_name: 'Sarah\'s Crafts',
      location: 'Austin, TX'
    },
    shipping_cost: 3.99,
    is_subscription: false,
    subscription_interval: undefined,
    average_rating: 4.6,
    review_count: 18
  },
  {
    id: 'sample-3',
    title: 'Fresh Local Honey',
    description: 'Raw, unfiltered honey from local beehives. Pure and natural sweetness.',
    price: 24.99,
    category: 'food',
    images: ['https://images.pexels.com/photos/1638459/pexels-photo-1638459.jpeg?auto=compress&cs=tinysrgb&w=500'],
    videos: [],
    commission_rate: 20.0,
    commission_type: 'percentage' as const,
    flat_commission_amount: 0,
    seller_id: 'sample-seller-3',
    profiles: {
      full_name: 'Mike\'s Local Store',
      location: 'Chicago, IL'
    },
    shipping_cost: 4.99,
    is_subscription: false,
    subscription_interval: undefined,
    average_rating: 4.9,
    review_count: 31
  },
  {
    id: 'sample-4',
    title: 'Monthly Coffee Subscription',
    description: 'Premium coffee beans delivered monthly. Curated selection from local roasters.',
    price: 29.99,
    category: 'food',
    images: ['https://images.pexels.com/photos/324028/pexels-photo-324028.jpeg?auto=compress&cs=tinysrgb&w=500'],
    videos: [],
    commission_rate: 35.0,
    commission_type: 'percentage' as const,
    flat_commission_amount: 0,
    seller_id: 'sample-seller-3',
    profiles: {
      full_name: 'Mike\'s Local Store',
      location: 'Chicago, IL'
    },
    shipping_cost: 0,
    is_subscription: true,
    subscription_interval: 'monthly' as const,
    average_rating: 4.7,
    review_count: 42
  },
  {
    id: 'sample-5',
    title: 'Digital Marketing Course',
    description: 'Complete digital marketing course with video lessons, templates, and lifetime access.',
    price: 197.99,
    category: 'digital',
    images: ['https://images.pexels.com/photos/265087/pexels-photo-265087.jpeg?auto=compress&cs=tinysrgb&w=500'],
    videos: [],
    commission_rate: 45.0,
    commission_type: 'percentage' as const,
    flat_commission_amount: 0,
    seller_id: 'sample-seller-4',
    profiles: {
      full_name: 'John Smith',
      location: 'New York, NY'
    },
    shipping_cost: 0,
    is_subscription: false,
    subscription_interval: undefined,
    average_rating: 4.9,
    review_count: 67
  },
  {
    id: 'sample-6',
    title: 'Smart Fitness Watch',
    description: 'Track your health and fitness with this advanced smartwatch. Heart rate monitor and GPS.',
    price: 299.99,
    category: 'electronics',
    images: ['https://images.pexels.com/photos/393047/pexels-photo-393047.jpeg?auto=compress&cs=tinysrgb&w=500'],
    videos: [],
    commission_rate: 20.0,
    commission_type: 'percentage' as const,
    flat_commission_amount: 0,
    seller_id: 'sample-seller-1',
    profiles: {
      full_name: 'Tech Store Pro',
      location: 'Seattle, WA'
    },
    shipping_cost: 0,
    is_subscription: false,
    subscription_interval: undefined,
    average_rating: 4.5,
    review_count: 39
  },
  {
    id: 'sample-7',
    title: 'Vintage Style Sunglasses',
    description: 'Classic vintage-style sunglasses with UV protection. Unisex design.',
    price: 79.99,
    category: 'fashion',
    images: ['https://images.pexels.com/photos/46710/pexels-photo-46710.jpeg?auto=compress&cs=tinysrgb&w=500'],
    videos: [],
    commission_rate: 0,
    commission_type: 'flat_rate' as const,
    flat_commission_amount: 25.00,
    seller_id: 'sample-seller-2',
    profiles: {
      full_name: 'Sarah\'s Crafts',
      location: 'Austin, TX'
    },
    shipping_cost: 4.99,
    is_subscription: false,
    subscription_interval: undefined,
    average_rating: 4.3,
    review_count: 12
  },
  {
    id: 'sample-8',
    title: 'Eco-Friendly Water Bottle',
    description: 'Sustainable stainless steel water bottle. Keeps drinks cold for 24 hours.',
    price: 34.99,
    category: 'home',
    images: ['https://images.pexels.com/photos/1000084/pexels-photo-1000084.jpeg?auto=compress&cs=tinysrgb&w=500'],
    videos: [],
    commission_rate: 0,
    commission_type: 'flat_rate' as const,
    flat_commission_amount: 10.00,
    seller_id: 'sample-seller-2',
    profiles: {
      full_name: 'Sarah\'s Crafts',
      location: 'Austin, TX'
    },
    shipping_cost: 3.99,
    is_subscription: false,
    subscription_interval: undefined,
    average_rating: 4.4,
    review_count: 21
  }
];
