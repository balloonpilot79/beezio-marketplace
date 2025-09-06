import React, { useState } from 'react';
import { X, Upload, Star } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContextMultiRole';
import StarRating from './StarRating';

interface WriteReviewProps {
  productId: string;
  productTitle: string;
  onClose: () => void;
  onReviewSubmitted: () => void;
  existingReview?: {
    id: string;
    rating: number;
    title: string;
    content: string;
    images: string[];
  } | null;
}

const WriteReview: React.FC<WriteReviewProps> = ({
  productId,
  productTitle,
  onClose,
  onReviewSubmitted,
  existingReview
}) => {
  const [rating, setRating] = useState(existingReview?.rating || 0);
  const [title, setTitle] = useState(existingReview?.title || '');
  const [content, setContent] = useState(existingReview?.content || '');
  const [images, setImages] = useState<string[]>(existingReview?.images || []);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { user } = useAuth();

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    const uploadedImages: string[] = [];

    try {
      for (const file of Array.from(files)) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `review-images/${fileName}`;

        const { data, error } = await supabase.storage
          .from('images')
          .upload(filePath, file);

        if (error) {
          console.error('Error uploading image:', error);
          continue;
        }

        const { data: { publicUrl } } = supabase.storage
          .from('images')
          .getPublicUrl(filePath);

        uploadedImages.push(publicUrl);
      }

      setImages(prev => [...prev, ...uploadedImages]);
    } catch (error) {
      console.error('Error uploading images:', error);
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || rating === 0 || !title.trim() || !content.trim()) return;

    setSubmitting(true);

    try {
      // Check if user has purchased this product
      const { data: purchaseData, error: purchaseError } = await supabase
        .from('order_items')
        .select('id')
        .eq('product_id', productId)
        .eq('customer_email', user.email)
        .limit(1);

      const hasPurchased = purchaseData && purchaseData.length > 0;

      const reviewData = {
        product_id: productId,
        reviewer_id: user.id,
        rating,
        title: title.trim(),
        content: content.trim(),
        images,
        verified_purchase: hasPurchased
      };

      if (existingReview) {
        // Update existing review
        const { error } = await supabase
          .from('product_reviews')
          .update(reviewData)
          .eq('id', existingReview.id);

        if (error) {
          console.error('Error updating review:', error);
          return;
        }
      } else {
        // Create new review
        const { error } = await supabase
          .from('product_reviews')
          .insert([reviewData]);

        if (error) {
          console.error('Error submitting review:', error);
          return;
        }
      }

      onReviewSubmitted();
      onClose();
    } catch (error) {
      console.error('Error submitting review:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const isValid = rating > 0 && title.trim() && content.trim();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b p-6 flex items-center justify-between">
          <h2 className="text-xl font-semibold">
            {existingReview ? 'Edit Your Review' : 'Write a Review'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div>
            <h3 className="font-medium text-gray-900 mb-2">{productTitle}</h3>
            <p className="text-sm text-gray-600">
              Share your experience with this product to help other customers
            </p>
          </div>

          {/* Rating */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Overall Rating *
            </label>
            <StarRating
              rating={rating}
              interactive
              onRatingChange={setRating}
              size="lg"
              className="mb-2"
            />
            <p className="text-xs text-gray-500">
              Click the stars to rate this product
            </p>
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Review Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Summarize your experience"
              maxLength={100}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">
              {title.length}/100 characters
            </p>
          </div>

          {/* Content */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Review Details *
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Tell us about your experience with this product. What did you like or dislike? How did you use it?"
              rows={6}
              maxLength={2000}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">
              {content.length}/2000 characters
            </p>
          </div>

          {/* Image Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Add Photos (Optional)
            </label>
            <div className="border-2 border-dashed border-gray-300 rounded-md p-4">
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageUpload}
                className="hidden"
                id="image-upload"
                disabled={uploading || images.length >= 5}
              />
              <label
                htmlFor="image-upload"
                className={`flex flex-col items-center cursor-pointer ${
                  uploading || images.length >= 5 ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                <Upload className="h-8 w-8 text-gray-400 mb-2" />
                <span className="text-sm text-gray-600">
                  {uploading ? 'Uploading...' : 'Click to upload images'}
                </span>
                <span className="text-xs text-gray-500 mt-1">
                  Up to 5 images, 10MB each
                </span>
              </label>
            </div>

            {images.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4">
                {images.map((image, index) => (
                  <div key={index} className="relative">
                    <img
                      src={image}
                      alt={`Review image ${index + 1}`}
                      className="w-20 h-20 object-cover rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Submit Buttons */}
          <div className="flex items-center justify-end space-x-3 pt-6 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isValid || submitting}
              className={`px-6 py-2 rounded-md font-medium transition-colors ${
                isValid && !submitting
                  ? 'bg-amber-500 text-white hover:bg-amber-600'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              {submitting 
                ? 'Submitting...' 
                : existingReview 
                  ? 'Update Review' 
                  : 'Submit Review'
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default WriteReview;
