import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Grid, 
  List, 
  Star, 
  TrendingUp, 
  MapPin, 
  Clock, 
  Eye,
  Heart,
  Share2,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import ProductGallery from './ProductGallery';
import StarRating from './StarRating';
import SocialShareButton from './SocialShareButton';
import AffiliateLink from './AffiliateLink';

interface SearchResult {
  id: string;
  title: string;
  description: string;
  price: number;
  images: string[];
  commission_rate: number;
  commission_type: 'percentage' | 'flat_rate';
  flat_commission_amount: number;
  average_rating: number;
  review_count: number;
  seller_name: string;
  seller_location: string;
  category_name: string;
  tag_names: string[];
  relevance_score: number;
}

interface SearchResultsProps {
  results: SearchResult[];
  totalCount: number;
  loading: boolean;
  query: string;
  onPageChange: (page: number) => void;
  currentPage: number;
  itemsPerPage: number;
}

const SearchResults: React.FC<SearchResultsProps> = ({
  results,
  totalCount,
  loading,
  query,
  onPageChange,
  currentPage,
  itemsPerPage
}) => {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [productImages, setProductImages] = useState<{ [key: string]: any[] }>({});

  useEffect(() => {
    // Load product images for each result
    loadProductImages();
  }, [results]);

  const loadProductImages = async () => {
    const imagePromises = results.map(async (product) => {
      try {
        const { data, error } = await supabase
          .from('product_images')
          .select('*')
          .eq('product_id', product.id)
          .order('display_order', { ascending: true });
        
        if (error) throw error;
        return { productId: product.id, images: data || [] };
      } catch (error) {
        console.error(`Failed to load images for product ${product.id}:`, error);
        return { productId: product.id, images: [] };
      }
    });

    const imageResults = await Promise.all(imagePromises);
    const imageMap: { [key: string]: any[] } = {};
    imageResults.forEach(({ productId, images }) => {
      imageMap[productId] = images;
    });
    setProductImages(imageMap);
  };

  const trackProductView = async (productId: string) => {
    try {
      await supabase
        .from('search_analytics')
        .insert([{
          search_query: query,
          clicked_product_id: productId,
          session_id: sessionStorage.getItem('sessionId') || undefined
        }]);
    } catch (error) {
      console.error('Failed to track product view:', error);
    }
  };

  const toggleFavorite = (productId: string) => {
    setFavorites(prev => {
      const newFavorites = new Set(prev);
      if (newFavorites.has(productId)) {
        newFavorites.delete(productId);
      } else {
        newFavorites.add(productId);
      }
      return newFavorites;
    });
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(price);
  };

  const calculateCommission = (product: SearchResult) => {
    if (product.commission_type === 'percentage') {
      return (product.price * product.commission_rate) / 100;
    }
    return product.flat_commission_amount;
  };

  const totalPages = Math.ceil(totalCount / itemsPerPage);

  const renderPagination = () => {
    if (totalPages <= 1) return null;

    const startItem = (currentPage - 1) * itemsPerPage + 1;
    const endItem = Math.min(currentPage * itemsPerPage, totalCount);

    return (
      <div className="flex items-center justify-between mt-8 px-4 py-3 bg-white border border-gray-200 rounded-lg">
        <div className="flex items-center text-sm text-gray-700">
          <span>
            Showing {startItem} to {endItem} of {totalCount} results
          </span>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous
          </button>

          {/* Page numbers */}
          <div className="flex space-x-1">
            {[...Array(Math.min(5, totalPages))].map((_, i) => {
              const pageNum = Math.max(1, currentPage - 2) + i;
              if (pageNum > totalPages) return null;
              
              return (
                <button
                  key={pageNum}
                  onClick={() => onPageChange(pageNum)}
                  className={`px-3 py-2 text-sm font-medium rounded-md ${
                    pageNum === currentPage
                      ? 'bg-primary-500 text-white'
                      : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </button>
        </div>
      </div>
    );
  };

  const renderGridView = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {results.map((product) => {
        const images = productImages[product.id] || [];
        const commission = calculateCommission(product);
        
        return (
          <div key={product.id} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition-all duration-300 group border border-gray-200">
            <Link
              to={`/product/${product.id}`}
              onClick={() => trackProductView(product.id)}
              className="block"
            >
              <div className="aspect-square relative overflow-hidden">
                {images.length > 0 ? (
                  <ProductGallery
                    images={images}
                    productTitle={product.title}
                    className="w-full h-full"
                  />
                ) : (
                  <img
                    src={product.images[0] || 'https://images.pexels.com/photos/607812/pexels-photo-607812.jpeg?auto=compress&cs=tinysrgb&w=500'}
                    alt={product.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                )}

                {/* Action Buttons */}
                <div className="absolute top-2 right-2 flex flex-col space-y-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      toggleFavorite(product.id);
                    }}
                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                      favorites.has(product.id)
                        ? 'bg-red-500 text-white'
                        : 'bg-white text-gray-600 hover:text-red-500'
                    }`}
                  >
                    <Heart className="w-4 h-4" />
                  </button>
                  
                  <SocialShareButton
                    product={product}
                    variant="icon"
                    size="sm"
                    className="bg-white bg-opacity-90"
                  />
                </div>

                {/* Commission Badge */}
                {commission > 0 && (
                  <div className="absolute bottom-2 left-2 bg-primary-500 text-white px-2 py-1 rounded-full text-xs font-bold flex items-center space-x-1">
                    <TrendingUp className="h-3 w-3" />
                    <span>${commission.toFixed(2)} 💰</span>
                  </div>
                )}
              </div>
            </Link>

            <div className="p-4">
              <Link
                to={`/product/${product.id}`}
                onClick={() => trackProductView(product.id)}
                className="block hover:text-primary-600 transition-colors"
              >
                <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2">
                  {product.title}
                </h3>
              </Link>

              <div className="flex items-center justify-between mb-2">
                <span className="text-2xl font-bold text-primary-600">
                  {formatPrice(product.price)}
                </span>
                {product.average_rating > 0 && (
                  <div className="flex items-center space-x-1">
                    <StarRating rating={product.average_rating} size="sm" readonly />
                    <span className="text-sm text-gray-600">
                      ({product.review_count})
                    </span>
                  </div>
                )}
              </div>

              <div className="flex items-center text-sm text-gray-600 mb-2">
                <MapPin className="h-4 w-4 mr-1" />
                <span>{product.seller_name}</span>
                {product.seller_location && (
                  <>
                    <span className="mx-1">•</span>
                    <span>{product.seller_location}</span>
                  </>
                )}
              </div>

              {product.category_name && (
                <div className="text-xs text-primary-600 mb-2">
                  {product.category_name}
                </div>
              )}

              {product.tag_names && product.tag_names.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {product.tag_names.slice(0, 3).map((tag, index) => (
                    <span
                      key={index}
                      className="inline-block bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded"
                    >
                      {tag}
                    </span>
                  ))}
                  {product.tag_names.length > 3 && (
                    <span className="text-xs text-gray-500">
                      +{product.tag_names.length - 3} more
                    </span>
                  )}
                </div>
              )}

              <AffiliateLink productId={product.id} compact />
            </div>
          </div>
        );
      })}
    </div>
  );

  const renderListView = () => (
    <div className="space-y-4">
      {results.map((product) => {
        const images = productImages[product.id] || [];
        const commission = calculateCommission(product);
        
        return (
          <div key={product.id} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow border border-gray-200">
            <div className="flex">
              <Link
                to={`/product/${product.id}`}
                onClick={() => trackProductView(product.id)}
                className="block w-48 h-48 flex-shrink-0"
              >
                {images.length > 0 ? (
                  <ProductGallery
                    images={images}
                    productTitle={product.title}
                    className="w-full h-full"
                  />
                ) : (
                  <img
                    src={product.images[0] || 'https://images.pexels.com/photos/607812/pexels-photo-607812.jpeg?auto=compress&cs=tinysrgb&w=500'}
                    alt={product.title}
                    className="w-full h-full object-cover"
                  />
                )}
              </Link>

              <div className="flex-1 p-6">
                <div className="flex justify-between items-start mb-2">
                  <Link
                    to={`/product/${product.id}`}
                    onClick={() => trackProductView(product.id)}
                    className="hover:text-primary-600 transition-colors"
                  >
                    <h3 className="text-xl font-semibold text-gray-900">
                      {product.title}
                    </h3>
                  </Link>
                  
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => toggleFavorite(product.id)}
                      className={`p-2 rounded-full transition-colors ${
                        favorites.has(product.id)
                          ? 'bg-red-100 text-red-500'
                          : 'bg-gray-100 text-gray-600 hover:text-red-500'
                      }`}
                    >
                      <Heart className="w-5 h-5" />
                    </button>
                    
                    <SocialShareButton
                      product={product}
                      variant="icon"
                      className="bg-gray-100"
                    />
                  </div>
                </div>

                <p className="text-gray-600 mb-3 line-clamp-2">
                  {product.description}
                </p>

                <div className="flex items-center justify-between mb-3">
                  <span className="text-3xl font-bold text-primary-600">
                    {formatPrice(product.price)}
                  </span>
                  
                  {commission > 0 && (
                    <div className="bg-primary-100 text-primary-800 px-3 py-1 rounded-full text-sm font-semibold flex items-center space-x-1">
                      <TrendingUp className="h-4 w-4" />
                      <span>Earn ${commission.toFixed(2)}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4 text-sm text-gray-600">
                    <div className="flex items-center">
                      <MapPin className="h-4 w-4 mr-1" />
                      <span>{product.seller_name}</span>
                    </div>
                    
                    {product.average_rating > 0 && (
                      <div className="flex items-center space-x-1">
                        <StarRating rating={product.average_rating} size="sm" readonly />
                        <span>({product.review_count})</span>
                      </div>
                    )}
                  </div>
                  
                  <AffiliateLink productId={product.id} compact />
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="bg-white rounded-lg shadow-md overflow-hidden animate-pulse">
            <div className="aspect-square bg-gray-200"></div>
            <div className="p-4 space-y-2">
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 bg-gray-200 rounded-full mx-auto mb-4 flex items-center justify-center">
          <Eye className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No results found</h3>
        <p className="text-gray-600">
          {query 
            ? `No products match your search for "${query}"`
            : "Try adjusting your filters or search terms"
          }
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Results Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">
            {query ? `Search Results for "${query}"` : 'All Products'}
          </h2>
          <p className="text-gray-600">
            {totalCount} product{totalCount !== 1 ? 's' : ''} found
          </p>
        </div>

        {/* View Toggle */}
        <div className="flex items-center space-x-2 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded-md transition-colors ${
              viewMode === 'grid'
                ? 'bg-white text-primary-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Grid className="w-5 h-5" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded-md transition-colors ${
              viewMode === 'list'
                ? 'bg-white text-primary-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <List className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Results */}
      {viewMode === 'grid' ? renderGridView() : renderListView()}

      {/* Pagination */}
      {renderPagination()}
    </div>
  );
};

export default SearchResults;
