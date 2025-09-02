import React from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, ArrowRight, User, Store } from 'lucide-react';

const DashboardPreview: React.FC = () => {
  // Mock data for preview
  const mockProfile = {
    id: 'demo-seller-123',
    full_name: 'Demo Seller',
    role: 'seller' as const,
    email: 'demo@seller.com'
  };

  const storeUrl = `${window.location.origin}/store/${mockProfile.id}`;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Preview Notice */}
      <div className="bg-amber-500 text-white py-3">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <span className="text-2xl">👀</span>
              <div>
                <p className="font-semibold">Seller Dashboard Preview</p>
                <p className="text-sm text-amber-100">This is a demo view - sign up to access your real dashboard</p>
              </div>
            </div>
            <div className="flex space-x-3">
              <Link
                to="/signup"
                className="bg-white text-amber-600 px-4 py-2 rounded-lg font-semibold hover:bg-amber-50 transition-colors"
              >
                Sign Up Free
              </Link>
              <button
                onClick={() => window.dispatchEvent(new CustomEvent('open-auth-modal', { detail: { mode: 'login' } }))}
                className="border border-white text-white px-4 py-2 rounded-lg font-semibold hover:bg-amber-600 transition-colors"
              >
                Login
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold mb-4">Welcome, {mockProfile.full_name}!</h1>
        
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-2">My Storefront</h2>
          <div className="bg-white rounded shadow p-4 flex flex-col md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-gray-700 text-sm mb-2">Your unique store link:</div>
              <div className="flex items-center space-x-2">
                <span className="text-blue-600 break-all">{storeUrl}</span>
                <ExternalLink className="w-4 h-4 text-gray-400" />
              </div>
            </div>
            <div className="mt-4 md:mt-0">
              <div className="bg-gray-100 text-gray-500 px-4 py-2 rounded-lg font-medium">
                Store Preview (Demo)
              </div>
            </div>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-2">My Products</h2>
          <div className="bg-white rounded shadow p-6">
            <div className="text-center py-8">
              <Store className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 mb-4">No products yet - this is where your products will appear</p>
              <div className="bg-gray-100 text-gray-500 px-6 py-2 rounded-lg font-medium inline-block">
                Add New Product (Demo)
              </div>
            </div>
          </div>
        </section>
        
        {/* Seller Tools Section */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">🛠️ Seller Tools & Features</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
              <h3 className="font-semibold text-gray-900 mb-2">🏪 Custom Storefront</h3>
              <p className="text-gray-600 text-sm mb-4">Personalized store with your branding, custom domain support, and mobile-responsive design.</p>
              <div className="text-blue-600 hover:text-blue-700 text-sm font-medium cursor-pointer">
                View Your Store →
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-500">
              <h3 className="font-semibold text-gray-900 mb-2">🔗 API Integration</h3>
              <p className="text-gray-600 text-sm mb-4">RESTful API for inventory sync, order management, and real-time analytics integration.</p>
              <div className="text-green-600 hover:text-green-700 text-sm font-medium cursor-pointer">
                API Documentation →
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow p-6 border-l-4 border-purple-500">
              <h3 className="font-semibold text-gray-900 mb-2">📊 Analytics Dashboard</h3>
              <p className="text-gray-600 text-sm mb-4">Real-time sales tracking, customer insights, and performance metrics with exportable reports.</p>
              <div className="text-purple-600 hover:text-purple-700 text-sm font-medium cursor-pointer">
                View Analytics →
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow p-6 border-l-4 border-amber-500">
              <h3 className="font-semibold text-gray-900 mb-2">💳 Payment Processing</h3>
              <p className="text-gray-600 text-sm mb-4">Integrated Stripe payments, subscription billing, and automated payout management.</p>
              <div className="text-amber-600 hover:text-amber-700 text-sm font-medium cursor-pointer">
                Configure Payments →
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow p-6 border-l-4 border-red-500">
              <h3 className="font-semibold text-gray-900 mb-2">📦 Inventory Management</h3>
              <p className="text-gray-600 text-sm mb-4">Bulk product uploads, stock tracking, automated reorder alerts, and SKU management.</p>
              <div className="text-red-600 hover:text-red-700 text-sm font-medium cursor-pointer">
                Manage Inventory →
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow p-6 border-l-4 border-indigo-500">
              <h3 className="font-semibold text-gray-900 mb-2">🎯 Marketing Tools</h3>
              <p className="text-gray-600 text-sm mb-4">Discount codes, promotional campaigns, email marketing integration, and social media tools.</p>
              <div className="text-indigo-600 hover:text-indigo-700 text-sm font-medium cursor-pointer">
                Marketing Hub →
              </div>
            </div>
          </div>
        </section>
        
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-2">Sales Analytics</h2>
          <div className="bg-white rounded shadow p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600">$0</div>
                <div className="text-sm text-gray-600">Total Earnings</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-600">0</div>
                <div className="text-sm text-gray-600">Products Listed</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-purple-600">0</div>
                <div className="text-sm text-gray-600">Total Sales</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-amber-600">0</div>
                <div className="text-sm text-gray-600">Active Orders</div>
              </div>
            </div>
            <div className="text-center py-4 border-t">
              <p className="text-gray-500">Sales charts and detailed analytics will appear here</p>
            </div>
          </div>
        </section>
        
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-2">Payouts</h2>
          <div className="bg-white rounded shadow p-6">
            <div className="text-center py-8">
              <p className="text-gray-500 mb-4">Earnings and payout status will be tracked here</p>
              <div className="bg-gray-100 text-gray-500 px-4 py-2 rounded font-medium inline-block">
                Request Payout (Demo)
              </div>
            </div>
          </div>
        </section>
        
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-2">API Integrations</h2>
          <div className="bg-white rounded shadow p-6">
            <div className="text-center py-8">
              <p className="text-gray-500 mb-4">Connect with Stripe, PayPal, and other payment providers</p>
              <div className="bg-gray-100 text-gray-500 px-4 py-2 rounded hover:bg-gray-200 transition-colors inline-block">
                Connect Stripe (Demo)
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="bg-gradient-to-r from-amber-400 to-orange-500 rounded-lg p-8 text-center text-white">
          <h2 className="text-2xl font-bold mb-4">Ready to Start Selling?</h2>
          <p className="text-lg mb-6 opacity-90">
            Create your account to unlock all these powerful seller tools and start building your business today!
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/signup"
              className="bg-white text-amber-600 px-8 py-3 rounded-lg text-lg hover:bg-gray-100 transition-colors font-semibold flex items-center justify-center"
            >
              <User className="w-5 h-5 mr-2" />
              Sign Up Free
            </Link>
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('open-auth-modal', { detail: { mode: 'login' } }))}
              className="border-2 border-white text-white px-8 py-3 rounded-lg text-lg hover:bg-white hover:text-amber-600 transition-colors font-semibold flex items-center justify-center"
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

export default DashboardPreview;
