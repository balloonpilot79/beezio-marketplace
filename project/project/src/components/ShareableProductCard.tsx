import React from 'react';
import { Link } from 'react-router-dom';
import { Heart, Eye, TrendingUp } from 'lucide-react';
import SocialShareButton from './SocialShareButton';
import StarRating from './StarRating';
import { useAuth } from '../contexts/AuthContextMultiRole';
import { sanitizeDescriptionForDisplay } from '../utils/sanitizeDescription';

interface Product {
  id: string;
  title: string;
  description?: string;
  price: number;
  images: string[];
  videos: string[];
  commission_rate: number;
  commission_type: 'percentage' | 'flat_rate';
  flat_commission_amount: number;
  seller_id: string;
  profiles?: {
    full_name: string;
    location?: string;
  };
  shipping_cost?: number;
  is_subscription?: boolean;
  subscription_interval?: 'weekly' | 'monthly';
  average_rating?: number;
  review_count?: number;
}

interface ShareableProductCardProps {
  product: Product;
  affiliateCode?: string;
  showCommissionInfo?: boolean;
  showShareButton?: boolean;
  variant?: 'grid' | 'list' | 'featured';
}

export const ShareableProductCard: React.FC<ShareableProductCardProps> = ({
  product,
  affiliateCode,
  showCommissionInfo = false,
  showShareButton = true,
  variant = 'grid'
}) => {
  const { profile } = useAuth();
  const userRole = profile?.role;

  const cardClasses = {
    grid: 'bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow group',
    list: 'bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow flex',
    featured: 'bg-white rounded-xl shadow-xl overflow-hidden hover:shadow-2xl transition-all group border-2 border-amber-200'
  };

  const imageClasses = {
    grid: 'aspect-square relative overflow-hidden',
    list: 'w-48 h-48 relative overflow-hidden flex-shrink-0',
    featured: 'aspect-[4/3] relative overflow-hidden'
  };

  const contentClasses = {
    grid: 'p-4',
    list: 'p-4 flex-1 flex flex-col justify-between',
    featured: 'p-6'
  };

  if (variant === 'list') {
    return (
      <div className={cardClasses[variant]}>
        {/* Image Section */}
        <div className={imageClasses[variant]}>
          <Link to={`/product/${product.id}${affiliateCode ? `?ref=${affiliateCode}` : ''}`}>
            <img
              src={product.images[0] || 'https://images.pexels.com/photos/607812/pexels-photo-607812.jpeg?auto=compress&cs=tinysrgb&w=500'}
              alt={product.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          </Link>
          
          {/* Share Button Overlay */}
          {showShareButton && (
            <div className="absolute top-2 right-2">
              <SocialShareButton 
                product={product} 
                affiliateCode={affiliateCode}
                variant="icon"
                size="sm"
              />
            </div>
          )}
        </div>

        {/* Content Section */}
        <div className={contentClasses[variant]}>
          <div>
            <Link to={`/product/${product.id}${affiliateCode ? `?ref=${affiliateCode}` : ''}`}>
              <h3 className="font-semibold text-lg text-gray-900 mb-2 hover:text-amber-600 transition-colors line-clamp-2">
                {product.title}
              </h3>
            </Link>
            
            {/* Rating */}
            {product.average_rating && (
              <div className="flex items-center space-x-2 mb-2">
                <StarRating rating={product.average_rating} size="sm" />
                <span className="text-gray-500 text-sm">
                  {product.average_rating.toFixed(1)} ({product.review_count || 0} reviews)
                </span>
              </div>
            )}

            {/* Description */}
            {product.description && (
              <p className="text-gray-600 text-sm line-clamp-3 mb-3">
                {sanitizeDescriptionForDisplay(product.description, (product as any).lineage)}
              </p>
            )}
          </div>

          <div>
            {/* Price and Actions */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <span className="text-xl font-bold text-gray-900">${product.price.toFixed(2)}</span>
                {product.is_subscription && product.subscription_interval && (
                  <span className="text-amber-600 text-sm font-semibold">
                    /{product.subscription_interval}
                  </span>
                )}
              </div>
              
              {showShareButton && (
                <SocialShareButton 
                  product={product} 
                  affiliateCode={affiliateCode}
                  size="sm"
                />
              )}
            </div>

            {/* Commission Info */}
            {showCommissionInfo && userRole === 'affiliate' && product.commission_rate > 0 && (
              <div className="bg-amber-50 p-2 rounded-lg mb-3">
                <div className="flex items-center text-amber-700 text-sm">
                  <TrendingUp className="w-4 h-4 mr-1" />
                  <span className="font-medium">
                    {product.commission_rate}% Commission
                    {product.is_subscription && product.subscription_interval && (
                      <span className="ml-1">(recurring)</span>
                    )}
                  </span>
                </div>
              </div>
            )}

            {/* Seller Info */}
            {product.profiles && (
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Link to={`/profile/${product.seller_id}`}>
                    <img
                      src={`https://ui-avatars.com/api/?name=${encodeURIComponent(product.profiles.full_name)}&size=32&background=random`}
                      alt={product.profiles.full_name}
                      className="w-8 h-8 rounded-full object-cover"
                    />
                  </Link>
                  <div>
                    <Link to={`/profile/${product.seller_id}`}>
                      <p className="text-gray-900 font-medium text-sm hover:text-amber-600 transition-colors">
                        {product.profiles.full_name}
                      </p>
                    </Link>
                    {product.profiles.location && (
                      <p className="text-gray-600 text-xs">
                        {product.profiles.location}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Grid and Featured variants
  return (
    <div className={cardClasses[variant]}>
      {/* Image Section */}
      <div className={imageClasses[variant]}>
        <Link to={`/product/${product.id}${affiliateCode ? `?ref=${affiliateCode}` : ''}`}>
          <img
            src={product.images[0] || 'https://images.pexels.com/photos/607812/pexels-photo-607812.jpeg?auto=compress&cs=tinysrgb&w=500'}
            alt={product.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        </Link>
        
        {/* Action Buttons Overlay */}
        <div className="absolute top-2 right-2 flex flex-col space-y-2">
          {showShareButton && (
            <SocialShareButton 
              product={product} 
              affiliateCode={affiliateCode}
              variant="icon"
              size={variant === 'featured' ? 'md' : 'sm'}
            />
          )}
          
          {/* Wishlist Button */}
          <button className="bg-white bg-opacity-90 hover:bg-opacity-100 text-gray-600 hover:text-red-500 p-2 rounded-full transition-all shadow-md">
            <Heart className={variant === 'featured' ? 'w-5 h-5' : 'w-4 h-4'} />
          </button>
        </div>

        {/* Badges */}
        <div className="absolute top-2 left-2 flex flex-col space-y-1">
          {showCommissionInfo && userRole === 'affiliate' && product.commission_rate > 0 && (
            <div className="bg-amber-500 text-white px-2 py-1 rounded text-xs font-bold flex items-center space-x-1">
              <TrendingUp className="h-3 w-3" />
              <span>{product.commission_rate}%</span>
            </div>
          )}
        </div>
      </div>

      {/* Content Section */}
      <div className={contentClasses[variant]}>
        <Link to={`/product/${product.id}${affiliateCode ? `?ref=${affiliateCode}` : ''}`}>
          <h3 className={`font-semibold text-gray-900 mb-2 hover:text-amber-600 transition-colors line-clamp-2 ${
            variant === 'featured' ? 'text-xl' : 'text-base'
          }`}>
            {product.title}
          </h3>
        </Link>
        
        {/* Rating */}
        {product.average_rating && (
          <div className="flex items-center space-x-2 mb-2">
            <StarRating rating={product.average_rating} size={variant === 'featured' ? 'md' : 'sm'} />
            <span className="text-gray-500 text-sm">
              {product.average_rating.toFixed(1)} ({product.review_count || 0} reviews)
            </span>
          </div>
        )}
        
        {/* Price */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <span className={`font-bold text-gray-900 ${variant === 'featured' ? 'text-2xl' : 'text-lg'}`}>
              ${product.price.toFixed(2)}
            </span>
            {product.is_subscription && product.subscription_interval && (
              <span className="text-amber-600 text-sm font-semibold">
                /{product.subscription_interval}
              </span>
            )}
          </div>
        </div>

        {/* Description */}
        {product.description && variant === 'featured' && (
          <p className="text-gray-600 text-sm line-clamp-2 mb-4">
            {sanitizeDescriptionForDisplay(product.description, (product as any).lineage)}
          </p>
        )}

        {/* Seller Info */}
        {product.profiles && (
          <div className="flex items-center justify-between mt-auto">
            <div className="flex items-center space-x-2">
              <Link to={`/profile/${product.seller_id}`}>
                <img
                  src={`https://ui-avatars.com/api/?name=${encodeURIComponent(product.profiles.full_name)}&size=${variant === 'featured' ? '40' : '32'}&background=random`}
                  alt={product.profiles.full_name}
                  className={`rounded-full object-cover ${variant === 'featured' ? 'w-10 h-10' : 'w-8 h-8'}`}
                />
              </Link>
              <div>
                <Link to={`/profile/${product.seller_id}`}>
                  <p className={`text-gray-900 font-medium hover:text-amber-600 transition-colors ${
                    variant === 'featured' ? 'text-sm' : 'text-xs'
                  }`}>
                    {product.profiles.full_name}
                  </p>
                </Link>
                {product.profiles.location && (
                  <p className="text-gray-600 text-xs">
                    {product.profiles.location}
                  </p>
                )}
              </div>
            </div>
            
            {showShareButton && variant === 'featured' && (
              <SocialShareButton 
                product={product} 
                affiliateCode={affiliateCode}
                size="md"
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ShareableProductCard;
