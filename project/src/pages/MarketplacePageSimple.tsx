import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, Grid3X3, List, Star, Heart, Share2, ChevronDown, ArrowUpDown } from 'lucide-react';
import { SAMPLE_PRODUCTS, SampleProduct } from '../data/sampleProducts';
import { isProductSampleDataEnabled } from '../config/sampleDataConfig';
import { fetchMarketplaceProducts } from '../services/productService';

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

const MarketplacePage = () => {
  const enableSampleData = isProductSampleDataEnabled();
  const [products, setProducts] = useState<SampleProduct[]>(enableSampleData ? SAMPLE_PRODUCTS : []);
  const [loading, setLoading] = useState(!enableSampleData);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All Categories');
  const [sortBy, setSortBy] = useState<SortOption>('featured');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showFilters, setShowFilters] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  useEffect(() => {
    const loadProducts = async () => {
      if (enableSampleData) {
        setProducts(SAMPLE_PRODUCTS);
        setError(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const realProducts = await fetchMarketplaceProducts();
        setProducts(realProducts);
      } catch (err) {
        console.error('MarketplacePageSimple: unable to load Supabase products', err);
        setProducts([]);
        setError('Unable to load products from Supabase. Please verify your database connection.');
      } finally {
        setLoading(false);
      }
    };

    loadProducts();
  }, [enableSampleData]);

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
      case 'newest':
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      case 'commission':
        return b.commission_rate - a.commission_rate;
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center bg-white p-12 rounded-2xl shadow-xl">
          <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Loading Marketplace</h2>
          <p className="text-gray-600 text-lg">Fetching products...</p>
        </div>
      </div>
    );
  }

  if (!enableSampleData && products.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center bg-white p-12 rounded-2xl shadow-xl">
          <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Search className="w-12 h-12 text-gray-400" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Marketplace</h2>
          {error ? (
            <>
              <p className="text-gray-600 text-lg">We couldn&apos;t load your products right now.</p>
              <p className="text-sm text-gray-500 mt-2">{error}</p>
            </>
          ) : (
            <>
              <p className="text-gray-600 text-lg">No products are live yet.</p>
              <p className="text-sm text-gray-500 mt-2">Add products via the Seller dashboard or Supabase to populate the marketplace.</p>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Modern Header with Gradient */}
      <div className="bg-white shadow-lg border-b border-gray-200">
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white py-4">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <h1 className="text-3xl font-bold">🐝 Beezio Marketplace</h1>
                <div className="hidden sm:flex items-center space-x-2 text-blue-100">
                  <span className="bg-white/20 px-3 py-1 rounded-full text-sm font-medium">
                    100% Transparent Pricing
                  </span>
                </div>
              </div>
              
              <div className="text-right">
                <p className="text-blue-100 text-sm">
                  {filteredProducts.length} products • All with fair commissions
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            {/* Search and Filter Bar */}
            <div className="flex flex-col lg:flex-row gap-4 mb-6">
              {/* Enhanced Search Bar */}
              <div className="flex-1 relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="Search products, sellers, or categories..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="block w-full pl-12 pr-4 py-4 border-2 border-gray-200 rounded-2xl leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm text-lg"
                />
              </div>

              {/* Modern Filter Controls */}
              <div className="flex flex-wrap gap-3">
                {/* Category Filter */}
                <div className="relative">
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="appearance-none bg-white border-2 border-gray-200 rounded-xl px-6 py-4 pr-12 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm font-medium text-gray-700 min-w-[200px] cursor-pointer hover:border-gray-300 transition-colors"
                  >
                    {CATEGORIES.map(category => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none">
                    <ChevronDown className="h-5 w-5 text-gray-400" />
                  </div>
                </div>

                {/* Sort Filter */}
                <div className="relative">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortOption)}
                    className="appearance-none bg-white border-2 border-gray-200 rounded-xl px-6 py-4 pr-12 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm font-medium text-gray-700 min-w-[180px] cursor-pointer hover:border-gray-300 transition-colors"
                  >
                    <option value="featured">Featured</option>
                    <option value="newest">Newest First</option>
                    <option value="price-low">Price: Low to High</option>
                    <option value="price-high">Price: High to Low</option>
                    <option value="rating">Highest Rated</option>
                    <option value="commission">Best Commission</option>
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none">
                    <ArrowUpDown className="h-4 w-4 text-gray-400" />
                  </div>
                </div>

                {/* View Toggle */}
                <div className="flex bg-gray-100 rounded-xl p-1 shadow-sm">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-3 rounded-lg transition-all ${
                      viewMode === 'grid'
                        ? 'bg-white shadow-md text-blue-600'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <Grid3X3 className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-3 rounded-lg transition-all ${
                      viewMode === 'list'
                        ? 'bg-white shadow-md text-blue-600'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <List className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Results Summary */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-4">
                <p className="text-gray-600">
                  <span className="font-semibold text-gray-900">{filteredProducts.length}</span> products found
                  {selectedCategory !== 'All Categories' && (
                    <span> in <span className="font-medium text-blue-600">{selectedCategory}</span></span>
                  )}
                </p>
                {searchQuery && (
                  <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                    "{searchQuery}"
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Products Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {filteredProducts.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-6">
              <Search className="w-12 h-12 text-gray-400" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-4">No products found</h3>
            <p className="text-gray-600 text-lg max-w-md mx-auto">
              Try adjusting your search or filter criteria to find what you're looking for.
            </p>
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('All Categories');
              }}
              className="mt-6 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Clear Filters
            </button>
          </div>
        ) : (
          <div className={
            viewMode === 'grid'
              ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8"
              : "space-y-6"
          }>
            {filteredProducts.map((product) => (
              <div
                key={product.id}
                className={`group bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 border border-gray-100 overflow-hidden ${
                  viewMode === 'list' ? 'flex' : ''
                }`}
              >
                {/* Product Image */}
                <div className={`relative ${viewMode === 'list' ? 'w-64 flex-shrink-0' : ''}`}>
                  <img
                    src={product.image}
                    alt={product.name}
                    className={`w-full object-cover group-hover:scale-105 transition-transform duration-300 ${
                      viewMode === 'list' ? 'h-48' : 'h-56'
                    }`}
                  />
                  
                  {/* Floating Action Buttons */}
                  <div className="absolute top-3 right-3 flex flex-col space-y-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => toggleFavorite(product.id)}
                      className={`p-2 rounded-full shadow-lg transition-colors ${
                        favorites.has(product.id)
                          ? 'bg-red-500 text-white'
                          : 'bg-white text-gray-600 hover:text-red-500'
                      }`}
                    >
                      <Heart className={`w-4 h-4 ${favorites.has(product.id) ? 'fill-current' : ''}`} />
                    </button>
                    <button className="p-2 bg-white text-gray-600 rounded-full shadow-lg hover:text-blue-500 transition-colors">
                      <Share2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Commission Badge */}
                  <div className="absolute top-3 left-3">
                    <span className="bg-gradient-to-r from-green-500 to-green-600 text-white px-3 py-1 rounded-full text-sm font-bold shadow-lg">
                      {product.commission_rate}% Commission
                    </span>
                  </div>
                </div>

                {/* Product Details */}
                <div className={`p-6 ${viewMode === 'list' ? 'flex-1' : ''}`}>
                  <div className="mb-3">
                    <h3 className="text-xl font-bold text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-2 mb-2">
                      {product.name}
                    </h3>
                    <p className="text-gray-600 text-sm line-clamp-2 leading-relaxed">
                      {product.description}
                    </p>
                  </div>

                  {/* Rating and Reviews */}
                  <div className="flex items-center mb-4">
                    <div className="flex items-center">
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
                    </div>
                    <span className="ml-2 text-sm text-gray-600 font-medium">
                      {product.rating} ({product.reviews} reviews)
                    </span>
                  </div>

                  {/* Price and Seller */}
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-3xl font-bold text-gray-900">
                        ${product.price}
                      </p>
                      <p className="text-sm text-gray-500">by {product.seller}</p>
                    </div>
                    <div className="text-right">
                      <div className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium">
                        {product.commission_rate}% Commission
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Earn ${(product.price * product.commission_rate / 100).toFixed(2)}
                      </p>
                    </div>
                  </div>

                  {/* Action Button */}
                  <Link
                    to={`/product/${product.id}`}
                    className="block w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white text-center py-3 px-6 rounded-xl font-semibold hover:from-blue-700 hover:to-purple-700 transition-all transform hover:scale-105 shadow-lg"
                  >
                    View Details
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Load More Button (if needed for pagination) */}
      {filteredProducts.length > 0 && (
        <div className="text-center pb-12">
          <button className="bg-white text-gray-700 border-2 border-gray-300 px-8 py-3 rounded-xl hover:border-blue-500 hover:text-blue-600 transition-all font-medium shadow-sm">
            Load More Products
          </button>
        </div>
      )}
    </div>
  );
};

export default MarketplacePage;
