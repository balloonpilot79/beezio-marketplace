import React, { useState, useEffect } from 'react';
import { Package, DollarSign, TrendingUp, RefreshCw, ExternalLink, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Vendor {
  id: string;
  name: string;
  email: string;
  description: string;
  website_url: string;
  logo_url: string;
  is_verified: boolean;
  commission_rate: number;
  created_at: string;
}

interface VendorProduct {
  id: string;
  title: string;
  price: number;
  subscription_price: number;
  is_subscription: boolean;
  subscription_interval: string;
  commission_rate: number;
  current_subscribers: number;
  max_subscribers: number;
  is_active: boolean;
  stock_quantity: number;
  vendor: {
    name: string;
    is_verified: boolean;
  };
}

const VendorManagement: React.FC = () => {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [vendorProducts, setVendorProducts] = useState<VendorProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'vendors' | 'products'>('vendors');

  useEffect(() => {
    fetchVendors();
    fetchVendorProducts();
  }, []);

  const fetchVendors = async () => {
    try {
      const { data, error } = await supabase
        .from('vendors')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setVendors(data || []);
    } catch (error) {
      console.error('Error fetching vendors:', error);
    }
  };

  const fetchVendorProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          vendors (name, is_verified)
        `)
        .not('vendor_id', 'is', null)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setVendorProducts(data || []);
    } catch (error) {
      console.error('Error fetching vendor products:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateMonthlyRevenue = (product: VendorProduct) => {
    if (!product.is_subscription) return 0;
    return product.current_subscribers * product.subscription_price;
  };

  const calculateMonthlyCommissions = (product: VendorProduct) => {
    const revenue = calculateMonthlyRevenue(product);
    return revenue * (product.commission_rate / 100);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Vendor Management</h2>
        <p className="text-gray-600">
          Manage real vendor partnerships and track product performance for maximum affiliate earnings.
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white rounded-lg shadow-md">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex">
            <button
              onClick={() => setActiveTab('vendors')}
              className={`py-4 px-6 text-sm font-medium border-b-2 ${
                activeTab === 'vendors'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-4 w-4" />
                <span>Verified Vendors ({vendors.length})</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('products')}
              className={`py-4 px-6 text-sm font-medium border-b-2 ${
                activeTab === 'products'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className="flex items-center space-x-2">
                <Package className="h-4 w-4" />
                <span>Vendor Products ({vendorProducts.length})</span>
              </div>
            </button>
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'vendors' && (
            <div className="space-y-6">
              {/* Vendor Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg p-6">
                  <div className="flex items-center">
                    <CheckCircle className="h-8 w-8 text-blue-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-blue-600">Verified Vendors</p>
                      <p className="text-2xl font-bold text-blue-900">
                        {vendors.filter(v => v.is_verified).length}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-green-50 to-green-100 rounded-lg p-6">
                  <div className="flex items-center">
                    <DollarSign className="h-8 w-8 text-green-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-green-600">Avg Commission Rate</p>
                      <p className="text-2xl font-bold text-green-900">
                        {(vendors.reduce((sum, v) => sum + v.commission_rate, 0) / vendors.length).toFixed(1)}%
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-purple-50 to-purple-100 rounded-lg p-6">
                  <div className="flex items-center">
                    <Package className="h-8 w-8 text-purple-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-purple-600">Total Products</p>
                      <p className="text-2xl font-bold text-purple-900">{vendorProducts.length}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Vendors Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {vendors.map((vendor) => (
                  <div key={vendor.id} className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow">
                    <div className="flex items-center space-x-4 mb-4">
                      <img
                        src={vendor.logo_url}
                        alt={vendor.name}
                        className="w-12 h-12 rounded-lg object-cover"
                      />
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900">{vendor.name}</h3>
                        <div className="flex items-center space-x-2">
                          {vendor.is_verified ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <AlertCircle className="h-4 w-4 text-yellow-500" />
                          )}
                          <span className={`text-sm ${vendor.is_verified ? 'text-green-600' : 'text-yellow-600'}`}>
                            {vendor.is_verified ? 'Verified' : 'Pending'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <p className="text-gray-600 text-sm mb-4 line-clamp-2">{vendor.description}</p>

                    <div className="flex items-center justify-between mb-4">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-primary-600">{vendor.commission_rate}%</p>
                        <p className="text-xs text-gray-500">Commission Rate</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-gray-900">
                          {vendorProducts.filter(p => p.vendor?.name === vendor.name).length}
                        </p>
                        <p className="text-xs text-gray-500">Products</p>
                      </div>
                    </div>

                    <div className="flex space-x-2">
                      <a
                        href={vendor.website_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 bg-primary-600 text-white text-center py-2 px-4 rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium"
                      >
                        <ExternalLink className="h-4 w-4 inline mr-2" />
                        Visit Website
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'products' && (
            <div className="space-y-6">
              {/* Product Performance Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-blue-50 rounded-lg p-6">
                  <div className="flex items-center">
                    <Package className="h-6 w-6 text-blue-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-blue-600">Total Products</p>
                      <p className="text-2xl font-bold text-blue-900">{vendorProducts.length}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-green-50 rounded-lg p-6">
                  <div className="flex items-center">
                    <RefreshCw className="h-6 w-6 text-green-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-green-600">Subscriptions</p>
                      <p className="text-2xl font-bold text-green-900">
                        {vendorProducts.filter(p => p.is_subscription).length}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-purple-50 rounded-lg p-6">
                  <div className="flex items-center">
                    <DollarSign className="h-6 w-6 text-purple-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-purple-600">Monthly Revenue</p>
                      <p className="text-2xl font-bold text-purple-900">
                        ${vendorProducts.reduce((sum, p) => sum + calculateMonthlyRevenue(p), 0).toFixed(0)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-amber-50 rounded-lg p-6">
                  <div className="flex items-center">
                    <TrendingUp className="h-6 w-6 text-amber-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-amber-600">Monthly Commissions</p>
                      <p className="text-2xl font-bold text-amber-900">
                        ${vendorProducts.reduce((sum, p) => sum + calculateMonthlyCommissions(p), 0).toFixed(0)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Products Table */}
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Product
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Vendor
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Type
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Price
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Commission
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Performance
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {vendorProducts.map((product) => (
                        <tr key={product.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{product.title}</div>
                            <div className="text-sm text-gray-500">
                              {product.is_active ? (
                                <span className="text-green-600">Active</span>
                              ) : (
                                <span className="text-red-600">Inactive</span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <span className="text-sm font-medium text-gray-900">{product.vendor?.name}</span>
                              {product.vendor?.is_verified && (
                                <CheckCircle className="ml-2 h-4 w-4 text-green-500" />
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {product.is_subscription ? (
                              <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                                {product.subscription_interval}ly subscription
                              </span>
                            ) : (
                              <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">
                                One-time
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              ${product.is_subscription ? product.subscription_price : product.price}
                              {product.is_subscription && <span className="text-gray-500">/{product.subscription_interval}</span>}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {product.commission_rate}%
                            </div>
                            <div className="text-sm text-gray-500">
                              ${((product.is_subscription ? product.subscription_price : product.price) * product.commission_rate / 100).toFixed(2)}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {product.is_subscription ? (
                              <div>
                                <div className="text-sm font-medium text-gray-900">
                                  {product.current_subscribers} subscribers
                                </div>
                                <div className="text-sm text-gray-500">
                                  ${calculateMonthlyRevenue(product).toFixed(0)}/mo
                                </div>
                              </div>
                            ) : (
                              <div>
                                <div className="text-sm font-medium text-gray-900">
                                  {product.stock_quantity} in stock
                                </div>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VendorManagement;
