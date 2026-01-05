import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContextMultiRole';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { sanitizeDescriptionForDisplay } from '../utils/sanitizeDescription';
import { resolveProfileIdForUser } from '../utils/resolveProfileId';
import StoreCustomization from './StoreCustomization';
import StripeSellerDashboard from './StripeSellerDashboard';
import StripeAffiliateDashboard from './StripeAffiliateDashboard';
import CJProductImportPage from '../pages/CJProductImportPage';
import { canAccessCJImport } from '../utils/cjImportAccess';
import { QRCodeSVG } from 'qrcode.react';
import UniversalInbox from './UniversalInbox';
import { apiPost } from '../utils/netlifyApi';

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
  seller_id?: string;
  lineage?: string;
  is_active?: boolean;
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

type SellingProduct = {
  product: Product;
  shareLink: string;
  linkCode?: string;
};

const UnifiedMegaDashboard: React.FC = () => {
  const { user, profile, session, userRoles, currentRole, hasRole } = useAuth();
  const navigate = useNavigate();
  
  // Debug log to verify component is loading
  console.log('🎉 UnifiedMegaDashboard loaded! User:', user?.email, 'Role:', profile?.role);
  
  // All state management
  const [activeTab, setActiveTab] = useState<'overview' | 'products' | 'cj-import' | 'orders' | 'earnings' | 'affiliate' | 'inbox' | 'analytics' | 'store' | 'payments'>('overview');
  const [products, setProducts] = useState<Product[]>([]);
  const [sellingProducts, setSellingProducts] = useState<SellingProduct[]>([]);
  const [productScope, setProductScope] = useState<'mine' | 'all'>('mine');
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
  const loadingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Role derivation with safe fallback
  const derivedRole = profile?.primary_role || profile?.role || currentRole || 'buyer';
  const normalizedRoles = (userRoles || []).map((r) => String(r).toLowerCase());
  const hasSellerRole =
    String(derivedRole).toLowerCase() === 'seller' || normalizedRoles.includes('seller') || hasRole?.('seller');
  const hasAffiliateRole =
    String(derivedRole).toLowerCase() === 'affiliate' || normalizedRoles.includes('affiliate') || hasRole?.('affiliate');
  const hasFundraiserRole =
    String(derivedRole).toLowerCase() === 'fundraiser' || normalizedRoles.includes('fundraiser') || hasRole?.('fundraiser');

  const isSeller = hasSellerRole || hasFundraiserRole;
  const isAffiliate = hasAffiliateRole || hasFundraiserRole;
  const isBuyer = derivedRole === 'buyer';
  // EVERYONE CAN ACCESS EVERYTHING (business rule)
  const canSellProducts = true;
  const canEarnCommissions = true;
  
  // Admin check using direct email comparison (bypasses profile timeout)
  const isAdmin = canAccessCJImport(user?.email);

  // Profile reads can time out; use Stripe status Edge Function as a fallback signal.
  const [stripeConnectedOverride, setStripeConnectedOverride] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) return;
    if (profile?.stripe_account_id) {
      setStripeConnectedOverride(true);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const data = await apiPost<any>('/api/stripe/account-status', session ?? null, {});
        if (cancelled) return;

        if ((data as any)?.account_id) {
          setStripeConnectedOverride(true);
        }
      } catch {
        // Ignore and fall back to profile-based state.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [profile?.stripe_account_id, session, user?.id]);

  const profileIsFallback = Boolean((profile as any)?.__is_fallback);
  const needsStripeConnect =
    !profileIsFallback && stripeConnectedOverride !== true && !profile?.stripe_account_id;

  useEffect(() => {
    if (isAdmin) {
      setProductScope('all');
    }
  }, [isAdmin]);

  useEffect(() => {
    if (user) {
      fetchAllData();
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchProducts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productScope, user?.id, profile?.id, isAdmin]);

  useEffect(() => {
    if (user && profile?.id) {
      fetchSellingProducts();
    } else {
      setSellingProducts([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, profile?.id, derivedRole]);

  useEffect(() => {
    if (loading) {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
      loadingTimeoutRef.current = setTimeout(() => {
        console.warn('Dashboard: loading forced to false after timeout');
        setLoading(false);
      }, 3000);
    } else if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
      loadingTimeoutRef.current = null;
    }

    return () => {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }
    };
  }, [loading]);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchProducts(),
        fetchSellingProducts(),
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

  const fetchSellingProducts = async () => {
    const promoterProfileId = (profile as any)?.id as string | undefined;
    if (!user || !promoterProfileId) {
      setSellingProducts([]);
      return;
    }

    // Pull from the role-specific “store listing” tables.
    // - Affiliates: affiliate_products
    // - Fundraisers: fundraiser_products
    // - Sellers: seller_product_order
    try {
      const productIdSet = new Set<string>();

      if (hasSellerRole) {
        try {
          const { data } = await supabase
            .from('seller_product_order')
            .select('product_id')
            .eq('seller_id', promoterProfileId);
          (data || []).forEach((row: any) => {
            if (row?.product_id) productIdSet.add(String(row.product_id));
          });
        } catch (e) {
          console.warn('[UnifiedMegaDashboard] seller_product_order fetch failed (non-fatal):', e);
        }
      }

      if (hasFundraiserRole) {
        try {
          const { data } = await supabase
            .from('fundraiser_products')
            .select('product_id')
            .eq('fundraiser_id', promoterProfileId);
          (data || []).forEach((row: any) => {
            if (row?.product_id) productIdSet.add(String(row.product_id));
          });
        } catch (e) {
          console.warn('[UnifiedMegaDashboard] fundraiser_products fetch failed (non-fatal):', e);
        }
      }

      if (hasAffiliateRole) {
        try {
          const { data } = await supabase
            .from('affiliate_products')
            .select('product_id')
            .eq('affiliate_id', promoterProfileId);
          (data || []).forEach((row: any) => {
            if (row?.product_id) productIdSet.add(String(row.product_id));
          });
        } catch (e) {
          console.warn('[UnifiedMegaDashboard] affiliate_products fetch failed (non-fatal):', e);
        }
      }

      const productIds = Array.from(productIdSet);
      if (productIds.length === 0) {
        setSellingProducts([]);
        return;
      }

      const { data: productRows, error: productsError } = await supabase
        .from('products')
        .select('*')
        .in('id', productIds)
        .eq('is_active', true);

      if (productsError) throw productsError;

      // Best-effort load persisted share links (used by affiliates/fundraisers and optionally sellers).
      const linkMap = new Map<string, { full_url?: string; link_code?: string }>();
      try {
        const { data: linksData } = await supabase
          .from('affiliate_links')
          .select('product_id, full_url, link_code, is_active')
          .eq('affiliate_id', promoterProfileId)
          .in('product_id', productIds);

        (linksData || []).forEach((row: any) => {
          if (!row?.product_id) return;
          if (row?.is_active === false) return;
          linkMap.set(String(row.product_id), {
            full_url: row.full_url ?? undefined,
            link_code: row.link_code ?? undefined,
          });
        });
      } catch (e) {
        console.warn('[UnifiedMegaDashboard] affiliate_links fetch failed (non-fatal):', e);
      }

      const origin = window.location.origin;

      const merged: SellingProduct[] = (productRows || []).map((p: any) => {
        const link = linkMap.get(String(p.id));
        const shareLink =
          link?.full_url ||
          `${origin}/product/${p.id}?ref=${promoterProfileId}${link?.link_code ? `&code=${encodeURIComponent(String(link.link_code))}` : ''}`;
        return {
          product: p as Product,
          shareLink,
          linkCode: link?.link_code,
        };
      });

      // Stable order: newest first
      merged.sort((a, b) => {
        const aCreated = new Date((a.product as any)?.created_at || 0).getTime();
        const bCreated = new Date((b.product as any)?.created_at || 0).getTime();
        return bCreated - aCreated;
      });

      setSellingProducts(merged);
    } catch (error) {
      console.error('[UnifiedMegaDashboard] Error fetching selling products:', error);
      setSellingProducts([]);
    }
  };

  const fetchProducts = async () => {
    if (!user) return;
    
    try {
      const query = supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });

      let sellerProfileId = (profile as any)?.id as string | undefined;
      if (!sellerProfileId) {
        try {
          sellerProfileId = await resolveProfileIdForUser(user.id);
        } catch {
          sellerProfileId = undefined;
        }
      }

      const { data, error } = isAdmin && productScope === 'all'
        ? await query
        : await query.eq('seller_id', sellerProfileId || user.id);

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
      // Use server-side ledger (based on payment distributions) to avoid schema drift.
      const { data, error } = await supabase.functions.invoke('get-sales-ledger', { body: { limit: 10 } });
      if (error) throw error;

      const rows = Array.isArray((data as any)?.sales) ? (data as any).sales : [];
      const formattedOrders = rows.map((row: any) => ({
        id: String(row.order_id || ''),
        customer_name: row.buyer_name || 'Customer',
        customer_email: row.buyer_email || '',
        product_title: 'Order',
        amount: Number(row.total_amount || 0),
        status: String(row.fulfillment_status || row.status || 'processing'),
        created_at: row.created_at || new Date().toISOString(),
        tracking_number: ''
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
      const affiliateProfileId = await resolveProfileIdForUser(user.id);

      // Prefer the unified payout ledger (payment_distributions) to avoid schema drift around `commissions`.
      // This also aligns with Beezio's "bi-monthly" payout cadence (commissions are accrued, not instantly paid).
      let rows: any[] = [];
      try {
        const { data, error } = await supabase
          .from('payment_distributions')
          .select('id, amount, status, created_at, order_id')
          .eq('recipient_type', 'affiliate')
          .eq('recipient_id', affiliateProfileId)
          .order('created_at', { ascending: false })
          .limit(10);
        if (error) throw error;
        rows = (data as any[]) || [];
      } catch (e: any) {
        // Fallback for older schemas missing order_id, etc.
        const { data } = await supabase
          .from('payment_distributions')
          .select('id, amount, status, created_at')
          .eq('recipient_type', 'affiliate')
          .eq('recipient_id', affiliateProfileId)
          .order('created_at', { ascending: false })
          .limit(10);
        rows = (data as any[]) || [];
      }

      const formattedCommissions = rows.map((row: any) => ({
        id: String(row.id || ''),
        product_title: row.order_id ? `Order ${String(row.order_id).slice(0, 8)}…` : 'Order',
        commission_amount: Number(row.amount || 0),
        sale_date: row.created_at || new Date().toISOString(),
        status: String(row.status || 'pending'),
        customer_email: ''
      }));

      setCommissions(formattedCommissions as any);
    } catch (error) {
      console.error('Error fetching commissions:', error);
      setCommissions([]);
    }
  };

  const fetchStats = async () => {
    if (!user) return;
    
    try {
      // Fetch seller stats from the same ledger used by the Orders tab.
      let salesData: any[] = [];
      try {
        const { data: ledgerData, error: ledgerError } = await supabase.functions.invoke('get-sales-ledger', { body: { limit: 50 } });
        if (!ledgerError) {
          salesData = Array.isArray((ledgerData as any)?.sales) ? (ledgerData as any).sales : [];
        }
      } catch {
        salesData = [];
      }

      // Fetch affiliate stats (schema-safe Edge Function)
      let earnings: any = {};
      try {
        const affiliateEarnings = await apiPost<any>('/api/user-earnings', session ?? null, { role: 'affiliate' });
        earnings = (affiliateEarnings as any)?.earnings || {};
      } catch {
        earnings = {};
      }
      const totalEarnings = Number(earnings.total_earned || 0);
      // Prefer pending_payout; fall back to current_balance when pending_payout isn't tracked.
      const pendingEarnings = Number(
        earnings.pending_payout ?? earnings.current_balance ?? 0
      );

      const totalRevenue = salesData?.reduce((sum, order) => sum + (order.total_amount || 0), 0) || 0;

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

  const handleToggleListing = async (product: Product) => {
    const sellerProfileId = (profile as any)?.id as string | undefined;
    const isOwner = Boolean(sellerProfileId) && product.seller_id === sellerProfileId;

    // Sellers can only change their own listings; admins can change any.
    if (!isAdmin && !isOwner) {
      alert('You can only manage products you created.');
      return;
    }

    const isListed = product.is_active !== false;
    const nextIsActive = !isListed;
    if (!nextIsActive && !confirm('Unlist this product from the marketplace?')) return;

    try {
      let upd = supabase.from('products').update({ is_active: nextIsActive }).eq('id', product.id);
      if (!isAdmin) {
        upd = upd.eq('seller_id', sellerProfileId || user?.id || '');
      }

      const { error } = await upd;
      if (error) throw error;

      setProducts((prev) => prev.map((p) => (p.id === product.id ? { ...p, is_active: nextIsActive } : p)));
      alert(nextIsActive ? 'Relisted.' : 'Unlisted.');
    } catch (error) {
      console.error('Error updating listing:', error);
      alert('Failed to update listing');
    }
  };

  const generateAffiliateLink = (productId: string) => {
    const promoter = (profile as any)?.id || user?.id || '';
    return `${window.location.origin}/product/${productId}?ref=${promoter}`;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  // Tab configuration
  const tabs = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard, show: true },
    { id: 'products', label: 'Products', icon: Package, show: canSellProducts },
    { id: 'cj-import', label: 'CJ Import', icon: Package, show: isAdmin },
    { id: 'orders', label: 'Orders', icon: ShoppingCart, show: canSellProducts || isBuyer },
    { id: 'earnings', label: 'Earnings', icon: DollarSign, show: canEarnCommissions },
    { id: 'affiliate', label: 'Affiliate Tools', icon: Link, show: canEarnCommissions },
    { id: 'inbox', label: 'Inbox', icon: MessageSquare, show: true },
    { id: 'analytics', label: 'Analytics', icon: BarChart3, show: true },
    { id: 'store', label: 'Store Settings', icon: Store, show: canSellProducts || isAffiliate },
    { id: 'payments', label: 'Payments', icon: CreditCard, show: true }
  ].filter(tab => tab.show);

  return (
    <div className="relative min-h-screen bg-white">
      {loading && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#ffcb05] mx-auto mb-4"></div>
            <p className="text-gray-700 font-medium">Updating your dashboard...</p>
          </div>
        </div>
      )}

      {/* Dashboard Header (global) */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <div className="bg-white border border-black/10 rounded-2xl shadow-sm p-5 md:p-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <div className="bzo-mascot text-3xl leading-none">🐝</div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#7a5b00] mb-1">Dashboard</p>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Beezio Control Panel</h1>
              <p className="text-sm text-gray-700">Buyer • Seller • Affiliate • Fundraiser</p>
            </div>
          </div>
          <div className="text-left md:text-right space-y-1">
            <p className="text-sm font-semibold text-gray-900">Welcome back, {profile?.full_name || user?.email?.split('@')[0] || 'User'}</p>
            <p className="text-xs text-gray-600">Member since {new Date(user?.created_at || Date.now()).toLocaleDateString()}</p>
            <div className="inline-flex items-center gap-2">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-[#fff4c1] text-[#5a4300]">
                {(profile?.primary_role || profile?.role || 'User').toUpperCase()}
              </span>
              <span className="text-xs text-gray-500">{user?.email}</span>
            </div>
          </div>
        </div>

        {needsStripeConnect && (
          <div className="mt-4 bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold text-amber-900">Connect Stripe to get paid</p>
              <p className="text-xs text-amber-800">
                Sellers, affiliates, and admins need a Stripe Connect account for payouts and commissions.
              </p>
            </div>
            <button
              onClick={() => navigate('/onboarding')}
              className="inline-flex items-center justify-center px-4 py-2 rounded-full bg-[#101820] text-white text-sm font-semibold hover:bg-gray-800"
            >
              Set up Stripe
            </button>
          </div>
        )}
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* BZO Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {canSellProducts && (
            <>
              <div className="card-bzo p-6 border-l-4 border-bzo-yellow-primary hover:border-bzo-yellow-secondary">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-600">Total Sales</p>
                    <p className="text-3xl font-bold text-bzo-black mt-2">{stats.total_sales}</p>
                  </div>
                  <div className="bg-bzo-yellow-light rounded-full p-3">
                    <ShoppingCart className="w-8 h-8 text-bzo-yellow-primary" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-[#ffc400]">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">${stats.total_revenue.toFixed(2)}</p>
                  </div>
                  <div className="bg-[#fff4c1] rounded-full p-3">
                    <DollarSign className="w-8 h-8 text-[#7a5b00]" />
                  </div>
                </div>
              </div>
            </>
          )}

          {canEarnCommissions && (
            <>
              <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-[#ffcb05]">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Earnings</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">${stats.total_earnings.toFixed(2)}</p>
                  </div>
                  <div className="bg-[#fff4c1] rounded-full p-3">
                    <Award className="w-8 h-8 text-[#7a5b00]" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-[#ffe567]">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Pending Earnings</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">${stats.pending_earnings.toFixed(2)}</p>
                  </div>
                  <div className="bg-[#fff9da] rounded-full p-3">
                    <Clock className="w-8 h-8 text-[#7a5b00]" />
                  </div>
                </div>
              </div>
            </>
          )}

          {isBuyer && (
            <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-[#ffc400]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">My Orders</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">{orders.length}</p>
                </div>
                <div className="bg-[#fff4c1] rounded-full p-3">
                  <Package className="w-8 h-8 text-[#7a5b00]" />
                </div>
              </div>
            </div>
          )}
        </div>

          {/* Tabs Navigation */}
          <div className="bg-white rounded-xl shadow-lg mb-8 overflow-hidden">
          <div className="border-b border-gray-200 overflow-x-auto sm:overflow-visible">
            <nav className="bzo-dashboard-tabs grid grid-cols-2 sm:flex sm:flex-nowrap gap-2 p-3 sm:px-6">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex items-center justify-center sm:justify-start gap-2 w-full sm:w-auto px-3 py-3 sm:px-6 sm:py-4 border font-semibold text-xs sm:text-sm transition-all whitespace-normal sm:whitespace-nowrap text-center sm:text-left ${
                      activeTab === tab.id
                        ? 'border-[#ffcb05] text-[#5a4300] bg-[#fff9da] sm:border-b-[#ffcb05] sm:border-b-4 sm:border-x-0 sm:border-t-0'
                        : 'border-gray-200 text-gray-700 hover:text-[#5a4300] hover:border-[#ffcb05]/60 hover:bg-[#fff9da]/60 sm:text-gray-500 sm:border-b-4 sm:border-x-0 sm:border-t-0 sm:border-b-transparent'
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
                        className="bg-[#ffcb05] text-black p-6 rounded-xl shadow-lg hover:shadow-xl transition-all hover:scale-105"
                      >
                        <Plus className="w-8 h-8 mb-2 text-black" />
                        <h3 className="text-lg font-bold">Add New Product</h3>
                        <p className="text-sm text-black/70 mt-1">List a new product for sale</p>
                      </button>
                    )}
                    
                    <button
                      onClick={() => setActiveTab('store')}
                      className="bg-[#101820] text-[#ffcb05] p-6 rounded-xl shadow-lg hover:shadow-xl transition-all hover:scale-105"
                    >
                      <Store className="w-8 h-8 mb-2 text-[#ffcb05]" />
                      <h3 className="text-lg font-bold text-[#ffcb05]">Customize Store</h3>
                      <p className="text-sm text-[#ffcb05] mt-1">Set up your custom domain</p>
                    </button>

                    <button
                      onClick={() => setActiveTab('analytics')}
                      className="bg-[#ffcb05] text-black p-6 rounded-xl shadow-lg hover:shadow-xl transition-all hover:scale-105"
                    >
                      <BarChart3 className="w-8 h-8 mb-2 text-black" />
                      <h3 className="text-lg font-bold">View Analytics</h3>
                      <p className="text-sm text-black/70 mt-1">Track your performance</p>
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
                                order.status === 'processing' ? 'bg-[#fff4c1] text-[#5a4300]' :
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
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">{isAdmin && productScope === 'all' ? 'All Products' : 'My Products'}</h2>
                    <p className="text-sm text-gray-600 mt-1">
                      {isAdmin ? 'Admins can delete any product from the marketplace.' : 'Delete removes the product from the marketplace.'}
                    </p>
                  </div>
                  {isAdmin && (
                    <div className="inline-flex rounded-xl border border-gray-200 overflow-hidden">
                      <button
                        onClick={() => setProductScope('all')}
                        className={`${productScope === 'all' ? 'bg-[#101820] text-white' : 'bg-white text-gray-700'} px-4 py-2 text-sm font-semibold`}
                      >
                        All
                      </button>
                      <button
                        onClick={() => setProductScope('mine')}
                        className={`${productScope === 'mine' ? 'bg-[#101820] text-white' : 'bg-white text-gray-700'} px-4 py-2 text-sm font-semibold`}
                      >
                        Mine
                      </button>
                    </div>
                  )}
                  <button
                    onClick={handleAddProduct}
                    className="flex items-center gap-2 bg-[#101820] text-white px-6 py-3 rounded-xl font-semibold hover:bg-black transition-all shadow-lg"
                  >
                    <Plus className="w-5 h-5" />
                    Add Product
                  </button>
                </div>

                {/* Products I'm Selling (resold/promoted) */}
                {!isAdmin && sellingProducts.length > 0 && (
                  <div className="bg-[#fff9da] border border-black/10 rounded-2xl p-6">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div>
                        <h3 className="text-xl font-bold text-gray-900">Products I’m Selling</h3>
                        <p className="text-sm text-gray-700">Share your link or QR code to earn on every sale.</p>
                      </div>
                      <a
                        href="/marketplace"
                        className="inline-flex items-center gap-2 bg-[#101820] text-[#ffcb05] px-4 py-2 rounded-xl font-semibold hover:bg-black"
                      >
                        <Link className="w-4 h-4" />
                        Find More Products
                      </a>
                    </div>

                    <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {sellingProducts.slice(0, 12).map(({ product, shareLink }) => (
                        <div key={product.id} className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200">
                          {product.images?.[0] && (
                            <img
                              src={product.images[0]}
                              alt={product.title}
                              className="w-full h-40 object-cover"
                            />
                          )}
                          <div className="p-5">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <h4 className="text-base font-bold text-gray-900 truncate">{product.title}</h4>
                                <p className="text-sm text-gray-600">${Number(product.price || 0).toFixed(2)}</p>
                              </div>
                              <div className="bg-white rounded-lg border border-gray-200 p-2">
                                <QRCodeSVG value={shareLink} size={72} />
                              </div>
                            </div>

                            <div className="mt-3">
                              <div className="text-xs font-semibold text-gray-700 mb-1">Your link</div>
                              <div className="text-xs text-gray-700 font-mono break-all bg-gray-50 border border-gray-200 rounded-lg p-2">
                                {shareLink}
                              </div>
                              <div className="mt-3 flex gap-2">
                                <button
                                  onClick={() => copyToClipboard(shareLink)}
                                  className="flex-1 bg-[#101820] text-[#ffcb05] px-4 py-2 rounded-lg font-semibold hover:bg-black inline-flex items-center justify-center gap-2"
                                >
                                  <Copy className="w-4 h-4" />
                                  Copy
                                </button>
                                <a
                                  href={shareLink}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="px-4 py-2 rounded-lg font-semibold border border-gray-300 text-gray-900 hover:border-[#ffcb05] inline-flex items-center justify-center"
                                  title="Open link"
                                >
                                  <ExternalLink className="w-4 h-4" />
                                </a>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {products.length === 0 ? (
                  <div className="text-center py-12 bg-gray-50 rounded-xl">
                    <Package className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">No products yet</h3>
                    <p className="text-gray-600 mb-6">Start selling by adding your first product</p>
                    <button
                      onClick={handleAddProduct}
                      className="bg-[#101820] text-white px-8 py-3 rounded-xl font-semibold hover:bg-black"
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
                          <p className="text-gray-600 text-sm mb-4 line-clamp-2">{sanitizeDescriptionForDisplay(product.description, (product as any).lineage)}</p>
                          <div className="flex items-center justify-between mb-4">
                            <span className="text-2xl font-bold text-gray-900">${product.price}</span>
                            <span className={`text-xs px-2 py-1 rounded-full font-semibold ${
                              product.is_active !== false ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {product.is_active !== false ? 'Listed' : 'Unlisted'}
                            </span>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleEditProduct(product.id)}
                              className="flex-1 bg-[#ffcb05] text-black px-4 py-2 rounded-lg font-semibold hover:bg-[#e0b000] flex items-center justify-center gap-2"
                            >
                              <Edit className="w-4 h-4" />
                              Edit
                            </button>
                            <button
                              onClick={() => handleToggleListing(product)}
                              className={`px-4 py-2 rounded-lg font-semibold ${
                                product.is_active !== false
                                  ? 'bg-red-500 text-white hover:bg-red-600'
                                  : 'bg-[#101820] text-[#ffcb05] hover:bg-black'
                              }`}
                              title={product.is_active !== false ? 'Unlist product' : 'Relist product'}
                            >
                              {product.is_active !== false ? 'Unlist' : 'Relist'}
                            </button>
                          </div>

                          {/* Per-product affiliate link (so affiliates can grab the right URL per product) */}
                          {(isAffiliate || canEarnCommissions) && (
                            <div className="mt-4 border-t border-gray-200 pt-4">
                              <div className="text-xs font-semibold text-gray-700 mb-1">Your affiliate link</div>
                              <div className="flex items-start gap-2">
                                <div className="flex-1 text-xs text-gray-700 font-mono break-all bg-gray-50 border border-gray-200 rounded-lg p-2">
                                  {generateAffiliateLink(product.id)}
                                </div>
                                <button
                                  onClick={() => copyToClipboard(generateAffiliateLink(product.id))}
                                  className="shrink-0 bg-[#101820] text-[#ffcb05] px-3 py-2 rounded-lg font-semibold hover:bg-black inline-flex items-center gap-2"
                                  title="Copy affiliate link"
                                >
                                  <Copy className="w-4 h-4" />
                                  Copy
                                </button>
                              </div>
                            </div>
                          )}
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
                                order.status === 'processing' ? 'bg-[#fff4c1] text-[#5a4300]' :
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
                  <div className="bg-[#101820] text-[#ffcb05] rounded-xl p-6 shadow-lg">
                    <p className="text-sm font-medium text-[#ffcb05]/80 mb-2">Total Earnings</p>
                    <p className="text-4xl font-bold">${stats.total_earnings.toFixed(2)}</p>
                  </div>
                  <div className="bg-[#ffcb05] text-black rounded-xl p-6 shadow-lg">
                    <p className="text-sm font-medium text-black/70 mb-2">Pending</p>
                    <p className="text-4xl font-bold">${stats.pending_earnings.toFixed(2)}</p>
                  </div>
                  <div className="bg-white border border-black/10 rounded-xl p-6 shadow-lg">
                    <p className="text-sm font-medium text-gray-600 mb-2">Total Sales</p>
                    <p className="text-4xl font-bold text-gray-900">{commissions.length}</p>
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
                                commission.status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-[#fff4c1] text-[#5a4300]'
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

                <div className="bg-white rounded-xl shadow-lg p-6 border border-black/5">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Recruit Affiliates</h3>
                  <p className="text-gray-600 mb-4">
                    Share your link or code so others sign up under you.
                  </p>

                  {(() => {
                    const code = (profile as any)?.referral_code || (profile as any)?.username || (profile as any)?.id || user?.id || '';
                    const link = `${window.location.origin}/affiliate-signup?role=affiliate&recruit=${encodeURIComponent(String(code))}`;
                    return (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                          <div className="text-sm font-semibold text-gray-800 mb-1">Referral link</div>
                          <div className="text-sm text-gray-700 font-mono break-all">{link}</div>
                          <button
                            onClick={() => copyToClipboard(link)}
                            className="mt-3 bg-[#101820] text-[#ffcb05] px-4 py-2 rounded-lg font-semibold hover:bg-black inline-flex items-center gap-2"
                          >
                            <Copy className="w-4 h-4" />
                            Copy Link
                          </button>
                        </div>

                        <div className="bg-[#fff9da] rounded-lg p-4 border border-black/10">
                          <div className="text-sm font-semibold text-gray-800 mb-1">Referral code</div>
                          <div className="text-2xl font-bold text-[#101820] tracking-wide">{String(code)}</div>
                          <button
                            onClick={() => copyToClipboard(String(code))}
                            className="mt-3 bg-[#ffcb05] text-black px-4 py-2 rounded-lg font-semibold hover:bg-[#e0b000] inline-flex items-center gap-2"
                          >
                            <Copy className="w-4 h-4" />
                            Copy Code
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                </div>
                
                <div className="bg-[#fff9da] border border-black/10 rounded-xl p-6 mb-8">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Product links</h3>
                  <p className="text-gray-700">
                    Use the Products tab to copy the affiliate link shown under each product so you always grab the right URL.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white rounded-xl shadow-lg p-6 border border-black/5">
                    <QrCode className="w-12 h-12 text-[#101820] mb-4" />
                    <h3 className="text-xl font-bold text-gray-900 mb-2">QR Codes</h3>
                    <p className="text-gray-600 mb-4">Generate QR codes for your affiliate links</p>
                    <button className="bg-[#ffcb05] text-black px-6 py-2 rounded-lg font-semibold hover:bg-[#e0b000]">
                      Generate QR Code
                    </button>
                  </div>

                  <div className="bg-white rounded-xl shadow-lg p-6 border border-black/5">
                    <MessageSquare className="w-12 h-12 text-[#101820] mb-4" />
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Marketing Materials</h3>
                    <p className="text-gray-600 mb-4">Download banners and promotional content</p>
                    <button className="bg-[#101820] text-[#ffcb05] px-6 py-2 rounded-lg font-semibold hover:bg-black">
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

            {/* INBOX TAB */}
            {activeTab === 'inbox' && (
              <div className="space-y-6">
                <UniversalInbox />
              </div>
            )}

            {/* STORE SETTINGS TAB */}
            {activeTab === 'store' && (canSellProducts || isAffiliate) && user && (
              <div>
                <StoreCustomization 
                  userId={user.id} 
                  role={String(profile?.primary_role || profile?.role || currentRole || '').toLowerCase() === 'affiliate' || String(profile?.primary_role || profile?.role || currentRole || '').toLowerCase() === 'fundraiser' ? 'affiliate' : 'seller'} 
                />
              </div>
            )}

            {/* CJ IMPORT TAB */}
            {activeTab === 'cj-import' && isAdmin && (
              <div className="space-y-6">
                <CJProductImportPage />
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
