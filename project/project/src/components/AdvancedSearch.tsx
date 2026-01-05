import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  Filter, 
  X, 
  ChevronDown, 
  Star, 
  DollarSign, 
  Tag, 
  MapPin, 
  TrendingUp,
  Clock,
  Zap
} from 'lucide-react';
import { supabase } from '../lib/supabase';

interface SearchFilters {
  query: string;
  category: string;
  priceMin: string;
  priceMax: string;
  rating: string;
  hasCommission: boolean | null;
  isSubscription: boolean | null;
  location: string;
  sortBy: 'relevance' | 'price_asc' | 'price_desc' | 'rating' | 'newest';
}

interface SearchSuggestion {
  suggestion: string;
  type: 'product' | 'category' | 'tag';
  count: number;
}

interface Category {
  id: string;
  name: string;
  slug: string;
}

interface AdvancedSearchProps {
  onSearch: (filters: SearchFilters) => void;
  onFiltersChange?: (filters: SearchFilters) => void;
  initialFilters?: Partial<SearchFilters>;
  showTrending?: boolean;
}

const AdvancedSearch: React.FC<AdvancedSearchProps> = ({
  onSearch,
  onFiltersChange,
  initialFilters = {},
  showTrending = true
}) => {
  const [filters, setFilters] = useState<SearchFilters>({
    query: '',
    category: '',
    priceMin: '',
    priceMax: '',
    rating: '',
    hasCommission: null,
    isSubscription: null,
    location: '',
    sortBy: 'relevance',
    ...initialFilters
  });

  const [showFilters, setShowFilters] = useState(false);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [trendingSearches, setTrendingSearches] = useState<string[]>([]);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  
  const searchInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadCategories();
    loadTrendingSearches();
    loadSearchHistory();
  }, []);

  useEffect(() => {
    onFiltersChange?.(filters);
  }, [filters, onFiltersChange]);

  const loadCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('id, name, slug')
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  };

  const loadTrendingSearches = async () => {
    try {
      const { data, error } = await supabase
        .from('search_analytics')
        .select('search_query')
        .gte('search_timestamp', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .not('search_query', 'eq', '')
        .limit(10);
      
      if (error) throw error;
      
      // Count query frequency and get top searches
      const queryCount: { [key: string]: number } = {};
      data?.forEach(row => {
        const query = row.search_query.toLowerCase();
        queryCount[query] = (queryCount[query] || 0) + 1;
      });
      
      const trending = Object.entries(queryCount)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([query]) => query);
      
      setTrendingSearches(trending);
    } catch (error) {
      console.error('Failed to load trending searches:', error);
    }
  };

  const loadSearchHistory = () => {
    const history = localStorage.getItem('searchHistory');
    if (history) {
      setSearchHistory(JSON.parse(history).slice(0, 5));
    }
  };

  const saveSearchToHistory = (query: string) => {
    if (!query.trim()) return;
    
    const history = JSON.parse(localStorage.getItem('searchHistory') || '[]');
    const newHistory = [query, ...history.filter((h: string) => h !== query)].slice(0, 10);
    localStorage.setItem('searchHistory', JSON.stringify(newHistory));
    setSearchHistory(newHistory.slice(0, 5));
  };

  const getSuggestions = async (query: string) => {
    if (query.length < 2) {
      setSuggestions([]);
      return;
    }

    try {
      const { data, error } = await supabase
        .rpc('get_search_suggestions', {
          partial_query: query,
          limit_count: 8
        });
      
      if (error) throw error;
      setSuggestions(data || []);
    } catch (error) {
      console.error('Failed to get suggestions:', error);
    }
  };

  const handleInputChange = (field: keyof SearchFilters, value: string | boolean | null) => {
    setFilters(prev => ({ ...prev, [field]: value }));
    
    if (field === 'query') {
      getSuggestions(value as string);
      setShowSuggestions(true);
    }
  };

  const handleSearch = () => {
    if (filters.query) {
      saveSearchToHistory(filters.query);
      trackSearch();
    }
    onSearch(filters);
    setShowSuggestions(false);
  };

  const trackSearch = async () => {
    if (!filters.query) return;
    
    try {
      await supabase
        .from('search_analytics')
        .insert([{
          search_query: filters.query,
          search_filters: {
            category: filters.category,
            priceMin: filters.priceMin,
            priceMax: filters.priceMax,
            rating: filters.rating,
            hasCommission: filters.hasCommission,
            isSubscription: filters.isSubscription,
            location: filters.location,
            sortBy: filters.sortBy
          },
          session_id: sessionStorage.getItem('sessionId') || undefined
        }]);
    } catch (error) {
      console.error('Failed to track search:', error);
    }
  };

  const clearFilters = () => {
    setFilters({
      query: '',
      category: '',
      priceMin: '',
      priceMax: '',
      rating: '',
      hasCommission: null,
      isSubscription: null,
      location: '',
      sortBy: 'relevance'
    });
  };

  const handleSuggestionClick = (suggestion: SearchSuggestion) => {
    if (suggestion.type === 'category') {
      const category = categories.find(c => c.name === suggestion.suggestion);
      setFilters(prev => ({ ...prev, category: category?.id || '', query: '' }));
    } else {
      setFilters(prev => ({ ...prev, query: suggestion.suggestion }));
    }
    setShowSuggestions(false);
    handleSearch();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  const getActiveFilterCount = () => {
    let count = 0;
    if (filters.category) count++;
    if (filters.priceMin || filters.priceMax) count++;
    if (filters.rating) count++;
    if (filters.hasCommission !== null) count++;
    if (filters.isSubscription !== null) count++;
    if (filters.location) count++;
    return count;
  };

  return (
    <div className="relative">
      {/* Main Search Bar */}
      <div className="relative">
        <div className="flex items-center bg-white rounded-lg border-2 border-gray-200 focus-within:border-primary-500 shadow-sm">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              ref={searchInputRef}
              type="text"
              value={filters.query}
              onChange={(e) => handleInputChange('query', e.target.value)}
              onKeyPress={handleKeyPress}
              onFocus={() => filters.query.length >= 2 && setShowSuggestions(true)}
              placeholder="Search products, categories, or brands..."
              className="w-full pl-12 pr-4 py-4 text-lg rounded-l-lg focus:outline-none"
            />
          </div>
          
          {/* Filter Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`
              flex items-center space-x-2 px-4 py-4 border-l border-gray-200 
              hover:bg-gray-50 transition-colors relative
              ${showFilters ? 'bg-primary-50 text-primary-600' : 'text-gray-600'}
            `}
          >
            <Filter className="h-5 w-5" />
            <span className="hidden md:inline">Filters</span>
            {getActiveFilterCount() > 0 && (
              <span className="absolute -top-1 -right-1 bg-primary-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                {getActiveFilterCount()}
              </span>
            )}
          </button>
          
          {/* Search Button */}
          <button
            onClick={handleSearch}
            className="px-6 py-4 bg-primary-500 text-white rounded-r-lg hover:bg-primary-600 transition-colors font-semibold"
          >
            Search
          </button>
        </div>

        {/* Search Suggestions */}
        {showSuggestions && (suggestions.length > 0 || trendingSearches.length > 0 || searchHistory.length > 0) && (
          <div 
            ref={suggestionsRef}
            className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto"
          >
            {/* Query Suggestions */}
            {suggestions.length > 0 && (
              <div className="p-2">
                <h4 className="text-sm font-semibold text-gray-600 px-3 py-2">Suggestions</h4>
                {suggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    onClick={() => handleSuggestionClick(suggestion)}
                    className="w-full text-left px-3 py-2 hover:bg-gray-100 rounded flex items-center justify-between group"
                  >
                    <div className="flex items-center space-x-3">
                      {suggestion.type === 'product' && <Search className="h-4 w-4 text-gray-400" />}
                      {suggestion.type === 'category' && <Tag className="h-4 w-4 text-primary-500" />}
                      {suggestion.type === 'tag' && <Tag className="h-4 w-4 text-secondary-500" />}
                      <span className="text-gray-800">{suggestion.suggestion}</span>
                    </div>
                    {suggestion.count > 0 && (
                      <span className="text-xs text-gray-500">{suggestion.count} items</span>
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Trending Searches */}
            {showTrending && trendingSearches.length > 0 && (
              <div className="border-t border-gray-100 p-2">
                <h4 className="text-sm font-semibold text-gray-600 px-3 py-2 flex items-center">
                  <TrendingUp className="h-4 w-4 mr-1" />
                  Trending
                </h4>
                {trendingSearches.map((query, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      setFilters(prev => ({ ...prev, query }));
                      setShowSuggestions(false);
                      handleSearch();
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-gray-100 rounded flex items-center space-x-3"
                  >
                    <Zap className="h-4 w-4 text-yellow-500" />
                    <span className="text-gray-800">{query}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Search History */}
            {searchHistory.length > 0 && (
              <div className="border-t border-gray-100 p-2">
                <h4 className="text-sm font-semibold text-gray-600 px-3 py-2 flex items-center">
                  <Clock className="h-4 w-4 mr-1" />
                  Recent
                </h4>
                {searchHistory.map((query, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      setFilters(prev => ({ ...prev, query }));
                      setShowSuggestions(false);
                      handleSearch();
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-gray-100 rounded flex items-center space-x-3"
                  >
                    <Clock className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-800">{query}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Advanced Filters Panel */}
      {showFilters && (
        <div className="mt-4 bg-white border border-gray-200 rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Advanced Filters</h3>
            <div className="flex items-center space-x-2">
              <button
                onClick={clearFilters}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Clear All
              </button>
              <button
                onClick={() => setShowFilters(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Category Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Category
              </label>
              <select
                value={filters.category}
                onChange={(e) => handleInputChange('category', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">All Categories</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Price Range */}
            <div className="md:col-span-2 lg:col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Price Range
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="number"
                  value={filters.priceMin}
                  onChange={(e) => handleInputChange('priceMin', e.target.value)}
                  placeholder="Min"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                />
                <span className="text-gray-500">to</span>
                <input
                  type="number"
                  value={filters.priceMax}
                  onChange={(e) => handleInputChange('priceMax', e.target.value)}
                  placeholder="Max"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            </div>

            {/* Minimum Rating */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Minimum Rating
              </label>
              <select
                value={filters.rating}
                onChange={(e) => handleInputChange('rating', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">Any Rating</option>
                <option value="4">4+ Stars</option>
                <option value="3">3+ Stars</option>
                <option value="2">2+ Stars</option>
                <option value="1">1+ Stars</option>
              </select>
            </div>

            {/* Location */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Seller Location
              </label>
              <input
                type="text"
                value={filters.location}
                onChange={(e) => handleInputChange('location', e.target.value)}
                placeholder="City, State, or Country"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            {/* Sort By */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Sort By
              </label>
              <select
                value={filters.sortBy}
                onChange={(e) => handleInputChange('sortBy', e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="relevance">Relevance</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
                <option value="rating">Highest Rated</option>
                <option value="newest">Newest First</option>
              </select>
            </div>
          </div>

          {/* Toggle Filters */}
          <div className="mt-4 flex flex-wrap gap-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={filters.hasCommission === true}
                onChange={(e) => handleInputChange('hasCommission', e.target.checked ? true : null)}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="ml-2 text-sm text-gray-700">Has Affiliate Commission</span>
            </label>

            <label className="flex items-center">
              <input
                type="checkbox"
                checked={filters.isSubscription === true}
                onChange={(e) => handleInputChange('isSubscription', e.target.checked ? true : null)}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="ml-2 text-sm text-gray-700">Subscription Products</span>
            </label>
          </div>

          {/* Apply Filters Button */}
          <div className="mt-6 flex justify-end">
            <button
              onClick={handleSearch}
              className="px-6 py-2 bg-primary-500 text-white rounded-md hover:bg-primary-600 transition-colors font-semibold"
            >
              Apply Filters
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdvancedSearch;
