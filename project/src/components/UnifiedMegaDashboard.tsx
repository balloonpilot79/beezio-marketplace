import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContextMultiRole';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import StoreCustomization from './StoreCustomization';
import UniversalIntegrationsPage from './UniversalIntegrationsPage';
import StripeSellerDashboard from './StripeSellerDashboard';
import StripeAffiliateDashboard from './StripeAffiliateDashboard';

import {
  LayoutDashboard, Package, ShoppingCart, BarChart3, DollarSign, 
  Users, Link, QrCode, Store, Zap, CreditCard,
  Award, MessageSquare,
  Plus, Edit, Trash2, Copy,
  Clock
} from 'lucide-react';

interface Product {
  id: string;
  title: string;
  description: string;
  price: number;
  affiliate_commission_rate: number;
  affiliate_commission_type: 'percentage' | 'fixed';
  images: string[];
  video_url: string;
  sales_count: number;
  total_revenue: number;
  category?: string;
  stock_quantity?: number;
}

interface Order {
  id: string;
  customer_name: string;
  customer_email: string;
  product_title: string;
  amount: number;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  created_at: string;
  tracking_number?: string;
}

interface Commission {
  id: string;
  product_title: string;
  commission_amount: number;
  sale_date: string;
  status: 'pending' | 'paid';
  customer_email: string;
}

interface Stats {
  total_sales: number;
  total_revenue: number;
  total_commissions_paid: number;
  total_earnings: number;
  pending_earnings: number;
  active_subscriptions: number;
  pending_orders: number;
  conversion_rate: number;
  active_links: number;
}

