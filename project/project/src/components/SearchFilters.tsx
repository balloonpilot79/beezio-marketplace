import React, { useState, useMemo } from 'react';
import { Search, Filter, X } from 'lucide-react';

interface Product {
  id: string;
  title: string;
  price: number;
  commission_rate: number;
  seller_id: string;
  description?: string;
  images: string[];
  is_subscription?: boolean;
  average_rating?: number;
  review_count?: number;
}

interface SearchFiltersProps {
  products: Product[];
  onFilteredProducts: (products: Product[]) => void;
}

const SearchFilters: React.FC<SearchFiltersProps> = ({ products, onFilteredProducts }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [priceRange, setPriceRange] = useState({ min: '', max: '' });
  const [sortBy, setSortBy] = useState('featured');
  const [commissionFilter, setCommissionFilter] = useState('all');
  const [ratingFilter, setRatingFilter] = useState('all');
  const [subscriptionFilter, setSubscriptionFilter] = useState('all');

  const filteredProducts = useMemo(() => {
    let filtered = [...products];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(product =>
        product.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Price range filter
    if (priceRange.min) {
      filtered = filtered.filter(product => product.price >= parseFloat(priceRange.min));
    }
    if (priceRange.max) {
      filtered = filtered.filter(product => product.price <= parseFloat(priceRange.max));
    }

    // Commission filter
    if (commissionFilter === 'high') {
      filtered = filtered.filter(product => product.commission_rate >= 15);
    } else if (commissionFilter === 'medium') {
      filtered = filtered.filter(product => product.commission_rate >= 8 && product.commission_rate < 15);
    } else if (commissionFilter === 'low') {
      filtered = filtered.filter(product => product.commission_rate < 8);
    }

    // Rating filter
    if (ratingFilter !== 'all') {
      const minRating = parseFloat(ratingFilter);
      filtered = filtered.filter(product => 
        product.average_rating && product.average_rating >= minRating
      );
    }

    // Subscription filter
    if (subscriptionFilter === 'subscription') {
      filtered = filtered.filter(product => product.is_subscription);
    } else if (subscriptionFilter === 'one-time') {
      filtered = filtered.filter(product => !product.is_subscription);
    }

    // Sorting
    switch (sortBy) {
      case 'price-low':
        filtered.sort((a, b) => a.price - b.price);
        break;
      case 'price-high':
        filtered.sort((a, b) => b.price - a.price);
        break;
      case 'commission':
        filtered.sort((a, b) => b.commission_rate - a.commission_rate);
        break;
      case 'rating':
        filtered.sort((a, b) => (b.average_rating || 0) - (a.average_rating || 0));
        break;
      case 'newest':
        // In a real app, you'd sort by creation date
        break;
      default:
        // Featured/default order
        break;
    }

    return filtered;
  }, [products, searchTerm, priceRange, sortBy, commissionFilter, ratingFilter, subscriptionFilter]);

  React.useEffect(() => {
    onFilteredProducts(filteredProducts);
  }, [filteredProducts, onFilteredProducts]);

  const clearFilters = () => {
    setSearchTerm('');
    setPriceRange({ min: '', max: '' });
    setSortBy('featured');
    setCommissionFilter('all');
    setRatingFilter('all');
    setSubscriptionFilter('all');
  };

  const hasActiveFilters = searchTerm || priceRange.min || priceRange.max || 
    commissionFilter !== 'all' || ratingFilter !== 'all' || subscriptionFilter !== 'all';

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
      {/* Search Bar */}
      <div className="flex flex-col lg:flex-row gap-4 mb-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search products..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-amber-500 focus:border-amber-500"
          />
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Filter className="w-4 h-4" />
            <span>Filters</span>
            {hasActiveFilters && (
              <span className="bg-amber-500 text-white text-xs rounded-full w-2 h-2"></span>
            )}
          </button>
          
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center space-x-2 px-4 py-2 text-red-600 hover:bg-red-50 border border-red-300 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
              <span>Clear</span>
            </button>
          )}
        </div>
      </div>

      {/* Sort Dropdown */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-600">Sort by:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="border border-gray-300 rounded px-3 py-1 text-sm focus:ring-amber-500 focus:border-amber-500"
          >
            <option value="featured">Featured</option>
            <option value="price-low">Price: Low to High</option>
            <option value="price-high">Price: High to Low</option>
            <option value="commission">Highest Commission</option>
            <option value="rating">Highest Rated</option>
            <option value="newest">Newest</option>
          </select>
        </div>
        
        <div className="text-sm text-gray-600">
          {filteredProducts.length} of {products.length} products
        </div>
      </div>

      {/* Advanced Filters */}
      {showFilters && (
        <div className="border-t pt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Price Range */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Price Range
            </label>
            <div className="flex space-x-2">
              <input
                type="number"
                placeholder="Min"
                value={priceRange.min}
                onChange={(e) => setPriceRange(prev => ({ ...prev, min: e.target.value }))}
                className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-amber-500 focus:border-amber-500"
              />
              <input
                type="number"
                placeholder="Max"
                value={priceRange.max}
                onChange={(e) => setPriceRange(prev => ({ ...prev, max: e.target.value }))}
                className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-amber-500 focus:border-amber-500"
              />
            </div>
          </div>

          {/* Commission Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Commission Rate
            </label>
            <select
              value={commissionFilter}
              onChange={(e) => setCommissionFilter(e.target.value)}
              className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:ring-amber-500 focus:border-amber-500"
            >
              <option value="all">All Commissions</option>
              <option value="high">High (15%+)</option>
              <option value="medium">Medium (8-15%)</option>
              <option value="low">Low (Under 8%)</option>
            </select>
          </div>

          {/* Rating Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Minimum Rating
            </label>
            <select
              value={ratingFilter}
              onChange={(e) => setRatingFilter(e.target.value)}
              className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:ring-amber-500 focus:border-amber-500"
            >
              <option value="all">All Ratings</option>
              <option value="4">4+ Stars</option>
              <option value="3">3+ Stars</option>
              <option value="2">2+ Stars</option>
            </select>
          </div>

          {/* Subscription Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Product Type
            </label>
            <select
              value={subscriptionFilter}
              onChange={(e) => setSubscriptionFilter(e.target.value)}
              className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:ring-amber-500 focus:border-amber-500"
            >
              <option value="all">All Products</option>
              <option value="one-time">One-time Purchase</option>
              <option value="subscription">Subscription</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchFilters;
