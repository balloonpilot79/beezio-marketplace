import React, { useState, useEffect } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Star, Heart, Share2, ShoppingCart } from 'lucide-react';
import { useCart } from '../contexts/CartContext';
import { useAffiliate } from '../contexts/AffiliateContext';
import ProductReviews from '../components/ProductReviews';
import { products } from '../data/sampleProducts';

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  category: string;
  rating: number;
  reviews: number;
  seller: string;
}

const ProductDetailPageSimple: React.FC = () => {
  const { productId } = useParams<{ productId: string }>();
  const [searchParams] = useSearchParams();
  const { addToCart } = useCart();
  const { trackClick } = useAffiliate();
  const [product, setProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);

  // Handle affiliate tracking
  useEffect(() => {
    const affiliateId = searchParams.get('ref');
    if (affiliateId && productId) {
      // Store affiliate reference for checkout
      localStorage.setItem('affiliate_ref', affiliateId);
      
      // Track the click
      trackClick(productId, affiliateId);
    }
  }, [searchParams, productId, trackClick]);

  useEffect(() => {
    // Find product from our sample data
    const foundProduct = products.find(p => p.id === productId);
    setProduct(foundProduct || null);
    setLoading(false);
  }, [productId]);

  const handleAddToCart = () => {
    if (product) {
      // Find the full product data to get commission rate
      const fullProduct = products.find(p => p.id === product.id);
      
      addToCart({
        productId: product.id,
        title: product.name,
        price: product.price,
        quantity: quantity,
        image: product.image,
        sellerId: product.seller,
        sellerName: product.seller,
        commission_rate: fullProduct?.commission_rate || 25 // Default to 25% if not found
      });
      // You could show a success message here
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading product...</p>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">😕</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Product Not Found</h2>
          <p className="text-gray-600 mb-6">The product you're looking for doesn't exist.</p>
          <Link
            to="/marketplace"
            className="inline-flex items-center bg-orange-600 text-white px-6 py-3 rounded-lg hover:bg-orange-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Marketplace
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-orange-50 to-yellow-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Back Button */}
        <Link
          to="/marketplace"
          className="inline-flex items-center text-gray-500 hover:text-orange-600 mb-10 font-medium transition-colors group"
        >
          <ArrowLeft className="w-5 h-5 mr-2 group-hover:-translate-x-1 transition-transform" />
          Back to Marketplace
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Product Image */}
          <div className="relative bg-gradient-to-br from-yellow-100 via-orange-100 to-purple-100 rounded-3xl aspect-square flex items-center justify-center shadow-lg overflow-hidden">
            <span className="text-9xl drop-shadow-lg">📦</span>
            {/* Decorative Glow */}
            <div className="absolute -bottom-8 -right-8 w-32 h-32 bg-orange-200 rounded-full blur-2xl opacity-40 pointer-events-none" />
          </div>

          {/* Product Info */}
          <div className="space-y-8">
            <div>
              <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 mb-3 leading-tight">
                {product.name}
              </h1>
              <p className="text-gray-700 text-lg md:text-xl leading-relaxed">
                {product.description}
              </p>
            </div>

            {/* Rating & Seller */}
            <div className="flex flex-wrap items-center gap-6">
              <div className="flex items-center">
                <Star className="w-5 h-5 text-yellow-400 fill-current" />
                <span className="text-lg font-semibold text-gray-800 ml-1">{product.rating}</span>
              </div>
              <span className="text-gray-500 text-base">({product.reviews} reviews)</span>
              <span className="hidden md:inline text-gray-300">|</span>
              <span className="text-base text-gray-600">Sold by <span className="font-bold text-gray-900">{product.seller}</span></span>
            </div>

            {/* Price & CTA */}
            <div className="bg-white rounded-2xl p-8 border border-gray-100 shadow flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
              <div className="flex items-baseline gap-3">
                <span className="text-5xl font-extrabold text-gray-900">${product.price}</span>
                <span className="text-lg text-gray-500">/month</span>
              </div>

              {/* Quantity */}
              <div className="flex items-center gap-4 mb-6">
                <label className="text-gray-700 font-medium">Quantity:</label>
                <div className="flex items-center border border-gray-300 rounded-lg">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="px-3 py-2 text-gray-600 hover:text-gray-900"
                  >
                    -
                  </button>
                  <span className="px-4 py-2 border-l border-r border-gray-300 min-w-[3rem] text-center">
                    {quantity}
                  </span>
                  <button
                    onClick={() => setQuantity(quantity + 1)}
                    className="px-3 py-2 text-gray-600 hover:text-gray-900"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-4">
                <button
                  onClick={handleAddToCart}
                  className="w-full bg-orange-600 text-white py-4 rounded-lg hover:bg-orange-700 transition-colors font-semibold text-lg flex items-center justify-center"
                >
                  <ShoppingCart className="w-5 h-5 mr-2" />
                  Add to Cart
                </button>

                <div className="flex gap-4">
                  <button className="flex-1 border-2 border-gray-300 text-gray-700 py-3 rounded-lg hover:bg-gray-50 transition-colors font-medium flex items-center justify-center">
                    <Heart className="w-4 h-4 mr-2" />
                    Save for Later
                  </button>
                  <button className="flex-1 border-2 border-gray-300 text-gray-700 py-3 rounded-lg hover:bg-gray-50 transition-colors font-medium flex items-center justify-center">
                    <Share2 className="w-4 h-4 mr-2" />
                    Share Product
                  </button>
                </div>
              </div>
            </div>

            {/* Category */}
            <div>
              <span className="inline-block bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                {product.category}
              </span>
            </div>
          </div>
        </div>

        {/* Additional Details */}
        <div className="mt-16 bg-white rounded-2xl p-8 border border-gray-200">
          <h3 className="text-2xl font-bold text-gray-900 mb-6">Product Details</h3>
          <div className="prose max-w-none">
            <p className="text-gray-600 text-lg leading-relaxed">
              {product.description}
            </p>
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">What's Included:</h4>
                <ul className="text-gray-600 space-y-1">
                  <li>✓ Full access to all content</li>
                  <li>✓ 30-day money-back guarantee</li>
                  <li>✓ Customer support</li>
                  <li>✓ Regular updates</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Requirements:</h4>
                <ul className="text-gray-600 space-y-1">
                  <li>• Internet connection</li>
                  <li>• Compatible device</li>
                  <li>• Email address</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Product Reviews Section */}
        <div className="mt-16">
          <ProductReviews 
            productId={productId || ''} 
            averageRating={product.rating} 
            reviewCount={product.reviews} 
          />
        </div>
      </div>
    </div>
  );
};

export default ProductDetailPageSimple;
