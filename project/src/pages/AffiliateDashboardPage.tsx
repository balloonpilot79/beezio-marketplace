import React from 'react';
import { Link } from 'react-router-dom';
import { 
  TrendingUp, 
  DollarSign, 
  Eye, 
  ShoppingCart, 
  Star,
  Copy,
  ExternalLink,
  Plus
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContextMultiRole';
import { useAffiliate } from '../contexts/AffiliateContext';
import { products } from '../data/sampleProducts';
import ReferralDashboard from '../components/ReferralDashboard';
import ReferredAffiliatesList from '../components/ReferredAffiliatesList';

const AffiliateDashboardPage: React.FC = () => {
  const { user, profile } = useAuth();
  const { selectedProducts, affiliateStats, generateAffiliateLink } = useAffiliate();

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Please Log In</h2>
          <p className="text-gray-600 mb-6">You need to be logged in to view your affiliate dashboard.</p>
          <Link to="/" className="btn-primary">Go to Home</Link>
        </div>
      </div>
    );
  }

  const selectedProductsData = selectedProducts
    .filter(sp => sp.selected)
    .map(sp => {
      const product = products.find(p => p.id === sp.productId);
      return { ...sp, product };
    })
    .filter(item => item.product);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      // You could add a toast notification here
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Affiliate Dashboard</h1>
              <p className="mt-2 text-gray-600">
                Track your performance, share your referral link, and manage products.
              </p>
            </div>
            <Link
              to="/affiliate/products"
              className="mt-4 lg:mt-0 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Add Products
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Referral link + code */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-1">Your referral link</p>
              <div className="flex items-center gap-2">
                <code className="px-3 py-2 bg-gray-50 border border-gray-200 rounded text-sm text-gray-800 break-all">
                  {`${window.location.origin}/signup?ref=${profile?.username || profile?.id || user?.id || ''}`}
                </code>
                <button
                  onClick={() => copyToClipboard(`${window.location.origin}/signup?ref=${profile?.username || profile?.id || user?.id || ''}`)}
                  className="p-2 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                  title="Copy referral link"
                >
                  <Copy className="w-4 h-4 text-gray-700" />
                </button>
                <a
                  href={`/signup?ref=${profile?.username || profile?.id || user?.id || ''}`}
                  className="p-2 bg-blue-50 hover:bg-blue-100 rounded transition-colors"
                  title="Open signup page"
                >
                  <ExternalLink className="w-4 h-4 text-blue-600" />
                </a>
              </div>
              <p className="text-xs text-gray-600 mt-2">
                Anyone who signs up with your link or code below is tied to you for life. They earn as normal; you earn 5% from Beezio’s 15% platform fee, so Beezio nets 10%.
              </p>
              <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900">
                <div className="font-semibold mb-1">How it works:</div>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Share your link or code. When someone signs up, they’re tagged to you forever.</li>
                  <li>They sell/earn as usual. Their commissions are untouched.</li>
                  <li>Beezio pays you 5% from its 15% platform fee on every sale they generate. Beezio keeps 10%.</li>
                  <li>No double dipping: the buyer price already includes all fees, so nobody loses their share.</li>
                </ol>
              </div>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 min-w-[260px]">
              <p className="text-sm font-semibold text-gray-800 mb-1">Referral code</p>
              <div className="flex items-center gap-2">
                <span className="px-3 py-2 bg-white border border-blue-200 rounded text-base font-bold text-blue-700">
                  {(profile?.username || profile?.id || user?.id || '').toString()}
                </span>
                <button
                  onClick={() => copyToClipboard(profile?.username || profile?.id || user?.id || '')}
                  className="p-2 bg-white hover:bg-blue-100 rounded transition-colors"
                  title="Copy referral code"
                >
                  <Copy className="w-4 h-4 text-blue-700" />
                </button>
              </div>
              <p className="text-xs text-gray-600 mt-2">Share this code if you can’t share a link.</p>
            </div>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <ShoppingCart className="h-8 w-8 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Active Products</p>
                <p className="text-2xl font-bold text-gray-900">{affiliateStats.totalProducts}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Eye className="h-8 w-8 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Total Clicks</p>
                <p className="text-2xl font-bold text-gray-900">{affiliateStats.totalClicks}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <TrendingUp className="h-8 w-8 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Conversions</p>
                <p className="text-2xl font-bold text-gray-900">{affiliateStats.totalSales}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <DollarSign className="h-8 w-8 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Total Earnings</p>
                <p className="text-2xl font-bold text-gray-900">${affiliateStats.totalEarnings.toFixed(2)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Active Products */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Your Active Products</h2>
          </div>
          
          {selectedProductsData.length === 0 ? (
            <div className="p-8 text-center">
              <div className="text-gray-400 mb-4">
                <ShoppingCart className="w-12 h-12 mx-auto" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No products selected</h3>
              <p className="text-gray-600 mb-6">Start promoting products to earn commissions.</p>
              <Link
                to="/affiliate/products"
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Browse Products
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {selectedProductsData.map((item) => {
                if (!item.product) return null;
                
                const affiliateLink = generateAffiliateLink(item.product.id);
                const earnings = (item.product.price * item.product.commission_rate / 100).toFixed(2);
                
                return (
                  <div key={item.productId} className="p-6 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center space-x-4">
                      {/* Product Image */}
                      <div className="flex-shrink-0">
                        <img
                          src={item.product.image}
                          alt={item.product.name}
                          className="w-16 h-16 rounded-lg object-cover"
                        />
                      </div>
                      
                      {/* Product Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900 truncate">
                              {item.product.name}
                            </h3>
                            <p className="text-sm text-gray-500">{item.product.category}</p>
                            <div className="flex items-center mt-1">
                              <Star className="w-4 h-4 text-yellow-400 fill-current" />
                              <span className="text-sm text-gray-600 ml-1">{item.product.rating}</span>
                            </div>
                          </div>
                          
                          <div className="text-right">
                            <p className="text-lg font-bold text-gray-900">${item.product.price}</p>
                            <p className="text-sm text-green-600 font-medium">
                              {item.product.commission_rate}% commission
                            </p>
                            <p className="text-sm text-gray-500">Earn ${earnings}</p>
                          </div>
                        </div>
                        
                        {/* Stats */}
                        <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="text-gray-500">Clicks:</span>
                            <span className="ml-1 font-medium text-gray-900">{item.totalClicks || 0}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Sales:</span>
                            <span className="ml-1 font-medium text-gray-900">{item.totalSales || 0}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Earned:</span>
                            <span className="ml-1 font-medium text-green-600">${(item.totalEarnings || 0).toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Actions */}
                      <div className="flex-shrink-0 space-y-2">
                        <Link
                          to={`/product/${item.product.id}`}
                          className="block w-full bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors text-center"
                        >
                          <ExternalLink className="w-4 h-4 inline mr-1" />
                          View
                        </Link>
                        <button
                          onClick={() => copyToClipboard(affiliateLink)}
                          className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                        >
                          <Copy className="w-4 h-4 inline mr-1" />
                          Copy Link
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="mt-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg shadow-lg text-white p-6">
          <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link
              to="/affiliate/products"
              className="bg-white/10 backdrop-blur-sm rounded-lg p-4 hover:bg-white/20 transition-colors"
            >
              <Plus className="w-8 h-8 mb-2" />
              <h3 className="font-semibold">Add Products</h3>
              <p className="text-sm text-blue-100">Find new products to promote</p>
            </Link>
            <Link
              to="/affiliate/links"
              className="bg-white/10 backdrop-blur-sm rounded-lg p-4 hover:bg-white/20 transition-colors"
            >
              <Copy className="w-8 h-8 mb-2" />
              <h3 className="font-semibold">Manage Links</h3>
              <p className="text-sm text-blue-100">Organize your affiliate links</p>
            </Link>
            <Link
              to="/affiliate/earnings"
              className="bg-white/10 backdrop-blur-sm rounded-lg p-4 hover:bg-white/20 transition-colors"
            >
              <DollarSign className="w-8 h-8 mb-2" />
              <h3 className="font-semibold">View Earnings</h3>
              <p className="text-sm text-blue-100">Track your commission payments</p>
            </Link>
          </div>
        </div>

        {/* Referral Program Section */}
        <div className="mt-12">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">🚀 Referral Program</h2>
            <p className="text-gray-600">
              Grow your income by referring other affiliates. Earn 2% from all their sales!
            </p>
          </div>
          
          <div className="space-y-8">
            <ReferralDashboard />
            <ReferredAffiliatesList />
          </div>
        </div>
      </div>
    </div>
  );
};

export default AffiliateDashboardPage;
