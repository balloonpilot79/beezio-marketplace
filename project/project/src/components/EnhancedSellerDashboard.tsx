import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContextMultiRole';
import { supabase } from '../lib/supabase';
import { ensureSellerProductInOrder } from '../utils/sellerProductOrder';
import { testSupabaseConnection } from '../utils/testSupabaseConnection';
import APIIntegrationManager from './APIIntegrationManager';
import StoreCustomization from './StoreCustomization';

import MonetizationHelper from './MonetizationHelper';
import { ExternalLink, TrendingUp, DollarSign, Package, Users, ShoppingCart, BarChart3, CreditCard, AlertTriangle, Star, Truck, Target, Box, Settings, Zap, Bot, CheckCircle, Mail, Upload, FileSpreadsheet } from 'lucide-react';
import StripeSellerDashboard from './StripeSellerDashboard';
import { useNavigate } from 'react-router-dom';
import Papa from 'papaparse';
import { sanitizeDescriptionForDisplay } from '../utils/sanitizeDescription';
import { calculatePricing } from '../utils/pricing';

interface Product {
  id: string;
  title: string;
  description: string;
  price: number;
  stock_quantity?: number;
  commission_rate?: number;
  images: string[];
  videos?: string[];
  sales_count: number;
  total_revenue: number;
}

interface SalesData {
  total_sales: number;
  total_revenue: number;
  total_commissions_paid: number;
  active_subscriptions: number;
  pending_orders: number;
  low_stock_items: number;
  monthly_growth: number;
  avg_order_value: number;
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

interface Customer {
  id: string;
  name: string;
  email: string;
  total_orders: number;
  total_spent: number;
  last_order_date: string;
  location: string;
}

const EnhancedSellerDashboard: React.FC = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [recruiterCode, setRecruiterCode] = useState<string | null>(null);
  const [salesData, setSalesData] = useState<SalesData>({
    total_sales: 0,
    total_revenue: 0,
    total_commissions_paid: 1250.75,
    active_subscriptions: 23,
    pending_orders: 5,
    low_stock_items: 3,
    monthly_growth: 12.5,
    avg_order_value: 42.50
  });
  const [activeTab, setActiveTab] = useState<'overview' | 'products' | 'bulk-upload' | 'orders' | 'fulfillment' | 'inventory' | 'analytics' | 'customers' | 'financials' | 'integrations' | 'store-customization' | 'affiliate-tools' | 'automation'>('overview');
  const [loading, setLoading] = useState(false); // Changed to false to prevent white screen
  const [showProductForm, setShowProductForm] = useState(false);
  const [newProduct, setNewProduct] = useState({
    title: '',
    description: '',
    price: 0,
    category: '',
    affiliate_commission_rate: 10,
    stock_quantity: 1,
    images: [] as string[],
    video_url: '',
    api_integration: {
      enabled: false,
      provider: '' as '' | 'printful' | 'printify' | 'shopify' | 'custom',
      product_id: '',
      webhook_url: ''
    },
    shipping_cost: 0
  });

