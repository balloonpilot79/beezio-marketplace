import React from 'react';
import { Heart, ShoppingCart, Star, Award, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

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

interface ProductCardProps {
  product: Product;
  viewMode: 'grid' | 'list';
  affiliateRef?: string | null;
}

const ProductCard: React.FC<ProductCardProps> = ({ product, viewMode, affiliateRef }) => {
  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Add to cart logic here
    console.log('Adding to cart:', product.id);
  };

  const handleWishlist = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Wishlist logic here
    console.log('Adding to wishlist:', product.id);
  };

  const productUrl = affiliateRef 
    ? `/product/${product.id}?ref=${affiliateRef}`
    : `/product/${product.id}`;

  if (viewMode === 'list') {
    return (
      <Link to={productUrl} className="block">
        <div className="bg-white rounded-2xl shadow-sm hover:shadow-xl border border-gray-100 p-6 transition-all duration-300 hover:border-purple-200 group">
          <div className="flex items-center space-x-6">
            <div className="relative">
              <img
                src={product.images[0] || '/api/placeholder/150/150'}
                alt={product.title}
                className="w-32 h-32 object-cover rounded-xl group-hover:scale-105 transition-transform duration-300"
              />
              {product.commission_rate > 15 && (
                <div className="absolute -top-2 -right-2 bg-gradient-to-r from-orange-400 to-red-400 text-white text-xs px-2 py-1 rounded-full font-bold shadow-lg">
                  {product.commission_rate}% off
                </div>
              )}
            </div>
            
            <div className="flex-1">
              <div className="flex items-start justify-between mb-2">
                <h3 className="text-lg font-semibold text-gray-900 group-hover:text-purple-600 transition-colors line-clamp-2">
                  {product.title}
                </h3>
                <button
                  onClick={handleWishlist}
                  className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                >
                  <Heart className="w-5 h-5" />
                </button>
              </div>
              
              <p className="text-gray-600 text-sm line-clamp-2 mb-3">
                {product.description}
              </p>
              
              <div className="flex items-center space-x-4 mb-3">
                <div className="flex items-center">
                  <div className="flex text-yellow-400">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className={`w-4 h-4 ${i < Math.floor(product.average_rating || 0) ? 'fill-current' : ''}`} />
                    ))}
                  </div>
                  <span className="text-sm text-gray-500 ml-2">
                    ({product.review_count || 0})
                  </span>
                </div>
                
                <div className="flex items-center bg-green-50 px-2 py-1 rounded-full">
                  <Award className="w-3 h-3 text-green-600 mr-1" />
                  <span className="text-xs text-green-700 font-medium">
                    {product.commission_rate}% commission
                  </span>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-gray-900">
                    ${product.price}
                  </div>
                  <div className="text-sm text-gray-500">
                    by {product.profiles?.full_name || 'Beezio Seller'}
                  </div>
                </div>
                
                <button
                  onClick={handleAddToCart}
                  className="bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white px-6 py-3 rounded-xl font-medium transition-all duration-200 flex items-center shadow-lg hover:shadow-purple-500/25 transform hover:scale-105"
                >
                  <ShoppingCart className="w-5 h-5 mr-2" />
                  Add to Cart
                </button>
              </div>
            </div>
          </div>
        </div>
      </Link>
    );
  }

  return (
    <Link to={productUrl} className="block group">
      <div className="bg-white rounded-2xl shadow-sm hover:shadow-2xl border border-gray-100 overflow-hidden transition-all duration-300 hover:border-purple-200 hover:-translate-y-1">
        <div className="relative">
          <img
            src={product.images[0] || '/api/placeholder/300/300'}
            alt={product.title}
            className="w-full h-56 object-cover group-hover:scale-105 transition-transform duration-500"
          />
          
          {/* Badges */}
          <div className="absolute top-3 left-3 flex flex-col space-y-2">
            {product.commission_rate > 15 && (
              <div className="bg-gradient-to-r from-orange-400 to-red-400 text-white text-xs px-3 py-1 rounded-full font-bold shadow-lg backdrop-blur-sm">
                Hot Deal
              </div>
            )}
            <div className="bg-green-500/90 backdrop-blur-sm text-white text-xs px-3 py-1 rounded-full font-medium">
              {product.commission_rate}% commission
            </div>
          </div>
          
          <button
            onClick={handleWishlist}
            className="absolute top-3 right-3 p-2 bg-white/80 backdrop-blur-sm rounded-full text-gray-600 hover:text-red-500 hover:bg-white transition-all duration-200 shadow-lg"
          >
            <Heart className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-5">
          <div className="mb-3">
            <h3 className="text-lg font-semibold text-gray-900 group-hover:text-purple-600 transition-colors line-clamp-2 mb-2">
              {product.title}
            </h3>
            
            <div className="text-sm text-gray-500 mb-2">
              by {product.profiles?.full_name || 'Beezio Seller'}
            </div>
            
            <div className="flex items-center space-x-2">
              <div className="flex text-yellow-400">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className={`w-4 h-4 ${i < Math.floor(product.average_rating || 0) ? 'fill-current' : ''}`} />
                ))}
              </div>
              <span className="text-sm text-gray-500">
                ({product.review_count || 0})
              </span>
            </div>
          </div>
          
          <div className="flex items-center justify-between mb-4">
            <div className="text-2xl font-bold text-gray-900">
              ${product.price}
            </div>
            <div className="text-sm text-green-600 font-medium">
              Free shipping
            </div>
          </div>
          
          <div className="space-y-2">
            <button
              onClick={handleAddToCart}
              className="w-full bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white py-3 rounded-xl font-medium transition-all duration-200 flex items-center justify-center shadow-lg hover:shadow-purple-500/25 transform hover:scale-105"
            >
              <ShoppingCart className="w-5 h-5 mr-2" />
              Add to Cart
            </button>
            
            <Link
              to={productUrl}
              className="w-full bg-gray-50 hover:bg-gray-100 text-gray-700 py-3 rounded-xl font-medium transition-all duration-200 flex items-center justify-center border border-gray-200 hover:border-gray-300"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              View Details
            </Link>
          </div>
        </div>
      </div>
    </Link>
  );
};

export default ProductCard;
