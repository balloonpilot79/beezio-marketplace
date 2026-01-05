import React from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, ArrowRight, User, TrendingUp, Target, Users } from 'lucide-react';

const AffiliateDashboardPreview: React.FC = () => {
  // Mock data for preview
  const mockProfile = {
    id: 'demo-affiliate-123',
    full_name: 'Demo Affiliate',
    role: 'affiliate' as const,
    email: 'demo@affiliate.com'
  };

  const affiliateStoreUrl = `${window.location.origin}/affiliate/${mockProfile.id}`;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Preview Notice */}
      <div className="bg-blue-500 text-white py-3">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <span className="text-2xl">👀</span>
              <div>
                <p className="font-semibold">Affiliate Dashboard Preview</p>
                <p className="text-sm text-blue-100">This is a demo view - sign up to access your real dashboard</p>
              </div>
            </div>
            <div className="flex space-x-3">
              <Link
                to="/signup"
                className="bg-white text-blue-600 px-4 py-2 rounded-lg font-semibold hover:bg-blue-50 transition-colors"
              >
                Sign Up Free
              </Link>
              <button
                onClick={() => window.dispatchEvent(new CustomEvent('open-auth-modal', { detail: { mode: 'login' } }))}
                className="border border-white text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-600 transition-colors"
              >
                Login
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold mb-4">Welcome, {mockProfile.full_name}!</h1>
        
        {/* Snapshot */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Your Snapshot</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white rounded-lg shadow p-6 text-center">
              <div className="text-3xl font-bold text-blue-600">0</div>
              <div className="text-sm text-gray-600">Total Clicks</div>
              <div className="text-xs text-blue-600 mt-1">0 this month</div>
            </div>
            
            <div className="bg-white rounded-lg shadow p-6 text-center">
              <div className="text-3xl font-bold text-green-600">$0</div>
              <div className="text-sm text-gray-600">Total Earnings</div>
              <div className="text-xs text-green-600 mt-1">+$0 this month</div>
            </div>
            
            <div className="bg-white rounded-lg shadow p-6 text-center">
              <div className="text-3xl font-bold text-purple-600">0</div>
              <div className="text-sm text-gray-600">Active Links</div>
              <div className="text-xs text-purple-600 mt-1">0 clicks this week</div>
            </div>
            
            <div className="bg-white rounded-lg shadow p-6 text-center">
              <div className="text-3xl font-bold text-amber-600">0</div>
              <div className="text-sm text-gray-600">Conversions</div>
              <div className="text-xs text-amber-600 mt-1">0% conversion rate</div>
            </div>
          </div>
        </section>

        
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-2">My Affiliate Storefront</h2>
          <div className="bg-white rounded shadow p-4 flex flex-col md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-gray-700 text-sm mb-2">Your unique affiliate store link:</div>
              <div className="flex items-center space-x-2">
                <span className="text-blue-600 break-all">{affiliateStoreUrl}</span>
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
        
        {/* Affiliate Tools Section */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">🚀 Affiliate Tools & Features</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
              <h3 className="font-semibold text-gray-900 mb-2">🏪 Personal Storefront</h3>
              <p className="text-gray-600 text-sm mb-4">Branded affiliate store with curated products, custom layouts, and your unique tracking codes.</p>
              <div className="text-blue-600 hover:text-blue-700 text-sm font-medium cursor-pointer">View Your Store →</div>
            </div>
            
            <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-500">
              <h3 className="font-semibold text-gray-900 mb-2">🔗 Smart Link Generator</h3>
              <p className="text-gray-600 text-sm mb-4">Auto-generate tracked affiliate links for any product with built-in analytics and conversion tracking.</p>
              <div className="text-green-600 hover:text-green-700 text-sm font-medium cursor-pointer">Generate Links →</div>
            </div>
            
            <div className="bg-white rounded-lg shadow p-6 border-l-4 border-purple-500">
              <h3 className="font-semibold text-gray-900 mb-2">📊 Performance Analytics</h3>
              <p className="text-gray-600 text-sm mb-4">Real-time click tracking, conversion rates, earnings reports, and top-performing product insights.</p>
              <div className="text-purple-600 hover:text-purple-700 text-sm font-medium cursor-pointer">View Analytics →</div>
            </div>
            
            <div className="bg-white rounded-lg shadow p-6 border-l-4 border-amber-500">
              <h3 className="font-semibold text-gray-900 mb-2">🎨 Creative Assets</h3>
              <p className="text-gray-600 text-sm mb-4">Banners, product images, email templates, and social media content optimized for conversions.</p>
              <div className="text-amber-600 hover:text-amber-700 text-sm font-medium cursor-pointer">Download Assets →</div>
            </div>
            
            <div className="bg-white rounded-lg shadow p-6 border-l-4 border-red-500">
              <h3 className="font-semibold text-gray-900 mb-2">📱 Mobile App</h3>
              <p className="text-gray-600 text-sm mb-4">iOS and Android apps for link generation, earnings tracking, and product discovery on-the-go.</p>
              <div className="text-red-600 hover:text-red-700 text-sm font-medium cursor-pointer">Download App →</div>
            </div>

<div className="bg-white rounded-lg shadow p-6 border-l-4 border-pink-500">
              <h3 className="font-semibold text-gray-900 mb-2">💬 Community Hub</h3>
              <p className="text-gray-600 text-sm mb-4">Connect with top affiliates, share strategies, access exclusive webinars, and get mentorship.</p>
              <div className="text-pink-600 hover:text-pink-700 text-sm font-medium cursor-pointer">Join Community →</div>
            </div>
            
            <div className="bg-white rounded-lg shadow p-6 border-l-4 border-teal-500">
              <h3 className="font-semibold text-gray-900 mb-2">🔔 Smart Notifications</h3>
              <p className="text-gray-600 text-sm mb-4">Real-time alerts for new products, commission increases, and optimization opportunities.</p>
              <div className="text-teal-600 hover:text-teal-700 text-sm font-medium cursor-pointer">Configure Alerts →</div>
            </div>
            
            <div className="bg-white rounded-lg shadow p-6 border-l-4 border-orange-500">
              <h3 className="font-semibold text-gray-900 mb-2">💰 Payment Flexibility</h3>
              <p className="text-gray-600 text-sm mb-4">Multiple payout options: PayPal, bank transfer, crypto, or reinvest earnings for bonus commissions.</p>
              <div className="text-orange-600 hover:text-orange-700 text-sm font-medium cursor-pointer">Payment Settings →</div>
            </div>
          </div>
        </section>
        
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-2">Commissions</h2>
          <div className="bg-white rounded shadow p-6">
            <div className="text-center py-8">
              <TrendingUp className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 mb-4">No commissions yet - start promoting products to see your earnings here</p>
              <div className="bg-gray-100 text-gray-500 px-4 py-2 rounded font-medium inline-block">
                Browse Products to Promote
              </div>
            </div>
          </div>
        </section>
        
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-2">Affiliate Links</h2>
          <div className="bg-white rounded shadow p-6">
            <div className="text-center py-8">
              <Target className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 mb-4">Generate and manage your affiliate links here</p>
              <div className="bg-gray-100 text-gray-500 px-4 py-2 rounded font-medium inline-block">
                Create Your First Link
              </div>
            </div>
          </div>
        </section>
        
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-2">Performance</h2>
          <div className="bg-white rounded shadow p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-600">0</div>
                <div className="text-sm text-gray-600">Total Clicks</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600">0</div>
                <div className="text-sm text-gray-600">Conversions</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-purple-600">0%</div>
                <div className="text-sm text-gray-600">Conversion Rate</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-amber-600">$0</div>
                <div className="text-sm text-gray-600">Avg. Commission</div>
              </div>
            </div>
            <div className="text-center py-4 border-t">
              <p className="text-gray-500">Detailed performance charts and insights will appear here</p>
            </div>
          </div>
        </section>
        
        <section className="mb-8">
          <div className="bg-gray-100 text-gray-500 px-4 py-2 rounded hover:bg-gray-200 transition-colors inline-block">
            Request Payout (Demo)
          </div>
        </section>

        {/* CTA Section */}
        <section className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg p-8 text-center text-white">
          <h2 className="text-2xl font-bold mb-4">Ready to Start Earning?</h2>
          <p className="text-lg mb-6 opacity-90">
            Join thousands of affiliates earning commissions by promoting quality products!
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/signup"
              className="bg-white text-blue-600 px-8 py-3 rounded-lg text-lg hover:bg-gray-100 transition-colors font-semibold flex items-center justify-center"
            >
              <User className="w-5 h-5 mr-2" />
              Sign Up Free
            </Link>
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('open-auth-modal', { detail: { mode: 'login' } }))}
              className="border-2 border-white text-white px-8 py-3 rounded-lg text-lg hover:bg-white hover:text-blue-600 transition-colors font-semibold flex items-center justify-center"
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

export default AffiliateDashboardPreview;
