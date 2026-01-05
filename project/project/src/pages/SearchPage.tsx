import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import AdvancedSearch from '../components/AdvancedSearch';
import SearchResults from '../components/SearchResults';
import VisualSearch from '../components/VisualSearch';

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

const SearchPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const [results, setResults] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Initialize filters from URL params
  const [filters, setFilters] = useState<SearchFilters>({
    query: searchParams.get('q') || '',
    category: searchParams.get('category') || '',
    priceMin: searchParams.get('priceMin') || '',
    priceMax: searchParams.get('priceMax') || '',
    rating: searchParams.get('rating') || '',
    hasCommission: searchParams.get('hasCommission') === 'true' ? true : null,
    isSubscription: searchParams.get('isSubscription') === 'true' ? true : null,
    location: searchParams.get('location') || '',
    sortBy: (searchParams.get('sortBy') as any) || 'relevance'
  });

  useEffect(() => {
    performSearch(filters, currentPage);
  }, []);

  const updateUrlParams = (newFilters: SearchFilters, page: number = 1) => {
    const params = new URLSearchParams();
    
    if (newFilters.query) params.set('q', newFilters.query);
    if (newFilters.category) params.set('category', newFilters.category);
    if (newFilters.priceMin) params.set('priceMin', newFilters.priceMin);
    if (newFilters.priceMax) params.set('priceMax', newFilters.priceMax);
    if (newFilters.rating) params.set('rating', newFilters.rating);
    if (newFilters.hasCommission !== null) params.set('hasCommission', 'true');
    if (newFilters.isSubscription !== null) params.set('isSubscription', 'true');
    if (newFilters.location) params.set('location', newFilters.location);
    if (newFilters.sortBy !== 'relevance') params.set('sortBy', newFilters.sortBy);
    if (page > 1) params.set('page', page.toString());

    setSearchParams(params);
  };

  const performSearch = async (searchFilters: SearchFilters, page: number = 1) => {
    setLoading(true);
    
    try {
      // First, get the total count
      let countQuery = supabase
        .from('products')
        .select('id', { count: 'exact', head: true })
        .eq('is_active', true);

      // Apply filters for count
      if (searchFilters.query) {
        countQuery = countQuery.textSearch('title,description,tags', searchFilters.query);
      }
      if (searchFilters.category) {
        countQuery = countQuery.eq('category_id', searchFilters.category);
      }
      if (searchFilters.priceMin) {
        countQuery = countQuery.gte('price', parseFloat(searchFilters.priceMin));
      }
      if (searchFilters.priceMax) {
        countQuery = countQuery.lte('price', parseFloat(searchFilters.priceMax));
      }
      if (searchFilters.rating) {
        countQuery = countQuery.gte('average_rating', parseFloat(searchFilters.rating));
      }
      if (searchFilters.hasCommission) {
        countQuery = countQuery.gt('commission_rate', 0);
      }
      if (searchFilters.isSubscription !== null) {
        countQuery = countQuery.eq('is_subscription', searchFilters.isSubscription);
      }

      const { count } = await countQuery;
      setTotalCount(count || 0);

      // Use the advanced search function if available, otherwise fallback to basic query
      try {
        const { data: searchData, error: searchError } = await supabase
          .rpc('search_products', {
            search_query: searchFilters.query || '',
            category_filter: searchFilters.category || null,
            price_min: searchFilters.priceMin ? parseFloat(searchFilters.priceMin) : null,
            price_max: searchFilters.priceMax ? parseFloat(searchFilters.priceMax) : null,
            rating_min: searchFilters.rating ? parseFloat(searchFilters.rating) : null,
            has_commission: searchFilters.hasCommission,
            is_subscription: searchFilters.isSubscription,
            seller_location: searchFilters.location || null,
            sort_by: searchFilters.sortBy,
            limit_count: itemsPerPage,
            offset_count: (page - 1) * itemsPerPage
          });

        if (searchError) throw searchError;
        // Best-effort: if the RPC returns is_active, filter out unlisted items.
        // (If is_active isn't returned, we can't filter reliably here.)
        const filtered = (searchData || []).filter((row: any) => row?.is_active !== false);
        setResults(filtered);
      } catch (rpcError) {
        console.warn('Advanced search function not available, using basic search:', rpcError);
        
        // Fallback to basic query
        let query = supabase
          .from('products')
          .select(`
            id,
            title,
            description,
            price,
            images,
            commission_rate,
            commission_type,
            flat_commission_amount,
            average_rating,
            review_count,
            profiles!products_seller_id_fkey(full_name, location),
            categories(name)
          `)
          .eq('is_active', true);

        // Apply filters
        if (searchFilters.query) {
          query = query.textSearch('title,description,tags', searchFilters.query);
        }
        if (searchFilters.category) {
          query = query.eq('category_id', searchFilters.category);
        }
        if (searchFilters.priceMin) {
          query = query.gte('price', parseFloat(searchFilters.priceMin));
        }
        if (searchFilters.priceMax) {
          query = query.lte('price', parseFloat(searchFilters.priceMax));
        }
        if (searchFilters.rating) {
          query = query.gte('average_rating', parseFloat(searchFilters.rating));
        }
        if (searchFilters.hasCommission) {
          query = query.gt('commission_rate', 0);
        }
        if (searchFilters.isSubscription !== null) {
          query = query.eq('is_subscription', searchFilters.isSubscription);
        }

        // Apply sorting
        switch (searchFilters.sortBy) {
          case 'price_asc':
            query = query.order('price', { ascending: true });
            break;
          case 'price_desc':
            query = query.order('price', { ascending: false });
            break;
          case 'rating':
            query = query.order('average_rating', { ascending: false });
            break;
          case 'newest':
            query = query.order('created_at', { ascending: false });
            break;
          default:
            query = query.order('created_at', { ascending: false });
        }

        // Apply pagination
        query = query.range((page - 1) * itemsPerPage, page * itemsPerPage - 1);

        const { data, error } = await query;
        if (error) throw error;

        // Transform data to match expected format
        const transformedData = data?.map(product => ({
          ...product,
          seller_name: product.profiles?.full_name || 'Unknown Seller',
          seller_location: product.profiles?.location || '',
          category_name: product.categories?.name || '',
          tag_names: [],
          relevance_score: 1.0
        })) || [];

        setResults(transformedData);
      }

    } catch (error) {
      console.error('Search failed:', error);
      setResults([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (newFilters: SearchFilters) => {
    setFilters(newFilters);
    setCurrentPage(1);
    updateUrlParams(newFilters, 1);
    performSearch(newFilters, 1);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    updateUrlParams(filters, page);
    performSearch(filters, page);
    
    // Scroll to top of results
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        {/* Search Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Discover Amazing Products
          </h1>
          <p className="text-gray-600 mb-6">
            Search through thousands of products and find exactly what you're looking for
          </p>
          
          {/* Advanced Search Component */}
          <div className="space-y-4">
            <AdvancedSearch
              onSearch={handleSearch}
              initialFilters={filters}
              showTrending={true}
            />
            
            {/* Visual Search */}
            <div className="flex justify-center">
              <VisualSearch
                onResultsFound={(products) => {
                  setResults(products);
                  setTotalCount(products.length);
                  setCurrentPage(1);
                }}
                className="w-full max-w-xs"
              />
            </div>
          </div>
        </div>

        {/* Search Results */}
        <SearchResults
          results={results}
          totalCount={totalCount}
          loading={loading}
          query={filters.query}
          onPageChange={handlePageChange}
          currentPage={currentPage}
          itemsPerPage={itemsPerPage}
        />
      </div>
    </div>
  );
};

export default SearchPage;
