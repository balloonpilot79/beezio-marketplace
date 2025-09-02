import { useState, useEffect } from 'react';
import { Grid, List, Search, Heart, Award } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { SAMPLE_PRODUCTS } from '../lib/sampleData';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContextMultiRole';

interface Product {
  id: string;
  title: string;
  price: number;
import React from 'react';
  images: string[];
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
const SAMPLE_PRODUCTS: Product[] = [
  {
    id: '1',
    title: 'Wireless Headphones',
    price: 129.99,
    images: ['https://images.pexels.com/photos/3587478/pexels-photo-3587478.jpeg?auto=compress&w=400'],
    commission_rate: 20,
    profiles: { full_name: 'TechGear Pro' },
    average_rating: 4.8,
    review_count: 124,
    category: 'Electronics',
    description: 'Premium wireless headphones with noise cancellation.'
  },
  {
    id: '2',
    title: 'Handcrafted Leather Wallet',
    price: 89.99,
    images: ['https://images.pexels.com/photos/1240892/pexels-photo-1240892.jpeg?auto=compress&w=400'],
    commission_rate: 30,
    profiles: { full_name: "Sarah's Crafts" },
    average_rating: 4.9,
    review_count: 98,
    category: 'Fashion',
    description: 'Elegant, handcrafted leather wallet.'
  },
  // ...add more sample products as needed
];

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
    try {
      // Load sample data immediately
      setProducts(SAMPLE_PRODUCTS);
      setLoading(false);
      
      // Try to fetch from Supabase in background
      try {
        const { data, error } = await supabase
          .from('products')
          .select(`
            *,

              <div className="flex items-center space-x-4 text-purple-100">
                <span>🚚 Free shipping $35+</span>
                <span>⭐ {marketplaceStats.averageRating}/5</span>
                <span>👥 {marketplaceStats.activeSellers} sellers</span>
              </div>
            </div>
          </div>

          {/* Enhanced Search Section */}
          <div className="mt-8 max-w-4xl mx-auto">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-semibold mb-2">Discover Amazing Products</h2>
              <p className="text-purple-200">Shop local, earn rewards, support community sellers</p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-6 h-6" />
                <input
                  type="text"
                  placeholder="What are you looking for today?"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-6 py-4 rounded-2xl border-0 text-gray-900 placeholder-gray-500 focus:ring-4 focus:ring-yellow-400/30 focus:outline-none shadow-2xl text-lg backdrop-blur-sm bg-white/95"
                />
              </div>
              <button className="bg-gradient-to-r from-yellow-400 via-orange-400 to-orange-500 hover:from-yellow-500 hover:via-orange-500 hover:to-orange-600 text-black px-8 py-4 rounded-2xl font-bold transition-all duration-300 flex items-center justify-center shadow-2xl transform hover:scale-105 hover:shadow-orange-400/25">
                <Search className="w-6 h-6 mr-2" />
                Explore
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modern Category Navigation */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-6 overflow-x-auto">
              <button
                onClick={() => setSelectedCategory('')}
                className={`flex items-center px-4 py-2 rounded-full transition-all duration-200 whitespace-nowrap ${
                  selectedCategory === '' 
                    ? 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white shadow-lg transform scale-105' 
                    : 'text-gray-600 hover:text-purple-600 hover:bg-purple-50'
                }`}
              >
                <span className="mr-2">🏠</span>
                All Products
              </button>
              {categories.filter(cat => cat !== 'All Categories').slice(0, 8).map((category) => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`flex items-center px-4 py-2 rounded-full transition-all duration-200 whitespace-nowrap ${
                    selectedCategory === category 
                      ? 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white shadow-lg transform scale-105' 
                      : 'text-gray-600 hover:text-purple-600 hover:bg-purple-50'
                  }`}
                >
                  <span className="mr-2">
                    {category === 'Electronics' ? '📱' :
                     category === 'Clothing & Fashion' ? '👕' :
                     category === 'Home & Garden' ? '🏡' :
                     category === 'Books & Media' ? '📚' :
                     category === 'Digital Products' ? '💻' :
                     category === 'Food & Beverage' ? '🍯' :
                     category === 'Beauty & Personal Care' ? '💄' :
                     category === 'Sports & Outdoors' ? '⚽' :
                     category === 'Toys & Games' ? '🎮' :
                     category === 'Art & Crafts' ? '🎨' :
                     category === 'Automotive' ? '🚗' :
                     category === 'Health & Wellness' ? '💊' : '🛍️'}
                  </span>
                  {category}
                </button>
              ))}
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="flex items-center bg-gray-50 rounded-full p-1">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded-full transition-colors ${
                    viewMode === 'grid' ? 'bg-white shadow-sm text-purple-600' : 'text-gray-400'
                  }`}
                >
                  <Grid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded-full transition-colors ${
                    viewMode === 'list' ? 'bg-white shadow-sm text-purple-600' : 'text-gray-400'
                  }`}
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
              
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-4 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
              >
                <option value="newest">Newest First</option>
                <option value="popular">Most Popular</option>
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
                <option value="commission">Highest Commission</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Breadcrumbs */}
        <div className="text-sm text-gray-600 mb-4">
          <Link to="/" className="hover:text-orange-600">Home</Link>
          <span className="mx-2">›</span>
          <span>Marketplace</span>
          {selectedCategory && (
            <>
              <span className="mx-2">›</span>
              <span>{selectedCategory}</span>
            </>
          )}
        </div>

        <div className="flex gap-6">
          {/* Left Sidebar - Filters */}
          <div className="hidden lg:block w-64 bg-white rounded-lg border border-gray-200 p-4 h-fit">
            <h3 className="font-bold text-gray-900 mb-4">Department</h3>
            <div className="space-y-2 mb-6">
              {categories.slice(1).map((category) => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`block w-full text-left text-sm hover:text-orange-600 transition-colors ${
                    selectedCategory === category ? 'text-orange-600 font-medium' : 'text-gray-700'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>

            <h3 className="font-bold text-gray-900 mb-4">Price</h3>
            <div className="space-y-2 mb-6">
              <button className="block w-full text-left text-sm text-gray-700 hover:text-orange-600">Under $25</button>
              <button className="block w-full text-left text-sm text-gray-700 hover:text-orange-600">$25 to $50</button>
              <button className="block w-full text-left text-sm text-gray-700 hover:text-orange-600">$50 to $100</button>
              <button className="block w-full text-left text-sm text-gray-700 hover:text-orange-600">$100 to $200</button>
              <button className="block w-full text-left text-sm text-gray-700 hover:text-orange-600">$200 & Above</button>
            </div>

            <h3 className="font-bold text-gray-900 mb-4">Customer Reviews</h3>
            <div className="space-y-2 mb-6">
              <div className="flex items-center text-sm">
                <div className="flex text-yellow-400 mr-1">★★★★★</div>
                <span className="text-gray-600">& Up</span>
              </div>
              <div className="flex items-center text-sm">
                <div className="flex text-yellow-400 mr-1">★★★★☆</div>
                <span className="text-gray-600">& Up</span>
              </div>
              <div className="flex items-center text-sm">
                <div className="flex text-yellow-400 mr-1">★★★☆☆</div>
                <span className="text-gray-600">& Up</span>
              </div>
            </div>

            <h3 className="font-bold text-gray-900 mb-4">Commission Rate</h3>
            <div className="space-y-2">
              <button className="block w-full text-left text-sm text-gray-700 hover:text-orange-600">10% & Above</button>
              <button className="block w-full text-left text-sm text-gray-700 hover:text-orange-600">15% & Above</button>
              <button className="block w-full text-left text-sm text-gray-700 hover:text-orange-600">20% & Above</button>
            </div>
          </div>

          {/* Main Product Area */}
          <div className="flex-1">
            {/* Results Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm text-gray-600">
                <span className="font-bold text-gray-900">{filteredProducts.length}</span> results
                {selectedCategory && <span> for "{selectedCategory}"</span>}
                {searchTerm && <span> for "{searchTerm}"</span>}
              </div>
              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-600">Sort by:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="text-sm border border-gray-300 rounded px-3 py-1 focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="newest">Featured</option>
                  <option value="price-low">Price: Low to High</option>
                  <option value="price-high">Price: High to Low</option>
                  <option value="popular">Avg. Customer Review</option>
                  <option value="commission">Best Commission</option>
                </select>
                <div className="flex border border-gray-300 rounded overflow-hidden">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-1 ${viewMode === 'grid' ? 'bg-gray-200' : ''}`}
                  >
                    <Grid className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-1 ${viewMode === 'list' ? 'bg-gray-200' : ''}`}
                  >
                    <List className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Products Grid */}
            <div className={`${
              viewMode === 'grid' 
                ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4' 
                : 'space-y-4'
            }`}>
              {filteredProducts.map((product) => (
                <ProductCard 
                  key={product.id} 
                  product={product} 
                  viewMode={viewMode}
                  affiliateRef={affiliateRef}
                />
              ))}
            </div>

            {!loading && filteredProducts.length === 0 && (
              <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
                <div className="text-6xl mb-4">🔍</div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No products found</h3>
                <p className="text-gray-600 mb-4">Try adjusting your search or filters</p>
                <button 
                  onClick={() => {
                    setSearchTerm('');
                    setSelectedCategory('');
                    setPriceRange([0, 1000]);
                  }}
                  className="bg-yellow-400 hover:bg-yellow-500 text-black px-6 py-2 rounded font-medium transition-colors"
                >
                  Clear Filters
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Beezio Community Footer */}
        <div className="mt-20 bg-gradient-to-br from-purple-600 via-purple-700 to-indigo-800 rounded-3xl p-12 text-white relative overflow-hidden">
          <div className="absolute inset-0 bg-black/10"></div>
          <div className="absolute top-0 right-0 w-64 h-64 bg-yellow-400/10 rounded-full -translate-y-32 translate-x-32"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-orange-400/10 rounded-full translate-y-24 -translate-x-24"></div>
          
          <div className="relative">
            <div className="text-center mb-12">
              <div className="flex items-center justify-center mb-4">
                <div className="w-16 h-16 bg-gradient-to-br from-yellow-400 to-orange-400 rounded-full flex items-center justify-center mr-4 shadow-2xl">
                  <span className="text-3xl">🐝</span>
                </div>
                <h2 className="text-4xl font-bold">Join the Beezio Community</h2>
              </div>
              <p className="text-xl text-purple-200 max-w-2xl mx-auto">
                Where local commerce meets global opportunity. Shop, sell, and earn together.
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 text-center border border-white/20">
                <div className="w-16 h-16 bg-gradient-to-br from-green-400 to-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <span className="text-3xl">🚚</span>
                </div>
                <h3 className="text-xl font-bold mb-3">FREE Shipping</h3>
                <p className="text-purple-200">Free shipping on orders over $35. Fast, reliable delivery to your door.</p>
              </div>
              
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 text-center border border-white/20">
                <div className="w-16 h-16 bg-gradient-to-br from-orange-400 to-red-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <span className="text-3xl">💰</span>
                </div>
                <h3 className="text-xl font-bold mb-3">Earn Rewards</h3>
                <p className="text-purple-200">Join our affiliate network and earn commissions on every sale you generate.</p>
              </div>
              
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 text-center border border-white/20">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <span className="text-3xl">🤝</span>
                </div>
                <h3 className="text-xl font-bold mb-3">Community First</h3>
                <p className="text-purple-200">Support local sellers and build stronger communities together.</p>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link 
                to="/start-earning" 
                className="bg-gradient-to-r from-yellow-400 to-orange-400 hover:from-yellow-500 hover:to-orange-500 text-black px-8 py-4 rounded-2xl font-bold transition-all duration-200 transform hover:scale-105 shadow-2xl"
              >
                🚀 Start Earning Today
              </Link>
              {!user && (
                <Link 
                  to="/dashboard" 
                  className="bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white px-8 py-4 rounded-2xl font-bold transition-all duration-200 border border-white/30 hover:border-white/50"
                >
                  💼 Become a Seller
                </Link>
              )}
            </div>
            
            <div className="mt-12 pt-8 border-t border-white/20 text-center text-purple-200">
              <p className="text-sm">
                🌟 Trusted by {marketplaceStats.activeSellers}+ sellers • {marketplaceStats.totalProducts}+ products • {marketplaceStats.averageRating}/5 rating
              </p>
            </div>
          </div>
        </div>

                Start Selling
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
            <img 
              src={product.images?.[0] || '/api/placeholder/300/200'} 
              alt={product.title}
              className="w-full h-full object-cover rounded"
            />
          </div>
          
          <div className="flex-1">
            <Link 
              to={`/product/${product.id}${affiliateRef ? `?ref=${affiliateRef}` : ''}`}
              className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
            >
              {product.title}
            </Link>
            
            <div className="flex items-center mt-1 mb-2">
              <div className="flex text-yellow-400 text-sm mr-2">
                {'★'.repeat(Math.floor(product.average_rating || 4.5))}
                {'☆'.repeat(5 - Math.floor(product.average_rating || 4.5))}
              </div>
              <span className="text-blue-600 text-sm hover:underline cursor-pointer">
                ({product.review_count || Math.floor(Math.random() * 1000) + 100})
              </span>
            </div>
            
            <div className="text-xl font-bold text-gray-900 mb-1">
              ${product.price}
              <span className="text-sm font-normal text-gray-600 ml-2">
                ({product.commission_rate}% commission)
              </span>
            </div>
            
            <div className="text-sm text-gray-600 mb-2">
              FREE Shipping on orders over $35 shipped by Beezio
            </div>
            
            <div className="text-sm text-gray-600">
              Sold by <span className="text-blue-600">{product.profiles?.full_name || 'Beezio Seller'}</span>
            </div>
          </div>

          <div className="flex flex-col items-end">
            <button className="text-gray-400 hover:text-red-500 mb-2">
              <Heart className="w-5 h-5" />
            </button>
            <Link 
              to={`/product/${product.id}${affiliateRef ? `?ref=${affiliateRef}` : ''}`}
              className="bg-yellow-400 hover:bg-yellow-500 text-black px-4 py-2 rounded text-sm font-medium transition-colors"
            >
              Add to Cart
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition-shadow group">
      <div className="relative">
        <img 
          src={product.images?.[0] || '/api/placeholder/300/200'} 
          alt={product.title}
          className="w-full h-48 object-cover"
        />
        <button className="absolute top-2 right-2 text-gray-400 hover:text-red-500 bg-white rounded-full p-1 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity">
          <Heart className="w-4 h-4" />
        </button>
        {product.commission_rate >= 15 && (
          <div className="absolute top-2 left-2 bg-red-600 text-white text-xs px-2 py-1 rounded">
            {product.commission_rate}% Commission
          </div>
        )}
      </div>
      
      <div className="p-3">
        <Link 
          to={`/product/${product.id}${affiliateRef ? `?ref=${affiliateRef}` : ''}`}
          className="text-blue-600 hover:text-blue-800 hover:underline text-sm line-clamp-2 mb-2 block"
        >
          {product.title}
        </Link>
        
        <div className="flex items-center mb-2">
          <div className="flex text-yellow-400 text-sm mr-1">
            {'★'.repeat(Math.floor(product.average_rating || 4.5))}
            {'☆'.repeat(5 - Math.floor(product.average_rating || 4.5))}
          </div>
          <span className="text-blue-600 text-xs hover:underline cursor-pointer">
            ({product.review_count || Math.floor(Math.random() * 1000) + 100})
          </span>
        </div>
        
        <div className="text-lg font-bold text-gray-900 mb-1">
          ${product.price}
        </div>
        
        <div className="text-xs text-gray-600 mb-2">
          FREE Shipping
        </div>
        
        <div className="text-xs text-gray-600 mb-3">
          Sold by <span className="text-blue-600">{product.profiles?.full_name || 'Beezio Seller'}</span>
        </div>
        
        <Link 
          to={`/product/${product.id}${affiliateRef ? `?ref=${affiliateRef}` : ''}`}
          className="w-full bg-yellow-400 hover:bg-yellow-500 text-black py-2 px-3 rounded text-sm font-medium transition-colors text-center block"
        >
          Add to Cart
        </Link>
      </div>
    </div>
  );
};
