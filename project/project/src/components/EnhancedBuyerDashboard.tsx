import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContextMultiRole';
import { supabase } from '../lib/supabase';
import IssueCenterPage from '../pages/IssueCenterPage';
import { Package, Heart, Star, Calendar, Truck, Gift, MessageSquare, Download, Shield, Bell, Users, Zap, BookOpen, TrendingUp, HelpCircle, Clock, Filter, Search, TrendingDown, DollarSign, UserMinus, Plus, X, ThumbsUp, CheckCircle } from 'lucide-react';

interface Order {
  id: string;
  order_number?: string | null;
  product_title: string;
  items?: Array<{
    id: string;
    title: string;
    quantity: number;
    unit_price: number;
    line_total: number;
    sku?: string | null;
  }>;
  seller_id?: string | null;
  seller_name?: string | null;
  buyer_name?: string | null;
  buyer_email?: string | null;
  amount: number;
  shipping_amount?: number;
  status: string;
  payment_status?: string | null;
  fulfillment_status?: string | null;
  dispute_status?: string | null;
  order_date: string;
  ordered_at?: string | null;
  paid_at?: string | null;
  shipped_at?: string | null;
  expected_ship_date?: string | null;
  expected_arrival_date?: string | null;
  seller_notes?: string | null;
  tracking_number?: string;
  tracking_url?: string;
  shipping_carrier?: string;
  cj_status?: string;
}

interface WishlistItem {
  id: string;
  product_title: string;
  price: number;
  seller_name: string;
  image: string;
}

interface Recommendation {
  id: string;
  product_title: string;
  price: number;
  seller_name: string;
  affiliate_name: string;
  match_score: number;
  reason: string;
  discount?: number;
}

interface Purchase {
  id: string;
  product_title: string;
  seller_name: string;
  affiliate_name: string;
  amount: number;
  purchase_date: string;
  download_links?: string[];
  access_expires?: string;
  support_until?: string;
}

interface Affiliate {
  id: string;
  name: string;
  specialty: string;
  rating: number;
  total_sales: number;
  avatar?: string;
  is_following: boolean;
  followers: number;
  purchases: number;
  total_spent: number;
  following_since: string;
  last_purchase: string;
}

interface WatchlistItem {
  id: string;
  product_title: string;
  seller_name: string;
  affiliate_name: string;
  current_price: number;
  original_price?: number;
  price_drop?: number;
  added_date: string;
}

export type BuyerDashboardTab =
  | 'overview'
  | 'orders'
  | 'purchases'
  | 'wishlist'
  | 'recommendations'
  | 'affiliates'
  | 'watchlist'
  | 'community'
  | 'support';

interface EnhancedBuyerDashboardProps {
  initialTab?: BuyerDashboardTab;
  activeTabOverride?: BuyerDashboardTab;
  onTabChange?: (tab: BuyerDashboardTab) => void;
  hideInternalTabs?: boolean;
  title?: string;
  subtitle?: string;
}

