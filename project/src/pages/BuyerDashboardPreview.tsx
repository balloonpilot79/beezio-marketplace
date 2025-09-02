import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, User, ShoppingBag, Heart, Star, Package, Calendar, CreditCard } from 'lucide-react';

const BuyerDashboardPreview: React.FC = () => {
  // Mock data for preview
  const mockProfile = {
    id: 'demo-buyer-123',
    full_name: 'Demo Buyer',
    role: 'buyer' as const,
    email: 'demo@buyer.com'
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Preview Notice */}
      <div className="bg-green-500 text-white py-3">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <span className="text-2xl">👀</span>
              <div>
                <p className="font-semibold">Buyer Dashboard Preview</p>
                <p className="text-sm text-green-100">This is a demo view - sign up to access your real dashboard</p>
              </div>
            </div>
            <div className="flex space-x-3">
              <Link
                to="/signup"
                className="bg-white text-green-600 px-4 py-2 rounded-lg font-semibold hover:bg-green-50 transition-colors"
              >
                Sign Up Free
              </Link>
              <button
                onClick={() => window.dispatchEvent(new CustomEvent('open-auth-modal', { detail: { mode: 'login' } }))}
                className="border border-white text-white px-4 py-2 rounded-lg font-semibold hover:bg-green-600 transition-colors"
              >
                Login
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold mb-4">Welcome, {mockProfile.full_name}!</h1>
        
        {/* Quick Stats */}
        <section className="mb-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white rounded-lg shadow p-6 text-center">
              <div className="text-3xl font-bold text-blue-600">0</div>
              <div className="text-sm text-gray-600">Total Orders</div>
            </div>
            
            <div className="bg-white rounded-lg shadow p-6 text-center">
              <div className="text-3xl font-bold text-green-600">$0</div>
              <div className="text-sm text-gray-600">Total Spent</div>
            </div>
            
            <div className="bg-white rounded-lg shadow p-6 text-center">
              <div className="text-3xl font-bold text-purple-600">0</div>
              <div className="text-sm text-gray-600">Active Subscriptions</div>
            </div>
            
            <div className="bg-white rounded-lg shadow p-6 text-center">
              <div className="text-3xl font-bold text-amber-600">0</div>
              <div className="text-sm text-gray-600">Saved Items</div>
            </div>
          </div>
        </section>
        
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-2">Order History</h2>
          <div className="bg-white rounded shadow p-6">
            <div className="text-center py-12">
              <ShoppingBag className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 mb-4">No orders yet - start shopping to see your purchase history here</p>
              <Link 
                to="/products" 
                className="bg-green-500 text-white px-6 py-2 rounded-lg hover:bg-green-600 transition-colors font-medium inline-flex items-center"
              >
                <ShoppingBag className="w-4 h-4 mr-2" />
                Browse Products
              </Link>
            </div>
          </div>
        </section>
        
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-2">Active Subscriptions</h2>
          <div className="bg-white rounded shadow p-6">
            <div className="text-center py-12">
              <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 mb-4">No active subscriptions - discover recurring products and services</p>
              <div className="space-y-4">
                <div className="border border-gray-200 rounded-lg p-4 max-w-md mx-auto">
                  <h4 className="font-semibold text-gray-800 mb-2">Subscription Benefits</h4>
                  <ul className="text-gray-600 text-sm space-y-1">
                    <li>• Automatic deliveries</li>
                    <li>• Exclusive subscriber discounts</li>
                    <li>• Priority customer support</li>
                    <li>• Cancel anytime</li>
                  </ul>
                </div>
                <div className="bg-gray-100 text-gray-500 px-4 py-2 rounded font-medium inline-block">
                  Explore Subscription Products (Demo)
                </div>
              </div>
            </div>
          </div>
        </section>
        
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-2">Saved Items</h2>
          <div className="bg-white rounded shadow p-6">
            <div className="text-center py-12">
              <Heart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 mb-4">Your wishlist is empty - save items you're interested in</p>
              <div className="space-y-4">
                <div className="border border-gray-200 rounded-lg p-4 max-w-md mx-auto">
                  <h4 className="font-semibold text-gray-800 mb-2">Wishlist Features</h4>
                  <ul className="text-gray-600 text-sm space-y-1">
                    <li>• Save items for later</li>
                    <li>• Price drop notifications</li>
                    <li>• Share lists with friends</li>
                    <li>• Move items to cart easily</li>
                  </ul>
                </div>
                <div className="bg-gray-100 text-gray-500 px-4 py-2 rounded font-medium inline-block">
                  Start Building Your Wishlist (Demo)
                </div>
              </div>
            </div>
          </div>
        </section>
        
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-2">Recommended Products</h2>
          <div className="bg-white rounded shadow p-6">
            <div className="text-center py-12">
              <Star className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 mb-4">Personalized recommendations based on your interests</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
                <div className="border border-gray-200 rounded-lg p-4">
                  <div className="w-full h-32 bg-gray-100 rounded mb-3 flex items-center justify-center">
                    <Package className="w-8 h-8 text-gray-400" />
                  </div>
                  <h4 className="font-medium text-gray-800 mb-1">Premium Wireless Headphones</h4>
                  <p className="text-sm text-gray-600 mb-2">$199.99</p>
                  <div className="flex items-center text-sm text-amber-600">
                    <Star className="w-4 h-4 fill-current mr-1" />
                    4.8 (324 reviews)
                  </div>
                </div>
                
                <div className="border border-gray-200 rounded-lg p-4">
                  <div className="w-full h-32 bg-gray-100 rounded mb-3 flex items-center justify-center">
                    <Package className="w-8 h-8 text-gray-400" />
                  </div>
                  <h4 className="font-medium text-gray-800 mb-1">Organic Coffee Subscription</h4>
                  <p className="text-sm text-gray-600 mb-2">$24.99/month</p>
                  <div className="flex items-center text-sm text-amber-600">
                    <Star className="w-4 h-4 fill-current mr-1" />
                    4.9 (156 reviews)
                  </div>
                </div>
                
                <div className="border border-gray-200 rounded-lg p-4">
                  <div className="w-full h-32 bg-gray-100 rounded mb-3 flex items-center justify-center">
                    <Package className="w-8 h-8 text-gray-400" />
                  </div>
                  <h4 className="font-medium text-gray-800 mb-1">Smart Fitness Tracker</h4>
                  <p className="text-sm text-gray-600 mb-2">$149.99</p>
                  <div className="flex items-center text-sm text-amber-600">
                    <Star className="w-4 h-4 fill-current mr-1" />
                    4.7 (892 reviews)
                  </div>
                </div>
              </div>
              <div className="mt-6">
                <Link 
                  to="/products" 
                  className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 transition-colors font-medium"
                >
                  Explore All Products
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Buyer Features Section */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">🛍️ Your Shopping Benefits</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
              <h3 className="font-semibold text-gray-900 mb-2">🔒 Secure Shopping</h3>
              <p className="text-gray-600 text-sm mb-4">Bank-level security with encrypted payments and fraud protection on every purchase.</p>
            </div>
            
            <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-500">
              <h3 className="font-semibold text-gray-900 mb-2">🚚 Fast Shipping</h3>
              <p className="text-gray-600 text-sm mb-4">Free shipping on orders over $50 with tracking and delivery insurance included.</p>
            </div>
            
            <div className="bg-white rounded-lg shadow p-6 border-l-4 border-purple-500">
              <h3 className="font-semibold text-gray-900 mb-2">↩️ Easy Returns</h3>
              <p className="text-gray-600 text-sm mb-4">30-day hassle-free returns with prepaid shipping labels and instant refunds.</p>
            </div>
            
            <div className="bg-white rounded-lg shadow p-6 border-l-4 border-amber-500">
              <h3 className="font-semibold text-gray-900 mb-2">💳 Flexible Payments</h3>
              <p className="text-gray-600 text-sm mb-4">Multiple payment options including buy-now-pay-later and subscription billing.</p>
            </div>
            
            <div className="bg-white rounded-lg shadow p-6 border-l-4 border-red-500">
              <h3 className="font-semibold text-gray-900 mb-2">🎯 Personalized Experience</h3>
              <p className="text-gray-600 text-sm mb-4">AI-powered recommendations based on your preferences and shopping history.</p>
            </div>
            
            <div className="bg-white rounded-lg shadow p-6 border-l-4 border-indigo-500">
              <h3 className="font-semibold text-gray-900 mb-2">🤝 Support Creators</h3>
              <p className="text-gray-600 text-sm mb-4">Your purchases support independent sellers and help fund charitable causes.</p>
            </div>
          </div>
        </section>
        
        <section className="mb-8">
          <div className="bg-gray-100 text-gray-500 px-4 py-2 rounded hover:bg-gray-200 transition-colors inline-flex items-center">
            <CreditCard className="w-4 h-4 mr-2" />
            Contact Support (Demo)
          </div>
        </section>

        {/* CTA Section */}
        <section className="bg-gradient-to-r from-green-500 to-blue-500 rounded-lg p-8 text-center text-white">
          <h2 className="text-2xl font-bold mb-4">Ready to Start Shopping?</h2>
          <p className="text-lg mb-6 opacity-90">
            Discover unique products, support creators, and enjoy a seamless shopping experience!
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/signup"
              className="bg-white text-green-600 px-8 py-3 rounded-lg text-lg hover:bg-gray-100 transition-colors font-semibold flex items-center justify-center"
            >
              <User className="w-5 h-5 mr-2" />
              Sign Up Free
            </Link>
            <Link
              to="/products"
              className="border-2 border-white text-white px-8 py-3 rounded-lg text-lg hover:bg-white hover:text-green-600 transition-colors font-semibold flex items-center justify-center"
            >
              <ShoppingBag className="w-5 h-5 mr-2" />
              Browse Products
            </Link>
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('open-auth-modal', { detail: { mode: 'login' } }))}
              className="border-2 border-white text-white px-8 py-3 rounded-lg text-lg hover:bg-white hover:text-green-600 transition-colors font-semibold flex items-center justify-center"
            >
              <ArrowRight className="w-5 h-5 mr-2" />
              Login to Dashboard
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};

export default BuyerDashboardPreview;