  // Bulk upload states
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadedProducts, setUploadedProducts] = useState<any[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadResults, setUploadResults] = useState<{ success: number; failed: number; errors: string[] } | null>(null);

  // Fulfillment states
  const [fulfillmentOrders, setFulfillmentOrders] = useState<any[]>([]);
  const [fulfillmentFilter, setFulfillmentFilter] = useState<'all' | 'pending' | 'fulfilled'>('all');
  const [trackingNumber, setTrackingNumber] = useState<{ [key: string]: string }>({});

  const categories = [
    'Electronics', 'Fashion', 'Home & Garden', 'Health & Beauty',
    'Sports & Outdoors', 'Books & Media', 'Toys & Games', 'Food & Beverages',
    'Travel & Experiences', 'Art & Crafts', 'Business & Industrial', 'Automotive', 'Other'
  ];

  useEffect(() => {
    // Always load sample data immediately to prevent loading screen
    console.log('Loading seller dashboard with sample data...');
    setSalesData({
      total_sales: 0,
      total_revenue: 0,
      total_commissions_paid: 1250.75,
      active_subscriptions: 23,
      pending_orders: 5,
      low_stock_items: 3,
      monthly_growth: 12.5,
      avg_order_value: 42.50
    });
    setLoading(false);

    // Try to load real data if user is available
    const initializeDashboard = async () => {
      if (user) {
        try {
          await fetchSellerData();
        } catch (error) {
          console.error('Error fetching seller data:', error);
          // Keep sample data on error
        }
      }
    };

    initializeDashboard();
  }, [user, profile]);

  useEffect(() => {
    if (!user || !profile?.id) return;

    const deterministic = `BZO${String(profile.id).replace(/-/g, '').toUpperCase().slice(0, 12)}`;
    const existing = (profile as any)?.referral_code as string | undefined;
    setRecruiterCode(existing || deterministic);

    // Best-effort: create referral_code once if missing.
    (async () => {
      try {
        await supabase
          .from('profiles')
          .update({ referral_code: deterministic })
          .eq('id', profile.id)
          .is('referral_code', null);
      } catch {
        // non-blocking
      }
    })();
  }, [user, profile?.id]);

  const fetchSellerData = async () => {
    try {
      // Fetch real products from Supabase
      const { data: productsData } = await supabase
        .from('products')
        .select('*')
        .eq('seller_id', profile?.id);

      if (productsData) {
        setProducts(productsData);
      }

      // Initialize formattedOrders variable
      let formattedOrders: any[] = [];

      // Fetch real orders from Supabase - using simplified query for available schema
      const { data: ordersData } = await supabase
        .from('orders')
        .select(`
          id,
          total_amount,
          status,
          created_at,
          order_items!inner(
            product_id,
            quantity,
            price,
            products(title, seller_id)
          )
        `)
        .eq('order_items.products.seller_id', profile?.id)
        .order('created_at', { ascending: false });

      if (ordersData) {
        formattedOrders = ordersData.map(order => ({
          id: order.id,
          customer_name: 'Customer', // Customer name not available in current schema
          customer_email: 'customer@example.com', // Customer email not available in current schema
          product_title: (order.order_items[0]?.products as any)?.title || 'Product',
          amount: order.total_amount,
          status: order.status as 'pending' | 'shipped' | 'delivered' | 'cancelled',
          created_at: order.created_at,
          tracking_number: undefined // Tracking number not available in current schema
        }));
        setOrders(formattedOrders);
      }

      // Fetch customer data from orders - simplified for available schema
      const { data: customerData } = await supabase
        .from('orders')
        .select(`
          id,
          total_amount,
          created_at,
          order_items!inner(
            product_id,
            products(seller_id)
          )
        `)
        .eq('order_items.products.seller_id', profile?.id);

      if (customerData) {
        // Create sample customer data since customer details aren't in current schema
        const sampleCustomers = customerData.slice(0, 5).map((order, index) => ({
          id: `customer_${index + 1}`,
          name: `Customer ${index + 1}`,
          email: `customer${index + 1}@example.com`,
          total_orders: Math.floor(Math.random() * 5) + 1,
          total_spent: order.total_amount,
          last_order_date: order.created_at.split('T')[0],
          location: ['New York', 'California', 'Texas', 'Florida', 'Illinois'][index] || 'Unknown'
        }));
        setCustomers(sampleCustomers);
      }

      // Enhanced sales data
      setSalesData({
        total_sales: productsData?.reduce((sum, p) => sum + (p.sales_count || 0), 0) || 0,
        total_revenue: productsData?.reduce((sum, p) => sum + (p.total_revenue || 0), 0) || 0,
        total_commissions_paid: 1250.75,
        active_subscriptions: 23,
        pending_orders: formattedOrders.filter(o => o.status === 'pending').length,
        low_stock_items: 3,
        monthly_growth: 12.5,
        avg_order_value: 42.50
      });
    } catch (error) {
      console.error('Error fetching seller data:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateAffiliateLink = (productId?: string) => {
    const baseUrl = window.location.origin;
    const affiliateId = 'seller-' + profile?.id;
    if (productId) {
      return `${baseUrl}/product/${productId}?ref=${affiliateId}`;
    }
    return `${baseUrl}?ref=${affiliateId}`;
  };

  const handleTestConnection = async () => {
    console.log('🔍 Testing Supabase connection from Seller Dashboard...');
    const result = await testSupabaseConnection();
    if (result.success) {
      alert('✅ Supabase connection successful! Check console for details.');
    } else {
      alert('❌ Supabase connection failed: ' + result.error);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // You could add a toast notification here
  };

  const generateRecruitAffiliateLink = () => {
    const baseUrl = window.location.origin;
    const code = recruiterCode || profile?.id;
    if (!code) return `${baseUrl}/affiliate-signup?role=affiliate`;
    return `${baseUrl}/affiliate-signup?role=affiliate&recruit=${encodeURIComponent(String(code))}`;
  };

  const handleAddProduct = async () => {
    try {
      setLoading(true);

      const sellerAsk = Number.isFinite(newProduct.price) ? newProduct.price : 0;
      const affiliateRate = Number.isFinite(newProduct.affiliate_commission_rate) ? newProduct.affiliate_commission_rate : 0;
      const stockQuantity = Number.isFinite(newProduct.stock_quantity)
        ? Math.max(0, Math.floor(newProduct.stock_quantity))
        : 0;

      const breakdown = calculatePricing({
        sellerDesiredAmount: sellerAsk,
        affiliateRate,
        affiliateType: 'percentage',
      });

      let categoryId: string | null = null;
      if (newProduct.category && newProduct.category.trim()) {
        try {
          const { data: categoryRow } = await supabase
            .from('categories')
            .select('id')
            .ilike('name', newProduct.category.trim())
            .maybeSingle();
          categoryId = (categoryRow as any)?.id ?? null;
        } catch (_e) {
          categoryId = null;
        }
      }

      const { data: created, error } = await supabase.from('products').insert({
        seller_id: profile?.id,
        title: newProduct.title,
        description: newProduct.description,
        lineage: 'SELLER_DIRECT',
        // Stored listing price (buyer-facing)
        price: breakdown.listingPrice,
        // Seller ask stored explicitly for payout math
        seller_amount: breakdown.sellerAmount,
        seller_ask: breakdown.sellerAmount,
        seller_ask_price: breakdown.sellerAmount,
        // Commission fields used across the app
        affiliate_enabled: true,
        is_promotable: true,
        commission_rate: affiliateRate,
        commission_type: 'percentage',
        flat_commission_amount: 0,
        affiliate_commission_type: 'percent',
        affiliate_commission_value: affiliateRate,
        calculated_customer_price: breakdown.listingPrice,
        // Inventory + media
        stock_quantity: stockQuantity,
        images: Array.isArray(newProduct.images) ? newProduct.images : [],
        videos: newProduct.video_url ? [newProduct.video_url] : [],
        tags: [],
        category_id: categoryId,
        // Shipping
        shipping_cost: Number.isFinite(newProduct.shipping_cost) ? newProduct.shipping_cost : 0,
        // Visibility
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).select('id').single();

      if (error) throw error;
      await ensureSellerProductInOrder({ sellerId: profile?.id, productId: (created as any)?.id });
      alert('Product added successfully!');
      fetchSellerData();
    } catch (error) {
      console.error('Error adding product:', error);
      alert('Failed to add product.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddAffiliateProduct = async (productId: string) => {
    try {
      setLoading(true);
      const { error } = await supabase.from('affiliate_products').insert({
        affiliate_id: profile?.id,
        product_id: productId,
        added_at: new Date().toISOString(),
      });

      if (error) throw error;
      alert('Product added to your store successfully!');
      fetchSellerData();
    } catch (error) {
      console.error('Error adding affiliate product:', error);
      alert('Failed to add product.');
    } finally {
      setLoading(false);
    }
  };

  const ProductForm = () => (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-lg font-bold mb-4">Add New Product</h2>
      <form onSubmit={(e) => {
        e.preventDefault();
        handleAddProduct();
      }}>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700">Title</label>
          <input
            type="text"
            value={newProduct.title}
            onChange={(e) => setNewProduct({ ...newProduct, title: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg"
          />
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700">Description</label>
          <textarea
            value={newProduct.description}
            onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg"
          ></textarea>
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700">Price</label>
          <input
            type="number"
            value={newProduct.price}
            onChange={(e) => setNewProduct({ ...newProduct, price: parseFloat(e.target.value) })}
            className="w-full px-3 py-2 border rounded-lg"
          />
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700">Stock Quantity</label>
          <input
            type="number"
            min={0}
            value={newProduct.stock_quantity}
            onChange={(e) => setNewProduct({ ...newProduct, stock_quantity: parseInt(e.target.value, 10) })}
            className="w-full px-3 py-2 border rounded-lg"
          />
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700">Affiliate Commission Rate (%)</label>
          <input
            type="number"
            value={newProduct.affiliate_commission_rate}
            onChange={(e) => setNewProduct({ ...newProduct, affiliate_commission_rate: parseFloat(e.target.value) })}
            className="w-full px-3 py-2 border rounded-lg"
          />
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700">Shipping Cost</label>
          <input
            type="number"
            value={newProduct.shipping_cost}
            onChange={(e) => setNewProduct({ ...newProduct, shipping_cost: parseFloat(e.target.value) })}
            className="w-full px-3 py-2 border rounded-lg"
          />
        </div>
        <button
          type="submit"
          className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600"
        >
          Add Product
        </button>
      </form>
    </div>
  );

  const ProductSelection = () => (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-lg font-bold mb-4">Select Products to Add</h2>
      <ul>
        {products.map((product) => (
          <li key={product.id} className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-sm font-medium text-gray-900">{product.title}</h3>
              <p className="text-sm text-gray-600">{sanitizeDescriptionForDisplay(product.description, (product as any).lineage)}</p>
            </div>
            <button
              onClick={() => handleAddAffiliateProduct(product.id)}
              className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600"
            >
              Add to My Store
            </button>
          </li>
        ))}
      </ul>
    </div>
  );

  // Show loading only if auth is actually loading
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your seller dashboard...</p>
        </div>
      </div>
    );
  }

  // Auth check for production
  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h2>
          <p className="text-gray-600 mb-4">Please sign in to access the seller dashboard.</p>
          <button className="bg-amber-600 text-white px-4 py-2 rounded-lg hover:bg-amber-700">
            Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Seller Dashboard</h1>
        <p className="text-gray-600">Manage your products, track sales, and grow your business</p>
        <div className="mt-4 grid gap-2 text-sm text-gray-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
          <div className="font-semibold text-amber-800">Quick start</div>
          <div>• Add products from the marketplace to your store (Marketplace → Add to store).</div>
          <div>• Customize your store theme/pages (Store Settings → Customize).</div>
          <div>• Share your store link or referral link to earn; checkout stays on Beezio with platform + Stripe + tax/shipping.</div>
        </div>

        <div className="mt-4 bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Recruit Affiliates</h3>
              <p className="text-sm text-gray-600">Share this link to invite new affiliates. It auto-fills your recruiter code so you get credit.</p>
            </div>
            <button
              onClick={() => copyToClipboard(generateRecruitAffiliateLink())}
              className="bg-amber-600 text-white px-4 py-2 rounded-lg hover:bg-amber-700 flex items-center gap-2"
            >
              <ExternalLink className="w-4 h-4" />
              Copy Link
            </button>
          </div>
          <div className="mt-3">
            <input
              readOnly
              value={generateRecruitAffiliateLink()}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-sm"
            />
          </div>
        </div>
      </div>

      {/* Local Affiliate Support Banner */}
      <div className="bg-orange-100 border-l-4 border-orange-500 text-orange-700 p-4 mb-8 rounded-lg">
        <p className="text-sm font-medium">
          Supporting local affiliates helps keep money within our community. By shopping here, you empower small businesses and affiliates, rather than big-box stores or Amazon.
        </p>
      </div>

      {/* Enhanced Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Revenue</p>
              <p className="text-2xl font-bold text-gray-900">${salesData.total_revenue.toLocaleString()}</p>
              <p className="text-sm text-green-600 mt-1">+{salesData.monthly_growth}% this month</p>
            </div>
            <DollarSign className="w-8 h-8 text-green-600" />
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Sales</p>
              <p className="text-2xl font-bold text-gray-900">{salesData.total_sales}</p>
              <p className="text-sm text-gray-600 mt-1">Avg: ${salesData.avg_order_value}</p>
            </div>
            <TrendingUp className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Pending Orders</p>
              <p className="text-2xl font-bold text-gray-900">{salesData.pending_orders}</p>
              <p className="text-sm text-yellow-600 mt-1">Need attention</p>
            </div>
            <ShoppingCart className="w-8 h-8 text-yellow-600" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Low Stock Items</p>
              <p className="text-2xl font-bold text-gray-900">{salesData.low_stock_items}</p>
              <p className="text-sm text-red-600 mt-1">Restock needed</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-red-600" />
          </div>
        </div>
      </div>

      {/* New Seller Welcome Section - Only show when no products */}
      {products.length === 0 && (
        <div className="bg-gradient-to-r from-green-500 to-blue-600 p-8 rounded-xl shadow-lg text-white mb-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold mb-4">🎉 Welcome to Beezio!</h2>
            <p className="text-xl mb-6 text-green-100">You're now part of our seller community. Let's get your first product listed!</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <button
                onClick={() => navigate('/dashboard/products/add')}
                className="bg-white text-green-600 px-8 py-4 rounded-lg font-bold text-lg hover:bg-green-50 transition-colors flex items-center space-x-3 shadow-lg"
              >
                <Package className="w-6 h-6" />
                <span>Add Your First Product</span>
              </button>
              <p className="text-green-100 text-sm max-w-md">
                Start selling in minutes! Add a product, set your commission rate, and let our affiliate network promote it for you.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="border-b border-gray-200 mb-8">
        <nav className="flex space-x-8 overflow-x-auto">
          {[
            { id: 'overview', label: 'Overview', icon: BarChart3 },
            { id: 'products', label: 'Products', icon: Package },
            { id: 'bulk-upload', label: 'Bulk Upload', icon: Upload },
            { id: 'orders', label: 'Orders', icon: ShoppingCart },
            { id: 'fulfillment', label: 'Orders & Shipping', icon: Truck },
            { id: 'customers', label: 'Customers', icon: Users },
            { id: 'analytics', label: 'Analytics', icon: TrendingUp },
            { id: 'financials', label: 'Financials', icon: CreditCard },
            { id: 'affiliate-tools', label: 'Affiliate Tools', icon: Target },
            { id: 'store-customization', label: 'Custom Store', icon: Settings },
            { id: 'integrations', label: 'Integrations', icon: ExternalLink },
            { id: 'automation', label: 'Automation', icon: Zap }
          ].map((tab) => {
            const IconComponent = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
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

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="space-y-8">
          {/* My Store Section */}
          <div className="bg-gradient-to-r from-orange-500 to-pink-500 p-6 rounded-xl shadow-lg text-white">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-[#ffcb05] mb-2">My Custom Store</h3>
                <p className="text-orange-100 mb-4">Manage your branded storefront and customize your store settings</p>
                <div className="flex space-x-4">
                  <a
                    href={`/store/${user?.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-white text-orange-600 px-4 py-2 rounded-lg font-medium hover:bg-orange-50 transition-colors flex items-center space-x-2"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>View My Store</span>
                  </a>
                  <button
                    onClick={() => setActiveTab('store-customization')}
                    className="bg-orange-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-orange-700 transition-colors flex items-center space-x-2"
                  >
                    <Settings className="w-4 h-4" />
                    <span>Customize Store</span>
                  </button>
                </div>
              </div>
              <div className="text-right">
                <div className="bg-white/20 backdrop-blur-sm p-4 rounded-lg">
                  <p className="text-sm text-orange-100">Store URL:</p>
                  <p className="font-mono text-sm break-all">/store/{user?.id}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <h3 className="text-lg font-semibold mb-4">Recent Orders</h3>
              <div className="space-y-3">
                {orders.slice(0, 5).map((order) => (
                  <div key={order.id} className="flex items-center justify-between py-2">
                    <div>
                      <span className="font-medium text-gray-900">{order.customer_name}</span>
                      <p className="text-sm text-gray-600">{order.product_title}</p>
                    </div>
                    <div className="text-right">
                      <span className="font-medium text-green-600">${order.amount}</span>
                      <p className={`text-xs px-2 py-1 rounded-full ${
                        order.status === 'delivered' ? 'bg-green-100 text-green-800' :
                        order.status === 'shipped' ? 'bg-blue-100 text-blue-800' :
                        order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {order.status}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
              <div className="space-y-3">
                <button 
                  onClick={() => navigate('/dashboard/products/add')}
                  className={`w-full text-left p-3 rounded-lg transition-colors ${
                    products.length === 0 
                      ? 'bg-green-500 text-white hover:bg-green-600 font-bold' 
                      : 'bg-orange-50 hover:bg-orange-100'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <Package className="w-5 h-5 text-current" />
                    <span className="font-medium">
                      {products.length === 0 ? '🚀 Add Your First Product' : 'Add New Product'}
                    </span>
                  </div>
                </button>
                <button 
                  onClick={() => setActiveTab('orders')}
                  className="w-full text-left p-3 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <Truck className="w-5 h-5 text-blue-600" />
                    <span className="font-medium">Process Orders</span>
                  </div>
                </button>
                <button 
                  onClick={() => setActiveTab('analytics')}
                  className="w-full text-left p-3 bg-green-50 hover:bg-green-100 rounded-lg transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <BarChart3 className="w-5 h-5 text-green-600" />
                    <span className="font-medium">View Analytics</span>
                  </div>
                </button>
                <button 
                  onClick={() => setActiveTab('affiliates')}
                  className="w-full text-left p-3 bg-yellow-50 hover:bg-yellow-100 rounded-lg transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <Target className="w-5 h-5 text-yellow-600" />
                    <span className="font-medium">Create Promotion</span>
                  </div>
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold mb-4">Performance Summary</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-2xl font-bold text-gray-900">{customers.length}</p>
                <p className="text-sm text-gray-600">Total Customers</p>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-2xl font-bold text-gray-900">{products.length}</p>
                <p className="text-sm text-gray-600">Active Products</p>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-2xl font-bold text-gray-900">4.8★</p>
                <p className="text-sm text-gray-600">Average Rating</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'products' && (
        <div>
          <button
            onClick={() => navigate('/add-product')}
            className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 mb-4"
          >
            Add New Product
          </button>
          {showProductForm && <ProductForm />}
        </div>
      )}

      {activeTab === 'bulk-upload' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-bold text-gray-900">Bulk Product Upload</h3>
                <p className="text-gray-600 mt-1">Upload hundreds of products at once using CSV files (Excel/Google Sheets compatible)</p>
              </div>
              <FileSpreadsheet className="w-12 h-12 text-orange-600" />
            </div>

            {/* Step 1: Download Template */}
            <div className="mb-8 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h4 className="font-semibold text-blue-900 mb-2">📥 Step 1: Download Template</h4>
              <p className="text-sm text-blue-700 mb-3">Start with our pre-formatted CSV template with all required columns</p>
              <button
                onClick={() => {
                  const template = [
                    {
                      title: 'Example Product',
                      description: 'High quality product description here',
                      price: 29.99,
                      category: 'Electronics',
                      sku: 'PROD-001',
                      stock_quantity: 100,
                      supplier_name: 'Supplier Inc',
                      supplier_product_id: 'SUP-12345',
                      supplier_url: 'https://supplier.com/product/12345',
                      is_dropshipped: 'TRUE',
                      shipping_cost: 5.99,
                      image_url_1: 'https://example.com/image1.jpg',
                      image_url_2: '',
                      image_url_3: '',
                      image_url_4: '',
                      image_url_5: '',
                      affiliate_commission_rate: 20
                    }
                  ];
                  const csv = Papa.unparse(template);
                  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                  const link = document.createElement('a');
                  link.href = URL.createObjectURL(blob);
                  link.download = 'beezio-product-upload-template.csv';
                  link.click();
                }}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
              >
                <Upload className="w-4 h-4" />
                <span>Download CSV Template</span>
              </button>
            </div>

            {/* Step 2: Upload File */}
            <div className="mb-8">
              <h4 className="font-semibold text-gray-900 mb-3">📤 Step 2: Upload Your CSV File</h4>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setUploadFile(file);
                      Papa.parse(file, {
                        header: true,
                        complete: (results) => {
                          setUploadedProducts(results.data.filter((row: any) => row.title));
                        },
                        error: (error) => {
                          alert('Error parsing CSV: ' + error.message);
                        }
                      });
                    }
                  }}
                  className="hidden"
                  id="bulk-upload-file"
                />
                <label
                  htmlFor="bulk-upload-file"
                  className="cursor-pointer inline-flex flex-col items-center"
                >
                  <Upload className="w-12 h-12 text-gray-400 mb-3" />
                  <span className="text-sm font-medium text-gray-700">
                    {uploadFile ? uploadFile.name : 'Click to upload CSV file'}
                  </span>
                  <span className="text-xs text-gray-500 mt-1">CSV files from Excel or Google Sheets</span>
                </label>
              </div>
            </div>

            {/* Step 3: Preview */}
            {uploadedProducts.length > 0 && (
              <div className="mb-8">
                <h4 className="font-semibold text-gray-900 mb-3">👀 Step 3: Preview ({uploadedProducts.length} products)</h4>
                <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left">Title</th>
                        <th className="px-3 py-2 text-left">Price</th>
                        <th className="px-3 py-2 text-left">Category</th>
                        <th className="px-3 py-2 text-left">SKU</th>
                        <th className="px-3 py-2 text-left">Dropshipped</th>
                        <th className="px-3 py-2 text-left">Supplier</th>
                      </tr>
                    </thead>
                    <tbody>
                      {uploadedProducts.slice(0, 10).map((product: any, idx: number) => (
                        <tr key={idx} className="border-t border-gray-200">
                          <td className="px-3 py-2">{product.title}</td>
                          <td className="px-3 py-2">${product.price}</td>
                          <td className="px-3 py-2">{product.category}</td>
                          <td className="px-3 py-2">{product.sku}</td>
                          <td className="px-3 py-2">
                            {product.is_dropshipped === 'TRUE' ? (
                              <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs">Yes</span>
                            ) : (
                              <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded-full text-xs">No</span>
                            )}
                          </td>
                          <td className="px-3 py-2">{product.supplier_name || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {uploadedProducts.length > 10 && (
                    <p className="text-xs text-gray-500 mt-3 text-center">
                      Showing first 10 of {uploadedProducts.length} products
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Step 4: Upload Button */}
            {uploadedProducts.length > 0 && (
              <div className="mb-8">
                <h4 className="font-semibold text-gray-900 mb-3">🚀 Step 4: Upload to Marketplace</h4>
                <button
                  onClick={async () => {
                    setUploadProgress(0);
                    setUploadResults(null);
                    const errors: string[] = [];
                    let successCount = 0;
                    const categoryIdCache = new Map<string, string | null>();

                    for (let i = 0; i < uploadedProducts.length; i++) {
                      const product = uploadedProducts[i];
                      try {
                        const images: string[] = [];
                        for (let j = 1; j <= 5; j++) {
                          const imageUrl = product[`image_url_${j}`];
                          if (imageUrl && imageUrl.trim()) {
                            images.push(imageUrl.trim());
                          }
                        }

                        const supplier_info = product.is_dropshipped === 'TRUE' ? {
                          supplier_name: product.supplier_name || '',
                          supplier_product_id: product.supplier_product_id || '',
                          supplier_url: product.supplier_url || '',
                          is_dropshipped: true
                        } : null;

                        const sellerAsk = Number.isFinite(parseFloat(product.price)) ? parseFloat(product.price) : 0;
                        const affiliateRate = Number.isFinite(parseFloat(product.affiliate_commission_rate))
                          ? parseFloat(product.affiliate_commission_rate)
                          : 10;
                        const stockQuantity = Number.isFinite(parseInt(product.stock_quantity, 10))
                          ? Math.max(0, Math.floor(parseInt(product.stock_quantity, 10)))
                          : 0;

                        const breakdown = calculatePricing({
                          sellerDesiredAmount: sellerAsk,
                          affiliateRate,
                          affiliateType: 'percentage',
                        });

                        const categoryName = (product.category || '').toString().trim();
                        let categoryId: string | null = null;
                        if (categoryName) {
                          if (categoryIdCache.has(categoryName)) {
                            categoryId = categoryIdCache.get(categoryName) ?? null;
                          } else {
                            try {
                              const { data: categoryRow } = await supabase
                                .from('categories')
                                .select('id')
                                .ilike('name', categoryName)
                                .maybeSingle();
                              categoryId = (categoryRow as any)?.id ?? null;
                            } catch (_e) {
                              categoryId = null;
                            }
                            categoryIdCache.set(categoryName, categoryId);
                          }
                        }

                        const { data: created, error } = await supabase.from('products').insert({
                          seller_id: profile?.id,
                          title: product.title,
                          description: product.description,
                          lineage: 'SELLER_DIRECT',
                          // Buyer-facing listing price, computed from seller ask + fees
                          price: breakdown.listingPrice,
                          seller_amount: breakdown.sellerAmount,
                          seller_ask: breakdown.sellerAmount,
                          seller_ask_price: breakdown.sellerAmount,
                          platform_fee: breakdown.platformFee,
                          stripe_fee: breakdown.stripeFee,
                          calculated_customer_price: breakdown.listingPrice,
                          category_id: categoryId,
                          sku: product.sku || null,
                          stock_quantity: stockQuantity,
                          shipping_cost: Number.isFinite(parseFloat(product.shipping_cost)) ? parseFloat(product.shipping_cost) : 0,
                          affiliate_enabled: true,
                          is_promotable: true,
                          commission_rate: affiliateRate,
                          commission_type: 'percentage',
                          flat_commission_amount: 0,
                          affiliate_commission_type: 'percent',
                          affiliate_commission_value: affiliateRate,
                          affiliate_commission_rate: affiliateRate, // legacy/compat
                          images,
                          supplier_info,
                          is_active: true,
                          created_at: new Date().toISOString(),
                          updated_at: new Date().toISOString(),
                        }).select('id').single();

                        if (error) {
                          errors.push(`Row ${i + 1} (${product.title}): ${error.message}`);
                        } else {
                          await ensureSellerProductInOrder({ sellerId: profile?.id, productId: (created as any)?.id });
                          successCount++;
                        }
                      } catch (err: any) {
                        errors.push(`Row ${i + 1} (${product.title}): ${err.message}`);
                      }
                      setUploadProgress(Math.round(((i + 1) / uploadedProducts.length) * 100));
                    }

                    setUploadResults({
                      success: successCount,
                      failed: uploadedProducts.length - successCount,
                      errors
                    });

                    if (successCount > 0) {
                      await fetchSellerData();
                    }
                  }}
                  className="bg-green-600 text-white px-8 py-3 rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2 text-lg font-semibold"
                >
                  <Upload className="w-5 h-5" />
                  <span>Upload All {uploadedProducts.length} Products</span>
                </button>

                {uploadProgress > 0 && uploadProgress < 100 && (
                  <div className="mt-4">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">Uploading...</span>
                      <span className="text-gray-900 font-medium">{uploadProgress}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div
                        className="bg-green-600 h-3 rounded-full transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      ></div>
                    </div>
                  </div>
                )}

                {uploadResults && (
                  <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                    <h5 className="font-semibold text-gray-900 mb-2">Upload Results</h5>
                    <div className="flex items-center space-x-6 mb-3">
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                        <span className="text-green-700 font-medium">{uploadResults.success} Successful</span>
                      </div>
                      {uploadResults.failed > 0 && (
                        <div className="flex items-center space-x-2">
                          <AlertTriangle className="w-5 h-5 text-red-600" />
                          <span className="text-red-700 font-medium">{uploadResults.failed} Failed</span>
                        </div>
                      )}
                    </div>

                    {uploadResults.errors.length > 0 && (
                      <div className="mt-3 max-h-48 overflow-auto">
                        <p className="text-sm font-medium text-red-700 mb-2">Errors:</p>
                        {uploadResults.errors.map((error, idx) => (
                          <p key={idx} className="text-xs text-red-600 mb-1">• {error}</p>
                        ))}
                      </div>
                    )}

                    {uploadResults.success > 0 && (
                      <button
                        onClick={() => setActiveTab('products')}
                        className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm"
                      >
                        View All Products
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Help Section */}
            <div className="mt-8 p-4 bg-orange-50 rounded-lg border border-orange-200">
              <h4 className="font-semibold text-orange-900 mb-2">💡 Tips for Bulk Upload</h4>
              <ul className="text-sm text-orange-700 space-y-1">
                <li>• Start with 10-20 products to test before uploading hundreds</li>
                <li>• Make sure category names match: Electronics, Fashion, Home & Garden, etc.</li>
                <li>• Use HTTPS image URLs from reliable sources</li>
                <li>• Set is_dropshipped to TRUE or FALSE (not Yes/No)</li>
                <li>• For Excel: File → Save As → CSV UTF-8 (Comma delimited)</li>
                <li>• For Google Sheets: File → Download → Comma Separated Values (.csv)</li>
                <li>• All prices should be numbers without $ symbols</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'orders' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Order Management</h3>
            <div className="flex space-x-2">
              <select className="px-3 py-2 border border-gray-300 rounded-lg">
                <option>All Status</option>
                <option>Pending</option>
                <option>Processing</option>
                <option>Shipped</option>
                <option>Delivered</option>
              </select>
              <button className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors">
                Export Orders
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {orders.map((order) => (
                    <tr key={order.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">#{order.id}</td>
                      <td className="px-6 py-4">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{order.customer_name}</p>
                          <p className="text-sm text-gray-600">{order.customer_email}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">{order.product_title}</td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">${order.amount}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          order.status === 'delivered' ? 'bg-green-100 text-green-800' :
                          order.status === 'shipped' ? 'bg-blue-100 text-blue-800' :
                          order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {new Date(order.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex space-x-2">
                          <button className="text-blue-600 hover:text-blue-700 text-sm">View</button>
                          <button className="text-green-600 hover:text-green-700 text-sm">Ship</button>
                          <button className="text-gray-600 hover:text-gray-700 text-sm">Message</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'fulfillment' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-bold text-gray-900">Order Fulfillment</h3>
                <p className="text-gray-600 mt-1">Ship orders and manage dropshipping fulfillment</p>
              </div>
              <Truck className="w-12 h-12 text-orange-600" />
            </div>

            {/* Filter Buttons */}
            <div className="flex space-x-3 mb-6">
              <button
                onClick={() => setFulfillmentFilter('all')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  fulfillmentFilter === 'all'
                    ? 'bg-orange-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All Orders
              </button>
              <button
                onClick={() => setFulfillmentFilter('pending')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  fulfillmentFilter === 'pending'
                    ? 'bg-orange-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Pending Fulfillment
              </button>
              <button
                onClick={() => setFulfillmentFilter('fulfilled')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  fulfillmentFilter === 'fulfilled'
                    ? 'bg-orange-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Fulfilled
              </button>
            </div>

            {/* Orders List */}
            {orders
              .filter(order => {
                if (fulfillmentFilter === 'all') return true;
                if (fulfillmentFilter === 'pending') return order.status === 'pending' || order.status === 'processing';
                if (fulfillmentFilter === 'fulfilled') return order.status === 'shipped' || order.status === 'delivered';
                return true;
              })
              .map((order) => (
                <div key={order.id} className="bg-gray-50 rounded-lg p-6 mb-4 border border-gray-200">
                  {/* Order Header */}
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h4 className="font-semibold text-gray-900">Order #{order.id}</h4>
                      <p className="text-sm text-gray-600">{new Date(order.created_at).toLocaleString()}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      order.status === 'delivered' ? 'bg-green-100 text-green-800' :
                      order.status === 'shipped' ? 'bg-blue-100 text-blue-800' :
                      order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {order.status.toUpperCase()}
                    </span>
                  </div>

                  {/* Customer Info */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div className="bg-white p-3 rounded border border-gray-200">
                      <p className="text-xs text-gray-500 mb-1">Customer</p>
                      <p className="font-medium text-gray-900">{order.customer_name}</p>
                      <p className="text-sm text-gray-600">{order.customer_email}</p>
                    </div>
                    <div className="bg-white p-3 rounded border border-gray-200">
                      <p className="text-xs text-gray-500 mb-1">Shipping Address</p>
                      <p className="text-sm text-gray-700">
                        [Address would be loaded from order_items table]
                      </p>
                    </div>
                  </div>

                  {/* Product Info */}
                  <div className="bg-white p-4 rounded border border-gray-200 mb-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{order.product_title}</p>
                        <p className="text-sm text-gray-600 mt-1">Amount: ${order.amount}</p>
                        
                        {/* Dropshipping Info - Mock for now */}
                        <div className="mt-3 p-3 bg-yellow-50 rounded border border-yellow-200">
                          <p className="text-xs font-semibold text-yellow-900 mb-2">🚚 DROPSHIPPED PRODUCT</p>
                          <div className="text-sm text-yellow-800 space-y-1">
                            <p><strong>Supplier:</strong> Example Supplier Inc</p>
                            <p><strong>Supplier SKU:</strong> SUP-12345</p>
                            <div className="mt-2">
                              <a
                                href="https://supplier.com/product/12345"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center space-x-1 text-blue-600 hover:text-blue-700 font-medium"
                              >
                                <ExternalLink className="w-3 h-3" />
                                <span>Order from Supplier →</span>
                              </a>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Fulfillment Actions */}
                  {order.status !== 'shipped' && order.status !== 'delivered' && (
                    <div className="bg-white p-4 rounded border border-gray-200">
                      <p className="font-medium text-gray-900 mb-3">Mark as Shipped</p>
                      <div className="flex space-x-3">
                        <input
                          type="text"
                          placeholder="Enter tracking number"
                          value={trackingNumber[order.id] || ''}
                          onChange={(e) => setTrackingNumber({ ...trackingNumber, [order.id]: e.target.value })}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                        />
                        <button
                          onClick={async () => {
                            if (!trackingNumber[order.id]) {
                              alert('Please enter a tracking number');
                              return;
                            }
                            
                            const { error } = await supabase
                              .from('orders')
                              .update({
                                status: 'shipped',
                                tracking_number: trackingNumber[order.id],
                                shipped_at: new Date().toISOString()
                              })
                              .eq('id', order.id);

                            if (error) {
                              alert('Error updating order: ' + error.message);
                            } else {
                              alert('Order marked as shipped!');
                              await fetchSellerData();
                              setTrackingNumber({ ...trackingNumber, [order.id]: '' });
                            }
                          }}
                          className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
                        >
                          <Truck className="w-4 h-4" />
                          <span>Mark Shipped</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Tracking Info if shipped */}
                  {order.tracking_number && (
                    <div className="bg-blue-50 p-3 rounded border border-blue-200 mt-3">
                      <p className="text-xs text-blue-700 mb-1">Tracking Number</p>
                      <p className="font-mono text-sm text-blue-900">{order.tracking_number}</p>
                    </div>
                  )}
                </div>
              ))}

            {orders.length === 0 && (
              <div className="text-center py-12">
                <Truck className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No orders to fulfill yet</p>
                <p className="text-sm text-gray-400 mt-1">Orders will appear here when customers make purchases</p>
              </div>
            )}

            {/* Help Section */}
            <div className="mt-6 p-4 bg-orange-50 rounded-lg border border-orange-200">
              <h4 className="font-semibold text-orange-900 mb-2">📦 Fulfillment Process</h4>
              <ol className="text-sm text-orange-700 space-y-1 list-decimal list-inside">
                <li>Order comes in → Customer is charged → You receive email notification</li>
                <li>For dropshipped items: Click "Order from Supplier" link to purchase</li>
                <li>Use customer's shipping address when ordering from supplier</li>
                <li>Supplier ships directly to customer</li>
                <li>Get tracking number from supplier</li>
                <li>Mark order as shipped and enter tracking number</li>
                <li>Customer receives tracking notification automatically</li>
              </ol>
            </div>

            {/* Inventory Management Section */}
            <div className="mt-6 bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Inventory Tracking</h3>
                  <p className="text-gray-600 mt-1">Monitor stock levels for your products</p>
                </div>
                <Box className="w-12 h-12 text-orange-600" />
              </div>
              
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stock</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {products.slice(0, 5).map((product) => {
                      const stock = product.stock_quantity || 0;
                      const status = stock > 10 ? 'In Stock' : stock > 0 ? 'Low Stock' : 'Out of Stock';
                      const statusColor = stock > 10 ? 'text-green-600 bg-green-50' : stock > 0 ? 'text-yellow-600 bg-yellow-50' : 'text-red-600 bg-red-50';
                      
                      return (
                        <tr key={product.id}>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{product.title}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{product.sku || 'N/A'}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{stock} units</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColor}`}>
                              {status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              
              {products.length === 0 && (
                <div className="text-center py-12">
                  <Box className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No products to track</p>
                  <p className="text-sm text-gray-400 mt-1">Add products to see inventory levels</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'analytics' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <h3 className="text-lg font-semibold mb-4">Sales Chart</h3>
              <div className="h-64 bg-gray-50 rounded-lg flex items-center justify-center">
                <p className="text-gray-500">Sales trend visualization would go here</p>
              </div>
            </div>
            
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <h3 className="text-lg font-semibold mb-4">Top Products</h3>
              <div className="space-y-3">
                {products.slice(0, 5).map((product, index) => (
                  <div key={product.id} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <span className="text-sm font-medium text-gray-500">#{index + 1}</span>
                      <span className="text-sm font-medium text-gray-900">{product.title}</span>
                    </div>
                    <span className="text-sm text-gray-600">{product.sales_count || 0} sales</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold mb-4">Geographic Sales</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <p className="font-medium">California</p>
                <p className="text-sm text-gray-600">35% of sales</p>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <p className="font-medium">New York</p>
                <p className="text-sm text-gray-600">28% of sales</p>
              </div>
              <div className="text-center p-4 bg-yellow-50 rounded-lg">
                <p className="font-medium">Texas</p>
                <p className="text-sm text-gray-600">22% of sales</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'customers' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Customer Management</h3>
            <div className="flex space-x-2">
              <input 
                type="text" 
                placeholder="Search customers..." 
                className="px-4 py-2 border border-gray-300 rounded-lg"
              />
              <button className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors">
                Export List
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <h4 className="font-semibold mb-4">Customer Segments</h4>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span>VIP Customers (5+ orders)</span>
                  <span className="bg-gold-100 text-gold-800 px-2 py-1 rounded-full text-sm">12</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Regular Customers (2-4 orders)</span>
                  <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm">28</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>New Customers (1 order)</span>
                  <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-sm">45</span>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <h4 className="font-semibold mb-4">Recent Reviews</h4>
              <div className="space-y-3">
                <div className="border-l-4 border-yellow-400 pl-4">
                  <div className="flex items-center space-x-2">
                    <Star className="w-4 h-4 text-yellow-400 fill-current" />
                    <span className="text-sm font-medium">5.0</span>
                    <span className="text-sm text-gray-600">- John Doe</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">"Excellent product quality!"</p>
                </div>
                <div className="border-l-4 border-yellow-400 pl-4">
                  <div className="flex items-center space-x-2">
                    <Star className="w-4 h-4 text-yellow-400 fill-current" />
                    <span className="text-sm font-medium">4.8</span>
                    <span className="text-sm text-gray-600">- Jane Smith</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">"Fast shipping, great service!"</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h4 className="font-semibold">Customer List</h4>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Location</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Orders</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Spent</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Order</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {customers.map((customer) => (
                    <tr key={customer.id}>
                      <td className="px-6 py-4">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{customer.name}</p>
                          <p className="text-sm text-gray-600">{customer.email}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{customer.location}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">{customer.total_orders}</td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">${customer.total_spent}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{customer.last_order_date}</td>
                      <td className="px-6 py-4">
                        <div className="flex space-x-2">
                          <button className="text-blue-600 hover:text-blue-700 text-sm">View</button>
                          <button className="text-green-600 hover:text-green-700 text-sm">Message</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'financials' && (
        <div className="space-y-6">
          <StripeSellerDashboard />
          
          {/* Additional Financial Metrics */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Fee Breakdown</h3>
              <button className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors">
                Download Statement
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center space-x-2 mb-2">
                  <CreditCard className="w-5 h-5 text-blue-600" />
                  <span className="font-medium">Stripe Processing</span>
                </div>
                <p className="text-2xl font-bold text-blue-600">2.9% + $0.30</p>
                <p className="text-sm text-gray-600">Per transaction</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center space-x-2 mb-2">
                  <Target className="w-5 h-5 text-orange-600" />
                  <span className="font-medium">Platform Fee</span>
                </div>
                <p className="text-2xl font-bold text-orange-600">10%</p>
                <p className="text-sm text-gray-600">Of your selling price</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center space-x-2 mb-2">
                  <Users className="w-5 h-5 text-green-600" />
                  <span className="font-medium">Affiliate Commission</span>
                </div>
                <p className="text-2xl font-bold text-green-600">Variable</p>
                <p className="text-sm text-gray-600">You set the rate</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'integrations' && (
        <div className="space-y-6">
          <MonetizationHelper />
          <APIIntegrationManager />
          
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Database Connection</h3>
              <button 
                onClick={handleTestConnection}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Test Supabase Connection
              </button>
            </div>
            <p className="text-gray-600">Test your database connection and data flow</p>
          </div>
        </div>
      )}

      {activeTab === 'store-customization' && (
        <div className="space-y-6">
          {/* Store Quick Access */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-xl border border-blue-200">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Your Custom Store</h3>
                <p className="text-gray-600 mb-4">Preview and share your personalized storefront</p>
                <a
                  href={`/store/${user?.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>View Live Store</span>
                </a>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600 mb-1">Store URL:</p>
                <code className="bg-white px-3 py-1 rounded text-sm border">/store/{user?.id}</code>
              </div>
            </div>
          </div>
          
          <StoreCustomization userId={profile?.id || ''} role="seller" />
        </div>
      )}

      {activeTab === 'affiliate-tools' && (
        <div>
          <ProductSelection />
        </div>
      )}

      {activeTab === 'automation' && (
        <div className="space-y-8">
          {/* Automation Status Section */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl p-8 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-bold mb-2">Business Automation</h2>
                <p className="text-blue-100 text-lg mb-4">
                  Automate your order fulfillment, shipping, and customer communication processes.
                  <span className="font-bold text-green-300"> Completely FREE - No hidden costs!</span>
                </p>
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="w-5 h-5 text-green-300" />
                    <span className="text-sm">Zero setup fees</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="w-5 h-5 text-green-300" />
                    <span className="text-sm">No monthly charges</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="w-5 h-5 text-green-300" />
                    <span className="text-sm">Free forever</span>
                  </div>
                </div>
              </div>
              <div className="hidden md:block">
                <Bot className="w-24 h-24 text-blue-200 opacity-80" />
              </div>
            </div>
          </div>

          {/* Automation Settings */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Order Automation */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center space-x-3 mb-6">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <ShoppingCart className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Order Processing</h3>
                  <p className="text-sm text-gray-600">Automate order fulfillment and vendor management</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                  <div>
                    <h4 className="font-medium text-gray-900">Auto Order from Vendors</h4>
                    <p className="text-sm text-gray-600">Automatically place orders with your suppliers when customers purchase</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                  <div>
                    <h4 className="font-medium text-gray-900">Auto Payment Processing</h4>
                    <p className="text-sm text-gray-600">Automatically process payments to vendors when orders are fulfilled</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                  <div>
                    <h4 className="font-medium text-gray-900">Inventory Management</h4>
                    <p className="text-sm text-gray-600">Track stock levels and get notified when items need to be reordered</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              </div>
            </div>

            {/* Shipping Automation */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center space-x-3 mb-6">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Truck className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Shipping & Delivery</h3>
                  <p className="text-sm text-gray-600">Automated shipping labels and tracking updates</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                  <div>
                    <h4 className="font-medium text-gray-900">Auto Shipping Labels</h4>
                    <p className="text-sm text-gray-600">Generate and print shipping labels automatically for each order</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                  <div>
                    <h4 className="font-medium text-gray-900">Tracking Updates</h4>
                    <p className="text-sm text-gray-600">Automatically update customers with shipping status and tracking information</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                  <div>
                    <h4 className="font-medium text-gray-900">Delivery Notifications</h4>
                    <p className="text-sm text-gray-600">Send automated notifications when packages are delivered</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Communication Automation */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center space-x-3 mb-6">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Star className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Customer Communication</h3>
                <p className="text-sm text-gray-600">Automated emails and customer notifications</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="text-center p-4 border border-gray-200 rounded-lg">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <CheckCircle className="w-6 h-6 text-blue-600" />
                </div>
                <h4 className="font-medium text-gray-900 mb-1">Order Confirmations</h4>
                <p className="text-xs text-gray-600">Send automatic order confirmation emails to customers</p>
                <label className="relative inline-flex items-center cursor-pointer mt-3">
                  <input type="checkbox" className="sr-only peer" />
                  <div className="w-8 h-4 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              <div className="text-center p-4 border border-gray-200 rounded-lg">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Truck className="w-6 h-6 text-green-600" />
                </div>
                <h4 className="font-medium text-gray-900 mb-1">Shipping Updates</h4>
                <p className="text-xs text-gray-600">Notify customers when their orders ship</p>
                <label className="relative inline-flex items-center cursor-pointer mt-3">
                  <input type="checkbox" className="sr-only peer" />
                  <div className="w-8 h-4 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-green-600"></div>
                </label>
              </div>

              <div className="text-center p-4 border border-gray-200 rounded-lg">
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <CheckCircle className="w-6 h-6 text-purple-600" />
                </div>
                <h4 className="font-medium text-gray-900 mb-1">Delivery Confirmations</h4>
                <p className="text-xs text-gray-600">Confirm successful delivery to customers</p>
                <label className="relative inline-flex items-center cursor-pointer mt-3">
                  <input type="checkbox" className="sr-only peer" />
                  <div className="w-8 h-4 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-purple-600"></div>
                </label>
              </div>

              <div className="text-center p-4 border border-gray-200 rounded-lg">
                <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <DollarSign className="w-6 h-6 text-orange-600" />
                </div>
                <h4 className="font-medium text-gray-900 mb-1">Commission Payments</h4>
                <p className="text-xs text-gray-600">Automatically process affiliate commission payments</p>
                <label className="relative inline-flex items-center cursor-pointer mt-3">
                  <input type="checkbox" className="sr-only peer" />
                  <div className="w-8 h-4 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-orange-600"></div>
                </label>
              </div>
            </div>
          </div>

          {/* Automation Setup Guide */}
          <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-xl p-8">
            <div className="text-center mb-8">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">How Automation Works</h3>
              <p className="text-gray-600 max-w-2xl mx-auto">
                Our automation system streamlines your order fulfillment process by connecting with your vendors,
                shipping providers, and customers automatically.
              </p>
              <div className="mt-4 inline-flex items-center px-4 py-2 bg-green-100 text-green-800 rounded-full text-sm font-semibold">
                <span className="mr-2">🎉</span>
                100% FREE - No Setup Required!
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <ShoppingCart className="w-8 h-8 text-blue-600" />
                </div>
                <h4 className="text-lg font-semibold text-gray-900 mb-2">Order Processing</h4>
                <p className="text-gray-600 text-sm">
                  When a customer places an order, the system automatically forwards the order to your suppliers
                  and processes the necessary payments.
                </p>
              </div>

              <div className="text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Truck className="w-8 h-8 text-green-600" />
                </div>
                <h4 className="text-lg font-semibold text-gray-900 mb-2">Shipping & Tracking</h4>
                <p className="text-gray-600 text-sm">
                  Generate shipping labels automatically and provide customers with real-time tracking
                  information throughout the delivery process.
                </p>
              </div>

              <div className="text-center">
                <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Mail className="w-8 h-8 text-purple-600" />
                </div>
                <h4 className="text-lg font-semibold text-gray-900 mb-2">Customer Communication</h4>
                <p className="text-gray-600 text-sm">
                  Send automated emails to keep customers informed about their order status,
                  shipping updates, and delivery confirmations.
                </p>
              </div>
            </div>

            <div className="text-center mt-8">
              <button className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all transform hover:scale-105">
                🚀 Enable FREE Automation Now
              </button>
              <p className="text-sm text-gray-500 mt-2">No credit card required • Free forever • Cancel anytime</p>
            </div>
          </div>

          {/* Automation Status */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 text-center">
              <div className="text-3xl font-bold text-blue-600 mb-2">--</div>
              <p className="text-sm text-gray-600">Orders Automated</p>
              <p className="text-xs text-gray-500">This month</p>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 text-center">
              <div className="text-3xl font-bold text-green-600 mb-2">--</div>
              <p className="text-sm text-gray-600">Active Automations</p>
              <p className="text-xs text-gray-500">Currently enabled</p>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 text-center">
              <div className="text-3xl font-bold text-purple-600 mb-2">--</div>
              <p className="text-sm text-gray-600">Emails Sent</p>
              <p className="text-xs text-gray-500">This month</p>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 text-center">
              <div className="text-3xl font-bold text-orange-600 mb-2">--</div>
              <p className="text-sm text-gray-600">Time Saved</p>
              <p className="text-xs text-gray-500">Estimated hours</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EnhancedSellerDashboard;
