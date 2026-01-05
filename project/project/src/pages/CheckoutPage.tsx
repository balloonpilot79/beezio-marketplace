import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Lock, CreditCard } from 'lucide-react';
import { useCart } from '../contexts/CartContext';
import { useAuth } from '../contexts/AuthContextMultiRole';
import { TAX_RATE } from '../lib/pricing';
import CheckoutForm from '../components/CheckoutForm';
import { getStripeStatus } from '../utils/stripeStatus';

const CheckoutPage: React.FC = () => {
  const { items, getTotalPrice, getShippingTotal, clearCart } = useCart();
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  // Redirect if not logged in
  React.useEffect(() => {
    if (!user) {
      navigate('/signup?redirect=/checkout');
    }
  }, [user, navigate]);

  // Redirect if cart is empty
  React.useEffect(() => {
    if (items.length === 0) {
      navigate('/cart');
    }
  }, [items.length, navigate]);

  const subtotal = getTotalPrice();
  const shipping = getShippingTotal();
  const tax = Math.round((subtotal * TAX_RATE + Number.EPSILON) * 100) / 100;
  const total = subtotal + shipping + tax;

  const stripeStatus = React.useMemo(() => getStripeStatus(), []);

  if (!user || items.length === 0) {
    return null; // Will redirect
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center space-x-4 mb-8">
        <Link
          to="/cart"
          className="inline-flex items-center text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Cart
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">Checkout</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* Checkout Form */}
        <div className="space-y-8">
          {/* Dev-only Stripe status */}
          {import.meta.env.DEV && (
            <div
              className={`rounded-lg border p-4 text-sm ${
                stripeStatus.mode === 'disabled'
                  ? 'bg-red-50 border-red-200 text-red-900'
                  : stripeStatus.mode === 'test'
                  ? 'bg-amber-50 border-amber-200 text-amber-900'
                  : 'bg-green-50 border-green-200 text-green-900'
              }`}
            >
              <div className="font-semibold">
                Stripe: {stripeStatus.mode === 'disabled' ? 'DISABLED (simulated checkout)' : stripeStatus.mode.toUpperCase()}
              </div>
              <div className="mt-1 opacity-90">
                Publishable key: {stripeStatus.publishableKeyPresent ? stripeStatus.publishableKeyPrefix : 'missing'}
              </div>
            </div>
          )}

          {/* Security Notice */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center space-x-2">
              <Lock className="w-5 h-5 text-green-600" />
              <div>
                <h3 className="font-semibold text-green-900">Secure Checkout</h3>
                <p className="text-sm text-green-700">
                  Your payment information is encrypted and secure
                </p>
              </div>
            </div>
          </div>

          {/* Contact Information */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Contact Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  defaultValue={user.email}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  defaultValue={profile?.full_name || ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-amber-500 focus:border-amber-500"
                />
              </div>
            </div>
          </div>

          {/* Payment Form */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center space-x-2 mb-4">
              <CreditCard className="w-5 h-5 text-gray-600" />
              <h2 className="text-xl font-semibold text-gray-900">Payment Information</h2>
            </div>

            <CheckoutForm
              amount={total}
              onSuccess={() => {
                // Stripe Checkout will redirect away; cart is cleared before redirect.
                clearCart();
              }}
              onError={(error: string) => {
                console.error('Payment error:', error);
              }}
            />
          </div>
        </div>

        {/* Order Summary */}
            <div className="space-y-6">
              {/* Order Items */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Order Summary</h2>
            
            <div className="space-y-4 mb-6">
              {items.map((item) => (
                <div key={item.id} className="flex items-center space-x-4">
                  <div className="relative">
                    <img
                      src={item.image}
                      alt={item.title}
                      className="w-16 h-16 object-cover rounded-lg"
                    />
                    <span className="absolute -top-2 -right-2 bg-gray-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                      {item.quantity}
                    </span>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-900 truncate">
                      {item.title}
                    </h3>
                    <p className="text-sm text-gray-600">
                      By {item.sellerName}
                    </p>
                  </div>
                  
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">
                      ${(item.price * item.quantity).toFixed(2)}
                    </p>
                    {item.shippingCost && item.shippingCost > 0 && (
                      <p className="text-xs text-gray-600">
                        +${item.shippingCost.toFixed(2)} shipping
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Price Breakdown */}
            <div className="border-t border-gray-200 pt-4 space-y-2">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              
              <div className="flex justify-between text-gray-600">
                <span>Shipping</span>
                <span>${shipping.toFixed(2)}</span>
              </div>
              
              <div className="flex justify-between text-gray-600">
                <span>Tax</span>
                <span>${tax.toFixed(2)}</span>
              </div>
              
              <div className="border-t border-gray-200 pt-2">
                <div className="flex justify-between text-lg font-semibold text-gray-900">
                  <span>Total</span>
                  <span>${total.toFixed(2)}</span>
                </div>
                <div className="mt-1 text-xs text-gray-500">
                  Final total updates after shipping is quoted from your address.
                </div>
              </div>
            </div>
          </div>

          {/* Trust Badges */}
          <div className="bg-gray-50 rounded-lg p-6">
            <h3 className="font-semibold text-gray-900 mb-3">Why shop with us?</h3>
            <div className="space-y-3 text-sm text-gray-700">
              {[
                'SSL encrypted checkout',
                'Secure payment processing',
                'Fast & reliable shipping',
                '30-day return policy',
              ].map((text) => (
                <div key={text} className="flex items-center space-x-2">
                  <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
                  <span>{text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CheckoutPage;
