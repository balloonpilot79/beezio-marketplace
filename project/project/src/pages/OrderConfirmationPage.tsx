import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { CheckCircle, Package, Printer, ArrowRight, Download } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContextMultiRole';
import AffiliateShareWidget from '../components/AffiliateShareWidget';
import DigitalDownloadPanel from '../components/DigitalDownloadPanel';
import { downloadReceiptHtml } from '../utils/receipt';
import { resolveProductImageFromList } from '../utils/imageHelpers';

interface OrderItem {
  id: string;
  product_id: string;
  variant_id?: string | null;
  quantity: number;
  price: number;
  title: string;
  description?: string | null;
  images?: string[];
  sku?: string | null;
  variant_label?: string | null;
  variant_sku?: string | null;
  cj_variant_id?: string | null;
  external_variant_id?: string | null;
  line_total?: number;
  configured_affiliate_commission_percent?: number;
  configured_affiliate_commission_amount?: number;
  applied_affiliate_rate?: number;
  applied_affiliate_commission_amount?: number;
  platform_percent_at_purchase?: number;
}

interface Order {
  id: string;
  order_number: string;
  total_amount: number;
  total_charged?: number | null;
  status: string;
  payment_status?: string | null;
  fulfillment_status?: string | null;
  created_at: string;
  billing_email: string;
  billing_name: string;
  shipping_address?: {
    name?: string;
    firstName?: string;
    lastName?: string;
    address?: string;
    address2?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
  } | null;
  tracking_number?: string | null;
  tracking_url?: string | null;
  seller?: {
    id?: string | null;
    name?: string | null;
    email?: string | null;
  } | null;
  buyer?: {
    id?: string | null;
    name?: string | null;
    email?: string | null;
  } | null;
  items: OrderItem[];
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const extractUuid = (value: string | null): string => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const direct = raw.match(UUID_REGEX);
  if (direct?.[0]) return direct[0];
  const embedded = raw.match(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i);
  return embedded?.[0] || '';
};

