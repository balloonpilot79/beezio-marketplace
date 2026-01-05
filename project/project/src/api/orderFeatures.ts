import { supabase } from '../lib/supabase';

// Submit a product review
export async function submitProductReview(productId: string, buyerId: string, rating: number, review: string) {
  const { data, error } = await supabase.from('product_reviews').insert([
    { product_id: productId, buyer_id: buyerId, rating, review },
  ]);

  if (error) {
    throw new Error(`Failed to submit product review: ${error.message}`);
  }

  return data;
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
  const { data, error } = await supabase
    .from('product_reviews')
    .select('*')
    .eq('product_id', productId);

  if (error) {
    throw new Error(`Failed to fetch product reviews: ${error.message}`);
  }

  return data;
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
