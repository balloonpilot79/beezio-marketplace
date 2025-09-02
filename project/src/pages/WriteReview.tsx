import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Star, ArrowLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

const WriteReview: React.FC = () => {
  const { productId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [review, setReview] = useState({
    rating: 5,
    title: '',
    content: ''
  });

  useEffect(() => {
    if (!user) {
      navigate('/');
      return;
    }
    fetchProduct();
    checkExistingReview();
  }, [productId, user]);

  const fetchProduct = async () => {
    if (!productId) return;
    
    const { data, error } = await supabase
      .from('products')
      .select('id, title, images')
      .eq('id', productId)
      .single();

    if (!error && data) {
      setProduct(data);
    }
    setLoading(false);
  };

  const checkExistingReview = async () => {
    if (!user || !productId) return;
    
    const { data } = await supabase
      .from('product_reviews')
      .select('id')
      .eq('product_id', productId)
      .eq('reviewer_id', user.id)
      .single();

    if (data) {
      // User already reviewed this product
      navigate(`/product/${productId}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !productId) return;

    setSubmitting(true);
    setError(null);

    const { error } = await supabase
      .from('product_reviews')
      .insert({
        product_id: productId,
        reviewer_id: user.id,
        rating: review.rating,
        title: review.title,
        content: review.content,
        verified_purchase: false // TODO: Check if user actually purchased this product
      });

    if (error) {
      setError('Failed to submit review. Please try again.');
    } else {
      navigate(`/product/${productId}`);
    }

    setSubmitting(false);
  };

  const renderStars = () => {
    return (
      <div className="flex space-x-1">
        {Array.from({ length: 5 }, (_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setReview({ ...review, rating: i + 1 })}
            className="focus:outline-none hover:scale-110 transition-transform"
          >
            <Star
              className={`w-8 h-8 ${
                i < review.rating ? 'text-yellow-400 fill-current' : 'text-gray-300'
              }`}
            />
          </button>
        ))}
      </div>
    );
  };

  if (loading) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center">Loading...</div>;
  }

  if (!product) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center">Product not found</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4">
        <div className="mb-6">
          <button
            onClick={() => navigate(`/product/${productId}`)}
            className="flex items-center text-purple-600 hover:text-purple-700 font-medium"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Product
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Write a Review</h1>
          
          {/* Product Info */}
          <div className="flex items-center space-x-4 mb-8 p-4 bg-gray-50 rounded-lg">
            {product.images?.[0] && (
              <img
                src={product.images[0]}
                alt={product.title}
                className="w-16 h-16 object-cover rounded-lg"
              />
            )}
            <div>
              <h3 className="font-semibold text-gray-900">{product.title}</h3>
              <p className="text-sm text-gray-600">Share your experience with this product</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Rating */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Overall Rating *
              </label>
              {renderStars()}
              <p className="text-sm text-gray-500 mt-2">
                {review.rating === 1 && "Poor"}
                {review.rating === 2 && "Fair"}
                {review.rating === 3 && "Good"}
                {review.rating === 4 && "Very Good"}
                {review.rating === 5 && "Excellent"}
              </p>
            </div>

            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Review Title *
              </label>
              <input
                type="text"
                value={review.title}
                onChange={(e) => setReview({ ...review, title: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Summarize your experience in a few words"
                required
                maxLength={100}
              />
              <p className="text-sm text-gray-500 mt-1">{review.title.length}/100 characters</p>
            </div>

            {/* Content */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Your Review *
              </label>
              <textarea
                value={review.content}
                onChange={(e) => setReview({ ...review, content: e.target.value })}
                rows={6}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Tell others about your experience with this product. What did you like or dislike? How did it meet your expectations?"
                required
                minLength={10}
                maxLength={1000}
              />
              <p className="text-sm text-gray-500 mt-1">{review.content.length}/1000 characters</p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
                {error}
              </div>
            )}

            {/* Submit Button */}
            <div className="flex space-x-4 pt-4">
              <button
                type="submit"
                disabled={submitting || !review.title.trim() || !review.content.trim()}
                className="flex-1 bg-purple-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Submitting...' : 'Submit Review'}
              </button>
              <button
                type="button"
                onClick={() => navigate(`/product/${productId}`)}
                className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default WriteReview;