export default function OrderConfirmationPage() {
  const [searchParams] = useSearchParams();
  const rawOrderToken = searchParams.get('order');
  const orderId = extractUuid(rawOrderToken);
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { user, session, profile, hasRole, addRole, loading: authLoading } = useAuth();
  const [enablingAffiliate, setEnablingAffiliate] = useState(false);
  const [affiliateEnabled, setAffiliateEnabled] = useState(false);
  const [affiliateEnableError, setAffiliateEnableError] = useState<string | null>(null);

  const isAffiliate = Boolean(user && (hasRole('affiliate') || hasRole('admin') || profile?.primary_role === 'affiliate'));
  const purchasedProductIds = useMemo(() => {
    const ids = order?.items?.map((i) => i.product_id).filter(Boolean) || [];
    return Array.from(new Set(ids));
  }, [order]);
  const shippingAddress = order?.shipping_address || null;
  const buyerName =
    order?.billing_name ||
    String(shippingAddress?.name || '').trim() ||
    [shippingAddress?.firstName, shippingAddress?.lastName].filter(Boolean).join(' ').trim() ||
    'Customer';
  const shippingCityStateZip = [shippingAddress?.city, shippingAddress?.state, shippingAddress?.zip].filter(Boolean).join(', ').replace(/, ([^,]+)$/, ' $1');
  const orderTotal = Number(order?.total_charged ?? order?.total_amount ?? 0) || 0;
  const sellerName = String(order?.seller?.name || '').trim() || 'Seller';
  const sellerEmail = String(order?.seller?.email || '').trim() || '';
  const buyerEmail = String(order?.buyer?.email || order?.billing_email || '').trim();
  const fulfillmentStatus = String(order?.fulfillment_status || '').trim().toLowerCase();
  const paymentStatus = String(order?.payment_status || order?.status || '').trim().toLowerCase();
  const buyerOrderStatus = (() => {
    if (fulfillmentStatus === 'delivered') return { label: 'Delivered', tone: 'bg-green-100 text-green-800' };
    if (fulfillmentStatus === 'shipped') return { label: 'Shipped', tone: 'bg-blue-100 text-blue-800' };
    if (fulfillmentStatus === 'processing') return { label: 'Preparing for shipment', tone: 'bg-amber-100 text-amber-800' };
    if (fulfillmentStatus === 'waiting_funds') return { label: 'Payment clearing', tone: 'bg-amber-100 text-amber-800' };
    if (fulfillmentStatus === 'manual_review') return { label: 'Order review', tone: 'bg-orange-100 text-orange-800' };
    if (paymentStatus === 'paid' || paymentStatus === 'completed' || paymentStatus === 'processing') {
      return { label: 'Order received', tone: 'bg-emerald-100 text-emerald-800' };
    }
    return { label: order?.status || 'Pending', tone: 'bg-gray-100 text-gray-800' };
  })();

  useEffect(() => {
    if (!rawOrderToken) {
      setError('No order ID provided');
      setLoading(false);
      return;
    }

    if (authLoading) {
      return;
    }

    loadOrder();
  }, [authLoading, orderId, rawOrderToken, session?.access_token]);

  const loadOrder = async () => {
    try {
      const accessToken = String(session?.access_token || '').trim();
      const params = new URLSearchParams();
      if (orderId) params.set('id', orderId);
      else params.set('providerOrderId', String(rawOrderToken || '').trim());

      const response = await fetch(`/api/order-details?${params.toString()}`, {
        method: 'GET',
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(String((payload as any)?.error || 'Failed to load order details'));
      }

      const loadedOrder = (payload as any)?.order;
      if (!loadedOrder?.id) throw new Error('Order not found');
      setOrder(loadedOrder as Order);
    } catch (err: any) {
      console.error('Error loading order:', err);
      setError(err instanceof Error ? err.message : 'Failed to load order details');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadReceipt = () => {
    if (!order) return;
    downloadReceiptHtml({
      id: order.id,
      orderNumber: order.order_number,
      createdAt: order.created_at,
      billingEmail: order.billing_email,
      billingName: order.billing_name,
      shippingAddress: order.shipping_address,
      status: order.status,
      totalAmount: orderTotal,
      items: order.items.map((item) => ({
        title: item.title,
        quantity: item.quantity,
        price: item.price,
      })),
    });
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
      setAffiliateEnableError(e instanceof Error ? e.message : 'Failed to enable partner');
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
              📧 Receipt email destination: <strong>{order.billing_email || 'the email used at checkout'}</strong>. If it does not arrive, you can still view this order in your dashboard.
            </p>
          </div>

          {/* Order Details */}
          <div className="border-t border-gray-200 pt-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Order Details</h2>
            
            {/* Items */}
            <div className="space-y-3 mb-6">
              {order.items.map((item) => (
                <div key={item.id} className="rounded-xl border border-gray-200 p-4">
                  <div className="flex flex-col gap-4 sm:flex-row">
                    <div className="h-24 w-24 shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-gray-100">
                      <img
                        src={resolveProductImageFromList(item.images, item.product_id || item.id)}
                        alt={item.title}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="flex-1">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="font-medium text-gray-900">{item.title}</p>
                          {item.description ? <p className="mt-1 text-sm text-gray-600">{item.description}</p> : null}
                          <p className="mt-2 text-sm text-gray-600">Quantity: {item.quantity}</p>
                          {item.variant_label ? <p className="text-sm text-gray-600">Variant: {item.variant_label}</p> : null}
                          <div className="mt-2 space-y-1 text-xs text-gray-500">
                            {item.sku ? <p>SKU: {item.sku}</p> : null}
                            {item.variant_sku && item.variant_sku !== item.sku ? <p>Variant SKU: {item.variant_sku}</p> : null}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-500">Item price paid</p>
                          <p className="text-lg font-semibold text-gray-900">${Number(item.price || 0).toFixed(2)}</p>
                          <p className="mt-1 text-sm text-gray-600">Line total ${Number(item.line_total || item.price * item.quantity || 0).toFixed(2)}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 rounded-lg bg-gray-50 p-3 text-sm text-gray-700 sm:grid-cols-2">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-gray-500">Seller</p>
                      <p className="font-medium text-gray-900">{sellerName}</p>
                      {sellerEmail ? <p>{sellerEmail}</p> : null}
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-gray-500">Buyer</p>
                      <p className="font-medium text-gray-900">{buyerName}</p>
                      {buyerEmail ? <p>{buyerEmail}</p> : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Total */}
            <div className="border-t-2 border-gray-200 pt-4">
              <div className="flex justify-between items-center">
                <span className="text-lg font-bold text-gray-900">Total Paid</span>
                <span className="text-2xl font-bold text-amber-600">${orderTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Shipping Address */}
          <div className="border-t border-gray-200 mt-6 pt-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <h3 className="font-bold text-gray-900 mb-3">Purchased By</h3>
                <div className="text-gray-600">
                  <p className="font-medium text-gray-900">{buyerName}</p>
                  {buyerEmail ? <p>{buyerEmail}</p> : null}
                  {order?.buyer?.id ? <p className="text-xs text-gray-500 mt-2">Buyer ID: {order.buyer.id}</p> : null}
                </div>
              </div>
              <div>
                <h3 className="font-bold text-gray-900 mb-3">Sold By</h3>
                <div className="text-gray-600">
                  <p className="font-medium text-gray-900">{sellerName}</p>
                  {sellerEmail ? <p>{sellerEmail}</p> : null}
                  {order?.seller?.id ? <p className="text-xs text-gray-500 mt-2">Seller ID: {order.seller.id}</p> : null}
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-200 mt-6 pt-6">
            <h3 className="font-bold text-gray-900 mb-3">Shipping Address</h3>
            <div className="text-gray-600">
              <p className="font-medium">{buyerName}</p>
              <p>{shippingAddress?.address || 'Address unavailable'}</p>
              {shippingAddress?.address2 && <p>{shippingAddress.address2}</p>}
              {shippingCityStateZip && <p>{shippingCityStateZip}</p>}
              {shippingAddress?.country && <p>{shippingAddress.country}</p>}
            </div>
          </div>

          {/* Order Status */}
          <div className="border-t border-gray-200 mt-6 pt-6">
            <h3 className="font-bold text-gray-900 mb-3">Order Status</h3>
            <div className="flex items-center gap-2">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${buyerOrderStatus.tone}`}>{buyerOrderStatus.label}</span>
              <span className="text-sm text-gray-600">
                � Placed on {new Date(order.created_at).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </span>
            </div>
            {(paymentStatus === 'paid' || paymentStatus === 'completed') && (
              <div className="mt-2 text-sm text-gray-600">Payment confirmed. Fulfillment updates will appear here as the seller ships the order.</div>
            )}
            {order.tracking_number && (
              <div className="mt-2 text-sm text-gray-600">
                Tracking: <span className="font-medium text-gray-900">{order.tracking_number}</span>
                {order.tracking_url ? (
                  <>
                    {' '}�{' '}
                    <a href={order.tracking_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline hover:text-blue-700">
                      Track Package
                    </a>
                  </>
                ) : null}
              </div>
            )}
          </div>

        {user && order?.id && (
          <div className="mb-6">
            <DigitalDownloadPanel orderId={order.id} />
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6 print:hidden">
          <button
            onClick={handlePrint}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-white border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
          >
            <Printer className="w-5 h-5" />
            Print Receipt
          </button>

          <button
            onClick={handleDownloadReceipt}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-white border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
          >
            <Download className="w-5 h-5" />
            Download Receipt
          </button>
          
          {user && (
            <button
              onClick={() => navigate('/dashboard?section=buyer&tab=orders')}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-amber-500 text-white rounded-lg hover:bg-amber-600 font-medium"
            >
              View Buyer Orders
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

        </div>

        {/* Buyer → Partner Loop */}
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
                {enablingAffiliate ? 'Enabling…' : 'Become a Partner'}
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
                You’re enabled as a partner. Share your purchase below.
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
                        targetPath={`/partner/${profile.id}`}
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
