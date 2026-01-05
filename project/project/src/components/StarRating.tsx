import React, { useState } from 'react';
import { Star } from 'lucide-react';

interface StarRatingProps {
  rating: number;
  maxRating?: number;
  size?: 'sm' | 'md' | 'lg';
  interactive?: boolean;
  onRatingChange?: (rating: number) => void;
  showCount?: boolean;
  reviewCount?: number;
  className?: string;
}

const StarRating: React.FC<StarRatingProps> = ({
  rating,
  maxRating = 5,
  size = 'md',
  interactive = false,
  onRatingChange,
  showCount = false,
  reviewCount,
  className = ''
}) => {
  const [hoverRating, setHoverRating] = useState(0);

  const sizeClasses = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5'
  };

  const textSizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base'
  };

  const handleStarClick = (starRating: number) => {
    if (interactive && onRatingChange) {
      onRatingChange(starRating);
    }
  };

  const handleStarHover = (starRating: number) => {
    if (interactive) {
      setHoverRating(starRating);
    }
  };

  const handleMouseLeave = () => {
    if (interactive) {
      setHoverRating(0);
    }
  };

  const displayRating = hoverRating || rating;

  return (
    <div className={`flex items-center space-x-1 ${className}`}>
      <div 
        className="flex items-center space-x-0.5"
        onMouseLeave={handleMouseLeave}
      >
        {Array.from({ length: maxRating }, (_, index) => {
          const starRating = index + 1;
          const isFilled = starRating <= displayRating;
          const isPartiallyFilled = starRating - 0.5 <= displayRating && displayRating < starRating;

          return (
            <button
              key={index}
              type="button"
              disabled={!interactive}
              onClick={() => handleStarClick(starRating)}
              onMouseEnter={() => handleStarHover(starRating)}
              className={`
                ${sizeClasses[size]} 
                ${interactive ? 'cursor-pointer hover:scale-110 transition-transform' : 'cursor-default'}
                ${interactive ? 'focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-opacity-50 rounded' : ''}
              `}
            >
              <Star
                className={`
                  ${sizeClasses[size]}
                  ${isFilled || isPartiallyFilled 
                    ? 'text-amber-400 fill-amber-400' 
                    : 'text-gray-300'
                  }
                  ${interactive && hoverRating >= starRating ? 'text-amber-500 fill-amber-500' : ''}
                `}
              />
            </button>
          );
        })}
      </div>
      
      {showCount && (
        <span className={`text-gray-600 ${textSizeClasses[size]}`}>
          {rating > 0 ? (
            <>
              {rating.toFixed(1)} 
              {reviewCount !== undefined && (
                <span className="text-gray-500">
                  ({reviewCount} {reviewCount === 1 ? 'review' : 'reviews'})
                </span>
              )}
            </>
          ) : (
            <span className="text-gray-500">No reviews yet</span>
          )}
        </span>
      )}
    </div>
  );
};

export default StarRating;
