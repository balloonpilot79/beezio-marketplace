import React, { useState, useEffect } from 'react';
import { Package, Truck, ExternalLink, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContextMultiRole';
import { supabase } from '../lib/supabase';

interface Order {
  id: string;
  order_number: string;
  created_at: string;
  status: string;
  total_amount: number;
  customer_name: string;
  customer_email: string;
  shipping_address: any;
  items: OrderItem[];
}

interface OrderItem {
  id: string;
  product_id: string;
  product_title: string;
  quantity: number;
  price: number;
  supplier_info: {
    supplier_name?: string;
    supplier_product_id?: string;
    supplier_url?: string;
    is_dropshipped: boolean;
  } | null;
}

const OrderFulfillmentPage: React.FC = () => {
  const { user, profile } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'fulfilled'>('pending');

  useEffect(() => {
    if (profile) {
      fetchOrders();
    }
  }, [profile, filter]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('orders')
        .select(`
          *,
          order_items (
            *,
            products (
              title,
              supplier_info
            )
          )
        `)
        .eq('seller_id', profile?.id)
        .order('created_at', { ascending: false });

      if (filter === 'pending') {
        query = query.in('status', ['confirmed', 'processing']);
      } else if (filter === 'fulfilled') {
        query = query.in('status', ['shipped', 'delivered']);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Transform data
      const transformedOrders: Order[] = (data || []).map(order => ({
        id: order.id,
        order_number: order.order_number,
        created_at: order.created_at,
        status: order.status,
        total_amount: order.total_amount,
        customer_name: order.customer_name || order.shipping_address?.name || 'N/A',
        customer_email: order.customer_email || 'N/A',
        shipping_address: order.shipping_address,
        items: (order.order_items || []).map((item: any) => ({
          id: item.id,
          product_id: item.product_id,
          product_title: item.products?.title || 'Unknown Product',
          quantity: item.quantity,
          price: item.price,
          supplier_info: item.products?.supplier_info || null
        }))
      }));

      setOrders(transformedOrders);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsShipped = async (orderId: string, trackingNumber?: string) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({
          status: 'shipped',
          tracking_number: trackingNumber || null,
          shipped_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (error) throw error;

      alert('Order marked as shipped!');
      fetchOrders();
    } catch (error) {
      console.error('Error updating order:', error);
      alert('Failed to update order status');
    }
  };

  const getStatusBadge = (status: string) => {
    const badges: { [key: string]: { color: string; icon: any } } = {
      pending: { color: 'bg-yellow-100 text-yellow-800', icon: Clock },
      confirmed: { color: 'bg-blue-100 text-blue-800', icon: Package },
      processing: { color: 'bg-purple-100 text-purple-800', icon: Package },
      shipped: { color: 'bg-green-100 text-green-800', icon: Truck },
      delivered: { color: 'bg-green-100 text-green-800', icon: CheckCircle }
    };

    const badge = badges[status] || { color: 'bg-gray-100 text-gray-800', icon: AlertCircle };
    const Icon = badge.icon;

    return (
      <span className={`${badge.color} px-3 py-1 rounded-full text-sm font-medium flex items-center space-x-1 w-fit`}>
        <Icon className="w-4 h-4" />
        <span className="capitalize">{status}</span>
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Order Fulfillment</h1>
          <p className="text-gray-600 mt-2">Manage and fulfill customer orders (including dropshipped products)</p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm border p-4 mb-6">
          <div className="flex space-x-4">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg font-medium ${
                filter === 'all'
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All Orders
            </button>
            <button
              onClick={() => setFilter('pending')}
              className={`px-4 py-2 rounded-lg font-medium ${
                filter === 'pending'
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Needs Fulfillment
            </button>
            <button
              onClick={() => setFilter('fulfilled')}
              className={`px-4 py-2 rounded-lg font-medium ${
                filter === 'fulfilled'
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Fulfilled
            </button>
          </div>
        </div>

        {/* Orders List */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
            <p className="text-gray-600 mt-4">Loading orders...</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border p-12 text-center">
            <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No orders found</h3>
            <p className="text-gray-600">
              {filter === 'pending' ? 'All orders have been fulfilled!' : 'No orders yet.'}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {orders.map(order => (
              <div key={order.id} className="bg-white rounded-lg shadow-sm border overflow-hidden">
                {/* Order Header */}
                <div className="bg-gray-50 px-6 py-4 border-b flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      Order #{order.order_number}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {new Date(order.created_at).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                  <div>{getStatusBadge(order.status)}</div>
                </div>

                {/* Customer Info */}
                <div className="px-6 py-4 bg-blue-50 border-b">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2">Customer</h4>
                      <p className="text-sm text-gray-700">{order.customer_name}</p>
                      <p className="text-sm text-gray-600">{order.customer_email}</p>
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2">Shipping Address</h4>
                      {order.shipping_address ? (
                        <div className="text-sm text-gray-700">
                          <p>{order.shipping_address.street}</p>
                          <p>
                            {order.shipping_address.city}, {order.shipping_address.state}{' '}
                            {order.shipping_address.zip}
                          </p>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500">No address provided</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Order Items */}
                <div className="px-6 py-4">
                  <h4 className="font-semibold text-gray-900 mb-3">Products to Fulfill</h4>
                  <div className="space-y-3">
                    {order.items.map(item => (
                      <div
                        key={item.id}
                        className={`border rounded-lg p-4 ${
                          item.supplier_info?.is_dropshipped
                            ? 'bg-yellow-50 border-yellow-200'
                            : 'bg-gray-50'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h5 className="font-medium text-gray-900">{item.product_title}</h5>
                            <p className="text-sm text-gray-600 mt-1">
                              Quantity: {item.quantity} × ${item.price.toFixed(2)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-gray-900">
                              ${(item.quantity * item.price).toFixed(2)}
                            </p>
                          </div>
                        </div>

                        {/* Dropship Info */}
                        {item.supplier_info?.is_dropshipped && (
                          <div className="mt-3 pt-3 border-t border-yellow-300">
                            <div className="flex items-center space-x-2 mb-2">
                              <Truck className="w-4 h-4 text-yellow-600" />
                              <span className="text-sm font-semibold text-yellow-800">
                                Dropshipped Product
                              </span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                              <div>
                                <span className="text-gray-600">Supplier:</span>
                                <span className="ml-2 font-medium text-gray-900">
                                  {item.supplier_info.supplier_name || 'N/A'}
                                </span>
                              </div>
                              <div>
                                <span className="text-gray-600">Supplier SKU:</span>
                                <span className="ml-2 font-medium text-gray-900">
                                  {item.supplier_info.supplier_product_id || 'N/A'}
                                </span>
                              </div>
                            </div>
                            {item.supplier_info.supplier_url && (
                              <a
                                href={item.supplier_info.supplier_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-2 inline-flex items-center space-x-1 text-sm text-blue-600 hover:text-blue-700"
                              >
                                <ExternalLink className="w-4 h-4" />
                                <span>Order from Supplier</span>
                              </a>
                            )}
                            <div className="mt-3 p-2 bg-yellow-100 rounded text-xs text-yellow-800">
                              <strong>Action Required:</strong> Order this item from the supplier and have it
                              shipped directly to the customer address above.
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                {order.status !== 'shipped' && order.status !== 'delivered' && (
                  <div className="px-6 py-4 bg-gray-50 border-t">
                    <div className="flex items-center space-x-4">
                      <input
                        type="text"
                        placeholder="Tracking number (optional)"
                        className="flex-1 px-4 py-2 border rounded-lg"
                        id={`tracking-${order.id}`}
                      />
                      <button
                        onClick={() => {
                          const trackingInput = document.getElementById(
                            `tracking-${order.id}`
                          ) as HTMLInputElement;
                          markAsShipped(order.id, trackingInput?.value);
                        }}
                        className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
                      >
                        <Truck className="w-5 h-5" />
                        <span>Mark as Shipped</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default OrderFulfillmentPage;
