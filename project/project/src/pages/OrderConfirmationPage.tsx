import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { CheckCircle, Package, Printer, ArrowRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContextMultiRole';
import AffiliateShareWidget from '../components/AffiliateShareWidget';

interface OrderItem {
  id: string;
  product_id: string;
  quantity: number;
  price: number;
  title: string;
}

interface Order {
  id: string;
  order_number: string;
  total_amount: number;
  status: string;
  created_at: string;
  billing_email: string;
  billing_name: string;
  billing_address: string;
  billing_city: string;
  billing_state: string;
  billing_zip: string;
  items: OrderItem[];
}

export default function OrderConfirmationPage() {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('order');
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { user, session, profile, hasRole, addRole } = useAuth();
  const [enablingAffiliate, setEnablingAffiliate] = useState(false);
  const [affiliateEnabled, setAffiliateEnabled] = useState(false);
  const [affiliateEnableError, setAffiliateEnableError] = useState<string | null>(null);

  const isAffiliate = Boolean(user && (hasRole('affiliate') || hasRole('admin') || profile?.primary_role === 'affiliate'));
  const purchasedProductIds = useMemo(() => {
    const ids = order?.items?.map((i) => i.product_id).filter(Boolean) || [];
    return Array.from(new Set(ids));
  }, [order]);

  useEffect(() => {
    if (!orderId) {
      setError('No order ID provided');
      setLoading(false);
      return;
    }

    loadOrder();
  }, [orderId]);

  const loadOrder = async () => {
    try {
      const { data, error: orderError } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (
            id,
            product_id,
            quantity,
            price,
            products (title)
          )
        `)
        .eq('id', orderId)
        .single();

      if (orderError) throw orderError;

      // Transform the data
      const transformedOrder = {
        ...data,
        items: data.order_items?.map((item: any) => ({
          id: item.id,
          product_id: item.product_id,
          quantity: item.quantity,
          price: item.price,
          title: item.products?.title || 'Unknown Product'
        })) || []
      };

      setOrder(transformedOrder);
    } catch (err: any) {
      console.error('Error loading order:', err);
      setError('Failed to load order details');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const enableAffiliate = async () => {
    setAffiliateEnableError(null);
    if (!user) {
      const returnTo = encodeURIComponent(window.location.pathname + window.location.search);
      navigate(`/affiliate-signup?role=affiliate&redirect=${returnTo}`);
      return;
    }
    const token = session?.access_token;
    if (!token) {
      setAffiliateEnableError('Please sign in again and retry.');
      return;
    }

    setEnablingAffiliate(true);
    try {
      const res = await fetch('/api/affiliate/enable', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ts: new Date().toISOString() }),
      });
      const text = await res.text();
      let parsed: any = null;
      try {
        parsed = text ? JSON.parse(text) : null;
      } catch {
        parsed = null;
      }
      if (!res.ok) {
        throw new Error(parsed?.error || parsed?.details || text || `HTTP ${res.status}`);
      }
      await addRole('affiliate');
      setAffiliateEnabled(true);
    } catch (e) {
      setAffiliateEnableError(e instanceof Error ? e.message : 'Failed to enable affiliate');
    } finally {
      setEnablingAffiliate(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading order details...</p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">❌</span>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Order Not Found</h2>
          <p className="text-gray-600 mb-6">{error || 'We couldn\'t find this order'}</p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-3 bg-amber-500 text-white rounded-lg hover:bg-amber-600"
          >
            Return to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 print:bg-white">
      <div className="max-w-3xl mx-auto">
        {/* Success Header */}
        <div className="bg-white rounded-lg shadow-lg p-8 mb-6 print:shadow-none">
          <div className="text-center mb-6">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-12 h-12 text-green-600" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Order Confirmed!</h1>
            <p className="text-gray-600 text-lg">Thank you for your purchase</p>
          </div>

          {/* Order Number */}
          <div className="bg-amber-50 border-2 border-amber-200 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Order Number</p>
                <p className="text-2xl font-bold text-gray-900">#{order.order_number || order.id.slice(0, 8).toUpperCase()}</p>
              </div>
              <Package className="w-12 h-12 text-amber-600" />
            </div>
          </div>

          {/* Confirmation Email */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-blue-800">
              📧 A confirmation email has been sent to <strong>{order.billing_email}</strong>
            </p>
          </div>

          {/* Order Details */}
          <div className="border-t border-gray-200 pt-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Order Details</h2>
            
            {/* Items */}
            <div className="space-y-3 mb-6">
              {order.items.map((item) => (
                <div key={item.id} className="flex justify-between items-center py-3 border-b border-gray-100">
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{item.title}</p>
                    <p className="text-sm text-gray-600">Quantity: {item.quantity}</p>
                  </div>
                  <p className="font-semibold text-gray-900">${(item.price * item.quantity).toFixed(2)}</p>
                </div>
              ))}
            </div>

            {/* Total */}
            <div className="border-t-2 border-gray-200 pt-4">
              <div className="flex justify-between items-center">
                <span className="text-lg font-bold text-gray-900">Total Paid</span>
                <span className="text-2xl font-bold text-amber-600">${order.total_amount.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Shipping Address */}
          <div className="border-t border-gray-200 mt-6 pt-6">
            <h3 className="font-bold text-gray-900 mb-3">Shipping Address</h3>
            <div className="text-gray-600">
              <p className="font-medium">{order.billing_name}</p>
              <p>{order.billing_address}</p>
              <p>{order.billing_city}, {order.billing_state} {order.billing_zip}</p>
            </div>
          </div>

          {/* Order Status */}
            <div className="border-t border-gray-200 mt-6 pt-6">
            <h3 className="font-bold text-gray-900 mb-3">Order Status</h3>
            <div className="flex items-center gap-2">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                (order.status === 'completed' || order.status === 'paid') ? 'bg-green-100 text-green-800' :
                order.status === 'processing' ? 'bg-yellow-100 text-yellow-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
              </span>
              <span className="text-sm text-gray-600">
                • Placed on {new Date(order.created_at).toLocaleDateString('en-US', { 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6 print:hidden">
          <button
            onClick={handlePrint}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-white border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
          >
            <Printer className="w-5 h-5" />
            Print Receipt
          </button>
          
          {user && (
            <button
              onClick={() => navigate('/dashboard')}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-amber-500 text-white rounded-lg hover:bg-amber-600 font-medium"
            >
              Go to Dashboard
              <ArrowRight className="w-5 h-5" />
            </button>
          )}
          
          {!user && (
            <button
              onClick={() => navigate('/')}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-amber-500 text-white rounded-lg hover:bg-amber-600 font-medium"
            >
              Continue Shopping
              <ArrowRight className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Buyer → Affiliate Loop */}
        {!isAffiliate && (
          <div className="bg-white rounded-lg shadow p-6 mb-6 print:hidden border border-amber-200">
            <h3 className="text-xl font-bold text-gray-900">Want to earn by sharing?</h3>
            <p className="mt-1 text-gray-600">
              Get your own link and earn commission when people buy.
            </p>
            <div className="mt-4 flex flex-col sm:flex-row gap-3">
              <button
                onClick={enableAffiliate}
                disabled={enablingAffiliate}
                className="px-5 py-3 rounded-lg bg-gray-900 text-white font-semibold hover:bg-gray-800 disabled:opacity-60"
              >
                {enablingAffiliate ? 'Enabling…' : 'Become an Affiliate'}
              </button>
              <Link
                to="/affiliate/share"
                className="px-5 py-3 rounded-lg border border-gray-300 font-semibold text-gray-800 hover:bg-gray-50 text-center"
              >
                View Share Hub
              </Link>
            </div>
            {affiliateEnableError && <div className="mt-3 text-sm text-red-700">{affiliateEnableError}</div>}
            {affiliateEnabled && (
              <div className="mt-4 text-sm text-green-700 font-semibold">
                You’re enabled as an affiliate. Share your purchase below.
              </div>
            )}

            {(affiliateEnabled || isAffiliate) && (
              <div className="mt-5 space-y-4">
                {profile?.id && (
                  <div className="border border-gray-200 rounded-xl p-4">
                    <div className="font-semibold text-gray-900">Your storefront</div>
                    <div className="mt-2">
                      <AffiliateShareWidget
                        type="store"
                        targetId={profile.id}
                        targetPath={`/affiliate/${profile.id}`}
                        title="My Beezio storefront"
                      />
                    </div>
                  </div>
                )}

                {purchasedProductIds.length > 0 && (
                  <div className="border border-gray-200 rounded-xl p-4">
                    <div className="font-semibold text-gray-900">Share what you bought</div>
                    <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                      {purchasedProductIds.map((pid) => {
                        const item = order.items.find((i) => i.product_id === pid);
                        const title = item?.title || 'Product';
                        return (
                          <div key={pid} className="border border-gray-200 rounded-xl p-3">
                            <div className="text-sm font-semibold text-gray-900">{title}</div>
                            <div className="mt-2">
                              <AffiliateShareWidget type="product" targetId={pid} targetPath={`/product/${pid}`} title={title} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* What's Next */}
        <div className="bg-white rounded-lg shadow p-6 print:hidden">
          <h3 className="font-bold text-gray-900 mb-4">What's Next?</h3>
          <ul className="space-y-3">
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center text-sm font-bold">1</span>
              <div>
                <p className="font-medium text-gray-900">Order Processing</p>
                <p className="text-sm text-gray-600">Your order is being prepared by the seller</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center text-sm font-bold">2</span>
              <div>
                <p className="font-medium text-gray-900">Shipping Notification</p>
                <p className="text-sm text-gray-600">You'll receive tracking info when your order ships</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center text-sm font-bold">3</span>
              <div>
                <p className="font-medium text-gray-900">Delivery</p>
                <p className="text-sm text-gray-600">Your items will arrive at your doorstep</p>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
