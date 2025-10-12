import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContextMultiRole';
import { supabase } from '../lib/supabase';
import { Package, Heart, Star, Calendar, Truck, Gift, MessageSquare, Download, RefreshCw, Shield, Award, Bell, Users, Zap, BookOpen, TrendingUp, HelpCircle, Clock, Filter, Search, TrendingDown, DollarSign, UserMinus, Plus, X, ThumbsUp, CheckCircle, Mail, ShoppingBag } from 'lucide-react';

interface Order {
  id: string;
  product_title: string;
  amount: number;
  status: 'pending' | 'shipped' | 'delivered' | 'cancelled';
  order_date: string;
  tracking_number?: string;
}

interface Subscription {
  id: string;
  product_title: string;
  amount: number;
  status: 'active' | 'cancelled' | 'paused';
  next_billing_date: string;
  billing_cycle: 'monthly' | 'yearly';
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

interface Reward {
  id: string;
  title: string;
  description: string;
  points_required: number;
  type: 'discount' | 'product' | 'exclusive';
  value: string;
  available: boolean;
  discount_percent?: number;
  expires_at?: string;
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

const EnhancedBuyerDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [wishlist, setWishlist] = useState<WishlistItem[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [followedAffiliates, setFollowedAffiliates] = useState<Affiliate[]>([]);
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'orders' | 'purchases' | 'subscriptions' | 'wishlist' | 'recommendations' | 'affiliates' | 'rewards' | 'watchlist' | 'community' | 'support' | 'reviews'>('overview');
  const [loading, setLoading] = useState(false); // Changed to false to prevent loading screen
  const [loyaltyPoints, setLoyaltyPoints] = useState(150); // Default points

  useEffect(() => {
    // Load sample data immediately to prevent white screen
    loadSampleData();
    
    // If user/profile available, try to load real data
    if (user) {
      fetchBuyerData();
    }
  }, [user, profile]);

  const loadSampleData = () => {
    // Set sample orders
    setOrders([
      {
        id: 'sample-1',
        product_title: 'Wireless Headphones',
        amount: 89.99,
        status: 'delivered',
        order_date: '2025-08-10',
        tracking_number: 'TRK123456'
      },
      {
        id: 'sample-2', 
        product_title: 'Coffee Mug',
        amount: 34.50,
        status: 'shipped',
        order_date: '2025-08-05',
        tracking_number: 'TRK789012'
      }
    ]);
    
    // Set sample subscriptions
    setSubscriptions([
      {
        id: 'sub-1',
        product_title: 'Premium Coffee Subscription',
        amount: 19.99,
        status: 'active',
        next_billing_date: '2025-09-15',
        billing_cycle: 'monthly'
      }
    ]);
    
    setLoading(false);
  };

  const fetchBuyerData = async () => {
    try {
      // Fetch real orders from Supabase
      const { data: ordersData } = await supabase
        .from('orders')
        .select(`
          *,
          order_items(
            *,
            products(title)
          )
        `)
        .eq('customer_email', profile?.email)
        .order('created_at', { ascending: false });

      if (ordersData) {
        const formattedOrders = ordersData.map(order => ({
          id: order.id,
          product_title: order.order_items?.[0]?.products?.title || 'Product',
          amount: order.total_amount,
          status: order.status as 'pending' | 'shipped' | 'delivered' | 'cancelled',
          order_date: order.created_at.split('T')[0],
          tracking_number: order.tracking_number
        }));
        setOrders(formattedOrders);
      }

      // Fetch real subscriptions from Supabase
      const { data: subscriptionsData } = await supabase
        .from('subscriptions')
        .select(`
          *,
          products(title, subscription_price, subscription_interval)
        `)
        .eq('customer_id', profile?.id)
        .eq('status', 'active');

      if (subscriptionsData) {
        const formattedSubscriptions = subscriptionsData.map(sub => ({
          id: sub.id,
          product_title: sub.products?.title || 'Subscription',
          amount: sub.products?.subscription_price || 0,
          status: sub.status as 'active' | 'cancelled' | 'paused',
          next_billing_date: sub.next_billing_date,
          billing_cycle: sub.products?.subscription_interval || 'monthly'
        }));
        setSubscriptions(formattedSubscriptions);
      }

      // Fetch buyer's purchases with affiliate information
      // Simplified query to avoid complex foreign key relationships
      const { data: purchasesData } = await supabase
        .from('order_items')
        .select(`
          *,
          products(title, images, price)
        `)
        .limit(10); // Limit for performance

      // Alternative: Query through orders first for better compatibility
      const { data: ordersPurchasesData } = await supabase
        .from('orders')
        .select(`
          *,
          order_items(
            *,
            products(title, images, price)
          )
        `)
        .eq('customer_email', profile?.email)
        .order('created_at', { ascending: false })
        .limit(10);

      // Use the orders-based data if available, fallback to direct order_items
      const finalPurchasesData = ordersPurchasesData?.length ? 
        ordersPurchasesData.flatMap(order => 
          order.order_items?.map(item => ({
            ...item,
            order_date: order.created_at,
            order_amount: order.total_amount
          })) || []
        ) : purchasesData;

      if (finalPurchasesData && finalPurchasesData.length > 0) {
        const formattedPurchases = finalPurchasesData.map(item => ({
          id: item.id,
          product_title: item.products?.title || 'Product',
          seller_name: 'Unknown Seller', // Could be fetched separately if needed
          affiliate_name: 'Direct Purchase', // Could be fetched separately if needed
          amount: item.total_price || item.order_amount || 0,
          purchase_date: item.order_date?.split('T')[0] || item.created_at?.split('T')[0] || 'Unknown',
          download_links: item.products?.images || [],
          access_expires: '2026-01-25', // Could be calculated from subscription
          support_until: '2025-07-25'
        }));
        setPurchases(formattedPurchases);
      }

      setWishlist([
        {
          id: '1',
          product_title: 'Advanced Analytics Dashboard',
          price: 79.99,
          seller_name: 'TechCorp',
          image: ''
        },
        {
          id: '2',
          product_title: 'Social Media Automation',
          price: 39.99,
          seller_name: 'MarketingPro',
          image: ''
        }
      ]);

      // Enhanced mock data
      setRecommendations([
        {
          id: '1',
          product_title: 'Advanced Email Marketing Course',
          price: 127.99,
          seller_name: 'EmailPro Academy',
          affiliate_name: 'Sarah M.',
          match_score: 95,
          reason: 'Based on your digital marketing purchases',
          discount: 20
        },
        {
          id: '2',
          product_title: 'Social Media Analytics Tool',
          price: 67.99,
          seller_name: 'SocialTech',
          affiliate_name: 'Mike R.',
          match_score: 88,
          reason: 'Customers who bought SEO tools also love this'
        }
      ]);

      setPurchases([
        {
          id: '1',
          product_title: 'Premium Course Bundle',
          seller_name: 'Marketing Academy',
          affiliate_name: 'Lisa K.',
          amount: 99.99,
          purchase_date: '2025-01-25',
          download_links: ['https://example.com/course1', 'https://example.com/course2'],
          access_expires: '2026-01-25',
          support_until: '2025-07-25'
        }
      ]);

      setRewards([
        {
          id: '1',
          title: '10% Off Next Purchase',
          description: 'Get 10% discount on any product',
          points_required: 100,
          type: 'discount',
          value: '10% OFF',
          available: true,
          discount_percent: 10,
          expires_at: '2024-12-31'
        },
        {
          id: '2',
          title: 'Free Bonus Course',
          description: 'Unlock exclusive bonus course content',
          points_required: 500,
          type: 'product',
          value: 'Bonus Course',
          available: false,
          expires_at: '2025-03-31'
        },
        {
          id: '3',
          title: '25% Off Premium Products',
          description: 'Exclusive discount on premium course collection',
          points_required: 200,
          type: 'discount',
          value: '25% OFF',
          available: true,
          discount_percent: 25,
          expires_at: '2024-11-30'
        },
        {
          id: '4',
          title: 'VIP Access Pass',
          description: 'Early access to new releases and exclusive content',
          points_required: 750,
          type: 'exclusive',
          value: 'VIP Access',
          available: false
        }
      ]);

      setFollowedAffiliates([
        {
          id: '1',
          name: 'Sarah M.',
          specialty: 'Digital Marketing',
          rating: 4.9,
          total_sales: 1200,
          is_following: true,
          followers: 2500,
          purchases: 8,
          total_spent: 1247,
          following_since: 'Jan 2024',
          last_purchase: '3 days ago'
        },
        {
          id: '2',
          name: 'Mike R.',
          specialty: 'SEO & Analytics',
          rating: 4.8,
          total_sales: 950,
          is_following: true,
          followers: 1800,
          purchases: 5,
          total_spent: 895,
          following_since: 'Mar 2024',
          last_purchase: '1 week ago'
        },
        {
          id: '3',
          name: 'Lisa K.',
          specialty: 'Lead Generation',
          rating: 4.7,
          total_sales: 1100,
          is_following: true,
          followers: 3200,
          purchases: 12,
          total_spent: 2100,
          following_since: 'Feb 2024',
          last_purchase: '2 days ago'
        }
      ]);

      setWatchlist([
        {
          id: '1',
          product_title: 'Advanced Email Marketing Masterclass',
          seller_name: 'Sarah M.',
          affiliate_name: 'Marketing Mike',
          current_price: 197,
          original_price: 297,
          price_drop: 50,
          added_date: '1 week ago'
        },
        {
          id: '2',
          product_title: 'Social Media Growth Secrets',
          seller_name: 'Digital Dan',
          affiliate_name: 'Lisa K.',
          current_price: 147,
          added_date: '3 days ago'
        },
        {
          id: '3',
          product_title: 'Lead Generation Blueprint',
          seller_name: 'Mike R.',
          affiliate_name: 'Sarah M.',
          current_price: 297,
          original_price: 497,
          price_drop: 77,
          added_date: '5 days ago'
        }
      ]);

      setLoyaltyPoints(250);
    } catch (error) {
      console.error('Error fetching buyer data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getOrderStatusColor = (status: string) => {
    switch (status) {
      case 'delivered': return 'bg-green-100 text-green-800';
      case 'shipped': return 'bg-blue-100 text-blue-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getSubscriptionStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'paused': return 'bg-yellow-100 text-yellow-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Buyer Dashboard</h1>
        <p className="text-gray-600">Manage your orders, subscriptions, and preferences</p>
      </div>

      {/* Enhanced Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Purchases</p>
              <p className="text-2xl font-bold text-gray-900">{orders.length + purchases.length}</p>
              <p className="text-sm text-green-600 mt-1">+2 this month</p>
            </div>
            <Package className="w-8 h-8 text-blue-600" />
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Loyalty Points</p>
              <p className="text-2xl font-bold text-gray-900">{loyaltyPoints}</p>
              <p className="text-sm text-yellow-600 mt-1">50 to next reward</p>
            </div>
            <Award className="w-8 h-8 text-yellow-600" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active Subscriptions</p>
              <p className="text-2xl font-bold text-gray-900">{subscriptions.filter(s => s.status === 'active').length}</p>
              <p className="text-sm text-green-600 mt-1">All up to date</p>
            </div>
            <RefreshCw className="w-8 h-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Savings</p>
              <p className="text-2xl font-bold text-gray-900">$47.50</p>
              <p className="text-sm text-orange-600 mt-1">Through affiliates</p>
            </div>
            <Gift className="w-8 h-8 text-orange-600" />
          </div>
        </div>
      </div>

      {/* Enhanced Navigation Tabs */}
      <div className="border-b border-gray-200 mb-8">
        <nav className="flex space-x-6 overflow-x-auto">
          {[
            { id: 'overview', label: 'Overview', icon: TrendingUp },
            { id: 'orders', label: 'Orders', icon: Package },
            { id: 'purchases', label: 'My Purchases', icon: Download },
            { id: 'subscriptions', label: 'Subscriptions', icon: RefreshCw },
            { id: 'wishlist', label: 'Wishlist', icon: Heart },
            { id: 'recommendations', label: 'For You', icon: Zap },
            { id: 'affiliates', label: 'My Affiliates', icon: Users },
            { id: 'rewards', label: 'Rewards', icon: Award },
            { id: 'support', label: 'Support', icon: HelpCircle },
            { id: 'reviews', label: 'Reviews', icon: Star }
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

      {/* Enhanced Tab Content */}
      {activeTab === 'overview' && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Recent Activity</h3>
                  <Bell className="w-5 h-5 text-gray-400" />
                </div>
                <div className="space-y-4">
                  <div className="flex items-center space-x-4 p-3 bg-blue-50 rounded-lg">
                    <Package className="w-5 h-5 text-blue-600" />
                    <div>
                      <p className="font-medium">Order Delivered</p>
                      <p className="text-sm text-gray-600">Premium Course Bundle arrived safely</p>
                    </div>
                    <span className="text-xs text-blue-600">2 days ago</span>
                  </div>
                  <div className="flex items-center space-x-4 p-3 bg-green-50 rounded-lg">
                    <Award className="w-5 h-5 text-green-600" />
                    <div>
                      <p className="font-medium">Points Earned</p>
                      <p className="text-sm text-gray-600">+50 loyalty points from Sarah M.</p>
                    </div>
                    <span className="text-xs text-green-600">3 days ago</span>
                  </div>
                  <div className="flex items-center space-x-4 p-3 bg-yellow-50 rounded-lg">
                    <Zap className="w-5 h-5 text-yellow-600" />
                    <div>
                      <p className="font-medium">New Recommendation</p>
                      <p className="text-sm text-gray-600">Advanced Email Marketing Course suggested</p>
                    </div>
                    <span className="text-xs text-yellow-600">5 days ago</span>
                  </div>
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
                    onClick={() => setActiveTab('rewards')}
                    className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left"
                  >
                    <Gift className="w-6 h-6 text-orange-600 mb-2" />
                    <h4 className="font-medium">Redeem Rewards</h4>
                    <p className="text-sm text-gray-600">{loyaltyPoints} points available</p>
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
              <div className="bg-gradient-to-r from-yellow-50 to-pink-50 p-6 rounded-xl border border-yellow-200">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-yellow-900">Loyalty Status</h3>
                  <Award className="w-6 h-6 text-yellow-600" />
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-yellow-800">Current Points:</span>
                    <span className="font-bold text-yellow-900">{loyaltyPoints}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-yellow-800">Status:</span>
                    <span className="font-bold text-yellow-900">Silver Member</span>
                  </div>
                  <div className="w-full bg-yellow-200 rounded-full h-2">
                    <div className="bg-yellow-600 h-2 rounded-full" style={{width: '60%'}}></div>
                  </div>
                  <p className="text-sm text-yellow-800">100 more points to Gold level!</p>
                </div>
              </div>

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
                        <span>•</span>
                        <span>Referred by {purchase.affiliate_name}</span>
                        <span>•</span>
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
            <h3 className="text-lg font-semibold mb-2 text-yellow-900">🎯 Personalized For You</h3>
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
            {orders.map((order) => (
              <div key={order.id} className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h4 className="font-medium text-gray-900">{order.product_title}</h4>
                    <p className="text-sm text-gray-600">Order #{order.id} • {order.order_date}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-lg">${order.amount}</p>
                    <span className={`text-xs px-2 py-1 rounded-full ${getOrderStatusColor(order.status)}`}>
                      {order.status}
                    </span>
                  </div>
                </div>
                
                {order.tracking_number && (
                  <div className="flex items-center space-x-2 text-sm text-gray-600">
                    <Truck className="w-4 h-4" />
                    <span>Tracking: {order.tracking_number}</span>
                  </div>
                )}
                
                <div className="mt-4 flex space-x-3">
                  <button className="text-orange-600 hover:text-orange-700 text-sm font-medium">
                    View Details
                  </button>
                  {order.status === 'delivered' && (
                    <button className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                      Write Review
                    </button>
                  )}
                  {order.status === 'pending' && (
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

      {activeTab === 'subscriptions' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold">Your Subscriptions</h3>
          </div>
          <div className="divide-y divide-gray-200">
            {subscriptions.map((subscription) => (
              <div key={subscription.id} className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h4 className="font-medium text-gray-900">{subscription.product_title}</h4>
                    <p className="text-sm text-gray-600">
                      Next billing: {subscription.next_billing_date} • {subscription.billing_cycle}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-lg">${subscription.amount}</p>
                    <span className={`text-xs px-2 py-1 rounded-full ${getSubscriptionStatusColor(subscription.status)}`}>
                      {subscription.status}
                    </span>
                  </div>
                </div>
                
                <div className="flex space-x-3">
                  <button className="text-orange-600 hover:text-orange-700 text-sm font-medium">
                    Manage Subscription
                  </button>
                  {subscription.status === 'active' && (
                    <>
                      <button className="text-yellow-600 hover:text-yellow-700 text-sm font-medium">
                        Pause
                      </button>
                      <button className="text-red-600 hover:text-red-700 text-sm font-medium">
                        Cancel
                      </button>
                    </>
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
                          <span className="text-gray-400">•</span>
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
                      <button className="text-blue-600 hover:text-blue-700 font-medium">
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

      {activeTab === 'rewards' && (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-orange-50 to-yellow-50 p-6 rounded-xl border border-orange-200">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-orange-900 mb-2">🎁 Your Rewards</h3>
                <p className="text-orange-800">You have <span className="font-bold">{loyaltyPoints} points</span> ready to redeem!</p>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-orange-600">{loyaltyPoints}</div>
                <div className="text-sm text-orange-700">Points Available</div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {rewards.map((reward) => (
              <div key={reward.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h4 className="font-medium text-lg mb-2">{reward.title}</h4>
                    <p className="text-gray-600 text-sm mb-3">{reward.description}</p>
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-1">
                        <Award className="w-4 h-4 text-orange-600" />
                        <span className="text-sm font-medium">{reward.points_required} points</span>
                      </div>
                      {reward.discount_percent && (
                        <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs">
                          {reward.discount_percent}% OFF
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-600">
                    {reward.expires_at && `Expires: ${reward.expires_at}`}
                  </div>
                  <button 
                    disabled={loyaltyPoints < reward.points_required}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      loyaltyPoints >= reward.points_required
                        ? 'bg-orange-600 text-white hover:bg-orange-700'
                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    {loyaltyPoints >= reward.points_required ? 'Redeem' : 'Need More Points'}
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold mb-4">How to Earn More Points</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <ShoppingBag className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                <h4 className="font-medium mb-2">Make Purchases</h4>
                <p className="text-sm text-gray-600 mb-2">Earn 1 point per $1 spent</p>
                <div className="text-lg font-bold text-blue-600">+1 pt/$1</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <Star className="w-8 h-8 text-green-600 mx-auto mb-2" />
                <h4 className="font-medium mb-2">Write Reviews</h4>
                <p className="text-sm text-gray-600 mb-2">Share your experience</p>
                <div className="text-lg font-bold text-green-600">+25 pts</div>
              </div>
              <div className="text-center p-4 bg-yellow-50 rounded-lg">
                <Users className="w-8 h-8 text-yellow-600 mx-auto mb-2" />
                <h4 className="font-medium mb-2">Refer Friends</h4>
                <p className="text-sm text-gray-600 mb-2">When they make first purchase</p>
                <div className="text-lg font-bold text-yellow-600">+100 pts</div>
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
                <button className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                  <Plus className="w-4 h-4" />
                  <span>Add Product</span>
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
                <div className="text-2xl font-bold text-green-600">$127</div>
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
            <h3 className="text-xl font-bold text-blue-900 mb-2">🌟 Join the Community</h3>
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
              <div className="text-center p-4 bg-orange-50 rounded-lg">
                <Award className="w-6 h-6 text-orange-600 mx-auto mb-2" />
                <div className="text-2xl font-bold text-orange-600">Silver</div>
                <div className="text-sm text-gray-600">Community Level</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'support' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <h3 className="text-lg font-semibold mb-4">Get Help</h3>
              <div className="space-y-3">
                <button className="w-full text-left p-4 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                  <div className="flex items-center space-x-3">
                    <MessageSquare className="w-6 h-6 text-blue-600" />
                    <div>
                      <h4 className="font-medium">Live Chat Support</h4>
                      <p className="text-sm text-gray-600">Available 24/7 for instant help</p>
                    </div>
                  </div>
                </button>

                <button className="w-full text-left p-4 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                  <div className="flex items-center space-x-3">
                    <Mail className="w-6 h-6 text-green-600" />
                    <div>
                      <h4 className="font-medium">Email Support</h4>
                      <p className="text-sm text-gray-600">Detailed responses within 2 hours</p>
                    </div>
                  </div>
                </button>

                <button className="w-full text-left p-4 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                  <div className="flex items-center space-x-3">
                    <BookOpen className="w-6 h-6 text-orange-600" />
                    <div>
                      <h4 className="font-medium">Help Center</h4>
                      <p className="text-sm text-gray-600">Self-service guides and tutorials</p>
                    </div>
                  </div>
                </button>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <h3 className="text-lg font-semibold mb-4">Common Questions</h3>
              <div className="space-y-3">
                <details className="border border-gray-200 rounded-lg">
                  <summary className="p-3 cursor-pointer hover:bg-gray-50 font-medium">
                    How do I download my purchases?
                  </summary>
                  <div className="p-3 border-t border-gray-200 text-sm text-gray-600">
                    You can find download links in your Purchases tab or in the email receipt sent after purchase. Digital products are available immediately after payment.
                  </div>
                </details>
                
                <details className="border border-gray-200 rounded-lg">
                  <summary className="p-3 cursor-pointer hover:bg-gray-50 font-medium">
                    How do I track my affiliate purchases?
                  </summary>
                  <div className="p-3 border-t border-gray-200 text-sm text-gray-600">
                    All purchases made through affiliate links are automatically tracked in your Affiliates tab, showing which expert referred you to each product.
                  </div>
                </details>
                
                <details className="border border-gray-200 rounded-lg">
                  <summary className="p-3 cursor-pointer hover:bg-gray-50 font-medium">
                    How do loyalty points work?
                  </summary>
                  <div className="p-3 border-t border-gray-200 text-sm text-gray-600">
                    Earn 1 point per $1 spent, plus bonus points for reviews and referrals. Redeem points for discounts and exclusive rewards in the Rewards tab.
                  </div>
                </details>
                
                <details className="border border-gray-200 rounded-lg">
                  <summary className="p-3 cursor-pointer hover:bg-gray-50 font-medium">
                    What is your refund policy?
                  </summary>
                  <div className="p-3 border-t border-gray-200 text-sm text-gray-600">
                    We offer a 30-day money-back guarantee on all digital products. Contact the seller directly or our support team for refund requests.
                  </div>
                </details>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold mb-4">Recent Support Tickets</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
                <div>
                  <h4 className="font-medium text-green-800">Download Issue Resolved</h4>
                  <p className="text-sm text-green-700">Course materials are now accessible</p>
                  <p className="text-xs text-green-600">Ticket #12345 • Resolved 2 days ago</p>
                </div>
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>

              <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
                <div>
                  <h4 className="font-medium text-blue-800">Refund Request Processing</h4>
                  <p className="text-sm text-blue-700">Expected completion in 3-5 business days</p>
                  <p className="text-xs text-blue-600">Ticket #12346 • In Progress</p>
                </div>
                <Clock className="w-6 h-6 text-blue-600" />
              </div>
            </div>

            <button className="w-full mt-4 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors">
              Create New Ticket
            </button>
          </div>
        </div>
      )}

      {activeTab === 'reviews' && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold mb-4">Your Reviews</h3>
          <div className="space-y-6">
            <div className="border-b border-gray-200 pb-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium">Premium Course Bundle</h4>
                <div className="flex items-center space-x-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star key={star} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
              </div>
              <p className="text-gray-600 text-sm mb-2">
                "Excellent course with great practical examples. Highly recommend!"
              </p>
              <p className="text-xs text-gray-500">Reviewed on January 20, 2025</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EnhancedBuyerDashboard;
