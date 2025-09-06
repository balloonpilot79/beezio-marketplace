import React, { useState, useEffect } from 'react';
import { Calendar, Star } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContextMultiRole';
import StarRating from './StarRating';

interface SellerRatingData {
  id: string;
  rating: number;
  comment: string;
  transaction_related: boolean;
  created_at: string;
  rater_id: string;
  profiles: {
    full_name: string;
  };
}

interface SellerRatingProps {
  sellerId: string;
  sellerName: string;
  averageRating: number;
  ratingCount: number;
  showWriteRating?: boolean;
}

const SellerRating: React.FC<SellerRatingProps> = ({
  sellerId,
  sellerName,
  averageRating,
  ratingCount,
  showWriteRating = true
}) => {
  const [ratings, setRatings] = useState<SellerRatingData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRatingForm, setShowRatingForm] = useState(false);
  const [userRating, setUserRating] = useState<SellerRatingData | null>(null);
  const [newRating, setNewRating] = useState(0);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    fetchRatings();
    if (user) {
      fetchUserRating();
    }
  }, [sellerId, user]);

  const fetchRatings = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('seller_ratings')
        .select(`
          *,
          profiles:rater_id (
            full_name
          )
        `)
        .eq('seller_id', sellerId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        console.error('Error fetching seller ratings:', error);
        return;
      }

      setRatings(data || []);
    } catch (error) {
      console.error('Error fetching seller ratings:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserRating = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('seller_ratings')
        .select('*')
        .eq('seller_id', sellerId)
        .eq('rater_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching user rating:', error);
        return;
      }

      setUserRating(data);
      if (data) {
        setNewRating(data.rating);
        setNewComment(data.comment || '');
      }
    } catch (error) {
      console.error('Error fetching user rating:', error);
    }
  };

  const handleSubmitRating = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || newRating === 0) return;

    setSubmitting(true);

    try {
      const ratingData = {
        seller_id: sellerId,
        rater_id: user.id,
        rating: newRating,
        comment: newComment.trim(),
        transaction_related: true
      };

      if (userRating) {
        // Update existing rating
        const { error } = await supabase
          .from('seller_ratings')
          .update(ratingData)
          .eq('id', userRating.id);

        if (error) {
          console.error('Error updating rating:', error);
          return;
        }
      } else {
        // Create new rating
        const { error } = await supabase
          .from('seller_ratings')
          .insert([ratingData]);

        if (error) {
          console.error('Error submitting rating:', error);
          return;
        }
      }

      setShowRatingForm(false);
      fetchRatings();
      fetchUserRating();
    } catch (error) {
      console.error('Error submitting rating:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const getRatingDistribution = () => {
    const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    ratings.forEach(rating => {
      distribution[rating.rating as keyof typeof distribution]++;
    });
    return distribution;
  };

  const distribution = getRatingDistribution();

  return (
    <div className="space-y-6">
      {/* Rating Summary */}
      <div className="bg-gray-50 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">Seller Rating</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="text-center">
            <div className="text-4xl font-bold text-gray-900 mb-2">
              {averageRating > 0 ? averageRating.toFixed(1) : '0.0'}
            </div>
            <StarRating rating={averageRating} size="lg" showCount reviewCount={ratingCount} />
            <p className="text-sm text-gray-600 mt-2">Based on {ratingCount} ratings</p>
          </div>
          
          <div className="space-y-2">
            {[5, 4, 3, 2, 1].map(rating => {
              const count = distribution[rating as keyof typeof distribution];
              const percentage = ratingCount > 0 ? (count / ratingCount) * 100 : 0;
              
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

      {/* User Rating Form */}
      {user && showWriteRating && sellerId !== user.id && (
        <div className="border rounded-lg p-4">
          {!showRatingForm ? (
            <button
              onClick={() => setShowRatingForm(true)}
              className="text-amber-600 hover:text-amber-700 font-medium"
            >
              {userRating ? 'Update Your Rating' : 'Rate This Seller'}
            </button>
          ) : (
            <form onSubmit={handleSubmitRating} className="space-y-4">
              <h4 className="font-medium">
                {userRating ? 'Update Your Rating' : `Rate ${sellerName}`}
              </h4>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Your Rating *
                </label>
                <StarRating
                  rating={newRating}
                  interactive
                  onRatingChange={setNewRating}
                  size="md"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Comment (Optional)
                </label>
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Share your experience with this seller..."
                  rows={3}
                  maxLength={500}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {newComment.length}/500 characters
                </p>
              </div>

              <div className="flex items-center space-x-3">
                <button
                  type="submit"
                  disabled={newRating === 0 || submitting}
                  className={`px-4 py-2 rounded-md font-medium transition-colors ${
                    newRating > 0 && !submitting
                      ? 'bg-amber-500 text-white hover:bg-amber-600'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  {submitting ? 'Submitting...' : userRating ? 'Update Rating' : 'Submit Rating'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowRatingForm(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Ratings List */}
      <div className="space-y-4">
        <h4 className="font-medium">Recent Ratings</h4>
        
        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse border rounded-lg p-4">
                <div className="h-4 bg-gray-300 rounded w-1/4 mb-2"></div>
                <div className="h-4 bg-gray-300 rounded w-3/4"></div>
              </div>
            ))}
          </div>
        ) : ratings.length === 0 ? (
          <p className="text-gray-500 text-center py-4">No ratings yet</p>
        ) : (
          <div className="space-y-4">
            {ratings.map((rating) => (
              <div key={rating.id} className="border rounded-lg p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <img
                      src={`https://ui-avatars.com/api/?name=${encodeURIComponent(rating.profiles.full_name)}&size=32&background=random`}
                      alt={rating.profiles.full_name}
                      className="w-8 h-8 rounded-full"
                    />
                    <div>
                      <div className="font-medium text-gray-900 text-sm">
                        {rating.profiles.full_name}
                      </div>
                      <div className="flex items-center space-x-2 text-xs text-gray-500">
                        <Calendar className="h-3 w-3" />
                        <span>{new Date(rating.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                  <StarRating rating={rating.rating} size="sm" />
                </div>

                {rating.comment && (
                  <p className="text-gray-700 text-sm leading-relaxed">
                    {rating.comment}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SellerRating;
