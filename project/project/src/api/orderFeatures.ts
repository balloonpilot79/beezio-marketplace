import { supabase } from '../lib/supabase';
import {
  fetchProductReviews as fetchProductReviewsFromService,
  submitProductReview as submitProductReviewFromService,
} from '../services/reviewService';

// Submit a product review
export async function submitProductReview(productId: string, buyerId: string, rating: number, review: string) {
  return submitProductReviewFromService({
    productId,
    userId: buyerId,
    rating,
    content: review,
    requireVerifiedPurchase: true,
  });
}

// Submit a seller review
export async function submitSellerReview(sellerId: string, buyerId: string, rating: number, review: string) {
  const { data, error } = await supabase.from('seller_reviews').insert([
    { seller_id: sellerId, buyer_id: buyerId, rating, review },
  ]);

  if (error) {
    throw new Error(`Failed to submit seller review: ${error.message}`);
  }

  return data;
}

// Fetch reviews for a product
export async function fetchProductReviews(productId: string) {
  return fetchProductReviewsFromService(productId, 50);
}

// Fetch reviews for a seller
export async function fetchSellerReviews(sellerId: string) {
  const { data, error } = await supabase
    .from('seller_reviews')
    .select('*')
    .eq('seller_id', sellerId);

  if (error) {
    throw new Error(`Failed to fetch seller reviews: ${error.message}`);
  }

  return data;
}

// Update tracking information for an order
export async function updateOrderTracking(orderId: string, trackingNumber: string, trackingUrl: string) {
  const { data, error } = await supabase
    .from('orders')
    .update({ tracking_number: trackingNumber, tracking_url: trackingUrl })
    .eq('id', orderId);

  if (error) {
    throw new Error(`Failed to update tracking information: ${error.message}`);
  }

  return data;
}