const UnifiedMegaDashboard: React.FC = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  
  // Debug log to verify component is loading
  console.log('🎉 UnifiedMegaDashboard loaded! User:', user?.email, 'Role:', profile?.role);
  
  // All state management
  const [activeTab, setActiveTab] = useState<'overview' | 'products' | 'orders' | 'earnings' | 'affiliate' | 'analytics' | 'store' | 'integrations' | 'payments'>('overview');
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [stats, setStats] = useState<Stats>({
    total_sales: 0,
    total_revenue: 0,
    total_commissions_paid: 0,
    total_earnings: 0,
    pending_earnings: 0,
    active_subscriptions: 0,
    pending_orders: 0,
    conversion_rate: 0,
    active_links: 0
  });
  const [loading, setLoading] = useState(false);

  // User role checks
  const isSeller = profile?.role === 'seller';
  const isAffiliate = profile?.role === 'affiliate' || profile?.role === 'fundraiser';
  const isBuyer = profile?.role === 'buyer';
  const canSellProducts = isSeller;
  const canEarnCommissions = isAffiliate || isSeller;

  useEffect(() => {
    if (user) {
      fetchAllData();
    }
  }, [user]);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchProducts(),
        fetchOrders(),
        fetchCommissions(),
        fetchStats()
      ]);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('seller_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
      setProducts([]);
    }
  };

  const fetchOrders = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (
            *,
            products (title)
          )
        `)
        .eq('seller_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      
      const formattedOrders = data?.map((order: any) => ({
        id: order.id,
        customer_name: order.customer_name || 'Unknown',
        customer_email: order.customer_email || '',
        product_title: order.order_items?.[0]?.products?.title || 'Product',
        amount: order.total_amount || 0,
        status: order.status,
        created_at: order.created_at,
        tracking_number: order.tracking_number
      })) || [];

      setOrders(formattedOrders);
    } catch (error) {
      console.error('Error fetching orders:', error);
      setOrders([]);
    }
  };

  const fetchCommissions = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('commissions')
        .select(`
          *,
          products (title)
        `)
        .eq('affiliate_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      
      const formattedCommissions = data?.map((comm: any) => ({
        id: comm.id,
        product_title: comm.products?.title || 'Product',
        commission_amount: comm.commission_amount || 0,
        sale_date: comm.created_at,
        status: comm.status,
        customer_email: comm.customer_email || ''
      })) || [];

      setCommissions(formattedCommissions);
    } catch (error) {
      console.error('Error fetching commissions:', error);
      setCommissions([]);
    }
  };

  const fetchStats = async () => {
    if (!user) return;
    
    try {
      // Fetch seller stats
      const { data: salesData } = await supabase
        .from('orders')
        .select('total_amount, status')
        .eq('seller_id', user.id);

      // Fetch affiliate stats
      const { data: commissionData } = await supabase
        .from('commissions')
        .select('commission_amount, status')
        .eq('affiliate_id', user.id);

      const totalRevenue = salesData?.reduce((sum, order) => sum + (order.total_amount || 0), 0) || 0;
      const totalEarnings = commissionData?.reduce((sum, comm) => sum + (comm.commission_amount || 0), 0) || 0;
      const pendingEarnings = commissionData?.filter(c => c.status === 'pending').reduce((sum, comm) => sum + (comm.commission_amount || 0), 0) || 0;

      setStats({
        total_sales: salesData?.length || 0,
        total_revenue: totalRevenue,
        total_commissions_paid: 0,
        total_earnings: totalEarnings,
        pending_earnings: pendingEarnings,
        active_subscriptions: 0,
        pending_orders: salesData?.filter(o => o.status === 'pending').length || 0,
        conversion_rate: 0,
        active_links: 0
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const handleAddProduct = () => {
    navigate('/dashboard/products/add');
  };

  const handleEditProduct = (productId: string) => {
    navigate(`/dashboard/products/edit/${productId}`);
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return;
    
    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', productId);

      if (error) throw error;
      
      setProducts(products.filter(p => p.id !== productId));
      alert('Product deleted successfully!');
    } catch (error) {
      console.error('Error deleting product:', error);
      alert('Failed to delete product');
    }
  };

  const generateAffiliateLink = (productId: string) => {
    return `${window.location.origin}/product/${productId}?ref=${user?.id}`;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  // Tab configuration
  const tabs = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard, show: true },
    { id: 'products', label: 'Products', icon: Package, show: canSellProducts },
    { id: 'orders', label: 'Orders', icon: ShoppingCart, show: canSellProducts || isBuyer },
    { id: 'earnings', label: 'Earnings', icon: DollarSign, show: canEarnCommissions },
    { id: 'affiliate', label: 'Affiliate Tools', icon: Link, show: canEarnCommissions },
    { id: 'analytics', label: 'Analytics', icon: BarChart3, show: true },
    { id: 'store', label: 'Store Settings', icon: Store, show: canSellProducts || isAffiliate },
    { id: 'integrations', label: 'Integrations', icon: Zap, show: true },
    { id: 'payments', label: 'Payments', icon: CreditCard, show: true }
  ].filter(tab => tab.show);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-orange-50/30 to-purple-50/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="bg-gradient-to-r from-orange-500 to-purple-600 rounded-2xl shadow-2xl p-8 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-4xl font-bold mb-2">
                  Welcome back, {profile?.full_name || user?.email?.split('@')[0] || 'User'}! 👋
                </h1>
                <p className="text-orange-100 text-lg">
                  {isSeller && 'Manage your products, orders, and grow your business'}
                  {isAffiliate && 'Track your commissions and promote products'}
                  {isBuyer && 'View your orders and track purchases'}
                </p>
                <div className="mt-4 flex items-center gap-4">
                  <span className="inline-flex items-center px-4 py-2 rounded-full text-sm font-medium bg-white/20 backdrop-blur-sm">
                    {profile?.role === 'fundraiser' ? '💝 Fundraiser' : `${profile?.role?.charAt(0).toUpperCase()}${profile?.role?.slice(1)}`}
                  </span>
                  <span className="text-sm text-orange-100">
                    Member since {new Date(user?.created_at || Date.now()).toLocaleDateString()}
                  </span>
                </div>
              </div>
              <div className="hidden lg:block">
                <div className="w-32 h-32 bg-white/10 rounded-full flex items-center justify-center backdrop-blur-sm">
                  <Users className="w-16 h-16 text-white/80" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {canSellProducts && (
            <>
              <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-blue-500">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Sales</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">{stats.total_sales}</p>
                  </div>
                  <div className="bg-blue-100 rounded-full p-3">
                    <ShoppingCart className="w-8 h-8 text-blue-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-green-500">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">${stats.total_revenue.toFixed(2)}</p>
                  </div>
                  <div className="bg-green-100 rounded-full p-3">
                    <DollarSign className="w-8 h-8 text-green-600" />
                  </div>
                </div>
              </div>
            </>
          )}

          {canEarnCommissions && (
            <>
              <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-purple-500">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Earnings</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">${stats.total_earnings.toFixed(2)}</p>
                  </div>
                  <div className="bg-purple-100 rounded-full p-3">
                    <Award className="w-8 h-8 text-purple-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-orange-500">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Pending Earnings</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">${stats.pending_earnings.toFixed(2)}</p>
                  </div>
                  <div className="bg-orange-100 rounded-full p-3">
                    <Clock className="w-8 h-8 text-orange-600" />
                  </div>
                </div>
              </div>
            </>
          )}

          {isBuyer && (
            <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-indigo-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">My Orders</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">{orders.length}</p>
                </div>
                <div className="bg-indigo-100 rounded-full p-3">
                  <Package className="w-8 h-8 text-indigo-600" />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Tabs Navigation */}
        <div className="bg-white rounded-xl shadow-lg mb-8 overflow-hidden">
          <div className="border-b border-gray-200 overflow-x-auto">
            <nav className="flex gap-2 px-6">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex items-center gap-2 px-6 py-4 border-b-4 font-semibold text-sm transition-all whitespace-nowrap ${
                      activeTab === tab.id
                        ? 'border-orange-500 text-orange-700 bg-orange-50'
                        : 'border-transparent text-gray-500 hover:text-orange-700 hover:bg-orange-50/50'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="p-8">
            {/* OVERVIEW TAB */}
            {activeTab === 'overview' && (
              <div className="space-y-8">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-6">Dashboard Overview</h2>
                  
                  {/* Quick Actions */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    {canSellProducts && (
                      <button
                        onClick={handleAddProduct}
                        className="bg-gradient-to-r from-orange-500 to-amber-500 text-white p-6 rounded-xl shadow-lg hover:shadow-xl transition-all hover:scale-105"
                      >
                        <Plus className="w-8 h-8 mb-2" />
                        <h3 className="text-lg font-bold">Add New Product</h3>
                        <p className="text-sm text-orange-100 mt-1">List a new product for sale</p>
                      </button>
                    )}
                    
                    <button
                      onClick={() => setActiveTab('store')}
                      className="bg-gradient-to-r from-purple-500 to-pink-500 text-white p-6 rounded-xl shadow-lg hover:shadow-xl transition-all hover:scale-105"
                    >
                      <Store className="w-8 h-8 mb-2" />
                      <h3 className="text-lg font-bold">Customize Store</h3>
                      <p className="text-sm text-purple-100 mt-1">Set up your custom domain</p>
                    </button>

                    <button
                      onClick={() => setActiveTab('analytics')}
                      className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white p-6 rounded-xl shadow-lg hover:shadow-xl transition-all hover:scale-105"
                    >
                      <BarChart3 className="w-8 h-8 mb-2" />
                      <h3 className="text-lg font-bold">View Analytics</h3>
                      <p className="text-sm text-blue-100 mt-1">Track your performance</p>
                    </button>
                  </div>

                  {/* Recent Activity */}
                  {canSellProducts && orders.length > 0 && (
                    <div className="bg-gray-50 rounded-xl p-6">
                      <h3 className="text-xl font-bold text-gray-900 mb-4">Recent Orders</h3>
                      <div className="space-y-3">
                        {orders.slice(0, 5).map((order) => (
                          <div key={order.id} className="bg-white rounded-lg p-4 flex items-center justify-between">
                            <div>
                              <p className="font-semibold text-gray-900">{order.product_title}</p>
                              <p className="text-sm text-gray-600">{order.customer_email}</p>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-gray-900">${order.amount.toFixed(2)}</p>
                              <span className={`text-xs px-2 py-1 rounded-full ${
                                order.status === 'delivered' ? 'bg-green-100 text-green-800' :
                                order.status === 'shipped' ? 'bg-blue-100 text-blue-800' :
                                order.status === 'processing' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {order.status}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* PRODUCTS TAB */}
            {activeTab === 'products' && canSellProducts && (
              <div className="space-y-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-gray-900">My Products</h2>
                  <button
                    onClick={handleAddProduct}
                    className="flex items-center gap-2 bg-orange-500 text-white px-6 py-3 rounded-xl font-semibold hover:bg-orange-600 transition-all shadow-lg"
                  >
                    <Plus className="w-5 h-5" />
                    Add Product
                  </button>
                </div>

                {products.length === 0 ? (
                  <div className="text-center py-12 bg-gray-50 rounded-xl">
                    <Package className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">No products yet</h3>
                    <p className="text-gray-600 mb-6">Start selling by adding your first product</p>
                    <button
                      onClick={handleAddProduct}
                      className="bg-orange-500 text-white px-8 py-3 rounded-xl font-semibold hover:bg-orange-600"
                    >
                      Add Your First Product
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {products.map((product) => (
                      <div key={product.id} className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200">
                        {product.images?.[0] && (
                          <img 
                            src={product.images[0]} 
                            alt={product.title}
                            className="w-full h-48 object-cover"
                          />
                        )}
                        <div className="p-6">
                          <h3 className="text-lg font-bold text-gray-900 mb-2">{product.title}</h3>
                          <p className="text-gray-600 text-sm mb-4 line-clamp-2">{product.description}</p>
                          <div className="flex items-center justify-between mb-4">
                            <span className="text-2xl font-bold text-gray-900">${product.price}</span>
                            <span className="text-sm text-gray-600">{product.sales_count || 0} sales</span>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleEditProduct(product.id)}
                              className="flex-1 bg-blue-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-600 flex items-center justify-center gap-2"
                            >
                              <Edit className="w-4 h-4" />
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteProduct(product.id)}
                              className="bg-red-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-red-600"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ORDERS TAB */}
            {activeTab === 'orders' && (canSellProducts || isBuyer) && (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">
                  {isBuyer ? 'My Orders' : 'Customer Orders'}
                </h2>

                {orders.length === 0 ? (
                  <div className="text-center py-12 bg-gray-50 rounded-xl">
                    <ShoppingCart className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">No orders yet</h3>
                    <p className="text-gray-600">Orders will appear here once you make sales</p>
                  </div>
                ) : (
                  <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {orders.map((order) => (
                          <tr key={order.id}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              #{order.id.slice(0, 8)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {order.customer_name}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-900">
                              {order.product_title}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                              ${order.amount.toFixed(2)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                order.status === 'delivered' ? 'bg-green-100 text-green-800' :
                                order.status === 'shipped' ? 'bg-blue-100 text-blue-800' :
                                order.status === 'processing' ? 'bg-yellow-100 text-yellow-800' :
                                order.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {order.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                              {new Date(order.created_at).toLocaleDateString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* EARNINGS TAB */}
            {activeTab === 'earnings' && canEarnCommissions && (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Earnings & Commissions</h2>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                  <div className="bg-gradient-to-br from-green-500 to-emerald-600 text-white rounded-xl p-6 shadow-lg">
                    <p className="text-green-100 text-sm font-medium mb-2">Total Earnings</p>
                    <p className="text-4xl font-bold">${stats.total_earnings.toFixed(2)}</p>
                  </div>
                  <div className="bg-gradient-to-br from-orange-500 to-amber-600 text-white rounded-xl p-6 shadow-lg">
                    <p className="text-orange-100 text-sm font-medium mb-2">Pending</p>
                    <p className="text-4xl font-bold">${stats.pending_earnings.toFixed(2)}</p>
                  </div>
                  <div className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-xl p-6 shadow-lg">
                    <p className="text-blue-100 text-sm font-medium mb-2">Total Sales</p>
                    <p className="text-4xl font-bold">{commissions.length}</p>
                  </div>
                </div>

                {commissions.length === 0 ? (
                  <div className="text-center py-12 bg-gray-50 rounded-xl">
                    <DollarSign className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">No commissions yet</h3>
                    <p className="text-gray-600">Start promoting products to earn commissions</p>
                  </div>
                ) : (
                  <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Commission</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {commissions.map((commission) => (
                          <tr key={commission.id}>
                            <td className="px-6 py-4 text-sm text-gray-900">{commission.product_title}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-green-600">
                              ${commission.commission_amount.toFixed(2)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                commission.status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                              }`}>
                                {commission.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                              {new Date(commission.sale_date).toLocaleDateString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* AFFILIATE TOOLS TAB */}
            {activeTab === 'affiliate' && canEarnCommissions && (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Affiliate Tools</h2>
                
                <div className="bg-gradient-to-r from-purple-100 to-pink-100 rounded-xl p-6 mb-8">
                  <h3 className="text-xl font-bold text-gray-900 mb-4">Your Affiliate Links</h3>
                  <p className="text-gray-700 mb-4">Share products and earn commissions on every sale!</p>
                  
                  {products.length > 0 && (
                    <div className="space-y-3">
                      {products.slice(0, 3).map((product) => {
                        const link = generateAffiliateLink(product.id);
                        return (
                          <div key={product.id} className="bg-white rounded-lg p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <p className="font-semibold text-gray-900">{product.title}</p>
                                <p className="text-sm text-gray-600 font-mono">{link}</p>
                              </div>
                              <button
                                onClick={() => copyToClipboard(link)}
                                className="ml-4 bg-purple-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-purple-600 flex items-center gap-2"
                              >
                                <Copy className="w-4 h-4" />
                                Copy
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white rounded-xl shadow-lg p-6">
                    <QrCode className="w-12 h-12 text-purple-600 mb-4" />
                    <h3 className="text-xl font-bold text-gray-900 mb-2">QR Codes</h3>
                    <p className="text-gray-600 mb-4">Generate QR codes for your affiliate links</p>
                    <button className="bg-purple-500 text-white px-6 py-2 rounded-lg font-semibold hover:bg-purple-600">
                      Generate QR Code
                    </button>
                  </div>

                  <div className="bg-white rounded-xl shadow-lg p-6">
                    <MessageSquare className="w-12 h-12 text-blue-600 mb-4" />
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Marketing Materials</h3>
                    <p className="text-gray-600 mb-4">Download banners and promotional content</p>
                    <button className="bg-blue-500 text-white px-6 py-2 rounded-lg font-semibold hover:bg-blue-600">
                      View Materials
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ANALYTICS TAB */}
            {activeTab === 'analytics' && (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Analytics & Insights</h2>
                <div className="bg-gray-50 rounded-xl p-8 text-center">
                  <BarChart3 className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">Analytics Dashboard</h3>
                  <p className="text-gray-600">Detailed analytics and insights coming soon</p>
                </div>
              </div>
            )}

            {/* STORE SETTINGS TAB */}
            {activeTab === 'store' && (canSellProducts || isAffiliate) && user && (
              <div>
                <StoreCustomization 
                  userId={user.id} 
                  role={profile?.role === 'affiliate' || profile?.role === 'fundraiser' ? 'affiliate' : 'seller'} 
                />
              </div>
            )}

            {/* INTEGRATIONS TAB */}
            {activeTab === 'integrations' && (
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Integrations</h2>
                <UniversalIntegrationsPage />
              </div>
            )}

            {/* PAYMENTS TAB */}
            {activeTab === 'payments' && (
              <div className="space-y-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Payment Settings</h2>
                
                {canSellProducts && (
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-4">Seller Payments</h3>
                    <StripeSellerDashboard />
                  </div>
                )}

                {canEarnCommissions && (
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-4">Affiliate Payments</h3>
                    <StripeAffiliateDashboard />
                  </div>
                )}

                {isBuyer && (
                  <div className="bg-white rounded-xl shadow-lg p-6">
                    <h3 className="text-xl font-bold text-gray-900 mb-4">Payment Methods</h3>
                    <p className="text-gray-600">Manage your saved payment methods</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UnifiedMegaDashboard;
