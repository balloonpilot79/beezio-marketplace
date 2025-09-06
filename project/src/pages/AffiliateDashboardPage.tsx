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

const AffiliateDashboardPage: React.FC = () => {
  const { user } = useAuth();
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
                Track your performance and manage your affiliate products
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
      </div>
    </div>
  );
};

export default AffiliateDashboardPage;
