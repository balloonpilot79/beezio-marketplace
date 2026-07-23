import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  TrendingUp,
  DollarSign,
  Users,
  Package,
  BarChart3,
  Download,
  ShieldAlert,
  MessageSquare,
  Settings,
  Store,
  FlaskConical,
  RefreshCw
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import ContentModerationDashboard from './ContentModerationDashboard';
import ChatSupportDashboard from './ChatSupportDashboard';
import IssueCenterPage from '../pages/IssueCenterPage';
import AdminPrintfulImportPage from '../pages/AdminPrintfulImportPage';
import ManualFulfillmentQueue from './ManualFulfillmentQueue';
import AdminOrderLedgerPanel from './AdminOrderLedgerPanel';
import { buildTaxCsv, getCurrentTaxYear, isTaxComplianceTableMissing, type AdminReviewStatus } from '../services/taxCompliance';
import { buildFinanceBuckets, type FinanceBuckets } from '../utils/adminFinance';
import {
  TEST_ITEM_AFFILIATE_AMOUNT,
  TEST_ITEM_BEEZIO_FEE,
  TEST_ITEM_INFLUENCER_FEE,
  TEST_ITEM_PRICE,
  TEST_ITEM_PROCESSING_FEE,
  TEST_ITEM_SELLER_AMOUNT,
  TEST_ITEM_TITLE,
} from '../../shared/testItemPricing';

interface PlatformStats {
  total_revenue: number;
  monthly_revenue: number;
  total_users: number;
  active_sellers: number;
  total_transactions: number;
  pending_payouts: number;
}

interface RevenueData {
  month_year: string;
  revenue: number;
}

interface TopSeller {
  user_id: string;
  full_name: string;
  total_earned: number;
  total_sales: number;
}

interface PendingPayout {
  user_id: string;
  full_name: string;
  email: string;
  payout_email: string;
  role: string;
  amount: number;
  days_pending: number;
  next_payout_date?: string | null;
}

interface TopInfluencerEntry {
  id: string;
  name: string;
  email: string;
  payout_email: string;
  amount: number;
  orderCount: number;
}

interface AdminTaxComplianceRow {
  user_id: string;
  full_name: string;
  email: string;
  legal_name: string;
  delivery_email: string;
  form_status: string;
  form_type: string;
  independent_contractor_ack_at: string | null;
  admin_review_status: AdminReviewStatus;
  last_1099_tax_year: number | null;
  tax_id_last4: string | null;
  paid_this_year_cents: number;
  report_status: string | null;
}

interface AdminTaxComplianceSummary {
  total_payees: number;
  acknowledged: number;
  verified: number;
  needs_attention: number;
  pending_1099: number;
  ytd_paid_cents: number;
}

interface HealthMetrics {
  dailyGmv: number;
  conversionRate: number;
  cac: number | null;
  failedCheckouts: number;
  refundRate: number;
  topInfluencers: TopInfluencerEntry[];
}

interface RiskFlag {
  type: 'referral_burst' | 'fake_signup' | 'order_pattern';
  severity: 'high' | 'medium';
  message: string;
}

interface InsuranceAdminOverview {
  total_leads: number;
  delivered_leads: number;
  flagged_leads: number;
  rejected_leads: number;
  blocked_ip_count: number;
  out_of_funds_campaigns: number;
  flagged_listings: number;
}

interface InsuranceAdminSetting {
  id: string;
  setting_key: string;
  setting_value: any;
  updated_at: string;
}

interface InsuranceBlockedIp {
  id: string;
  ip_hash: string;
  reason?: string | null;
  expires_at?: string | null;
  created_at: string;
}

interface InsuranceAffiliateProfileAdmin {
  id: string;
  affiliate_user_id: string;
  trust_tier: string;
  daily_valid_lead_cap: number;
  fraud_flag_count: number;
  payout_hold_days: number;
  profile?: { full_name?: string; email?: string } | null;
}

interface InsuranceLeadAdmin {
  id: string;
  vertical: string;
  status: string;
  review_status: string;
  fraud_score: number;
  status_reason?: string | null;
  created_at: string;
  delivered_at?: string | null;
  lead_price_cents?: number;
  affiliate_payout_cents?: number;
  influencer_payout_cents?: number;
  beezio_fee_cents?: number;
  payload_json?: { source_type?: string } | null;
  affiliate_profile?: { full_name?: string; email?: string } | null;
  listing?: { agency_name?: string; slug?: string } | null;
}

const emptyFinanceBuckets = (): FinanceBuckets => ({
  hourly: {
    orders: 0,
    realSales: 0,
    grossSales: 0,
    sellerPayouts: 0,
    affiliatePayouts: 0,
    influencerPayouts: 0,
    beezioProfit: 0,
    paypalFees: 0,
    beezioGrossRevenue: 0,
    beezioNetRevenue: 0,
    salesTax: 0,
    shipping: 0,
  },
  daily: {
    orders: 0,
    realSales: 0,
    grossSales: 0,
    sellerPayouts: 0,
    affiliatePayouts: 0,
    influencerPayouts: 0,
    beezioProfit: 0,
    paypalFees: 0,
    beezioGrossRevenue: 0,
    beezioNetRevenue: 0,
    salesTax: 0,
    shipping: 0,
  },
  weekly: {
    orders: 0,
    realSales: 0,
    grossSales: 0,
    sellerPayouts: 0,
    affiliatePayouts: 0,
    influencerPayouts: 0,
    beezioProfit: 0,
    paypalFees: 0,
    beezioGrossRevenue: 0,
    beezioNetRevenue: 0,
    salesTax: 0,
    shipping: 0,
  },
  monthly: {
    orders: 0,
    realSales: 0,
    grossSales: 0,
    sellerPayouts: 0,
    affiliatePayouts: 0,
    influencerPayouts: 0,
    beezioProfit: 0,
    paypalFees: 0,
    beezioGrossRevenue: 0,
    beezioNetRevenue: 0,
    salesTax: 0,
    shipping: 0,
  },
  yearly: {
    orders: 0,
    realSales: 0,
    grossSales: 0,
    sellerPayouts: 0,
    affiliatePayouts: 0,
    influencerPayouts: 0,
    beezioProfit: 0,
    paypalFees: 0,
    beezioGrossRevenue: 0,
    beezioNetRevenue: 0,
    salesTax: 0,
    shipping: 0,
  },
});

interface InsuranceCampaignAdmin {
  id: string;
  vertical: string;
  status: string;
  cost_per_lead_cents: number;
  affiliate_payout_cents: number;
  updated_at: string;
  listing?: { agency_name?: string; slug?: string } | null;
}

interface InsuranceListingAdmin {
  id: string;
  agency_name: string;
  slug: string;
  bio?: string | null;
  hero_title?: string | null;
  hero_subtitle?: string | null;
  disclaimer?: string | null;
  contact_name?: string | null;
  contact_email?: string | null;
  is_active: boolean;
  accepts_new_leads: boolean;
  updated_at: string;
  compliance_flags?: Array<{ code: string; label: string }>;
}

interface PrintfulDiagnostics {
  profileId: string;
  integrationId: string | null;
  status: string | null;
  isActive: boolean | null;
  storeId: string | null;
  connectedAt: string | null;
  lastSync: string | null;
  productsCount: number | null;
  variantsCount: number | null;
  vendorOrdersCount: number | null;
  notes: string[];
}

type PayPalAdminConfig = {
  ok: boolean;
  env: 'sandbox' | 'live';
  configured?: {
    clientId?: boolean;
    clientSecret?: boolean;
  };
};

type AdminTab = 'overview' | 'orders' | 'payouts' | 'analytics' | 'printful' | 'fulfillment' | 'moderation' | 'support' | 'tools';
type TimeFilter = 'day' | 'week' | 'month' | '3mo' | '6mo' | 'year';

type DateRange = {
  start: Date;
  end: Date;
};

const getDateRange = (filter: TimeFilter): DateRange => {
  const now = new Date();
  let start: Date;

  switch (filter) {
    case 'day':
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case 'week':
      start = new Date(now);
      start.setDate(now.getDate() - 6);
      break;
    case 'month':
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case '3mo':
      start = new Date(now);
      start.setMonth(now.getMonth() - 2);
      start.setDate(1);
      break;
    case '6mo':
      start = new Date(now);
      start.setMonth(now.getMonth() - 5);
      start.setDate(1);
      break;
    case 'year':
      start = new Date(now.getFullYear(), 0, 1);
      break;
    default:
      start = new Date(2000, 0, 1);
  }

  return { start, end: now };
};

