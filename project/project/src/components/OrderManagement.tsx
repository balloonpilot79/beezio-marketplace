import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContextMultiRole';
import { supabase } from '../lib/supabase';
import { Package, Clock, CheckCircle, XCircle, Eye, Truck } from 'lucide-react';
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
    shipping_options?: Array<{
      estimated_days?: string;
      name?: string;
      cost?: number;
    }>;
  };
}

interface Order {
  id: string;
  order_number?: string | null;
  total_amount: number;
  currency: string;
  status: string;
  payment_status: string;
  billing_name: string;
  created_at: string;
  tracking_number?: string | null;
  tracking_url?: string | null;
  shipping_carrier?: string | null;
  order_items: OrderItem[];
}

const parseTransitDayRange = (estimated: string | undefined): { minDays: number; maxDays: number } | null => {
  const raw = String(estimated || '').trim();
  if (!raw) return null;
  const matches = raw.match(/\d+/g);
  if (!matches || matches.length === 0) return null;
  const numbers = matches
    .map((value) => Number.parseInt(value, 10))
    .filter((value) => Number.isFinite(value) && value > 0);
  if (numbers.length === 0) return null;
  if (numbers.length === 1) {
    return { minDays: numbers[0], maxDays: numbers[0] };
  }
  const [first, second] = numbers;
  return { minDays: Math.min(first, second), maxDays: Math.max(first, second) };
};

const formatEstimatedArrival = (orderDate: string, estimated: string | undefined): string | null => {
  const range = parseTransitDayRange(estimated);
  if (!range) return null;
  const base = new Date(orderDate);
  if (Number.isNaN(base.getTime())) return null;

  const addDays = (date: Date, days: number) => {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
  };

  const minDate = addDays(base, range.minDays);
  const maxDate = addDays(base, range.maxDays);
  const fmt = (date: Date) =>
    date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

  if (range.minDays === range.maxDays) {
    return fmt(minDate);
  }

  return `${fmt(minDate)} - ${fmt(maxDate)}`;
};

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
              image_url,
              shipping_options
            )
          )
        `)
        .or(`buyer_id.eq.${String(user?.id || '').trim()},user_id.eq.${String(user?.id || '').trim()}`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const orderRows = (data || []) as any[];
      const orderIds = orderRows.map((row) => String(row?.id || '').trim()).filter(Boolean);
      const cjMetaByOrderId: Record<string, { trackingNumber?: string; trackingUrl?: string; carrier?: string }> = {};

      if (orderIds.length > 0) {
        const { data: cjRows } = await supabase
          .from('cj_orders')
          .select('beezio_order_id,cj_tracking_number,cj_tracking_url,cj_logistic_name')
          .in('beezio_order_id', orderIds);

        (cjRows || []).forEach((row: any) => {
          const key = String(row?.beezio_order_id || '').trim();
          if (!key) return;
          cjMetaByOrderId[key] = {
            trackingNumber: String(row?.cj_tracking_number || '').trim() || undefined,
            trackingUrl: String(row?.cj_tracking_url || '').trim() || undefined,
            carrier: String(row?.cj_logistic_name || '').trim() || undefined,
          };
        });
      }

      const normalizedOrders: Order[] = orderRows.map((row) => {
        const meta = cjMetaByOrderId[String(row?.id)] || {};
        return {
          ...row,
          tracking_number: row?.tracking_number || meta.trackingNumber || null,
          tracking_url: row?.tracking_url || meta.trackingUrl || null,
          shipping_carrier: meta.carrier || null,
        } as Order;
      });

      setOrders(normalizedOrders);
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
                        Order #{order.order_number || order.id.slice(-8)}
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
                        <div className="mt-2 text-xs text-gray-600 space-y-1">
                          {order.tracking_number ? (
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                              <Truck className="w-3.5 h-3.5 text-gray-500" />
                              <span>Tracking: {order.tracking_number}</span>
                              {order.shipping_carrier ? <span className="text-gray-500">({order.shipping_carrier})</span> : null}
                              {order.tracking_url ? (
                                <a
                                  className="text-blue-600 hover:text-blue-700 underline"
                                  href={order.tracking_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  Track package
                                </a>
                              ) : null}
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <Truck className="w-3.5 h-3.5 text-gray-400" />
                              <span>Tracking will appear when this item ships.</span>
                            </div>
                          )}
                          {formatEstimatedArrival(order.created_at, item.products?.shipping_options?.[0]?.estimated_days) ? (
                            <div>
                              Estimated arrival: {formatEstimatedArrival(order.created_at, item.products?.shipping_options?.[0]?.estimated_days)}
                            </div>
                          ) : item.products?.shipping_options?.[0]?.estimated_days ? (
                            <div>
                              Estimated transit: {item.products.shipping_options[0].estimated_days}
                            </div>
                          ) : null}
                        </div>
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
