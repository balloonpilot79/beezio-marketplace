import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContextMultiRole';
import { supabase } from '../lib/supabase';
import { Package, Clock, CheckCircle, XCircle, Eye } from 'lucide-react';
import { Link } from 'react-router-dom';

interface OrderItem {
  id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  products: {
    title: string;
    image_url: string;
  };
}

interface Order {
  id: string;
  total_amount: number;
  currency: string;
  status: string;
  payment_status: string;
  billing_name: string;
  created_at: string;
  order_items: OrderItem[];
}

const OrderManagement: React.FC = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchOrders();
    }
  }, [user]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (
            *,
            products (
              title,
              image_url
            )
          )
        `)
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch orders');
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string, paymentStatus: string) => {
    if (paymentStatus === 'paid' && status === 'completed') {
      return <CheckCircle className="w-5 h-5 text-green-500" />;
    } else if (paymentStatus === 'failed' || status === 'cancelled') {
      return <XCircle className="w-5 h-5 text-red-500" />;
    } else {
      return <Clock className="w-5 h-5 text-yellow-500" />;
    }
  };

  const getStatusText = (status: string, paymentStatus: string) => {
    if (paymentStatus === 'paid' && status === 'completed') {
      return 'Completed';
    } else if (paymentStatus === 'failed') {
      return 'Payment Failed';
    } else if (status === 'cancelled') {
      return 'Cancelled';
    } else if (paymentStatus === 'pending') {
      return 'Processing Payment';
    } else {
      return 'Pending';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg shadow p-6">
              <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
              <div className="space-y-3">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-red-800 mb-2">Error Loading Orders</h3>
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={fetchOrders}
            className="btn-primary"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center mb-8">
        <Package className="w-8 h-8 text-primary-600 mr-3" />
        <h1 className="text-3xl font-display font-bold text-gray-900">My Orders</h1>
      </div>

      {orders.length === 0 ? (
        <div className="bg-white rounded-lg shadow-lg p-12 text-center">
          <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No Orders Yet</h3>
          <p className="text-gray-600 mb-6">
            You haven't placed any orders yet. Start shopping to see your orders here.
          </p>
          <Link to="/products" className="btn-primary">
            Browse Products
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {orders.map((order) => (
            <div key={order.id} className="bg-white rounded-lg shadow-lg overflow-hidden">
              {/* Order Header */}
              <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center space-x-3 mb-2">
                      {getStatusIcon(order.status, order.payment_status)}
                      <span className="font-semibold text-gray-900">
                        Order #{order.id.slice(-8)}
                      </span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        order.payment_status === 'paid' && order.status === 'completed'
                          ? 'bg-green-100 text-green-800'
                          : order.payment_status === 'failed'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {getStatusText(order.status, order.payment_status)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">
                      Placed on {formatDate(order.created_at)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-gray-900">
                      ${order.total_amount.toFixed(2)}
                    </p>
                    <p className="text-sm text-gray-600">{order.currency.toUpperCase()}</p>
                  </div>
                </div>
              </div>

              {/* Order Items */}
              <div className="p-6">
                <div className="space-y-4">
                  {order.order_items?.map((item) => (
                    <div key={item.id} className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
                      <img
                        src={item.products.image_url || '/placeholder-product.jpg'}
                        alt={item.products.title}
                        className="w-16 h-16 object-cover rounded-lg"
                      />
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900">{item.products.title}</h4>
                        <p className="text-sm text-gray-600">Quantity: {item.quantity}</p>
                        <p className="text-sm text-gray-600">
                          ${item.unit_price.toFixed(2)} each
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-gray-900">
                          ${item.total_price.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Order Actions */}
                <div className="mt-6 pt-6 border-t border-gray-200 flex justify-between items-center">
                  <div className="text-sm text-gray-600">
                    {order.billing_name && (
                      <p>Billing: {order.billing_name}</p>
                    )}
                  </div>
                  <div className="flex space-x-3">
                    <button className="flex items-center space-x-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
                      <Eye className="w-4 h-4" />
                      <span>View Details</span>
                    </button>
                    {order.payment_status === 'paid' && (
                      <button className="flex items-center space-x-2 px-4 py-2 bg-primary-100 hover:bg-primary-200 text-primary-700 rounded-lg transition-colors">
                        <Package className="w-4 h-4" />
                        <span>Track Order</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default OrderManagement;
