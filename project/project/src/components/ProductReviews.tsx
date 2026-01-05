import React, { useState, useEffect } from 'react';
import { ThumbsUp, ThumbsDown, Calendar, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContextMultiRole';
import StarRating from './StarRating';

interface Review {
  id: string;
  rating: number;
  title: string;
  content: string;
  verified_purchase: boolean;
  helpful_count: number;
  images: string[];
  created_at: string;
  reviewer_id: string;
  profiles: {
    full_name: string;
  };
  user_helpful_vote?: boolean | null;
}

interface ProductReviewsProps {
  productId: string;
  averageRating: number;
  reviewCount: number;
}

const ProductReviews: React.FC<ProductReviewsProps> = ({
  productId,
  averageRating,
  reviewCount
}) => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'highest' | 'lowest' | 'helpful'>('newest');
  const [filterRating, setFilterRating] = useState<number | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    fetchReviews();
  }, [productId, sortBy, filterRating]);

  const fetchReviews = async () => {
    try {
      setLoading(true);
      
      let query = supabase
        .from('product_reviews')
        .select(`
          *,
          profiles:reviewer_id (
            full_name
          )
        `)
        .eq('product_id', productId);

      // Apply rating filter
      if (filterRating) {
        query = query.eq('rating', filterRating);
      }

      // Apply sorting
      switch (sortBy) {
        case 'newest':
          query = query.order('created_at', { ascending: false });
          break;
        case 'oldest':
          query = query.order('created_at', { ascending: true });
          break;
        case 'highest':
          query = query.order('rating', { ascending: false });
          break;
        case 'lowest':
          query = query.order('rating', { ascending: true });
          break;
        case 'helpful':
          query = query.order('helpful_count', { ascending: false });
          break;
      }

      const { data: reviewsData, error } = await query;

      if (error) {
        console.error('Error fetching reviews:', error);
        return;
      }

      // If user is logged in, fetch their helpful votes
      if (user && reviewsData) {
        const reviewIds = reviewsData.map(review => review.id);
        const { data: helpfulVotes } = await supabase
          .from('review_helpful')
          .select('review_id, is_helpful')
          .eq('user_id', user.id)
          .in('review_id', reviewIds);

        const helpfulVoteMap = new Map(
          helpfulVotes?.map(vote => [vote.review_id, vote.is_helpful]) || []
        );

        const reviewsWithVotes = reviewsData.map(review => ({
          ...review,
          user_helpful_vote: helpfulVoteMap.get(review.id) || null
        }));

        setReviews(reviewsWithVotes);
      } else {
        setReviews(reviewsData || []);
      }
    } catch (error) {
      console.error('Error fetching reviews:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleHelpfulVote = async (reviewId: string, isHelpful: boolean) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('review_helpful')
        .upsert({
          review_id: reviewId,
          user_id: user.id,
          is_helpful: isHelpful
        }, {
          onConflict: 'review_id,user_id'
        });

      if (error) {
        console.error('Error voting on review:', error);
        return;
      }

      // Refresh reviews to update helpful counts
      fetchReviews();
    } catch (error) {
      console.error('Error voting on review:', error);
    }
  };

  const getRatingDistribution = () => {
    const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    reviews.forEach(review => {
      distribution[review.rating as keyof typeof distribution]++;
    });
    return distribution;
  };

  const distribution = getRatingDistribution();

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-300 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="border rounded-lg p-4">
                <div className="h-4 bg-gray-300 rounded w-1/4 mb-2"></div>
                <div className="h-4 bg-gray-300 rounded w-3/4 mb-2"></div>
                <div className="h-16 bg-gray-300 rounded"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Rating Summary */}
      <div className="bg-gray-50 rounded-lg p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="text-center">
            <div className="text-4xl font-bold text-gray-900 mb-2">
              {averageRating > 0 ? averageRating.toFixed(1) : '0.0'}
            </div>
            <StarRating rating={averageRating} size="lg" showCount reviewCount={reviewCount} />
          </div>
          
          <div className="space-y-2">
            {[5, 4, 3, 2, 1].map(rating => {
              const count = distribution[rating as keyof typeof distribution];
              const percentage = reviewCount > 0 ? (count / reviewCount) * 100 : 0;
              
              return (
                <div key={rating} className="flex items-center space-x-2">
                  <span className="text-sm font-medium w-8">{rating}</span>
                  <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
                  <div className="flex-1 bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-amber-400 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${percentage}%` }}
                    ></div>
                  </div>
                  <span className="text-sm text-gray-600 w-8">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Filters and Sorting */}
      <div className="flex flex-wrap gap-4 items-center justify-between border-b pb-4">
        <div className="flex flex-wrap gap-2">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="highest">Highest Rating</option>
            <option value="lowest">Lowest Rating</option>
            <option value="helpful">Most Helpful</option>
          </select>
          
          <select
            value={filterRating || ''}
            onChange={(e) => setFilterRating(e.target.value ? Number(e.target.value) : null)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm"
          >
            <option value="">All Ratings</option>
            <option value="5">5 Stars</option>
            <option value="4">4 Stars</option>
            <option value="3">3 Stars</option>
            <option value="2">2 Stars</option>
            <option value="1">1 Star</option>
          </select>
        </div>
        
        <div className="text-sm text-gray-600">
          {reviews.length} of {reviewCount} reviews
        </div>
      </div>

      {/* Reviews List */}
      <div className="space-y-6">
        {reviews.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            {filterRating ? `No ${filterRating}-star reviews found` : 'No reviews yet'}
          </div>
        ) : (
          reviews.map((review) => (
            <div key={review.id} className="border rounded-lg p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <img
                    src={`https://ui-avatars.com/api/?name=${encodeURIComponent(review.profiles.full_name)}&size=40&background=random`}
                    alt={review.profiles.full_name}
                    className="w-10 h-10 rounded-full"
                  />
                  <div>
                    <div className="font-medium text-gray-900">
                      {review.profiles.full_name}
                      {review.verified_purchase && (
                        <CheckCircle className="inline h-4 w-4 text-green-500 ml-2" />
                      )}
                    </div>
                    <div className="flex items-center space-x-2 text-sm text-gray-500">
                      <Calendar className="h-3 w-3" />
                      <span>{new Date(review.created_at).toLocaleDateString()}</span>
                      {review.verified_purchase && (
                        <span className="text-green-600 font-medium">Verified Purchase</span>
                      )}
                    </div>
                  </div>
                </div>
                <StarRating rating={review.rating} size="sm" />
              </div>

              <div className="mb-4">
                <h4 className="font-semibold text-gray-900 mb-2">{review.title}</h4>
                <p className="text-gray-700 leading-relaxed">{review.content}</p>
              </div>

              {review.images.length > 0 && (
                <div className="flex space-x-2 mb-4 overflow-x-auto">
                  {review.images.map((image, index) => (
                    <img
                      key={index}
                      src={image}
                      alt={`Review image ${index + 1}`}
                      className="w-20 h-20 object-cover rounded-lg flex-shrink-0"
                    />
                  ))}
                </div>
              )}

              {user && (
                <div className="flex items-center space-x-4 pt-4 border-t">
                  <span className="text-sm text-gray-600">Was this helpful?</span>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleHelpfulVote(review.id, true)}
                      className={`flex items-center space-x-1 px-2 py-1 rounded text-sm transition-colors ${
                        review.user_helpful_vote === true
                          ? 'bg-green-100 text-green-700'
                          : 'text-gray-600 hover:bg-green-50 hover:text-green-700'
                      }`}
                    >
                      <ThumbsUp className="h-3 w-3" />
                      <span>Yes</span>
                    </button>
                    <button
                      onClick={() => handleHelpfulVote(review.id, false)}
                      className={`flex items-center space-x-1 px-2 py-1 rounded text-sm transition-colors ${
                        review.user_helpful_vote === false
                          ? 'bg-red-100 text-red-700'
                          : 'text-gray-600 hover:bg-red-50 hover:text-red-700'
                      }`}
                    >
                      <ThumbsDown className="h-3 w-3" />
                      <span>No</span>
                    </button>
                  </div>
                  <span className="text-sm text-gray-500">
                    {review.helpful_count} people found this helpful
                  </span>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// Fix missing import
import { Star } from 'lucide-react';

export default ProductReviews;
