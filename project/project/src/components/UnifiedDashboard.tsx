import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContextMultiRole';
import { 
  User, 
  ShoppingCart, 
  Store, 
  Target, 
  Heart,
  Settings,
  LogOut,
  ChevronDown,
  Plus,
  Check
} from 'lucide-react';
import EnhancedSellerDashboard from './EnhancedSellerDashboard';
import EnhancedAffiliateDashboard from './EnhancedAffiliateDashboard';
import EnhancedBuyerDashboard from './EnhancedBuyerDashboard';

const UnifiedDashboard: React.FC = () => {
  const { user, profile, userRoles, currentRole, switchRole, addRole, signOut, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const [showAddRoleMenu, setShowAddRoleMenu] = useState(false);
  const [switchingRole, setSwitchingRole] = useState(false);

  const roleConfig = {
    buyer: {
      name: 'Buyer',
      icon: ShoppingCart,
      color: 'blue',
      gradient: 'from-blue-500 to-blue-600',
      description: 'Shop and purchase products'
    },
    seller: {
      name: 'Seller',
      icon: Store,
      color: 'orange',
      gradient: 'from-orange-500 to-orange-600',
      description: 'Manage your store and products'
    },
    affiliate: {
      name: 'Affiliate',
      icon: Target,
      color: 'purple',
      gradient: 'from-purple-500 to-purple-600',
      description: 'Promote products and earn commissions'
    },
    fundraiser: {
      name: 'Fundraiser',
      icon: Heart,
      color: 'pink',
      gradient: 'from-pink-500 to-pink-600',
      description: 'Raise funds for causes'
    }
  };

  const handleRoleSwitch = async (role: string) => {
    setSwitchingRole(true);
    setShowRoleMenu(false);
    
    const success = await switchRole(role);
    if (success) {
      // Optionally show success message
      console.log(`Switched to ${roleConfig[role as keyof typeof roleConfig].name} dashboard`);
    } else {
      console.error('Failed to switch role');
    }
    
    setSwitchingRole(false);
  };

  const handleAddRole = async (role: string) => {
    setShowAddRoleMenu(false);
    
    const success = await addRole(role);
    if (success) {
      console.log(`Added ${roleConfig[role as keyof typeof roleConfig].name} role`);
      // Optionally switch to the new role immediately
      await handleRoleSwitch(role);
    } else {
      console.error('Failed to add role');
    }
  };

  const availableRoles = ['buyer', 'seller', 'affiliate', 'fundraiser'].filter(role => !userRoles.includes(role));

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    navigate('/');
    return null;
  }

  const currentRoleConfig = roleConfig[currentRole as keyof typeof roleConfig];
  const RoleIcon = currentRoleConfig?.icon || User;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with Role Switcher */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-gray-900">Beezio</h1>
            </div>

            {/* Role Switcher */}
            <div className="flex items-center space-x-4">
              {/* Current Role Display */}
              <div className="relative">
                <button
                  onClick={() => setShowRoleMenu(!showRoleMenu)}
                  disabled={switchingRole}
                  className={`flex items-center space-x-3 px-4 py-2 rounded-lg bg-gradient-to-r ${currentRoleConfig?.gradient || 'from-gray-500 to-gray-600'} text-white hover:shadow-lg transition-all duration-200 disabled:opacity-50`}
                >
                  <RoleIcon className="w-5 h-5" />
                  <span className="font-medium">{currentRoleConfig?.name || 'Dashboard'}</span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${showRoleMenu ? 'rotate-180' : ''}`} />
                </button>

                {/* Role Menu Dropdown */}
                {showRoleMenu && (
                  <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
                    <div className="px-4 py-2 border-b border-gray-100">
                      <p className="text-sm font-medium text-gray-900">Switch Dashboard</p>
                      <p className="text-xs text-gray-500">Choose your active role</p>
                    </div>
                    
                    {userRoles.map((role) => {
                      const config = roleConfig[role as keyof typeof roleConfig];
                      const Icon = config?.icon || User;
                      const isActive = role === currentRole;
                      
                      return (
                        <button
                          key={role}
                          onClick={() => !isActive && handleRoleSwitch(role)}
                          className={`w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors ${
                            isActive ? 'bg-gray-50' : ''
                          }`}
                          disabled={isActive || switchingRole}
                        >
                          <div className="flex items-center space-x-3">
                            <div className={`p-1.5 rounded-lg bg-gradient-to-r ${config?.gradient || 'from-gray-500 to-gray-600'}`}>
                              <Icon className="w-4 h-4 text-white" />
                            </div>
                            <div className="text-left">
                              <p className="font-medium text-gray-900">{config?.name}</p>
                              <p className="text-xs text-gray-500">{config?.description}</p>
                            </div>
                          </div>
                          {isActive && <Check className="w-4 h-4 text-green-600" />}
                        </button>
                      );
                    })}

                    {availableRoles.length > 0 && (
                      <>
                        <div className="border-t border-gray-100 my-2"></div>
                        <div className="px-4 py-2">
                          <div className="relative">
                            <button
                              onClick={() => setShowAddRoleMenu(!showAddRoleMenu)}
                              className="w-full flex items-center space-x-2 px-3 py-2 rounded-lg border-2 border-dashed border-gray-300 hover:border-gray-400 transition-colors"
                            >
                              <Plus className="w-4 h-4 text-gray-500" />
                              <span className="text-sm text-gray-600 font-medium">Add New Role</span>
                            </button>

                            {showAddRoleMenu && (
                              <div className="absolute left-0 top-full mt-2 w-full bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-60">
                                {availableRoles.map((role) => {
                                  const config = roleConfig[role as keyof typeof roleConfig];
                                  const Icon = config?.icon || User;
                                  
                                  return (
                                    <button
                                      key={role}
                                      onClick={() => handleAddRole(role)}
                                      className="w-full flex items-center space-x-3 px-4 py-3 hover:bg-gray-50 transition-colors"
                                    >
                                      <div className={`p-1.5 rounded-lg bg-gradient-to-r ${config?.gradient || 'from-gray-500 to-gray-600'}`}>
                                        <Icon className="w-4 h-4 text-white" />
                                      </div>
                                      <div className="text-left">
                                        <p className="font-medium text-gray-900">{config?.name}</p>
                                        <p className="text-xs text-gray-500">{config?.description}</p>
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* User Menu */}
              <div className="flex items-center space-x-3">
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">{profile?.full_name || 'User'}</p>
                  <p className="text-xs text-gray-500">{user.email}</p>
                </div>
                
                <button
                  onClick={() => navigate('/profile')}
                  className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <Settings className="w-5 h-5 text-gray-600" />
                </button>
                
                <button
                  onClick={signOut}
                  className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <LogOut className="w-5 h-5 text-gray-600" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Dashboard Content */}
      <main>
        {currentRole === 'buyer' && <EnhancedBuyerDashboard />}
        {currentRole === 'seller' && <EnhancedSellerDashboard />}
        {currentRole === 'affiliate' && <EnhancedAffiliateDashboard />}
        {currentRole === 'fundraiser' && <EnhancedAffiliateDashboard />}
      </main>
    </div>
  );
};

export default UnifiedDashboard;