const EnhancedBuyerDashboard: React.FC<EnhancedBuyerDashboardProps> = ({
  initialTab = 'overview',
  activeTabOverride,
  onTabChange,
  hideInternalTabs = false,
  title = 'Buyer Dashboard',
  subtitle = 'Manage your orders and preferences',
}) => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [wishlist, setWishlist] = useState<WishlistItem[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [followedAffiliates, setFollowedAffiliates] = useState<Affiliate[]>([]);
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [activeTab, setActiveTab] = useState<BuyerDashboardTab>(activeTabOverride || initialTab);
  const [loading, setLoading] = useState(true);
  const [disputePrefill, setDisputePrefill] = useState<{ sellerId: string; orderId: string; summary: string } | null>(null);
  const [showComplianceBanner, setShowComplianceBanner] = useState(true);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const dismissed = localStorage.getItem('beezio_buyer_compliance_banner');
      setShowComplianceBanner(dismissed !== 'dismissed');
    } catch {
      setShowComplianceBanner(true);
    }
  }, []);

  const dismissComplianceBanner = () => {
    setShowComplianceBanner(false);
    try {
      localStorage.setItem('beezio_buyer_compliance_banner', 'dismissed');
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (user) {
      fetchBuyerData();
    } else {
      setLoading(false);
    }
  }, [user, profile]);

  useEffect(() => {
    if (!activeTabOverride || activeTabOverride === activeTab) return;
    setActiveTab(activeTabOverride);
  }, [activeTab, activeTabOverride]);

  const handleTabChange = (tab: BuyerDashboardTab) => {
    setActiveTab(tab);
    onTabChange?.(tab);
  };

  const isMissingColumnError = (error: unknown, columnName: string) => {
    const message = String((error as any)?.message || '').toLowerCase();
    return message.includes('column') && message.includes(columnName.toLowerCase()) && message.includes('does not exist');
  };

  const formatMoney = (value: unknown) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value) || 0);

  const formatDateTime = (value: unknown) => {
    const date = new Date(String(value || ''));
    if (!Number.isFinite(date.getTime())) return 'Not available';
    return date.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  };

  const formatDate = (value: unknown) => {
    const date = new Date(String(value || ''));
    if (!Number.isFinite(date.getTime())) return 'Not provided yet';
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const fetchBuyerOrdersFromFunction = async (): Promise<Order[] | null> => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) return null;

    const response = await fetch('/.netlify/functions/buyer-orders', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(String(body?.error || 'Failed to load buyer orders'));
    }

    const body = await response.json();
    const rows = Array.isArray(body?.orders) ? body.orders : [];
    return rows.map((order: any) => {
      const items = Array.isArray(order?.items) ? order.items : [];
      return {
        id: String(order.id),
        order_number: order.order_number || null,
        product_title:
          items.length > 1
            ? `${items[0]?.title || 'Product'} + ${items.length - 1} more`
            : items[0]?.title || 'Product',
        items,
        seller_id: order.seller_id || null,
        seller_name: order.seller_name || null,
        buyer_name: order.buyer_name || null,
        buyer_email: order.buyer_email || null,
        amount: Number(order.total_amount || 0),
        shipping_amount: Number(order.shipping_amount || 0),
        status: String(order.status || 'Pending'),
        payment_status: order.payment_status || null,
        fulfillment_status: order.fulfillment_status || null,
        dispute_status: order.dispute_status || null,
        order_date: String(order.ordered_at || '').split('T')[0],
        ordered_at: order.ordered_at || null,
        paid_at: order.paid_at || null,
        shipped_at: order.shipped_at || null,
        expected_ship_date: order.expected_ship_date || null,
        expected_arrival_date: order.expected_arrival_date || null,
        seller_notes: order.seller_notes || null,
        tracking_number: order.tracking_number || undefined,
        tracking_url: order.tracking_url || undefined,
        shipping_carrier: order.shipping_carrier || undefined,
        cj_status: order.cj_status || undefined,
      };
    });
  };

  const fetchBuyerData = async () => {
    try {
      const functionOrders = await fetchBuyerOrdersFromFunction().catch((error) => {
        console.warn('Failed to fetch buyer orders from function:', error.message);
        return null;
      });
      if (functionOrders) {
        setOrders(functionOrders);
        setPurchases(functionOrders.flatMap((order) => (order.items || []).map((item) => ({
          id: item.id,
          product_title: item.title || order.product_title,
          seller_name: order.seller_name || 'Seller',
          affiliate_name: 'Direct Purchase',
          amount: item.line_total || order.amount,
          purchase_date: String(order.ordered_at || order.order_date || '').split('T')[0] || 'Unknown',
        }))));
        setWishlist([]);
        setRecommendations([]);
        setFollowedAffiliates([]);
        setWatchlist([]);
        return;
      }

      // Fetch real orders from Supabase
      const userId = String(user?.id || '').trim();
      const profileId = String((profile as any)?.id || '').trim();
      const buyerIds = Array.from(new Set([profileId, userId].filter(Boolean)));
      const buyerEmail = String(profile?.email || (user as any)?.email || '').trim();

      const baseOrdersQuery = () =>
        supabase
          .from('orders')
          .select(`
            *,
            order_items(
              *,
              products(title, seller_id)
            )
          `)
          .order('created_at', { ascending: false });

      const runOrdersQuery = async (emailColumn: 'billing_email' | 'customer_email' | null) => {
        let query = baseOrdersQuery();
        const filters: string[] = [];
        if (buyerIds.length === 1) {
          filters.push(`buyer_id.eq.${buyerIds[0]}`);
        } else if (buyerIds.length > 1) {
          filters.push(`buyer_id.in.(${buyerIds.join(',')})`);
        }
        if (buyerEmail && emailColumn) {
          filters.push(`${emailColumn}.eq.${buyerEmail}`);
        }

        if (filters.length > 1) {
          query = query.or(filters.join(','));
        } else if (filters.length === 1) {
          const [filter] = filters;
          const [column, operator, value] = filter.split('.');
          if (operator === 'eq') {
            query = query.eq(column, value);
          } else {
            query = query.or(filter);
          }
        } else if (buyerEmail && emailColumn) {
          query = query.eq(emailColumn, buyerEmail);
        }
        return await query;
      };

      let { data: ordersData, error: ordersError } = await runOrdersQuery('billing_email');
      if (ordersError && isMissingColumnError(ordersError, 'billing_email')) {
        const fallbackByIds = await runOrdersQuery(null);
        ordersData = fallbackByIds.data;
        ordersError = fallbackByIds.error;

        if ((!ordersData || ordersData.length === 0) && buyerEmail) {
          const fallbackByCustomerEmail = await runOrdersQuery('customer_email');
          if (!fallbackByCustomerEmail.error || !ordersData?.length) {
            ordersData = fallbackByCustomerEmail.data;
            ordersError = fallbackByCustomerEmail.error;
          }
        }
      } else if (ordersError && buyerEmail) {
        const fallback = await runOrdersQuery('customer_email');
        ordersData = fallback.data;
        ordersError = fallback.error;
      }
      if (ordersError && isMissingColumnError(ordersError, 'customer_email')) {
        const fallbackByIds = await runOrdersQuery(null);
        ordersData = fallbackByIds.data;
        ordersError = fallbackByIds.error;
      }
      if (ordersError) {
        console.warn('Failed to fetch buyer orders:', ordersError.message);
      }

      if (ordersData) {
        const orderIds = ordersData.map((order) => String(order.id)).filter(Boolean);
        const cjByOrderId: Record<string, { status?: string; trackingNumber?: string; trackingUrl?: string; carrier?: string }> = {};
        if (orderIds.length > 0) {
          const { data: cjRows } = await supabase
            .from('cj_orders')
            .select('beezio_order_id,cj_status,cj_tracking_number,cj_tracking_url,cj_logistic_name')
            .in('beezio_order_id', orderIds);
          (cjRows || []).forEach((row: any) => {
            const key = String(row?.beezio_order_id || '').trim();
            if (!key) return;
            cjByOrderId[key] = {
              status: String(row?.cj_status || '').trim() || undefined,
              trackingNumber: String(row?.cj_tracking_number || '').trim() || undefined,
              trackingUrl: String(row?.cj_tracking_url || '').trim() || undefined,
              carrier: String(row?.cj_logistic_name || '').trim() || undefined,
            };
          });
        }

        const formattedOrders = ordersData.map(order => {
          const fulfillmentStatus = String(order.fulfillment_status || '').trim().toLowerCase();
          const paymentStatus = String(order.payment_status || order.status || '').trim().toLowerCase();
          const buyerStatus = (() => {
            if (fulfillmentStatus === 'delivered') return 'Delivered';
            if (fulfillmentStatus === 'shipped') return 'Shipped';
            if (fulfillmentStatus === 'processing') return 'Preparing for shipment';
            if (fulfillmentStatus === 'waiting_funds') return 'Payment clearing';
            if (fulfillmentStatus === 'manual_review') return 'Order review';
            if (paymentStatus === 'paid' || paymentStatus === 'completed' || paymentStatus === 'processing') return 'Order received';
            return String(order.status || 'Pending').trim() || 'Pending';
          })();

          return {
            id: order.id,
            order_number: order.order_number || null,
            product_title: order.order_items?.[0]?.products?.title || 'Product',
            seller_id: order.order_items?.[0]?.products?.seller_id || null,
            amount: order.total_amount,
            status: buyerStatus,
            payment_status: order.payment_status || null,
            fulfillment_status: order.fulfillment_status || null,
            order_date: order.created_at.split('T')[0],
            tracking_number: order.tracking_number || cjByOrderId[String(order.id)]?.trackingNumber,
            tracking_url: order.tracking_url || cjByOrderId[String(order.id)]?.trackingUrl,
            shipping_carrier: cjByOrderId[String(order.id)]?.carrier,
            cj_status: cjByOrderId[String(order.id)]?.status,
          };
        });
        const sellerIds = Array.from(
          new Set(formattedOrders.map((order) => order.seller_id).filter(Boolean))
        ) as string[];
        if (formattedOrders.length === 0) {
          setOrders([]);
        } else if (sellerIds.length > 0) {
          const { data: sellersData } = await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', sellerIds);
          const nameById: Record<string, string> = {};
          (sellersData || []).forEach((row: any) => {
            if (row?.id) nameById[String(row.id)] = String(row.full_name || 'Seller');
          });
          setOrders(
            formattedOrders.map((order) => ({
              ...order,
              seller_name: order.seller_id ? nameById[String(order.seller_id)] || 'Seller' : null,
            }))
          );
        } else {
          setOrders(formattedOrders);
        }
      }

      const ordersPurchasesData = ordersData?.length ? ordersData.slice(0, 10) : [];

      const finalPurchasesData = ordersPurchasesData?.length ?
        ordersPurchasesData.flatMap(order => 
          order.order_items?.map(item => ({
            ...item,
            order_date: order.created_at,
            order_amount: order.total_amount
          })) || []
        ) : [];

      if (finalPurchasesData && finalPurchasesData.length > 0) {
        const formattedPurchases = finalPurchasesData.map(item => ({
          id: item.id,
          product_title: item.products?.title || 'Product',
          seller_name: 'Unknown Seller', // Could be fetched separately if needed
          affiliate_name: 'Direct Purchase', // Could be fetched separately if needed
          amount: item.total_price || item.order_amount || 0,
          purchase_date: item.order_date?.split('T')[0] || item.created_at?.split('T')[0] || 'Unknown',
          download_links: item.products?.images || [],
          access_expires: '2026-01-25', // Could be calculated from purchase terms
          support_until: '2025-07-25'
        }));
        setPurchases(formattedPurchases);
      } else {
        setPurchases([]);
      }

      setWishlist([]);
      setRecommendations([]);
      setFollowedAffiliates([]);
      setWatchlist([]);

    } catch (error) {
      console.error('Error fetching buyer data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getOrderStatusColor = (status: string) => {
    switch (String(status || '').trim().toLowerCase()) {
      case 'order received': return 'bg-emerald-100 text-emerald-800';
      case 'preparing for shipment': return 'bg-amber-100 text-amber-800';
      case 'payment clearing': return 'bg-amber-100 text-amber-800';
      case 'order review': return 'bg-orange-100 text-orange-800';
      case 'delivered': return 'bg-green-100 text-green-800';
      case 'shipped': return 'bg-blue-100 text-blue-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const totalPurchases = orders.length;
  const totalSavings = watchlist.reduce((sum, item) => sum + Number(item.price_drop || 0), 0);
  const watchlistSavings = watchlist.reduce((sum, item) => sum + Math.max(0, Number(item.original_price || 0) - Number(item.current_price || 0)), 0);

  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      {showComplianceBanner && (
        <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 px-5 py-4 text-sm text-blue-900">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-semibold mb-2">Buyer basics</p>
              <ul className="space-y-1">
                <li>- Refund eligibility follows the seller&apos;s return policy and Beezio&apos;s refund policy.</li>
                <li>- Exchanges are available within 30 days of delivery.</li>
                <li>- File order issues and refund requests from this customer dashboard.</li>
                <li>- Beezio receives disputes, reviews the order, and handles refund decisions.</li>
                <li>- Open disputes place related payouts on hold while Beezio reviews the case.</li>
              </ul>
              <div className="mt-2">
                <Link to="/terms" className="text-blue-700 underline hover:text-blue-800">
                  View full terms
                </Link>
              </div>
            </div>
            <button
              type="button"
              onClick={dismissComplianceBanner}
              className="shrink-0 rounded-full border border-blue-300 bg-white px-3 py-1 text-xs font-semibold text-blue-800 hover:bg-blue-100"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{title}</h1>
        <p className="text-gray-600">{subtitle}</p>
      </div>

      {/* Enhanced Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Purchases</p>
              <p className="text-2xl font-bold text-gray-900">{totalPurchases}</p>
              <p className="text-sm text-gray-600 mt-1">From completed checkout orders</p>
            </div>
            <Package className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Savings</p>
              <p className="text-2xl font-bold text-gray-900">${totalSavings.toFixed(2)}</p>
              <p className="text-sm text-orange-600 mt-1">From tracked watchlist price drops</p>
            </div>
            <Gift className="w-8 h-8 text-orange-600" />
          </div>
        </div>
      </div>

      {/* Enhanced Navigation Tabs */}
      {!hideInternalTabs && (
      <div className="border-b border-gray-200 mb-8">
        <nav className="flex space-x-6 overflow-x-auto">
          {[
          { id: 'overview', label: 'Overview', icon: TrendingUp },
          { id: 'orders', label: 'Orders', icon: Package },
          { id: 'purchases', label: 'My Purchases', icon: Download },
          { id: 'wishlist', label: 'Wishlist', icon: Heart },
          { id: 'recommendations', label: 'For You', icon: Zap },
          { id: 'affiliates', label: 'My Affiliates', icon: Users },
          { id: 'support', label: 'Support', icon: HelpCircle }
        ].map((tab) => {
            const IconComponent = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id as BuyerDashboardTab)}
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
      )}

      {/* Enhanced Tab Content */}
      {activeTab === 'overview' && (
        <div className="space-y-8">
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-5">
            <h3 className="text-lg font-semibold text-gray-900">What happens after you order</h3>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-4">
              <div className="rounded-lg border border-white/80 bg-white p-4 text-sm text-gray-700">
                Your order appears in <strong>Orders</strong> as soon as payment is captured.
              </div>
              <div className="rounded-lg border border-white/80 bg-white p-4 text-sm text-gray-700">
                The seller updates fulfillment and adds tracking from their shipping dashboard.
              </div>
              <div className="rounded-lg border border-white/80 bg-white p-4 text-sm text-gray-700">
                You see shipment status, carrier, and tracking updates here as the order moves.
              </div>
              <div className="rounded-lg border border-white/80 bg-white p-4 text-sm text-gray-700">
                If there is a problem, contact the seller first. If it is not resolved, Beezio can review the dispute.
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Recent Activity</h3>
                  <Bell className="w-5 h-5 text-gray-400" />
                </div>
                <div className="space-y-4">
                  {orders.length > 0 ? orders.slice(0, 3).map((order) => (
                    <button
                      key={order.id}
                      onClick={() => {
                        setExpandedOrderId(order.id);
                        handleTabChange('orders');
                      }}
                      className="w-full flex items-center justify-between gap-4 p-3 bg-blue-50 rounded-lg text-left hover:bg-blue-100"
                    >
                      <Package className="w-5 h-5 text-blue-600 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">Order #{order.order_number || order.id}</p>
                        <p className="text-sm text-gray-600 truncate">{order.product_title}</p>
                      </div>
                      <span className="text-xs text-blue-700 whitespace-nowrap">{formatDate(order.ordered_at || order.order_date)}</span>
                    </button>
                  )) : (
                    <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-600">
                      No recent orders yet.
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
                <div className="grid grid-cols-2 gap-4">
                  <button 
                    onClick={() => setActiveTab('recommendations')}
                    className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left"
                  >
                    <Zap className="w-6 h-6 text-yellow-600 mb-2" />
                    <h4 className="font-medium">View Recommendations</h4>
                    <p className="text-sm text-gray-600">Personalized for you</p>
                  </button>
                  <button 
                    onClick={() => setActiveTab('affiliates')}
                    className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left"
                  >
                    <Users className="w-6 h-6 text-blue-600 mb-2" />
                    <h4 className="font-medium">My Affiliates</h4>
                    <p className="text-sm text-gray-600">Following {followedAffiliates.length} experts</p>
                  </button>
                  <button 
                    onClick={() => setActiveTab('support')}
                    className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left"
                  >
                    <MessageSquare className="w-6 h-6 text-green-600 mb-2" />
                    <h4 className="font-medium">Get Support</h4>
                    <p className="text-sm text-gray-600">24/7 assistance</p>
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <h3 className="text-lg font-semibold mb-4">Your Affiliate Network</h3>
                <div className="space-y-3">
                  {followedAffiliates.slice(0, 3).map((affiliate) => (
                    <div key={affiliate.id} className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-yellow-500 rounded-full flex items-center justify-center">
                        <span className="text-white font-medium text-sm">{affiliate.name.charAt(0)}</span>
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{affiliate.name}</p>
                        <p className="text-sm text-gray-600">{affiliate.specialty}</p>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Star className="w-4 h-4 text-yellow-400 fill-current" />
                        <span className="text-sm">{affiliate.rating}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <button 
                  onClick={() => setActiveTab('affiliates')}
                  className="w-full mt-4 bg-gray-100 text-gray-700 py-2 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  View All Affiliates
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'purchases' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold">My Digital Purchases</h3>
              <div className="flex space-x-2">
                <button className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                  <Filter className="w-4 h-4" />
                  <span>Filter</span>
                </button>
                <button className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                  <Search className="w-4 h-4" />
                  <span>Search</span>
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {purchases.map((purchase) => (
                <div key={purchase.id} className="border border-gray-200 rounded-lg p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h4 className="font-medium text-lg mb-1">{purchase.product_title}</h4>
                      <div className="flex items-center space-x-4 text-sm text-gray-600">
                        <span>by {purchase.seller_name}</span>
                        <span>â€¢</span>
                        <span>Referred by {purchase.affiliate_name}</span>
                        <span>â€¢</span>
                        <span>Purchased {purchase.purchase_date}</span>
                      </div>
                    </div>
                    <span className="text-lg font-bold text-green-600">${purchase.amount}</span>
                  </div>

                  {purchase.download_links && (
                    <div className="mb-4">
                      <h5 className="font-medium mb-2">Download Links:</h5>
                      <div className="space-y-2">
                        {purchase.download_links.map((link, index) => (
                          <button 
                            key={index}
                            onClick={() => window.open(link, '_blank')}
                            className="flex items-center space-x-2 text-blue-600 hover:text-blue-700"
                          >
                            <Download className="w-4 h-4" />
                            <span>Course Module {index + 1}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center space-x-6">
                      {purchase.access_expires && (
                        <div className="flex items-center space-x-2 text-green-600">
                          <Clock className="w-4 h-4" />
                          <span>Access until {purchase.access_expires}</span>
                        </div>
                      )}
                      {purchase.support_until && (
                        <div className="flex items-center space-x-2 text-blue-600">
                          <Shield className="w-4 h-4" />
                          <span>Support until {purchase.support_until}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex space-x-3">
                      <button className="text-orange-600 hover:text-orange-700 font-medium">Contact Seller</button>
                      <button className="text-blue-600 hover:text-blue-700 font-medium">Leave Review</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'recommendations' && (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-yellow-50 to-pink-50 p-6 rounded-xl border border-yellow-200">
            <h3 className="text-lg font-semibold mb-2 text-yellow-900">ðŸŽ¯ Personalized For You</h3>
            <p className="text-yellow-800">Based on your purchase history and interests, here are products we think you'll love!</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {recommendations.map((rec) => (
              <div key={rec.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <h4 className="font-medium text-lg">{rec.product_title}</h4>
                      <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-xs">
                        {rec.match_score}% match
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">by {rec.seller_name}</p>
                    <p className="text-sm text-blue-600 mb-3">Recommended by {rec.affiliate_name}</p>
                    <p className="text-sm text-gray-700 bg-gray-50 p-2 rounded">{rec.reason}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-2xl font-bold text-gray-900">${rec.price}</span>
                    {rec.discount && (
                      <span className="ml-2 bg-red-100 text-red-800 px-2 py-1 rounded-full text-xs">
                        {rec.discount}% OFF
                      </span>
                    )}
                  </div>
                  <div className="flex space-x-2">
                    <button className="bg-gray-100 text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-200 transition-colors">
                      <Heart className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => navigate(`/product/${rec.id}`)}
                      className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors"
                    >
                      View Product
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold mb-4">Why These Recommendations?</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <BookOpen className="w-6 h-6 text-blue-600 mx-auto mb-2" />
                <h4 className="font-medium mb-1">Learning Path</h4>
                <p className="text-sm text-gray-600">Based on your course progression</p>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <TrendingUp className="w-6 h-6 text-green-600 mx-auto mb-2" />
                <h4 className="font-medium mb-1">Similar Buyers</h4>
                <p className="text-sm text-gray-600">Others with similar interests loved these</p>
              </div>
              <div className="text-center p-4 bg-yellow-50 rounded-lg">
                <Users className="w-6 h-6 text-yellow-600 mx-auto mb-2" />
                <h4 className="font-medium mb-1">Trusted Affiliates</h4>
                <p className="text-sm text-gray-600">From affiliates you follow</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'orders' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold">Order History</h3>
          </div>
          <div className="divide-y divide-gray-200">
            {orders.length === 0 && (
              <div className="p-6 text-sm text-gray-600">
                No orders found for this buyer account yet.
              </div>
            )}
            {orders.map((order) => (
              <div key={order.id} className="p-6">
                <div className="flex items-center justify-between gap-4 mb-4">
                  <div className="min-w-0">
                    <h4 className="font-medium text-gray-900 truncate">{order.product_title}</h4>
                    <p className="text-sm text-gray-600">
                      <button
                        type="button"
                        onClick={() => setExpandedOrderId(expandedOrderId === order.id ? null : order.id)}
                        className="font-medium text-orange-700 underline-offset-2 hover:text-orange-800 hover:underline"
                      >
                        Order #{order.order_number || order.id}
                      </button>
                      {' - '}
                      {formatDate(order.ordered_at || order.order_date)}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-medium text-lg">{formatMoney(order.amount)}</p>
                    <span className={`text-xs px-2 py-1 rounded-full ${getOrderStatusColor(order.status)}`}>
                      {order.status}
                    </span>
                    {String(order.dispute_status || '').toUpperCase() === 'OPEN' && (
                      <div className="mt-1 text-xs px-2 py-1 rounded-full bg-red-100 text-red-800">
                        Beezio review open
                      </div>
                    )}
                  </div>
                </div>

                {order.tracking_number && (
                  <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
                    <Truck className="w-4 h-4" />
                    <span>Tracking: {order.tracking_number}</span>
                    {order.shipping_carrier ? <span className="text-gray-400">({order.shipping_carrier})</span> : null}
                    {order.tracking_url ? (
                      <a
                        className="text-blue-600 hover:text-blue-700 underline"
                        href={order.tracking_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Track Package
                      </a>
                    ) : null}
                  </div>
                )}

                {expandedOrderId === order.id && (
                  <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <h5 className="text-sm font-semibold text-gray-900 mb-2">Order Details</h5>
                        <dl className="space-y-1 text-sm">
                          <div className="flex justify-between gap-4">
                            <dt className="text-gray-600">Ordered</dt>
                            <dd className="text-right text-gray-900">{formatDateTime(order.ordered_at || order.order_date)}</dd>
                          </div>
                          <div className="flex justify-between gap-4">
                            <dt className="text-gray-600">Buyer</dt>
                            <dd className="text-right text-gray-900">{order.buyer_name || order.buyer_email || 'Buyer'}</dd>
                          </div>
                          {order.buyer_email && (
                            <div className="flex justify-between gap-4">
                              <dt className="text-gray-600">Email</dt>
                              <dd className="text-right text-gray-900 break-all">{order.buyer_email}</dd>
                            </div>
                          )}
                          <div className="flex justify-between gap-4">
                            <dt className="text-gray-600">Seller</dt>
                            <dd className="text-right text-gray-900">{order.seller_name || 'Seller'}</dd>
                          </div>
                          <div className="flex justify-between gap-4">
                            <dt className="text-gray-600">Expected ship</dt>
                            <dd className="text-right text-gray-900">{formatDate(order.expected_ship_date)}</dd>
                          </div>
                          <div className="flex justify-between gap-4">
                            <dt className="text-gray-600">Expected arrival</dt>
                            <dd className="text-right text-gray-900">{formatDate(order.expected_arrival_date)}</dd>
                          </div>
                        </dl>
                      </div>
                      <div>
                        <h5 className="text-sm font-semibold text-gray-900 mb-2">Items</h5>
                        <div className="space-y-2">
                          {(order.items || []).length > 0 ? (order.items || []).map((item) => (
                            <div key={item.id} className="flex justify-between gap-4 text-sm">
                              <div className="min-w-0">
                                <p className="font-medium text-gray-900 truncate">{item.title}</p>
                                <p className="text-gray-600">Qty {item.quantity}{item.sku ? ` - SKU ${item.sku}` : ''}</p>
                              </div>
                              <div className="text-right text-gray-900 whitespace-nowrap">{formatMoney(item.line_total)}</div>
                            </div>
                          )) : (
                            <p className="text-sm text-gray-600">No item details were saved for this order.</p>
                          )}
                        </div>
                        <div className="mt-3 border-t border-gray-200 pt-3 space-y-1 text-sm">
                          {Number(order.shipping_amount || 0) > 0 && (
                            <div className="flex justify-between">
                              <span className="text-gray-600">Shipping</span>
                              <span className="text-gray-900">{formatMoney(order.shipping_amount)}</span>
                            </div>
                          )}
                          <div className="flex justify-between font-semibold">
                            <span>Total</span>
                            <span>{formatMoney(order.amount)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="mt-4">
                      <h5 className="text-sm font-semibold text-gray-900 mb-1">Seller Notes</h5>
                      <p className="text-sm text-gray-700">{order.seller_notes || 'No seller notes yet.'}</p>
                    </div>
                  </div>
                )}

                <div className="mt-4 flex flex-wrap gap-3">
                  <Link
                    to={`/order-confirmation?order=${encodeURIComponent(String(order.id))}`}
                    className="text-orange-600 hover:text-orange-700 text-sm font-medium"
                  >
                    View Receipt
                  </Link>
                  <button
                    className={`text-sm font-medium ${order.seller_id ? 'text-red-600 hover:text-red-700' : 'text-gray-400 cursor-not-allowed'}`}
                    disabled={!order.seller_id}
                    onClick={() => {
                      if (!order.seller_id) return;
                      setDisputePrefill({
                        sellerId: String(order.seller_id),
                        orderId: String(order.id),
                        summary: `Refund or order issue: ${order.product_title}`,
                      });
                      setActiveTab('support');
                    }}
                  >
                    Request Refund / Report Issue
                  </button>
                  {String(order.status || '').trim().toLowerCase() === 'delivered' && (
                    <button className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                      Write Review
                    </button>
                  )}
                  {String(order.status || '').trim().toLowerCase() === 'pending' && (
                    <button className="text-red-600 hover:text-red-700 text-sm font-medium">
                      Cancel Order
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {activeTab === 'wishlist' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {wishlist.map((item) => (
            <div key={item.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="h-48 bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center">
                <span className="text-gray-500 text-sm">Product Image</span>
              </div>
              <div className="p-4">
                <h4 className="font-medium text-gray-900 mb-1">{item.product_title}</h4>
                <p className="text-sm text-gray-600 mb-2">by {item.seller_name}</p>
                <p className="text-lg font-bold text-orange-600 mb-4">${item.price}</p>
                
                <div className="flex space-x-2">
                  <button className="flex-1 bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors text-sm">
                    Add to Cart
                  </button>
                  <button className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                    <Heart className="w-4 h-4 text-red-500" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'affiliates' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold">Following ({followedAffiliates.length})</h3>
              <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
                Discover New Affiliates
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {followedAffiliates.map((affiliate) => (
                <div key={affiliate.id} className="border border-gray-200 rounded-lg p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-yellow-500 rounded-full flex items-center justify-center">
                        <span className="text-white font-bold text-lg">{affiliate.name.charAt(0)}</span>
                      </div>
                      <div>
                        <h4 className="font-medium text-lg">{affiliate.name}</h4>
                        <p className="text-gray-600">{affiliate.specialty}</p>
                        <div className="flex items-center space-x-1 mt-1">
                          <Star className="w-4 h-4 text-yellow-400 fill-current" />
                          <span className="text-sm">{affiliate.rating}</span>
                          <span className="text-gray-400">â€¢</span>
                          <span className="text-sm text-gray-600">{affiliate.followers} followers</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
                        <MessageSquare className="w-4 h-4 text-gray-600" />
                      </button>
                      <button className="p-2 bg-red-100 rounded-lg hover:bg-red-200 transition-colors">
                        <UserMinus className="w-4 h-4 text-red-600" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h5 className="font-medium mb-2">Your Relationship</h5>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600">Purchases:</span>
                          <span className="font-medium ml-2">{affiliate.purchases}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Total Spent:</span>
                          <span className="font-medium ml-2">${affiliate.total_spent}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Following Since:</span>
                          <span className="font-medium ml-2">{affiliate.following_since}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Last Purchase:</span>
                          <span className="font-medium ml-2">{affiliate.last_purchase}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-between items-center">
                      <button
                        type="button"
                        onClick={() => navigate('/marketplace')}
                        className="text-blue-600 hover:text-blue-700 font-medium"
                      >
                        View All Products
                      </button>
                      <div className="flex items-center space-x-2 text-sm text-gray-600">
                        <Bell className="w-4 h-4" />
                        <span>Notifications On</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold mb-4">Recommended Affiliates</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="border border-gray-200 rounded-lg p-4 text-center">
                <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-teal-500 rounded-full mx-auto mb-3 flex items-center justify-center">
                  <span className="text-white font-bold">M</span>
                </div>
                <h4 className="font-medium mb-1">Marketing Mike</h4>
                <p className="text-sm text-gray-600 mb-2">Email Marketing Expert</p>
                <div className="flex items-center justify-center space-x-1 mb-3">
                  <Star className="w-4 h-4 text-yellow-400 fill-current" />
                  <span className="text-sm">4.9</span>
                </div>
                <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm">
                  Follow
                </button>
              </div>

              <div className="border border-gray-200 rounded-lg p-4 text-center">
                <div className="w-10 h-10 bg-gradient-to-r from-pink-500 to-red-500 rounded-full mx-auto mb-3 flex items-center justify-center">
                  <span className="text-white font-bold">L</span>
                </div>
                <h4 className="font-medium mb-1">Lisa Leads</h4>
                <p className="text-sm text-gray-600 mb-2">Lead Generation Pro</p>
                <div className="flex items-center justify-center space-x-1 mb-3">
                  <Star className="w-4 h-4 text-yellow-400 fill-current" />
                  <span className="text-sm">4.8</span>
                </div>
                <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm">
                  Follow
                </button>
              </div>

              <div className="border border-gray-200 rounded-lg p-4 text-center">
                <div className="w-10 h-10 bg-gradient-to-r from-yellow-500 to-indigo-500 rounded-full mx-auto mb-3 flex items-center justify-center">
                  <span className="text-white font-bold">D</span>
                </div>
                <h4 className="font-medium mb-1">Digital Dan</h4>
                <p className="text-sm text-gray-600 mb-2">Social Media Guru</p>
                <div className="flex items-center justify-center space-x-1 mb-3">
                  <Star className="w-4 h-4 text-yellow-400 fill-current" />
                  <span className="text-sm">4.7</span>
                </div>
                <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm">
                  Follow
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'watchlist' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold">My Watchlist ({watchlist.length})</h3>
              <div className="flex space-x-2">
                <button className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                  <Filter className="w-4 h-4" />
                  <span>Filter</span>
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/marketplace')}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>Open Marketplace</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {watchlist.map((item) => (
                <div key={item.id} className="border border-gray-200 rounded-lg p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h4 className="font-medium text-lg mb-1">{item.product_title}</h4>
                      <p className="text-gray-600 text-sm mb-2">by {item.seller_name}</p>
                      <p className="text-blue-600 text-sm">Added by {item.affiliate_name}</p>
                    </div>
                    <button className="p-2 bg-red-100 rounded-lg hover:bg-red-200 transition-colors">
                      <X className="w-4 h-4 text-red-600" />
                    </button>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-2xl font-bold text-gray-900">${item.current_price}</span>
                      {item.original_price && item.original_price > item.current_price && (
                        <div className="text-right">
                          <span className="text-sm text-gray-500 line-through">${item.original_price}</span>
                          <span className="ml-2 bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs">
                            {Math.round((1 - item.current_price / item.original_price) * 100)}% OFF
                          </span>
                        </div>
                      )}
                    </div>

                    {item.price_drop && (
                      <div className="bg-green-50 p-3 rounded-lg">
                        <div className="flex items-center space-x-2">
                          <TrendingDown className="w-4 h-4 text-green-600" />
                          <span className="text-sm font-medium text-green-800">
                            Price dropped by ${item.price_drop} since you added it!
                          </span>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-sm text-gray-600">
                      <span>Added {item.added_date}</span>
                      <div className="flex items-center space-x-2">
                        <Bell className="w-4 h-4" />
                        <span>Price alerts on</span>
                      </div>
                    </div>

                    <div className="flex space-x-2">
                      <button className="flex-1 bg-orange-600 text-white py-2 rounded-lg hover:bg-orange-700 transition-colors">
                        Buy Now
                      </button>
                      <button className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg hover:bg-gray-200 transition-colors">
                        View Details
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold mb-4">Watchlist Insights</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <TrendingDown className="w-6 h-6 text-blue-600 mx-auto mb-2" />
                <div className="text-2xl font-bold text-blue-600">3</div>
                <div className="text-sm text-gray-600">Price Drops This Week</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <DollarSign className="w-6 h-6 text-green-600 mx-auto mb-2" />
                <div className="text-2xl font-bold text-green-600">${watchlistSavings.toFixed(0)}</div>
                <div className="text-sm text-gray-600">Total Savings Available</div>
              </div>
              <div className="text-center p-4 bg-yellow-50 rounded-lg">
                <Clock className="w-6 h-6 text-yellow-600 mx-auto mb-2" />
                <div className="text-2xl font-bold text-yellow-600">2</div>
                <div className="text-sm text-gray-600">Limited Time Offers</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'community' && (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-xl border border-blue-200">
            <h3 className="text-xl font-bold text-blue-900 mb-2">ðŸŒŸ Join the Community</h3>
            <p className="text-blue-800">Connect with other buyers, share experiences, and discover new products together!</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <h3 className="text-lg font-semibold mb-4">Latest Discussions</h3>
              <div className="space-y-4">
                <div className="border-l-4 border-blue-500 pl-4">
                  <h4 className="font-medium mb-1">Best Digital Marketing Courses?</h4>
                  <p className="text-sm text-gray-600 mb-2">Looking for recommendations from Sarah M.'s courses...</p>
                  <div className="flex items-center space-x-4 text-xs text-gray-500">
                    <span>12 replies</span>
                    <span>2 hours ago</span>
                    <span>by @marketingpro</span>
                  </div>
                </div>

                <div className="border-l-4 border-green-500 pl-4">
                  <h4 className="font-medium mb-1">Email Templates That Convert</h4>
                  <p className="text-sm text-gray-600 mb-2">Sharing my favorite templates from John's course...</p>
                  <div className="flex items-center space-x-4 text-xs text-gray-500">
                    <span>8 replies</span>
                    <span>4 hours ago</span>
                    <span>by @emailexpert</span>
                  </div>
                </div>

                <div className="border-l-4 border-yellow-500 pl-4">
                  <h4 className="font-medium mb-1">Social Media Success Stories</h4>
                  <p className="text-sm text-gray-600 mb-2">How I grew my following using techniques from...</p>
                  <div className="flex items-center space-x-4 text-xs text-gray-500">
                    <span>15 replies</span>
                    <span>1 day ago</span>
                    <span>by @socialmaven</span>
                  </div>
                </div>
              </div>

              <button className="w-full mt-4 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors">
                View All Discussions
              </button>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <h3 className="text-lg font-semibold mb-4">Community Features</h3>
              <div className="space-y-4">
                <div className="flex items-center space-x-4 p-3 bg-blue-50 rounded-lg">
                  <MessageSquare className="w-6 h-6 text-blue-600" />
                  <div>
                    <h4 className="font-medium">Discussion Forums</h4>
                    <p className="text-sm text-gray-600">Ask questions and share knowledge</p>
                  </div>
                </div>

                <div className="flex items-center space-x-4 p-3 bg-green-50 rounded-lg">
                  <Users className="w-6 h-6 text-green-600" />
                  <div>
                    <h4 className="font-medium">Study Groups</h4>
                    <p className="text-sm text-gray-600">Learn together with other buyers</p>
                  </div>
                </div>

                <div className="flex items-center space-x-4 p-3 bg-yellow-50 rounded-lg">
                  <BookOpen className="w-6 h-6 text-yellow-600" />
                  <div>
                    <h4 className="font-medium">Resource Library</h4>
                    <p className="text-sm text-gray-600">Shared templates and guides</p>
                  </div>
                </div>

                <div className="flex items-center space-x-4 p-3 bg-orange-50 rounded-lg">
                  <Calendar className="w-6 h-6 text-orange-600" />
                  <div>
                    <h4 className="font-medium">Live Events</h4>
                    <p className="text-sm text-gray-600">Webinars and Q&A sessions</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold mb-4">Your Community Stats</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <MessageSquare className="w-6 h-6 text-blue-600 mx-auto mb-2" />
                <div className="text-2xl font-bold text-blue-600">23</div>
                <div className="text-sm text-gray-600">Posts Made</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <ThumbsUp className="w-6 h-6 text-green-600 mx-auto mb-2" />
                <div className="text-2xl font-bold text-green-600">147</div>
                <div className="text-sm text-gray-600">Likes Received</div>
              </div>
              <div className="text-center p-4 bg-yellow-50 rounded-lg">
                <Users className="w-6 h-6 text-yellow-600 mx-auto mb-2" />
                <div className="text-2xl font-bold text-yellow-600">89</div>
                <div className="text-sm text-gray-600">Community Friends</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'support' && (
        <IssueCenterPage
          embedded
          initialSellerId={disputePrefill?.sellerId || null}
          initialOrderId={disputePrefill?.orderId || null}
          initialSummary={disputePrefill?.summary || null}
        />
      )}

    </div>
  );
};

export default EnhancedBuyerDashboard;
