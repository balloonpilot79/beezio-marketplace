import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContextMultiRole';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Eye, 
  Users, 
  Gift, 
  TrendingUp,
  Package,
  Heart,
  Star,
  Settings,
  ChevronDown,
  Bell,
  DollarSign,
  LogOut,
  User
} from 'lucide-react';

const UserSubHeader: React.FC = () => {
  const { user, profile, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  if (!user || !profile) return null;

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const isActive = (path: string) => location.pathname === path;

  const getNavItems = () => {
    const baseItems = [
      { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }
    ];

    if (profile.role === 'seller') {
      return [
        ...baseItems,
        { path: '/seller/products', label: 'My Products', icon: Package },
        { path: '/seller/orders', label: 'Orders', icon: ShoppingCart },
        { path: '/seller/analytics', label: 'Analytics', icon: TrendingUp },
        { path: '/seller/affiliates', label: 'Affiliates', icon: Users }
      ];
    } else if (profile.role === 'affiliate') {
      return [
        ...baseItems,
        { path: '/affiliate/links', label: 'My Links', icon: Gift },
        { path: '/affiliate/earnings', label: 'Earnings', icon: DollarSign },
        { path: '/affiliate/performance', label: 'Performance', icon: TrendingUp },
        { path: '/affiliate/products', label: 'Promote Products', icon: Package }
      ];
    } else if (profile.role === 'buyer') {
      return [
        ...baseItems,
        { path: '/buyer/orders', label: 'My Orders', icon: ShoppingCart },
        { path: '/buyer/watching', label: 'Watching', icon: Eye },
        { path: '/buyer/reviews', label: 'Reviews', icon: Star },
        { path: '/buyer/wishlist', label: 'Wishlist', icon: Heart }
      ];
    }

    return baseItems;
  };

  const navItems = getNavItems();

  const quickActions = {
    seller: [
      { label: 'Add Product', path: '/seller/products/new', color: 'bg-green-600' },
      { label: 'View Orders', path: '/seller/orders', color: 'bg-blue-600' },
      { label: 'Recruit Affiliates', path: '/seller/affiliates/recruit', color: 'bg-purple-600' }
    ],
    affiliate: [
      { label: 'Get Link', path: '/affiliate/links/generate', color: 'bg-orange-600' },
      { label: 'View Earnings', path: '/affiliate/earnings', color: 'bg-green-600' },
      { label: 'Find Products', path: '/affiliate/products', color: 'bg-blue-600' }
    ],
    buyer: [
      { label: 'Browse Products', path: '/marketplace', color: 'bg-orange-600' },
      { label: 'Track Orders', path: '/buyer/orders', color: 'bg-blue-600' },
      { label: 'Leave Review', path: '/buyer/reviews/new', color: 'bg-purple-600' }
    ]
  };

  return (
    <div className="bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Navigation Items */}
          <div className="flex items-center space-x-8">
            {navItems.map((item) => {
              const IconComponent = item.icon;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors duration-200 ${
                    isActive(item.path)
                      ? 'bg-purple-100 text-purple-600 border border-purple-200'
                      : 'text-gray-600 hover:text-purple-600 hover:bg-purple-50'
                  }`}
                >
                  <IconComponent className="w-4 h-4" />
                  <span className="font-medium">{item.label}</span>
                </Link>
              );
            })}
          </div>

          {/* User Info and Actions */}
          <div className="flex items-center space-x-4">
            {/* Quick Actions */}
            <div className="hidden md:flex items-center space-x-3">
              {quickActions[profile.role as keyof typeof quickActions]?.map((action, index) => (
                <Link
                  key={index}
                  to={action.path}
                  className={`${action.color} text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity`}
                >
                  {action.label}
                </Link>
              ))}
            </div>

            {/* User Profile Menu */}
            <div className="relative">
              <button
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="flex items-center space-x-3 bg-gray-50 hover:bg-gray-100 rounded-xl px-4 py-2 transition-colors duration-200"
              >
                <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-indigo-500 rounded-lg flex items-center justify-center">
                  <span className="text-white text-sm font-semibold">
                    {profile.full_name?.[0] || 'U'}
                  </span>
                </div>
                <div className="text-left">
                  <div className="text-sm font-medium text-gray-900">
                    {profile.full_name || 'User'}
                  </div>
                  <div className="text-xs text-gray-500 capitalize">
                    {profile.role}
                  </div>
                </div>
                <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${isUserMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Dropdown Menu */}
              {isUserMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-200 py-2 z-50">
                  <div className="px-4 py-3 border-b border-gray-200">
                    <p className="text-sm font-medium text-gray-900">{profile.full_name}</p>
                    <p className="text-sm text-gray-500">{user.email}</p>
                    <div className="flex items-center mt-1">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                        {profile.role}
                      </span>
                    </div>
                  </div>
                  
                  <Link
                    to="/dashboard"
                    className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    onClick={() => setIsUserMenuOpen(false)}
                  >
                    <LayoutDashboard className="w-4 h-4 mr-3" />
                    Dashboard
                  </Link>
                  
                  <Link
                    to="/profile"
                    className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    onClick={() => setIsUserMenuOpen(false)}
                  >
                    <User className="w-4 h-4 mr-3" />
                    Profile Settings
                  </Link>
                  
                  <Link
                    to="/notifications"
                    className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    onClick={() => setIsUserMenuOpen(false)}
                  >
                    <Bell className="w-4 h-4 mr-3" />
                    Notifications
                  </Link>
                  
                  <hr className="my-2" />
                  
                  <button
                    onClick={handleSignOut}
                    className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <LogOut className="w-4 h-4 mr-3" />
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserSubHeader;
