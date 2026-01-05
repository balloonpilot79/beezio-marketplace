import { useState, useEffect } from 'react';
import { Grid, List, Search, Filter, Star, Heart, ShoppingCart, TrendingUp, Users, Award, Zap } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { SAMPLE_PRODUCTS } from '../lib/sampleData';
import StarRating from '../components/StarRating';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContextMultiRole';

interface Product {
  id: string;
  title: string;
  price: number;
  images: string[];
  description?: string;
  commission_rate: number;
  category?: string;
  profiles?: {
    full_name: string;
  };
  average_rating?: number;
  review_count?: number;
}

export default function MarketplacePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 1000]);
  const [sortBy, setSortBy] = useState<'newest' | 'price-low' | 'price-high' | 'popular' | 'commission'>('newest');
  const [affiliateRef, setAffiliateRef] = useState<string | null>(null);
  const { user } = useAuth();

  // Check for affiliate reference on page load
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const ref = urlParams.get('ref') || localStorage.getItem('affiliate_ref');
    if (ref) {
      setAffiliateRef(ref);
      localStorage.setItem('affiliate_ref', ref);
    }
  }, []);

  const marketplaceStats = {
    totalProducts: 1247,
    activeSellers: 156,
    totalSales: 8934,
    averageRating: 4.8
  };

  const categories = [
    { name: 'Electronics', count: 234, color: 'blue' },
    { name: 'Fashion', count: 189, color: 'purple' },
    { name: 'Home & Garden', count: 167, color: 'green' },
    { name: 'Health & Beauty', count: 145, color: 'pink' },
    { name: 'Sports & Outdoors', count: 123, color: 'orange' },
    { name: 'Books & Media', count: 98, color: 'indigo' },
    { name: 'Toys & Games', count: 87, color: 'yellow' },
    { name: 'Food & Beverages', count: 76, color: 'red' }
  ];

  const featuredProducts = [
    {
      id: '1',
      title: 'Premium Wireless Headphones',
      price: 199.99,
      originalPrice: 249.99,
      images: ['/api/placeholder/300/300'],
      commission_rate: 25,
      category: 'Electronics',
      average_rating: 4.8,
      review_count: 127,
      profiles: { full_name: 'TechGear Pro' },
      badge: 'Best Seller',
      description: 'High-quality wireless headphones with noise cancellation'
    },
    {
      id: '2', 
      title: 'Organic Skincare Set',
      price: 89.99,
      originalPrice: 119.99,
      images: ['/api/placeholder/300/300'],
      commission_rate: 30,
      category: 'Health & Beauty',
      average_rating: 4.9,
      review_count: 89,
      profiles: { full_name: 'Natural Beauty Co' },
      badge: 'Top Rated',
      description: 'Complete organic skincare routine for all skin types'
    },
    {
      id: '3',
      title: 'Smart Fitness Tracker',
      price: 149.99,
      originalPrice: 199.99,
      images: ['/api/placeholder/300/300'],
      commission_rate: 20,
      category: 'Sports & Outdoors',
      average_rating: 4.7,
      review_count: 203,
      profiles: { full_name: 'FitTech Solutions' },
      badge: 'New Arrival',
      description: 'Advanced fitness tracking with heart rate monitoring'
    }
  ];
    }
  }, []);

  const categories = [
    'All Categories',
    'Electronics',
    'Clothing & Fashion',
    'Home & Garden',
    'Books & Media',
    'Digital Products',
    'Food & Beverage',
    'Beauty & Personal Care',
    'Sports & Outdoors',
    'Toys & Games',
    'Art & Crafts',
    'Automotive',
    'Health & Wellness'
  ];

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    filterProducts();
  }, [products, searchTerm, selectedCategory, priceRange, sortBy]);

  const filterProducts = () => {
    let filtered = [...products];

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(product =>
        product.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by category
    if (selectedCategory && selectedCategory !== 'All Categories') {
      filtered = filtered.filter(product => product.category === selectedCategory);
    }

    // Filter by price range
    filtered = filtered.filter(product => 
      product.price >= priceRange[0] && product.price <= priceRange[1]
    );

    // Sort products
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'price-low':
          return a.price - b.price;
        case 'price-high':
          return b.price - a.price;
        case 'commission':
          return b.commission_rate - a.commission_rate;
        case 'popular':
          return (b.review_count || 0) - (a.review_count || 0);
        default: // newest
          return new Date(b.id).getTime() - new Date(a.id).getTime();
      }
    });

    setFilteredProducts(filtered);
  };

  const fetchProducts = async () => {
    console.log('Fetching products...');
    try {
      // Load sample data immediately
      console.log('Setting sample products:', SAMPLE_PRODUCTS.length);
      setProducts(SAMPLE_PRODUCTS);
      setLoading(false);
      
      // Try to fetch from Supabase in background
      try {
        const { data, error } = await supabase
          .from('products')
          .select(`
            *,
            profiles:seller_id (
              full_name
            )
          `)
          .eq('is_active', true)
          .order('created_at', { ascending: false });

        if (!error && data && data.length > 0) {
          console.log('Loaded real products from database:', data.length);
          setProducts(data);
        }
      } catch (supabaseError) {
        console.log('Supabase error (using sample data):', supabaseError);
      }
    } catch (error) {
      console.log('Error in fetchProducts:', error);
      setProducts(SAMPLE_PRODUCTS);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading products...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section - Marketplace Landing */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center">
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              Discover Amazing Products
            </h1>
            <p className="text-xl mb-8 text-purple-100">
              Shop from local sellers, support your community, and earn rewards through our affiliate network
            </p>
            
            {/* Marketplace Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-12">
              <div className="text-center">
                <div className="text-3xl font-bold">{marketplaceStats.totalProducts.toLocaleString()}</div>
                <div className="text-purple-200">Products</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold">{marketplaceStats.activeSellers}</div>
                <div className="text-purple-200">Active Sellers</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold">{marketplaceStats.totalSales.toLocaleString()}</div>
                <div className="text-purple-200">Sales Made</div>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center">
                  <Star className="w-6 h-6 text-yellow-400 fill-current mr-1" />
                  <div className="text-3xl font-bold">{marketplaceStats.averageRating}</div>
                </div>
                <div className="text-purple-200">Average Rating</div>
              </div>
            </div>

            {/* Affiliate Status */}
            {affiliateRef ? (
              <div className="mt-8 bg-green-600 bg-opacity-20 border border-green-300 text-green-100 px-6 py-4 rounded-lg inline-block">
                <div className="flex items-center">
                  <Award className="w-5 h-5 mr-2" />
                  <span className="font-medium">🎉 Shopping through affiliate link!</span>
                </div>
                <p className="text-sm mt-1">Your purchases support your referrer while you shop.</p>
              </div>
            ) : !user && (
              <div className="mt-8 bg-blue-600 bg-opacity-20 border border-blue-300 text-blue-100 px-6 py-4 rounded-lg inline-block">
                <div className="flex items-center">
                  <Users className="w-5 h-5 mr-2" />
                  <span className="font-medium">Join our affiliate network and start earning!</span>
                </div>
                <Link to="/start-earning" className="text-sm mt-1 underline hover:text-white">
                  Learn how to earn commissions →
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Search and Filter Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search Bar */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search for products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            
            {/* Filters */}
            <div className="flex gap-4">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat.name} value={cat.name}>{cat.name} ({cat.count})</option>
                ))}
              </select>
              
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="newest">Newest First</option>
                <option value="popular">Most Popular</option>
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
                <option value="commission">Highest Commission</option>
              </select>

              <div className="flex border border-gray-300 rounded-lg">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-3 ${viewMode === 'grid' ? 'bg-purple-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                >
                  <Grid className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-3 ${viewMode === 'list' ? 'bg-purple-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                >
                  <List className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Category Grid */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Shop by Category</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
            {categories.map((category) => (
              <button
                key={category.name}
                onClick={() => setSelectedCategory(selectedCategory === category.name ? '' : category.name)}
                className={`p-4 rounded-xl border-2 transition-all hover:shadow-lg ${
                  selectedCategory === category.name 
                    ? `border-${category.color}-500 bg-${category.color}-50 text-${category.color}-700` 
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <div className="text-center">
                  <div className="font-semibold text-sm mb-1">{category.name}</div>
                  <div className="text-xs text-gray-500">{category.count} items</div>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* Featured Products */}
        <section className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Featured Products</h2>
            <span className="text-sm text-gray-600 bg-yellow-100 px-3 py-1 rounded-full">
              <TrendingUp className="w-4 h-4 inline mr-1" />
              Trending Now
            </span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {featuredProducts.map((product) => (
              <div key={product.id} className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow group">
                {/* Product Image */}
                <div className="relative h-64 bg-gray-200 overflow-hidden">
                  <div className="absolute top-4 left-4 z-10">
                    <span className="bg-red-600 text-white px-2 py-1 rounded-full text-xs font-medium">
                      {product.badge}
                    </span>
                  </div>
                  <div className="absolute top-4 right-4 z-10">
                    <span className="bg-green-600 text-white px-2 py-1 rounded-full text-xs font-medium">
                      {product.commission_rate}% Commission
                    </span>
                  </div>
                  <div className="absolute bottom-4 right-4 z-10">
                    <button className="bg-white p-2 rounded-full shadow-lg hover:bg-gray-100 transition-colors">
                      <Heart className="w-5 h-5 text-gray-600" />
                    </button>
                  </div>
                  <img 
                    src={product.images[0]} 
                    alt={product.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
                
                {/* Product Info */}
                <div className="p-6">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-bold text-lg text-gray-900 leading-tight">
                      {product.title}
                    </h3>
                    <div className="flex items-center text-yellow-500 ml-2">
                      <Star className="w-4 h-4 fill-current" />
                      <span className="text-sm font-medium ml-1">{product.average_rating}</span>
                      <span className="text-xs text-gray-500 ml-1">({product.review_count})</span>
                    </div>
                  </div>
                  
                  <p className="text-gray-600 text-sm mb-4">{product.description}</p>
                  
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-2">
                      <span className="text-2xl font-bold text-gray-900">${product.price}</span>
                      {product.originalPrice && (
                        <span className="text-lg text-gray-500 line-through">${product.originalPrice}</span>
                      )}
                    </div>
                    <span className="text-sm text-gray-600">by {product.profiles?.full_name}</span>
                  </div>
                  
                  <div className="flex gap-2">
                    <Link 
                      to={`/product/${product.id}${affiliateRef ? `?ref=${affiliateRef}` : ''}`}
                      className="flex-1 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center justify-center"
                    >
                      <ShoppingCart className="w-4 h-4 mr-2" />
                      View Details
                    </Link>
                    <button className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg transition-colors">
                      <Zap className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* All Products Grid */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">All Products</h2>
            <span className="text-sm text-gray-600">
              {loading ? 'Loading...' : `${filteredProducts.length} products found`}
            </span>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden animate-pulse">
                  <div className="h-48 bg-gray-200"></div>
                  <div className="p-4">
                    <div className="h-4 bg-gray-200 rounded mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-3/4 mb-4"></div>
                    <div className="h-6 bg-gray-200 rounded w-1/2"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className={
              viewMode === 'grid' 
                ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
                : "space-y-4"
            }>
              {filteredProducts.map((product) => (
                <ProductCard 
                  key={product.id} 
                  product={product} 
                  viewMode={viewMode}
                  affiliateRef={affiliateRef}
                />
              ))}
            </div>
          )}

          {!loading && filteredProducts.length === 0 && (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">🔍</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No products found</h3>
              <p className="text-gray-600 mb-4">Try adjusting your search or filters</p>
              <button 
                onClick={() => {
                  setSearchTerm('');
                  setSelectedCategory('');
                  setPriceRange([0, 1000]);
                }}
                className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 transition-colors"
              >
                Clear Filters
              </button>
            </div>
          )}
        </section>

        {/* Call to Action for Sellers/Affiliates */}
        <section className="mt-16 bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl p-8 text-white text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Start Selling or Earning?</h2>
          <p className="text-xl mb-6 text-orange-100">Join our marketplace and turn your products or influence into income</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link 
              to="/start-earning" 
              className="bg-white text-orange-600 px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
            >
              Become an Affiliate
            </Link>
            {!user && (
              <Link 
                to="/dashboard" 
                className="border-2 border-white text-white px-8 py-3 rounded-lg font-semibold hover:bg-white hover:text-orange-600 transition-colors"
              >
                Start Selling
              </Link>
            )}
          </div>
        </section>
      </div>
    </div>
  );
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search products..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                />
              </div>

              {/* Category Filter */}
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              >
                {categories.map(category => (
                  <option key={category} value={category === 'All Categories' ? '' : category}>
                    {category}
                  </option>
                ))}
              </select>

              {/* Price Range */}
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600">$</span>
                <input
                  type="number"
                  placeholder="Min"
                  value={priceRange[0]}
                  onChange={(e) => setPriceRange([Number(e.target.value), priceRange[1]])}
                  className="w-20 px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                />
                <span className="text-gray-400">-</span>
                <input
                  type="number"
                  placeholder="Max"
                  value={priceRange[1]}
                  onChange={(e) => setPriceRange([priceRange[0], Number(e.target.value)])}
                  className="w-20 px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                />
              </div>

              {/* Sort By */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              >
                <option value="newest">Newest First</option>
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
                <option value="popular">Most Popular</option>
                <option value="commission">Highest Commission</option>
              </select>
            </div>

            {/* Active Filters Display */}
            <div className="flex flex-wrap gap-2">
              {searchTerm && (
                <span className="bg-amber-100 text-amber-800 px-3 py-1 rounded-full text-sm flex items-center">
                  Search: "{searchTerm}"
                  <button 
                    onClick={() => setSearchTerm('')}
                    className="ml-2 text-amber-600 hover:text-amber-800"
                  >
                    ×
                  </button>
                </span>
              )}
              {selectedCategory && (
                <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm flex items-center">
                  Category: {selectedCategory}
                  <button 
                    onClick={() => setSelectedCategory('')}
                    className="ml-2 text-blue-600 hover:text-blue-800"
                  >
                    ×
                  </button>
                </span>
              )}
              {(priceRange[0] > 0 || priceRange[1] < 1000) && (
                <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm flex items-center">
                  Price: ${priceRange[0]} - ${priceRange[1]}
                  <button 
                    onClick={() => setPriceRange([0, 1000])}
                    className="ml-2 text-green-600 hover:text-green-800"
                  >
                    ×
                  </button>
                </span>
              )}
            </div>
          </div>

          {/* Results Count and View Toggle */}
          <div className="flex justify-between items-center mb-6">
            <div className="text-gray-600">
              <span className="font-medium">{filteredProducts.length}</span> products found
              {affiliateRef && (
                <span className="ml-4 text-green-600 text-sm">
                  🤝 Affiliate commissions active
                </span>
              )}
            </div>
            
            <div className="flex items-center space-x-4">
              {/* View Mode Toggle */}
              <div className="flex border border-gray-300 rounded-lg">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 ${viewMode === 'grid' ? 'bg-amber-500 text-white' : 'text-gray-500'} transition-colors`}
                >
                  <Grid className="h-5 w-5" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 ${viewMode === 'list' ? 'bg-amber-500 text-white' : 'text-gray-500'} transition-colors`}
                >
                  <List className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Products Grid */}
          <div className="grid grid-cols-1 gap-8">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex justify-between items-center mb-6">
                <p className="text-gray-600">
                  {filteredProducts.length} products found
                </p>
              </div>

              {filteredProducts.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-500 text-lg">No products found matching your criteria.</p>
                  <p className="text-gray-400 mt-2">Try adjusting your filters or search terms.</p>
                </div>
              ) : (
                <div className={`grid gap-6 ${
                  viewMode === 'grid' 
                    ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' 
                    : 'grid-cols-1'
                }`}>
                  {filteredProducts.map((product) => (
                    <div
                      key={product.id}
                      className={`bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow ${
                        viewMode === 'list' ? 'flex' : ''
                      }`}
                    >
                      <div className={viewMode === 'list' ? 'w-48 flex-shrink-0' : ''}>
                        <img
                          src={product.images[0] || '/api/placeholder/300/200'}
                          alt={product.title}
                          className={`w-full object-cover ${
                            viewMode === 'list' ? 'h-32' : 'h-48'
                          }`}
                        />
                      </div>
                      
                      <div className="p-4 flex-1">
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="font-semibold text-gray-900 line-clamp-2">
                            {product.title}
                          </h3>
                          {/* <SocialShareButton 
                            url={`${window.location.origin}/product/${product.id}`}
                            title={product.title}
                          /> */}
                        </div>
                        
                        {product.description && (
                          <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                            {product.description}
                          </p>
                        )}
                        
                        <div className="flex items-center mb-3">
                          <StarRating 
                            rating={product.average_rating || 0} 
                            size="sm" 
                          />
                          <span className="text-sm text-gray-500 ml-2">
                            ({product.review_count || 0} reviews)
                          </span>
                        </div>
                        
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-2xl font-bold text-gray-900">
                            ${product.price}
                          </span>
                          <div className="flex flex-col items-end">
                            <span className="text-sm text-green-600 bg-green-100 px-2 py-1 rounded">
                              {product.commission_rate}% commission
                            </span>
                            {affiliateRef && (
                              <span className="text-xs text-blue-600 mt-1">
                                +${(product.price * product.commission_rate / 100).toFixed(2)} for you
                              </span>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                          <span>by {product.profiles?.full_name || 'Unknown Seller'}</span>
                          {product.category && (
                            <span className="bg-gray-100 px-2 py-1 rounded text-xs">
                              {product.category}
                            </span>
                          )}
                        </div>
                        
                        <Link
                          to={`/product/${product.id}`}
                          className="w-full bg-amber-500 text-white px-4 py-2 rounded-lg hover:bg-amber-600 transition-colors text-center block"
                        >
                          View Details
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ProductCard Component
interface ProductCardProps {
  product: Product & { badge?: string; originalPrice?: number };
  viewMode: 'grid' | 'list';
  affiliateRef: string | null;
}
interface ProductCardProps {
  product: Product & { badge?: string; originalPrice?: number };
  viewMode: 'grid' | 'list';
  affiliateRef: string | null;
}

const ProductCard: React.FC<ProductCardProps> = ({ product, viewMode, affiliateRef }) => {
  if (viewMode === 'list') {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
        <div className="flex">
          <div className="w-48 h-32 bg-gray-200 flex-shrink-0">
            <img 
              src={product.images[0] || '/api/placeholder/200/150'} 
              alt={product.title}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex-1 p-4">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 mb-1">{product.title}</h3>
                <p className="text-sm text-gray-600 mb-2 line-clamp-2">{product.description}</p>
                <div className="flex items-center space-x-4 text-sm text-gray-500">
                  <span>by {product.profiles?.full_name}</span>
                  <div className="flex items-center">
                    <Star className="w-4 h-4 text-yellow-400 fill-current mr-1" />
                    <span>{product.average_rating || 4.5}</span>
                    <span className="ml-1">({product.review_count || 0})</span>
                  </div>
                  <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs">
                    {product.commission_rate}% Commission
                  </span>
                </div>
              </div>
              <div className="text-right ml-4">
                <div className="text-xl font-bold text-gray-900">${product.price}</div>
                <Link 
                  to={`/product/${product.id}${affiliateRef ? `?ref=${affiliateRef}` : ''}`}
                  className="mt-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors inline-flex items-center"
                >
                  <ShoppingCart className="w-4 h-4 mr-2" />
                  View
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow group">
      {/* Product Image */}
      <div className="relative h-48 bg-gray-200 overflow-hidden">
        {product.badge && (
          <div className="absolute top-3 left-3 z-10">
            <span className="bg-red-600 text-white px-2 py-1 rounded-full text-xs font-medium">
              {product.badge}
            </span>
          </div>
        )}
        <div className="absolute top-3 right-3 z-10">
          <span className="bg-green-600 text-white px-2 py-1 rounded-full text-xs font-medium">
            {product.commission_rate}%
          </span>
        </div>
        <div className="absolute bottom-3 right-3 z-10">
          <button className="bg-white p-2 rounded-full shadow-md hover:bg-gray-100 transition-colors">
            <Heart className="w-4 h-4 text-gray-600" />
          </button>
        </div>
        <img 
          src={product.images[0] || '/api/placeholder/300/200'} 
          alt={product.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
      </div>
      
      {/* Product Info */}
      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <h3 className="font-semibold text-gray-900 leading-tight line-clamp-2 flex-1">
            {product.title}
          </h3>
          <div className="flex items-center text-yellow-500 ml-2">
            <Star className="w-4 h-4 fill-current" />
            <span className="text-sm font-medium ml-1">{product.average_rating || 4.5}</span>
          </div>
        </div>
        
        <p className="text-gray-600 text-sm mb-3 line-clamp-2">{product.description}</p>
        
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <span className="text-lg font-bold text-gray-900">${product.price}</span>
            {product.originalPrice && (
              <span className="text-sm text-gray-500 line-through">${product.originalPrice}</span>
            )}
          </div>
          <span className="text-xs text-gray-500">({product.review_count || 0} reviews)</span>
        </div>
        
        <div className="text-xs text-gray-600 mb-3">by {product.profiles?.full_name}</div>
        
        <Link 
          to={`/product/${product.id}${affiliateRef ? `?ref=${affiliateRef}` : ''}`}
          className="w-full bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center justify-center"
        >
          <ShoppingCart className="w-4 h-4 mr-2" />
          View Details
        </Link>
      </div>
    </div>
  );
}