const withTimeout = async <T,>(promise: Promise<T>, ms: number, label: string): Promise<T> => {
  let timeoutId: number | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms}ms`));
    }, ms);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId) {
      window.clearTimeout(timeoutId);
    }
  }
};

export default function PlatformAdminDashboard() {
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('month');
  const [adminSales, setAdminSales] = useState(0);
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [revenueData, setRevenueData] = useState<RevenueData[]>([]);
  const [topSellers, setTopSellers] = useState<TopSeller[]>([]);
  const [pendingPayouts, setPendingPayouts] = useState<PendingPayout[]>([]);
  const [taxComplianceLoading, setTaxComplianceLoading] = useState(false);
  const [taxComplianceError, setTaxComplianceError] = useState<string | null>(null);
  const [taxComplianceMigrationNeeded, setTaxComplianceMigrationNeeded] = useState(false);
  const [adminTaxRows, setAdminTaxRows] = useState<AdminTaxComplianceRow[]>([]);
  const [adminTaxSummary, setAdminTaxSummary] = useState<AdminTaxComplianceSummary>({
    total_payees: 0,
    acknowledged: 0,
    verified: 0,
    needs_attention: 0,
    pending_1099: 0,
    ytd_paid_cents: 0,
  });
  const [taxReviewSavingUserId, setTaxReviewSavingUserId] = useState<string | null>(null);
  const [payoutExportLoading, setPayoutExportLoading] = useState<'paypal' | 'audit' | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [apiKey, setApiKey] = useState('');
  const [apiKeyStatus, setApiKeyStatus] = useState<string | null>(null);
  const [quickEditUserId, setQuickEditUserId] = useState('');
  const [quickEditField, setQuickEditField] = useState('');
  const [quickEditValue, setQuickEditValue] = useState('');
  const [quickEditStatus, setQuickEditStatus] = useState<string | null>(null);
  const [printfulDiagnostics, setPrintfulDiagnostics] = useState<PrintfulDiagnostics | null>(null);
  const [printfulDiagLoading, setPrintfulDiagLoading] = useState(false);
  const [printfulDiagError, setPrintfulDiagError] = useState<string | null>(null);
  const [paypalAdminConfig, setPaypalAdminConfig] = useState<PayPalAdminConfig | null>(null);
  const [paypalAdminLoading, setPaypalAdminLoading] = useState(false);
  const [paypalAdminError, setPaypalAdminError] = useState<string | null>(null);
  const [paypalEnvSaving, setPaypalEnvSaving] = useState(false);
  const [savingTestProduct, setSavingTestProduct] = useState(false);
  const [testProductStatus, setTestProductStatus] = useState<string | null>(null);
  const [testProductError, setTestProductError] = useState<string | null>(null);
  const [healthMetrics, setHealthMetrics] = useState<HealthMetrics>({
    dailyGmv: 0,
    conversionRate: 0,
    cac: null,
    failedCheckouts: 0,
    refundRate: 0,
    topInfluencers: [],
  });
  const [financeBuckets, setFinanceBuckets] = useState<FinanceBuckets>(emptyFinanceBuckets());
  const [riskFlags, setRiskFlags] = useState<RiskFlag[]>([]);
  const [insuranceAdminLoading, setInsuranceAdminLoading] = useState(false);
  const [insuranceAdminError, setInsuranceAdminError] = useState<string | null>(null);
  const [insuranceAdminOverview, setInsuranceAdminOverview] = useState<InsuranceAdminOverview>({
    total_leads: 0,
    delivered_leads: 0,
    flagged_leads: 0,
    rejected_leads: 0,
    blocked_ip_count: 0,
    out_of_funds_campaigns: 0,
    flagged_listings: 0,
  });
  const [insuranceSettings, setInsuranceSettings] = useState<InsuranceAdminSetting[]>([]);
  const [insuranceBlockedIps, setInsuranceBlockedIps] = useState<InsuranceBlockedIp[]>([]);
  const [insuranceAffiliateProfiles, setInsuranceAffiliateProfiles] = useState<InsuranceAffiliateProfileAdmin[]>([]);
  const [insuranceRecentLeads, setInsuranceRecentLeads] = useState<InsuranceLeadAdmin[]>([]);
  const [insuranceCampaigns, setInsuranceCampaigns] = useState<InsuranceCampaignAdmin[]>([]);
  const [insuranceListings, setInsuranceListings] = useState<InsuranceListingAdmin[]>([]);
  const [insuranceSettingDrafts, setInsuranceSettingDrafts] = useState<Record<string, string>>({});
  const [insuranceIpInput, setInsuranceIpInput] = useState('');
  const [insuranceIpReason, setInsuranceIpReason] = useState('');
  const [insuranceActionStatus, setInsuranceActionStatus] = useState<string | null>(null);

  useEffect(() => {
    fetchPlatformData();
    fetchAdminSales();
  }, [timeFilter]);

  useEffect(() => {
    if (activeTab === 'payouts') {
      void fetchTaxComplianceData();
    }
  }, [activeTab]);

  const fetchAdminSales = async () => {
    const { start, end } = getDateRange(timeFilter);

    const { data: admins } = await supabase
      .from('profiles')
      .select('id, user_id, email')
      .eq('role', 'admin');

    if (!admins?.length) {
      setAdminSales(0);
      return;
    }

    const adminIds = admins.map(a => a.id);
    let sales: any[] | null = null;
    let { data, error } = await supabase
      .from('transactions')
      .select('amount, seller_id, status, created_at')
      .eq('status', 'completed')
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString())
      .in('seller_id', adminIds);

    sales = (data as any[]) || null;

    if (error) {
      const fallback = await supabase
        .from('transactions')
        .select('total_amount, seller_id, status, created_at')
        .eq('status', 'completed')
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString())
        .in('seller_id', adminIds);
      sales = (fallback.data as any[]) || null;
    }

    if (typeof sales !== 'undefined') {
      const total = sales?.reduce((sum, s) => sum + (Number((s as any).amount || (s as any).total_amount || 0) || 0), 0) || 0;
      setAdminSales(total);
    }
  };

  const resolveAdminProfileId = async (): Promise<string | null> => {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData?.user?.id) return null;
    const userId = authData.user.id;

    const { data: profileById } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle();
    if (profileById?.id) return profileById.id;

    const userEmail = authData.user.email;
    if (userEmail) {
      const { data: profileByEmail } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', userEmail)
        .maybeSingle();
      if (profileByEmail?.id) return profileByEmail.id;
    }

    return null;
  };

  const runPrintfulDiagnostics = async () => {
    try {
      setPrintfulDiagLoading(true);
      setPrintfulDiagError(null);
      setPrintfulDiagnostics(null);

      const profileId = await resolveAdminProfileId();
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) {
        throw authError;
      }
      const authUserId = String(authData?.user?.id || '').trim();
      if (!profileId) {
        setPrintfulDiagError('Unable to resolve admin profile ID. Please sign in again.');
        setPrintfulDiagLoading(false);
        return;
      }
      if (!authUserId) {
        setPrintfulDiagError('Unable to resolve admin auth user ID. Please sign in again.');
        setPrintfulDiagLoading(false);
        return;
      }

      const { data: integration, error: integrationError } = await withTimeout(
        supabase
          .from('user_integrations')
          .select('id,status,is_active,settings,connected_at,last_sync')
          .eq('user_id', authUserId)
          .eq('platform', 'printful')
          .maybeSingle(),
        12000,
        'printful integration lookup'
      );

      if (integrationError) throw integrationError;

      const notes: string[] = [];
      if (!integration?.id) {
        notes.push('No Printful integration row found for this user.');
      } else if (!integration?.settings?.store_id) {
        notes.push('Printful store_id missing. Disconnect and reconnect to refresh.');
      }

      const { count: productsCount, error: productsError } = await withTimeout(
        supabase
          .from('products')
          .select('id', { count: 'exact', head: true })
          .eq('seller_id', profileId)
          .eq('source_platform', 'printful'),
        12000,
        'printful products count'
      );
      if (productsError) notes.push(`Products count failed: ${productsError.message}`);

      const { count: variantsCount, error: variantsError } = await withTimeout(
        supabase
          .from('product_variants')
          .select('id', { count: 'exact', head: true })
          .eq('source_platform', 'printful'),
        12000,
        'printful variants count'
      );
      if (variantsError) notes.push(`Variants count failed: ${variantsError.message}`);

      let vendorOrdersCount: number | null = null;
      try {
        const { count: vendorCount } = await withTimeout(
          supabase
            .from('vendor_orders')
            .select('id', { count: 'exact', head: true })
            .eq('vendor_id', 'printful'),
          12000,
          'printful vendor orders count'
        );
        vendorOrdersCount = typeof vendorCount === 'number' ? vendorCount : null;
      } catch (err: any) {
        notes.push(`Vendor orders count failed: ${err?.message || 'unknown error'}`);
      }

      setPrintfulDiagnostics({
        profileId,
        integrationId: integration?.id || null,
        status: integration?.status || null,
        isActive: typeof integration?.is_active === 'boolean' ? integration.is_active : null,
        storeId: integration?.settings?.store_id ? String(integration.settings.store_id) : null,
        connectedAt: integration?.connected_at || null,
        lastSync: integration?.last_sync || null,
        productsCount: typeof productsCount === 'number' ? productsCount : null,
        variantsCount: typeof variantsCount === 'number' ? variantsCount : null,
        vendorOrdersCount,
        notes
      });
    } catch (err: any) {
      setPrintfulDiagError(err?.message || 'Printful diagnostics failed.');
    } finally {
      setPrintfulDiagLoading(false);
    }
  };

  const handleCreateOrRefreshTestProduct = async () => {
    try {
      setSavingTestProduct(true);
      setTestProductError(null);
      setTestProductStatus(null);

      const sellerProfileId = await resolveAdminProfileId();
      if (!sellerProfileId) {
        throw new Error('Unable to resolve the admin profile for the test product.');
      }

      const title = `${TEST_ITEM_TITLE} - paypal live split check`;
      const payload = {
        title,
        description: 'Admin-only PayPal live card-processing test product for validating Beezio payouts and split tracking.',
        price: TEST_ITEM_PRICE,
        calculated_customer_price: TEST_ITEM_PRICE,
        seller_amount: TEST_ITEM_SELLER_AMOUNT,
        seller_ask: TEST_ITEM_SELLER_AMOUNT,
        seller_ask_price: TEST_ITEM_SELLER_AMOUNT,
        commission_rate: 0,
        commission_type: 'flat_rate',
        flat_commission_amount: TEST_ITEM_AFFILIATE_AMOUNT,
        affiliate_commission_type: 'flat',
        affiliate_commission_value: TEST_ITEM_AFFILIATE_AMOUNT,
        platform_fee: TEST_ITEM_BEEZIO_FEE,
        processing_fee: TEST_ITEM_PROCESSING_FEE,
        affiliate_enabled: true,
        category: 'Admin Test',
        stock_quantity: 999,
        images: [],
        tags: [
          'Beezio Admin Test',
          'PayPal Live Test',
          `Seller ${TEST_ITEM_SELLER_AMOUNT.toFixed(2)}`,
          `Affiliate ${TEST_ITEM_AFFILIATE_AMOUNT.toFixed(2)}`,
          `Influencers ${(TEST_ITEM_INFLUENCER_FEE * 2).toFixed(2)}`,
          `Beezio ${TEST_ITEM_BEEZIO_FEE.toFixed(2)}`,
        ],
        shipping_options: [],
        shipping_price: 0,
        shipping_cost: 0,
        requires_shipping: false,
        is_digital: false,
        is_subscription: false,
        status: 'active',
        is_promotable: true,
        is_active: true,
        seller_id: sellerProfileId,
      };

      const { data: existing, error: existingError } = await supabase
        .from('products')
        .select('id')
        .eq('seller_id', sellerProfileId)
        .ilike('title', `${TEST_ITEM_TITLE}%`)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingError) throw existingError;

      const result = existing?.id
        ? await supabase.from('products').update(payload).eq('id', existing.id).select('id').single()
        : await supabase.from('products').insert([payload]).select('id').single();

      if (result.error) throw result.error;

      setTestProductStatus(
        existing?.id
          ? `Refreshed test item at $${TEST_ITEM_PRICE.toFixed(2)} with affiliate $${TEST_ITEM_AFFILIATE_AMOUNT.toFixed(2)}, influencer $${TEST_ITEM_INFLUENCER_FEE.toFixed(2)}, and Beezio $${TEST_ITEM_BEEZIO_FEE.toFixed(2)}.`
          : `Created test item at $${TEST_ITEM_PRICE.toFixed(2)} with affiliate $${TEST_ITEM_AFFILIATE_AMOUNT.toFixed(2)}, influencer $${TEST_ITEM_INFLUENCER_FEE.toFixed(2)}, and Beezio $${TEST_ITEM_BEEZIO_FEE.toFixed(2)}.`
      );
    } catch (err: any) {
      setTestProductError(err?.message || 'Failed to create the PayPal test product.');
    } finally {
      setSavingTestProduct(false);
    }
  };

  const loadPayPalAdminConfig = async () => {
    try {
      setPaypalAdminLoading(true);
      setPaypalAdminError(null);
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error('Not authenticated');
      const res = await fetch('/api/paypal-admin-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String(payload?.error || 'Failed to load PayPal config'));
      setPaypalAdminConfig(payload as PayPalAdminConfig);
    } catch (err: any) {
      setPaypalAdminError(err?.message || 'Failed to load PayPal config');
    } finally {
      setPaypalAdminLoading(false);
    }
  };

  const setPayPalEnv = async (env: 'sandbox' | 'live') => {
    try {
      setPaypalEnvSaving(true);
      setPaypalAdminError(null);
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error('Not authenticated');
      const res = await fetch('/api/paypal-admin-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ paypal_env: env }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String(payload?.error || 'Failed to update PayPal mode'));
      setPaypalAdminConfig(payload as PayPalAdminConfig);
    } catch (err: any) {
      setPaypalAdminError(err?.message || 'Failed to update PayPal mode');
    } finally {
      setPaypalEnvSaving(false);
    }
  };

  useEffect(() => {
    if (activeTab !== 'tools') return;
    void loadPayPalAdminConfig();
    void loadInsuranceAdminData();
  }, [activeTab]);

  const loadInsuranceAdminData = async () => {
    try {
      setInsuranceAdminLoading(true);
      setInsuranceAdminError(null);
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error('Not authenticated');
      const res = await fetch('/api/insurance/admin', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String(payload?.error || 'Failed to load insurance admin data'));
      setInsuranceAdminOverview(payload?.overview || {
        total_leads: 0,
        delivered_leads: 0,
        flagged_leads: 0,
        rejected_leads: 0,
        blocked_ip_count: 0,
        out_of_funds_campaigns: 0,
        flagged_listings: 0,
      });
      setInsuranceSettings(Array.isArray(payload?.settings) ? payload.settings : []);
      setInsuranceBlockedIps(Array.isArray(payload?.blocked_ips) ? payload.blocked_ips : []);
      setInsuranceAffiliateProfiles(Array.isArray(payload?.affiliate_profiles) ? payload.affiliate_profiles : []);
      setInsuranceRecentLeads(Array.isArray(payload?.recent_leads) ? payload.recent_leads : []);
      setInsuranceCampaigns(Array.isArray(payload?.campaigns) ? payload.campaigns : []);
      setInsuranceListings(Array.isArray(payload?.listings) ? payload.listings : []);
      const nextDrafts: Record<string, string> = {};
      (Array.isArray(payload?.settings) ? payload.settings : []).forEach((row: any) => {
        nextDrafts[String(row?.setting_key || '')] = typeof row?.setting_value === 'string'
          ? row.setting_value
          : JSON.stringify(row?.setting_value ?? '');
      });
      setInsuranceSettingDrafts(nextDrafts);
    } catch (err: any) {
      setInsuranceAdminError(err?.message || 'Failed to load insurance admin data');
    } finally {
      setInsuranceAdminLoading(false);
    }
  };

  const postInsuranceAdminAction = async (body: Record<string, any>) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) throw new Error('Not authenticated');
    const res = await fetch('/api/insurance/admin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(String(payload?.error || 'Insurance admin action failed'));
    return payload;
  };

  const saveInsuranceSetting = async (settingKey: string) => {
    try {
      setInsuranceActionStatus(null);
      const raw = insuranceSettingDrafts[settingKey];
      const numeric = Number(raw);
      const settingValue = Number.isFinite(numeric) ? numeric : raw;
      await postInsuranceAdminAction({
        action: 'update_setting',
        setting_key: settingKey,
        setting_value: settingValue,
      });
      setInsuranceActionStatus(`Saved ${settingKey}.`);
      await loadInsuranceAdminData();
    } catch (err: any) {
      setInsuranceActionStatus(err?.message || `Failed to save ${settingKey}.`);
    }
  };

  const blockInsuranceIp = async () => {
    try {
      setInsuranceActionStatus(null);
      await postInsuranceAdminAction({
        action: 'block_ip',
        ip_or_hash: insuranceIpInput,
        reason: insuranceIpReason,
      });
      setInsuranceActionStatus('Blocked IP/hash.');
      setInsuranceIpInput('');
      setInsuranceIpReason('');
      await loadInsuranceAdminData();
    } catch (err: any) {
      setInsuranceActionStatus(err?.message || 'Failed to block IP/hash.');
    }
  };

  const unblockInsuranceIp = async (blockId: string) => {
    try {
      setInsuranceActionStatus(null);
      await postInsuranceAdminAction({
        action: 'unblock_ip',
        block_id: blockId,
      });
      setInsuranceActionStatus('Removed blocked IP.');
      await loadInsuranceAdminData();
    } catch (err: any) {
      setInsuranceActionStatus(err?.message || 'Failed to unblock IP.');
    }
  };

  const saveInsuranceAffiliateProfile = async (profile: InsuranceAffiliateProfileAdmin) => {
    try {
      setInsuranceActionStatus(null);
      await postInsuranceAdminAction({
        action: 'update_affiliate_profile',
        affiliate_user_id: profile.affiliate_user_id,
        trust_tier: profile.trust_tier,
        daily_valid_lead_cap: profile.daily_valid_lead_cap,
        payout_hold_days: profile.payout_hold_days,
        fraud_flag_count: profile.fraud_flag_count,
      });
      setInsuranceActionStatus('Updated insurance affiliate profile.');
      await loadInsuranceAdminData();
    } catch (err: any) {
      setInsuranceActionStatus(err?.message || 'Failed to update insurance affiliate profile.');
    }
  };

  const fetchPlatformData = async () => {
    const { start, end } = getDateRange(timeFilter);
    try {
      setLoading(true);
      setError(null);

      const [
        revenueResult,
        usersResult,
        transactionsResult
      ] = await withTimeout(
        Promise.all([
          supabase
            .from('platform_revenue')
            .select('amount')
            .gte('created_at', start.toISOString())
            .lte('created_at', end.toISOString()),
          supabase.from('profiles').select('id, role').eq('role', 'seller'),
          supabase
            .from('transactions')
            .select('id')
            .eq('status', 'completed')
            .gte('created_at', start.toISOString())
            .lte('created_at', end.toISOString())
        ]),
        15000,
        'platform summary'
      );

      let accessToken = '';
      let adminSalesRows: any[] = [];
      let payoutStatsPayload: any = null;
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        accessToken = String(sessionData?.session?.access_token || '').trim();
        if (accessToken) {
          const [salesLedgerRes, payoutStatsRes] = await Promise.all([
            fetch('/api/admin-sales-ledger', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
              },
              body: JSON.stringify({ limit: 5000 }),
            }),
            fetch('/api/payouts/admin-stats', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
              },
              body: JSON.stringify({}),
            }),
          ]);

          const salesLedgerPayload = await salesLedgerRes.json().catch(() => ({}));
          payoutStatsPayload = await payoutStatsRes.json().catch(() => ({}));
          adminSalesRows = Array.isArray(salesLedgerPayload?.rows) ? salesLedgerPayload.rows : [];
        }
      } catch {
        accessToken = '';
        adminSalesRows = [];
        payoutStatsPayload = null;
      }

      const filteredAdminSalesRows = adminSalesRows.filter((row: any) => {
        const createdAt = new Date(String(row?.created_at || ''));
        if (Number.isNaN(createdAt.getTime())) return false;
        return createdAt >= start && createdAt <= end;
      });

      const totalRevenue =
        revenueResult.data?.reduce((sum, item) => sum + item.amount, 0) ||
        filteredAdminSalesRows.reduce((sum: number, row: any) => sum + Number(row?.gross_amount || 0), 0) ||
        0;
      const totalUsers = usersResult.data?.length || 0;
      const totalTransactions = transactionsResult.data?.length || filteredAdminSalesRows.length || 0;
      let pendingPayoutsAmount = 0;
      let payoutQueuePayees: PendingPayout[] | null = null;
      try {
        if (Array.isArray(payoutStatsPayload?.payees)) {
          pendingPayoutsAmount = payoutStatsPayload.payees.reduce((sum: number, p: any) => sum + (Number(p?.total) || 0), 0);
          payoutQueuePayees = payoutStatsPayload.payees.map((p: any) => ({
              user_id: String(p?.user_id || p?.paypal_email || p?.email || ''),
              full_name: String(p?.name || p?.paypal_email || p?.email || 'Payee'),
              email: String(p?.contact_email || ''),
              payout_email: String(p?.paypal_email || p?.email || ''),
              role: String(p?.role || 'payee').toLowerCase(),
              amount: Number(p?.total) || 0,
              days_pending: p?.nextPayoutDate
                ? Math.max(0, Math.floor((Date.now() - new Date(p.nextPayoutDate).getTime()) / (1000 * 60 * 60 * 24)))
                : 0,
              next_payout_date: String(p?.nextPayoutDate || '').trim() || null,
            }));
        }
      } catch {
        // Fallback handled below.
      }
      if (pendingPayoutsAmount === 0 && !payoutQueuePayees) {
        const fallbackPayeeMap = new Map<string, PendingPayout>();
        const isPayableStatus = (value: unknown) => {
          const status = String(value || '').trim().toUpperCase();
          return status === 'PENDING_HOLD' || status === 'READY_TO_PAY' || status === 'ON_HOLD_DISPUTE';
        };
        const upsertFallbackPayee = (params: {
          userId?: string | null;
          fullName?: string | null;
          email?: string | null;
          payoutEmail?: string | null;
          role: string;
          amount: number;
          holdReleaseAt?: string | null;
        }) => {
          const userId = String(params.userId || '').trim();
          const amount = Number(params.amount || 0);
          if (!userId || amount <= 0) return;

          const key = `${userId}::${params.role}`;
          const holdReleaseAt = String(params.holdReleaseAt || '').trim();
          const nextPayoutDate = holdReleaseAt || null;
          const daysPending = nextPayoutDate
            ? Math.max(0, Math.floor((Date.now() - new Date(nextPayoutDate).getTime()) / (1000 * 60 * 60 * 24)))
            : 0;
          const existing = fallbackPayeeMap.get(key);

          if (existing) {
            existing.amount += amount;
            if (!existing.email && params.email) existing.email = String(params.email);
            if (!existing.payout_email && params.payoutEmail) existing.payout_email = String(params.payoutEmail);
            if (!existing.full_name || existing.full_name === 'Payee') {
              existing.full_name = String(params.fullName || params.email || params.payoutEmail || 'Payee');
            }
            if (!existing.next_payout_date && nextPayoutDate) {
              existing.next_payout_date = nextPayoutDate;
              existing.days_pending = daysPending;
            }
            return;
          }

          fallbackPayeeMap.set(key, {
            user_id: userId,
            full_name: String(params.fullName || params.email || params.payoutEmail || 'Payee'),
            email: String(params.email || ''),
            payout_email: String(params.payoutEmail || ''),
            role: String(params.role || 'payee').toLowerCase(),
            amount,
            days_pending: daysPending,
            next_payout_date: nextPayoutDate,
          });
        };

        filteredAdminSalesRows.forEach((row: any) => {
          if (!isPayableStatus(row?.payout_status)) return;
          const holdReleaseAt = String(row?.hold_release_at || '').trim() || null;
          upsertFallbackPayee({
            userId: row?.seller?.id,
            fullName: row?.seller?.name,
            email: row?.seller?.email,
            payoutEmail: row?.seller?.paypal_email,
            role: 'seller',
            amount: Number(row?.seller?.amount || 0),
            holdReleaseAt,
          });
          upsertFallbackPayee({
            userId: row?.affiliate?.id,
            fullName: row?.affiliate?.name,
            email: row?.affiliate?.email,
            payoutEmail: row?.affiliate?.paypal_email,
            role: 'affiliate',
            amount: Number(row?.affiliate?.amount || 0),
            holdReleaseAt,
          });
          (Array.isArray(row?.influencers) ? row.influencers : []).forEach((influencer: any) => {
            upsertFallbackPayee({
              userId: influencer?.id,
              fullName: influencer?.name,
              email: influencer?.email,
              payoutEmail: influencer?.paypal_email,
              role: 'influencer',
              amount: Number(influencer?.amount || 0),
              holdReleaseAt,
            });
          });
        });

        payoutQueuePayees = Array.from(fallbackPayeeMap.values())
          .sort((left, right) => right.amount - left.amount);
        pendingPayoutsAmount = payoutQueuePayees.reduce((sum, item) => sum + Number(item.amount || 0), 0);
      }

      setStats({
        total_revenue: totalRevenue,
        monthly_revenue: totalRevenue,
        total_users: totalUsers,
        active_sellers: totalUsers,
        total_transactions: totalTransactions,
        pending_payouts: pendingPayoutsAmount
      });

      const { data: revenueDataResult } = await withTimeout(
        supabase
          .from('platform_revenue')
          .select('month_year, amount, created_at')
          .gte('created_at', start.toISOString())
          .lte('created_at', end.toISOString())
          .order('month_year', { ascending: true }),
        15000,
        'platform revenue trend'
      );

      const revenueMap = new Map<string, number>();
      revenueDataResult?.forEach(item => {
        const key = item.month_year || item.created_at?.slice(0, 7) || '';
        const current = revenueMap.get(key) || 0;
        revenueMap.set(key, current + item.amount);
      });

      const revenueChart = Array.from(revenueMap.entries()).map(([month, revenue]) => ({
        month_year: month,
        revenue
      }));

      setRevenueData(revenueChart);

      const topSellerMap = new Map<string, TopSeller>();
      filteredAdminSalesRows.forEach((row: any) => {
        const sellerId = String(row?.seller?.id || '').trim();
        if (!sellerId) return;

        const earned = Number(row?.seller?.amount || 0);
        const sellerName = String(row?.seller?.name || '').trim() || 'Unknown';
        const existing = topSellerMap.get(sellerId) || {
          user_id: sellerId,
          full_name: sellerName,
          total_earned: 0,
          total_sales: 0,
        };

        existing.total_earned += earned;
        existing.total_sales += 1;
        if (existing.full_name === 'Unknown' && sellerName !== 'Unknown') {
          existing.full_name = sellerName;
        }
        topSellerMap.set(sellerId, existing);
      });

      const formattedTopSellers = Array.from(topSellerMap.values())
        .sort((left, right) => right.total_earned - left.total_earned)
        .slice(0, 10)
        .map((seller) => ({
          ...seller,
          total_earned: Number(seller.total_earned.toFixed(2)),
        }));

      setTopSellers(formattedTopSellers);

      setPendingPayouts(payoutQueuePayees || []);

      setFinanceBuckets(buildFinanceBuckets(filteredAdminSalesRows));

      // Health metrics dashboard
      const now = new Date();
      const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const [{ data: dailyOrders }, { data: dailyPayouts }, { data: recentProfiles }, { data: recentInfluencerReferrals }] = await Promise.all([
        supabase
          .from('orders')
          .select('id,status,payment_status,total_charged,created_at,buyer_id,partner_id')
          .gte('created_at', dayStart),
        supabase
          .from('payout_ledger')
          .select('influencer_id,influencer_earnings,created_at')
          .gte('created_at', dayStart),
        supabase
          .from('profiles')
          .select('id,email,full_name,created_at')
          .gte('created_at', dayStart),
        supabase
          .from('influencer_referrals')
          .select('recruited_profile_id,influencer_profile_id,created_at')
          .gte('created_at', dayStart),
      ]);

      const ordersToday = ((dailyOrders || []) as any[]).length
        ? ((dailyOrders || []) as any[])
        : adminSalesRows
            .filter((row: any) => String(row?.created_at || '').slice(0, 10) >= dayStart.slice(0, 10))
            .map((row: any) => ({
              id: row?.order_id,
              status: row?.order_status,
              payment_status: row?.payment_status,
              total_charged: row?.gross_amount,
              created_at: row?.created_at,
              buyer_id: null,
              partner_id: row?.affiliate?.id || null,
            }));
      const completedToday = ordersToday.filter((o) =>
        String(o?.status || '').toLowerCase() === 'completed' || String(o?.payment_status || '').toLowerCase() === 'paid'
      );
      const refundedToday = ordersToday.filter((o) => String(o?.payment_status || '').toLowerCase().includes('refund'));
      const failedCheckouts = ordersToday.filter((o) => {
        const status = String(o?.status || '').toLowerCase();
        const payStatus = String(o?.payment_status || '').toLowerCase();
        return status === 'cancelled' || status === 'failed' || payStatus === 'failed' || payStatus.includes('declin');
      }).length;
      const dailyGmv = completedToday.reduce((sum, row) => sum + Number(row?.total_charged || 0), 0);
      const conversionRate = ordersToday.length ? (completedToday.length / ordersToday.length) * 100 : 0;
      const refundRate = completedToday.length ? (refundedToday.length / completedToday.length) * 100 : 0;

      let cac: number | null = null;
      try {
        const { data: spendRows } = await supabase
          .from('marketing_spend')
          .select('amount,created_at')
          .gte('created_at', dayStart);
        const spend = (spendRows || []).reduce((sum: number, row: any) => sum + Number(row?.amount || 0), 0);
        const newUsers = (recentProfiles || []).length;
        cac = newUsers > 0 ? spend / newUsers : null;
      } catch {
        cac = null;
      }

      const influencerMap = new Map<string, TopInfluencerEntry>();
      filteredAdminSalesRows.forEach((row: any) => {
        const influencerEntries = Array.isArray(row?.influencers) && row.influencers.length
          ? row.influencers
          : row?.influencer && Number(row?.influencer?.amount || 0) > 0
            ? [row.influencer]
            : [];

        influencerEntries.forEach((entry: any) => {
          const influencerId = String(entry?.id || '').trim();
          if (!influencerId) return;
          const amount = Number(entry?.amount || 0);
          const current = influencerMap.get(influencerId) || {
            id: influencerId,
            name: String(entry?.name || entry?.paypal_email || entry?.email || influencerId).trim(),
            email: String(entry?.email || '').trim(),
            payout_email: String(entry?.paypal_email || '').trim(),
            amount: 0,
            orderCount: 0,
          };
          current.amount += amount;
          current.orderCount += 1;
          if (!current.email) current.email = String(entry?.email || '').trim();
          if (!current.payout_email) current.payout_email = String(entry?.paypal_email || '').trim();
          if (!current.name) current.name = String(entry?.paypal_email || entry?.email || influencerId).trim();
          influencerMap.set(influencerId, current);
        });
      });
      const topInfluencers = Array.from(influencerMap.values())
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5)
        .map((entry) => ({ ...entry, amount: Number(entry.amount.toFixed(2)) }));

      setHealthMetrics({
        dailyGmv,
        conversionRate,
        cac,
        failedCheckouts,
        refundRate,
        topInfluencers,
      });

      // Risk/fraud checks
      const referralBurstMap = new Map<string, number>();
      ((recentInfluencerReferrals || []) as any[]).forEach((profileRow) => {
        const influencerId = String(profileRow?.influencer_profile_id || '').trim();
        if (!influencerId) return;
        referralBurstMap.set(influencerId, (referralBurstMap.get(influencerId) || 0) + 1);
      });

      const flags: RiskFlag[] = [];
      referralBurstMap.forEach((count, influencerId) => {
        if (count >= 10) {
          flags.push({
            type: 'referral_burst',
            severity: 'high',
            message: `Influencer ${influencerId} recruited ${count} new profiles today.`,
          });
        } else if (count >= 5) {
          flags.push({
            type: 'referral_burst',
            severity: 'medium',
            message: `Influencer ${influencerId} recruited ${count} new profiles today.`,
          });
        }
      });

      const fakeSignupCount = ((recentProfiles || []) as any[]).filter((p) => {
        const email = String(p?.email || '').trim();
        const fullName = String(p?.full_name || '').trim();
        return !email || !fullName;
      }).length;
      if (fakeSignupCount > 0) {
        flags.push({
          type: 'fake_signup',
          severity: fakeSignupCount >= 5 ? 'high' : 'medium',
          message: `${fakeSignupCount} new profiles today are missing name/email fields.`,
        });
      }

      const buyerOrderMap = new Map<string, number>();
      ordersToday.forEach((order) => {
        const buyerId = String(order?.buyer_id || '').trim();
        if (!buyerId) return;
        buyerOrderMap.set(buyerId, (buyerOrderMap.get(buyerId) || 0) + 1);
      });
      const suspiciousBuyers = Array.from(buyerOrderMap.entries()).filter(([, count]) => count >= 6);
      if (suspiciousBuyers.length > 0) {
        flags.push({
          type: 'order_pattern',
          severity: 'high',
          message: `${suspiciousBuyers.length} buyer accounts placed 6+ orders today.`,
        });
      }
      setRiskFlags(flags);
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch platform data.');
      setStats(null);
      setRevenueData([]);
      setRiskFlags([]);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const processBulkPayout = async () => {
    if (!confirm('Are you sure you want to process all pending payouts?')) {
      return;
    }

    try {
      const { error: payoutError } = await supabase.functions.invoke('payouts-run-batch', {
        body: {
          source: 'platform_admin_dashboard',
        },
      });

      if (payoutError) {
        alert('Error processing payouts: ' + payoutError.message);
      } else {
        alert('Bulk payout initiated successfully!');
        fetchPlatformData();
      }
    } catch (processError) {
      console.error('Error initiating bulk payout:', processError);
      alert('Error processing payouts');
    }
  };

  const downloadPayoutExport = async (format: 'paypal' | 'audit') => {
    try {
      setPayoutExportLoading(format);

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const response = await fetch('/.netlify/functions/payouts-export-manual', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ format }),
      });

      const contentType = String(response.headers.get('content-type') || '').toLowerCase();
      if (!response.ok) {
        const payload = contentType.includes('application/json')
          ? await response.json().catch(() => ({}))
          : { error: await response.text().catch(() => 'Failed to export payout file') };
        throw new Error(String((payload as any)?.error || 'Failed to export payout file'));
      }

      if (!contentType.includes('text/csv')) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(String((payload as any)?.message || 'No payout export available yet'));
      }

      const blob = await response.blob();
      const disposition = response.headers.get('content-disposition') || '';
      const fileNameMatch = disposition.match(/filename="([^"]+)"/i);
      const fileName = fileNameMatch?.[1] || `beezio-${format}-payout-export.csv`;
      const downloadUrl = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = downloadUrl;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (exportError: any) {
      console.error('Error exporting payout file:', exportError);
      alert(exportError?.message || 'Failed to export payout file');
    } finally {
      setPayoutExportLoading(null);
    }
  };

  const fetchTaxComplianceData = async () => {
    const activeTaxYear = getCurrentTaxYear();
    const yearStart = new Date(activeTaxYear, 0, 1).toISOString();
    const nextYearStart = new Date(activeTaxYear + 1, 0, 1).toISOString();

    try {
      setTaxComplianceLoading(true);
      setTaxComplianceError(null);
      setTaxComplianceMigrationNeeded(false);

      const [taxProfilesResult, taxReportsResult, payoutsResult] = await Promise.all([
        supabase
          .from('tax_profiles')
          .select('user_id,legal_name,delivery_email,form_status,form_type,independent_contractor_ack_at,admin_review_status,last_1099_tax_year,tax_id_last4'),
        supabase
          .from('tax_1099_reports')
          .select('user_id,status,tax_year')
          .eq('tax_year', activeTaxYear),
        supabase
          .from('payout_snapshots')
          .select('payee_user_id,amount,paid_at,status')
          .eq('status', 'PAID')
          .gte('paid_at', yearStart)
          .lt('paid_at', nextYearStart),
      ]);

      if (taxProfilesResult.error) throw taxProfilesResult.error;
      if (taxReportsResult.error) throw taxReportsResult.error;
      if (payoutsResult.error) throw payoutsResult.error;

      const payoutTotals = new Map<string, number>();
      ((payoutsResult.data as any[]) || []).forEach((row) => {
        const userId = String(row?.payee_user_id || '').trim();
        if (!userId) return;
        payoutTotals.set(userId, (payoutTotals.get(userId) || 0) + Math.round(Number(row?.amount || 0) * 100));
      });

      const profileRows = ((taxProfilesResult.data as any[]) || []).filter((row) => String(row?.user_id || '').trim());
      const userIds = Array.from(new Set([...profileRows.map((row) => String(row.user_id)), ...Array.from(payoutTotals.keys())]));

      let profileDirectory = new Map<string, { full_name: string; email: string }>();
      if (userIds.length) {
        const { data: directoryRows, error: directoryError } = await supabase
          .from('profiles')
          .select('user_id,full_name,email')
          .in('user_id', userIds);
        if (directoryError) throw directoryError;
        profileDirectory = new Map(
          ((directoryRows as any[]) || []).map((row) => [String(row?.user_id || ''), {
            full_name: String(row?.full_name || ''),
            email: String(row?.email || ''),
          }])
        );
      }

      const taxReportsByUser = new Map<string, { status: string | null; tax_year: number | null }>();
      ((taxReportsResult.data as any[]) || []).forEach((row) => {
        const userId = String(row?.user_id || '').trim();
        if (!userId) return;
        taxReportsByUser.set(userId, {
          status: row?.status ? String(row.status) : null,
          tax_year: row?.tax_year ? Number(row.tax_year) : null,
        });
      });

      const rows: AdminTaxComplianceRow[] = userIds
        .map((userId) => {
          const taxRow = profileRows.find((row) => String(row.user_id) === userId);
          const directory = profileDirectory.get(userId);
          const report = taxReportsByUser.get(userId);
          return {
            user_id: userId,
            full_name: String(directory?.full_name || taxRow?.legal_name || 'Unknown'),
            email: String(directory?.email || ''),
            legal_name: String(taxRow?.legal_name || ''),
            delivery_email: String(taxRow?.delivery_email || directory?.email || ''),
            form_status: String(taxRow?.form_status || 'missing'),
            form_type: String(taxRow?.form_type || 'none'),
            independent_contractor_ack_at: taxRow?.independent_contractor_ack_at ? String(taxRow.independent_contractor_ack_at) : null,
            admin_review_status: (taxRow?.admin_review_status || 'not_reviewed') as AdminReviewStatus,
            last_1099_tax_year: taxRow?.last_1099_tax_year ? Number(taxRow.last_1099_tax_year) : null,
            tax_id_last4: taxRow?.tax_id_last4 ? String(taxRow.tax_id_last4) : null,
            paid_this_year_cents: payoutTotals.get(userId) || 0,
            report_status: report?.status || null,
          };
        })
        .sort((left, right) => right.paid_this_year_cents - left.paid_this_year_cents);

      setAdminTaxRows(rows);
      setAdminTaxSummary({
        total_payees: rows.length,
        acknowledged: rows.filter((row) => Boolean(row.independent_contractor_ack_at)).length,
        verified: rows.filter((row) => row.form_status === 'verified').length,
        needs_attention: rows.filter((row) => row.form_status === 'needs_attention' || row.admin_review_status === 'needs_follow_up').length,
        pending_1099: rows.filter((row) => row.paid_this_year_cents >= 60000 && row.report_status !== 'issued' && row.report_status !== 'delivered').length,
        ytd_paid_cents: rows.reduce((sum, row) => sum + row.paid_this_year_cents, 0),
      });
    } catch (taxError: any) {
      if (isTaxComplianceTableMissing(taxError)) {
        setTaxComplianceMigrationNeeded(true);
        setAdminTaxRows([]);
      } else {
        setTaxComplianceError(taxError?.message || 'Unable to load tax compliance.');
      }
    } finally {
      setTaxComplianceLoading(false);
    }
  };

  const downloadTaxComplianceExport = () => {
    try {
      const csv = buildTaxCsv(
        adminTaxRows.map((row) => ({
          user_id: row.user_id,
          full_name: row.full_name,
          email: row.email,
          legal_name: row.legal_name,
          delivery_email: row.delivery_email,
          paid_this_year_usd: (row.paid_this_year_cents / 100).toFixed(2),
          contractor_acknowledged: row.independent_contractor_ack_at ? 'yes' : 'no',
          form_status: row.form_status,
          form_type: row.form_type,
          admin_review_status: row.admin_review_status,
          report_status: row.report_status || '',
          last_1099_tax_year: row.last_1099_tax_year || '',
          tax_id_last4: row.tax_id_last4 || '',
        }))
      );
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const downloadUrl = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = downloadUrl;
      anchor.download = `beezio-tax-compliance-${getCurrentTaxYear()}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (downloadError) {
      console.error('Error exporting tax compliance file:', downloadError);
      alert('Failed to export tax compliance CSV');
    }
  };

  const updateTaxReviewStatus = async (row: AdminTaxComplianceRow, nextStatus: AdminReviewStatus) => {
    try {
      setTaxReviewSavingUserId(row.user_id);
      const { error: updateError } = await supabase.from('tax_profiles').upsert(
        {
          user_id: row.user_id,
          legal_name: row.legal_name || row.full_name,
          delivery_email: row.delivery_email || row.email || null,
          form_status: row.form_status,
          form_type: row.form_type,
          independent_contractor_ack_at: row.independent_contractor_ack_at,
          admin_review_status: nextStatus,
          tax_id_last4: row.tax_id_last4,
        },
        { onConflict: 'user_id' }
      );
      if (updateError) throw updateError;
      setAdminTaxRows((current) => current.map((entry) => (entry.user_id === row.user_id ? { ...entry, admin_review_status: nextStatus } : entry)));
    } catch (reviewError: any) {
      alert(reviewError?.message || 'Failed to update tax review status');
    } finally {
      setTaxReviewSavingUserId(null);
    }
  };

  const handleSaveApiKey = async () => {
    const { error: apiError } = await supabase
      .from('admin_settings')
      .upsert({ key: 'api_key', value: apiKey });
    if (apiError) {
      setApiKeyStatus('Failed to save API key.');
    } else {
      setApiKeyStatus('API key saved successfully.');
    }
  };

  const handleQuickEdit = async () => {
    if (!quickEditUserId || !quickEditField) return;
    const { error: quickError } = await supabase
      .from('profiles')
      .update({ [quickEditField]: quickEditValue })
      .eq('id', quickEditUserId);
    if (quickError) {
      setQuickEditStatus('Failed to update user.');
    } else {
      setQuickEditStatus('User updated successfully.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading platform data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100 flex items-center justify-center">
        <div className="bg-white border border-amber-200 rounded-xl shadow-sm p-6 max-w-md text-center">
          <div className="text-lg font-semibold text-gray-900 mb-2">Unable to load admin dashboard</div>
          <p className="text-sm text-gray-600 mb-4">{error}</p>
          <button
            onClick={fetchPlatformData}
            className="px-4 py-2 rounded-lg bg-amber-600 text-white font-semibold hover:bg-amber-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const monthlyPayoutObligations =
    financeBuckets.monthly.sellerPayouts +
    financeBuckets.monthly.affiliatePayouts +
    financeBuckets.monthly.influencerPayouts;
  const yearlyPayoutObligations =
    financeBuckets.yearly.sellerPayouts +
    financeBuckets.yearly.affiliatePayouts +
    financeBuckets.yearly.influencerPayouts;
  const monthlyMargin = financeBuckets.monthly.grossSales > 0
    ? (financeBuckets.monthly.beezioProfit / financeBuckets.monthly.grossSales) * 100
    : 0;
  const yearlyMargin = financeBuckets.yearly.grossSales > 0
    ? (financeBuckets.yearly.beezioProfit / financeBuckets.yearly.grossSales) * 100
    : 0;
  const monthlyReserveLoad = financeBuckets.monthly.paypalFees + financeBuckets.monthly.salesTax;
  const yearlyReserveLoad = financeBuckets.yearly.paypalFees + financeBuckets.yearly.salesTax;
  const adminTabs: Array<{ id: AdminTab; label: string; detail: string; icon: typeof TrendingUp }> = [
    { id: 'overview', label: 'Overview', detail: 'Platform snapshot', icon: TrendingUp },
    { id: 'orders', label: 'Orders', detail: 'Sales and ledger', icon: Store },
    { id: 'fulfillment', label: 'Fulfillment', detail: 'Pack and ship', icon: Package },
    { id: 'payouts', label: 'Payouts', detail: 'Payday queue', icon: DollarSign },
    { id: 'analytics', label: 'Analytics', detail: 'Performance', icon: BarChart3 },
    { id: 'moderation', label: 'Moderation', detail: 'Marketplace review', icon: ShieldAlert },
    { id: 'support', label: 'Support', detail: 'Customer issues', icon: MessageSquare },
    { id: 'printful', label: 'Printful', detail: 'Product sync', icon: Store },
    { id: 'tools', label: 'Tools', detail: 'Settings and tests', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6 rounded-xl border border-amber-200 bg-white px-6 py-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-gray-900">Payout Queue Snapshot</div>
                <div className="text-xs text-gray-600">
                  Pending payouts are tracked in the PayPal payout queue.
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-sm font-semibold text-gray-900">
                  Pending: {formatCurrency(stats?.pending_payouts || 0)}
                </div>
                <Link
                  to="/admin/users"
                  className="inline-flex items-center justify-center rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-50"
                >
                  Open Users Panel
                </Link>
                <Link
                  to="/admin/payouts"
                  className="inline-flex items-center justify-center rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
                >
                  Open Payout Queue
                </Link>
                <Link
                  to="/support/ops"
                  className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Support Operations
                </Link>
              </div>
            </div>
          </div>
          <div className="flex justify-end mb-4">
            <div className="flex gap-2">
              {(['day', 'week', 'month', '3mo', '6mo', 'year'] as TimeFilter[]).map(filter => (
                <button
                  key={filter}
                  onClick={() => setTimeFilter(filter)}
                  className={`px-3 py-1 rounded ${
                    timeFilter === filter
                      ? 'bg-amber-500 text-white'
                      : 'bg-white text-gray-700 border border-amber-200 hover:bg-amber-100'
                  }`}
                >
                  {filter === '3mo'
                    ? '3mo'
                    : filter === '6mo'
                      ? '6mo'
                      : filter.charAt(0).toUpperCase() + filter.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Admin Account Sales ({timeFilter})
            </h3>
            <p className="text-2xl font-bold text-blue-700">{formatCurrency(adminSales)}</p>
            <p className="text-sm text-gray-600">
              Total sales completed by admin accounts for the selected period.
            </p>
          </div>

          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">Platform Admin Dashboard</h1>
            <p className="text-xl text-gray-600">Monitor platform performance and manage payouts</p>
          </div>

          <div className="mb-8 rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 via-white to-orange-50 p-6 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-amber-800">
                  <FlaskConical className="h-4 w-4" />
                  Admin PayPal Test Item
                </div>
                <h2 className="mt-2 text-2xl font-bold text-gray-900">Visible as soon as you land in admin</h2>
                <p className="mt-2 text-sm text-gray-700">
                  Test item is fixed at ${TEST_ITEM_PRICE.toFixed(2)} with seller ${TEST_ITEM_SELLER_AMOUNT.toFixed(2)}, affiliate ${TEST_ITEM_AFFILIATE_AMOUNT.toFixed(2)}, influencer ${TEST_ITEM_INFLUENCER_FEE.toFixed(2)}, Beezio ${TEST_ITEM_BEEZIO_FEE.toFixed(2)}, and processing ${TEST_ITEM_PROCESSING_FEE.toFixed(2)}.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void handleCreateOrRefreshTestProduct()}
                  disabled={savingTestProduct}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#101820] px-5 py-3 font-semibold text-[#ffcb05] hover:bg-black disabled:opacity-50"
                >
                  {savingTestProduct ? <RefreshCw className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4" />}
                  {savingTestProduct ? 'Saving Test Product...' : 'Create/Refresh Test Product'}
                </button>
                <Link
                  to="/admin/products"
                  className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-5 py-3 font-semibold text-gray-900 hover:bg-white"
                >
                  Open Product Hub
                </Link>
              </div>
            </div>
            {testProductStatus && (
              <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                {testProductStatus}
              </div>
            )}
            {testProductError && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {testProductError}
              </div>
            )}
          </div>

          <div className="mb-8 rounded-2xl border border-amber-200 bg-white p-4 shadow-sm sm:p-6">
            <div className="mb-4">
              <h2 className="text-xl font-bold text-gray-900">Admin workspace</h2>
              <p className="mt-1 text-sm text-gray-600">Choose the job you need instead of scrolling through one long dashboard.</p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <Link
                to="/admin/products"
                className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-left transition hover:border-amber-300 hover:bg-amber-50"
              >
                <Package className="mb-2 h-5 w-5 text-amber-700" />
                <div className="font-bold text-gray-900">Products</div>
                <div className="mt-1 text-xs text-gray-600">Add and manage</div>
              </Link>
              {adminTabs.map(({ id, label, detail, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveTab(id)}
                  className={`rounded-xl border p-3 text-left transition ${
                    activeTab === id
                      ? 'border-amber-500 bg-amber-500 text-white shadow-sm'
                      : 'border-slate-200 bg-slate-50 text-gray-900 hover:border-amber-300 hover:bg-amber-50'
                  }`}
                >
                  <Icon className={`mb-2 h-5 w-5 ${activeTab === id ? 'text-white' : 'text-amber-700'}`} />
                  <div className="font-bold">{label}</div>
                  <div className={`mt-1 text-xs ${activeTab === id ? 'text-amber-50' : 'text-gray-600'}`}>{detail}</div>
                </button>
              ))}
            </div>
          </div>

          {activeTab === 'overview' && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-6 mb-8">
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                      <p className="text-2xl font-bold text-green-600">
                        {formatCurrency(stats?.total_revenue || 0)}
                      </p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-green-600" />
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow-sm p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Monthly Revenue</p>
                      <p className="text-2xl font-bold text-blue-600">
                        {formatCurrency(stats?.monthly_revenue || 0)}
                      </p>
                    </div>
                    <DollarSign className="h-8 w-8 text-blue-600" />
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow-sm p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Active Sellers</p>
                      <p className="text-2xl font-bold text-purple-600">
                        {stats?.active_sellers || 0}
                      </p>
                    </div>
                    <Users className="h-8 w-8 text-purple-600" />
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow-sm p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Transactions</p>
                      <p className="text-2xl font-bold text-orange-600">
                        {stats?.total_transactions || 0}
                      </p>
                    </div>
                    <Package className="h-8 w-8 text-orange-600" />
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow-sm p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Pending Payouts</p>
                      <p className="text-2xl font-bold text-red-600">
                        {formatCurrency(stats?.pending_payouts || 0)}
                      </p>
                    </div>
                    <Download className="h-8 w-8 text-red-600" />
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow-sm p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Total Users</p>
                      <p className="text-2xl font-bold text-indigo-600">
                        {stats?.total_users || 0}
                      </p>
                    </div>
                    <BarChart3 className="h-8 w-8 text-indigo-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Operations Launchpad</h3>
                    <p className="text-sm text-gray-600">Itemized admin links for user controls, payouts, support staff, and platform settings.</p>
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <Link to="/admin/users" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 transition hover:border-emerald-300 hover:bg-emerald-100/70">
                    <div className="text-sm font-semibold text-emerald-900">Admin Users</div>
                    <div className="mt-1 text-sm text-emerald-800">Lifetime earnings, account controls, exports, and user-level activity.</div>
                  </Link>
                  <Link to="/admin/payouts" className="rounded-xl border border-amber-200 bg-amber-50 p-4 transition hover:border-amber-300 hover:bg-amber-100/70">
                    <div className="text-sm font-semibold text-amber-900">Payout Command</div>
                    <div className="mt-1 text-sm text-amber-800">Payday queue, PayPal upload CSVs, audit exports, finance closeouts, and PDF reports.</div>
                  </Link>
                  <Link to="/support/ops" className="rounded-xl border border-sky-200 bg-sky-50 p-4 transition hover:border-sky-300 hover:bg-sky-100/70">
                    <div className="text-sm font-semibold text-sky-900">Support Workspace</div>
                    <div className="mt-1 text-sm text-sky-800">Separate support login area for disputes, customer service, and live support handling.</div>
                  </Link>
                  <Link to="/admin/settings" className="rounded-xl border border-slate-200 bg-slate-50 p-4 transition hover:border-slate-300 hover:bg-slate-100/80">
                    <div className="text-sm font-semibold text-slate-900">Platform Settings</div>
                    <div className="mt-1 text-sm text-slate-700">Operational settings, compliance controls, and internal platform configuration.</div>
                  </Link>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Finance Command Center</h3>
                    <p className="text-sm text-gray-600">Recorded sales, real sales, Beezio-only revenue, payout obligations, PayPal fees, and tax holdbacks across the last hour through year.</p>
                  </div>
                  <Link to="/admin/payouts" className="text-sm font-semibold text-amber-700 hover:text-amber-800">
                    Open full payout queue
                  </Link>
                </div>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5 mb-6">
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-emerald-800">This Month Gross</div>
                    <div className="mt-2 text-2xl font-bold text-emerald-900">{formatCurrency(financeBuckets.monthly.grossSales)}</div>
                    <div className="mt-1 text-xs text-emerald-800">All recorded customer sales captured in the ledger this month.</div>
                  </div>
                  <div className="rounded-xl border border-emerald-200 bg-white p-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-emerald-800">This Month Real Sales</div>
                    <div className="mt-2 text-2xl font-bold text-emerald-900">{financeBuckets.monthly.realSales}</div>
                    <div className="mt-1 text-xs text-emerald-800">Paid sales not later refunded.</div>
                  </div>
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-amber-800">This Month Owed To Users</div>
                    <div className="mt-2 text-2xl font-bold text-amber-900">{formatCurrency(monthlyPayoutObligations)}</div>
                    <div className="mt-1 text-xs text-amber-800">Seller, affiliate, and influencer obligations that do not belong to Beezio.</div>
                  </div>
                  <div className="rounded-xl border border-sky-200 bg-sky-50 p-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-sky-800">This Month Beezio Gross</div>
                    <div className="mt-2 text-2xl font-bold text-sky-900">{formatCurrency(financeBuckets.monthly.beezioGrossRevenue)}</div>
                    <div className="mt-1 text-xs text-sky-800">Beezio-only revenue after seller, affiliate, influencer, tax, and shipping are removed.</div>
                  </div>
                  <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-cyan-800">This Month Beezio Net After PayPal</div>
                    <div className="mt-2 text-2xl font-bold text-cyan-900">{formatCurrency(financeBuckets.monthly.beezioNetRevenue)}</div>
                    <div className="mt-1 text-xs text-cyan-800">Beezio gross revenue less processor fees.</div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-700">This Month Fees + Tax Load</div>
                    <div className="mt-2 text-2xl font-bold text-slate-900">{formatCurrency(monthlyReserveLoad)}</div>
                    <div className="mt-1 text-xs text-slate-600">PayPal fees plus sales tax tracked in the ledger for finance review.</div>
                  </div>
                </div>
                <div className="grid gap-4 xl:grid-cols-2 mb-6">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-sm font-semibold text-slate-900">CPA Snapshot: This Month</div>
                        <div className="mt-1 text-sm text-slate-600">Use this split to see what belongs to payees versus what belongs to Beezio.</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs uppercase tracking-wide text-slate-500">Beezio Margin</div>
                        <div className="mt-1 text-lg font-bold text-slate-900">{monthlyMargin.toFixed(2)}%</div>
                      </div>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-4 text-sm">
                      <div className="rounded-lg bg-white px-4 py-3">
                        <div className="text-xs uppercase tracking-wide text-slate-500">Gross Sales</div>
                        <div className="mt-1 font-semibold text-slate-900">{formatCurrency(financeBuckets.monthly.grossSales)}</div>
                      </div>
                      <div className="rounded-lg bg-white px-4 py-3">
                        <div className="text-xs uppercase tracking-wide text-slate-500">Real Sales</div>
                        <div className="mt-1 font-semibold text-emerald-700">{financeBuckets.monthly.realSales}</div>
                      </div>
                      <div className="rounded-lg bg-white px-4 py-3">
                        <div className="text-xs uppercase tracking-wide text-slate-500">Payout Obligations</div>
                        <div className="mt-1 font-semibold text-amber-700">{formatCurrency(monthlyPayoutObligations)}</div>
                      </div>
                      <div className="rounded-lg bg-white px-4 py-3">
                        <div className="text-xs uppercase tracking-wide text-slate-500">Beezio Net After PayPal</div>
                        <div className="mt-1 font-semibold text-emerald-700">{formatCurrency(financeBuckets.monthly.beezioNetRevenue)}</div>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-sm font-semibold text-slate-900">CPA Snapshot: This Year</div>
                        <div className="mt-1 text-sm text-slate-600">Year-to-date ledger totals for accounting review and payout planning.</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs uppercase tracking-wide text-slate-500">Beezio Margin</div>
                        <div className="mt-1 text-lg font-bold text-slate-900">{yearlyMargin.toFixed(2)}%</div>
                      </div>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-4 text-sm">
                      <div className="rounded-lg bg-white px-4 py-3">
                        <div className="text-xs uppercase tracking-wide text-slate-500">Gross Sales</div>
                        <div className="mt-1 font-semibold text-slate-900">{formatCurrency(financeBuckets.yearly.grossSales)}</div>
                      </div>
                      <div className="rounded-lg bg-white px-4 py-3">
                        <div className="text-xs uppercase tracking-wide text-slate-500">Real Sales</div>
                        <div className="mt-1 font-semibold text-emerald-700">{financeBuckets.yearly.realSales}</div>
                      </div>
                      <div className="rounded-lg bg-white px-4 py-3">
                        <div className="text-xs uppercase tracking-wide text-slate-500">Payout Obligations</div>
                        <div className="mt-1 font-semibold text-amber-700">{formatCurrency(yearlyPayoutObligations)}</div>
                      </div>
                      <div className="rounded-lg bg-white px-4 py-3">
                        <div className="text-xs uppercase tracking-wide text-slate-500">Beezio Net After PayPal</div>
                        <div className="mt-1 font-semibold text-emerald-700">{formatCurrency(financeBuckets.yearly.beezioNetRevenue)}</div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 text-gray-600">
                        <th className="text-left py-3 px-4 font-semibold">Window</th>
                        <th className="text-right py-3 px-4 font-semibold">Orders</th>
                        <th className="text-right py-3 px-4 font-semibold">Real Sales</th>
                        <th className="text-right py-3 px-4 font-semibold">Gross</th>
                        <th className="text-right py-3 px-4 font-semibold">Seller</th>
                        <th className="text-right py-3 px-4 font-semibold">Affiliate</th>
                        <th className="text-right py-3 px-4 font-semibold">Influencer</th>
                        <th className="text-right py-3 px-4 font-semibold">Beezio Gross</th>
                        <th className="text-right py-3 px-4 font-semibold">PayPal</th>
                        <th className="text-right py-3 px-4 font-semibold">Beezio Net</th>
                        <th className="text-right py-3 px-4 font-semibold">Tax</th>
                      </tr>
                    </thead>
                    <tbody>
                      {([
                        ['hourly', 'Last Hour'],
                        ['daily', 'Today'],
                        ['weekly', 'Last 7 Days'],
                        ['monthly', 'This Month'],
                        ['yearly', 'This Year'],
                      ] as const).map(([key, label]) => {
                        const bucket = financeBuckets[key];
                        return (
                          <tr key={key} className="border-b border-gray-100">
                            <td className="py-3 px-4 font-medium text-gray-900">{label}</td>
                            <td className="py-3 px-4 text-right">{bucket.orders}</td>
                            <td className="py-3 px-4 text-right text-emerald-700">{bucket.realSales}</td>
                            <td className="py-3 px-4 text-right font-semibold text-gray-900">{formatCurrency(bucket.grossSales)}</td>
                            <td className="py-3 px-4 text-right">{formatCurrency(bucket.sellerPayouts)}</td>
                            <td className="py-3 px-4 text-right">{formatCurrency(bucket.affiliatePayouts)}</td>
                            <td className="py-3 px-4 text-right">{formatCurrency(bucket.influencerPayouts)}</td>
                            <td className="py-3 px-4 text-right font-semibold text-sky-700">{formatCurrency(bucket.beezioGrossRevenue)}</td>
                            <td className="py-3 px-4 text-right">{formatCurrency(bucket.paypalFees)}</td>
                            <td className="py-3 px-4 text-right font-semibold text-emerald-700">{formatCurrency(bucket.beezioNetRevenue)}</td>
                            <td className="py-3 px-4 text-right">{formatCurrency(bucket.salesTax)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-6">Top Sellers</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Seller</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Total Earned</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Sales Count</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topSellers.map((seller, index) => (
                        <tr key={seller.user_id} className="border-b border-gray-100">
                          <td className="py-3 px-4">
                            <div className="flex items-center">
                              <div className="bg-amber-100 rounded-full w-8 h-8 flex items-center justify-center mr-3">
                                <span className="text-amber-600 font-semibold text-sm">{index + 1}</span>
                              </div>
                              <span className="font-medium">{seller.full_name}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 font-semibold text-green-600">
                            {formatCurrency(seller.total_earned)}
                          </td>
                          <td className="py-3 px-4">{seller.total_sales}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Daily Health Metrics</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                      <div className="text-gray-500">GMV (Today)</div>
                      <div className="text-base font-semibold text-gray-900">{formatCurrency(healthMetrics.dailyGmv)}</div>
                    </div>
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                      <div className="text-gray-500">Conversion Rate</div>
                      <div className="text-base font-semibold text-gray-900">{healthMetrics.conversionRate.toFixed(1)}%</div>
                    </div>
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                      <div className="text-gray-500">CAC</div>
                      <div className="text-base font-semibold text-gray-900">
                        {healthMetrics.cac === null ? 'N/A (no marketing spend feed)' : formatCurrency(healthMetrics.cac)}
                      </div>
                    </div>
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                      <div className="text-gray-500">Failed Checkouts</div>
                      <div className="text-base font-semibold text-gray-900">{healthMetrics.failedCheckouts}</div>
                    </div>
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 sm:col-span-2">
                      <div className="text-gray-500">Refund Rate</div>
                      <div className="text-base font-semibold text-gray-900">{healthMetrics.refundRate.toFixed(1)}%</div>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow-sm p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Risk Checks</h3>
                  {riskFlags.length === 0 ? (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                      No high-risk patterns detected in today&apos;s data.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {riskFlags.map((flag, index) => (
                        <div
                          key={`${flag.type}-${index}`}
                          className={`rounded-lg border p-3 text-sm ${
                            flag.severity === 'high'
                              ? 'border-red-200 bg-red-50 text-red-800'
                              : 'border-amber-200 bg-amber-50 text-amber-800'
                          }`}
                        >
                          <span className="font-semibold uppercase">{flag.severity}</span>: {flag.message}
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-4">
                    <div className="text-sm font-semibold text-gray-900 mb-2">Top Influencers (Today)</div>
                    {healthMetrics.topInfluencers.length === 0 ? (
                      <div className="text-xs text-gray-500">No influencer-attributed payout activity yet today.</div>
                    ) : (
                      <div className="space-y-1">
                        {healthMetrics.topInfluencers.map((entry) => (
                          <div key={entry.id} className="flex items-start justify-between rounded border border-gray-100 px-3 py-2 text-xs gap-3">
                            <div>
                              <div className="font-semibold text-gray-900">{entry.name}</div>
                              <div className="text-gray-500">{entry.payout_email || entry.email || entry.id}</div>
                              <div className="text-gray-400">{entry.orderCount} influenced sale{entry.orderCount === 1 ? '' : 's'}</div>
                            </div>
                            <span className="font-semibold text-gray-900">{formatCurrency(entry.amount)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}

          {activeTab === 'orders' && <AdminOrderLedgerPanel defaultPreset={timeFilter} />}

          {activeTab === 'payouts' && (
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-lg font-semibold text-gray-900">Pending Payouts</h3>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => downloadPayoutExport('paypal')}
                    disabled={payoutExportLoading !== null}
                    className="inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800 transition-colors hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Download className="h-4 w-4" />
                    {payoutExportLoading === 'paypal' ? 'Preparing PayPal CSV...' : 'Download PayPal CSV'}
                  </button>
                  <button
                    onClick={() => downloadPayoutExport('audit')}
                    disabled={payoutExportLoading !== null}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Download className="h-4 w-4" />
                    {payoutExportLoading === 'audit' ? 'Preparing audit CSV...' : 'Download Audit CSV'}
                  </button>
                  <button
                    onClick={processBulkPayout}
                    className="bg-amber-500 text-white px-6 py-2 rounded-lg hover:bg-amber-600 transition-colors"
                  >
                    Process All Payouts
                  </button>
                </div>
              </div>

              <p className="mb-6 text-sm text-gray-600">
                Export the PayPal upload file for the next eligible payday, or download the audit CSV to review every payee, amount, and order before sending payouts.
              </p>

              <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h4 className="text-base font-semibold text-gray-900">Tax compliance for {getCurrentTaxYear()}</h4>
                    <p className="mt-1 text-sm text-gray-600">
                      Review contractor acknowledgements, tax form readiness, and year-end 1099 exposure before you finalize payouts.
                    </p>
                  </div>
                  <button
                    onClick={downloadTaxComplianceExport}
                    disabled={!adminTaxRows.length}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Download className="h-4 w-4" />
                    Export Tax CSV
                  </button>
                </div>

                {taxComplianceMigrationNeeded ? (
                  <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    Apply Supabase migration 20260330090000_tax_compliance.sql to enable admin tax reporting.
                  </div>
                ) : null}
                {taxComplianceError ? (
                  <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {taxComplianceError}
                  </div>
                ) : null}

                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4 xl:grid-cols-6">
                  {[
                    ['Tracked payees', String(adminTaxSummary.total_payees)],
                    ['Acknowledged', String(adminTaxSummary.acknowledged)],
                    ['Verified', String(adminTaxSummary.verified)],
                    ['Needs attention', String(adminTaxSummary.needs_attention)],
                    ['Likely 1099', String(adminTaxSummary.pending_1099)],
                    ['YTD paid', formatCurrency(adminTaxSummary.ytd_paid_cents / 100)],
                  ].map(([label, value]) => (
                    <div key={String(label)} className="rounded-lg border border-white bg-white px-4 py-3">
                      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</div>
                      <div className="mt-1 text-lg font-bold text-gray-900">{value}</div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                        <th className="px-3 py-2">Payee</th>
                        <th className="px-3 py-2">YTD paid</th>
                        <th className="px-3 py-2">Contractor</th>
                        <th className="px-3 py-2">Form</th>
                        <th className="px-3 py-2">1099</th>
                        <th className="px-3 py-2">Admin review</th>
                      </tr>
                    </thead>
                    <tbody>
                      {taxComplianceLoading ? (
                        <tr>
                          <td colSpan={6} className="px-3 py-4 text-gray-500">Loading tax compliance...</td>
                        </tr>
                      ) : adminTaxRows.length ? (
                        adminTaxRows.map((row) => (
                          <tr key={row.user_id} className="border-b border-slate-100 align-top">
                            <td className="px-3 py-3">
                              <div className="font-medium text-gray-900">{row.full_name}</div>
                              <div className="text-xs text-gray-500">{row.delivery_email || row.email || 'No email'}</div>
                              {row.legal_name && row.legal_name !== row.full_name ? <div className="text-xs text-gray-500">Legal: {row.legal_name}</div> : null}
                            </td>
                            <td className="px-3 py-3 font-semibold text-emerald-700">{formatCurrency(row.paid_this_year_cents / 100)}</td>
                            <td className="px-3 py-3">
                              <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${row.independent_contractor_ack_at ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-700'}`}>
                                {row.independent_contractor_ack_at ? 'On file' : 'Missing'}
                              </span>
                            </td>
                            <td className="px-3 py-3">
                              <div className="font-medium text-gray-900">{row.form_type}</div>
                              <div className="text-xs text-gray-500">{row.form_status}</div>
                              <div className="text-xs text-gray-500">TIN: {row.tax_id_last4 ? `***-${row.tax_id_last4}` : 'n/a'}</div>
                            </td>
                            <td className="px-3 py-3">
                              <div className="font-medium text-gray-900">{row.report_status || (row.paid_this_year_cents >= 60000 ? 'Not issued' : 'Below threshold')}</div>
                              <div className="text-xs text-gray-500">Last year: {row.last_1099_tax_year || 'none'}</div>
                            </td>
                            <td className="px-3 py-3">
                              <select
                                value={row.admin_review_status}
                                onChange={(event) => void updateTaxReviewStatus(row, event.target.value as AdminReviewStatus)}
                                disabled={taxReviewSavingUserId === row.user_id}
                                className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-700"
                              >
                                <option value="not_reviewed">Not reviewed</option>
                                <option value="ready">Ready</option>
                                <option value="needs_follow_up">Needs follow-up</option>
                                <option value="filed">Filed</option>
                              </select>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={6} className="px-3 py-4 text-gray-500">No tax compliance rows yet.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">User</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Role</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Amount</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Days Pending</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">PayPal / Contact</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingPayouts.map(payout => (
                      <tr key={payout.user_id} className="border-b border-gray-100">
                        <td className="py-3 px-4 font-medium">{payout.full_name}</td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                              payout.role === 'seller'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-green-100 text-green-800'
                            }`}
                          >
                            {payout.role}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-semibold text-green-600">
                          {formatCurrency(payout.amount)}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`${payout.days_pending > 7 ? 'text-red-600' : 'text-gray-600'}`}>
                            {payout.days_pending} days
                          </span>
                          {payout.next_payout_date ? <div className="text-xs text-gray-400">Pays {payout.next_payout_date}</div> : null}
                        </td>
                        <td className="py-3 px-4 text-gray-600">
                          <div>{payout.payout_email || 'No PayPal on file'}</div>
                          <div className="text-xs text-gray-400">{payout.email || 'No contact email'}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'analytics' && (
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-6">Revenue Trend</h3>
              <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={revenueData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month_year" />
                    <YAxis />
                    <Tooltip
                      formatter={value => [formatCurrency(Number(value)), 'Revenue']}
                      labelFormatter={label => `Month: ${label}`}
                    />
                    <Line
                      type="monotone"
                      dataKey="revenue"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      dot={{ fill: '#f59e0b' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {activeTab === 'moderation' && <ContentModerationDashboard />}

          {activeTab === 'printful' && (
            <div className="mt-4">
              <AdminPrintfulImportPage embedded />
            </div>
          )}

          {activeTab === 'fulfillment' && (
            <div className="mt-4">
              <ManualFulfillmentQueue
                scope="admin"
                title="Admin Order Fulfillment"
                subtitle="Open an order number to see product descriptions, supplier identifiers, shipping details, and move it from needs ordering to ordered to shipped."
              />
            </div>
          )}

          {activeTab === 'support' && (
            <div className="bg-white rounded-lg shadow-sm p-6">
              <IssueCenterPage embedded />
              <div className="mt-8">
                <ChatSupportDashboard />
              </div>
            </div>
          )}

          {activeTab === 'tools' && (
            <div className="space-y-8">
              <section className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Insurance Operations</h3>
                    <p className="text-sm text-gray-600">
                      Manage global insurance pricing floors, blocked IPs, affiliate trust controls, and campaign health.
                    </p>
                  </div>
                  <button
                    onClick={loadInsuranceAdminData}
                    className="px-4 py-2 rounded-lg bg-slate-900 text-white font-semibold hover:bg-slate-800 disabled:opacity-50"
                    disabled={insuranceAdminLoading}
                  >
                    {insuranceAdminLoading ? 'Refreshing...' : 'Refresh Insurance Ops'}
                  </button>
                </div>

                {insuranceAdminError && (
                  <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {insuranceAdminError}
                  </div>
                )}
                {insuranceActionStatus && (
                  <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    {insuranceActionStatus}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
                  <div className="rounded-lg border border-gray-200 p-4">
                    <div className="text-xs uppercase text-gray-500">Total Leads</div>
                    <div className="mt-2 text-2xl font-bold text-gray-900">{insuranceAdminOverview.total_leads}</div>
                  </div>
                  <div className="rounded-lg border border-gray-200 p-4">
                    <div className="text-xs uppercase text-gray-500">Delivered</div>
                    <div className="mt-2 text-2xl font-bold text-emerald-700">{insuranceAdminOverview.delivered_leads}</div>
                  </div>
                  <div className="rounded-lg border border-gray-200 p-4">
                    <div className="text-xs uppercase text-gray-500">Flagged</div>
                    <div className="mt-2 text-2xl font-bold text-amber-700">{insuranceAdminOverview.flagged_leads}</div>
                  </div>
                  <div className="rounded-lg border border-gray-200 p-4">
                    <div className="text-xs uppercase text-gray-500">Rejected</div>
                    <div className="mt-2 text-2xl font-bold text-rose-700">{insuranceAdminOverview.rejected_leads}</div>
                  </div>
                  <div className="rounded-lg border border-gray-200 p-4">
                    <div className="text-xs uppercase text-gray-500">Blocked IPs</div>
                    <div className="mt-2 text-2xl font-bold text-slate-900">{insuranceAdminOverview.blocked_ip_count}</div>
                  </div>
                  <div className="rounded-lg border border-gray-200 p-4">
                    <div className="text-xs uppercase text-gray-500">Out of Funds</div>
                    <div className="mt-2 text-2xl font-bold text-orange-700">{insuranceAdminOverview.out_of_funds_campaigns}</div>
                  </div>
                  <div className="rounded-lg border border-gray-200 p-4">
                    <div className="text-xs uppercase text-gray-500">Flagged Listings</div>
                    <div className="mt-2 text-2xl font-bold text-rose-700">{insuranceAdminOverview.flagged_listings}</div>
                  </div>
                </div>

                <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  Insurance compliance baseline: vetted warm inbound only, one-agent contact only, no cold-lead or lead-list marketing, and no guaranteed approval or guaranteed coverage claims.
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  <div className="rounded-lg border border-gray-200 p-4">
                    <h4 className="font-semibold text-gray-900 mb-3">Global Insurance Settings</h4>
                    <div className="space-y-3">
                      {insuranceSettings.map((setting) => (
                        <div key={setting.id} className="grid grid-cols-[1.2fr_1fr_auto] gap-3 items-center">
                          <div>
                            <div className="text-sm font-medium text-gray-900">{setting.setting_key}</div>
                            <div className="text-xs text-gray-500">Updated {new Date(setting.updated_at).toLocaleString()}</div>
                          </div>
                          <input
                            value={insuranceSettingDrafts[setting.setting_key] || ''}
                            onChange={(e) => setInsuranceSettingDrafts((current) => ({ ...current, [setting.setting_key]: e.target.value }))}
                            className="px-3 py-2 border border-gray-300 rounded-lg"
                          />
                          <button
                            onClick={() => saveInsuranceSetting(setting.setting_key)}
                            className="px-3 py-2 rounded-lg bg-amber-600 text-white text-sm font-semibold hover:bg-amber-700"
                          >
                            Save
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-lg border border-gray-200 p-4">
                    <h4 className="font-semibold text-gray-900 mb-3">Blocked Insurance IPs</h4>
                    <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3 mb-4">
                      <input
                        value={insuranceIpInput}
                        onChange={(e) => setInsuranceIpInput(e.target.value)}
                        placeholder="Raw IP or existing hash"
                        className="px-3 py-2 border border-gray-300 rounded-lg"
                      />
                      <input
                        value={insuranceIpReason}
                        onChange={(e) => setInsuranceIpReason(e.target.value)}
                        placeholder="Reason"
                        className="px-3 py-2 border border-gray-300 rounded-lg"
                      />
                      <button
                        onClick={blockInsuranceIp}
                        className="px-4 py-2 rounded-lg bg-rose-600 text-white font-semibold hover:bg-rose-700"
                      >
                        Block
                      </button>
                    </div>
                    <div className="space-y-3">
                      {insuranceBlockedIps.length === 0 && <div className="text-sm text-gray-600">No blocked insurance IPs.</div>}
                      {insuranceBlockedIps.map((block) => (
                        <div key={block.id} className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 p-3">
                          <div>
                            <div className="text-sm font-medium text-gray-900">{block.ip_hash.slice(0, 20)}...</div>
                            <div className="text-xs text-gray-500">{block.reason || 'No reason'} · {new Date(block.created_at).toLocaleString()}</div>
                          </div>
                          <button
                            onClick={() => unblockInsuranceIp(block.id)}
                            className="px-3 py-2 rounded-lg border border-gray-300 text-sm font-semibold text-gray-700 hover:bg-white"
                          >
                            Unblock
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mt-6">
                  <div className="rounded-lg border border-gray-200 p-4">
                    <h4 className="font-semibold text-gray-900 mb-3">Insurance Affiliate Trust Controls</h4>
                    <div className="space-y-3">
                      {insuranceAffiliateProfiles.length === 0 && <div className="text-sm text-gray-600">No insurance affiliate profiles yet.</div>}
                      {insuranceAffiliateProfiles.map((row) => (
                        <div key={row.id} className="rounded-lg bg-gray-50 p-3">
                          <div className="flex items-center justify-between gap-3 mb-3">
                            <div>
                              <div className="font-medium text-gray-900">{row.profile?.full_name || row.profile?.email || row.affiliate_user_id}</div>
                              <div className="text-xs text-gray-500">{row.affiliate_user_id}</div>
                            </div>
                            <button
                              onClick={() => saveInsuranceAffiliateProfile(row)}
                              className="px-3 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800"
                            >
                              Save
                            </button>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <select
                              value={row.trust_tier}
                              onChange={(e) => setInsuranceAffiliateProfiles((current) => current.map((item) => item.id === row.id ? { ...item, trust_tier: e.target.value } : item))}
                              className="px-3 py-2 border border-gray-300 rounded-lg"
                            >
                              <option value="new">new</option>
                              <option value="trusted">trusted</option>
                              <option value="restricted">restricted</option>
                            </select>
                            <input
                              type="number"
                              value={row.daily_valid_lead_cap}
                              onChange={(e) => setInsuranceAffiliateProfiles((current) => current.map((item) => item.id === row.id ? { ...item, daily_valid_lead_cap: Number(e.target.value || 0) } : item))}
                              className="px-3 py-2 border border-gray-300 rounded-lg"
                            />
                            <input
                              type="number"
                              value={row.payout_hold_days}
                              onChange={(e) => setInsuranceAffiliateProfiles((current) => current.map((item) => item.id === row.id ? { ...item, payout_hold_days: Number(e.target.value || 0) } : item))}
                              className="px-3 py-2 border border-gray-300 rounded-lg"
                            />
                            <input
                              type="number"
                              value={row.fraud_flag_count}
                              onChange={(e) => setInsuranceAffiliateProfiles((current) => current.map((item) => item.id === row.id ? { ...item, fraud_flag_count: Number(e.target.value || 0) } : item))}
                              className="px-3 py-2 border border-gray-300 rounded-lg"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-lg border border-gray-200 p-4">
                    <h4 className="font-semibold text-gray-900 mb-3">Insurance Campaign and Lead Snapshot</h4>
                    <div className="space-y-3">
                      {insuranceCampaigns.slice(0, 6).map((campaign) => (
                        <div key={campaign.id} className="rounded-lg bg-gray-50 p-3">
                          <div className="font-medium text-gray-900">{campaign.listing?.agency_name || 'Insurance campaign'}</div>
                          <div className="text-sm text-gray-600">
                            {campaign.vertical} · {campaign.status} · CPL ${(Number(campaign.cost_per_lead_cents || 0) / 100).toFixed(2)} · Affiliate ${(Number(campaign.affiliate_payout_cents || 0) / 100).toFixed(2)}
                          </div>
                        </div>
                      ))}
                      {insuranceRecentLeads.slice(0, 6).map((lead) => (
                        <div key={lead.id} className="rounded-lg border border-gray-200 p-3">
                          <div className="font-medium text-gray-900">{lead.listing?.agency_name || 'Insurance listing'}</div>
                          <div className="text-sm text-gray-600">
                            {lead.vertical} · {lead.status} · Review {lead.review_status} · Fraud {lead.fraud_score || 0}
                          </div>
                          <div className="mt-1 text-xs text-gray-500">
                            Source {lead.payload_json?.source_type || (lead.affiliate_profile ? 'affiliate' : 'direct')} ·
                            Lead ${(Number(lead.lead_price_cents || 0) / 100).toFixed(2)} ·
                            Affiliate ${(Number(lead.affiliate_payout_cents || 0) / 100).toFixed(2)} ·
                            Influencer ${(Number(lead.influencer_payout_cents || 0) / 100).toFixed(2)} ·
                            Beezio ${(Number(lead.beezio_fee_cents || 0) / 100).toFixed(2)}
                          </div>
                          {lead.affiliate_profile && (
                            <div className="text-xs text-gray-500">
                              Affiliate {lead.affiliate_profile.full_name || lead.affiliate_profile.email || 'unknown'}
                            </div>
                          )}
                          {lead.delivered_at && <div className="text-xs text-emerald-700 mt-1">Delivered {new Date(lead.delivered_at).toLocaleString()}</div>}
                          {lead.status_reason && <div className="text-xs text-gray-500 mt-1">{lead.status_reason}</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-6 rounded-lg border border-gray-200 p-4">
                  <h4 className="font-semibold text-gray-900 mb-3">Insurance Compliance Queue</h4>
                  <div className="space-y-3">
                    {insuranceListings.length === 0 && <div className="text-sm text-gray-600">No insurance listings loaded.</div>}
                    {insuranceListings.slice(0, 10).map((listing) => (
                      <div key={listing.id} className="rounded-lg bg-gray-50 p-4">
                        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                          <div>
                            <div className="font-medium text-gray-900">{listing.agency_name || 'Insurance listing'}</div>
                            <div className="text-xs text-gray-500">/{listing.slug} · Updated {new Date(listing.updated_at).toLocaleString()}</div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${listing.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-200 text-gray-700'}`}>
                              {listing.is_active ? 'active' : 'inactive'}
                            </span>
                            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${listing.accepts_new_leads ? 'bg-blue-100 text-blue-800' : 'bg-gray-200 text-gray-700'}`}>
                              {listing.accepts_new_leads ? 'accepting leads' : 'paused'}
                            </span>
                          </div>
                        </div>
                        <div className="mt-3 text-sm text-gray-600">
                          {listing.hero_subtitle || listing.bio || 'No public positioning copy.'}
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {(listing.compliance_flags || []).length === 0 ? (
                            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">No automatic compliance flags</span>
                          ) : (
                            (listing.compliance_flags || []).map((flag) => (
                              <span key={`${listing.id}-${flag.code}`} className="rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-800">
                                {flag.label}
                              </span>
                            ))
                          )}
                        </div>
                        <div className="mt-3 text-xs text-gray-500">
                          Disclaimer: {listing.disclaimer || 'missing'} · Contact email: {listing.contact_email || 'missing'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              <section className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">PayPal Environment</h3>
                    <p className="text-sm text-gray-600">
                      Toggle checkout between sandbox and live mode.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPayPalEnv('sandbox')}
                      disabled={paypalAdminLoading || paypalEnvSaving}
                      className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-800 font-semibold disabled:opacity-50"
                    >
                      Use Sandbox
                    </button>
                    <button
                      onClick={() => setPayPalEnv('live')}
                      disabled={paypalAdminLoading || paypalEnvSaving}
                      className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-semibold disabled:opacity-50"
                    >
                      Use Live
                    </button>
                  </div>
                </div>
                <div className="text-sm text-gray-700">
                  Mode:{' '}
                  <span className="font-semibold">
                    {paypalAdminLoading ? 'Loading...' : paypalAdminConfig?.env === 'live' ? 'Live' : 'Sandbox'}
                  </span>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Client ID: {paypalAdminConfig?.configured?.clientId ? 'set' : 'missing'} | Secret:{' '}
                  {paypalAdminConfig?.configured?.clientSecret ? 'set' : 'missing'}
                </div>
                {paypalAdminError && (
                  <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {paypalAdminError}
                  </div>
                )}
              </section>

              <section className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Printful Diagnostics</h3>
                    <p className="text-sm text-gray-600">
                      Quick health check for Printful integration on your admin account.
                    </p>
                  </div>
                  <button
                    onClick={runPrintfulDiagnostics}
                    className="bg-emerald-600 text-white px-5 py-2 rounded-lg font-semibold hover:bg-emerald-700 disabled:opacity-50"
                    disabled={printfulDiagLoading}
                  >
                    {printfulDiagLoading ? 'Checking...' : 'Run Check'}
                  </button>
                </div>

                {printfulDiagError && (
                  <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {printfulDiagError}
                  </div>
                )}

                {printfulDiagnostics ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="rounded-lg border border-gray-200 p-4">
                      <div className="text-xs uppercase text-gray-500">Profile ID</div>
                      <div className="text-sm font-semibold text-gray-900">
                        {printfulDiagnostics.profileId}
                      </div>
                      <div className="mt-3 text-xs uppercase text-gray-500">Integration</div>
                      <div className="text-sm text-gray-900">
                        {printfulDiagnostics.integrationId ? 'Found' : 'Missing'}
                      </div>
                      <div className="mt-2 text-sm text-gray-700">
                        Status: {printfulDiagnostics.status || 'unknown'} � Active:{' '}
                        {printfulDiagnostics.isActive === null
                          ? 'unknown'
                          : printfulDiagnostics.isActive
                            ? 'yes'
                            : 'no'}
                      </div>
                      <div className="mt-2 text-sm text-gray-700">
                        Store ID: {printfulDiagnostics.storeId || 'missing'}
                      </div>
                      <div className="mt-2 text-xs text-gray-500">
                        Connected:{' '}
                        {printfulDiagnostics.connectedAt
                          ? new Date(printfulDiagnostics.connectedAt).toLocaleString()
                          : 'n/a'}
                      </div>
                      <div className="text-xs text-gray-500">
                        Last Sync:{' '}
                        {printfulDiagnostics.lastSync
                          ? new Date(printfulDiagnostics.lastSync).toLocaleString()
                          : 'n/a'}
                      </div>
                    </div>
                    <div className="rounded-lg border border-gray-200 p-4">
                      <div className="text-xs uppercase text-gray-500">Counts</div>
                      <div className="mt-2 text-sm text-gray-700">
                        Products: {printfulDiagnostics.productsCount ?? 'n/a'}
                      </div>
                      <div className="mt-2 text-sm text-gray-700">
                        Variants: {printfulDiagnostics.variantsCount ?? 'n/a'}
                      </div>
                      <div className="mt-2 text-sm text-gray-700">
                        Vendor Orders: {printfulDiagnostics.vendorOrdersCount ?? 'n/a'}
                      </div>
                      {printfulDiagnostics.notes.length > 0 && (
                        <div className="mt-4 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
                          {printfulDiagnostics.notes.join(' ')}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-gray-600">
                    Run the check to see integration status, counts, and any warnings.
                  </div>
                )}
              </section>

              <section className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">API Key Management</h3>
                <input
                  type="text"
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  placeholder="Enter API key..."
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg mb-3 text-base focus:ring-2 focus:ring-amber-400 focus:border-amber-300"
                />
                <button
                  onClick={handleSaveApiKey}
                  className="bg-amber-500 text-white px-5 py-2 rounded-lg font-semibold hover:bg-amber-600"
                >
                  Save API Key
                </button>
                {apiKeyStatus && <div className="mt-3 text-sm text-gray-600">{apiKeyStatus}</div>}
              </section>

              <section className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick User Edit</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                  <input
                    type="text"
                    value={quickEditUserId}
                    onChange={e => setQuickEditUserId(e.target.value)}
                    placeholder="User ID"
                    className="px-4 py-3 border border-gray-200 rounded-lg text-base focus:ring-2 focus:ring-amber-400 focus:border-amber-300"
                  />
                  <input
                    type="text"
                    value={quickEditField}
                    onChange={e => setQuickEditField(e.target.value)}
                    placeholder="Field (e.g. full_name, email)"
                    className="px-4 py-3 border border-gray-200 rounded-lg text-base focus:ring-2 focus:ring-amber-400 focus:border-amber-300"
                  />
                  <input
                    type="text"
                    value={quickEditValue}
                    onChange={e => setQuickEditValue(e.target.value)}
                    placeholder="New value"
                    className="px-4 py-3 border border-gray-200 rounded-lg text-base focus:ring-2 focus:ring-amber-400 focus:border-amber-300"
                  />
                </div>
                <button
                  onClick={handleQuickEdit}
                  className="bg-amber-500 text-white px-5 py-2 rounded-lg font-semibold hover:bg-amber-600"
                >
                  Update User
                </button>
                {quickEditStatus && (
                  <div className="mt-3 text-sm text-gray-600">{quickEditStatus}</div>
                )}
              </section>

              <section className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Admin Tools</h3>
                <div className="flex flex-wrap gap-3">
                  <Link
                    to="/admin/products"
                    className="inline-flex items-center px-5 py-2 rounded-lg bg-gray-900 text-amber-200 font-semibold hover:bg-black transition-colors"
                  >
                    Admin Product Hub
                  </Link>
                  <Link
                    to="/admin/payouts"
                    className="inline-flex items-center px-5 py-2 rounded-lg bg-blue-700 text-white font-semibold hover:bg-blue-800 transition-colors"
                  >
                    PayPal Payouts
                  </Link>
                  <Link
                    to="/admin/users"
                    className="inline-flex items-center px-5 py-2 rounded-lg bg-emerald-700 text-white font-semibold hover:bg-emerald-800 transition-colors"
                  >
                    Admin Users
                  </Link>
                  <Link
                    to="/admin/settings"
                    className="inline-flex items-center px-5 py-2 rounded-lg bg-slate-700 text-white font-semibold hover:bg-slate-800 transition-colors"
                  >
                    Platform Settings
                  </Link>
                  <Link
                    to="/admin/messaging-smoke"
                    className="inline-flex items-center px-5 py-2 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition-colors"
                  >
                    Messaging Smoke Test
                  </Link>
                  <button
                    type="button"
                    onClick={() => setActiveTab('fulfillment')}
                    className="inline-flex items-center px-5 py-2 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition-colors"
                  >
                    Manual Fulfillment Queue
                  </button>
                </div>
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
