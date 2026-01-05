import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Filter, Grid, List, Search } from 'lucide-react';
import { SAMPLE_PRODUCTS, SampleProduct } from '../data/sampleProducts';
import { useSampleData } from '../config/sampleDataConfig';

interface MarketplaceP                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </AnimatePresence>

            {filteredAndSortedProducts.length === 0 && (
type SortOption = 'newest' | 'price-high' | 'price-low' | 'alphabetical' | 'commission-high' | 'rating';

const CATEGORIES = [
  'All Products',
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

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest First' },
  { value: 'price-high', label: 'Price: High to Low' },
  { value: 'price-low', label: 'Price: Low to High' },
  { value: 'alphabetical', label: 'Alphabetical' },
  { value: 'commission-high', label: 'Highest Commission' },
  { value: 'rating', label: 'Highest Rated' }
];

const Marketplace: React.FC<MarketplaceProps> = () => {
  const { enableSampleData } = useSampleData();
  const [selectedCategory, setSelectedCategory] = useState('All Products');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [newestSliderIndex, setNewestSliderIndex] = useState(0);

  // Get URL parameters on component mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const category = urlParams.get('category');
    if (category && CATEGORIES.includes(category)) {
      setSelectedCategory(category);
    }
  }, []);

  // Filter and sort products
  const filteredAndSortedProducts = useMemo(() => {
    if (!enableSampleData) return [];

    let filtered = SAMPLE_PRODUCTS;

    // Filter by category
    if (selectedCategory !== 'All Products') {
      filtered = filtered.filter(product => product.category === selectedCategory);
    }

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(product => 
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.seller.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Sort products
    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'price-high':
          return b.price - a.price;
        case 'price-low':
          return a.price - b.price;
        case 'alphabetical':
          return a.name.localeCompare(b.name);
        case 'commission-high':
          return b.commission_rate - a.commission_rate;
        case 'rating':
          return b.rating - a.rating;
        default:
          return 0;
      }
    });

    return sorted;
  }, [enableSampleData, selectedCategory, sortBy, searchTerm]);

  // Get newest products for slider
  const newestProducts = useMemo(() => {
    if (!enableSampleData) return [];
    return [...SAMPLE_PRODUCTS]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 8);
  }, [enableSampleData]);

  // Group products by category for category sections
  const productsByCategory = useMemo(() => {
    if (!enableSampleData) return {};
    
    const grouped: { [key: string]: SampleProduct[] } = {};
    CATEGORIES.slice(1).forEach(category => { // Skip 'All Products'
      grouped[category] = SAMPLE_PRODUCTS
        .filter(product => product.category === category)
        .slice(0, 4); // Show 4 products per category
    });
    return grouped;
  }, [enableSampleData]);

  const handleCategoryClick = (category: string) => {
    setSelectedCategory(category);
    // Update URL without page reload
    const newUrl = category === 'All Products' ? '/marketplace' : `/marketplace?category=${encodeURIComponent(category)}`;
    window.history.pushState({}, '', newUrl);
  };

  const nextNewestSlide = () => {
    setNewestSliderIndex((prev) => (prev + 1) % Math.max(1, newestProducts.length - 3));
  };

  const prevNewestSlide = () => {
    setNewestSliderIndex((prev) => (prev - 1 + Math.max(1, newestProducts.length - 3)) % Math.max(1, newestProducts.length - 3));
  };

  if (!enableSampleData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Marketplace</h2>
          <p className="text-gray-600">Sample data is currently disabled.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">Marketplace</h1>

          {/* Newest Products Slider */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Newest Products</h2>
              <div className="flex gap-2">
                <button
                  onClick={prevNewestSlide}
                  className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={nextNewestSlide}
                  className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <div className="relative overflow-hidden">
              <div 
                className="flex transition-transform duration-300 ease-in-out"
                style={{ transform: `translateX(-${newestSliderIndex * 25}%)` }}
              >
                {newestProducts.map((product) => (
                  <div key={product.id} className="w-1/4 flex-shrink-0 px-2">
                    <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
                      <img
                        src={product.image}
                        alt={product.name}
                        className="w-full h-48 object-cover"
                      />
                      <div className="p-4">
                        <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2">{product.name}</h3>
                        <p className="text-lg font-bold text-blue-600">${product.price}</p>
                        <div className="flex items-center mt-2">
                          <div className="flex text-yellow-400">
                            {'★'.repeat(Math.floor(product.rating))}
                          </div>
                          <span className="text-sm text-gray-600 ml-2">({product.reviews})</span>
                        </div>
                        <div className="mt-2">
                          <span className="text-sm bg-green-100 text-green-800 px-2 py-1 rounded-full">
                            {product.commission_rate}% Commission
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Category Buttons */}
          <div className="flex flex-wrap gap-2 mb-6">
            {CATEGORIES.map((category) => (
              <button
                key={category}
                onClick={() => handleCategoryClick(category)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  selectedCategory === category
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {category}
              </button>
            ))}
          </div>

          {/* Search and Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            
            <div className="flex gap-2">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {SORT_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              
              <div className="flex border border-gray-300 rounded-lg overflow-hidden">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 ${viewMode === 'grid' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                >
                  <Grid className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                >
                  <List className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {selectedCategory === 'All Products' ? (
          // Category Sections View
          <div className="space-y-12">
            {Object.entries(productsByCategory).map(([category, products]) => (
              <div key={category}>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-gray-900">{category}</h2>
                  <button
                    onClick={() => handleCategoryClick(category)}
                    className="text-blue-600 hover:text-blue-700 font-medium"
                  >
                    View All
                  </button>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {products.map((product) => (
                    <motion.div
                      key={product.id}
                      layout
                      className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow"
                    >
                      <img
                        src={product.image}
                        alt={product.name}
                        className="w-full h-48 object-cover"
                      />
                      <div className="p-4">
                        <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2">{product.name}</h3>
                        <p className="text-sm text-gray-600 mb-2 line-clamp-2">{product.description}</p>
                        <p className="text-lg font-bold text-blue-600 mb-2">${product.price}</p>
                        <div className="flex items-center mb-2">
                          <div className="flex text-yellow-400">
                            {'★'.repeat(Math.floor(product.rating))}
                          </div>
                          <span className="text-sm text-gray-600 ml-2">({product.reviews})</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">by {product.seller}</span>
                          <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                            {product.commission_rate}%
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          // Filtered Products View
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">
                {selectedCategory} ({filteredAndSortedProducts.length} products)
              </h2>
            </div>

            <AnimatePresence>
              <div className={viewMode === 'grid' 
                ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
                : "space-y-4"
              }>
                {filteredAndSortedProducts.map((product) => (
                  <motion.div
                    key={product.id}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className={viewMode === 'grid' 
                      ? "bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow"
                      : "bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow flex"
                    }
                  >
                    <img
                      src={product.image}
                      alt={product.name}
                      className={viewMode === 'grid' 
                        ? "w-full h-48 object-cover"
                        : "w-48 h-32 object-cover flex-shrink-0"
                      }
                    />
                    <div className="p-4 flex-1">
                      <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2">{product.name}</h3>
                      <p className="text-sm text-gray-600 mb-2 line-clamp-2">{product.description}</p>
                      <p className="text-lg font-bold text-blue-600 mb-2">${product.price}</p>
                      <div className="flex items-center mb-2">
                        <div className="flex text-yellow-400">
                          {'★'.repeat(Math.floor(product.rating))}
                        </div>
                        <span className="text-sm text-gray-600 ml-2">({product.reviews})</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">by {product.seller}</span>
                        <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                          {product.commission_rate}% Commission
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {filteredAndSortedProducts.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-500 text-lg">No products found matching your criteria.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Marketplace;
