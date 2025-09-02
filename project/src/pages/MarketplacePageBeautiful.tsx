import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, Grid3X3, List, Star, Heart, Share2, ChevronDown, ArrowUpDown, Filter, Tag, TrendingUp } from 'lucide-react';
import { SAMPLE_PRODUCTS } from '../data/sampleProducts';
import { isProductSampleDataEnabled } from '../config/sampleDataConfig';

type SortOption = 'featured' | 'price-low' | 'price-high' | 'rating' | 'newest' | 'commission';

const CATEGORIES = [
  'All Categories',
  'Electronics',
  'Fashion', 
  'Home & Garden',
  'Books',
  'Sports',
  'Beauty',
  'Health & Wellness',
  'Technology',
  'Arts & Crafts',
  'Automotive',
  'Pet Supplies',
  'Toys & Games'
];

const MarketplacePageBeautiful = () => {
  const enableSampleData = isProductSampleDataEnabled();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All Categories');
  const [sortBy, setSortBy] = useState<SortOption>('featured');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showFilters, setShowFilters] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  // Get products based on sample data configuration
  const products = enableSampleData ? SAMPLE_PRODUCTS : [];

  // Filter and sort products
  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         product.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         product.seller.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All Categories' || product.category === selectedCategory;
    return matchesSearch && matchesCategory;
  }).sort((a, b) => {
    switch (sortBy) {
      case 'price-low':
        return a.price - b.price;
      case 'price-high':
        return b.price - a.price;
      case 'rating':
        return b.rating - a.rating;
      case 'commission':
        return b.commission - a.commission;
      case 'newest':
        return new Date(b.dateAdded || '').getTime() - new Date(a.dateAdded || '').getTime();
      default:
        return 0;
    }
  });

  const toggleFavorite = (productId: string) => {
    const newFavorites = new Set(favorites);
    if (newFavorites.has(productId)) {
      newFavorites.delete(productId);
    } else {
      newFavorites.add(productId);
    }
    setFavorites(newFavorites);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Beautiful Hero Section */}
      <div className="bg-gradient-to-br from-amber-50 to-orange-50 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center mb-8">
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              Discover Amazing <span className="text-amber-600">Products</span>
            </h1>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8">
              Browse thousands of quality products from trusted sellers. Transparent pricing, competitive commissions, guaranteed satisfaction.
            </p>
          </div>

          {/* Enhanced Search Bar */}
          <div className="max-w-4xl mx-auto">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none">
                <Search className="h-6 w-6 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search for products, brands, or categories..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-14 pr-6 py-4 text-lg border-2 border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-white shadow-lg"
              />
              <div className="absolute inset-y-0 right-0 pr-6 flex items-center">
                <button className="bg-amber-600 text-white px-6 py-2 rounded-lg hover:bg-amber-700 transition-colors font-semibold">
                  Search
                </button>
              </div>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="flex justify-center space-x-8 mt-8 text-sm">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span className="text-gray-600">{products.length} Products Available</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
              <span className="text-gray-600">Trusted Sellers</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-amber-500 rounded-full"></div>
              <span className="text-gray-600">Fair Commissions</span>
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Filter & Category Bar */}
      <div className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4">
            {/* Category Pills */}
            <div className="flex items-center space-x-2 overflow-x-auto">
              {CATEGORIES.slice(0, 6).map((category) => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-all ${
                    selectedCategory === category
                      ? 'bg-amber-100 text-amber-800 shadow-md'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {category}
                </button>
              ))}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center space-x-2 px-4 py-2 rounded-full text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all"
              >
                <Filter className="w-4 h-4" />
                <span>More Filters</span>
              </button>
            </div>

            {/* Sort & View Controls */}
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <ArrowUpDown className="w-4 h-4 text-gray-500" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="featured">Featured</option>
                  <option value="price-low">Price: Low to High</option>
                  <option value="price-high">Price: High to Low</option>
                  <option value="rating">Highest Rated</option>
                  <option value="commission">Best Commission</option>
                  <option value="newest">Newest</option>
                </select>
              </div>

              <div className="flex border border-gray-300 rounded-lg overflow-hidden">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 ${viewMode === 'grid' ? 'bg-amber-100 text-amber-600' : 'bg-white text-gray-500'}`}
                >
                  <Grid3X3 className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 ${viewMode === 'list' ? 'bg-amber-100 text-amber-600' : 'bg-white text-gray-500'}`}
                >
                  <List className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Extended Categories (when filters shown) */}
          {showFilters && (
            <div className="pb-4">
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.slice(6).map((category) => (
                  <button
                    key={category}
                    onClick={() => setSelectedCategory(category)}
                    className={`px-3 py-1 rounded-full text-sm transition-all ${
                      selectedCategory === category
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {category}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Results Header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {selectedCategory === 'All Categories' ? 'All Products' : selectedCategory}
            </h2>
            <p className="text-gray-600 mt-1">
              {filteredProducts.length} {filteredProducts.length === 1 ? 'product' : 'products'} found
              {searchQuery && ` for "${searchQuery}"`}
            </p>
          </div>
          
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="text-amber-600 hover:text-amber-700 font-medium"
            >
              Clear search
            </button>
          )}
        </div>
      </div>

      {/* Products Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        {filteredProducts.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Search className="w-12 h-12 text-gray-400" />
            </div>
            <h3 className="text-xl font-medium text-gray-900 mb-2">No products found</h3>
            <p className="text-gray-600 mb-6">Try adjusting your search or filter criteria</p>
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('All Categories');
              }}
              className="bg-amber-600 text-white px-6 py-3 rounded-lg hover:bg-amber-700 transition-colors font-medium"
            >
              View All Products
            </button>
          </div>
        ) : (
          <div className={viewMode === 'grid' ? 'grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8' : 'space-y-6'}>
            {filteredProducts.map((product) => (
              <div
                key={product.id}
                className={`group bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden ${
                  viewMode === 'list' ? 'flex' : ''
                }`}
              >
                <div className={`relative ${viewMode === 'list' ? 'w-64 flex-shrink-0' : 'aspect-w-1 aspect-h-1'}`}>
                  <img
                    src={product.image}
                    alt={product.name}
                    className={`object-cover group-hover:scale-105 transition-transform duration-300 ${
                      viewMode === 'list' ? 'w-full h-48' : 'w-full h-64'
                    }`}
                  />
                  <div className="absolute top-4 left-4">
                    <span className="bg-gradient-to-r from-green-500 to-green-600 text-white px-3 py-1 rounded-full text-sm font-bold shadow-lg">
                      {product.commission}% Commission
                    </span>
                  </div>
                  <div className="absolute top-4 right-4 flex space-x-2">
                    <button
                      onClick={() => toggleFavorite(product.id)}
                      className={`p-2 rounded-full backdrop-blur-sm transition-all ${
                        favorites.has(product.id)
                          ? 'bg-red-500 text-white'
                          : 'bg-white/80 text-gray-600 hover:bg-red-50 hover:text-red-500'
                      }`}
                    >
                      <Heart className={`w-5 h-5 ${favorites.has(product.id) ? 'fill-current' : ''}`} />
                    </button>
                    <button className="p-2 rounded-full bg-white/80 text-gray-600 hover:bg-blue-50 hover:text-blue-500 backdrop-blur-sm transition-all">
                      <Share2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                <div className={`p-6 ${viewMode === 'list' ? 'flex-1' : ''}`}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`w-4 h-4 ${
                            i < Math.floor(product.rating)
                              ? 'text-yellow-400 fill-current'
                              : 'text-gray-300'
                          }`}
                        />
                      ))}
                      <span className="text-sm text-gray-600 font-medium">({product.rating})</span>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-gray-900">${product.price}</div>
                      <div className="text-sm text-green-600 font-medium">
                        Earn ${(product.price * product.commission / 100).toFixed(2)}
                      </div>
                    </div>
                  </div>

                  <h3 className="text-lg font-bold text-gray-900 mb-2 group-hover:text-amber-600 transition-colors line-clamp-2">
                    <Link to={`/product/${product.id}`} className="hover:underline">
                      {product.name}
                    </Link>
                  </h3>

                  <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                    {product.description}
                  </p>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                        <span className="text-white text-xs font-bold">
                          {product.seller.charAt(0)}
                        </span>
                      </div>
                      <span className="text-sm text-gray-600 font-medium">{product.seller}</span>
                    </div>

                    <div className="flex items-center space-x-2">
                      <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded-full font-medium">
                        {product.category}
                      </span>
                      {product.featured && (
                        <span className="text-xs px-2 py-1 bg-amber-100 text-amber-800 rounded-full font-medium flex items-center space-x-1">
                          <TrendingUp className="w-3 h-3" />
                          <span>Featured</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <div className="flex space-x-3">
                      <Link
                        to={`/product/${product.id}`}
                        className="flex-1 bg-amber-600 text-white text-center py-2 px-4 rounded-lg hover:bg-amber-700 transition-colors font-medium"
                      >
                        View Details
                      </Link>
                      <button className="flex-1 bg-white border-2 border-amber-600 text-amber-600 py-2 px-4 rounded-lg hover:bg-amber-50 transition-colors font-medium">
                        Quick Add
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MarketplacePageBeautiful;
