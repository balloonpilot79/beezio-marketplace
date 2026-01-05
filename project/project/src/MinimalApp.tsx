import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate } from 'react-router-dom';

// Enhanced Dashboard Components
const EnhancedSellerDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState('overview');

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return <OverviewTab />;
      case 'products':
        return <ProductsTab />;
      case 'analytics':
        return <AnalyticsTab />;
      case 'affiliates':
        return <AffiliatesTab />;
      case 'payments':
        return <PaymentsTab />;
      case 'inventory':
        return <InventoryTab />;
      case 'store':
        return <CustomStoreTab />;
      case 'api':
        return <APITab />;
      default:
        return <OverviewTab />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to="/" className="text-2xl font-bold bg-gradient-to-r from-yellow-600 via-yellow-500 to-amber-500 bg-clip-text text-transparent">
              🐝 Beezio.co
            </Link>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                <span className="text-sm text-gray-600">Online</span>
              </div>
              <span className="text-sm text-gray-600">Seller Dashboard</span>
              <button className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-colors">
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8 overflow-x-auto">
            {[
              { id: 'overview', label: 'Overview', icon: '📊' },
              { id: 'products', label: 'Products', icon: '📦' },
              { id: 'analytics', label: 'Analytics', icon: '📈' },
              { id: 'affiliates', label: 'Affiliates', icon: '🤝' },
              { id: 'payments', label: 'Payments', icon: '💳' },
              { id: 'inventory', label: 'Inventory', icon: '📋' },
              { id: 'store', label: 'Custom Store', icon: '🏪' },
              { id: 'api', label: 'API & Tools', icon: '🔧' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-yellow-500 text-yellow-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } transition-colors`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {renderTabContent()}
      </div>
    </div>
  );
};

const OverviewTab: React.FC = () => (
  <div>
    <div className="mb-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Seller Dashboard</h1>
      <p className="text-gray-600">Welcome back! Here's your business overview</p>
    </div>

    {/* Enhanced Quick Stats */}
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Revenue (30 days)</p>
            <p className="text-2xl font-bold text-gray-900">$12,847</p>
            <p className="text-sm text-green-600">+23% from last month</p>
          </div>
          <div className="p-3 bg-green-100 rounded-lg">
            <span className="text-green-600 text-xl">💰</span>
          </div>
        </div>
      </div>
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Active Products</p>
            <p className="text-2xl font-bold text-gray-900">23</p>
            <p className="text-sm text-blue-600">3 pending approval</p>
          </div>
          <div className="p-3 bg-blue-100 rounded-lg">
            <span className="text-blue-600 text-xl">📦</span>
          </div>
        </div>
      </div>
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Sales This Month</p>
            <p className="text-2xl font-bold text-gray-900">87</p>
            <p className="text-sm text-yellow-600">12 today</p>
          </div>
          <div className="p-3 bg-yellow-100 rounded-lg">
            <span className="text-yellow-600 text-xl">🔥</span>
          </div>
        </div>
      </div>
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Active Affiliates</p>
            <p className="text-2xl font-bold text-gray-900">156</p>
            <p className="text-sm text-purple-600">23 new this week</p>
          </div>
          <div className="p-3 bg-purple-100 rounded-lg">
            <span className="text-purple-600 text-xl">🤝</span>
          </div>
        </div>
      </div>
    </div>

    {/* Performance Chart & Top Products */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue Trend (30 Days)</h3>
        <div className="h-64 flex items-end justify-between space-x-2">
          {[420, 380, 520, 640, 580, 720, 850, 920, 1100, 1200, 980, 1150, 1300, 1250, 1400].map((value, index) => (
            <div key={index} className="flex-1 bg-yellow-200 rounded-t" style={{ height: `${(value / 1400) * 100}%` }}></div>
          ))}
        </div>
        <div className="flex justify-between text-sm text-gray-600 mt-4">
          <span>July 1</span>
          <span>July 15</span>
          <span>July 31</span>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Performing Products</h3>
        <div className="space-y-4">
          {[
            { name: "Digital Marketing Course", revenue: 4365, sales: 45, trend: "+12%" },
            { name: "Social Media Templates", revenue: 1943, sales: 67, trend: "+8%" },
            { name: "SEO Audit Tool", revenue: 1127, sales: 23, trend: "+23%" }
          ].map((product, index) => (
            <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <h4 className="font-medium text-gray-900">{product.name}</h4>
                <p className="text-sm text-gray-600">{product.sales} sales • ${product.revenue}</p>
              </div>
              <span className="text-sm font-medium text-green-600">{product.trend}</span>
            </div>
          ))}
        </div>
      </div>
    </div>

    {/* Recent Activity */}
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
      <div className="space-y-4">
        {[
          { type: 'sale', message: 'New sale: Digital Marketing Course', time: '2 minutes ago', amount: '$97' },
          { type: 'affiliate', message: 'New affiliate application: @marketingpro', time: '15 minutes ago', amount: null },
          { type: 'milestone', message: 'Product view milestone: 10K views reached', time: '1 hour ago', amount: null },
          { type: 'payment', message: 'Commission payout processed', time: '2 hours ago', amount: '$847' }
        ].map((activity, index) => (
          <div key={index} className="flex items-center justify-between p-4 hover:bg-gray-50 rounded-lg transition-colors">
            <div className="flex items-center">
              <div className={`w-3 h-3 rounded-full mr-4 ${
                activity.type === 'sale' ? 'bg-green-500' :
                activity.type === 'affiliate' ? 'bg-blue-500' :
                activity.type === 'milestone' ? 'bg-yellow-500' : 'bg-purple-500'
              }`}></div>
              <div>
                <p className="font-medium text-gray-900">{activity.message}</p>
                <p className="text-sm text-gray-500">{activity.time}</p>
              </div>
            </div>
            {activity.amount && (
              <span className="font-semibold text-gray-900">{activity.amount}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  </div>
);

const ProductsTab: React.FC = () => (
  <div>
    <div className="flex items-center justify-between mb-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Product Management</h1>
        <p className="text-gray-600">Manage your product listings and performance</p>
      </div>
      <button className="bg-yellow-500 text-white px-6 py-3 rounded-lg hover:bg-yellow-600 transition-colors font-medium">
        + Add New Product
      </button>
    </div>

    {/* Product Filters */}
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
          <select className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-yellow-500 focus:border-transparent">
            <option>All Products</option>
            <option>Active</option>
            <option>Draft</option>
            <option>Pending</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
          <select className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-yellow-500 focus:border-transparent">
            <option>All Categories</option>
            <option>Digital Products</option>
            <option>Courses</option>
            <option>Tools</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Price Range</label>
          <select className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-yellow-500 focus:border-transparent">
            <option>Any Price</option>
            <option>$0 - $50</option>
            <option>$50 - $100</option>
            <option>$100+</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
          <input type="text" placeholder="Search products..." className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-yellow-500 focus:border-transparent" />
        </div>
      </div>
    </div>

    {/* Products List */}
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900">Your Products (23)</h2>
      </div>
      <div className="divide-y divide-gray-200">
        {[
          { 
            name: "Digital Marketing Course", 
            price: 97, 
            sales: 45, 
            commission: "15%", 
            status: "Active",
            views: "2.3K",
            conversion: "3.2%",
            revenue: "$4,365",
            affiliates: 23
          },
          { 
            name: "SEO Audit Tool", 
            price: 49, 
            sales: 23, 
            commission: "$12", 
            status: "Active",
            views: "1.8K",
            conversion: "2.8%",
            revenue: "$1,127",
            affiliates: 15
          },
          { 
            name: "Social Media Templates", 
            price: 29, 
            sales: 67, 
            commission: "20%", 
            status: "Active",
            views: "3.1K",
            conversion: "4.1%",
            revenue: "$1,943",
            affiliates: 31
          },
          { 
            name: "Email Marketing Guide", 
            price: 39, 
            sales: 12, 
            commission: "$8", 
            status: "Draft",
            views: "156",
            conversion: "1.2%",
            revenue: "$468",
            affiliates: 3
          }
        ].map((product, index) => (
          <div key={index} className="p-6 hover:bg-gray-50">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-yellow-100 to-amber-100 rounded-lg flex items-center justify-center">
                    <span className="text-yellow-600 text-sm font-medium">IMG</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">{product.name}</h3>
                    <div className="flex items-center space-x-6 mt-2 text-sm text-gray-600">
                      <span>Price: ${product.price}</span>
                      <span>Sales: {product.sales}</span>
                      <span>Views: {product.views}</span>
                      <span>Conv: {product.conversion}</span>
                      <span>Revenue: {product.revenue}</span>
                      <span>Affiliates: {product.affiliates}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">Commission: {product.commission}</p>
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    product.status === 'Active' ? 'bg-green-100 text-green-800' : 
                    product.status === 'Draft' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {product.status}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <button className="text-blue-600 hover:text-blue-700 px-3 py-1 text-sm">Edit</button>
                  <button className="text-green-600 hover:text-green-700 px-3 py-1 text-sm">Analytics</button>
                  <button className="text-gray-600 hover:text-gray-700 px-3 py-1 text-sm">•••</button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

const AnalyticsTab: React.FC = () => (
  <div>
    <div className="mb-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Analytics & Insights</h1>
      <p className="text-gray-600">Deep dive into your business performance</p>
    </div>

    {/* Time Range Selector */}
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Performance Overview</h3>
        <div className="flex space-x-2">
          {['7D', '30D', '90D', '1Y'].map((period) => (
            <button key={period} className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50">
              {period}
            </button>
          ))}
        </div>
      </div>
    </div>

    {/* Detailed Analytics */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue Analytics</h3>
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Total Revenue</span>
            <span className="font-semibold text-gray-900">$12,847</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Commission Paid</span>
            <span className="font-semibold text-gray-900">$2,156</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Net Profit</span>
            <span className="font-semibold text-green-600">$10,691</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Average Order Value</span>
            <span className="font-semibold text-gray-900">$67.50</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Conversion Metrics</h3>
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Total Views</span>
            <span className="font-semibold text-gray-900">47,832</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Unique Visitors</span>
            <span className="font-semibold text-gray-900">23,456</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Conversion Rate</span>
            <span className="font-semibold text-yellow-600">3.2%</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Bounce Rate</span>
            <span className="font-semibold text-gray-900">45.2%</span>
          </div>
        </div>
      </div>
    </div>

    {/* Traffic Sources */}
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Traffic Sources</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { source: 'Affiliate Links', visitors: '15,234', percentage: '65%', color: 'bg-blue-500' },
          { source: 'Direct Traffic', visitors: '5,678', percentage: '24%', color: 'bg-green-500' },
          { source: 'Social Media', visitors: '2,544', percentage: '11%', color: 'bg-purple-500' }
        ].map((source, index) => (
          <div key={index} className="text-center">
            <div className={`w-16 h-16 ${source.color} rounded-full flex items-center justify-center mx-auto mb-3`}>
              <span className="text-white font-bold">{source.percentage}</span>
            </div>
            <h4 className="font-medium text-gray-900">{source.source}</h4>
            <p className="text-sm text-gray-600">{source.visitors} visitors</p>
          </div>
        ))}
      </div>
    </div>

    {/* Top Affiliates Performance */}
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Affiliate Performance</h3>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-3 px-4 font-medium text-gray-900">Affiliate</th>
              <th className="text-left py-3 px-4 font-medium text-gray-900">Sales</th>
              <th className="text-left py-3 px-4 font-medium text-gray-900">Revenue</th>
              <th className="text-left py-3 px-4 font-medium text-gray-900">Commission</th>
              <th className="text-left py-3 px-4 font-medium text-gray-900">Conversion</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {[
              { name: 'MarketingPro', sales: 23, revenue: '$2,231', commission: '$334.65', conversion: '4.2%' },
              { name: 'TechInfluencer', sales: 18, revenue: '$1,764', commission: '$264.60', conversion: '3.8%' },
              { name: 'BusinessCoach', sales: 15, revenue: '$1,455', commission: '$218.25', conversion: '3.1%' }
            ].map((affiliate, index) => (
              <tr key={index}>
                <td className="py-3 px-4 text-gray-900">{affiliate.name}</td>
                <td className="py-3 px-4 text-gray-600">{affiliate.sales}</td>
                <td className="py-3 px-4 text-gray-600">{affiliate.revenue}</td>
                <td className="py-3 px-4 text-green-600 font-medium">{affiliate.commission}</td>
                <td className="py-3 px-4 text-gray-600">{affiliate.conversion}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  </div>
);

const AffiliatesTab: React.FC = () => (
  <div>
    <div className="flex items-center justify-between mb-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Affiliate Management</h1>
        <p className="text-gray-600">Manage your affiliate partners and recruitment</p>
      </div>
      <button className="bg-yellow-500 text-white px-6 py-3 rounded-lg hover:bg-yellow-600 transition-colors font-medium">
        Create Recruitment Link
      </button>
    </div>

    {/* Affiliate Stats */}
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Active Affiliates</p>
            <p className="text-2xl font-bold text-gray-900">156</p>
          </div>
          <span className="text-2xl">🤝</span>
        </div>
      </div>
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Pending Applications</p>
            <p className="text-2xl font-bold text-gray-900">23</p>
          </div>
          <span className="text-2xl">⏳</span>
        </div>
      </div>
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Commission Paid</p>
            <p className="text-2xl font-bold text-gray-900">$8,247</p>
          </div>
          <span className="text-2xl">💰</span>
        </div>
      </div>
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Avg Commission Rate</p>
            <p className="text-2xl font-bold text-gray-900">18.5%</p>
          </div>
          <span className="text-2xl">📊</span>
        </div>
      </div>
    </div>

    {/* Affiliate Management Tabs */}
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8 px-6">
          {['Active Affiliates', 'Pending Applications', 'Commission Settings', 'Recruitment Tools'].map((tab) => (
            <button key={tab} className="py-4 px-1 border-b-2 border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 font-medium text-sm">
              {tab}
            </button>
          ))}
        </nav>
      </div>

      {/* Active Affiliates List */}
      <div className="p-6">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 font-medium text-gray-900">Affiliate</th>
                <th className="text-left py-3 px-4 font-medium text-gray-900">Join Date</th>
                <th className="text-left py-3 px-4 font-medium text-gray-900">Sales</th>
                <th className="text-left py-3 px-4 font-medium text-gray-900">Revenue</th>
                <th className="text-left py-3 px-4 font-medium text-gray-900">Commission</th>
                <th className="text-left py-3 px-4 font-medium text-gray-900">Status</th>
                <th className="text-left py-3 px-4 font-medium text-gray-900">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {[
                { name: 'MarketingPro', email: 'pro@marketing.com', joinDate: 'Jan 15, 2025', sales: 23, revenue: '$2,231', commission: '$334.65', status: 'Active' },
                { name: 'TechInfluencer', email: 'tech@influence.com', joinDate: 'Feb 3, 2025', sales: 18, revenue: '$1,764', commission: '$264.60', status: 'Active' },
                { name: 'BusinessCoach', email: 'coach@business.com', joinDate: 'Mar 12, 2025', sales: 15, revenue: '$1,455', commission: '$218.25', status: 'Active' }
              ].map((affiliate, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="py-3 px-4">
                    <div>
                      <div className="font-medium text-gray-900">{affiliate.name}</div>
                      <div className="text-sm text-gray-500">{affiliate.email}</div>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-600">{affiliate.joinDate}</td>
                  <td className="py-3 px-4">{affiliate.sales}</td>
                  <td className="py-3 px-4">{affiliate.revenue}</td>
                  <td className="py-3 px-4 text-green-600">{affiliate.commission}</td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">
                      {affiliate.status}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex space-x-2">
                      <button className="text-blue-600 hover:text-blue-700 text-sm">View</button>
                      <button className="text-gray-600 hover:text-gray-700 text-sm">Edit</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>

    {/* Commission Settings */}
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Commission Structure</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Default Commission Rate</label>
              <div className="flex space-x-2">
                <input type="number" value="15" className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-yellow-500 focus:border-transparent" />
                <select className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-yellow-500 focus:border-transparent">
                  <option>%</option>
                  <option>$</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Minimum Payout</label>
              <input type="number" value="50" className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-yellow-500 focus:border-transparent" />
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Payment Schedule</label>
              <select className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-yellow-500 focus:border-transparent">
                <option>Bi-weekly (1st & 15th)</option>
                <option>Weekly</option>
                <option>Monthly</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Cookie Duration</label>
              <select className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-yellow-500 focus:border-transparent">
                <option>30 days</option>
                <option>60 days</option>
                <option>90 days</option>
              </select>
            </div>
          </div>
        </div>
        <div className="mt-6">
          <button className="bg-yellow-500 text-white px-6 py-2 rounded-lg hover:bg-yellow-600 transition-colors">
            Save Settings
          </button>
        </div>
      </div>
    </div>
  </div>
);

const PaymentsTab: React.FC = () => (
  <div>
    <div className="mb-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Payment Management</h1>
      <p className="text-gray-600">Track your earnings, payouts, and payment settings</p>
    </div>

    {/* Payment Overview */}
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Available Balance</p>
            <p className="text-2xl font-bold text-green-600">$2,847.50</p>
          </div>
          <span className="text-2xl">💰</span>
        </div>
      </div>
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Pending Payouts</p>
            <p className="text-2xl font-bold text-yellow-600">$1,247.00</p>
          </div>
          <span className="text-2xl">⏳</span>
        </div>
      </div>
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Total Paid Out</p>
            <p className="text-2xl font-bold text-gray-900">$18,234.75</p>
          </div>
          <span className="text-2xl">📤</span>
        </div>
      </div>
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Next Payout</p>
            <p className="text-2xl font-bold text-gray-900">Aug 15</p>
          </div>
          <span className="text-2xl">📅</span>
        </div>
      </div>
    </div>

    {/* Payment History */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Recent Transactions</h3>
        </div>
        <div className="divide-y divide-gray-200">
          {[
            { date: 'July 30, 2025', type: 'Sale', product: 'Digital Marketing Course', amount: '+$97.00', status: 'Completed' },
            { date: 'July 29, 2025', type: 'Commission', affiliate: 'MarketingPro', amount: '-$14.55', status: 'Paid' },
            { date: 'July 28, 2025', type: 'Sale', product: 'SEO Audit Tool', amount: '+$49.00', status: 'Completed' },
            { date: 'July 27, 2025', type: 'Payout', method: 'Bank Transfer', amount: '-$1,250.00', status: 'Processing' }
          ].map((transaction, index) => (
            <div key={index} className="p-4 hover:bg-gray-50">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">{transaction.type}</p>
                  <p className="text-sm text-gray-600">
                    {transaction.product || transaction.affiliate || transaction.method} • {transaction.date}
                  </p>
                </div>
                <div className="text-right">
                  <p className={`font-semibold ${transaction.amount.startsWith('+') ? 'text-green-600' : 'text-red-600'}`}>
                    {transaction.amount}
                  </p>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    transaction.status === 'Completed' || transaction.status === 'Paid' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {transaction.status}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Payment Methods</h3>
        </div>
        <div className="p-6 space-y-4">
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <span className="text-2xl mr-3">🏦</span>
                <div>
                  <p className="font-medium text-gray-900">Bank Transfer</p>
                  <p className="text-sm text-gray-600">****1234 • Primary</p>
                </div>
              </div>
              <button className="text-blue-600 hover:text-blue-700 text-sm">Edit</button>
            </div>
          </div>
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <span className="text-2xl mr-3">💳</span>
                <div>
                  <p className="font-medium text-gray-900">PayPal</p>
                  <p className="text-sm text-gray-600">seller@email.com</p>
                </div>
              </div>
              <button className="text-blue-600 hover:text-blue-700 text-sm">Edit</button>
            </div>
          </div>
          <button className="w-full border-2 border-dashed border-gray-300 rounded-lg p-4 text-gray-600 hover:border-yellow-500 hover:text-yellow-600 transition-colors">
            + Add Payment Method
          </button>
        </div>
      </div>
    </div>

    {/* Payout Schedule */}
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="p-6 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">Upcoming Payouts</h3>
      </div>
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-green-800">Next Payout</p>
                <p className="text-2xl font-bold text-green-800">$2,847.50</p>
                <p className="text-sm text-green-600">August 15, 2025</p>
              </div>
              <span className="text-3xl text-green-600">💰</span>
            </div>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-blue-800">Following Payout</p>
                <p className="text-2xl font-bold text-blue-800">Est. $1,200</p>
                <p className="text-sm text-blue-600">September 1, 2025</p>
              </div>
              <span className="text-3xl text-blue-600">📅</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

const InventoryTab: React.FC = () => (
  <div>
    <div className="flex items-center justify-between mb-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Inventory Management</h1>
        <p className="text-gray-600">Track stock levels, manage digital assets, and monitor product performance</p>
      </div>
      <button className="bg-yellow-500 text-white px-6 py-3 rounded-lg hover:bg-yellow-600 transition-colors font-medium">
        Add New Asset
      </button>
    </div>

    {/* Inventory Overview */}
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Digital Products</p>
            <p className="text-2xl font-bold text-gray-900">23</p>
          </div>
          <span className="text-2xl">💾</span>
        </div>
      </div>
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Storage Used</p>
            <p className="text-2xl font-bold text-gray-900">2.4GB</p>
          </div>
          <span className="text-2xl">💿</span>
        </div>
      </div>
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Downloads Today</p>
            <p className="text-2xl font-bold text-gray-900">47</p>
          </div>
          <span className="text-2xl">⬇️</span>
        </div>
      </div>
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Avg File Size</p>
            <p className="text-2xl font-bold text-gray-900">104MB</p>
          </div>
          <span className="text-2xl">📊</span>
        </div>
      </div>
    </div>

    {/* Digital Assets Management */}
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-8">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Digital Assets</h3>
          <div className="flex space-x-2">
            <select className="border border-gray-300 rounded-lg px-3 py-1 text-sm focus:ring-2 focus:ring-yellow-500 focus:border-transparent">
              <option>All Assets</option>
              <option>Videos</option>
              <option>PDFs</option>
              <option>Software</option>
            </select>
            <button className="border border-gray-300 rounded-lg px-3 py-1 text-sm hover:bg-gray-50">
              Sort by Date
            </button>
          </div>
        </div>
      </div>
      <div className="divide-y divide-gray-200">
        {[
          { name: 'Marketing_Course_Complete.zip', size: '245MB', type: 'Archive', downloads: '1,247', uploaded: 'Jan 15, 2025', status: 'Active' },
          { name: 'SEO_Tools_Software.exe', size: '89MB', type: 'Software', downloads: '856', uploaded: 'Feb 3, 2025', status: 'Active' },
          { name: 'Social_Media_Templates.zip', size: '156MB', type: 'Archive', downloads: '2,134', uploaded: 'Mar 12, 2025', status: 'Active' },
          { name: 'Email_Marketing_Guide.pdf', size: '12MB', type: 'PDF', downloads: '456', uploaded: 'Apr 8, 2025', status: 'Draft' }
        ].map((asset, index) => (
          <div key={index} className="p-6 hover:bg-gray-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <span className="text-blue-600 font-bold text-sm">
                    {asset.type === 'Archive' ? '📦' : asset.type === 'Software' ? '💻' : '📄'}
                  </span>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">{asset.name}</h4>
                  <div className="flex items-center space-x-4 text-sm text-gray-600">
                    <span>{asset.size}</span>
                    <span>{asset.type}</span>
                    <span>{asset.downloads} downloads</span>
                    <span>Uploaded {asset.uploaded}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <span className={`px-2 py-1 text-xs rounded-full ${
                  asset.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {asset.status}
                </span>
                <div className="flex space-x-2">
                  <button className="text-blue-600 hover:text-blue-700 text-sm">Download</button>
                  <button className="text-gray-600 hover:text-gray-700 text-sm">Replace</button>
                  <button className="text-red-600 hover:text-red-700 text-sm">Delete</button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>

    {/* Storage & Backup */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Storage Usage</h3>
        </div>
        <div className="p-6">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Used</span>
              <span className="font-semibold">2.4GB / 10GB</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-yellow-500 h-2 rounded-full" style={{ width: '24%' }}></div>
            </div>
            <div className="text-sm text-gray-600">
              <p>76% available (7.6GB remaining)</p>
            </div>
            <button className="w-full bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600 transition-colors">
              Upgrade Storage
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Backup & Security</h3>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
            <div className="flex items-center">
              <span className="text-green-600 text-lg mr-3">✅</span>
              <span className="font-medium text-green-800">Auto Backup Enabled</span>
            </div>
            <button className="text-green-600 hover:text-green-700 text-sm">Configure</button>
          </div>
          <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
            <div className="flex items-center">
              <span className="text-blue-600 text-lg mr-3">🔒</span>
              <span className="font-medium text-blue-800">Files Encrypted</span>
            </div>
            <button className="text-blue-600 hover:text-blue-700 text-sm">Settings</button>
          </div>
          <div className="text-sm text-gray-600">
            <p>Last backup: July 31, 2025 at 3:24 AM</p>
            <p>Next backup: August 1, 2025 at 3:24 AM</p>
          </div>
        </div>
      </div>
    </div>
  </div>
);

const APITab: React.FC = () => (
  <div>
    <div className="mb-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">API & Integration Tools</h1>
      <p className="text-gray-600">Connect with external services and manage your API access</p>
    </div>

    {/* API Overview */}
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">API Calls Today</p>
            <p className="text-2xl font-bold text-gray-900">1,247</p>
          </div>
          <span className="text-2xl">🔌</span>
        </div>
      </div>
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Active Integrations</p>
            <p className="text-2xl font-bold text-gray-900">8</p>
          </div>
          <span className="text-2xl">🔗</span>
        </div>
      </div>
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Webhooks</p>
            <p className="text-2xl font-bold text-gray-900">12</p>
          </div>
          <span className="text-2xl">📡</span>
        </div>
      </div>
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">API Status</p>
            <p className="text-2xl font-bold text-green-600">Online</p>
          </div>
          <span className="text-2xl">✅</span>
        </div>
      </div>
    </div>

    {/* API Keys Management */}
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-8">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">API Keys</h3>
          <button className="bg-yellow-500 text-white px-4 py-2 rounded-lg hover:bg-yellow-600 transition-colors">
            Generate New Key
          </button>
        </div>
      </div>
      <div className="divide-y divide-gray-200">
        {[
          { name: 'Production API Key', key: 'bz_prod_xxxxxxxxxxxxxxxx', created: 'Jan 15, 2025', lastUsed: '2 hours ago', status: 'Active' },
          { name: 'Development API Key', key: 'bz_dev_xxxxxxxxxxxxxxxx', created: 'Feb 3, 2025', lastUsed: '1 day ago', status: 'Active' },
          { name: 'Webhook API Key', key: 'bz_hook_xxxxxxxxxxxxxxxx', created: 'Mar 12, 2025', lastUsed: '5 minutes ago', status: 'Active' }
        ].map((apiKey, index) => (
          <div key={index} className="p-6 hover:bg-gray-50">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-gray-900">{apiKey.name}</h4>
                <div className="flex items-center space-x-4 text-sm text-gray-600 mt-1">
                  <span className="font-mono">{apiKey.key}</span>
                  <span>•</span>
                  <span>Created {apiKey.created}</span>
                  <span>•</span>
                  <span>Last used {apiKey.lastUsed}</span>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">
                  {apiKey.status}
                </span>
                <div className="flex space-x-2">
                  <button className="text-blue-600 hover:text-blue-700 text-sm">Copy</button>
                  <button className="text-gray-600 hover:text-gray-700 text-sm">Edit</button>
                  <button className="text-red-600 hover:text-red-700 text-sm">Revoke</button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>

    {/* Integrations */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Active Integrations</h3>
        </div>
        <div className="divide-y divide-gray-200">
          {[
            { name: 'Stripe', type: 'Payment Processing', status: 'Connected', icon: '💳' },
            { name: 'Mailchimp', type: 'Email Marketing', status: 'Connected', icon: '📧' },
            { name: 'Google Analytics', type: 'Analytics', status: 'Connected', icon: '📊' },
            { name: 'Zapier', type: 'Automation', status: 'Connected', icon: '⚡' }
          ].map((integration, index) => (
            <div key={index} className="p-4 hover:bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <span className="text-2xl">{integration.icon}</span>
                  <div>
                    <h4 className="font-medium text-gray-900">{integration.name}</h4>
                    <p className="text-sm text-gray-600">{integration.type}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">
                    {integration.status}
                  </span>
                  <button className="text-blue-600 hover:text-blue-700 text-sm">Configure</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Available Integrations</h3>
        </div>
        <div className="divide-y divide-gray-200">
          {[
            { name: 'PayPal', type: 'Payment Processing', icon: '💰' },
            { name: 'ConvertKit', type: 'Email Marketing', icon: '📬' },
            { name: 'Facebook Pixel', type: 'Tracking', icon: '👁️' },
            { name: 'Discord', type: 'Community', icon: '💬' }
          ].map((integration, index) => (
            <div key={index} className="p-4 hover:bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <span className="text-2xl">{integration.icon}</span>
                  <div>
                    <h4 className="font-medium text-gray-900">{integration.name}</h4>
                    <p className="text-sm text-gray-600">{integration.type}</p>
                  </div>
                </div>
                <button className="bg-yellow-500 text-white px-3 py-1 rounded text-sm hover:bg-yellow-600 transition-colors">
                  Connect
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>

    {/* Webhook Configuration */}
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 mt-8">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Webhook Endpoints</h3>
          <button className="bg-yellow-500 text-white px-4 py-2 rounded-lg hover:bg-yellow-600 transition-colors">
            Add Webhook
          </button>
        </div>
      </div>
      <div className="p-6">
        <div className="space-y-4">
          {[
            { url: 'https://your-app.com/webhooks/sales', events: ['sale.completed', 'sale.refunded'], status: 'Active' },
            { url: 'https://your-crm.com/beezio-webhook', events: ['affiliate.joined', 'commission.earned'], status: 'Active' }
          ].map((webhook, index) => (
            <div key={index} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900 font-mono text-sm">{webhook.url}</p>
                  <p className="text-sm text-gray-600 mt-1">
                    Events: {webhook.events.join(', ')}
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">
                    {webhook.status}
                  </span>
                  <button className="text-blue-600 hover:text-blue-700 text-sm">Test</button>
                  <button className="text-gray-600 hover:text-gray-700 text-sm">Edit</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

const CustomStoreTab: React.FC = () => (
  <div className="space-y-8">
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Custom Store Builder</h2>
      
      {/* Store Design Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Store Design & Branding</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Store Name</label>
            <input 
              type="text" 
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
              placeholder="My Awesome Store"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Store URL</label>
            <input 
              type="text" 
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
              placeholder="my-store.beezio.co"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Logo</label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
              <button className="text-yellow-600 hover:text-yellow-700 font-medium">
                Upload Logo
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Color Theme</label>
            <div className="flex space-x-2">
              <div className="w-8 h-8 bg-yellow-500 rounded-lg border-2 border-yellow-600 cursor-pointer"></div>
              <div className="w-8 h-8 bg-blue-500 rounded-lg border-2 border-transparent cursor-pointer"></div>
              <div className="w-8 h-8 bg-green-500 rounded-lg border-2 border-transparent cursor-pointer"></div>
              <div className="w-8 h-8 bg-purple-500 rounded-lg border-2 border-transparent cursor-pointer"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Store Templates */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Choose Template</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {['Modern', 'Classic', 'Minimal'].map((template) => (
            <div key={template} className="border border-gray-200 rounded-lg p-4 cursor-pointer hover:border-yellow-500 transition-colors">
              <div className="aspect-video bg-gray-100 rounded-lg mb-3"></div>
              <h4 className="font-medium text-gray-900">{template} Template</h4>
              <p className="text-sm text-gray-600">Clean and professional design</p>
            </div>
          ))}
        </div>
      </div>

      {/* Domain & SEO */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Domain & SEO Settings</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Custom Domain</label>
            <input 
              type="text" 
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
              placeholder="www.mystore.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Meta Description</label>
            <textarea 
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
              rows={3}
              placeholder="Describe your store for search engines..."
            />
          </div>
          <div className="flex justify-end">
            <button className="bg-yellow-500 text-white px-6 py-2 rounded-lg hover:bg-yellow-600 transition-colors">
              Save Store Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
);

const EnhancedAffiliateDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState('overview');

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return <AffiliateOverviewTab />;
      case 'links':
        return <LinksTab />;
      case 'analytics':
        return <AffiliateAnalyticsTab />;
      case 'earnings':
        return <EarningsTab />;
      case 'payments':
        return <AffiliatePaymentsTab />;
      case 'tools':
        return <AffiliateToolsTab />;
      case 'recruitment':
        return <RecruitmentTab />;
      default:
        return <AffiliateOverviewTab />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to="/" className="text-2xl font-bold bg-gradient-to-r from-yellow-600 via-yellow-500 to-amber-500 bg-clip-text text-transparent">
              🐝 Beezio.co
            </Link>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                <span className="text-sm text-gray-600">Online</span>
              </div>
              <span className="text-sm text-gray-600">Affiliate Dashboard</span>
              <button className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-colors">
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8 overflow-x-auto">
            {[
              { id: 'overview', label: 'Overview', icon: '📊' },
              { id: 'links', label: 'My Links', icon: '🔗' },
              { id: 'analytics', label: 'Analytics', icon: '📈' },
              { id: 'earnings', label: 'Earnings', icon: '💰' },
              { id: 'payments', label: 'Payments', icon: '💳' },
              { id: 'tools', label: 'Marketing Tools', icon: '🛠️' },
              { id: 'recruitment', label: 'Recruitment', icon: '👥' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-yellow-500 text-yellow-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } transition-colors`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {renderTabContent()}
      </div>
    </div>
  );
};

const AffiliateOverviewTab: React.FC = () => (
  <div>
    <div className="mb-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Affiliate Dashboard</h1>
      <p className="text-gray-600">Welcome back! Here's your affiliate performance overview</p>
    </div>

    {/* Enhanced Quick Stats */}
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Total Earnings</p>
            <p className="text-2xl font-bold text-gray-900">$3,247</p>
            <p className="text-sm text-green-600">+18% this month</p>
          </div>
          <div className="p-3 bg-green-100 rounded-lg">
            <span className="text-green-600 text-xl">💰</span>
          </div>
        </div>
      </div>
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">This Month</p>
            <p className="text-2xl font-bold text-gray-900">$847</p>
            <p className="text-sm text-blue-600">23 sales</p>
          </div>
          <div className="p-3 bg-blue-100 rounded-lg">
            <span className="text-blue-600 text-xl">📈</span>
          </div>
        </div>
      </div>
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Active Links</p>
            <p className="text-2xl font-bold text-gray-900">12</p>
            <p className="text-sm text-yellow-600">3 top performers</p>
          </div>
          <div className="p-3 bg-yellow-100 rounded-lg">
            <span className="text-yellow-600 text-xl">🔗</span>
          </div>
        </div>
      </div>
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Conversion Rate</p>
            <p className="text-2xl font-bold text-gray-900">4.8%</p>
            <p className="text-sm text-purple-600">Above average</p>
          </div>
          <div className="p-3 bg-purple-100 rounded-lg">
            <span className="text-purple-600 text-xl">🎯</span>
          </div>
        </div>
      </div>
    </div>

    {/* Performance Chart & Next Payment */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Earnings Trend (30 Days)</h3>
        <div className="h-64 flex items-end justify-between space-x-2">
          {[25, 32, 28, 45, 38, 52, 67, 43, 58, 72, 61, 84, 91, 76, 103].map((value, index) => (
            <div key={index} className="flex-1 bg-green-200 rounded-t" style={{ height: `${(value / 103) * 100}%` }}></div>
          ))}
        </div>
        <div className="flex justify-between text-sm text-gray-600 mt-4">
          <span>July 1</span>
          <span>July 15</span>
          <span>July 31</span>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment Schedule</h3>
        <div className="space-y-4">
          <div className="p-4 bg-green-50 rounded-lg border border-green-200">
            <div className="flex justify-between items-center">
              <span className="font-medium text-green-800">Next Payment</span>
              <span className="text-green-600 text-sm">Aug 15, 2025</span>
            </div>
            <div className="text-2xl font-bold text-green-800 mt-2">$487.50</div>
            <div className="text-sm text-green-600 mt-1">Direct Deposit • Bank ****1234</div>
          </div>
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex justify-between items-center">
              <span className="font-medium text-blue-800">Following Payment</span>
              <span className="text-blue-600 text-sm">Sep 1, 2025</span>
            </div>
            <div className="text-xl font-bold text-blue-800 mt-2">Est. $620</div>
            <div className="text-sm text-blue-600 mt-1">Based on current performance</div>
          </div>
        </div>
      </div>
    </div>

    {/* Top Products & Recent Activity */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Performing Products</h3>
        <div className="space-y-4">
          {[
            { name: "Digital Marketing Course", earnings: "$174.60", sales: 12, rate: "5.1%", trend: "+15%" },
            { name: "SEO Audit Tool", earnings: "$96.00", sales: 8, rate: "4.2%", trend: "+8%" },
            { name: "Social Media Templates", earnings: "$23.20", sales: 4, rate: "3.8%", trend: "+12%" }
          ].map((product, index) => (
            <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <h4 className="font-medium text-gray-900">{product.name}</h4>
                <p className="text-sm text-gray-600">{product.sales} sales • {product.rate} conversion</p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-gray-900">{product.earnings}</p>
                <p className="text-sm text-green-600">{product.trend}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
        <div className="space-y-4">
          {[
            { type: 'commission', message: 'Commission earned: Digital Marketing Course', time: '2 minutes ago', amount: '$14.55' },
            { type: 'click', message: '12 new clicks on SEO Audit Tool link', time: '1 hour ago', amount: null },
            { type: 'milestone', message: 'Reached $3,000 total earnings milestone!', time: '2 hours ago', amount: null },
            { type: 'payment', message: 'Payment processed to bank account', time: '2 days ago', amount: '$425.30' }
          ].map((activity, index) => (
            <div key={index} className="flex items-center justify-between p-4 hover:bg-gray-50 rounded-lg transition-colors">
              <div className="flex items-center">
                <div className={`w-3 h-3 rounded-full mr-4 ${
                  activity.type === 'commission' ? 'bg-green-500' :
                  activity.type === 'click' ? 'bg-blue-500' :
                  activity.type === 'milestone' ? 'bg-yellow-500' : 'bg-purple-500'
                }`}></div>
                <div>
                  <p className="font-medium text-gray-900">{activity.message}</p>
                  <p className="text-sm text-gray-500">{activity.time}</p>
                </div>
              </div>
              {activity.amount && (
                <span className="font-semibold text-green-600">{activity.amount}</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

const LinksTab: React.FC = () => (
  <div>
    <div className="flex items-center justify-between mb-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">My Affiliate Links</h1>
        <p className="text-gray-600">Manage your site-wide and product-specific affiliate links</p>
      </div>
      <button className="bg-yellow-500 text-white px-6 py-3 rounded-lg hover:bg-yellow-600 transition-colors font-medium">
        Browse Products
      </button>
    </div>

    {/* Master Affiliate Links */}
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-8">
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900">Master Affiliate Links</h2>
        <p className="text-gray-600 mt-1">These links earn you commissions on ANY purchase made by your referred customers</p>
      </div>
      <div className="p-6 space-y-4">
        <div className="bg-gradient-to-r from-yellow-50 to-amber-50 border-2 border-yellow-300 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-semibold text-gray-900">🌟 Site-Wide Referral Link</h3>
              <p className="text-sm text-gray-600">Earn commission on ALL purchases made by your referrals</p>
            </div>
            <span className="bg-yellow-500 text-white px-3 py-1 rounded-full text-sm font-medium">Universal</span>
          </div>
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <input 
                type="text" 
                value="https://beezio.co?ref=yourname"
                readOnly
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 bg-white font-mono text-sm"
              />
              <button className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors">
                Copy
              </button>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">Short link:</span>
              <input 
                type="text" 
                value="https://bz.co/yourname"
                readOnly
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 bg-white font-mono text-sm"
              />
              <button className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition-colors">
                Copy
              </button>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between text-sm">
            <div className="flex space-x-4">
              <span className="text-green-600">✓ Lifetime cookie</span>
              <span className="text-blue-600">✓ All product commissions</span>
              <span className="text-purple-600">✓ Recurring earnings</span>
            </div>
            <div className="text-right">
              <p className="font-semibold text-gray-900">Total Earnings: $2,847.50</p>
              <p className="text-xs text-gray-600">This month: $634.20</p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-300 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-semibold text-gray-900">🔗 Custom Landing Page Link</h3>
              <p className="text-sm text-gray-600">Direct visitors to your personalized affiliate landing page</p>
            </div>
            <span className="bg-blue-500 text-white px-3 py-1 rounded-full text-sm font-medium">Custom</span>
          </div>
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <input 
                type="text" 
                value="https://beezio.co/affiliate/yourname"
                readOnly
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 bg-white font-mono text-sm"
              />
              <button className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors">
                Copy
              </button>
              <button className="bg-purple-500 text-white px-4 py-2 rounded-lg hover:bg-purple-600 transition-colors">
                Preview
              </button>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between text-sm">
            <div className="flex space-x-4">
              <span className="text-green-600">✓ Branded page</span>
              <span className="text-blue-600">✓ Your bio & photo</span>
              <span className="text-purple-600">✓ Top products featured</span>
            </div>
            <div className="text-right">
              <p className="font-semibold text-gray-900">Total Earnings: $399.35</p>
              <p className="text-xs text-gray-600">This month: $89.15</p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-300 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-semibold text-gray-900">🏪 Custom Affiliate Store</h3>
              <p className="text-sm text-gray-600">Your own branded storefront with curated products</p>
            </div>
            <span className="bg-purple-500 text-white px-3 py-1 rounded-full text-sm font-medium">Premium</span>
          </div>
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <input 
                type="text" 
                value="https://store.beezio.co/yourname"
                readOnly
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 bg-white font-mono text-sm"
              />
              <button className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors">
                Copy
              </button>
              <button className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition-colors">
                Customize
              </button>
              <button className="bg-purple-500 text-white px-4 py-2 rounded-lg hover:bg-purple-600 transition-colors">
                Visit Store
              </button>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between text-sm">
            <div className="flex space-x-4">
              <span className="text-green-600">✓ Custom domain available</span>
              <span className="text-blue-600">✓ Product collections</span>
              <span className="text-purple-600">✓ Shopping cart & checkout</span>
            </div>
            <div className="text-right">
              <p className="font-semibold text-gray-900">Store Earnings: $1,247.85</p>
              <p className="text-xs text-gray-600">This month: $315.40</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    {/* Link Performance Overview */}
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Site-Wide Clicks</p>
            <p className="text-2xl font-bold text-gray-900">12,847</p>
            <p className="text-sm text-green-600">Universal link</p>
          </div>
          <span className="text-2xl">🌟</span>
        </div>
      </div>
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Product Clicks</p>
            <p className="text-2xl font-bold text-gray-900">8,247</p>
            <p className="text-sm text-blue-600">Specific products</p>
          </div>
          <span className="text-2xl">🔗</span>
        </div>
      </div>
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Total Conversions</p>
            <p className="text-2xl font-bold text-gray-900">734</p>
            <p className="text-sm text-yellow-600">4.8% rate</p>
          </div>
          <span className="text-2xl">�</span>
        </div>
      </div>
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Combined Earnings</p>
            <p className="text-2xl font-bold text-gray-900">$3,247</p>
            <p className="text-sm text-purple-600">All link types</p>
          </div>
          <span className="text-2xl">💎</span>
        </div>
      </div>
    </div>

    {/* Link Filters */}
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
          <select className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-yellow-500 focus:border-transparent">
            <option>All Links</option>
            <option>Active</option>
            <option>Paused</option>
            <option>Expired</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Performance</label>
          <select className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-yellow-500 focus:border-transparent">
            <option>All Performance</option>
            <option>Top Performers</option>
            <option>Needs Attention</option>
            <option>New Links</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Date Range</label>
          <select className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-yellow-500 focus:border-transparent">
            <option>Last 30 Days</option>
            <option>Last 7 Days</option>
            <option>Last 90 Days</option>
            <option>All Time</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
          <input type="text" placeholder="Search products..." className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-yellow-500 focus:border-transparent" />
        </div>
      </div>
    </div>

    {/* Product-Specific Links List */}
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Product-Specific Links (12)</h2>
            <p className="text-gray-600 text-sm mt-1">Individual product affiliate links with targeted commissions</p>
          </div>
          <button className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition-colors text-sm">
            + Create Product Link
          </button>
        </div>
      </div>
      <div className="divide-y divide-gray-200">
        {[
          { 
            product: "Digital Marketing Course", 
            commission: "$14.55", 
            clicks: 1234, 
            sales: 63, 
            rate: "5.1%",
            earnings: "$916.65",
            created: "Jan 15, 2025",
            status: "Active",
            trend: "+12%"
          },
          { 
            product: "SEO Audit Tool", 
            commission: "$12.00", 
            clicks: 856, 
            sales: 36, 
            rate: "4.2%",
            earnings: "$432.00",
            created: "Feb 3, 2025",
            status: "Active",
            trend: "+8%"
          },
          { 
            product: "Social Media Templates", 
            commission: "$5.80", 
            clicks: 1567, 
            sales: 78, 
            rate: "5.0%",
            earnings: "$452.40",
            created: "Mar 12, 2025",
            status: "Active",
            trend: "+15%"
          },
          { 
            product: "Email Marketing Guide", 
            commission: "$8.00", 
            clicks: 234, 
            sales: 8, 
            rate: "3.4%",
            earnings: "$64.00",
            created: "Apr 8, 2025",
            status: "Active",
            trend: "+5%"
          }
        ].map((link, index) => (
          <div key={index} className="p-6 hover:bg-gray-50">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-yellow-100 to-amber-100 rounded-lg flex items-center justify-center">
                    <span className="text-yellow-600 text-xs font-medium">LINK</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">{link.product}</h3>
                    <div className="flex items-center space-x-6 mt-2 text-sm text-gray-600">
                      <span>Commission: {link.commission}</span>
                      <span>Clicks: {link.clicks.toLocaleString()}</span>
                      <span>Sales: {link.sales}</span>
                      <span>Rate: {link.rate}</span>
                      <span>Earnings: {link.earnings}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <div className="text-right">
                  <p className="text-sm font-medium text-green-600">{link.trend}</p>
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    link.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {link.status}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <button className="text-blue-600 hover:text-blue-700 px-3 py-1 text-sm">Copy Link</button>
                  <button className="text-green-600 hover:text-green-700 px-3 py-1 text-sm">Share</button>
                  <button className="text-gray-600 hover:text-gray-700 px-3 py-1 text-sm">Analytics</button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

const AffiliateAnalyticsTab: React.FC = () => (
  <div>
    <div className="mb-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Analytics & Performance</h1>
      <p className="text-gray-600">Deep insights into your affiliate performance</p>
    </div>

    {/* Time Range Selector */}
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Performance Dashboard</h3>
        <div className="flex space-x-2">
          {['7D', '30D', '90D', '1Y'].map((period) => (
            <button key={period} className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50">
              {period}
            </button>
          ))}
        </div>
      </div>
    </div>

    {/* Detailed Analytics */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Click Analytics</h3>
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Total Clicks</span>
            <span className="font-semibold text-gray-900">8,247</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Unique Visitors</span>
            <span className="font-semibold text-gray-900">6,834</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Return Visitors</span>
            <span className="font-semibold text-gray-900">1,413</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Average CTR</span>
            <span className="font-semibold text-yellow-600">4.8%</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Conversion Metrics</h3>
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Total Conversions</span>
            <span className="font-semibold text-gray-900">396</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Conversion Rate</span>
            <span className="font-semibold text-gray-900">4.8%</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Average Order Value</span>
            <span className="font-semibold text-gray-900">$67.50</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Revenue Generated</span>
            <span className="font-semibold text-green-600">$26,730</span>
          </div>
        </div>
      </div>
    </div>

    {/* Traffic Sources */}
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Traffic Sources</h3>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { source: 'Social Media', clicks: '3,456', percentage: '42%', color: 'bg-blue-500' },
          { source: 'Email Marketing', clicks: '2,234', percentage: '27%', color: 'bg-green-500' },
          { source: 'Blog/Content', clicks: '1,789', percentage: '22%', color: 'bg-purple-500' },
          { source: 'Direct', clicks: '768', percentage: '9%', color: 'bg-yellow-500' }
        ].map((source, index) => (
          <div key={index} className="text-center">
            <div className={`w-16 h-16 ${source.color} rounded-full flex items-center justify-center mx-auto mb-3`}>
              <span className="text-white font-bold">{source.percentage}</span>
            </div>
            <h4 className="font-medium text-gray-900">{source.source}</h4>
            <p className="text-sm text-gray-600">{source.clicks} clicks</p>
          </div>
        ))}
      </div>
    </div>

    {/* Performance by Product */}
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance by Product</h3>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-3 px-4 font-medium text-gray-900">Product</th>
              <th className="text-left py-3 px-4 font-medium text-gray-900">Clicks</th>
              <th className="text-left py-3 px-4 font-medium text-gray-900">Sales</th>
              <th className="text-left py-3 px-4 font-medium text-gray-900">Conversion</th>
              <th className="text-left py-3 px-4 font-medium text-gray-900">Earnings</th>
              <th className="text-left py-3 px-4 font-medium text-gray-900">Trend</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {[
              { name: 'Digital Marketing Course', clicks: 1234, sales: 63, conversion: '5.1%', earnings: '$916.65', trend: '+12%' },
              { name: 'Social Media Templates', clicks: 1567, sales: 78, conversion: '5.0%', earnings: '$452.40', trend: '+15%' },
              { name: 'SEO Audit Tool', clicks: 856, sales: 36, conversion: '4.2%', earnings: '$432.00', trend: '+8%' },
              { name: 'Email Marketing Guide', clicks: 234, sales: 8, conversion: '3.4%', earnings: '$64.00', trend: '+5%' }
            ].map((product, index) => (
              <tr key={index} className="hover:bg-gray-50">
                <td className="py-3 px-4 font-medium">{product.name}</td>
                <td className="py-3 px-4">{product.clicks.toLocaleString()}</td>
                <td className="py-3 px-4">{product.sales}</td>
                <td className="py-3 px-4">{product.conversion}</td>
                <td className="py-3 px-4 text-green-600 font-semibold">{product.earnings}</td>
                <td className="py-3 px-4 text-green-600">{product.trend}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  </div>
);

const EarningsTab: React.FC = () => (
  <div>
    <div className="mb-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Earnings Dashboard</h1>
      <p className="text-gray-600">Detailed breakdown of your affiliate earnings</p>
    </div>

    {/* Earnings Overview */}
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">All-Time Earnings</p>
            <p className="text-2xl font-bold text-gray-900">$3,247.85</p>
          </div>
          <span className="text-2xl">💰</span>
        </div>
      </div>
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">This Month</p>
            <p className="text-2xl font-bold text-gray-900">$847.50</p>
          </div>
          <span className="text-2xl">📈</span>
        </div>
      </div>
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Pending</p>
            <p className="text-2xl font-bold text-yellow-600">$487.50</p>
          </div>
          <span className="text-2xl">⏳</span>
        </div>
      </div>
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Avg Per Sale</p>
            <p className="text-2xl font-bold text-gray-900">$16.35</p>
          </div>
          <span className="text-2xl">💳</span>
        </div>
      </div>
    </div>

    {/* Earnings Breakdown */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Earnings by Product</h3>
        </div>
        <div className="p-6">
          <div className="space-y-4">
            {[
              { name: 'Digital Marketing Course', earnings: '$916.65', percentage: '28%', sales: 63 },
              { name: 'Social Media Templates', earnings: '$452.40', percentage: '14%', sales: 78 },
              { name: 'SEO Audit Tool', earnings: '$432.00', percentage: '13%', sales: 36 },
              { name: 'Email Marketing Guide', earnings: '$364.80', percentage: '11%', sales: 24 },
              { name: 'Other Products', earnings: '$1,082.00', percentage: '34%', sales: 85 }
            ].map((product, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium text-gray-900">{product.name}</span>
                    <span className="text-sm font-semibold text-gray-900">{product.earnings}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-yellow-500 h-2 rounded-full" 
                        style={{ width: product.percentage }}
                      ></div>
                    </div>
                    <span className="text-xs text-gray-500">{product.sales} sales</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Monthly Earnings History</h3>
        </div>
        <div className="divide-y divide-gray-200">
          {[
            { month: 'July 2025', earnings: '$847.50', sales: 42, growth: '+18%' },
            { month: 'June 2025', earnings: '$718.25', sales: 38, growth: '+12%' },
            { month: 'May 2025', earnings: '$641.20', sales: 34, growth: '+25%' },
            { month: 'April 2025', earnings: '$513.60', sales: 29, growth: '+8%' },
            { month: 'March 2025', earnings: '$475.30', sales: 27, growth: '+15%' }
          ].map((month, index) => (
            <div key={index} className="p-4 hover:bg-gray-50">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">{month.month}</p>
                  <p className="text-sm text-gray-600">{month.sales} sales</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-gray-900">{month.earnings}</p>
                  <p className="text-sm text-green-600">{month.growth}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>

    {/* Commission Tiers */}
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="p-6 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">Commission Tiers & Bonuses</h3>
      </div>
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="text-center">
              <span className="text-2xl mb-2 block">🥉</span>
              <h4 className="font-semibold text-gray-900">Bronze Tier</h4>
              <p className="text-sm text-gray-600 mt-1">$0 - $1,000 monthly</p>
              <p className="text-sm text-yellow-600 font-medium mt-2">Base Commission Rates</p>
            </div>
          </div>
          <div className="border-2 border-yellow-500 rounded-lg p-4 bg-yellow-50">
            <div className="text-center">
              <span className="text-2xl mb-2 block">🥈</span>
              <h4 className="font-semibold text-gray-900">Silver Tier</h4>
              <p className="text-sm text-gray-600 mt-1">$1,000+ monthly</p>
              <p className="text-sm text-yellow-600 font-medium mt-2">+5% Bonus • Current Tier</p>
            </div>
          </div>
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="text-center">
              <span className="text-2xl mb-2 block">🥇</span>
              <h4 className="font-semibold text-gray-900">Gold Tier</h4>
              <p className="text-sm text-gray-600 mt-1">$2,500+ monthly</p>
              <p className="text-sm text-green-600 font-medium mt-2">+10% Bonus • $652 to unlock</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

const AffiliatePaymentsTab: React.FC = () => (
  <div>
    <div className="mb-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Payment Management</h1>
      <p className="text-gray-600">Track payments, manage payout methods, and view history</p>
    </div>

    {/* Payment Overview */}
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Available Balance</p>
            <p className="text-2xl font-bold text-green-600">$487.50</p>
          </div>
          <span className="text-2xl">💰</span>
        </div>
      </div>
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Next Payout</p>
            <p className="text-2xl font-bold text-gray-900">Aug 15</p>
          </div>
          <span className="text-2xl">📅</span>
        </div>
      </div>
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Total Paid</p>
            <p className="text-2xl font-bold text-gray-900">$2,760.35</p>
          </div>
          <span className="text-2xl">📤</span>
        </div>
      </div>
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Payout Method</p>
            <p className="text-2xl font-bold text-gray-900">Bank</p>
          </div>
          <span className="text-2xl">🏦</span>
        </div>
      </div>
    </div>

    {/* Payment Schedule & Methods */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Upcoming Payments</h3>
        </div>
        <div className="p-6 space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-green-800">Next Payment</p>
                <p className="text-2xl font-bold text-green-800">$487.50</p>
                <p className="text-sm text-green-600">August 15, 2025</p>
                <p className="text-xs text-green-600 mt-1">Direct Deposit • Bank ****1234</p>
              </div>
              <span className="text-3xl text-green-600">💰</span>
            </div>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-blue-800">Following Payment</p>
                <p className="text-xl font-bold text-blue-800">Est. $620</p>
                <p className="text-sm text-blue-600">September 1, 2025</p>
                <p className="text-xs text-blue-600 mt-1">Based on current performance</p>
              </div>
              <span className="text-3xl text-blue-600">📅</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Payment Methods</h3>
        </div>
        <div className="p-6 space-y-4">
          <div className="border-2 border-green-200 bg-green-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <span className="text-2xl mr-3">🏦</span>
                <div>
                  <p className="font-medium text-green-800">Bank Transfer</p>
                  <p className="text-sm text-green-600">****1234 • Primary Method</p>
                  <p className="text-xs text-green-600">Processing: 1-2 business days</p>
                </div>
              </div>
              <span className="bg-green-600 text-white px-2 py-1 rounded-full text-xs">Active</span>
            </div>
          </div>
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <span className="text-2xl mr-3">💳</span>
                <div>
                  <p className="font-medium text-gray-700">PayPal</p>
                  <p className="text-sm text-gray-500">affiliate@email.com</p>
                  <p className="text-xs text-gray-500">Processing: Instant</p>
                </div>
              </div>
              <button className="text-blue-600 hover:text-blue-700 text-sm">Set Primary</button>
            </div>
          </div>
          <button className="w-full border-2 border-dashed border-gray-300 rounded-lg p-4 text-gray-600 hover:border-yellow-500 hover:text-yellow-600 transition-colors">
            + Add Payment Method
          </button>
        </div>
      </div>
    </div>

    {/* Payment History */}
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="p-6 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">Payment History</h3>
      </div>
      <div className="divide-y divide-gray-200">
        {[
          { date: 'July 15, 2025', amount: '$425.30', method: 'Bank Transfer', status: 'Completed', reference: 'BZ-240715-001' },
          { date: 'July 1, 2025', amount: '$378.95', method: 'Bank Transfer', status: 'Completed', reference: 'BZ-240701-001' },
          { date: 'June 15, 2025', amount: '$293.25', method: 'Bank Transfer', status: 'Completed', reference: 'BZ-240615-001' },
          { date: 'June 1, 2025', amount: '$354.80', method: 'PayPal', status: 'Completed', reference: 'BZ-240601-001' },
          { date: 'May 15, 2025', amount: '$267.45', method: 'Bank Transfer', status: 'Completed', reference: 'BZ-240515-001' }
        ].map((payment, index) => (
          <div key={index} className="p-6 hover:bg-gray-50">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">{payment.date}</p>
                <p className="text-sm text-gray-600">{payment.method} • {payment.reference}</p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-gray-900">{payment.amount}</p>
                <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">
                  {payment.status}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

const AffiliateToolsTab: React.FC = () => (
  <div>
    <div className="mb-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Marketing Tools</h1>
      <p className="text-gray-600">Resources and tools to boost your affiliate marketing success</p>
    </div>

    {/* Tool Categories */}
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="text-center mb-4">
          <span className="text-4xl mb-4 block">🎨</span>
          <h3 className="text-lg font-semibold text-gray-900">Creative Assets</h3>
          <p className="text-sm text-gray-600 mt-2">Banners, graphics, and promotional materials</p>
        </div>
        <button className="w-full bg-yellow-500 text-white py-2 rounded-lg hover:bg-yellow-600 transition-colors">
          Browse Assets
        </button>
      </div>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="text-center mb-4">
          <span className="text-4xl mb-4 block">📊</span>
          <h3 className="text-lg font-semibold text-gray-900">Analytics Tools</h3>
          <p className="text-sm text-gray-600 mt-2">Track performance and optimize campaigns</p>
        </div>
        <button className="w-full bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600 transition-colors">
          View Analytics
        </button>
      </div>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="text-center mb-4">
          <span className="text-4xl mb-4 block">🔗</span>
          <h3 className="text-lg font-semibold text-gray-900">Link Generator</h3>
          <p className="text-sm text-gray-600 mt-2">Create custom tracking links and UTM codes</p>
        </div>
        <button className="w-full bg-green-500 text-white py-2 rounded-lg hover:bg-green-600 transition-colors">
          Generate Links
        </button>
      </div>
    </div>

    {/* Link Generator Tool */}
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-8">
      <div className="p-6 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">Advanced Link Generator</h3>
      </div>
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Select Product</label>
              <select className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-yellow-500 focus:border-transparent">
                <option>Digital Marketing Course</option>
                <option>SEO Audit Tool</option>
                <option>Social Media Templates</option>
                <option>Email Marketing Guide</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Campaign Name</label>
              <input type="text" placeholder="e.g., summer-promo-2025" className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-yellow-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Traffic Source</label>
              <select className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-yellow-500 focus:border-transparent">
                <option>Social Media</option>
                <option>Email Marketing</option>
                <option>Blog/Content</option>
                <option>Paid Ads</option>
                <option>YouTube</option>
                <option>Other</option>
              </select>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Generated Link</label>
              <div className="flex space-x-2">
                <input 
                  type="text" 
                  value="https://beezio.co/ref/yourname/marketing-course?utm_campaign=summer-promo-2025&utm_source=social"
                  readOnly
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 bg-gray-50 text-sm font-mono"
                />
                <button className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors">
                  Copy
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Short Link</label>
              <div className="flex space-x-2">
                <input 
                  type="text" 
                  value="https://bz.co/abc123"
                  readOnly
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 bg-gray-50 text-sm font-mono"
                />
                <button className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition-colors">
                  Copy
                </button>
              </div>
            </div>
            <button className="w-full bg-yellow-500 text-white py-2 rounded-lg hover:bg-yellow-600 transition-colors">
              Generate New Link
            </button>
          </div>
        </div>
      </div>
    </div>

    {/* Marketing Resources */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Creative Assets</h3>
        </div>
        <div className="divide-y divide-gray-200">
          {[
            { name: 'Social Media Banner Pack', type: 'Images', size: '2.4 MB', downloads: 1247 },
            { name: 'Email Templates', type: 'HTML', size: '156 KB', downloads: 892 },
            { name: 'Product Screenshots', type: 'Images', size: '5.8 MB', downloads: 2134 },
            { name: 'Video Promotional Clips', type: 'Video', size: '45 MB', downloads: 567 }
          ].map((asset, index) => (
            <div key={index} className="p-4 hover:bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <span className="text-blue-600 text-sm font-bold">
                      {asset.type === 'Images' ? '🖼️' : asset.type === 'HTML' ? '📧' : '🎥'}
                    </span>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">{asset.name}</h4>
                    <p className="text-sm text-gray-600">{asset.type} • {asset.size} • {asset.downloads} downloads</p>
                  </div>
                </div>
                <button className="text-blue-600 hover:text-blue-700 text-sm">Download</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Marketing Templates</h3>
        </div>
        <div className="divide-y divide-gray-200">
          {[
            { name: 'Social Media Posts', description: 'Ready-to-use social media content', category: 'Social' },
            { name: 'Email Campaign Templates', description: 'Professional email marketing templates', category: 'Email' },
            { name: 'Blog Post Outlines', description: 'Content ideas and structures', category: 'Content' },
            { name: 'Video Script Templates', description: 'Scripts for promotional videos', category: 'Video' }
          ].map((template, index) => (
            <div key={index} className="p-4 hover:bg-gray-50">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-gray-900">{template.name}</h4>
                  <p className="text-sm text-gray-600">{template.description}</p>
                  <span className="inline-block bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded-full mt-1">
                    {template.category}
                  </span>
                </div>
                <button className="text-green-600 hover:text-green-700 text-sm">Use Template</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

const RecruitmentTab: React.FC = () => (
  <div>
    <div className="mb-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Affiliate Recruitment</h1>
      <p className="text-gray-600">Build your network and earn additional commissions</p>
    </div>

    {/* Recruitment Overview */}
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Referred Affiliates</p>
            <p className="text-2xl font-bold text-gray-900">8</p>
          </div>
          <span className="text-2xl">👥</span>
        </div>
      </div>
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Recruitment Bonus</p>
            <p className="text-2xl font-bold text-gray-900">$240</p>
          </div>
          <span className="text-2xl">🎁</span>
        </div>
      </div>
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Override Earnings</p>
            <p className="text-2xl font-bold text-gray-900">$127.50</p>
          </div>
          <span className="text-2xl">💰</span>
        </div>
      </div>
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">This Month</p>
            <p className="text-2xl font-bold text-gray-900">2</p>
          </div>
          <span className="text-2xl">📈</span>
        </div>
      </div>
    </div>

    {/* Recruitment Program */}
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-8">
      <div className="p-6 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">Recruitment Program Benefits</h3>
      </div>
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center p-4 border border-gray-200 rounded-lg">
            <span className="text-3xl mb-3 block">🎯</span>
            <h4 className="font-semibold text-gray-900 mb-2">$30 Sign-up Bonus</h4>
            <p className="text-sm text-gray-600">Earn $30 for each affiliate who joins through your link</p>
          </div>
          <div className="text-center p-4 border border-gray-200 rounded-lg">
            <span className="text-3xl mb-3 block">📊</span>
            <h4 className="font-semibold text-gray-900 mb-2">3% Override Commission</h4>
            <p className="text-sm text-gray-600">Earn 3% of all sales made by your referrals</p>
          </div>
          <div className="text-center p-4 border border-gray-200 rounded-lg">
            <span className="text-3xl mb-3 block">🏆</span>
            <h4 className="font-semibold text-gray-900 mb-2">Performance Bonuses</h4>
            <p className="text-sm text-gray-600">Monthly bonuses for top recruiters</p>
          </div>
        </div>
      </div>
    </div>

    {/* Recruitment Link */}
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-8">
      <div className="p-6 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">Your Recruitment Link</h3>
      </div>
      <div className="p-6">
        <div className="flex space-x-4">
          <input 
            type="text" 
            value="https://beezio.co/join?ref=yourname"
            readOnly
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 bg-gray-50 font-mono text-sm"
          />
          <button className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 transition-colors">
            Copy Link
          </button>
          <button className="bg-green-500 text-white px-6 py-2 rounded-lg hover:bg-green-600 transition-colors">
            Share
          </button>
        </div>
        <p className="text-sm text-gray-600 mt-2">
          Share this link to invite others to join as affiliates. You'll earn bonuses and override commissions!
        </p>
      </div>
    </div>

    {/* Your Referrals */}
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="p-6 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">Your Referrals</h3>
      </div>
      <div className="divide-y divide-gray-200">
        {[
          { name: 'Sarah Johnson', email: 's.johnson@email.com', joinDate: 'July 25, 2025', status: 'Active', earnings: '$45.30', bonus: '$30' },
          { name: 'Mike Chen', email: 'mike.chen@email.com', joinDate: 'July 18, 2025', status: 'Active', earnings: '$82.20', bonus: '$30' },
          { name: 'Lisa Rodriguez', email: 'lisa.r@email.com', joinDate: 'June 30, 2025', status: 'Active', earnings: '$156.40', bonus: '$30' },
          { name: 'David Kim', email: 'dkim@email.com', joinDate: 'June 15, 2025', status: 'Inactive', earnings: '$23.10', bonus: '$30' }
        ].map((referral, index) => (
          <div key={index} className="p-6 hover:bg-gray-50">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-gray-900">{referral.name}</h4>
                <p className="text-sm text-gray-600">{referral.email}</p>
                <p className="text-xs text-gray-500">Joined {referral.joinDate}</p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-gray-900">Override: {referral.earnings}</p>
                <p className="text-sm text-green-600">Bonus: {referral.bonus}</p>
                <span className={`px-2 py-1 text-xs rounded-full ${
                  referral.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                }`}>
                  {referral.status}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

const EnhancedBuyerDashboard: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to="/" className="text-2xl font-bold bg-gradient-to-r from-yellow-600 via-yellow-500 to-amber-500 bg-clip-text text-transparent">
              🐝 Beezio.co
            </Link>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">My Account</span>
              <button className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-colors">
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">My Dashboard</h1>
          <p className="text-gray-600">Manage your orders, subscriptions, and account settings</p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <span className="text-blue-600 text-xl">📦</span>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Orders</p>
                <p className="text-2xl font-bold text-gray-900">27</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <span className="text-green-600 text-xl">💰</span>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Spent</p>
                <p className="text-2xl font-bold text-gray-900">$1,847</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <span className="text-purple-600 text-xl">⭐</span>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Wishlist Items</p>
                <p className="text-2xl font-bold text-gray-900">14</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <span className="text-yellow-600 text-xl">🔔</span>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Subscriptions</p>
                <p className="text-2xl font-bold text-gray-900">3</p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Recent Orders */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">Recent Orders</h2>
              </div>
              <div className="divide-y divide-gray-200">
                {[
                  { product: "Digital Marketing Course", date: "July 28, 2025", price: "$97.00", status: "Completed" },
                  { product: "SEO Audit Tool", date: "July 25, 2025", price: "$49.00", status: "Completed" },
                  { product: "Social Media Templates", date: "July 20, 2025", price: "$29.00", status: "Completed" }
                ].map((order, index) => (
                  <div key={index} className="p-6 hover:bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-medium text-gray-900">{order.product}</h3>
                        <div className="flex items-center space-x-4 mt-1 text-sm text-gray-600">
                          <span>Date: {order.date}</span>
                          <span>Price: {order.price}</span>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          order.status === 'Completed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {order.status}
                        </span>
                        <button className="text-blue-600 hover:text-blue-700">View</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
              <div className="space-y-3">
                <button className="w-full text-left p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center">
                    <span className="text-lg mr-3">⭐</span>
                    <span className="font-medium">View Wishlist</span>
                  </div>
                </button>
                <button className="w-full text-left p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center">
                    <span className="text-lg mr-3">🔔</span>
                    <span className="font-medium">Manage Subscriptions</span>
                  </div>
                </button>
                <button className="w-full text-left p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center">
                    <span className="text-lg mr-3">⚙️</span>
                    <span className="font-medium">Account Settings</span>
                  </div>
                </button>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Recommended for You</h3>
              <div className="space-y-4">
                <div className="border border-gray-200 rounded-lg p-3">
                  <h4 className="font-medium text-gray-900">Advanced SEO Course</h4>
                  <p className="text-sm text-gray-600 mt-1">$67.00</p>
                  <button className="text-yellow-600 hover:text-yellow-700 text-sm font-medium mt-2">
                    View Details
                  </button>
                </div>
                <div className="border border-gray-200 rounded-lg p-3">
                  <h4 className="font-medium text-gray-900">Email Marketing Tools</h4>
                  <p className="text-sm text-gray-600 mt-1">$39.00</p>
                  <button className="text-yellow-600 hover:text-yellow-700 text-sm font-medium mt-2">
                    View Details
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const MinimalApp: React.FC = () => {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/seller-dashboard" element={<EnhancedSellerDashboard />} />
          <Route path="/affiliate-dashboard" element={<EnhancedAffiliateDashboard />} />
          <Route path="/buyer-dashboard" element={<EnhancedBuyerDashboard />} />
        </Routes>
      </div>
    </Router>
  );
};

const HomePage: React.FC = () => {
  const [authModal, setAuthModal] = useState<{ isOpen: boolean; mode: 'login' | 'register' }>({ isOpen: false, mode: 'login' });
  const navigate = useNavigate();

  const handleLogin = (role: string) => {
    setAuthModal({ isOpen: false, mode: 'login' });
    // Navigate to appropriate dashboard based on role
    if (role === 'seller') {
      navigate('/seller-dashboard');
    } else if (role === 'affiliate') {
      navigate('/affiliate-dashboard');
    } else {
      navigate('/buyer-dashboard');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Link to="/" className="text-2xl font-bold bg-gradient-to-r from-yellow-600 via-yellow-500 to-amber-500 bg-clip-text text-transparent">
                🐝 Beezio.co
              </Link>
            </div>
            <div className="flex items-center space-x-8">
              <nav className="hidden md:flex space-x-8">
                <a href="/" className="text-gray-700 hover:text-yellow-600 font-medium transition-colors">Home</a>
                <a href="/products" className="text-gray-700 hover:text-yellow-600 font-medium transition-colors">Marketplace</a>
                <a href="/fundraisers" className="text-gray-700 hover:text-yellow-600 font-medium transition-colors">Fundraisers</a>
                <a href="/how-it-works" className="text-gray-700 hover:text-yellow-600 font-medium transition-colors">How It Works</a>
              </nav>
              <div className="flex items-center space-x-4">
                <button 
                  onClick={() => setAuthModal({ isOpen: true, mode: 'login' })}
                  className="text-gray-700 hover:text-yellow-600 font-medium transition-colors"
                >
                  Login
                </button>
                <button 
                  onClick={() => setAuthModal({ isOpen: true, mode: 'register' })}
                  className="bg-yellow-500 text-white px-4 py-2 rounded-lg hover:bg-yellow-600 font-medium transition-colors"
                >
                  Join Now
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <div className="relative bg-gradient-to-br from-yellow-50 via-amber-50 to-orange-50 border-b border-yellow-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center">
            <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6 tracking-tight">
              Welcome to <span className="bg-gradient-to-r from-yellow-600 to-amber-600 bg-clip-text text-transparent">Beezio.co</span>
            </h1>
            <p className="text-xl text-gray-700 mb-8 max-w-3xl mx-auto leading-relaxed">
              The transparent marketplace where sellers keep 100% of their price, 
              affiliates earn fair commissions, and buyers see exactly where every dollar goes.
            </p>
            
            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <button 
                onClick={() => setAuthModal({ isOpen: true, mode: 'register' })}
                className="bg-yellow-500 text-white px-8 py-3 rounded-lg font-semibold hover:bg-yellow-600 transition-colors shadow-sm"
              >
                Start Selling
              </button>
              <button 
                onClick={() => setAuthModal({ isOpen: true, mode: 'register' })}
                className="border-2 border-yellow-500 text-yellow-700 px-8 py-3 rounded-lg font-semibold hover:bg-yellow-50 transition-colors"
              >
                Become an Affiliate
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* How Beezio Works Section */}
      <div className="bg-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">How Beezio Works</h2>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">
              A simple, transparent process that benefits everyone in the marketplace
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            {/* Step 1 */}
            <div className="text-center">
              <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-2xl font-bold text-yellow-700">1</span>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Sellers List Products</h3>
              <p className="text-gray-600">
                Set your desired price and choose how much commission to offer affiliates. 
                You keep 100% of your asking price.
              </p>
            </div>

            {/* Step 2 */}
            <div className="text-center">
              <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-2xl font-bold text-yellow-700">2</span>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Affiliates Promote</h3>
              <p className="text-gray-600">
                Share products using unique links. Earn commissions on every sale 
                with payments every two weeks.
              </p>
            </div>

            {/* Step 3 */}
            <div className="text-center">
              <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-2xl font-bold text-yellow-700">3</span>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Customers Buy</h3>
              <p className="text-gray-600">
                See exactly where their money goes with transparent pricing. 
                Trust leads to higher conversion rates.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Featured Products Section */}
      <div className="bg-gray-50 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Featured Products</h2>
            <p className="text-lg text-gray-600">Discover top-rated products from trusted sellers</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { title: "Digital Marketing Course", price: 97, commission: "15%", seller: "MarketingPro" },
              { title: "SEO Audit Tool", price: 49, commission: "$12", seller: "TechSolutions" },
              { title: "Social Media Templates", price: 29, commission: "20%", seller: "DesignStudio" },
              { title: "Email Marketing Guide", price: 39, commission: "$8", seller: "EmailExpert" }
            ].map((product, index) => (
              <div key={index} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
                <div className="h-48 bg-gradient-to-br from-yellow-100 to-amber-100 flex items-center justify-center">
                  <span className="text-gray-600 text-sm text-center px-2">{product.title}</span>
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-gray-900 mb-1">{product.title}</h3>
                  <p className="text-sm text-gray-600 mb-2">by {product.seller}</p>
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-lg font-bold text-gray-900">${product.price}</span>
                    <span className="text-sm text-yellow-600 bg-yellow-50 px-2 py-1 rounded">
                      {product.commission} commission
                    </span>
                  </div>
                  <button className="w-full bg-yellow-500 text-white py-2 rounded-lg hover:bg-yellow-600 transition-colors text-sm font-medium">
                    View Details
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* New Products Section */}
      <div className="bg-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">New Products</h2>
            <p className="text-lg text-gray-600">Fresh arrivals from our community</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { title: "AI Content Generator", price: 67, commission: "25%", seller: "AITools" },
              { title: "Brand Identity Kit", price: 79, commission: "$15", seller: "BrandCo" },
              { title: "Productivity Planner", price: 19, commission: "30%", seller: "PlannerPro" },
              { title: "Video Editing Pack", price: 45, commission: "$10", seller: "VideoMaster" }
            ].map((product, index) => (
              <div key={index} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
                <div className="h-48 bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center relative">
                  <span className="text-gray-600 text-sm text-center px-2">{product.title}</span>
                  <span className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full">NEW</span>
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-gray-900 mb-1">{product.title}</h3>
                  <p className="text-sm text-gray-600 mb-2">by {product.seller}</p>
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-lg font-bold text-gray-900">${product.price}</span>
                    <span className="text-sm text-yellow-600 bg-yellow-50 px-2 py-1 rounded">
                      {product.commission} commission
                    </span>
                  </div>
                  <button className="w-full bg-yellow-500 text-white py-2 rounded-lg hover:bg-yellow-600 transition-colors text-sm font-medium">
                    View Details
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Fundraisers Section */}
      <div className="bg-gray-50 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Active Fundraisers</h2>
            <p className="text-lg text-gray-600">Support meaningful causes and make a difference</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              { title: "Local School Technology Fund", goal: 5000, raised: 3200, category: "Education", description: "Help provide modern technology for our local elementary school" },
              { title: "Community Garden Project", goal: 2000, raised: 1500, category: "Environment", description: "Create a sustainable garden space for our neighborhood" },
              { title: "Animal Shelter Support", goal: 3000, raised: 2100, category: "Animals", description: "Support local animals in need of care and shelter" }
            ].map((fundraiser, index) => (
              <div key={index} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
                <div className="h-48 bg-gradient-to-br from-green-100 to-blue-100 flex items-center justify-center">
                  <span className="text-gray-600 text-sm text-center px-4">{fundraiser.title}</span>
                </div>
                <div className="p-6">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-gray-900">{fundraiser.title}</h3>
                    <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">{fundraiser.category}</span>
                  </div>
                  <p className="text-sm text-gray-600 mb-4">{fundraiser.description}</p>
                  
                  {/* Progress Bar */}
                  <div className="mb-4">
                    <div className="flex justify-between text-sm text-gray-600 mb-1">
                      <span>Raised: ${fundraiser.raised.toLocaleString()}</span>
                      <span>Goal: ${fundraiser.goal.toLocaleString()}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-gradient-to-r from-yellow-500 to-amber-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${(fundraiser.raised / fundraiser.goal) * 100}%` }}
                      ></div>
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      {Math.round((fundraiser.raised / fundraiser.goal) * 100)}% funded
                    </div>
                  </div>

                  <button className="w-full bg-gradient-to-r from-yellow-500 to-amber-500 text-white px-4 py-2 rounded-lg hover:from-yellow-600 hover:to-amber-600 transition-colors font-medium">
                    Support This Cause
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-8">
            <button className="bg-yellow-500 text-white px-8 py-3 rounded-lg font-semibold hover:bg-yellow-600 transition-colors">
              View All Fundraisers
            </button>
          </div>
        </div>
      </div>

      {/* Benefits Section */}
      <div className="bg-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Why Choose Beezio.co</h2>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">
              Built for transparency, designed for success
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center p-6">
              <div className="w-16 h-16 bg-yellow-100 rounded-lg flex items-center justify-center mx-auto mb-6">
                <span className="text-2xl">💰</span>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Transparent Pricing</h3>
              <p className="text-gray-600">
                No hidden fees. Customers see exactly where their money goes, 
                building trust and increasing conversions.
              </p>
            </div>

            <div className="text-center p-6">
              <div className="w-16 h-16 bg-yellow-100 rounded-lg flex items-center justify-center mx-auto mb-6">
                <span className="text-2xl">📅</span>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Bi-Weekly Payments</h3>
              <p className="text-gray-600">
                Regular, reliable payments every two weeks. Build consistent 
                income streams with our automated payout system.
              </p>
            </div>

            <div className="text-center p-6">
              <div className="w-16 h-16 bg-yellow-100 rounded-lg flex items-center justify-center mx-auto mb-6">
                <span className="text-2xl">🤝</span>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Fair for Everyone</h3>
              <p className="text-gray-600">
                Sellers keep their full asking price, affiliates earn fair commissions, 
                and customers get transparent value.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="text-2xl font-bold bg-gradient-to-r from-yellow-400 to-amber-400 bg-clip-text text-transparent mb-4">
              🐝 Beezio.co
            </div>
            <p className="text-gray-400 mb-8">The transparent marketplace that works for everyone</p>
            <div className="flex justify-center space-x-8">
              <a href="/about" className="text-gray-400 hover:text-yellow-400 transition-colors">About</a>
              <a href="/contact" className="text-gray-400 hover:text-yellow-400 transition-colors">Contact</a>
              <a href="/terms" className="text-gray-400 hover:text-yellow-400 transition-colors">Terms</a>
              <a href="/privacy" className="text-gray-400 hover:text-yellow-400 transition-colors">Privacy</a>
            </div>
          </div>
        </div>
      </footer>

      {/* ChatBot */}
      <div className="fixed bottom-6 right-6 z-50">
        <button className="bg-yellow-500 hover:bg-yellow-600 text-white rounded-full p-4 shadow-lg transition-colors group">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path>
          </svg>
          <span className="absolute bottom-full right-0 mb-2 px-3 py-1 bg-gray-900 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
            Need help? Chat with us!
          </span>
        </button>
      </div>

      {/* Auth Modal */}
      {authModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-gray-900">
                {authModal.mode === 'login' ? 'Welcome Back' : 'Join Beezio.co'}
              </h2>
              <button
                onClick={() => setAuthModal({ ...authModal, isOpen: false })}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input type="password" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent" />
              </div>
              {authModal.mode === 'register' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">I want to be a:</label>
                  <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent">
                    <option value="buyer">Buyer</option>
                    <option value="seller">Seller</option>
                    <option value="affiliate">Affiliate</option>
                  </select>
                </div>
              )}
              
              {/* Demo Login Buttons for Testing */}
              <div className="border-t pt-4">
                <p className="text-sm text-gray-600 mb-3">Quick Demo Access:</p>
                <div className="flex space-x-2">
                  <button 
                    onClick={() => handleLogin('seller')}
                    className="flex-1 bg-blue-500 text-white py-2 px-3 rounded text-sm hover:bg-blue-600 transition-colors"
                  >
                    Demo Seller
                  </button>
                  <button 
                    onClick={() => handleLogin('affiliate')}
                    className="flex-1 bg-green-500 text-white py-2 px-3 rounded text-sm hover:bg-green-600 transition-colors"
                  >
                    Demo Affiliate
                  </button>
                  <button 
                    onClick={() => handleLogin('buyer')}
                    className="flex-1 bg-purple-500 text-white py-2 px-3 rounded text-sm hover:bg-purple-600 transition-colors"
                  >
                    Demo Buyer
                  </button>
                </div>
              </div>

              <button className="w-full bg-yellow-500 text-white py-2 rounded-lg hover:bg-yellow-600 transition-colors font-medium">
                {authModal.mode === 'login' ? 'Sign In' : 'Create Account'}
              </button>
              <p className="text-center text-sm text-gray-600">
                {authModal.mode === 'login' ? "Don't have an account? " : "Already have an account? "}
                <button
                  onClick={() => setAuthModal({ ...authModal, mode: authModal.mode === 'login' ? 'register' : 'login' })}
                  className="text-yellow-600 hover:text-yellow-700 font-medium"
                >
                  {authModal.mode === 'login' ? 'Sign up' : 'Sign in'}
                </button>
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MinimalApp;
