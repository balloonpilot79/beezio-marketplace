import React, { useMemo, useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContextMultiRole';
import { useAffiliate } from '../contexts/AffiliateContext';
import { supabase } from '../lib/supabase';
import { apiPost } from '../utils/netlifyApi';
import { resolveProfileIdForUser } from '../utils/resolveProfileId';
import { getBuyerFacingProductPrice } from '../utils/buyerPrice';
import { resolveAffiliateCommission } from '../utils/pricing';
import UniversalIntegrationsPage from './UniversalIntegrationsPage';
import SingleProductPromoStudio from './affiliate/SingleProductPromoStudio';
import StoreCustomization from './StoreCustomization';
import AccountPayoutDashboard from './AccountPayoutDashboard';
import { Copy, ExternalLink, TrendingUp, DollarSign, Users, Calendar, QrCode, Download, Target, BookOpen, BarChart3, Zap, Lightbulb, Clock, MapPin, Heart, Search, ShoppingBag, Settings, Link } from 'lucide-react';

interface AffiliateStats {
  total_earnings: number;
  pending_earnings: number;
  total_sales: number;
  conversion_rate: number;
  active_links: number;
}

interface Commission {
  id: string;
  order_id?: string | null;
  product_title: string;
  commission_amount: number;
  sale_date: string;
  status: 'pending' | 'paid';
  customer_email: string;
}

interface AffiliateSaleHighlight {
  id: string;
  order_id?: string | null;
  product_title: string;
  earned_amount: number;
  sale_date: string;
  status: 'pending' | 'paid';
}

interface Product {
  id: string;
  title: string;
  description: string;
  price: number;
  commission_rate: number;
  commission_type: 'percentage' | 'fixed';
  category: string;
  image_url?: string;
  seller_name: string;
}

interface TrafficSource {
  source: string;
  clicks: number;
  conversions: number;
  earnings: number;
}

interface InsuranceAffiliateStats {
  total_clicks: number;
  month_clicks: number;
  total_leads: number;
  delivered_leads: number;
  leads_in_review: number;
  rejected_leads: number;
  conversion_rate: number;
  total_earned: number;
  pending_earned: number;
  month_earned: number;
}

interface InsuranceAffiliateLead {
  id: string;
  vertical: string;
  status: string;
  review_status: string;
  created_at: string;
  delivered_at?: string | null;
  affiliate_payout?: number;
  affiliate_payout_cents?: number;
  lead_price_cents?: number;
  status_reason?: string | null;
  listing?: { agency_name?: string; slug?: string } | null;
  disputes?: Array<{ id: string; status: string; reason_code?: string }>;
}

interface InsuranceAffiliateEarning {
  id: string;
  amount_cents: number;
  status: string;
  created_at: string;
  listing?: { agency_name?: string; slug?: string } | null;
  lead?: InsuranceAffiliateLead | null;
}

export type AffiliateDashboardTab =
  | 'overview'
  | 'products'
  | 'store-builder'
  | 'links'
  | 'single-product'
  | 'qr-codes'
  | 'analytics'
  | 'optimization'
  | 'earnings'
  | 'community'
  | 'training'
  | 'payments'
  | 'integrations';

interface EnhancedAffiliateDashboardProps {
  hideInternalTabs?: boolean;
}

const showLegacyAffiliateProductsTab = import.meta.env.VITE_ENABLE_LEGACY_AFFILIATE_PRODUCTS === 'true';
const showLegacyAffiliateEarningsPanel = import.meta.env.VITE_ENABLE_LEGACY_AFFILIATE_EARNINGS === 'true';

const isPromotableProduct = (product: any): boolean => {
  const status = String(product?.status || '').trim().toLowerCase();
  if (status === 'draft' || status === 'archived' || status === 'store_only') return false;
  const isActive = product?.is_active === true;
  const isPromotable = product?.is_promotable === true;
  if (status === 'active' || isActive || isPromotable) return true;
  const hasExplicitVisibilityState =
    Object.prototype.hasOwnProperty.call(product || {}, 'is_active') ||
    Object.prototype.hasOwnProperty.call(product || {}, 'is_promotable') ||
    status.length > 0;
  return !hasExplicitVisibilityState;
};

const normalizeLedgerStatus = (status: unknown): 'pending' | 'paid' => {
  return String(status || '').trim().toUpperCase() === 'PAID' ? 'paid' : 'pending';
};

const buildAffiliateCommissionRows = (rows: any[], orderMetaById: Map<string, { productTitle: string; customerEmail: string }>) =>
  rows.map((row: any) => {
    const orderId = String(row?.order_id || '').trim();
    const meta = orderMetaById.get(orderId);
    return {
      id: String(row?.id || ''),
      order_id: orderId || null,
      product_title: meta?.productTitle || (orderId ? `Order ${orderId.slice(0, 8)}...` : 'Order'),
      commission_amount: Number(row?.amount || 0),
      sale_date: String(row?.created_at || row?.hold_release_at || '').split('T')[0] || new Date().toISOString().split('T')[0],
      status: normalizeLedgerStatus(row?.status),
      customer_email: meta?.customerEmail || '',
    };
  });

const isToday = (value: unknown) => {
  const date = new Date(String(value || ''));
  return Number.isFinite(date.getTime()) && date.toDateString() === new Date().toDateString();
};

const EnhancedAffiliateDashboard: React.FC<EnhancedAffiliateDashboardProps> = ({ hideInternalTabs = false }) => {
  const { user, profile, session } = useAuth();
  const { referralCode, generateSiteWideLink: getSiteWideLink } = useAffiliate();
  const location = useLocation();
  const [storeCustomDomain, setStoreCustomDomain] = useState<string | null>(null);
  const [storeSubdomain, setStoreSubdomain] = useState<string | null>(null);
  const referralSignupLink = referralCode
    ? `${window.location.origin}/signup?recruit=${encodeURIComponent(referralCode)}`
    : `${window.location.origin}/signup`;
  const [stats, setStats] = useState<AffiliateStats>({
    total_earnings: 0,
    pending_earnings: 0,
    total_sales: 0,
    conversion_rate: 0,
    active_links: 0
  });
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [saleHighlights, setSaleHighlights] = useState<AffiliateSaleHighlight[]>([]);
  const [todayEarnings, setTodayEarnings] = useState(0);
  const [products, setProducts] = useState<Product[]>([]);
  const [promotedProducts, setPromotedProducts] = useState<Product[]>([]);
  const [trafficSources, setTrafficSources] = useState<TrafficSource[]>([]);
  const [referralEarnings, setReferralEarnings] = useState<{ total: number; month: number }>({ total: 0, month: 0 });
  const [referredAffiliates, setReferredAffiliates] = useState<Array<{ id: string; full_name?: string; email?: string; created_at?: string; total_sales?: number; total_commission?: number }>>([]);
  const [insuranceStats, setInsuranceStats] = useState<InsuranceAffiliateStats>({
    total_clicks: 0,
    month_clicks: 0,
    total_leads: 0,
    delivered_leads: 0,
    leads_in_review: 0,
    rejected_leads: 0,
    conversion_rate: 0,
    total_earned: 0,
    pending_earned: 0,
    month_earned: 0,
  });
  const [insuranceRecentLeads, setInsuranceRecentLeads] = useState<InsuranceAffiliateLead[]>([]);
  const [insuranceRecentEarnings, setInsuranceRecentEarnings] = useState<InsuranceAffiliateEarning[]>([]);
  const insuranceAffiliateComingSoon = 'Insurance affiliate marketing coming soon plus a lot more ways to earn.';
  const [activeTab, setActiveTab] = useState<AffiliateDashboardTab>('overview');
  useEffect(() => {
    if (activeTab === 'integrations') {
      setActiveTab('overview');
    }
  }, [activeTab]);
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const rawTab = String(params.get('tab') || '').trim().toLowerCase();
    const tabMap: Record<string, AffiliateDashboardTab> = {
      overview: 'overview',
      products: 'products',
      links: 'links',
      'store-builder': 'store-builder',
      builder: 'store-builder',
      'single-product': 'single-product',
      'single-product-promo': 'single-product',
      promo: 'single-product',
      'qr-codes': 'qr-codes',
      analytics: 'analytics',
      optimization: 'optimization',
      earnings: 'earnings',
      community: 'community',
      training: 'training',
      payments: 'payments',
      orders: 'earnings',
      financials: 'earnings',
      store: 'store-builder',
      'store-customization': 'store-builder',
      'custom-store': 'store-builder',
      'custom-pages': 'store-builder',
      messages: 'training',
      support: 'training',
      recruit: 'community',
      recruitment: 'community',
      invite: 'community',
    };
    const nextTab = tabMap[rawTab];
    if (nextTab && nextTab !== activeTab) {
      setActiveTab(nextTab);
    }
    if (!rawTab && activeTab !== 'overview') {
      setActiveTab('overview');
    }
  }, [activeTab, location.search]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [productFilter, setProductFilter] = useState<{
    category: string;
    searchTerm: string;
    minCommission: number;
    sortBy: 'title' | 'price' | 'commission_rate' | 'created_at';
  }>({
    category: '',
    searchTerm: '',
    minCommission: 0,
    sortBy: 'created_at'
  });
  const [resolvedAffiliateId, setResolvedAffiliateId] = useState<string>('');
  const partnerOwnerId = String(resolvedAffiliateId || profile?.id || user?.id || '').trim();
  const affiliateOwnerIds = useMemo(
    () =>
      Array.from(
        new Set(
          [resolvedAffiliateId, profile?.id, profile?.user_id, user?.id]
            .map((value) => String(value || '').trim())
            .filter(Boolean)
        )
      ),
    [resolvedAffiliateId, profile?.id, profile?.user_id, user?.id]
  );

  useEffect(() => {
    let alive = true;
    if (!user?.id) {
      setResolvedAffiliateId('');
      return;
    }

    void (async () => {
      const resolved = await resolveProfileIdForUser(user.id);
      if (alive) {
        setResolvedAffiliateId(String(resolved || profile?.id || user.id).trim());
      }
    })();

    return () => {
      alive = false;
    };
  }, [user?.id, profile?.id]);

  useEffect(() => {
    let alive = true;
    const loadStoreLink = async () => {
      if (!partnerOwnerId) {
        setStoreCustomDomain(null);
        setStoreSubdomain(null);
        return;
      }

      try {
        const [{ data, error }, { data: profileData, error: profileError }] = await Promise.all([
          supabase
            .from('affiliate_store_settings')
            .select('custom_domain, subdomain')
            .eq('affiliate_id', partnerOwnerId)
            .maybeSingle(),
          supabase
            .from('profiles')
            .select('subdomain')
            .eq('id', partnerOwnerId)
            .maybeSingle(),
        ]);

        if (!alive) return;

        if (error && error.code !== 'PGRST116') {
          console.warn('[EnhancedAffiliateDashboard] Store link lookup error (non-fatal):', error);
        }
        if (profileError && profileError.code !== 'PGRST116') {
          console.warn('[EnhancedAffiliateDashboard] Profile slug lookup error (non-fatal):', profileError);
        }

        setStoreCustomDomain(data?.custom_domain ? String(data.custom_domain) : null);
        setStoreSubdomain(data?.subdomain ? String(data.subdomain) : profileData?.subdomain ? String(profileData.subdomain) : null);
      } catch (err) {
        if (!alive) return;
        console.warn('[EnhancedAffiliateDashboard] Store link lookup failed:', err);
        setStoreCustomDomain(null);
        setStoreSubdomain(null);
      }
    };

    void loadStoreLink();
    return () => {
      alive = false;
    };
  }, [partnerOwnerId]);

  const partnerStoreLink = useMemo(() => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';

    const cleanDomain = String(storeCustomDomain || '').trim();
    if (cleanDomain) {
      const href = `https://${cleanDomain.replace(/^https?:\/\//, '').replace(/\/$/, '')}`;
      return { href, display: href };
    }

    const cleanSlug = String(storeSubdomain || '').trim().toLowerCase();
    if (cleanSlug) {
      return { href: `${origin}/store/${cleanSlug}`, display: `/store/${cleanSlug}` };
    }

    if (partnerOwnerId) {
      return { href: `${origin}/partner/${partnerOwnerId}`, display: `/partner/${partnerOwnerId}` };
    }

    return { href: '', display: '' };
  }, [partnerOwnerId, storeCustomDomain, storeSubdomain]);

  useEffect(() => {
    if (user) {
      fetchAffiliateData();
    } else {
      setLoading(false);
    }
  }, [user, profile, partnerOwnerId]);

  useEffect(() => {
    const refreshAffiliateProducts = (event: Event) => {
      const detail = (event as CustomEvent<{ affiliateId?: string | null }>).detail || {};
      const changedAffiliateId = String(detail.affiliateId || '').trim();
      if (!changedAffiliateId || affiliateOwnerIds.includes(changedAffiliateId)) {
        void fetchAffiliateData();
      }
    };

    window.addEventListener('affiliate-products-changed', refreshAffiliateProducts as EventListener);
    return () => {
      window.removeEventListener('affiliate-products-changed', refreshAffiliateProducts as EventListener);
    };
  }, [affiliateOwnerIds.join('|'), partnerOwnerId]);

  const fetchAffiliateData = async () => {
    try {
      // Prefer unified payout ledger over `commissions` (schema drift has caused 400s in production).
      const affiliateId = partnerOwnerId;
      if (affiliateId) {
        let earnings: any = {};
        try {
          const earningsData = await apiPost<any>('/api/user-earnings', session ?? null, { role: 'affiliate' });
          earnings = (earningsData as any)?.earnings || {};
        } catch {
          earnings = {};
        }
        const totalEarned = Number(earnings.total_earned || 0);
        const pendingEarned = Number(earnings.pending_payout ?? earnings.current_balance ?? 0);

        let snapshotRows: any[] = [];
        let orderMetaById = new Map<string, { productTitle: string; customerEmail: string }>();
        try {
          const { data } = await supabase
            .from('payout_snapshots')
            .select('id, order_id, amount, status, created_at, hold_release_at')
            .eq('payee_role', 'PARTNER')
            .in('payee_user_id', affiliateOwnerIds)
            .order('created_at', { ascending: false })
            .limit(50);
          snapshotRows = (data as any[]) || [];
        } catch {
          snapshotRows = [];
        }

        if (snapshotRows.length > 0) {
          setTodayEarnings(
            snapshotRows
              .filter((row: any) => isToday(row?.created_at))
              .reduce((sum, row: any) => sum + Number(row?.amount || 0), 0)
          );
          const orderIds = Array.from(new Set(snapshotRows.map((row) => String(row?.order_id || '').trim()).filter(Boolean)));
          if (orderIds.length > 0) {
            const { data: orderRows } = await supabase
              .from('orders')
              .select(`
                id,
                billing_email,
                customer_email,
                order_items (
                  product_title,
                  title_snapshot,
                  products (
                    title,
                    name
                  )
                )
              `)
              .in('id', orderIds);

            ((orderRows as any[]) || []).forEach((order: any) => {
              const orderId = String(order?.id || '').trim();
              if (!orderId) return;
              const firstItem = Array.isArray(order?.order_items) ? order.order_items[0] : null;
              orderMetaById.set(orderId, {
                productTitle:
                  String(firstItem?.product_title || '').trim() ||
                  String(firstItem?.title_snapshot || '').trim() ||
                  String(firstItem?.products?.title || '').trim() ||
                  String(firstItem?.products?.name || '').trim() ||
                  `Order ${orderId.slice(0, 8)}`,
                customerEmail:
                  String(order?.billing_email || '').trim() ||
                  String(order?.customer_email || '').trim() ||
                  '',
              });
            });
          }

          setCommissions(buildAffiliateCommissionRows(snapshotRows, orderMetaById));
          setSaleHighlights(
            buildAffiliateCommissionRows(snapshotRows, orderMetaById)
              .slice(0, 6)
              .map((row) => ({
                id: row.id,
                order_id: row.order_id,
                product_title: row.product_title,
                earned_amount: row.commission_amount,
                sale_date: row.sale_date,
                status: row.status,
              }))
          );
        } else {
          setTodayEarnings(0);
          setCommissions([]);
          setSaleHighlights([]);
        }

        setStats({
          total_earnings: totalEarned,
          pending_earnings: pendingEarned,
          total_sales:
            snapshotRows.length > 0
              ? new Set(snapshotRows.map((row: any) => String(row?.order_id || row?.id || '').trim()).filter(Boolean)).size
              : 0,
          conversion_rate: 0,
          active_links: 0
        });
      }

      if (partnerOwnerId) {
        try {
          const { count } = await supabase
            .from('affiliate_links')
            .select('id', { head: true, count: 'exact' })
            .in('affiliate_id', affiliateOwnerIds);
          setStats((prev) => ({ ...prev, active_links: Number(count || 0) }));
        } catch {
          // ignore
        }

        try {
          const insuranceData = await apiPost<any>('/api/insurance/affiliate-stats', session ?? null, {
            affiliate_profile_id: partnerOwnerId,
          });
          setInsuranceStats((insuranceData as any)?.stats || {
            total_clicks: 0,
            month_clicks: 0,
            total_leads: 0,
            delivered_leads: 0,
            leads_in_review: 0,
            rejected_leads: 0,
            conversion_rate: 0,
            total_earned: 0,
            pending_earned: 0,
            month_earned: 0,
          });
          setInsuranceRecentLeads(Array.isArray((insuranceData as any)?.recent_leads) ? (insuranceData as any).recent_leads : []);
          setInsuranceRecentEarnings(Array.isArray((insuranceData as any)?.recent_earnings) ? (insuranceData as any).recent_earnings : []);
        } catch {
          setInsuranceStats({
            total_clicks: 0,
            month_clicks: 0,
            total_leads: 0,
            delivered_leads: 0,
            leads_in_review: 0,
            rejected_leads: 0,
            conversion_rate: 0,
            total_earned: 0,
            pending_earned: 0,
            month_earned: 0,
          });
          setInsuranceRecentLeads([]);
          setInsuranceRecentEarnings([]);
        }
      }

      // Fetch available products for promotion
      const { data: productsData } = await supabase
        .from('products')
        .select(`
          *,
          profiles(full_name)
        `)
        .limit(20);

      if (productsData) {
        const formattedProducts = productsData
          .filter((product) => isPromotableProduct(product))
          .map(product => {
            const commission = resolveAffiliateCommission(product);
            return {
              id: product.id,
              title: product.title,
              description: product.description,
              price: getBuyerFacingProductPrice(product),
              commission_rate: commission.value,
              commission_type: commission.type === 'flat' ? 'fixed' : 'percentage',
              category: product.category,
              seller_name: product.profiles?.full_name || 'Unknown Seller',
              image_url: product.images?.[0] || '/api/placeholder/300/200'
            };
          });
        setProducts(formattedProducts);
      }

      if (affiliateOwnerIds.length) {
        try {
          let promotedRows: any[] = [];

          const readRowsFromPayload = (payload: any): any[] => (Array.isArray(payload?.rows) ? payload.rows : []);

          const publicStoreIds = Array.from(
            new Set([storeSubdomain, partnerOwnerId, ...affiliateOwnerIds].map((value) => String(value || '').trim()).filter(Boolean))
          );

          for (const storeId of publicStoreIds) {
            try {
              const response = await fetch(`/.netlify/functions/public-affiliate-store-get?affiliate=${encodeURIComponent(storeId)}`);
              const payload = await response.json().catch(() => null);
              const rows = readRowsFromPayload(payload);
              if (response.ok && rows.length > 0) {
                promotedRows = rows;
                break;
              }
            } catch {
              // Try the next alias.
            }
          }

          if (promotedRows.length === 0) {
            try {
              const promotedPayload = await apiPost<any>('/.netlify/functions/affiliate-products-list', session ?? null, {
                affiliate_id: partnerOwnerId,
                affiliate_ids: affiliateOwnerIds,
              });
              promotedRows = readRowsFromPayload(promotedPayload);
            } catch {
              const promotedPayload = await apiPost<any>('/api/affiliate/products/list', session ?? null, {
                affiliate_id: partnerOwnerId,
                affiliate_ids: affiliateOwnerIds,
              });
              promotedRows = readRowsFromPayload(promotedPayload);
            }
          }

          if (promotedRows.length === 0) {
            const { data: directRows, error: directError } = await supabase
              .from('affiliate_products')
              .select(`
                id,
                affiliate_id,
                product_id,
                is_featured,
                display_order,
                products (
                  id,
                  title,
                  name,
                  description,
                  price,
                  seller_ask,
                  seller_amount,
                  seller_ask_price,
                  seller_id,
                  commission_rate,
                  affiliate_commission_rate,
                  commission_type,
                  affiliate_commission_type,
                  flat_commission_amount,
                  affiliate_commission_value,
                  category,
                  image_url,
                  images,
                  is_active,
                  is_promotable,
                  status,
                  profiles(full_name)
                )
              `)
              .in('affiliate_id', affiliateOwnerIds)
              .order('display_order', { ascending: true });

            if (!directError && Array.isArray(directRows)) {
              promotedRows = directRows;
            }
          }

          const seenProductIds = new Set<string>();
          const formattedPromoted = promotedRows
            .map((row: any) => {
              const product = row?.products || row?.product;
              if (!product?.id) return null;
              const productId = String(product.id || '').trim();
              if (!productId || seenProductIds.has(productId)) return null;
              seenProductIds.add(productId);
              const commission = resolveAffiliateCommission(product);
              return {
                id: productId,
                title: product.title || product.name || 'Product',
                description: product.description || '',
                price: getBuyerFacingProductPrice(product),
                commission_rate: commission.value,
                commission_type: commission.type === 'flat' ? 'fixed' : 'percentage',
                category: product.category || 'General',
                seller_name: product.profiles?.full_name || product.seller_name || 'Unknown Seller',
                image_url: product.image_url || product.images?.[0] || '/api/placeholder/300/200',
                display_order: Number(row?.display_order ?? 999),
              } as Product & { display_order?: number };
            })
            .filter(Boolean)
            .sort((a: any, b: any) => Number(a.display_order ?? 999) - Number(b.display_order ?? 999)) as Product[];
          setPromotedProducts(formattedPromoted);
        } catch (promotedError) {
          console.warn('[EnhancedAffiliateDashboard] Unable to load promoted products:', promotedError);
          setPromotedProducts([]);
        }
      } else {
        setPromotedProducts([]);
      }

      setTrafficSources([]);

      // Referral earnings (5% upline)
      if (affiliateOwnerIds.length) {
        try {
          const { data: referrals } = await supabase
            .from('referrals')
            .select('id')
            .in('referrer_profile_id', affiliateOwnerIds);

          const referralIds = Array.isArray(referrals) ? referrals.map((r: any) => r.id).filter(Boolean) : [];
          if (referralIds.length) {
            const { data: referralCommissions, error: refEarnError } = await supabase
              .from('referral_commissions')
              .select('commission_amount, created_at')
              .in('referral_id', referralIds);

            if (!refEarnError && referralCommissions) {
              const total = referralCommissions.reduce((sum: number, row: any) => sum + (Number(row.commission_amount) || 0), 0);
              const month = referralCommissions
                .filter((row: any) => {
                  const created = row.created_at ? new Date(row.created_at) : null;
                  const now = new Date();
                  return created && created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear();
                })
                .reduce((sum: number, row: any) => sum + (Number(row.commission_amount) || 0), 0);
              setReferralEarnings({ total, month });
            }
          }
        } catch {
          // ignore referral earnings failures
        }

        const { data: downline, error: downlineError } = await supabase
          .from('profiles')
          .select('id, full_name, email, created_at, total_sales, total_commission')
          .in('referred_by_affiliate_id', affiliateOwnerIds);
        if (!downlineError && downline) {
          setReferredAffiliates(downline);
        }
      }
    } catch (error) {
      console.error('Error fetching affiliate data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;

    const loadSnapshotFallback = async () => {
      if (!partnerOwnerId || commissions.length > 0 || stats.total_sales > 0) return;

      try {
        const { data: snapshotRows } = await supabase
          .from('payout_snapshots')
          .select('id, order_id, amount, status, created_at, hold_release_at')
          .eq('payee_role', 'PARTNER')
          .in('payee_user_id', affiliateOwnerIds)
          .order('created_at', { ascending: false })
          .limit(50);

        if (!active) return;

        const rows = (snapshotRows as any[]) || [];
        const scopedRows = rows;
        if (scopedRows.length === 0) return;

        const orderIds = Array.from(new Set(scopedRows.map((row) => String(row?.order_id || '').trim()).filter(Boolean)));
        const orderMetaById = new Map<string, { productTitle: string; customerEmail: string }>();

        if (orderIds.length > 0) {
          const { data: orderRows } = await supabase
            .from('orders')
            .select(`
              id,
              billing_email,
              customer_email,
              order_items (
                product_title,
                title_snapshot,
                products (
                  title,
                  name
                )
              )
            `)
            .in('id', orderIds);

          if (!active) return;

          ((orderRows as any[]) || []).forEach((order: any) => {
            const orderId = String(order?.id || '').trim();
            if (!orderId) return;
            const firstItem = Array.isArray(order?.order_items) ? order.order_items[0] : null;
            orderMetaById.set(orderId, {
              productTitle:
                String(firstItem?.product_title || '').trim() ||
                String(firstItem?.title_snapshot || '').trim() ||
                String(firstItem?.products?.title || '').trim() ||
                String(firstItem?.products?.name || '').trim() ||
                `Order ${orderId.slice(0, 8)}`,
              customerEmail:
                String(order?.billing_email || '').trim() ||
                String(order?.customer_email || '').trim() ||
                '',
            });
          });
        }

        setCommissions(buildAffiliateCommissionRows(scopedRows, orderMetaById));

        setStats((prev) => ({
          ...prev,
          total_sales: new Set(scopedRows.map((row: any) => String(row?.order_id || row?.id || '').trim()).filter(Boolean)).size,
        }));
      } catch (error) {
        console.warn('[EnhancedAffiliateDashboard] payout snapshot fallback failed:', error);
      }
    };

    void loadSnapshotFallback();
    return () => {
      active = false;
    };
  }, [affiliateOwnerIds, commissions.length, partnerOwnerId, stats.total_sales]);

  const generateAffiliateLink = (productId?: string) => {
    const baseUrl = productId && partnerStoreLink.href ? partnerStoreLink.href.replace(/\/$/, '') : window.location.origin;
    const affiliateId = String(storeSubdomain || partnerOwnerId || '').trim();
    const uid = encodeURIComponent(String(partnerOwnerId || affiliateId || '').trim());
    if (productId) {
      return `${baseUrl}/product/${productId}?ref=${encodeURIComponent(affiliateId)}&uid=${uid}`;
    }
    return partnerStoreLink.href || `${baseUrl}?ref=${encodeURIComponent(affiliateId)}&uid=${uid}`;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const generateSiteWideLink = () => partnerStoreLink.href || getSiteWideLink();

  const generateQRCode = (url: string) => {
    // Using QR Server API for QR code generation
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}`;
  };

  const filteredProducts = useMemo(() => {
    return products
      .filter((product) => {
        const matchesSearch =
          !productFilter.searchTerm ||
          product.title.toLowerCase().includes(productFilter.searchTerm.toLowerCase()) ||
          product.description.toLowerCase().includes(productFilter.searchTerm.toLowerCase());
        const matchesCategory = !productFilter.category || product.category === productFilter.category;
        const matchesCommission = product.commission_rate >= productFilter.minCommission;
        return matchesSearch && matchesCategory && matchesCommission;
      })
      .sort((a, b) => {
        switch (productFilter.sortBy) {
          case 'commission_rate':
            return b.commission_rate - a.commission_rate;
          case 'price':
            return a.price - b.price;
          case 'title':
            return a.title.localeCompare(b.title);
          default:
            return 0;
        }
      });
  }, [productFilter, products]);
  const promotedProductIds = useMemo(
    () => new Set(promotedProducts.map((product) => product.id)),
    [promotedProducts]
  );
  const promoStudioProducts = promotedProducts.length
    ? promotedProducts
    : filteredProducts.length
      ? filteredProducts
      : products;

  if (loading) {
    return <div className="p-4 sm:p-8">Loading...</div>;
  }

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
          Affiliate Dashboard
        </h1>
        <p className="text-sm sm:text-base text-gray-600">
          Track earnings, manage links, and promote products, digital offers, and insurance pages
        </p>
      </div>

      {todayEarnings > 0 ? (
        <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4">
          <p className="text-sm font-semibold text-emerald-900">You made ${todayEarnings.toFixed(2)} today.</p>
          <p className="mt-1 text-sm text-emerald-800">New sale earnings are tracked in your payout history.</p>
        </div>
      ) : null}

      {saleHighlights.length > 0 ? (
        <div className="mb-6 rounded-2xl border border-orange-200 bg-gradient-to-r from-orange-50 via-amber-50 to-yellow-50 p-5 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-700">Sales You Drove</p>
              <h3 className="mt-1 text-lg font-bold text-gray-900">Fresh wins are showing up here.</h3>
              <p className="mt-1 text-sm text-gray-700">Every time one of your tracked links converts, this feed updates with the sale and what you earned.</p>
            </div>
            <div className="rounded-xl bg-white/80 px-4 py-3 text-sm text-gray-800 shadow-sm ring-1 ring-orange-100">
              <div className="font-semibold text-orange-800">{stats.total_sales} tracked sale{stats.total_sales === 1 ? '' : 's'}</div>
              <div className="mt-1">{money(stats.total_earnings)} total earned</div>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {saleHighlights.map((sale) => (
              <div key={sale.id} className="rounded-xl border border-orange-100 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">{sale.product_title}</div>
                    <div className="mt-1 text-xs text-gray-500">{sale.sale_date}</div>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${
                      sale.status === 'paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {sale.status}
                  </span>
                </div>
                <div className="mt-3 text-sm text-gray-600">Your earnings from this sale</div>
                <div className="mt-1 text-2xl font-black text-orange-700">{money(sale.earned_amount)}</div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Enhanced Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
        <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm font-medium text-gray-600">
                Total Earnings
              </p>
              <p className="text-xl sm:text-2xl font-bold text-gray-900">${stats.total_earnings.toLocaleString()}</p>
              <p className="text-xs sm:text-sm text-green-600 mt-1">+12.5% this month</p>
            </div>
            <DollarSign className="w-6 h-6 sm:w-8 sm:h-8 text-green-600" />
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">
                Pending Earnings
              </p>
              <p className="text-2xl font-bold text-gray-900">${stats.pending_earnings.toLocaleString()}</p>
              <p className="text-sm text-yellow-600 mt-1">Tracked in your payout history</p>
            </div>
            <Calendar className="w-8 h-8 text-yellow-600" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Conversion Rate</p>
              <p className="text-2xl font-bold text-gray-900">{stats.conversion_rate}%</p>
              <p className="text-sm text-blue-600 mt-1">Above average</p>
            </div>
            <TrendingUp className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">
                Active Links
              </p>
              <p className="text-2xl font-bold text-gray-900">{stats.active_links}</p>
              <p className="text-sm text-yellow-600 mt-1">All performing well</p>
            </div>
            <Target className="w-8 h-8 text-yellow-600" />
          </div>
        </div>
      </div>

      {/* Payment Schedule Notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-8">
        <div className="flex items-center space-x-2">
          <Calendar className="w-5 h-5 text-blue-600" />
          <span className="text-blue-800 font-medium">Payout timing: up to 14 days after order completion</span>
        </div>
        <p className="text-blue-700 text-sm mt-1">Payouts may be delayed if a dispute, chargeback, or fraud review is opened.</p>
      </div>

      {/* Referral Upline Snapshot */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
        <div className="bg-gradient-to-r from-amber-50 via-white to-amber-100 border border-amber-200 rounded-xl p-5 shadow-sm">
          <p className="text-xs text-amber-700 font-semibold mb-1">Influencer code</p>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="font-mono text-lg text-gray-900 break-all">{referralCode || 'Not generated yet'}</div>
            {referralCode && (
              <button
                onClick={() => copyToClipboard(referralCode)}
                className="px-3 py-1.5 rounded-lg bg-amber-500 text-black text-sm font-semibold hover:bg-amber-600"
              >
                Copy code
              </button>
            )}
          </div>
          <p className="text-xs text-gray-600 mt-2">Share your code or influencer link to earn recurring influencer income from qualified activity tied to affiliates you refer.</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <p className="text-xs text-gray-600 font-semibold mb-2">Influencer link</p>
          <div className="flex items-center gap-2">
            <input
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-sm"
              value={referralSignupLink}
              readOnly
            />
            <button
              onClick={() => copyToClipboard(referralSignupLink)}
              className="px-3 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
            >
              <Copy className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-gray-600 mt-2">This link sends new sellers or affiliates into Beezio under your recruiting code.</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <p className="text-xs text-gray-600 font-semibold mb-1">Influencer earnings</p>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-gray-900">${referralEarnings.total.toFixed(2)}</p>
              <p className="text-sm text-green-700">Lifetime total</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-semibold text-gray-900">${referralEarnings.month.toFixed(2)}</p>
              <p className="text-xs text-gray-600">This month</p>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      {!hideInternalTabs && <div className="border-b border-gray-200 mb-8">
        <nav className="flex space-x-6 overflow-x-auto">
          {[
          { id: 'overview', label: 'Overview', icon: BarChart3 },
          { id: 'products', label: 'Products', icon: Target },
          { id: 'store-builder', label: 'Custom Store & Branding', icon: Settings },
          { id: 'qr-codes', label: 'QR Codes', icon: QrCode },
          { id: 'analytics', label: 'Analytics', icon: TrendingUp },
            { id: 'optimization', label: 'Optimization', icon: Zap },
            { id: 'earnings', label: 'Earnings', icon: DollarSign },
            { id: 'community', label: 'Community', icon: Users },
            { id: 'training', label: 'Training', icon: BookOpen },
            { id: 'payments', label: 'Payments', icon: Calendar }
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
      </div>}

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="space-y-8">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Launch earnings model</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Beezio launches with physical products, digital offers, affiliate storefronts, and influencer referrals in one promotion flow. Tracking updates in real time while payout release still follows hold and dispute rules.
                </p>
              </div>
              <button
                onClick={() => setActiveTab('training')}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              >
                <BookOpen className="w-4 h-4" />
                Launch playbook
              </button>
            </div>
            <div className="mt-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              <div className="rounded-lg border border-gray-200 bg-orange-50 p-4">
                <div className="text-sm font-semibold text-orange-800">Physical products</div>
                <div className="mt-2 text-sm text-gray-700">Promote marketplace items from sellers and earn on completed product sales.</div>
              </div>
              <div className="rounded-lg border border-gray-200 bg-blue-50 p-4">
                <div className="text-sm font-semibold text-blue-800">Digital products</div>
                <div className="mt-2 text-sm text-gray-700">Mix downloadable and digital offers into the same store and share flow.</div>
              </div>
              <div className="rounded-lg border border-gray-200 bg-emerald-50 p-4">
                <div className="text-sm font-semibold text-emerald-800">Coming soon</div>
                <div className="mt-2 text-sm text-gray-700">{insuranceAffiliateComingSoon}</div>
              </div>
              <div className="rounded-lg border border-gray-200 bg-violet-50 p-4">
                <div className="text-sm font-semibold text-violet-800">Influencer referrals</div>
                <div className="mt-2 text-sm text-gray-700">Recruit partners under your link and earn recurring influencer income from their activity.</div>
              </div>
            </div>
          </div>

          {/* My Partner Store Section */}
          <div className="bg-gradient-to-r from-purple-500 to-blue-500 p-6 rounded-xl shadow-lg text-white">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold mb-2">My Partner Store</h3>
                <p className="text-purple-100 mb-4">Share your personalized store link to earn commissions on every sale</p>
                <div className="flex space-x-4">
                  <a
                    href={partnerStoreLink.href || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`bg-white text-purple-600 px-4 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2 ${partnerStoreLink.href ? 'hover:bg-purple-50' : 'opacity-60 cursor-not-allowed'}`}
                    onClick={(e) => {
                      if (!partnerStoreLink.href) e.preventDefault();
                    }}
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>View My Store</span>
                  </a>
                  <button
                    onClick={() => setActiveTab('links')}
                    className="bg-purple-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-purple-700 transition-colors flex items-center space-x-2"
                  >
                    <Link className="w-4 h-4" />
                    <span>Get Share Links</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('store-builder')}
                    className="bg-slate-900 text-white px-4 py-2 rounded-lg font-medium hover:bg-slate-800 transition-colors flex items-center space-x-2"
                  >
                    <Settings className="w-4 h-4" />
                    <span>Customize Store</span>
                  </button>
                </div>
              </div>
              <div className="text-right">
                <div className="bg-white/20 backdrop-blur-sm p-4 rounded-lg">
                  <p className="text-sm text-purple-100">Store URL:</p>
                  <p className="font-mono text-sm break-all">{partnerStoreLink.display || '—'}</p>
                </div>
              </div>
            </div>
          </div>

          <SingleProductPromoStudio products={promoStudioProducts} promoterRole="affiliate" ownerId={partnerOwnerId} />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <h3 className="text-lg font-semibold mb-4">Recent Commissions</h3>
              <div className="space-y-3">
                {commissions.map((commission) => (
                  <div key={commission.id} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-b-0">
                    <div>
                      <p className="font-medium text-gray-900">{commission.product_title}</p>
                      <p className="text-sm text-gray-600">{commission.sale_date}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-green-600">+${commission.commission_amount}</p>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        commission.status === 'paid' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {commission.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
              <div className="space-y-3">
                <button 
                  onClick={() => { window.location.href = '/marketplace'; }}
                  className="w-full text-left p-3 bg-orange-50 hover:bg-orange-100 rounded-lg transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <ShoppingBag className="w-5 h-5 text-orange-600" />
                    <span className="font-medium">
                      Promote Products From Marketplace
                    </span>
                  </div>
                </button>
                <button 
                  onClick={() => setActiveTab('links')}
                  className="w-full text-left p-3 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <ExternalLink className="w-5 h-5 text-blue-600" />
                    <span className="font-medium">
                      My Partner Links
                    </span>
                  </div>
                </button>
                <button 
                  onClick={() => setActiveTab('qr-codes')}
                  className="w-full text-left p-3 bg-yellow-50 hover:bg-yellow-100 rounded-lg transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <QrCode className="w-5 h-5 text-yellow-600" />
                    <span className="font-medium">Create QR Codes</span>
                  </div>
                </button>
                <button 
                  onClick={() => setActiveTab('analytics')}
                  className="w-full text-left p-3 bg-orange-50 hover:bg-orange-100 rounded-lg transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <BarChart3 className="w-5 h-5 text-orange-600" />
                    <span className="font-medium">View Performance Analytics</span>
                  </div>
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div>
                <h3 className="text-lg font-semibold">Multiple ways to earn</h3>
                <p className="text-sm text-gray-600">Use one Beezio store and link system to rotate between products, digital offers, and partner recruitment.</p>
              </div>
              <button
                onClick={() => copyToClipboard(generateSiteWideLink())}
                className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Copy site-wide link
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              <div className="rounded-lg bg-gray-50 p-4">
                <div className="text-sm font-semibold text-gray-900">Site-wide marketplace link</div>
                <div className="mt-2 text-sm text-gray-600">Share one general link and earn across physical and digital product orders tied to your referral.</div>
              </div>
              <div className="rounded-lg bg-gray-50 p-4">
                <div className="text-sm font-semibold text-gray-900">Product-specific campaigns</div>
                <div className="mt-2 text-sm text-gray-600">Push selected products with higher commission rates when you want a tighter niche offer.</div>
              </div>
              <div className="rounded-lg bg-gray-50 p-4">
                <div className="text-sm font-semibold text-gray-900">Coming soon</div>
                <div className="mt-2 text-sm text-gray-600">{insuranceAffiliateComingSoon}</div>
              </div>
              <div className="rounded-lg bg-gray-50 p-4">
                <div className="text-sm font-semibold text-gray-900">Influencer recruitment link</div>
                <div className="mt-2 text-sm text-gray-600">Bring on new partners and create a second layer of earnings through your referral code.</div>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div>
                <h3 className="text-lg font-semibold">Insurance Affiliate Marketing</h3>
                <p className="text-sm text-gray-600">{insuranceAffiliateComingSoon}</p>
              </div>
            </div>
            <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-700">
              {insuranceAffiliateComingSoon}
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold mb-4">Top Performing Products</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {products.slice(0, 3).map((product) => (
                <div key={product.id} className="border border-gray-200 rounded-lg p-4">
                  <h4 className="font-medium mb-2">{product.title}</h4>
                  <p className="text-sm text-gray-600 mb-2">${product.price}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-green-600">
                      {product.commission_type === 'percentage' ? `${product.commission_rate}%` : `$${product.commission_rate}`} commission
                    </span>
                    <button 
                      onClick={() => {
                        setSelectedProduct(product.id);
                        setActiveTab('links');
                      }}
                      className="text-blue-600 text-sm hover:underline"
                    >
                      Promote
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Downline Snapshot */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">Referred Partners</h3>
              <span className="text-sm text-gray-600">{referredAffiliates.length} total</span>
            </div>
            {referredAffiliates.length === 0 ? (
              <p className="text-sm text-gray-600">Invite partners with your link to build your 5% influencer earnings.</p>
            ) : (
              <div className="space-y-3">
                {referredAffiliates.map((aff) => (
                  <div key={aff.id} className="border border-gray-100 rounded-lg p-3 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-gray-900">{aff.full_name || 'Affiliate'}</p>
                      <p className="text-xs text-gray-600">{aff.email || 'No email on file'}</p>
                    </div>
                    <div className="text-right text-xs text-gray-600">
                      {aff.created_at && <div>Joined: {new Date(aff.created_at).toLocaleDateString()}</div>}
                      {aff.total_sales && <div>Sales: {aff.total_sales}</div>}
                      {aff.total_commission && <div>Referral earned: ${Number(aff.total_commission).toFixed(2)}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'products' && (
        <div className="space-y-6">
          <div className="rounded-xl border border-orange-200 bg-orange-50 p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Products</h2>
                <p className="mt-1 text-sm text-gray-700">
                  Products you are promoting appear here. Add or remove promoted products from the marketplace.
                </p>
              </div>
              <a
                href="/marketplace"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700"
              >
                <ShoppingBag className="h-4 w-4" />
                Open Marketplace
              </a>
            </div>
          </div>
          <div className="rounded-xl border bg-white p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Your promoted products</h3>
              <span className="text-sm text-gray-500">{promotedProducts.length} total</span>
            </div>
            <AffiliateProductList
              products={promotedProducts}
              selectedProduct={selectedProduct}
              onCopyLink={(productId) => copyToClipboard(generateAffiliateLink(productId))}
              onOpenLinks={(productId) => {
                setSelectedProduct(productId);
                setActiveTab('links');
              }}
            />
          </div>
        </div>
      )}

      {showLegacyAffiliateProductsTab && activeTab === 'products' && (
        <div className="space-y-6">
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-5 lg:hidden">
            <div className="flex flex-col gap-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Use the full marketplace on mobile</h3>
                <p className="mt-1 text-sm text-gray-700">
                  The embedded dashboard browser is too cramped on smaller screens. Open the full marketplace to browse products, use filters, and add items to your store without the dashboard squeezing the view.
                </p>
              </div>
              <a
                href="/marketplace"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-orange-600 px-4 py-3 text-sm font-semibold text-white hover:bg-orange-700"
              >
                <ShoppingBag className="h-4 w-4" />
                Open Full Marketplace
              </a>
            </div>
          </div>

          <div className="hidden lg:block">
          {/* Product Search and Filters */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold mb-4">
              🛍️ Browse Products to Promote
            </h3>
            <p className="text-gray-600 mb-6">
              Discover products that match your audience and earn commission on every sale.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              {/* Search */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search products..."
                  value={productFilter.searchTerm}
                  onChange={(e) => setProductFilter(prev => ({ ...prev, searchTerm: e.target.value }))}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>
              
              {/* Category Filter */}
              <select
                value={productFilter.category}
                onChange={(e) => setProductFilter(prev => ({ ...prev, category: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              >
                <option value="">All Categories</option>
                <option value="Electronics">Electronics</option>
                <option value="Clothing">Clothing</option>
                <option value="Home & Garden">Home & Garden</option>
                <option value="Books">Books</option>
                <option value="Digital Products">Digital Products</option>
                <option value="Food & Beverage">Food & Beverage</option>
                <option value="Beauty">Beauty</option>
                <option value="Sports">Sports</option>
              </select>
              
              {/* Minimum Commission Filter */}
              <select
                value={productFilter.minCommission}
                onChange={(e) => setProductFilter(prev => ({ ...prev, minCommission: Number(e.target.value) }))}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              >
                <option value={0}>Any Commission</option>
                <option value={10}>10%+ Commission</option>
                <option value={20}>20%+ Commission</option>
                <option value={30}>30%+ Commission</option>
                <option value={40}>40%+ Commission</option>
              </select>
              
              {/* Sort By */}
              <select
                value={productFilter.sortBy}
                onChange={(e) => setProductFilter(prev => ({ ...prev, sortBy: e.target.value as any }))}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              >
                <option value="created_at">Newest First</option>
                <option value="commission_rate">Highest Commission</option>
                <option value="price">Price: Low to High</option>
                <option value="title">A-Z</option>
              </select>
            </div>
            
            {/* Filter Summary */}
            <div className="flex items-center space-x-4 text-sm text-gray-600 mb-4">
              <span>📊 Showing {products.length} products</span>
              {productFilter.searchTerm && (
                <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                  Search: "{productFilter.searchTerm}"
                </span>
              )}
              {productFilter.category && (
                <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full">
                  Category: {productFilter.category}
                </span>
              )}
              {productFilter.minCommission > 0 && (
                <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">
                  Min {productFilter.minCommission}% Commission
                </span>
              )}
            </div>

            {/* Site-Wide Promotion Option */}
            <div className="bg-gradient-to-r from-yellow-50 to-blue-50 p-6 rounded-xl border border-yellow-200 mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-lg font-semibold text-gray-900 mb-2">
                    🌐 Promote Entire Platform
                  </h4>
                  <p className="text-gray-600 mb-4">
                    Get commission on ALL purchases made through your referral link based on each product's individual commission rate set by sellers.
                  </p>
                  <div className="flex items-center space-x-4 text-sm">
                    <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full font-medium">
                      Commission Rate Varies by Product
                    </span>
                    <span className="text-gray-600">
                      • Earn seller-set commission rates • Works on any product • Full marketplace access
                    </span>
                  </div>
                </div>
                <div className="flex flex-col space-y-2">
                  <button
                    onClick={() => copyToClipboard(generateSiteWideLink())}
                    className="bg-yellow-600 text-white px-4 py-2 rounded-lg hover:bg-yellow-700 transition-colors flex items-center space-x-2"
                  >
                    <Copy className="w-4 h-4" />
                    <span>Copy Site Link</span>
                  </button>
                  <button
                    onClick={() => copyToClipboard(generateSiteWideLink())}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>Share Platform</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Product Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProducts.map((product) => {
              const productLink = generateAffiliateLink(product.id);
              const qrUrl = generateQRCode(productLink);
              const isPromoted = promotedProductIds.has(product.id);
              return (
                <div key={product.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow">
                  <div className="relative">
                    <img 
                      src={product.image_url || '/api/placeholder/300/200'} 
                      alt={product.title}
                      className="w-full h-48 object-cover"
                    />
                    <div className="absolute top-3 right-3 bg-green-500 text-white px-2 py-1 rounded-full text-xs font-bold">
                      {product.commission_type === 'percentage' ? `${product.commission_rate}%` : `$${product.commission_rate}`}
                    </div>
                    {isPromoted && (
                      <div className="absolute top-3 left-3 bg-orange-600 text-white px-2 py-1 rounded-full text-xs font-bold">
                        Promoted
                      </div>
                    )}
                  </div>
                  
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-semibold text-gray-900 text-sm line-clamp-2">{product.title}</h4>
                      <span className="text-lg font-bold text-gray-900 ml-2">${product.price}</span>
                    </div>
                    
                    <p className="text-xs text-gray-600 mb-3 line-clamp-2">{product.description}</p>
                    
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-xs text-gray-500">
                        <span className="bg-gray-100 px-2 py-1 rounded-full">{product.category}</span>
                      </div>
                      <div className="text-xs text-gray-500">by {product.seller_name}</div>
                    </div>
                    
                    <div className="bg-gradient-to-r from-green-50 to-blue-50 p-3 rounded-lg mb-3">
                      <div className="text-xs text-gray-600 mb-1">Your potential earnings per sale:</div>
                      <div className="text-lg font-bold text-green-600">
                        ${product.commission_type === 'percentage' 
                          ? (product.price * product.commission_rate / 100).toFixed(2)
                          : product.commission_rate.toFixed(2)
                        }
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      <input
                        type="text"
                        value={productLink}
                        readOnly
                        className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-xs text-gray-700"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => copyToClipboard(productLink)}
                          className="rounded-lg bg-orange-600 py-2 px-3 text-sm font-medium text-white transition-colors hover:bg-orange-700"
                        >
                          Copy Link
                        </button>
                        <button
                          onClick={() => window.open(productLink, '_blank', 'noopener,noreferrer')}
                          className="rounded-lg bg-slate-800 py-2 px-3 text-sm font-medium text-white transition-colors hover:bg-black"
                        >
                          Open Page
                        </button>
                        <button
                          onClick={() => {
                            const link = document.createElement('a');
                            link.href = qrUrl;
                            link.download = `${product.title.replace(/[^a-z0-9]/gi, '_')}-qr.png`;
                            link.click();
                          }}
                          className="rounded-lg bg-yellow-600 py-2 px-3 text-sm font-medium text-white transition-colors hover:bg-yellow-700"
                        >
                          Download QR
                        </button>
                        <button
                          onClick={() => {
                            setSelectedProduct(product.id);
                            setActiveTab('links');
                          }}
                          className="rounded-lg bg-blue-600 py-2 px-3 text-sm font-medium text-white transition-colors hover:bg-blue-700"
                        >
                          More Share
                        </button>
                      </div>
                      <button
                        onClick={() => {
                          setSelectedProduct(product.id);
                          setActiveTab('links');
                        }}
                        className="w-full rounded-lg bg-orange-600 py-2 px-3 text-sm font-medium text-white transition-colors hover:bg-orange-700"
                      >
                        🚀 Start Promoting
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          
          {/* No Results */}
          {filteredProducts.length === 0 && (
            <div className="bg-white p-12 rounded-xl shadow-sm border border-gray-200 text-center">
              <ShoppingBag className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No products found</h3>
              <p className="text-gray-600 mb-6">Try adjusting your filters or search terms to find products to promote.</p>
              <button
                onClick={() => setProductFilter({ category: '', searchTerm: '', minCommission: 0, sortBy: 'created_at' })}
                className="bg-orange-600 text-white px-6 py-2 rounded-lg hover:bg-orange-700 transition-colors"
              >
                Clear All Filters
              </button>
            </div>
          )}
          
          {/* Quick Stats */}
          <div className="bg-gradient-to-r from-orange-50 to-yellow-50 p-6 rounded-xl border border-orange-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">💡 Pro Tips for Product Selection</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="bg-white p-4 rounded-lg">
                <div className="font-semibold text-blue-600 mb-2">🎯 High Commission Products</div>
                <p className="text-gray-600">Focus on products with 20%+ commission rates for maximum earnings.</p>
              </div>
              <div className="bg-white p-4 rounded-lg">
                <div className="font-semibold text-green-600 mb-2">💰 Price Sweet Spot</div>
                <p className="text-gray-600">$50-$200 products often have the best conversion rates.</p>
              </div>
              <div className="bg-white p-4 rounded-lg">
                <div className="font-semibold text-yellow-600 mb-2">📈 Trending Categories</div>
                <p className="text-gray-600">Electronics and Digital Products are currently performing best.</p>
              </div>
            </div>
          </div>
          </div>
        </div>
      )}

      {activeTab === 'store-builder' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-5">
            <h2 className="text-lg font-semibold text-gray-900">Your Custom Store & Branding</h2>
            <p className="mt-1 text-sm text-gray-700">Preview, edit, upload your logo/banner, and share your affiliate storefront.</p>
            <a
              href={partnerStoreLink.href || '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-blue-700 hover:text-blue-800"
              onClick={(event) => {
                if (!partnerStoreLink.href) event.preventDefault();
              }}
            >
              <ExternalLink className="h-4 w-4" />
              View Live Store
            </a>
          </div>
          <StoreCustomization userId={partnerOwnerId} role="affiliate" />
        </div>
      )}

      {activeTab === 'links' && (
        <div className="space-y-6">
          {/* Quick Action to Add More Products */}
          <div className="bg-gradient-to-r from-blue-50 to-yellow-50 p-4 rounded-xl border border-blue-200">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-blue-900">Want to promote more products?</h3>
                <p className="text-blue-700 text-sm">Use the marketplace to add products to your affiliate store.</p>
              </div>
              <a
                href="/marketplace"
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium whitespace-nowrap"
              >
                Open Marketplace
              </a>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold mb-4">Influencer Link for New Partners</h3>
            <p className="text-gray-600 mb-4">Share this link so affiliates sign up under you. You earn 5% of Beezio’s fee on their sales.</p>
            
            {/* Referral Code Display */}
            {referralCode && (
              <div className="mb-4 p-3 sm:p-4 bg-gradient-to-r from-yellow-50 to-amber-50 border-2 border-yellow-300 rounded-lg">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex-1">
                    <p className="text-xs text-gray-600 mb-1">Your Influencer Code</p>
                    <p className="text-xl sm:text-2xl font-bold text-yellow-600 font-mono tracking-wider break-all">{referralCode}</p>
                  </div>
                  <button
                    onClick={() => copyToClipboard(referralCode)}
                    className="w-full sm:w-auto px-3 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors text-sm whitespace-nowrap"
                  >
                    Copy Code
                  </button>
                </div>
              </div>
            )}
            
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <input
                type="text"
                value={referralSignupLink}
                readOnly
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-xs sm:text-sm"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => copyToClipboard(referralSignupLink)}
                  className="flex-1 sm:flex-none px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
                >
                  <Copy className="w-4 h-4 mx-auto" />
                </button>
                <button
                  onClick={() => setActiveTab('qr-codes')}
                  className="flex-1 sm:flex-none px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
                >
                  <QrCode className="w-4 h-4 mx-auto" />
                </button>
              </div>
            </div>
            
            {/* Referral Program Info */}
            <div className="mt-4 p-3 bg-purple-50 border border-purple-200 rounded-lg">
              <p className="text-xs sm:text-sm text-purple-800">
                <strong>💰 Influencer Earnings:</strong> When someone signs up using your code/link and makes sales, 
                you earn <strong>5%</strong> of the platform fee on every sale they make while the program is active.
              </p>
            </div>
          </div>

          <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-2">
              <h3 className="text-base sm:text-lg font-semibold">My Promoted Products ({promotedProducts.length})</h3>
              <a
                href="/marketplace"
                className="text-blue-600 hover:text-blue-700 text-sm font-medium text-left sm:text-right"
              >
                + Add More Products
              </a>
            </div>
            <p className="text-sm sm:text-base text-gray-600 mb-4">Create specific links for individual products with higher conversion rates</p>
            
            {promotedProducts.length === 0 ? (
              <div className="text-center py-6 sm:py-8">
                <ShoppingBag className="w-10 h-10 sm:w-12 sm:h-12 text-gray-400 mx-auto mb-3 sm:mb-4" />
                <h4 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">No products selected yet</h4>
                <p className="text-sm sm:text-base text-gray-600 mb-3 sm:mb-4">Open the marketplace and add products to your store before arranging or sharing them.</p>
                <a
                  href="/marketplace"
                  className="bg-orange-600 text-white px-6 py-2 rounded-lg hover:bg-orange-700 transition-colors"
                >
                  Open Marketplace
                </a>
              </div>
            ) : (
              <div className="space-y-4">
                {promotedProducts.map((product) => (
                  <div 
                    key={product.id} 
                    className={`border rounded-lg p-4 ${selectedProduct === product.id ? 'border-orange-500 bg-orange-50' : 'border-gray-200'}`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900">{product.title}</h4>
                        <p className="text-sm text-gray-600 mt-1">${product.price} • {product.category}</p>
                        <p className="text-sm text-green-600">
                          Commission: {product.commission_type === 'percentage' ? `${product.commission_rate}%` : `$${product.commission_rate}`}
                          {' '}(${product.commission_type === 'percentage' 
                            ? (product.price * product.commission_rate / 100).toFixed(2)
                            : product.commission_rate.toFixed(2)
                          } per sale)
                        </p>
                      </div>
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                        by {product.seller_name}
                      </span>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <input
                        type="text"
                        value={generateAffiliateLink(product.id)}
                        readOnly
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-sm"
                      />
                      <button
                        onClick={() => copyToClipboard(generateAffiliateLink(product.id))}
                        className="px-3 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
                        title="Copy Link"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setSelectedProduct(product.id);
                          setActiveTab('qr-codes');
                        }}
                        className="px-3 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
                        title="Generate QR Code"
                      >
                        <QrCode className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'single-product' && (
        <SingleProductPromoStudio
          products={promoStudioProducts}
          promoterRole="affiliate"
          ownerId={partnerOwnerId}
        />
      )}

      {activeTab === 'qr-codes' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold mb-4">🚀 QR Code Generator for Offline Marketing</h3>
            <p className="text-gray-600 mb-6">Generate QR codes for flyers, business cards, posters, and offline marketing materials. Perfect for events, networking, and print advertising!</p>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium mb-4">Site-Wide QR Code</h4>
                <div className="text-center p-6 bg-gray-50 rounded-lg">
                  <img 
                    src={generateQRCode(generateSiteWideLink())} 
                    alt="Site-wide QR Code" 
                    className="mx-auto mb-4"
                  />
                  <p className="text-sm text-gray-600 mb-4">Scan to visit the marketplace with your partner link</p>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => {
                        const qrUrl = generateQRCode(generateSiteWideLink());
                        const link = document.createElement('a');
                        link.href = qrUrl;
                        link.download = 'beezio-affiliate-qr.png';
                        link.click();
                      }}
                      className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <Download className="w-4 h-4 inline mr-2" />
                      Download PNG
                    </button>
                    <button
                      onClick={() => copyToClipboard(generateSiteWideLink())}
                      className="flex-1 bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
                    >
                      <Copy className="w-4 h-4 inline mr-2" />
                      Copy Link
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-4">Product-Specific QR Codes</h4>
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {(promotedProducts.length ? promotedProducts : products).map((product) => (
                    <div key={product.id} className="flex items-center space-x-4 p-4 border border-gray-200 rounded-lg">
                      <img 
                        src={generateQRCode(generateAffiliateLink(product.id))} 
                        alt={`${product.title} QR Code`} 
                        className="w-16 h-16"
                      />
                      <div className="flex-1">
                        <h5 className="font-medium">{product.title}</h5>
                        <p className="text-sm text-gray-600">${product.price}</p>
                        <p className="text-sm text-green-600">
                          {product.commission_type === 'percentage' ? `${product.commission_rate}%` : `$${product.commission_rate}`} commission
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          const qrUrl = generateQRCode(generateAffiliateLink(product.id));
                          const link = document.createElement('a');
                          link.href = qrUrl;
                          link.download = `${product.title.replace(/[^a-z0-9]/gi, '_')}-qr.png`;
                          link.click();
                        }}
                        className="bg-yellow-600 text-white px-3 py-2 rounded-lg hover:bg-yellow-700 transition-colors"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-2">💡 QR Code Marketing Tips</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Add QR codes to business cards and flyers for easy mobile access</li>
                <li>• Include a call-to-action like "Scan for exclusive deals!"</li>
                <li>• Test QR codes before printing to ensure they work properly</li>
                <li>• Use high contrast colors (dark code on light background) for best scanning</li>
                <li>• Place QR codes at eye-level and in well-lit areas for events</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'analytics' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div>
                <h3 className="text-lg font-semibold">Insurance Affiliate Marketing</h3>
                <p className="text-sm text-gray-600">{insuranceAffiliateComingSoon}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="rounded-lg border border-gray-200 p-4">
                <h4 className="font-medium text-gray-900 mb-3">Recent Insurance Leads</h4>
                <div className="space-y-3">
                  {insuranceRecentLeads.length === 0 && <div className="text-sm text-gray-500">No insurance lead activity yet.</div>}
                  {insuranceRecentLeads.slice(0, 6).map((lead) => (
                    <div key={lead.id} className="flex items-start justify-between gap-3 rounded-lg bg-gray-50 p-3">
                      <div>
                        <div className="font-medium text-gray-900">{lead.listing?.agency_name || 'Insurance store'}</div>
                        <div className="text-xs text-gray-500">{lead.vertical} · {new Date(lead.created_at).toLocaleDateString()}</div>
                        <div className="mt-1 text-sm text-gray-700">Status: {lead.status} · Review: {lead.review_status}</div>
                        <div className="mt-1 text-xs text-gray-600">
                          Lead ${(Number(lead.lead_price_cents || 0) / 100).toFixed(2)} ·
                          Payout ${Number((lead.affiliate_payout ?? (Number(lead.affiliate_payout_cents || 0) / 100)) || 0).toFixed(2)}
                        </div>
                        {lead.delivered_at && <div className="text-xs text-emerald-700">Delivered {new Date(lead.delivered_at).toLocaleString()}</div>}
                        {lead.status_reason && <div className="text-xs text-gray-500">{lead.status_reason}</div>}
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-green-600">${Number((lead.affiliate_payout ?? (Number(lead.affiliate_payout_cents || 0) / 100)) || 0).toFixed(2)}</div>
                        {Array.isArray(lead.disputes) && lead.disputes.length > 0 && (
                          <div className="text-xs text-amber-700">{lead.disputes[0].status} dispute</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-lg border border-gray-200 p-4">
                <h4 className="font-medium text-gray-900 mb-3">Recent Insurance Earnings</h4>
                <div className="space-y-3">
                  {insuranceRecentEarnings.length === 0 && <div className="text-sm text-gray-500">No insurance earnings yet.</div>}
                  {insuranceRecentEarnings.slice(0, 6).map((earning) => (
                    <div key={earning.id} className="flex items-start justify-between gap-3 rounded-lg bg-gray-50 p-3">
                      <div>
                        <div className="font-medium text-gray-900">{earning.listing?.agency_name || 'Insurance store'}</div>
                        <div className="text-xs text-gray-500">{earning.lead?.vertical || 'lead'} · {new Date(earning.created_at).toLocaleDateString()}</div>
                        <div className="mt-1 text-sm text-gray-700">Status: {earning.status}</div>
                        <div className="text-xs text-gray-600">
                          Lead {earning.lead?.status || 'unknown'} · Review {earning.lead?.review_status || 'unknown'}
                        </div>
                        {earning.lead?.status_reason && <div className="text-xs text-gray-500">{earning.lead.status_reason}</div>}
                      </div>
                      <div className="text-right font-semibold text-green-600">
                        ${(Number(earning.amount_cents || 0) / 100).toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <h3 className="text-lg font-semibold mb-4">📊 Traffic Sources</h3>
              <div className="space-y-3">
                {trafficSources.map((source, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className={`w-3 h-3 rounded-full ${
                        index === 0 ? 'bg-blue-500' :
                        index === 1 ? 'bg-green-500' :
                        index === 2 ? 'bg-yellow-500' : 'bg-orange-500'
                      }`}></div>
                      <span className="font-medium">{source.source}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{source.clicks} clicks</p>
                      <p className="text-xs text-gray-600">{source.conversions} conversions</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <h3 className="text-lg font-semibold mb-4">💰 Earnings by Source</h3>
              <div className="space-y-3">
                {trafficSources.map((source, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="font-medium">{source.source}</span>
                    <div className="text-right">
                      <p className="text-lg font-bold text-green-600">${source.earnings}</p>
                      <p className="text-xs text-gray-600">
                        {((source.conversions / source.clicks) * 100).toFixed(1)}% conversion
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold mb-4">📈 Performance Insights</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <Clock className="w-6 h-6 text-blue-600 mx-auto mb-2" />
                <p className="font-medium">Best Time</p>
                <p className="text-sm text-gray-600">2-4 PM weekdays</p>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <MapPin className="w-6 h-6 text-green-600 mx-auto mb-2" />
                <p className="font-medium">Top Location</p>
                <p className="text-sm text-gray-600">California, USA</p>
              </div>
              <div className="text-center p-4 bg-yellow-50 rounded-lg">
                <Users className="w-6 h-6 text-yellow-600 mx-auto mb-2" />
                <p className="font-medium">Audience Age</p>
                <p className="text-sm text-gray-600">25-34 years</p>
              </div>
              <div className="text-center p-4 bg-orange-50 rounded-lg">
                <Heart className="w-6 h-6 text-orange-600 mx-auto mb-2" />
                <p className="font-medium">Top Interest</p>
                <p className="text-sm text-gray-600">Business & Finance</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold mb-4">🎯 A/B Testing Results</h3>
            <div className="space-y-4">
              <div className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium">Email Subject Line Test</h4>
                  <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs">Winner</span>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Version A: "Don't miss out!"</p>
                    <p className="font-medium">Open rate: 18.5%</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Version B: "Limited time offer"</p>
                    <p className="font-medium text-green-600">Open rate: 24.3%</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {activeTab === 'optimization' && (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-yellow-50 to-orange-50 p-6 rounded-xl border border-yellow-200">
            <h3 className="text-lg font-semibold mb-4 text-orange-900">Promotion Priorities</h3>
            <div className="space-y-4">
              <div className="bg-white p-4 rounded-lg border border-orange-200">
                <div className="flex items-start space-x-3">
                  <Lightbulb className="w-5 h-5 text-orange-600 mt-1" />
                  <div>
                    <h4 className="font-medium text-orange-900">Lead with a clear reason to click</h4>
                    <p className="text-sm text-orange-800 mt-1">Show people what happens next: a real product checkout, a digital offer, or a clean store page with a clear call to action.</p>
                  </div>
                </div>
              </div>
              <div className="bg-white p-4 rounded-lg border border-orange-200">
                <div className="flex items-start space-x-3">
                  <TrendingUp className="w-5 h-5 text-orange-600 mt-1" />
                  <div>
                    <h4 className="font-medium text-orange-900">Mix offer types in one store</h4>
                    <p className="text-sm text-orange-800 mt-1">Beezio performs best when affiliates combine physical products, digital offers, and recruiting links instead of relying on one category.</p>
                  </div>
                </div>
              </div>
              <div className="bg-white p-4 rounded-lg border border-orange-200">
                <div className="flex items-start space-x-3">
                  <Target className="w-5 h-5 text-orange-600 mt-1" />
                  <div>
                    <h4 className="font-medium text-orange-900">Use every link surface you have</h4>
                    <p className="text-sm text-orange-800 mt-1">Your storefront, direct links, QR codes, and recruiting links should all point to live pages with a simple call to action.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <h3 className="text-lg font-semibold mb-4">Recommended Offer Mix</h3>
              <p className="text-gray-600 mb-4">Keep your storefront balanced so shoppers can buy, download, or join through one Beezio page.</p>
              <div className="space-y-3">
                {products.slice(0, 3).map((product) => (
                  <div key={product.id} className="p-3 border border-gray-200 rounded-lg">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <h4 className="font-medium">{product.title}</h4>
                        <p className="text-sm text-gray-600">{product.category || 'Other'}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-green-600 font-medium">
                          {product.commission_type === 'percentage' ? `${product.commission_rate}%` : `$${product.commission_rate}`}
                        </p>
                        <p className="text-xs text-gray-500">Ready to promote</p>
                      </div>
                    </div>
                  </div>
                ))}
                {products.length === 0 && (
                  <div className="p-4 border border-dashed border-gray-300 rounded-lg text-sm text-gray-600">
                    Add products to start building your storefront. {insuranceAffiliateComingSoon}
                  </div>
                )}
              </div>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <h3 className="text-lg font-semibold mb-4">What To Improve Next</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                  <span>Total sales</span>
                  <span className="font-bold">{stats.total_sales}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                  <span>Conversion rate</span>
                  <span className="font-bold">{stats.conversion_rate}%</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                  <span>Active links</span>
                  <span className="font-bold">{stats.active_links}</span>
                </div>
              </div>
              <div className="mt-4 p-3 bg-amber-50 rounded-lg">
                <p className="text-sm text-amber-900">
                  Focus on better offer selection, clearer calls to action, and consistent sharing across your storefront, social posts, and recruiting pages.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
      {activeTab === 'integrations' && (
        <div className="space-y-6">
          <UniversalIntegrationsPage />
        </div>
      )}
      {activeTab === 'earnings' && (
        <AccountPayoutDashboard />
      )}
      {showLegacyAffiliateEarningsPanel && activeTab === 'earnings' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-6 rounded-xl border border-green-200">
              <h3 className="text-lg font-semibold mb-4 text-green-900">Current Earnings Snapshot</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-green-800">Total earned:</span>
                  <span className="font-bold text-green-900"></span>
                </div>
                <div className="flex justify-between">
                  <span className="text-green-800">Pending:</span>
                  <span className="font-bold text-green-900"></span>
                </div>
                <div className="flex justify-between">
                  <span className="text-green-800">Closed sales:</span>
                  <span className="font-bold text-green-900">{stats.total_sales}</span>
                </div>
              </div>
            </div>
            <div className="bg-gradient-to-r from-yellow-50 to-violet-50 p-6 rounded-xl border border-yellow-200">
              <h3 className="text-lg font-semibold mb-4 text-yellow-900">Payout Visibility</h3>
              <div className="space-y-2 text-sm text-yellow-900">
                <p>Payout timing is tracked in your payout history and provider account.</p>
                <p>Beezio keeps fee routing internal so sellers, affiliates, influencers, and agents can work from one consistent payout system.</p>
                <p>Use statement exports when you need records for bookkeeping or reconciliation.</p>
              </div>
            </div>
            <div className="bg-gradient-to-r from-blue-50 to-cyan-50 p-6 rounded-xl border border-blue-200">
              <h3 className="text-lg font-semibold mb-4 text-blue-900">Real-Time Earning Paths</h3>
              <div className="space-y-2 text-sm text-blue-900">
                <p>Promote products for immediate sale commissions.</p>
                <p>Share digital offers for fast checkout conversions.</p>
                <p>{insuranceAffiliateComingSoon}</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold mb-4">Payout Notes</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <p className="font-medium text-gray-900">Ledger-first tracking</p>
                <p className="text-gray-600 mt-2">Your dashboard tracks pending and completed earnings without exposing private pricing splits.</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <p className="font-medium text-gray-900">Export when needed</p>
                <p className="text-gray-600 mt-2">Use payout history and statement exports for accounting, support, and payout review.</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <p className="font-medium text-gray-900">Mixed-offer earnings</p>
                <p className="text-gray-600 mt-2">The same payout system handles physical products, digital sales, and influencer network earnings.</p>
              </div>
            </div>
          </div>
        </div>
      )}
      {activeTab === 'community' && (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-indigo-50 to-yellow-50 p-6 rounded-xl border border-indigo-200">
            <h3 className="text-lg font-semibold mb-4 text-indigo-900">Affiliate Growth Resources</h3>
            <p className="text-indigo-800 mb-4">Use these launch resources to build a professional Beezio storefront, share the right links, and keep your promotions compliant.</p>
            <div className="flex flex-wrap gap-3">
              <a href="/affiliate-guide" className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors">
                <BookOpen className="w-4 h-4 inline mr-2" />
                Open Affiliate Guide
              </a>
              <a href="/dashboard?section=affiliate&tab=links" className="bg-white text-indigo-600 border border-indigo-300 px-4 py-2 rounded-lg hover:bg-indigo-50 transition-colors">
                Manage Links
              </a>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <h3 className="text-lg font-semibold mb-4">What Strong Affiliates Do</h3>
              <div className="space-y-3 text-sm text-gray-700">
                <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                  Keep one storefront active with a mix of physical products and digital offers.
                </div>
                <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                  Explain why the shopper should click now, not just what the item is.
                </div>
                <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                  Share direct product links and recruiting links alongside your main Beezio store.
                </div>
                <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                  Insurance affiliate marketing is coming soon. Keep your current launch copy focused on products, digital offers, and recruiting.
                </div>
              </div>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <h3 className="text-lg font-semibold mb-4">Launch Support</h3>
              <div className="space-y-4 text-sm text-gray-700">
                <div className="border-l-4 border-blue-400 pl-4">
                  <p className="font-medium text-gray-900">Offer selection</p>
                  <p className="mt-1">Choose a balanced mix of products and digital offers so your audience has more than one way to convert.</p>
                </div>
                <div className="border-l-4 border-green-400 pl-4">
                  <p className="font-medium text-gray-900">Link management</p>
                  <p className="mt-1">Keep your storefront, direct offer links, and QR codes current so every campaign points to a live page.</p>
                </div>
                <div className="border-l-4 border-amber-400 pl-4">
                  <p className="font-medium text-gray-900">Compliance</p>
                  <p className="mt-1">Do not promise guaranteed approval, shared lead blasts, or cold-contact lists. Insurance shoppers must request contact themselves.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {activeTab === 'training' && (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-emerald-50 to-teal-50 p-6 rounded-xl border border-emerald-200">
            <h3 className="text-lg font-semibold mb-4 text-emerald-900">Affiliate Launch Playbook</h3>
            <p className="text-emerald-800 mb-4">Start with the core Beezio workflow: choose offers, build your store, share consistently, and keep your promotions compliant.</p>
            <div className="flex flex-wrap gap-3">
              <a href="/affiliate-guide" className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors">
                Start with the Guide
              </a>
              <a href="/dashboard?section=affiliate&tab=products" className="bg-white text-emerald-600 border border-emerald-300 px-4 py-2 rounded-lg hover:bg-emerald-50 transition-colors">
                Choose Offers
              </a>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                title: 'Build your affiliate store',
                description: 'Add physical products and digital offers to one storefront.',
                cta: 'Open store setup',
                href: '/dashboard?section=affiliate&tab=store'
              },
              {
                title: 'Publish your offer links',
                description: 'Use product links, QR codes, and your main store link anywhere you already have an audience.',
                cta: 'Manage links',
                href: '/dashboard?section=affiliate&tab=links'
              },
              {
                title: 'Recruit affiliates',
                description: 'Influencer and recruiting links create another earning path without changing your main storefront.',
                cta: 'Open recruiting',
                href: '/dashboard?section=affiliate&tab=recruitment'
              },
              {
                title: 'Insurance coming soon',
                description: 'Insurance affiliate marketing is coming soon plus a lot more ways to earn.',
                cta: 'Stay tuned',
                href: '/affiliate-guide'
              },
              {
                title: 'Track what converts',
                description: 'Watch sales, active links, pending earnings, and lead activity so you can keep improving what you share.',
                cta: 'View earnings',
                href: '/dashboard?section=affiliate&tab=earnings'
              },
              {
                title: 'Stay launch-ready',
                description: 'Keep your profile, payout settings, and promotion copy clean so your traffic lands on a professional page.',
                cta: 'Open settings',
                href: '/dashboard?section=affiliate&tab=settings'
              }
            ].map((item) => (
              <div key={item.title} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <h4 className="font-medium mb-2">{item.title}</h4>
                <p className="text-sm text-gray-600 mb-4">{item.description}</p>
                <a href={item.href} className="inline-flex items-center text-emerald-700 hover:text-emerald-800 text-sm font-medium">
                  {item.cta}
                </a>
              </div>
            ))}
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold mb-4">Compliance Reminders</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                <p className="font-medium text-yellow-900">Coming soon</p>
                <p className="text-yellow-800 mt-2">{insuranceAffiliateComingSoon}</p>
              </div>
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <p className="font-medium text-blue-900">Claims</p>
                <p className="text-blue-800 mt-2">Do not promise guaranteed approval, instant coverage, or private payout percentages.</p>
              </div>
              <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                <p className="font-medium text-emerald-900">Brand trust</p>
                <p className="text-emerald-800 mt-2">Keep your public pages simple, accurate, and benefit-led so sellers, agents, and shoppers trust the offer.</p>
              </div>
            </div>
          </div>
        </div>
      )}
      {activeTab === 'payments' && (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-gray-900">Payouts</h3>
          <p className="text-sm text-gray-600 mt-1">Payouts are handled by the platform's configured payment provider.</p>
        </div>
      )}
    </div>
  );
};

const money = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value || 0));

const AffiliateProductList = ({
  products,
  selectedProduct,
  onCopyLink,
  onOpenLinks,
}: {
  products: Product[];
  selectedProduct: string;
  onCopyLink: (productId: string) => void;
  onOpenLinks: (productId: string) => void;
}) => {
  if (!products.length) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center">
        <div className="font-semibold text-gray-900">No promoted products yet.</div>
        <p className="mt-1 text-sm text-gray-500">Open the marketplace and click Promote This Product to add products to your custom store and start sharing them.</p>
        <a
          href="/marketplace"
          className="mt-4 inline-flex items-center justify-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700"
        >
          <ShoppingBag className="h-4 w-4" />
          Open Marketplace
        </a>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50 text-left text-gray-600">
          <tr>
            <th className="px-3 py-2">Product</th>
            <th className="px-3 py-2">Seller</th>
            <th className="px-3 py-2">Category</th>
            <th className="px-3 py-2 text-right">Buyer Price</th>
            <th className="px-3 py-2 text-right">Commission</th>
            <th className="px-3 py-2 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {products.map((product) => {
            const commissionAmount =
              product.commission_type === 'percentage'
                ? (product.price * product.commission_rate) / 100
                : product.commission_rate;
            return (
              <tr key={product.id} className={selectedProduct === product.id ? 'bg-orange-50' : 'bg-white'}>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 overflow-hidden rounded bg-gray-100">
                      {product.image_url ? (
                        <img src={product.image_url} alt={product.title} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-gray-400">
                          <ShoppingBag className="h-5 w-5" />
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">{product.title}</div>
                      <div className="line-clamp-1 text-xs text-gray-500">{product.description}</div>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3 text-gray-600">{product.seller_name}</td>
                <td className="px-3 py-3 text-gray-600">{product.category}</td>
                <td className="px-3 py-3 text-right">{money(product.price)}</td>
                <td className="px-3 py-3 text-right text-green-700">
                  {money(commissionAmount)}
                </td>
                <td className="px-3 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => onCopyLink(product.id)}
                      className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                    >
                      Copy Link
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenLinks(product.id)}
                      className="rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-700"
                    >
                      Share
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default EnhancedAffiliateDashboard;
