import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  CreditCard,
  ExternalLink,
  HelpCircle,
  Mail,
  Package,
  PackagePlus,
  Plus,
  Settings,
  ShoppingCart,
  TrendingUp,
  Truck,
  Upload,
  Users,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContextMultiRole';
import { supabase } from '../lib/supabase';
import { apiPost } from '../utils/netlifyApi';
import StoreCustomization from './StoreCustomization';
import UniversalInbox from './UniversalInbox';
import UniversalIntegrationsPage from './UniversalIntegrationsPage';
import IssueCenterPage from '../pages/IssueCenterPage';
import SingleProductPromoStudio from './affiliate/SingleProductPromoStudio';
import InfluencerDashboard from './InfluencerDashboard';
import ManualFulfillmentQueue from './ManualFulfillmentQueue';
import AccountPayoutDashboard from './AccountPayoutDashboard';
import { normalizeProductImages } from '../utils/imageHelpers';
import { getBuyerFacingProductPrice } from '../utils/buyerPrice';
import { resolveProfileIdForUser } from '../utils/resolveProfileId';
import { archiveProductById } from '../utils/archiveProduct';
import { resolveAffiliateCommission } from '../utils/pricing';

export type SellerDashboardTab =
  | 'overview'
  | 'products'
  | 'links'
  | 'single-product'
  | 'influencer-promo'
  | 'bulk-upload'
  | 'orders'
  | 'shipping'
  | 'fulfillment'
  | 'inventory'
  | 'analytics'
  | 'customers'
  | 'financials'
  | 'integrations'
  | 'store-customization'
  | 'support'
  | 'messages';

interface EnhancedSellerDashboardProps {
  initialTab?: SellerDashboardTab;
  activeTabOverride?: SellerDashboardTab;
  onTabChange?: (tab: SellerDashboardTab) => void;
  hideInternalTabs?: boolean;
  title?: string;
  description?: string;
  mode?: 'seller' | 'affiliate' | 'influencer';
}

interface Product {
  id: string;
  title: string;
  description?: string | null;
  price?: number | null;
  calculated_customer_price?: number | null;
  seller_ask?: number | null;
  seller_amount?: number | null;
  seller_ask_price?: number | null;
  category?: string | null;
  images?: unknown;
  image_url?: string | null;
  affiliate_commission_rate?: number | null;
  affiliate_commission_type?: 'percent' | 'flat' | null;
  affiliate_commission_value?: number | null;
  commission_rate?: number | null;
  commission_type?: string | null;
  flat_commission_amount?: number | null;
  stock_quantity?: number | null;
  created_at?: string | null;
  seller_id?: string | null;
  status?: string | null;
}

interface OrderRow {
  id: string;
  order_number?: string | null;
  total_amount?: number | null;
  total_charged?: number | null;
  status?: string | null;
  payment_status?: string | null;
  created_at?: string | null;
  customer_email?: string | null;
  billing_email?: string | null;
}

interface PayoutSnapshotActivityRow {
  id: string;
  order_id: string | null;
  amount: number | null;
  status: string | null;
  created_at: string | null;
  hold_release_at?: string | null;
  snapshot_json?: {
    order_number?: string | null;
    total_charged?: number | null;
    items?: Array<{ product_title?: string | null }>;
  } | null;
}

interface AffiliateSalePulse {
  id: string;
  orderId: string | null;
  orderLabel: string;
  productTitle: string;
  earnedAmount: number;
  totalCharged: number;
  status: string;
  createdAt: string | null;
}

interface InfluencerProgressSummary {
  todaySales: number;
  weekSales: number;
  monthSales: number;
  yearSales: number;
  totalEarned: number;
  recentSales: AffiliateSalePulse[];
}

type ProductSalesSummary = {
  orderCount: number;
  quantitySold: number;
};

const money = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value || 0));
const PRODUCT_IMAGE_FALLBACK = 'https://placehold.co/400x300?text=No+Image';

