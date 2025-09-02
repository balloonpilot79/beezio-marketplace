import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContextMultiRole';
import { supabase } from '../lib/supabase';
import UniversalIntegrationsPage from './UniversalIntegrationsPage';
import StripeAffiliateDashboard from './StripeAffiliateDashboard';
import { Copy, ExternalLink, TrendingUp, DollarSign, Users, Calendar, QrCode, Download, Target, BookOpen, MessageSquare, BarChart3, Zap, Award, Lightbulb, Clock, MapPin, Heart, Star, Trophy, Search, ShoppingBag, Settings, Link } from 'lucide-react';

interface AffiliateStats {
  total_earnings: number;
  pending_earnings: number;
  total_sales: number;
  conversion_rate: number;
  active_links: number;
}

interface Commission {
  id: string;
  product_title: string;
  commission_amount: number;
  sale_date: string;
  status: 'pending' | 'paid';
  customer_email: string;
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

const EnhancedAffiliateDashboard: React.FC = () => {
  const { user, profile } = useAuth();
  const isFundraiser = profile?.role === 'fundraiser';
  const [stats, setStats] = useState<AffiliateStats>({
    total_earnings: 0,
    pending_earnings: 0,
    total_sales: 0,
    conversion_rate: 0,
    active_links: 0
  });
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [trafficSources, setTrafficSources] = useState<TrafficSource[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'products' | 'links' | 'qr-codes' | 'analytics' | 'optimization' | 'earnings' | 'community' | 'training' | 'payments' | 'integrations'>('overview');
  const [loading, setLoading] = useState(false); // Changed to false to prevent loading screen
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

  useEffect(() => {
    // Load sample data immediately to prevent loading screen
    loadSampleAffiliateData();
    
    // Try to load real data if user is available
    if (user) {
      fetchAffiliateData();
    }
  }, [user, profile]);

  const loadSampleAffiliateData = () => {
    // Set sample commission data
    setCommissions([
      {
        id: 'comm-1',
        product_title: 'Wireless Headphones',
        commission_amount: 15.99,
        sale_date: '2025-08-12',
        status: 'paid' as 'paid' | 'pending',
        customer_email: 'customer@example.com'
      },
      {
        id: 'comm-2', 
        product_title: 'Coffee Subscription',
        commission_amount: 8.50,
        sale_date: '2025-08-10',
        status: 'pending' as 'paid' | 'pending',
        customer_email: 'buyer@example.com'
      }
    ]);

    // Set sample stats
    setStats({
      total_earnings: 0,
      pending_earnings: 0,
      total_sales: 0,
      conversion_rate: 3.2,
      active_links: 8
    });

    setLoading(false);
  };

  const fetchAffiliateData = async () => {
    try {
      // Fetch real commission data from Supabase
      const { data: commissionsData } = await supabase
        .from('commissions')
        .select(`
          *,
          products(title, price),
          orders(customer_email, customer_name)
        `)
        .eq('affiliate_id', profile?.id)
        .order('created_at', { ascending: false });

      if (commissionsData) {
        const formattedCommissions = commissionsData.map(commission => ({
          id: commission.id,
          product_title: commission.products?.title || 'Unknown Product',
          commission_amount: commission.commission_amount,
          sale_date: commission.created_at.split('T')[0],
          status: commission.status,
          customer_email: commission.orders?.customer_email || 'Unknown'
        }));
        setCommissions(formattedCommissions);

        // Calculate stats from real data
        const totalEarnings = commissionsData
          .filter(c => c.status === 'paid')
          .reduce((sum, c) => sum + c.commission_amount, 0);
        
        const pendingEarnings = commissionsData
          .filter(c => c.status === 'pending')
          .reduce((sum, c) => sum + c.commission_amount, 0);

        setStats({
          total_earnings: totalEarnings,
          pending_earnings: pendingEarnings,
          total_sales: commissionsData.length,
          conversion_rate: 3.2, // Could be calculated from clicks/sales data
          active_links: 12 // Could be fetched from affiliate_links table
        });
      }

      // Fetch available products for promotion
      const { data: productsData } = await supabase
        .from('products')
        .select(`
          *,
          profiles(full_name)
        `)
        .eq('is_active', true)
        .limit(20);

      if (productsData) {
        const formattedProducts = productsData.map(product => ({
          id: product.id,
          title: product.title,
          description: product.description,
          price: product.subscription_price || product.price,
          commission_rate: product.commission_rate,
          commission_type: product.commission_type,
          category: product.category,
          seller_name: product.profiles?.full_name || 'Unknown Seller',
          image_url: product.images?.[0] || '/api/placeholder/300/200'
        }));
        setProducts(formattedProducts);
      }

      // Mock traffic sources (could be fetched from analytics table)
      setTrafficSources([
        { source: 'Social Media', clicks: 450, conversions: 18, earnings: 245.67 },
        { source: 'Email Marketing', clicks: 320, conversions: 15, earnings: 189.45 },
        { source: 'Direct/QR Codes', clicks: 180, conversions: 8, earnings: 156.89 },
        { source: 'Blog/Content', clicks: 295, conversions: 12, earnings: 198.76 }
      ]);
    } catch (error) {
      console.error('Error fetching affiliate data:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateAffiliateLink = (productId?: string) => {
    const baseUrl = window.location.origin;
    const affiliateId = profile?.id;
    if (productId) {
      return `${baseUrl}/product/${productId}?ref=${affiliateId}`;
    }
    return `${baseUrl}?ref=${affiliateId}`;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const generateSiteWideLink = () => {
    const baseUrl = window.location.origin;
    const affiliateId = profile?.id;
    return `${baseUrl}/marketplace?ref=${affiliateId}`;
  };

  const generateQRCode = (url: string) => {
    // Using QR Server API for QR code generation
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}`;
  };

  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          {isFundraiser ? 'Fundraiser Dashboard' : 'Affiliate Dashboard'}
        </h1>
        <p className="text-gray-600">
          {isFundraiser 
            ? 'Raise money for your cause by promoting products - all commissions go to your fundraising goal!'
            : 'Track your earnings and manage your affiliate links'
          }
        </p>
      </div>

      {/* Enhanced Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">
                {isFundraiser ? 'Total Raised' : 'Total Earnings'}
              </p>
              <p className="text-2xl font-bold text-gray-900">${stats.total_earnings.toLocaleString()}</p>
              <p className="text-sm text-green-600 mt-1">+12.5% this month</p>
            </div>
            <DollarSign className="w-8 h-8 text-green-600" />
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">
                {isFundraiser ? 'Pending Donations' : 'Pending Earnings'}
              </p>
              <p className="text-2xl font-bold text-gray-900">${stats.pending_earnings.toLocaleString()}</p>
              <p className="text-sm text-yellow-600 mt-1">Next payout: Aug 15</p>
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
                {isFundraiser ? 'Active Campaigns' : 'Active Campaigns'}
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
          <span className="text-blue-800 font-medium">Next Payment: Every 2 weeks on Fridays</span>
        </div>
        <p className="text-blue-700 text-sm mt-1">Pending earnings will be paid on the next payment cycle.</p>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-gray-200 mb-8">
        <nav className="flex space-x-6 overflow-x-auto">
          {[
            { id: 'overview', label: 'Overview', icon: BarChart3 },
            { id: 'products', label: 'Browse Products', icon: Target },
            { id: 'links', label: 'My Links', icon: ExternalLink },
            { id: 'qr-codes', label: 'QR Codes', icon: QrCode },
            { id: 'analytics', label: 'Analytics', icon: TrendingUp },
            { id: 'integrations', label: 'Integrations', icon: Settings },
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
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="space-y-8">
          {/* My Affiliate Store Section */}
          <div className="bg-gradient-to-r from-purple-500 to-blue-500 p-6 rounded-xl shadow-lg text-white">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold mb-2">My Affiliate Store</h3>
                <p className="text-purple-100 mb-4">Share your personalized store link to earn commissions on every sale</p>
                <div className="flex space-x-4">
                  <a
                    href={`/affiliate/${user?.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-white text-purple-600 px-4 py-2 rounded-lg font-medium hover:bg-purple-50 transition-colors flex items-center space-x-2"
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
                </div>
              </div>
              <div className="text-right">
                <div className="bg-white/20 backdrop-blur-sm p-4 rounded-lg">
                  <p className="text-sm text-purple-100">Store URL:</p>
                  <p className="font-mono text-sm break-all">/affiliate/{user?.id}</p>
                </div>
              </div>
            </div>
          </div>

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
                  onClick={() => setActiveTab('products')}
                  className="w-full text-left p-3 bg-orange-50 hover:bg-orange-100 rounded-lg transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <ShoppingBag className="w-5 h-5 text-orange-600" />
                    <span className="font-medium">
                      {isFundraiser ? 'Browse Products for Your Cause' : 'Browse Products to Promote'}
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
                      {isFundraiser ? 'My Fundraising Links' : 'My Affiliate Links'}
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
        </div>
      )}

      {activeTab === 'products' && (
        <div className="space-y-6">
          {/* Product Search and Filters */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold mb-4">
              {isFundraiser ? '� Browse Products for Your Cause' : '�🛍️ Browse Products to Promote'}
            </h3>
            <p className="text-gray-600 mb-6">
              {isFundraiser 
                ? 'Discover products that align with your cause - all commissions go directly to your fundraising goal!'
                : 'Discover products that match your audience and earn up to 50% commission on every sale!'
              }
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
                    {isFundraiser ? '💝 Promote Platform for Your Cause' : '🌐 Promote Entire Platform'}
                  </h4>
                  <p className="text-gray-600 mb-4">
                    {isFundraiser 
                      ? 'Get donations from ALL purchases made through your referral link. Perfect for raising money while providing value to supporters!'
                      : 'Get commission on ALL purchases made through your referral link based on each product\'s individual commission rate set by sellers. Perfect for promoting Beezio as a whole marketplace!'
                    }
                  </p>
                  <div className="flex items-center space-x-4 text-sm">
                    <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full font-medium">
                      {isFundraiser ? 'Donation Rate Varies' : 'Commission Rate Varies by Product'}
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
                    <span>{isFundraiser ? 'Copy Fundraising Link' : 'Copy Site Link'}</span>
                  </button>
                  <button
                    onClick={() => copyToClipboard(generateSiteWideLink())}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>{isFundraiser ? 'Share for Donations' : 'Share Platform'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Product Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {products
              .filter(product => {
                const matchesSearch = !productFilter.searchTerm || 
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
              })
              .map((product) => (
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
                    
                    <div className="flex space-x-2">
                      <button
                        onClick={() => {
                          setSelectedProduct(product.id);
                          setActiveTab('links');
                        }}
                        className="flex-1 bg-orange-600 text-white py-2 px-3 rounded-lg hover:bg-orange-700 transition-colors text-sm font-medium"
                      >
                        🚀 Start Promoting
                      </button>
                    </div>
                  </div>
                </div>
              ))}
          </div>
          
          {/* No Results */}
          {products.filter(product => {
            const matchesSearch = !productFilter.searchTerm || 
              product.title.toLowerCase().includes(productFilter.searchTerm.toLowerCase()) ||
              product.description.toLowerCase().includes(productFilter.searchTerm.toLowerCase());
            const matchesCategory = !productFilter.category || product.category === productFilter.category;
            const matchesCommission = product.commission_rate >= productFilter.minCommission;
            return matchesSearch && matchesCategory && matchesCommission;
          }).length === 0 && (
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
      )}

      {activeTab === 'links' && (
        <div className="space-y-6">
          {/* Quick Action to Browse More Products */}
          <div className="bg-gradient-to-r from-blue-50 to-yellow-50 p-4 rounded-xl border border-blue-200">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-blue-900">Want to promote more products?</h3>
                <p className="text-blue-700 text-sm">Browse our product catalog and find high-converting items to promote.</p>
              </div>
              <button
                onClick={() => setActiveTab('products')}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium whitespace-nowrap"
              >
                🛍️ Browse Products
              </button>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold mb-4">Site-Wide Affiliate Link</h3>
            <p className="text-gray-600 mb-4">Use this link to earn commission on any product sold through your referral based on each seller's individual commission rate</p>
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={generateAffiliateLink()}
                readOnly
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
              />
              <button
                onClick={() => copyToClipboard(generateAffiliateLink())}
                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
              >
                <Copy className="w-4 h-4" />
              </button>
              <button
                onClick={() => setActiveTab('qr-codes')}
                className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
              >
                <QrCode className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">My Promoted Products ({products.length})</h3>
              <button
                onClick={() => setActiveTab('products')}
                className="text-blue-600 hover:text-blue-700 text-sm font-medium"
              >
                + Add More Products
              </button>
            </div>
            <p className="text-gray-600 mb-4">Create specific links for individual products with higher conversion rates</p>
            
            {products.length === 0 ? (
              <div className="text-center py-8">
                <ShoppingBag className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h4 className="font-semibold text-gray-900 mb-2">No products selected yet</h4>
                <p className="text-gray-600 mb-4">Browse our product catalog and start promoting products to earn commissions.</p>
                <button
                  onClick={() => setActiveTab('products')}
                  className="bg-orange-600 text-white px-6 py-2 rounded-lg hover:bg-orange-700 transition-colors"
                >
                  Browse Products to Promote
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {products.map((product) => (
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
                    src={generateQRCode(generateAffiliateLink())} 
                    alt="Site-wide QR Code" 
                    className="mx-auto mb-4"
                  />
                  <p className="text-sm text-gray-600 mb-4">Scan to visit your affiliate store</p>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => {
                        const qrUrl = generateQRCode(generateAffiliateLink());
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
                      onClick={() => copyToClipboard(generateAffiliateLink())}
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
                  {products.map((product) => (
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
            <h3 className="text-lg font-semibold mb-4 text-orange-900">⚡ AI-Powered Recommendations</h3>
            <div className="space-y-4">
              <div className="bg-white p-4 rounded-lg border border-orange-200">
                <div className="flex items-start space-x-3">
                  <Lightbulb className="w-5 h-5 text-orange-600 mt-1" />
                  <div>
                    <h4 className="font-medium text-orange-900">Promote Business Coaching Sessions</h4>
                    <p className="text-sm text-orange-800 mt-1">Based on your audience's interests in business content, this product has a 78% higher conversion potential for you.</p>
                    <button className="mt-2 text-orange-600 text-sm hover:underline">View Product →</button>
                  </div>
                </div>
              </div>
              <div className="bg-white p-4 rounded-lg border border-orange-200">
                <div className="flex items-start space-x-3">
                  <TrendingUp className="w-5 h-5 text-orange-600 mt-1" />
                  <div>
                    <h4 className="font-medium text-orange-900">Optimize Posting Time</h4>
                    <p className="text-sm text-orange-800 mt-1">Your audience is most active on Tuesdays at 2 PM. Schedule your next promotion for maximum reach.</p>
                    <button className="mt-2 text-orange-600 text-sm hover:underline">Schedule Post →</button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <h3 className="text-lg font-semibold mb-4">🎯 Audience Matching</h3>
              <p className="text-gray-600 mb-4">Products perfectly matched to your audience demographics</p>
              <div className="space-y-3">
                {products.slice(0, 2).map((product) => (
                  <div key={product.id} className="p-3 border border-gray-200 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">{product.title}</h4>
                        <p className="text-sm text-gray-600">Match Score: 94%</p>
                      </div>
                      <div className="text-right">
                        <p className="text-green-600 font-medium">
                          {product.commission_type === 'percentage' ? `${product.commission_rate}%` : `$${product.commission_rate}`}
                        </p>
                        <button className="text-blue-600 text-sm hover:underline">Promote</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <h3 className="text-lg font-semibold mb-4">📊 Conversion Funnel</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                  <span>Link Clicks</span>
                  <span className="font-bold">1,245</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                  <span>Product Views</span>
                  <span className="font-bold">987 (79%)</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                  <span>Add to Cart</span>
                  <span className="font-bold">156 (16%)</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                  <span>Purchases</span>
                  <span className="font-bold">45 (29%)</span>
                </div>
              </div>
              <div className="mt-4 p-3 bg-red-50 rounded-lg">
                <p className="text-sm text-red-800">
                  <strong>Improvement Opportunity:</strong> 841 people viewed the product but didn't add to cart. Consider promoting urgency or limited-time offers.
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
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-6 rounded-xl border border-green-200">
              <h3 className="text-lg font-semibold mb-4 text-green-900">💰 Earnings Forecast</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-green-800">This Month (Projected):</span>
                  <span className="font-bold text-green-900">$1,234</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-green-800">Next Month (Forecast):</span>
                  <span className="font-bold text-green-900">$1,456</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-green-800">Annual Projection:</span>
                  <span className="font-bold text-green-900">$15,678</span>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-r from-yellow-50 to-violet-50 p-6 rounded-xl border border-yellow-200">
              <h3 className="text-lg font-semibold mb-4 text-yellow-900">🏆 Tier Progression</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-yellow-800">Current Tier:</span>
                  <span className="font-bold text-yellow-900">Silver</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-yellow-800">Next Tier:</span>
                  <span className="font-bold text-yellow-900">Gold</span>
                </div>
                <div className="w-full bg-yellow-200 rounded-full h-2 mt-2">
                  <div className="bg-yellow-600 h-2 rounded-full" style={{width: '75%'}}></div>
                </div>
                <p className="text-xs text-yellow-800">$500 more to unlock Gold tier (30% higher commissions!)</p>
              </div>
            </div>

            <div className="bg-gradient-to-r from-blue-50 to-cyan-50 p-6 rounded-xl border border-blue-200">
              <h3 className="text-lg font-semibold mb-4 text-blue-900">🎁 Bonus Opportunities</h3>
              <div className="space-y-2">
                <div className="p-2 bg-white rounded border border-blue-200">
                  <p className="text-sm font-medium text-blue-900">Weekend Special</p>
                  <p className="text-xs text-blue-800">Double commissions on courses</p>
                </div>
                <div className="p-2 bg-white rounded border border-blue-200">
                  <p className="text-sm font-medium text-blue-900">New Product Launch</p>
                  <p className="text-xs text-blue-800">50% bonus for first 10 sales</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold mb-4">💎 Recurring Commission Tracking</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Monthly Commission</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Earned</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  <tr>
                    <td className="px-4 py-4 text-sm font-medium text-gray-900">SaaS Tool Pro</td>
                    <td className="px-4 py-4 text-sm text-gray-600">john@example.com</td>
                    <td className="px-4 py-4 text-sm text-green-600 font-medium">$15.00</td>
                    <td className="px-4 py-4 text-sm text-gray-900">$180.00</td>
                    <td className="px-4 py-4"><span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs">Active</span></td>
                  </tr>
                  <tr>
                    <td className="px-4 py-4 text-sm font-medium text-gray-900">Business Suite</td>
                    <td className="px-4 py-4 text-sm text-gray-600">jane@company.com</td>
                    <td className="px-4 py-4 text-sm text-green-600 font-medium">$25.00</td>
                    <td className="px-4 py-4 text-sm text-gray-900">$75.00</td>
                    <td className="px-4 py-4"><span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs">Active</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold mb-4">📊 Earnings Breakdown</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium mb-3">By Product Category</h4>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Education</span>
                    <span className="font-medium">$856.43 (45%)</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Software</span>
                    <span className="font-medium">$654.32 (34%)</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Consulting</span>
                    <span className="font-medium">$402.15 (21%)</span>
                  </div>
                </div>
              </div>
              <div>
                <h4 className="font-medium mb-3">Monthly Trend</h4>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">July 2025</span>
                    <span className="font-medium text-green-600">$1,234.56</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">June 2025</span>
                    <span className="font-medium">$1,098.43</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">May 2025</span>
                    <span className="font-medium">$987.21</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'community' && (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-indigo-50 to-yellow-50 p-6 rounded-xl border border-indigo-200">
            <h3 className="text-lg font-semibold mb-4 text-indigo-900">🤝 Affiliate Community Hub</h3>
            <p className="text-indigo-800 mb-4">Connect with 2,500+ successful affiliates, share strategies, and grow together!</p>
            <div className="flex space-x-3">
              <button className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors">
                <MessageSquare className="w-4 h-4 inline mr-2" />
                Join Community Chat
              </button>
              <button className="bg-white text-indigo-600 border border-indigo-300 px-4 py-2 rounded-lg hover:bg-indigo-50 transition-colors">
                View Leaderboard
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <h3 className="text-lg font-semibold mb-4">🏆 Top Performers This Month</h3>
              <div className="space-y-3">
                {[
                  { name: 'Sarah M.', earnings: '$4,567', badge: '🥇' },
                  { name: 'Mike R.', earnings: '$3,234', badge: '🥈' },
                  { name: 'Lisa K.', earnings: '$2,891', badge: '🥉' },
                  { name: 'You', earnings: '$1,234', badge: '#47' }
                ].map((affiliate, index) => (
                  <div key={index} className={`flex items-center justify-between p-3 rounded-lg ${
                    affiliate.name === 'You' ? 'bg-yellow-50 border border-yellow-200' : 'bg-gray-50'
                  }`}>
                    <div className="flex items-center space-x-3">
                      <span className="text-lg">{affiliate.badge}</span>
                      <span className={`font-medium ${affiliate.name === 'You' ? 'text-yellow-800' : 'text-gray-900'}`}>
                        {affiliate.name}
                      </span>
                    </div>
                    <span className={`font-bold ${affiliate.name === 'You' ? 'text-yellow-600' : 'text-green-600'}`}>
                      {affiliate.earnings}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <h3 className="text-lg font-semibold mb-4">💬 Recent Community Posts</h3>
              <div className="space-y-4">
                <div className="border-l-4 border-blue-400 pl-4">
                  <p className="font-medium text-gray-900">Marketing Tips That Work</p>
                  <p className="text-sm text-gray-600 mt-1">"Just tried the Instagram Stories strategy and got 40% more clicks!" - Alex T.</p>
                  <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                    <span>❤️ 23 likes</span>
                    <span>💬 8 replies</span>
                  </div>
                </div>
                <div className="border-l-4 border-green-400 pl-4">
                  <p className="font-medium text-gray-900">Success Story</p>
                  <p className="text-sm text-gray-600 mt-1">"Hit my first $5K month thanks to the email templates!" - Rachel D.</p>
                  <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                    <span>❤️ 45 likes</span>
                    <span>💬 12 replies</span>
                  </div>
                </div>
              </div>
              <button className="w-full mt-4 bg-gray-100 text-gray-700 py-2 rounded-lg hover:bg-gray-200 transition-colors">
                View All Posts
              </button>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold mb-4">🎯 Mentorship Program</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-4 border border-gray-200 rounded-lg">
                <h4 className="font-medium mb-2">Get a Mentor</h4>
                <p className="text-sm text-gray-600 mb-3">Learn from top-performing affiliates who earn $10K+ monthly</p>
                <div className="flex items-center space-x-2 mb-3">
                  <Star className="w-4 h-4 text-yellow-400 fill-current" />
                  <span className="text-sm">4.9/5 rating from mentees</span>
                </div>
                <button className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors">
                  Find a Mentor
                </button>
              </div>
              <div className="p-4 border border-gray-200 rounded-lg">
                <h4 className="font-medium mb-2">Become a Mentor</h4>
                <p className="text-sm text-gray-600 mb-3">Share your expertise and earn extra income helping others</p>
                <div className="flex items-center space-x-2 mb-3">
                  <DollarSign className="w-4 h-4 text-green-400" />
                  <span className="text-sm">Earn $50-200 per mentee monthly</span>
                </div>
                <button className="w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition-colors">
                  Apply to Mentor
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'training' && (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-emerald-50 to-teal-50 p-6 rounded-xl border border-emerald-200">
            <h3 className="text-lg font-semibold mb-4 text-emerald-900">🎓 Affiliate Training Center</h3>
            <p className="text-emerald-800 mb-4">Master affiliate marketing with our comprehensive training program. From beginner to expert!</p>
            <div className="flex space-x-3">
              <button className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors">
                Start Learning
              </button>
              <button className="bg-white text-emerald-600 border border-emerald-300 px-4 py-2 rounded-lg hover:bg-emerald-50 transition-colors">
                View Progress
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                title: 'Affiliate Marketing Fundamentals',
                level: 'Beginner',
                duration: '2 hours',
                progress: 100,
                icon: '📚',
                status: 'Completed'
              },
              {
                title: 'Advanced Conversion Strategies',
                level: 'Intermediate',  
                duration: '3 hours',
                progress: 65,
                icon: '🎯',
                status: 'In Progress'
              },
              {
                title: 'Social Media Marketing Mastery',
                level: 'Advanced',
                duration: '4 hours',
                progress: 0,
                icon: '📱',
                status: 'Not Started'
              },
              {
                title: 'Email Marketing for Affiliates',
                level: 'Intermediate',
                duration: '2.5 hours',
                progress: 30,
                icon: '📧',
                status: 'In Progress'
              },
              {
                title: 'Content Creation & SEO',
                level: 'Advanced',
                duration: '5 hours',
                progress: 0,
                icon: '✍️',
                status: 'Not Started'
              },
              {
                title: 'Analytics & Optimization',
                level: 'Expert',
                duration: '3.5 hours',
                progress: 0,
                icon: '📊',
                status: 'Locked'
              }
            ].map((course, index) => (
              <div key={index} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-2xl">{course.icon}</span>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    course.level === 'Beginner' ? 'bg-green-100 text-green-800' :
                    course.level === 'Intermediate' ? 'bg-blue-100 text-blue-800' :
                    course.level === 'Advanced' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {course.level}
                  </span>
                </div>
                <h4 className="font-medium mb-2">{course.title}</h4>
                <p className="text-sm text-gray-600 mb-3">{course.duration}</p>
                
                <div className="mb-3">
                  <div className="flex justify-between text-sm mb-1">
                    <span>Progress</span>
                    <span>{course.progress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full ${
                        course.progress === 100 ? 'bg-green-600' :
                        course.progress > 0 ? 'bg-blue-600' : 'bg-gray-300'
                      }`}
                      style={{width: `${course.progress}%`}}
                    ></div>
                  </div>
                </div>

                <button 
                  className={`w-full py-2 rounded-lg transition-colors ${
                    course.status === 'Completed' ? 'bg-green-100 text-green-800' :
                    course.status === 'In Progress' ? 'bg-blue-600 text-white hover:bg-blue-700' :
                    course.status === 'Locked' ? 'bg-gray-100 text-gray-400 cursor-not-allowed' :
                    'bg-gray-600 text-white hover:bg-gray-700'
                  }`}
                  disabled={course.status === 'Locked'}
                >
                  {course.status === 'Completed' ? '✓ Completed' :
                   course.status === 'In Progress' ? 'Continue' :
                   course.status === 'Locked' ? '🔒 Locked' : 'Start Course'}
                </button>
              </div>
            ))}
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold mb-4">📅 Upcoming Live Training</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                <div>
                  <h4 className="font-medium">Advanced Facebook Ads for Affiliates</h4>
                  <p className="text-sm text-gray-600 mt-1">Learn to create high-converting Facebook ad campaigns</p>
                  <p className="text-sm text-blue-600 mt-1">August 5, 2025 at 2:00 PM EST</p>
                </div>
                <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap">
                  Register Free
                </button>
              </div>
              <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                <div>
                  <h4 className="font-medium">Email Marketing Automation Workshop</h4>
                  <p className="text-sm text-gray-600 mt-1">Build automated email sequences that convert</p>
                  <p className="text-sm text-blue-600 mt-1">August 12, 2025 at 3:00 PM EST</p>
                </div>
                <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap">
                  Register Free
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold mb-4">🏆 Achievements & Certifications</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                <Trophy className="w-8 h-8 text-yellow-600 mx-auto mb-2" />
                <h4 className="font-medium text-yellow-900">Marketing Fundamentals</h4>
                <p className="text-sm text-yellow-800">Certified</p>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg border border-gray-200">
                <Award className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <h4 className="font-medium text-gray-600">Conversion Specialist</h4>
                <p className="text-sm text-gray-500">In Progress</p>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg border border-gray-200">
                <Star className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <h4 className="font-medium text-gray-600">Expert Marketer</h4>
                <p className="text-sm text-gray-500">Locked</p>
              </div>
            </div>
          </div>
        </div>
      )}
      {activeTab === 'payments' && (
        <StripeAffiliateDashboard />
      )}
    </div>
  );
};

export default EnhancedAffiliateDashboard;
