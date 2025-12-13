import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Trash2, Plus, Minus, ShoppingBag, ArrowLeft } from 'lucide-react';
import { useCart } from '../contexts/CartContext';
import { useAuth } from '../contexts/AuthContextMultiRole';
import RecommendationEngine from '../components/RecommendationEngine';
import { TAX_RATE } from '../lib/pricing';
import { calculateFinalPrice } from '../utils/pricingEngine';
import { DEFAULT_PAYOUT_SETTINGS, PLATFORM_FEE_PERCENT } from '../config/beezioConfig';
import { useBehaviorTracker } from '../hooks/useBehaviorTracker';

const CartPage: React.FC = () => {
  const { 
    items, 
    removeFromCart, 
    updateQuantity, 
    clearCart, 
    getTotalPrice, 
    getShippingTotal,
    getTotalItems 
  } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // Behavior tracking
  const { trackView, trackClick } = useBehaviorTracker();

  const computeFinalUnitPrice = (item: typeof items[number]) => {
    const affiliatePercent = item.affiliateCommissionRate ?? item.commission_rate ?? DEFAULT_PAYOUT_SETTINGS.affiliatePercent;
    const payout = {
      affiliatePercent,
      platformPercent: PLATFORM_FEE_PERCENT,
      fundraiserPercent: DEFAULT_PAYOUT_SETTINGS.fundraiserPercent,
    };
    try {
      return calculateFinalPrice(item.price, payout);
    } catch (e) {
      console.warn('BEEZIO_PRICING_ENGINE cart display fallback', e);
      return item.price;
    }
  };

  const displaySubtotal = items.reduce((total, item) => total + computeFinalUnitPrice(item) * item.quantity, 0);
  const shipping = getShippingTotal();
  const tax = Math.round((displaySubtotal * TAX_RATE + Number.EPSILON) * 100) / 100;
  const total = displaySubtotal + shipping + tax;

  useEffect(() => {
    // Track cart page view
    trackView();
  }, [trackView]);

  const handleQuantityChange = (itemId: string, newQuantity: number) => {
    if (newQuantity < 1) {
      // Track item removal
      const item = items.find(i => i.id === itemId);
      if (item) {
        trackClick(item.productId, 'cart_remove');
      }
      removeFromCart(itemId);
    } else {
      // Track quantity update
      const item = items.find(i => i.id === itemId);
      if (item) {
        trackClick(item.productId, 'cart_update');
      }
      updateQuantity(itemId, newQuantity);
    }
  };

  const handleCheckout = () => {
    // Track checkout initiation
    trackClick(undefined, 'checkout_initiated');

    if (!user) {
      // Redirect to login/signup with return URL
      navigate('/signup?redirect=/checkout');
    } else {
      navigate('/checkout');
    }
  };

  if (items.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center">
          <ShoppingBag className="w-24 h-24 text-gray-300 mx-auto mb-6" />
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Your cart is empty</h1>
          <p className="text-gray-600 mb-8">
            Looks like you haven't added any products to your cart yet.
          </p>
          <Link
            to="/products"
            className="bg-amber-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-amber-700 transition-colors inline-flex items-center"
          >
            <ShoppingBag className="w-5 h-5 mr-2" />
            Continue Shopping
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center space-x-4">
          <Link
            to="/products"
            className="inline-flex items-center text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Continue Shopping
          </Link>
        </div>
        <h1 className="text-3xl font-bold text-gray-900">
          Shopping Cart ({getTotalItems()} {getTotalItems() === 1 ? 'item' : 'items'})
        </h1>
        <button
          onClick={clearCart}
          className="text-red-600 hover:text-red-700 font-medium"
        >
          Clear Cart
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Cart Items */}
        <div className="lg:col-span-2 space-y-4">
          {items.map((item) => {
            const finalUnitPrice = computeFinalUnitPrice(item);
            return (
            <div key={item.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center space-x-4">
                {/* Product Image */}
                <div className="flex-shrink-0">
                  <img
                    src={item.image}
                    alt={item.title}
                    className="w-20 h-20 object-cover rounded-lg"
                  />
                </div>

                {/* Product Info */}
                <div className="flex-1 min-w-0">
                  <Link
                    to={`/product/${item.productId}`}
                    className="text-lg font-semibold text-gray-900 hover:text-amber-600 transition-colors"
                  >
                    {item.title}
                  </Link>
                  <p className="text-sm text-gray-600 mt-1">
                    Sold by {item.sellerName}
                  </p>
                  <div className="flex items-center space-x-4 mt-2">
                    <span className="text-lg font-bold text-gray-900">
                      ${finalUnitPrice.toFixed(2)}
                    </span>
                    <span className="text-xs text-gray-500">Includes platform & commission fees</span>
                    {item.shippingCost && item.shippingCost > 0 && (
                      <span className="text-sm text-gray-600">
                        + ${item.shippingCost.toFixed(2)} shipping
                      </span>
                    )}
                  </div>
                </div>

                {/* Quantity Controls */}
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => handleQuantityChange(item.id, item.quantity - 1)}
                    className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  
                  <span className="w-12 text-center font-semibold">
                    {item.quantity}
                  </span>
                  
                  <button
                    onClick={() => handleQuantityChange(item.id, item.quantity + 1)}
                    disabled={item.maxQuantity ? item.quantity >= item.maxQuantity : false}
                    className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                {/* Remove Button */}
                <button
                  onClick={() => {
                    // Track item removal
                    trackClick(item.productId, 'cart_remove');
                    removeFromCart(item.id);
                  }}
                  className="text-red-600 hover:text-red-700 p-2"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>

              {/* Item Total */}
              <div className="mt-4 pt-4 border-t border-gray-200 flex justify-between items-center">
                <span className="text-sm text-gray-600">
                  {item.quantity} × ${finalUnitPrice.toFixed(2)}
                </span>
                <span className="text-lg font-bold text-gray-900">
                  ${(finalUnitPrice * item.quantity).toFixed(2)}
                </span>
              </div>
            </div>
          );
        })}
        </div>

        {/* Order Summary */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 sticky top-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Order Summary</h2>
            
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Subtotal</span>
                <span className="font-semibold">${displaySubtotal.toFixed(2)}</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-gray-600">Shipping</span>
                <span className="font-semibold">${shipping.toFixed(2)}</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-gray-600">Tax</span>
                <span className="font-semibold">${tax.toFixed(2)}</span>
              </div>
              
              <div className="border-t pt-3">
                <div className="flex justify-between">
                  <span className="text-lg font-semibold text-gray-900">Total</span>
                  <span className="text-lg font-bold text-gray-900">${total.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <button
              onClick={handleCheckout}
              className="w-full bg-amber-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-amber-700 transition-colors mt-6"
            >
              {user ? 'Proceed to Checkout' : 'Sign In to Checkout'}
            </button>

            {/* Trust Badges */}
            <div className="mt-6 pt-6 border-t border-gray-200">
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-3">Safe & Secure Checkout</p>
                <div className="flex justify-center space-x-4 text-xs text-gray-500">
                  <span>🔒 SSL Encrypted</span>
                  <span>💳 Stripe Secured</span>
                  <span>↩️ Easy Returns</span>
                </div>
              </div>
            </div>

            {/* Continue Shopping */}
            <Link
              to="/products"
              className="block text-center text-amber-600 hover:text-amber-700 font-medium mt-4"
            >
              Continue Shopping
            </Link>
          </div>
        </div>
      </div>

      {/* Complete the Look / AI Recommendations */}
      {items.length > 0 && (
        <div className="mt-16">
          <RecommendationEngine 
            type="cart" 
            title="Complete your purchase"
          />
        </div>
      )}
    </div>
  );
};

export default CartPage;
