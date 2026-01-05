import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContextMultiRole';
import { supabase } from '../lib/supabase';
import { Package, Truck, CheckCircle, AlertTriangle, RefreshCw, Mail, DollarSign } from 'lucide-react';

interface FulfillmentStats {
  totalOrders: number;
  processingOrders: number;
  shippedOrders: number;
  deliveredOrders: number;
  failedOrders: number;
}

interface RecentOrder {
  id: string;
  order_id: string;
  status: string;
  created_at: string;
  tracking_number?: string;
  carrier?: string;
}

const AutomatedFulfillmentDashboard: React.FC = () => {
  const { user, profile } = useAuth();
  const [stats, setStats] = useState<FulfillmentStats>({
    totalOrders: 0,
    processingOrders: 0,
    shippedOrders: 0,
    deliveredOrders: 0,
    failedOrders: 0
  });
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'orders' | 'vendors' | 'emails'>('overview');

  useEffect(() => {
    if (user) {
      loadFulfillmentData();
    }
  }, [user]);

  const loadFulfillmentData = async () => {
    try {
      setLoading(true);

      // Get fulfillment statistics
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('id, status, fulfillment_status, created_at')
        .order('created_at', { ascending: false })
        .limit(100);

      if (ordersError) throw ordersError;

      // Calculate stats
      const stats = {
        totalOrders: ordersData?.length || 0,
        processingOrders: ordersData?.filter(o => o.fulfillment_status === 'processing').length || 0,
        shippedOrders: ordersData?.filter(o => o.fulfillment_status === 'shipped').length || 0,
        deliveredOrders: ordersData?.filter(o => o.fulfillment_status === 'delivered').length || 0,
        failedOrders: ordersData?.filter(o => o.fulfillment_status === 'cancelled').length || 0
      };

      setStats(stats);

      // Get recent vendor orders
      const { data: vendorOrders, error: vendorError } = await supabase
        .from('vendor_orders')
        .select(`
          id,
          order_id,
          status,
          created_at,
          shipping_labels (
            tracking_number,
            carrier
          )
        `)
        .order('created_at', { ascending: false })
        .limit(20);

      if (vendorError) throw vendorError;

      setRecentOrders(vendorOrders?.map(order => ({
        id: order.id,
        order_id: order.order_id,
        status: order.status,
        created_at: order.created_at,
        tracking_number: order.shipping_labels?.[0]?.tracking_number,
        carrier: order.shipping_labels?.[0]?.carrier
      })) || []);

    } catch (error) {
      console.error('Error loading fulfillment data:', error);
    } finally {
      setLoading(false);
    }
  };

  const triggerManualFulfillment = async (orderId: string) => {
    try {
      const response = await fetch('/api/automated-order-fulfillment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ orderId }),
      });

      if (response.ok) {
        alert('Fulfillment triggered successfully!');
        loadFulfillmentData();
      } else {
        alert('Failed to trigger fulfillment');
      }
    } catch (error) {
      console.error('Error triggering fulfillment:', error);
      alert('Error triggering fulfillment');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ordered': return 'text-blue-600 bg-blue-100';
      case 'processing': return 'text-yellow-600 bg-yellow-100';
      case 'shipped': return 'text-purple-600 bg-purple-100';
      case 'delivered': return 'text-green-600 bg-green-100';
      case 'cancelled': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ordered': return <Package className="w-4 h-4" />;
      case 'processing': return <RefreshCw className="w-4 h-4" />;
      case 'shipped': return <Truck className="w-4 h-4" />;
      case 'delivered': return <CheckCircle className="w-4 h-4" />;
      case 'cancelled': return <AlertTriangle className="w-4 h-4" />;
      default: return <Package className="w-4 h-4" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Loading fulfillment dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Automated Fulfillment Dashboard</h1>
        <p className="text-gray-600">Monitor and manage your automated order processing system</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Orders</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalOrders}</p>
            </div>
            <Package className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Processing</p>
              <p className="text-2xl font-bold text-yellow-600">{stats.processingOrders}</p>
            </div>
            <RefreshCw className="w-8 h-8 text-yellow-600" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Shipped</p>
              <p className="text-2xl font-bold text-purple-600">{stats.shippedOrders}</p>
            </div>
            <Truck className="w-8 h-8 text-purple-600" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Delivered</p>
              <p className="text-2xl font-bold text-green-600">{stats.deliveredOrders}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Failed</p>
              <p className="text-2xl font-bold text-red-600">{stats.failedOrders}</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-red-600" />
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-gray-200 mb-8">
        <nav className="flex space-x-6 overflow-x-auto">
          {[
            { id: 'overview', label: 'Overview', icon: Package },
            { id: 'orders', label: 'Recent Orders', icon: Truck },
            { id: 'vendors', label: 'Vendor Orders', icon: RefreshCw },
            { id: 'emails', label: 'Email Notifications', icon: Mail }
          ].map((tab) => {
            const IconComponent = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center space-x-2 py-4 px-2 border-b-2 font-medium text-sm whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-orange-500 text-orange-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <IconComponent className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <h3 className="text-lg font-semibold mb-4">System Status</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Automated Fulfillment</span>
                  <span className="text-green-600 font-medium">Active</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Email Notifications</span>
                  <span className="text-green-600 font-medium">Active</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Vendor Integrations</span>
                  <span className="text-yellow-600 font-medium">Configuring</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Shipping Labels</span>
                  <span className="text-green-600 font-medium">Active</span>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
              <div className="space-y-3">
                <button
                  onClick={loadFulfillmentData}
                  className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Refresh Data</span>
                </button>
                <button
                  className="w-full bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center space-x-2"
                >
                  <DollarSign className="w-4 h-4" />
                  <span>View Revenue</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'orders' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold">Recent Orders</h3>
          </div>
          <div className="divide-y divide-gray-200">
            {recentOrders.map((order) => (
              <div key={order.id} className="p-6 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">Order #{order.order_id.slice(-8)}</p>
                    <p className="text-sm text-gray-600">
                      {new Date(order.created_at).toLocaleDateString()}
                    </p>
                    {order.tracking_number && (
                      <p className="text-sm text-gray-600">
                        Tracking: {order.tracking_number} ({order.carrier})
                      </p>
                    )}
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                      {getStatusIcon(order.status)}
                      <span className="ml-1 capitalize">{order.status}</span>
                    </span>
                    {order.status === 'ordered' && (
                      <button
                        onClick={() => triggerManualFulfillment(order.order_id)}
                        className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                      >
                        Process
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'vendors' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold mb-4">Vendor Integrations</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
              <div>
                <h4 className="font-medium">AliExpress</h4>
                <p className="text-sm text-gray-600">Dropshipping integration</p>
              </div>
              <span className="text-yellow-600 font-medium">Coming Soon</span>
            </div>
            <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
              <div>
                <h4 className="font-medium">Oberlo</h4>
                <p className="text-sm text-gray-600">Shopify dropshipping</p>
              </div>
              <span className="text-yellow-600 font-medium">Coming Soon</span>
            </div>
            <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
              <div>
                <h4 className="font-medium">SaleHoo</h4>
                <p className="text-sm text-gray-600">Wholesale suppliers</p>
              </div>
              <span className="text-yellow-600 font-medium">Coming Soon</span>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'emails' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold mb-4">Email Notifications</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Order Confirmations</span>
              <span className="text-green-600 font-medium">Active</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Shipping Updates</span>
              <span className="text-green-600 font-medium">Active</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Delivery Confirmations</span>
              <span className="text-green-600 font-medium">Active</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Commission Payments</span>
              <span className="text-green-600 font-medium">Active</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AutomatedFulfillmentDashboard;