const extractMissingColumnName = (message: string): string | null => {
  const pg = message.match(/column\s+"([^"]+)"\s+of\s+relation\s+"[^"]+"\s+does\s+not\s+exist/i);
  if (pg?.[1]) return pg[1];
  const pgDot = message.match(/column\s+([a-z0-9_]+\.[a-z0-9_]+)\s+does\s+not\s+exist/i);
  if (pgDot?.[1]) return pgDot[1].split('.').pop() || pgDot[1];
  const pgrst = message.match(/Could not find the '([^']+)' column of '[^']+' in the schema cache/i);
  if (pgrst?.[1]) return pgrst[1];
  const generic = message.match(/column ['"]?([a-zA-Z0-9_]+)['"]? does not exist/i);
  if (generic?.[1]) return generic[1];
  return null;
};

const removeSelectedField = (fields: string, missing: string): string =>
  fields
    .split(',')
    .map((field) => field.trim())
    .filter((field) => field && field !== missing)
    .join(',');

const getFirstImageUrl = (images: unknown, fallback?: string | null) => {
  const normalized = normalizeProductImages(images);
  return normalized[0] || fallback || '';
};

const getStatusTone = (status: string) => {
  const normalized = String(status || '').toUpperCase();
  if (normalized === 'PAID') return 'bg-emerald-100 text-emerald-800';
  if (normalized === 'READY_TO_PAY') return 'bg-blue-100 text-blue-800';
  if (normalized === 'ON_HOLD_DISPUTE') return 'bg-rose-100 text-rose-800';
  return 'bg-amber-100 text-amber-800';
};

const getOrderLabel = (row: PayoutSnapshotActivityRow) => {
  const orderNumber = String(row.snapshot_json?.order_number || '').trim();
  if (orderNumber) return orderNumber;
  const orderId = String(row.order_id || '').trim();
  return orderId ? `Order ${orderId.slice(0, 8)}` : 'Tracked sale';
};

const getProductTitle = (row: PayoutSnapshotActivityRow) => {
  const items = Array.isArray(row.snapshot_json?.items) ? row.snapshot_json?.items : [];
  const title = items
    .map((item) => String(item?.product_title || '').trim())
    .find(Boolean);
  return title || 'Marketplace sale';
};

const getSellerAskValue = (product: Product) => {
  const candidates = [
    Number(product?.seller_ask ?? NaN),
    Number(product?.seller_amount ?? NaN),
    Number(product?.seller_ask_price ?? NaN),
    Number(product?.price ?? NaN),
  ];
  return candidates.find((value) => Number.isFinite(value) && value > 0) || 0;
};

const getAffiliateCommissionSummary = (product: Product) => {
  const commission = resolveAffiliateCommission(product as any);
  return commission.type === 'flat' ? money(commission.value) : `${Number(commission.value || 0)}%`;
};

const EnhancedSellerDashboard: React.FC<EnhancedSellerDashboardProps> = ({
  initialTab,
  activeTabOverride,
  onTabChange,
  hideInternalTabs = false,
  title = 'Seller Dashboard',
  description = 'Sell your own products, promote marketplace products, and manage everything from one dashboard.',
  mode = 'seller',
}) => {
  const { user, profile, session } = useAuth();
  const normalizeTab = React.useCallback(
    (tab: SellerDashboardTab | undefined): SellerDashboardTab => {
      const requested = tab || 'products';
      if (requested === 'overview') return 'products';
      if (requested === 'shipping' || requested === 'fulfillment') return 'orders';
      return requested;
    },
    [mode]
  );
  const [activeTab, setActiveTab] = useState<SellerDashboardTab>(normalizeTab(activeTabOverride || initialTab || (mode === 'seller' ? 'products' : 'overview')));
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [promotedProducts, setPromotedProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [productSales, setProductSales] = useState<Record<string, ProductSalesSummary>>({});
  const [error, setError] = useState<string | null>(null);
  const [resolvedAffiliateId, setResolvedAffiliateId] = useState<string>('');
  const [copiedAffiliateProductId, setCopiedAffiliateProductId] = useState<string>('');
  const [unlistingAffiliateProductId, setUnlistingAffiliateProductId] = useState<string>('');
  const [removingSellerProductId, setRemovingSellerProductId] = useState<string>('');
  const [storePath, setStorePath] = useState<string>('/stores');
  const [affiliateSalePulse, setAffiliateSalePulse] = useState<AffiliateSalePulse[]>([]);
  const [influencerProgress, setInfluencerProgress] = useState<InfluencerProgressSummary>({
    todaySales: 0,
    weekSales: 0,
    monthSales: 0,
    yearSales: 0,
    totalEarned: 0,
    recentSales: [],
  });

  const sellerId = String(profile?.id || user?.id || '').trim();
  const affiliateOwnerId = String(resolvedAffiliateId || profile?.id || user?.id || '').trim();
  const affiliateOwnerIds = React.useMemo(
    () => (affiliateOwnerId ? [affiliateOwnerId] : []),
    [affiliateOwnerId]
  );
  const dashboardOwnerIds = React.useMemo(
    () =>
      Array.from(
        new Set([sellerId, ...affiliateOwnerIds].map((value) => String(value || '').trim()).filter(Boolean))
      ),
    [affiliateOwnerIds, sellerId]
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
    const next = normalizeTab(activeTabOverride);
    if (activeTabOverride && next !== activeTab) {
      setActiveTab(next);
    }
  }, [activeTab, activeTabOverride, normalizeTab]);

  useEffect(() => {
    if (initialTab && !activeTabOverride) {
      setActiveTab(normalizeTab(initialTab));
    }
  }, [activeTabOverride, initialTab, normalizeTab]);

  useEffect(() => {
    let cancelled = false;

    const loadDashboardData = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const ownerIds = Array.from(new Set([profile?.id, (profile as any)?.user_id, user.id].map((id) => String(id || '').trim()).filter(Boolean)));
        let productRows: Product[] = [];
        if (ownerIds.length) {
          const { data, error: productsError } = await supabase
            .from('products')
            .select('*')
            .in('seller_id', ownerIds)
            .neq('status', 'archived')
            .order('created_at', { ascending: false })
            .limit(200);
          if (productsError) throw productsError;
          productRows = (data as Product[]) || [];
        }

        if (!cancelled) setProducts(productRows);

        if (mode === 'seller' && session) {
          try {
            const payload = await apiPost<any>('/.netlify/functions/seller-dashboard-sales', session, {});
            const orderRows = Array.isArray(payload?.orders) ? payload.orders : [];
            const salesSummary = orderRows.reduce((acc: Record<string, ProductSalesSummary>, order: any) => {
              const items = Array.isArray(order?.order_items) ? order.order_items : [];
              items.forEach((row: any) => {
                const productId = String(row?.product_id || '').trim();
                if (!productId) return;
                const current = acc[productId] || { orderCount: 0, quantitySold: 0 };
                current.orderCount += 1;
                current.quantitySold += Number(row?.quantity || 1);
                acc[productId] = current;
              });
              return acc;
            }, {});

            if (!cancelled) {
              setOrders(orderRows as OrderRow[]);
              setProductSales(salesSummary);
            }
          } catch (salesError) {
            console.warn('[EnhancedSellerDashboard] seller-dashboard-sales load failed:', salesError);
            if (!cancelled) {
              setOrders([]);
              setProductSales({});
            }
          }
        } else if (!cancelled) {
          setOrders([]);
          setProductSales({});
        }
      } catch (err) {
        console.error('[EnhancedSellerDashboard] load failed:', err);
        if (!cancelled) setError(err instanceof Error ? err.message : 'Dashboard data failed to load.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadDashboardData();
    return () => {
      cancelled = true;
    };
  }, [mode, profile?.id, session, user?.id]);

  useEffect(() => {
    let cancelled = false;

    const loadPromotedProducts = async () => {
      if (!user || !affiliateOwnerIds.length) {
        setPromotedProducts([]);
        return;
      }

      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const session = sessionData?.session ?? null;
        let promotedRows: any[] = [];
        const readRows = (payload: any): any[] => (Array.isArray(payload?.rows) ? payload.rows : []);
        const readLocalRows = () => {
          if (typeof window === 'undefined' || !user?.id) return [];
          try {
            const raw = window.localStorage.getItem(`affiliate_products_${user.id}`);
            const selectedProducts = raw ? JSON.parse(raw) : [];
            if (!Array.isArray(selectedProducts)) return [];
            return selectedProducts
              .filter((entry: any) => entry?.selected !== false)
              .map((entry: any, index: number) => ({
                id: `local-${entry.productId || index}`,
                affiliate_id: affiliateOwnerId || user.id,
                product_id: entry.productId,
                product_snapshot: entry.product || null,
                display_order: index,
                created_at: entry.dateAdded || null,
              }))
              .filter((row: any) => String(row.product_id || '').trim());
          } catch {
            return [];
          }
        };

        const publicStoreIds = Array.from(
          new Set([affiliateOwnerId, ...affiliateOwnerIds].map((value) => String(value || '').trim()).filter(Boolean))
        );
        for (const storeId of publicStoreIds) {
          try {
            const response = await fetch(`/.netlify/functions/public-affiliate-store-get?affiliate=${encodeURIComponent(storeId)}`);
            const payload = await response.json().catch(() => null);
            const rows = readRows(payload);
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
            const payload = await apiPost<any>('/.netlify/functions/affiliate-products-list', session, {
              affiliate_id: affiliateOwnerId,
              affiliate_ids: affiliateOwnerIds,
            });
            promotedRows = readRows(payload);
          } catch {
            try {
              const payload = await apiPost<any>('/api/affiliate/products/list', session, {
                affiliate_id: affiliateOwnerId,
                affiliate_ids: affiliateOwnerIds,
              });
              promotedRows = readRows(payload);
            } catch {
              promotedRows = [];
            }
          }
        }

        const hydrateProductRows = async (rows: any[]) => {
          const embeddedRows = rows
            .map((row: any) => {
              const product = row?.products || row?.product || row?.product_snapshot || null;
              const productId = String(row?.product_id || row?.productId || product?.id || '').trim();
              if (!product?.id || !productId) return null;
              return {
                ...row,
                product_id: productId,
                products: product,
              };
            })
            .filter(Boolean);
          if (embeddedRows.length === rows.length) {
            return embeddedRows;
          }

          const productIds = Array.from(
            new Set(
              rows
                .map((row: any) => String(row?.product_id || row?.productId || row?.products?.id || row?.product?.id || '').trim())
                .filter(Boolean)
            )
          );
          if (!productIds.length) return [];

          let selectFields =
            'id,title,name,description,price,seller_ask,seller_amount,seller_ask_price,commission_rate,affiliate_commission_rate,commission_type,affiliate_commission_type,flat_commission_amount,category,image_url,images,seller_id,is_active,is_promotable,status';
          let productRows: any[] | null = null;
          let productError: any = null;

          for (let attempt = 0; attempt < 16; attempt += 1) {
            const result = await supabase.from('products').select(selectFields).in('id', productIds);
            if (!result.error) {
              productRows = Array.isArray(result.data) ? result.data : [];
              productError = null;
              break;
            }

            productError = result.error;
            const missing = extractMissingColumnName(String((result.error as any)?.message || ''));
            if (missing && selectFields.split(',').map((field) => field.trim()).includes(missing)) {
              selectFields = removeSelectedField(selectFields, missing);
              continue;
            }
            break;
          }

          if (productError || !Array.isArray(productRows)) {
            console.warn('[EnhancedSellerDashboard] product hydration failed:', productError?.message || productError);
            return rows
              .map((row: any) => {
                const fallbackProduct = row?.products || row?.product || row?.product_snapshot || null;
                return fallbackProduct?.id
                  ? {
                      ...row,
                      product_id: String(row?.product_id || row?.productId || fallbackProduct.id || '').trim(),
                      products: fallbackProduct,
                    }
                  : row;
              });
          }

          const productsById = new Map(productRows.map((product: any) => [String(product.id), product]));
          const sellerIds = Array.from(new Set(productRows.map((product: any) => String(product?.seller_id || '').trim()).filter(Boolean)));
          const sellerNameById = new Map<string, string>();
          if (sellerIds.length) {
            try {
              const { data: sellers } = await supabase
                .from('profiles')
                .select('id,full_name,email')
                .in('id', sellerIds);
              ((sellers as any[]) || []).forEach((seller: any) => {
                const id = String(seller?.id || '').trim();
                if (id) sellerNameById.set(id, String(seller?.full_name || seller?.email || 'Marketplace Seller'));
              });
            } catch {
              // Seller names are helpful, not required for the list to render.
            }
          }

          return rows
            .map((row: any) => {
              const productId = String(row?.product_id || row?.productId || row?.products?.id || row?.product?.id || '').trim();
              const product = productsById.get(productId) || row?.products || row?.product || row?.product_snapshot || null;
              if (!product?.id) return null;
              const sellerIdForName = String((product as any)?.seller_id || '').trim();
              return {
                ...row,
                product_id: productId,
                products: {
                  ...(product as any),
                  seller_name: sellerNameById.get(sellerIdForName) || (product as any)?.seller_name || 'Marketplace Seller',
                },
              };
            })
            .filter(Boolean);
        };

        const localRows = await hydrateProductRows(readLocalRows());
        if (localRows.length > 0) {
          promotedRows = localRows;
        }

        const seenProductIds = new Set<string>();
        const formatted = promotedRows
          .map((row: any) => {
            const product = row?.products || row?.product;
            const productId = String(product?.id || row?.product_id || '').trim();
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
              image_url: getFirstImageUrl(product.images, product.image_url),
              seller_name: product.profiles?.full_name || product.seller_name || 'Marketplace Seller',
              display_order: Number(row?.display_order ?? 999),
            } as Product & { commission_type?: 'percentage' | 'fixed'; seller_name?: string; image_url?: string; display_order?: number };
          })
          .filter(Boolean)
          .sort((a: any, b: any) => Number(a.display_order ?? 999) - Number(b.display_order ?? 999)) as Product[];

        if (!cancelled) setPromotedProducts(formatted);
      } catch (err) {
        console.warn('[EnhancedSellerDashboard] promoted products load failed:', err);
        if (!cancelled) setPromotedProducts([]);
      }
    };

    void loadPromotedProducts();

    const refresh = (event: Event) => {
      const changedAffiliateId = String((event as CustomEvent<{ affiliateId?: string | null }>).detail?.affiliateId || '').trim();
      if (!changedAffiliateId || affiliateOwnerIds.includes(changedAffiliateId)) {
        void loadPromotedProducts();
      }
    };
    window.addEventListener('affiliate-products-changed', refresh as EventListener);

    return () => {
      cancelled = true;
      window.removeEventListener('affiliate-products-changed', refresh as EventListener);
    };
  }, [affiliateOwnerId, affiliateOwnerIds.join('|'), user?.id]);

  useEffect(() => {
    let cancelled = false;

    const loadStorePath = async () => {
      if (mode === 'affiliate') {
        const affiliateId = String(affiliateOwnerId || sellerId || '').trim();
        if (!affiliateId) {
          if (!cancelled) setStorePath('/dashboard?section=affiliate&tab=products');
          return;
        }

        try {
          const { data } = await supabase
            .from('affiliate_store_settings')
            .select('subdomain, custom_domain')
            .eq('affiliate_id', affiliateId)
            .maybeSingle();

          if (cancelled) return;

          const customDomain = String(data?.custom_domain || '').trim();
          if (customDomain) {
            setStorePath(`https://${customDomain.replace(/^https?:\/\//, '').replace(/\/$/, '')}`);
            return;
          }

          const subdomain = String(data?.subdomain || '').trim().toLowerCase();
          if (subdomain) {
            setStorePath(`/store/${subdomain}`);
            return;
          }
        } catch {
          // Fallback below keeps affiliate storefront navigation working.
        }

        if (!cancelled) {
          setStorePath(`/partner/${encodeURIComponent(affiliateId)}`);
        }
        return;
      }

      const activeSellerId = String(sellerId || '').trim();
      if (!activeSellerId) {
        if (!cancelled) setStorePath('/stores');
        return;
      }

      try {
        const [{ data }, { data: profileData }] = await Promise.all([
          supabase
            .from('store_settings')
            .select('subdomain, custom_domain')
            .eq('seller_id', activeSellerId)
            .maybeSingle(),
          supabase
            .from('profiles')
            .select('subdomain')
            .eq('id', activeSellerId)
            .maybeSingle(),
        ]);

        if (cancelled) return;

        const customDomain = String(data?.custom_domain || '').trim();
        if (customDomain) {
          setStorePath(`https://${customDomain.replace(/^https?:\/\//, '').replace(/\/$/, '')}`);
          return;
        }

        const subdomain = String(data?.subdomain || profileData?.subdomain || '').trim().toLowerCase();
        if (subdomain) {
          setStorePath(`/store/${subdomain}`);
          return;
        }
      } catch {
        // Fallback below keeps seller storefront navigation working.
      }

      if (!cancelled) {
        setStorePath(`/store/${activeSellerId}`);
      }
    };

    void loadStorePath();
    return () => {
      cancelled = true;
    };
  }, [affiliateOwnerId, mode, sellerId]);

  useEffect(() => {
    let cancelled = false;

    const loadUnifiedActivity = async () => {
      if (!user?.id || !dashboardOwnerIds.length) {
        if (!cancelled) {
          setAffiliateSalePulse([]);
          setInfluencerProgress({
            todaySales: 0,
            weekSales: 0,
            monthSales: 0,
            yearSales: 0,
            totalEarned: 0,
            recentSales: [],
          });
        }
        return;
      }

      try {
        if (mode === 'affiliate') {
          const { data, error: snapshotError } = await supabase
            .from('payout_snapshots')
            .select('id, order_id, amount, status, created_at, hold_release_at, snapshot_json')
            .eq('payee_role', 'PARTNER')
            .in('payee_user_id', dashboardOwnerIds)
            .order('created_at', { ascending: false })
            .limit(24);

          if (snapshotError) throw snapshotError;
          if (cancelled) return;

          const rows = ((data as any[]) || []) as PayoutSnapshotActivityRow[];
          setAffiliateSalePulse(
            rows.slice(0, 6).map((row) => ({
              id: row.id,
              orderId: row.order_id,
              orderLabel: getOrderLabel(row),
              productTitle: getProductTitle(row),
              earnedAmount: Number(row.amount || 0),
              totalCharged: Number(row.snapshot_json?.total_charged || 0),
              status: String(row.status || 'PENDING_HOLD'),
              createdAt: row.created_at || null,
            }))
          );
        }

        if (mode === 'influencer') {
          const { data, error: snapshotError } = await supabase
            .from('payout_snapshots')
            .select('id, order_id, amount, status, created_at, hold_release_at, snapshot_json')
            .eq('payee_role', 'INFLUENCER')
            .in('payee_user_id', dashboardOwnerIds)
            .order('created_at', { ascending: false })
            .limit(250);

          if (snapshotError) throw snapshotError;
          if (cancelled) return;

          const rows = ((data as any[]) || []) as PayoutSnapshotActivityRow[];
          const now = new Date();
          const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          const startOfWeek = new Date(startOfToday);
          startOfWeek.setDate(startOfToday.getDate() - startOfToday.getDay());
          const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
          const startOfYear = new Date(now.getFullYear(), 0, 1);

          const countUniqueSalesSince = (start: Date) => {
            const saleIds = new Set<string>();
            rows.forEach((row) => {
              const createdAt = row.created_at ? new Date(row.created_at) : null;
              if (!createdAt || Number.isNaN(createdAt.getTime()) || createdAt < start) return;
              saleIds.add(String(row.order_id || row.id));
            });
            return saleIds.size;
          };

          setInfluencerProgress({
            todaySales: countUniqueSalesSince(startOfToday),
            weekSales: countUniqueSalesSince(startOfWeek),
            monthSales: countUniqueSalesSince(startOfMonth),
            yearSales: countUniqueSalesSince(startOfYear),
            totalEarned: rows.reduce((sum, row) => sum + Number(row.amount || 0), 0),
            recentSales: rows.slice(0, 6).map((row) => ({
              id: row.id,
              orderId: row.order_id,
              orderLabel: getOrderLabel(row),
              productTitle: getProductTitle(row),
              earnedAmount: Number(row.amount || 0),
              totalCharged: Number(row.snapshot_json?.total_charged || 0),
              status: String(row.status || 'PENDING_HOLD'),
              createdAt: row.created_at || null,
            })),
          });
        }
      } catch (activityError) {
        console.warn('[EnhancedSellerDashboard] unified activity load failed:', activityError);
        if (!cancelled) {
          if (mode === 'affiliate') setAffiliateSalePulse([]);
          if (mode === 'influencer') {
            setInfluencerProgress({
              todaySales: 0,
              weekSales: 0,
              monthSales: 0,
              yearSales: 0,
              totalEarned: 0,
              recentSales: [],
            });
          }
        }
      }
    };

    void loadUnifiedActivity();
    return () => {
      cancelled = true;
    };
  }, [dashboardOwnerIds, mode, user?.id]);

  const handleTabClick = (tab: SellerDashboardTab) => {
    const next = normalizeTab(tab);
    setActiveTab(next);
    onTabChange?.(next);
  };

  const generateAffiliateProductLink = (productId: string) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const uid = encodeURIComponent(affiliateOwnerId);
    return `${origin}/partner/${affiliateOwnerId}/product/${productId}?ref=${affiliateOwnerId}&uid=${uid}`;
  };

  const copyAffiliateProductLink = async (productId: string) => {
    try {
      await navigator.clipboard.writeText(generateAffiliateProductLink(productId));
      setCopiedAffiliateProductId(productId);
      window.setTimeout(() => setCopiedAffiliateProductId(''), 1500);
    } catch (err) {
      console.warn('[EnhancedSellerDashboard] copy affiliate product link failed:', err);
    }
  };

  const unlistAffiliateProduct = async (productId: string) => {
    if (!productId || !affiliateOwnerIds.length) return;
    const confirmed = window.confirm('Unlist this affiliate product from your custom store?');
    if (!confirmed) return;

    try {
      setUnlistingAffiliateProductId(productId);
      const { error } = await supabase
        .from('affiliate_products')
        .delete()
        .in('affiliate_id', affiliateOwnerIds)
        .eq('product_id', productId);
      if (error) throw error;

      setPromotedProducts((prev) => prev.filter((product) => product.id !== productId));
      if (typeof window !== 'undefined' && user?.id) {
        try {
          const storageKey = `affiliate_products_${user.id}`;
          const existing = JSON.parse(window.localStorage.getItem(storageKey) || '[]');
          if (Array.isArray(existing)) {
            window.localStorage.setItem(
              storageKey,
              JSON.stringify(existing.filter((entry: any) => String(entry?.productId || '') !== String(productId)))
            );
          }
        } catch {
          // ignore local fallback cleanup
        }
      }
      window.dispatchEvent(
        new CustomEvent('affiliate-products-changed', {
          detail: { productId, affiliateId: affiliateOwnerId || null },
        })
      );
    } catch (err) {
      console.warn('[EnhancedSellerDashboard] affiliate product unlist failed:', err);
      window.alert('Could not unlist this affiliate product. Please try again.');
    } finally {
      setUnlistingAffiliateProductId('');
    }
  };

  const removeSellerProduct = async (productId: string) => {
    if (!productId) return;
    const confirmed = window.confirm('Remove this product from your active dashboard and marketplace listings? Promoter links and payout history will be kept.');
    if (!confirmed) return;

    try {
      setRemovingSellerProductId(productId);
      const product = products.find((entry) => entry.id === productId);
      const sellerId = String(product?.seller_id || profile?.id || user?.id || '').trim() || undefined;
      await archiveProductById({ productId, sellerId });
      setProducts((prev) => prev.filter((entry) => entry.id !== productId));
    } catch (err) {
      console.warn('[EnhancedSellerDashboard] seller product remove failed:', err);
      window.alert('Could not remove this product. Please try again.');
    } finally {
      setRemovingSellerProductId('');
    }
  };

  const stats = {
    products: products.length,
    orders: orders.length,
    revenue: orders.reduce((sum, order) => sum + Number(order.total_charged ?? order.total_amount ?? 0), 0),
    lowStock: products.filter((product) => Number(product.stock_quantity ?? 0) > 0 && Number(product.stock_quantity ?? 0) <= 5).length,
    sellingProducts: products.filter((product) => Number(productSales[product.id]?.quantitySold || 0) > 0).length,
    unsoldProducts: products.filter((product) => Number(productSales[product.id]?.quantitySold || 0) <= 0).length,
  };

  const topSellingProducts = React.useMemo(
    () =>
      [...products]
        .map((product) => ({
          id: product.id,
          title: product.title || 'Product',
          quantitySold: Number(productSales[product.id]?.quantitySold || 0),
          orderCount: Number(productSales[product.id]?.orderCount || 0),
          price: getBuyerFacingProductPrice(product as any),
        }))
        .sort((a, b) => b.quantitySold - a.quantitySold || b.orderCount - a.orderCount)
        .slice(0, 5),
    [productSales, products]
  );

  const unsoldProductsPreview = React.useMemo(
    () =>
      products
        .filter((product) => Number(productSales[product.id]?.quantitySold || 0) <= 0)
        .slice(0, 5),
    [productSales, products]
  );

  const promoProducts = React.useMemo(() => {
    const seenProductIds = new Set<string>();
    const ownProducts = products.map((product) => ({
      id: product.id,
      title: product.title || 'Product',
      description: product.description || '',
      price: getBuyerFacingProductPrice(product as any),
      commission_rate: Number(product.affiliate_commission_rate ?? product.commission_rate ?? 0),
      image_url: getFirstImageUrl(product.images, product.image_url),
      seller_name: String(profile?.full_name || profile?.email || 'Seller'),
      category: product.category || undefined,
    }));

    return [...ownProducts, ...promotedProducts]
      .filter((product) => {
        const productId = String(product?.id || '').trim();
        if (!productId || seenProductIds.has(productId)) return false;
        seenProductIds.add(productId);
        return true;
      })
      .map((product) => ({
        id: product.id,
        title: product.title || 'Product',
        description: product.description || '',
        price: getBuyerFacingProductPrice(product as any),
        commission_rate: Number((product as any).affiliate_commission_rate ?? product.commission_rate ?? 0),
        image_url: getFirstImageUrl(product.images, product.image_url),
        seller_name: String((product as any).seller_name || profile?.full_name || profile?.email || 'Seller'),
        category: product.category || undefined,
      }));
  }, [products, promotedProducts, profile?.full_name, profile?.email]);

  const tabs: Array<{ id: SellerDashboardTab; label: string; icon: React.ComponentType<{ className?: string }> }> = mode === 'seller'
    ? [
        { id: 'products', label: 'Products', icon: Package },
        { id: 'orders', label: 'Orders', icon: Truck },
        { id: 'financials', label: 'Financials', icon: CreditCard },
        { id: 'single-product', label: 'Single Product', icon: ExternalLink },
        { id: 'influencer-promo', label: 'Influencer Promo', icon: Users },
        { id: 'bulk-upload', label: 'Bulk Upload', icon: Upload },
        { id: 'customers', label: 'Customers', icon: Users },
        { id: 'analytics', label: 'Analytics', icon: TrendingUp },
        { id: 'store-customization', label: 'Custom Store', icon: Settings },
        { id: 'integrations', label: 'Integrations', icon: Settings },
        { id: 'messages', label: 'Messages', icon: Mail },
        { id: 'support', label: 'Support', icon: HelpCircle },
      ]
    : [
        { id: 'products', label: 'Products', icon: Package },
        { id: 'financials', label: 'Financials', icon: CreditCard },
        { id: 'single-product', label: 'Single Product', icon: ExternalLink },
        { id: 'influencer-promo', label: 'Influencer Promo', icon: Users },
        { id: 'bulk-upload', label: 'Bulk Upload', icon: Upload },
        { id: 'customers', label: 'Customers', icon: Users },
        { id: 'analytics', label: 'Analytics', icon: TrendingUp },
        { id: 'store-customization', label: 'Custom Store & Branding', icon: Settings },
        { id: 'integrations', label: 'Integrations', icon: Settings },
        { id: 'messages', label: 'Messages', icon: Mail },
        { id: 'support', label: 'Support', icon: HelpCircle },
      ];

  const renderOverview = () => {
    if (mode === 'affiliate') {
      const totalAffiliateEarnings = affiliateSalePulse.reduce((sum, row) => sum + row.earnedAmount, 0);
      return (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <StatCard label="Recent Sales" value={String(affiliateSalePulse.length)} />
            <StatCard label="Recent Earnings" value={money(totalAffiliateEarnings)} />
            <StatCard label="Promoted Products" value={String(promotedProducts.length)} />
            <StatCard label="Links Ready" value={String(promoProducts.length)} />
          </div>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr,0.8fr]">
            <div className="rounded-xl border border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50 p-5">
              <h2 className="text-lg font-semibold text-gray-900">Sales You Drove</h2>
              <p className="mt-1 text-sm text-gray-700">
                Every tracked sale shows here with your earned amount only. Customer details stay hidden.
              </p>
              <div className="mt-4 space-y-3">
                {affiliateSalePulse.length ? affiliateSalePulse.map((sale) => (
                  <div key={sale.id} className="rounded-lg border border-white/80 bg-white px-4 py-3 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-gray-900">{sale.productTitle}</div>
                        <div className="mt-1 text-sm text-gray-500">{sale.orderLabel}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-orange-700">{money(sale.earnedAmount)}</div>
                        <div className="text-xs text-gray-500">You earned on a {money(sale.totalCharged)} order</div>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
                      <span>{sale.createdAt ? new Date(sale.createdAt).toLocaleString() : 'Recently tracked'}</span>
                      <span className={`rounded-full px-2.5 py-1 font-semibold ${getStatusTone(sale.status)}`}>
                        {sale.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                  </div>
                )) : (
                  <div className="rounded-lg border border-dashed border-orange-200 bg-white/70 px-4 py-6 text-sm text-gray-600">
                    Your affiliate sale feed will appear here as soon as a tracked order closes.
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-4">
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-5">
                <h2 className="text-lg font-semibold text-gray-900">Affiliate momentum</h2>
                <p className="mt-2 text-sm text-gray-700">
                  Keep your product links active. New sales drop into this feed automatically from the payout ledger.
                </p>
              </div>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
                <h2 className="text-lg font-semibold text-gray-900">Next move</h2>
                <p className="mt-2 text-sm text-gray-700">
                  Add more marketplace products to your store, then share direct product links to grow your commission volume.
                </p>
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={() => handleTabClick('products')}
                    className="inline-flex items-center gap-2 rounded-lg border border-emerald-300 bg-white px-4 py-2 text-sm font-semibold text-emerald-900 hover:bg-emerald-100"
                  >
                    Open Products
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <AccountPayoutDashboard />
            </div>
          </div>
        </>
      );
    }

    if (mode === 'influencer') {
      return (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <StatCard label="Today" value={String(influencerProgress.todaySales)} />
            <StatCard label="This Week" value={String(influencerProgress.weekSales)} />
            <StatCard label="This Month" value={String(influencerProgress.monthSales)} />
            <StatCard label="This Year" value={String(influencerProgress.yearSales)} />
          </div>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.1fr,0.9fr]">
            <div className="rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50 to-sky-50 p-5">
              <h2 className="text-lg font-semibold text-gray-900">Influence scoreboard</h2>
              <p className="mt-1 text-sm text-gray-700">
                Watch your recruited sales stack up by day, week, month, and year. Each sale is counted from the payout ledger.
              </p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <QuickMetricCard label="Tracked Earnings" value={money(influencerProgress.totalEarned)} tone="emerald" />
                <QuickMetricCard label="Recent Influenced Sales" value={String(influencerProgress.recentSales.length)} tone="slate" />
              </div>
              <div className="mt-4 space-y-3">
                {influencerProgress.recentSales.length ? influencerProgress.recentSales.map((sale) => (
                  <div key={sale.id} className="rounded-lg border border-white/80 bg-white px-4 py-3 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-gray-900">{sale.productTitle}</div>
                        <div className="mt-1 text-sm text-gray-500">{sale.orderLabel}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-violet-700">{money(sale.earnedAmount)}</div>
                        <div className="text-xs text-gray-500">Influencer payout logged</div>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
                      <span>{sale.createdAt ? new Date(sale.createdAt).toLocaleString() : 'Recently tracked'}</span>
                      <span className={`rounded-full px-2.5 py-1 font-semibold ${getStatusTone(sale.status)}`}>
                        {sale.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                  </div>
                )) : (
                  <div className="rounded-lg border border-dashed border-violet-200 bg-white/70 px-4 py-6 text-sm text-gray-600">
                    Your scoreboard starts filling as soon as recruited seller or affiliate sales are attributed to you.
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-4">
              <div className="rounded-xl border border-sky-200 bg-sky-50 p-5">
                <h2 className="text-lg font-semibold text-gray-900">Progress rhythm</h2>
                <p className="mt-2 text-sm text-gray-700">
                  Daily wins show momentum. Monthly and yearly totals show how much of the network is now moving through your links.
                </p>
              </div>
              <div className="rounded-xl border border-violet-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-semibold text-gray-900">Recruiting tools</h2>
                <p className="mt-2 text-sm text-gray-700">
                  Jump to your promo builder to copy the public invite link and update your recruiting page.
                </p>
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={() => handleTabClick('influencer-promo')}
                    className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700"
                  >
                    Open Influencer Promo
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <AccountPayoutDashboard />
            </div>
          </div>
        </>
      );
    }

    return (
      <>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <StatCard label="Products" value={String(stats.products)} />
          <StatCard label="Orders" value={String(stats.orders)} />
          <StatCard label="Revenue" value={money(stats.revenue)} />
          <StatCard label="Low Stock" value={String(stats.lowStock)} />
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
            <h2 className="text-lg font-semibold text-gray-900">What happens after a sale</h2>
            <ol className="mt-3 space-y-2 text-sm text-gray-700">
              <li>1. The order appears in <strong>Orders</strong>.</li>
              <li>2. You print the fulfillment sheet and shipping label.</li>
              <li>3. You add tracking and mark the order shipped.</li>
              <li>4. The payout ledger tracks what is held, available, and paid.</li>
            </ol>
          </div>
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-5">
            <h2 className="text-lg font-semibold text-gray-900">Seller payout rule</h2>
            <p className="mt-2 text-sm text-gray-700">
              You keep <strong>100% of your seller ask</strong> when the order clears. Beezio platform fees are built into the buyer price and are not taken out of your seller ask.
            </p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
            <h2 className="text-lg font-semibold text-gray-900">Affiliate payout rule</h2>
            <p className="mt-2 text-sm text-gray-700">
              Affiliates receive the full commission amount shown on the product. Their earnings do not reduce your seller ask.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.25fr,1fr]">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Seller Operations</h2>
                <p className="mt-1 text-sm text-gray-600">
                  Review the order, print the pick sheet, add tracking, and push shipping updates back to the buyer account from one place.
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleTabClick('orders')}
                className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800"
              >
                Open Orders
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <QuickMetricCard label="Paid Orders" value={String(stats.orders)} tone="slate" />
              <QuickMetricCard label="Revenue Logged" value={money(stats.revenue)} tone="emerald" />
              <QuickMetricCard label="Low Stock Alerts" value={String(stats.lowStock)} tone="amber" />
            </div>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
            <h2 className="text-lg font-semibold text-gray-900">Payouts On Overview</h2>
            <p className="mt-1 text-sm text-gray-700">
              Seller, affiliate, and influencer balances stay visible here so you do not have to dig through the dashboard to see what is owed.
            </p>
            <div className="mt-4">
              <button
                type="button"
                onClick={() => handleTabClick('financials')}
                className="inline-flex items-center gap-2 rounded-lg border border-emerald-300 bg-white px-4 py-2 text-sm font-semibold text-emerald-900 hover:bg-emerald-100"
              >
                Open Full Payouts
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-orange-200 bg-orange-50 p-5">
          <h2 className="text-lg font-semibold text-gray-900">Sell or promote products</h2>
          <p className="mt-2 text-sm text-gray-700">
            Sell a product when it is yours. Promote marketplace products when you want to earn from someone else's item.
          </p>
        </div>
        <AccountPayoutDashboard />
      </>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-10">
      {!hideInternalTabs && (
        <div className="sticky top-16 z-40 -mx-4 border-b border-gray-200 bg-white/95 px-4 backdrop-blur sm:-mx-6 sm:px-6">
          <div className="py-3">
            <div className="flex items-center justify-between gap-4">
              <div className="text-sm font-semibold text-gray-900">Dashboard Menu</div>
              <div className="hidden md:block text-xs text-gray-500">Choose a section</div>
            </div>
            <div className="mt-3 md:hidden">
              <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500">
                Current section
              </label>
              <select
                value={activeTab}
                onChange={(event) => handleTabClick(event.target.value as SellerDashboardTab)}
                className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-900 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
              >
                {tabs.map((tab) => (
                  <option key={tab.id} value={tab.id}>
                    {tab.label}
                  </option>
                ))}
              </select>
            </div>
            <nav className="hidden items-center gap-5 overflow-x-auto md:flex">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => handleTabClick(tab.id)}
                    className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-1 py-2 text-sm font-medium ${
                      activeTab === tab.id
                        ? 'border-orange-500 text-orange-600'
                        : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      )}

      <div className="pt-6">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
            <p className="mt-2 text-gray-600">{description}</p>
          </div>
          <Link
            to={storePath}
            className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700"
          >
            <ExternalLink className="h-4 w-4" />
            View Store
          </Link>
        </div>

        {error && (
          <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex min-h-[360px] items-center justify-center">
            <div className="text-center">
              <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-orange-600" />
              <p className="text-gray-600">Loading seller dashboard...</p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {activeTab === 'overview' && renderOverview()}

            {activeTab === 'financials' && <AccountPayoutDashboard />}

            {activeTab === 'products' && (
              <div className="space-y-6">
                <div className="rounded-xl border border-orange-200 bg-orange-50 p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <h2 className="text-xl font-semibold text-gray-900">Products</h2>
                      <p className="mt-1 text-sm text-gray-700">
                        Sell your own products or promote marketplace products from one list.
                      </p>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Link
                        to="/dashboard/products/add"
                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700"
                      >
                        <Plus className="h-4 w-4" />
                        Sell a Product
                      </Link>
                      <Link
                        to="/marketplace"
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-orange-300 bg-white px-4 py-2 text-sm font-semibold text-orange-800 hover:bg-orange-50"
                      >
                        <ShoppingCart className="h-4 w-4" />
                        Promote Products
                      </Link>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <SellerActionCard
                    icon={Plus}
                    title="Sell a Product"
                    text="Use this when the product is yours. It goes to your dashboard, your custom store, and the marketplace."
                    to="/dashboard/products/add"
                    cta="Sell a Product"
                  />
                  <SellerActionCard
                    icon={PackagePlus}
                    title="Promote Products"
                    text="Pick marketplace products, add them to your store, and earn when they sell."
                    to="/marketplace"
                    cta="Promote Products"
                  />
                </div>
                <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                  <div className="min-w-0 rounded-xl border bg-white p-5">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">Products You Sell</h3>
                        <p className="mt-1 text-sm text-gray-600">Products you own and sell directly.</p>
                      </div>
                      <Link to="/dashboard/products/add" className="shrink-0 text-sm font-semibold text-orange-700 hover:text-orange-800">
                        Add another
                      </Link>
                    </div>
                    <ProductList
                      products={products}
                      removingProductId={removingSellerProductId}
                      onRemove={removeSellerProduct}
                    />
                  </div>
                  <div className="min-w-0 rounded-xl border bg-white p-5">
                    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">Products You Promote</h3>
                        <p className="mt-1 text-sm text-gray-600">
                          These were added from the marketplace to your affiliate custom store. You can unlist them or promote them one item at a time.
                        </p>
                      </div>
                      <span className="text-sm text-gray-500">{promotedProducts.length} total</span>
                    </div>
                    <AffiliatePromotionList
                      products={promotedProducts}
                      copiedProductId={copiedAffiliateProductId}
                      unlistingProductId={unlistingAffiliateProductId}
                      onCopyLink={copyAffiliateProductLink}
                      onUnlist={unlistAffiliateProduct}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                  <div className="rounded-xl border bg-white p-5 shadow-sm">
                    <h2 className="text-lg font-semibold text-gray-900">Products selling now</h2>
                    <p className="mt-1 text-sm text-gray-600">
                      These products have orders logged in Beezio and are your current movers.
                    </p>
                    <div className="mt-4 space-y-3">
                      {topSellingProducts.filter((product) => product.quantitySold > 0).length ? (
                        topSellingProducts
                          .filter((product) => product.quantitySold > 0)
                          .map((product) => (
                            <div key={product.id} className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3">
                              <div>
                                <div className="font-medium text-gray-900">{product.title}</div>
                                <div className="text-sm text-gray-500">{money(product.price)} buyer price</div>
                              </div>
                              <div className="text-right text-sm">
                                <div className="font-semibold text-gray-900">{product.quantitySold} sold</div>
                                <div className="text-gray-500">{product.orderCount} orders</div>
                              </div>
                            </div>
                          ))
                      ) : (
                        <div className="rounded-lg border border-dashed border-gray-300 px-4 py-4 text-sm text-gray-500">
                          No seller product orders have been logged yet.
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="rounded-xl border bg-white p-5 shadow-sm">
                    <h2 className="text-lg font-semibold text-gray-900">Products not selling yet</h2>
                    <p className="mt-1 text-sm text-gray-600">
                      These are live products with no logged orders yet. Promote or revise them first.
                    </p>
                    <div className="mt-4 space-y-3">
                      {unsoldProductsPreview.length ? (
                        unsoldProductsPreview.map((product) => (
                          <div key={product.id} className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3">
                            <div>
                              <div className="font-medium text-gray-900">{product.title || 'Product'}</div>
                              <div className="text-sm text-gray-500">{money(getBuyerFacingProductPrice(product as any))} buyer price</div>
                            </div>
                            <div className="text-sm font-semibold text-gray-500">0 sold</div>
                          </div>
                        ))
                      ) : (
                        <div className="rounded-lg border border-dashed border-gray-300 px-4 py-6 text-sm text-gray-500">
                          Every listed product has at least one logged order.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'single-product' && (
              <SingleProductPromoStudio
                products={promoProducts}
                promoterRole="seller"
                ownerId={sellerId}
                title="Promote one product at a time"
              />
            )}

            {activeTab === 'links' && (
              <Placeholder title="Links" text="Use Single Product pages and your Custom Store link to share products you sell or promote." />
            )}

            {activeTab === 'influencer-promo' && (
              <InfluencerDashboard />
            )}

            {activeTab === 'bulk-upload' && (
              <Placeholder title="Bulk Upload" text="Bulk upload is available from the product import tools. The stable dashboard shell is active while the full uploader is being reattached safely." />
            )}

            {(activeTab === 'orders' || activeTab === 'shipping' || activeTab === 'fulfillment') && (
              <div className="space-y-6">
                <div className="rounded-xl border border-orange-200 bg-orange-50 p-5">
                  <h2 className="text-xl font-semibold text-gray-900">Current Orders</h2>
                  <p className="mt-1 text-sm text-gray-700">
                    Every order row opens its full purchase details. Red means it is new and still needs fulfillment. Green means it has already shipped. Add tracking inside the order before marking it shipped.
                  </p>
                </div>
                <ManualFulfillmentQueue
                  scope="seller"
                  title="Current Orders"
                  subtitle="Open any order row to review the purchase, print docs, add tracking, and push shipment updates back to the buyer."
                />
              </div>
            )}

            {activeTab === 'customers' && (
              <Placeholder title="Customers" text="Customer history is based on completed seller orders. Detailed customer tools will be reattached after the dashboard crash is fully cleared." />
            )}

            {activeTab === 'analytics' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                  <StatCard label="Products Selling" value={String(stats.sellingProducts)} />
                  <StatCard label="Products Not Selling" value={String(stats.unsoldProducts)} />
                  <StatCard label="Orders Logged" value={String(stats.orders)} />
                  <StatCard label="Revenue Logged" value={money(stats.revenue)} />
                </div>
                <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                  <div className="rounded-xl border bg-white p-5 shadow-sm">
                    <h2 className="text-lg font-semibold text-gray-900">Top sellers</h2>
                    <div className="mt-4 space-y-3">
                      {topSellingProducts.filter((product) => product.quantitySold > 0).length ? (
                        topSellingProducts
                          .filter((product) => product.quantitySold > 0)
                          .map((product) => (
                            <div key={product.id} className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3">
                              <div className="font-medium text-gray-900">{product.title}</div>
                              <div className="text-right text-sm text-gray-600">
                                <div>{product.quantitySold} sold</div>
                                <div>{product.orderCount} orders</div>
                              </div>
                            </div>
                          ))
                      ) : (
                        <div className="rounded-lg border border-dashed border-gray-300 px-4 py-6 text-sm text-gray-500">
                          No product sales are logged yet.
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="rounded-xl border bg-white p-5 shadow-sm">
                    <h2 className="text-lg font-semibold text-gray-900">Needs attention</h2>
                    <div className="mt-4 space-y-3">
                      {unsoldProductsPreview.length ? (
                        unsoldProductsPreview.map((product) => (
                          <div key={product.id} className="rounded-lg border border-gray-200 px-4 py-3">
                            <div className="font-medium text-gray-900">{product.title || 'Product'}</div>
                            <div className="mt-1 text-sm text-gray-500">No logged orders yet</div>
                          </div>
                        ))
                      ) : (
                        <div className="rounded-lg border border-dashed border-gray-300 px-4 py-6 text-sm text-gray-500">
                          No unsold products in the current list.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'integrations' && <UniversalIntegrationsPage />}

            {activeTab === 'store-customization' && (
              <div className="space-y-4">
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-5">
                  <h2 className="text-lg font-semibold text-gray-900">Your Custom Store & Branding</h2>
                  <p className="mt-1 text-sm text-gray-700">Preview, edit, upload your logo/banner, and share your storefront.</p>
                  <Link to={storePath} className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-blue-700 hover:text-blue-800">
                    <ExternalLink className="h-4 w-4" />
                    View Live Store
                  </Link>
                </div>
                <StoreCustomization userId={sellerId} role="seller" />
              </div>
            )}

            {activeTab === 'messages' && (
              <div className="space-y-4">
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  Internal platform messaging uses <strong>mail@beezio.co</strong>.
                </div>
                <UniversalInbox embedded />
              </div>
            )}

            {activeTab === 'support' && <IssueCenterPage embedded />}
          </div>
        )}
      </div>
    </div>
  );
};

const StatCard = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-xl border bg-white p-5 shadow-sm">
    <p className="text-sm text-gray-500">{label}</p>
    <p className="mt-2 text-2xl font-bold text-gray-900">{value}</p>
  </div>
);

const QuickMetricCard = ({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'slate' | 'emerald' | 'amber';
}) => {
  const toneClass =
    tone === 'emerald'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-950'
      : tone === 'amber'
        ? 'border-amber-200 bg-amber-50 text-amber-950'
        : 'border-slate-200 bg-slate-50 text-slate-950';

  return (
    <div className={`rounded-lg border p-4 ${toneClass}`}>
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-600">{label}</div>
      <div className="mt-1 text-lg font-bold">{value}</div>
    </div>
  );
};

const SellerActionCard = ({
  icon: Icon,
  title,
  text,
  cta,
  to,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  text: string;
  cta: string;
  to?: string;
  onClick?: () => void;
}) => {
  const content = (
    <>
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100 text-orange-700">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h3 className="font-semibold text-gray-900">{title}</h3>
          <p className="mt-1 text-sm text-gray-600">{text}</p>
        </div>
      </div>
      <div className="mt-4 text-sm font-semibold text-orange-700">{cta}</div>
    </>
  );

  if (to) {
    return (
      <Link to={to} className="rounded-xl border bg-white p-5 shadow-sm transition hover:border-orange-300 hover:shadow-md">
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl border bg-white p-5 text-left shadow-sm transition hover:border-orange-300 hover:shadow-md"
    >
      {content}
    </button>
  );
};

const ProductList = ({
  products,
  removingProductId,
  onRemove,
}: {
  products: Product[];
  removingProductId: string;
  onRemove: (productId: string) => void;
}) => {
  if (!products.length) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center">
        <div className="font-semibold text-gray-900">No products for sale yet.</div>
        <p className="mt-1 text-sm text-gray-500">Click Sell a Product when the item is yours. Marketplace products you promote show in the promotion column.</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3 md:hidden">
        {products.map((product) => (
          <div
            key={product.id}
            onClick={() => window.location.assign(`/product/${product.id}`)}
            className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
          >
            <div className="flex items-start gap-3">
              {getFirstImageUrl(product.images, product.image_url) ? (
                <img
                  src={getFirstImageUrl(product.images, product.image_url)}
                  alt={product.title}
                  className="h-16 w-16 shrink-0 rounded-lg object-cover"
                  onError={(event) => {
                    const target = event.currentTarget;
                    if (target.src !== PRODUCT_IMAGE_FALLBACK) {
                      target.src = PRODUCT_IMAGE_FALLBACK;
                    }
                  }}
                />
              ) : (
                <div className="h-16 w-16 shrink-0 rounded-lg bg-gray-100" />
              )}
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-gray-900">{product.title || 'Untitled product'}</div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                  <Link
                    to={`/dashboard/products/edit/${product.id}`}
                    onClick={(event) => event.stopPropagation()}
                    className="font-semibold text-blue-700 hover:text-blue-800 hover:underline"
                  >
                    Edit Product
                  </Link>
                  <span>Seller gets {money(getSellerAskValue(product))}</span>
                  <span>Affiliate commission {getAffiliateCommissionSummary(product)}</span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-gray-500">Buyer price</div>
                    <div className="font-semibold text-gray-900">{money(getBuyerFacingProductPrice(product as any))}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">Stock</div>
                    <div className="font-semibold text-gray-900">{product.stock_quantity ?? '-'}</div>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <Link
                to={`/dashboard/products/edit/${product.id}`}
                onClick={(event) => event.stopPropagation()}
                className="inline-flex flex-1 items-center justify-center rounded-lg border border-blue-200 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"
              >
                Edit
              </Link>
              <Link
                to="/dashboard?tab=single-product"
                onClick={(event) => event.stopPropagation()}
                className="inline-flex flex-1 items-center justify-center rounded-lg border border-amber-200 px-3 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-50"
              >
                Promote
              </Link>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onRemove(product.id);
                }}
                disabled={removingProductId === product.id}
                className="inline-flex flex-1 items-center justify-center rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {removingProductId === product.id ? 'Removing' : 'Remove'}
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="hidden overflow-x-auto md:block">
        <table className="min-w-full table-fixed text-sm">
        <thead className="bg-gray-50 text-left text-gray-600">
          <tr>
            <th className="w-[42%] px-3 py-2">Product</th>
            <th className="w-[18%] px-3 py-2">Category</th>
            <th className="w-[14%] px-3 py-2 text-right">Price</th>
            <th className="w-[10%] px-3 py-2 text-right">Stock</th>
            <th className="w-[16%] px-3 py-2 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {products.map((product) => (
            <tr
              key={product.id}
              onClick={() => window.location.assign(`/product/${product.id}`)}
              className="h-20 cursor-pointer border-t transition hover:bg-orange-50/60"
            >
              <td className="px-3 py-3">
                <div className="flex items-center gap-3">
                  {getFirstImageUrl(product.images, product.image_url) ? (
                    <img
                      src={getFirstImageUrl(product.images, product.image_url)}
                      alt={product.title}
                      className="h-12 w-12 shrink-0 rounded object-cover"
                      onError={(event) => {
                        const target = event.currentTarget;
                        if (target.src !== PRODUCT_IMAGE_FALLBACK) {
                          target.src = PRODUCT_IMAGE_FALLBACK;
                        }
                      }}
                    />
                  ) : (
                    <div className="h-12 w-12 shrink-0 rounded bg-gray-100" />
                  )}
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-gray-900">{product.title || 'Untitled product'}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                      <Link
                        to={`/dashboard/products/edit/${product.id}`}
                        onClick={(event) => event.stopPropagation()}
                        className="font-semibold text-blue-700 hover:text-blue-800 hover:underline"
                      >
                        Edit Product
                      </Link>
                      <span>Seller gets {money(getSellerAskValue(product))}</span>
                      <span>Affiliate commission {getAffiliateCommissionSummary(product)}</span>
                    </div>
                  </div>
                </div>
              </td>
              <td className="truncate px-3 py-3">{product.category || 'Uncategorized'}</td>
              <td className="px-3 py-3 text-right">{money(getBuyerFacingProductPrice(product as any))}</td>
              <td className="px-3 py-3 text-right">{product.stock_quantity ?? '-'}</td>
              <td className="px-3 py-3 text-right">
                <div className="flex justify-end gap-2">
                  <Link
                    to={`/dashboard/products/edit/${product.id}`}
                    onClick={(event) => event.stopPropagation()}
                    className="rounded-md border border-blue-200 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                  >
                    Edit
                  </Link>
                  <Link
                    to="/dashboard?tab=single-product"
                    onClick={(event) => event.stopPropagation()}
                    className="rounded-md border border-amber-200 px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-50"
                  >
                    Promote
                  </Link>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onRemove(product.id);
                    }}
                    disabled={removingProductId === product.id}
                    className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {removingProductId === product.id ? 'Removing' : 'Remove'}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
        </table>
      </div>
    </>
  );
};

const AffiliatePromotionList = ({
  products,
  copiedProductId,
  unlistingProductId,
  onCopyLink,
  onUnlist,
}: {
  products: Product[];
  copiedProductId: string;
  unlistingProductId: string;
  onCopyLink: (productId: string) => void;
  onUnlist: (productId: string) => void;
}) => {
  if (!products.length) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center">
        <div className="font-semibold text-gray-900">No products promoted yet.</div>
        <p className="mt-1 text-sm text-gray-500">Choose products from the marketplace and click Add to Store.</p>
        <Link
          to="/marketplace"
          className="mt-4 inline-flex items-center justify-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700"
        >
          <ShoppingCart className="h-4 w-4" />
          Promote Products
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3 md:hidden">
        {products.map((product: any) => {
          const commissionAmount = Number(product.commission_rate || 0);
          return (
            <div
              key={product.id}
              onClick={() => window.location.assign(`/product/${product.id}`)}
              className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-start gap-3">
                {product.image_url ? (
                  <img src={product.image_url} alt={product.title} className="h-16 w-16 shrink-0 rounded-lg object-cover" />
                ) : (
                  <div className="h-16 w-16 shrink-0 rounded-lg bg-gray-100" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-gray-900">{product.title || 'Product'}</div>
                  <div className="mt-1 text-sm text-gray-500">{product.seller_name || 'Marketplace Seller'}</div>
                  <div className="mt-1 text-xs text-emerald-700">
                    Affiliate commission {getAffiliateCommissionSummary(product)}
                  </div>
                  <div className="mt-2 text-sm text-gray-500">{product.category || 'General'}</div>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <div className="text-gray-500">Price</div>
                      <div className="font-semibold text-gray-900">{money(Number(product.price || 0))}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">You earn</div>
                      <div className="font-semibold text-green-700">{money(commissionAmount)}</div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onCopyLink(product.id);
                  }}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  {copiedProductId === product.id ? 'Copied' : 'Copy Link'}
                </button>
                <Link
                  to="/dashboard?tab=single-product"
                  onClick={(event) => event.stopPropagation()}
                  className="inline-flex items-center justify-center rounded-lg border border-amber-200 px-3 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-50"
                >
                  Promote
                </Link>
                <Link
                  to={`/product/${product.id}`}
                  onClick={(event) => event.stopPropagation()}
                  className="inline-flex items-center justify-center rounded-lg border border-blue-200 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"
                >
                  View
                </Link>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onUnlist(product.id);
                  }}
                  disabled={unlistingProductId === product.id}
                  className="rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {unlistingProductId === product.id ? 'Unlisting' : 'Unlist'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <div className="hidden overflow-x-auto md:block">
        <table className="min-w-full table-fixed text-sm">
        <thead className="bg-gray-50 text-left text-gray-600">
          <tr>
            <th className="w-[36%] px-3 py-2">Product</th>
            <th className="w-[16%] px-3 py-2">Seller</th>
            <th className="w-[16%] px-3 py-2">Category</th>
            <th className="w-[11%] px-3 py-2 text-right">Price</th>
            <th className="w-[11%] px-3 py-2 text-right">Earn</th>
            <th className="w-[10%] px-3 py-2 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {products.map((product: any) => {
            const commissionAmount = Number(product.commission_rate || 0);
            return (
              <tr
                key={product.id}
                onClick={() => window.location.assign(`/product/${product.id}`)}
                className="h-20 cursor-pointer transition hover:bg-orange-50/60"
              >
                <td className="px-3 py-3">
                  <div className="flex items-center gap-3">
                    {product.image_url ? (
                      <img src={product.image_url} alt={product.title} className="h-12 w-12 shrink-0 rounded object-cover" />
                    ) : (
                      <div className="h-12 w-12 shrink-0 rounded bg-gray-100" />
                    )}
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-gray-900">{product.title || 'Product'}</div>
                      <div className="truncate text-xs text-emerald-700">
                        Affiliate commission {getAffiliateCommissionSummary(product)}
                      </div>
                      <div className="truncate text-xs text-gray-500">{product.description}</div>
                    </div>
                  </div>
                </td>
                <td className="truncate px-3 py-3 text-gray-600">{product.seller_name || 'Marketplace Seller'}</td>
                <td className="truncate px-3 py-3 text-gray-600">{product.category || 'General'}</td>
                <td className="px-3 py-3 text-right">{money(Number(product.price || 0))}</td>
                <td className="px-3 py-3 text-right text-green-700">{money(commissionAmount)}</td>
                <td className="px-3 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onCopyLink(product.id);
                      }}
                      className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                    >
                      {copiedProductId === product.id ? 'Copied' : 'Copy Link'}
                    </button>
                    <Link
                      to="/dashboard?tab=single-product"
                      onClick={(event) => event.stopPropagation()}
                      className="rounded-md border border-amber-200 px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-50"
                    >
                      Promote
                    </Link>
                    <Link
                      to={`/product/${product.id}`}
                      onClick={(event) => event.stopPropagation()}
                      className="rounded-md border border-blue-200 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                    >
                      View
                    </Link>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onUnlist(product.id);
                      }}
                      disabled={unlistingProductId === product.id}
                      className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {unlistingProductId === product.id ? 'Unlisting' : 'Unlist'}
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
        </table>
      </div>
    </>
  );
};

const OrdersPanel = ({ orders }: { orders: OrderRow[] }) => (
  <div className="rounded-xl border bg-white p-5">
    <h2 className="mb-4 text-xl font-semibold text-gray-900">Orders</h2>
    {!orders.length ? (
      <div className="rounded-lg border border-dashed p-8 text-center text-gray-500">No seller orders found yet.</div>
    ) : (
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-600">
            <tr>
              <th className="px-3 py-2">Order</th>
              <th className="px-3 py-2">Customer</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2 text-right">Total</th>
              <th className="px-3 py-2">Date</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id} className="border-t">
                <td className="px-3 py-3">
                  <Link to={`/order/${order.id}`} className="font-mono text-orange-700 hover:text-orange-800 hover:underline">
                    {order.order_number || order.id}
                  </Link>
                </td>
                <td className="px-3 py-3">{order.billing_email || order.customer_email || 'Customer'}</td>
                <td className="px-3 py-3">{order.payment_status || order.status || 'pending'}</td>
                <td className="px-3 py-3 text-right">{money(Number(order.total_charged ?? order.total_amount ?? 0))}</td>
                <td className="px-3 py-3">{order.created_at ? new Date(order.created_at).toLocaleDateString() : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </div>
);

const Placeholder = ({ title, text }: { title: string; text: string }) => (
  <div className="rounded-xl border bg-white p-6">
    <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
    <p className="mt-2 text-sm text-gray-600">{text}</p>
  </div>
);

export default EnhancedSellerDashboard;
