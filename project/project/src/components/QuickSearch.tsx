import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, TrendingUp, Sparkles } from 'lucide-react';

const QuickSearch: React.FC = () => {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      navigate(`/search?q=${encodeURIComponent(query.trim())}`);
    } else {
      navigate('/search');
    }
  };

  const trendingSearches = [
    'Electronics',
    'Fashion',
    'Home Decor',
    'Beauty Products',
    'Sports Equipment'
  ];

  const handleTrendingClick = (term: string) => {
    navigate(`/search?q=${encodeURIComponent(term)}`);
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Main Search Bar */}
      <form onSubmit={handleSearch} className="relative mb-6">
        <div className="relative">
          <Search className="absolute left-6 top-1/2 transform -translate-y-1/2 h-6 w-6 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search for products, brands, or categories..."
            className="w-full pl-16 pr-32 py-6 text-lg border-2 border-gray-200 rounded-2xl focus:outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-100 transition-all duration-200 shadow-lg"
          />
          <button
            type="submit"
            className="absolute right-3 top-1/2 transform -translate-y-1/2 bg-primary-500 hover:bg-primary-600 text-white px-8 py-3 rounded-xl font-semibold transition-colors duration-200 shadow-md"
          >
            Search
          </button>
        </div>
      </form>

      {/* Trending Searches */}
      <div className="flex flex-wrap items-center justify-center gap-3">
        <div className="flex items-center text-gray-600 mb-2 sm:mb-0">
          <TrendingUp className="h-4 w-4 mr-2" />
          <span className="text-sm font-medium">Trending:</span>
        </div>
        
        {trendingSearches.map((term, index) => (
          <button
            key={index}
            onClick={() => handleTrendingClick(term)}
            className="group inline-flex items-center px-4 py-2 bg-white border border-gray-200 rounded-full text-sm font-medium text-gray-700 hover:border-primary-300 hover:text-primary-600 hover:bg-primary-50 transition-all duration-200 shadow-sm hover:shadow-md"
          >
            <Sparkles className="h-3 w-3 mr-1 opacity-0 group-hover:opacity-100 transition-opacity" />
            {term}
          </button>
        ))}
      </div>

      {/* Search Suggestions */}
      <div className="mt-4 text-center">
        <p className="text-sm text-gray-500">
          Discover thousands of products with{' '}
          <span className="text-primary-600 font-semibold">affiliate commissions</span>{' '}
          available
        </p>
      </div>
    </div>
  );
};

export default QuickSearch;
