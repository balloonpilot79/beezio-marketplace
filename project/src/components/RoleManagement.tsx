import React, { useState } from 'react';
import { UserPlus, RefreshCw, CheckCircle, AlertCircle, Crown, ShoppingBag, Users, Heart } from 'lucide-react';
import { useAuth } from '../contexts/AuthContextMultiRole';

interface RoleManagementProps {
  onRoleChange?: () => void;
}

const RoleManagement: React.FC<RoleManagementProps> = ({ onRoleChange }) => {
  const { user, userRoles, currentRole, switchRole, addRole, hasRole } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const availableRoles = [
    {
      id: 'buyer',
      name: 'Buyer',
      description: 'Purchase products from sellers and affiliates',
      icon: ShoppingBag,
      color: 'bg-blue-500',
      benefits: ['Access to all products', 'Secure checkout', 'Order tracking']
    },
    {
      id: 'seller',
      name: 'Seller',
      description: 'List and sell your own products',
      icon: Crown,
      color: 'bg-green-500',
      benefits: ['Product listings', 'Sales analytics', 'Direct customer communication']
    },
    {
      id: 'affiliate',
      name: 'Affiliate',
      description: 'Earn commissions by promoting products',
      icon: Users,
      color: 'bg-purple-500',
      benefits: ['Commission earnings', 'Marketing tools', 'Performance analytics']
    },
    {
      id: 'fundraiser',
      name: 'Fundraiser',
      description: 'Raise money for causes through affiliate commissions',
      icon: Heart,
      color: 'bg-red-500',
      benefits: ['Cause-driven earnings', 'Community impact', 'Fundraising tools']
    }
  ];

  const handleSwitchRole = async (roleId: string) => {
    if (roleId === currentRole) return;

    setLoading(`switching-${roleId}`);
    setMessage(null);

    try {
      const success = await switchRole(roleId);
      if (success) {
        setMessage({ type: 'success', text: `Successfully switched to ${availableRoles.find(r => r.id === roleId)?.name} role!` });
        onRoleChange?.();
      } else {
        setMessage({ type: 'error', text: 'Failed to switch role. Please try again.' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'An error occurred while switching roles.' });
    } finally {
      setLoading(null);
    }
  };

  const handleAddRole = async (roleId: string) => {
    if (hasRole(roleId)) return;

    setLoading(`adding-${roleId}`);
    setMessage(null);

    try {
      const success = await addRole(roleId);
      if (success) {
        setMessage({ type: 'success', text: `Successfully added ${availableRoles.find(r => r.id === roleId)?.name} role!` });
        onRoleChange?.();
      } else {
        setMessage({ type: 'error', text: 'Failed to add role. Please try again.' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'An error occurred while adding the role.' });
    } finally {
      setLoading(null);
    }
  };

  if (!user) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-600">Please sign in to manage your roles.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Role Management</h2>
        <p className="text-gray-600">
          Expand your participation in Beezio by taking on multiple roles.
          Sellers can become affiliates, affiliates can start selling - the choice is yours!
        </p>
      </div>

      {/* Current Role Display */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-6 mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Current Active Role</h3>
            <div className="flex items-center space-x-3">
              {(() => {
                const currentRoleData = availableRoles.find(r => r.id === currentRole);
                const Icon = currentRoleData?.icon || ShoppingBag;
                return (
                  <>
                    <div className={`p-2 rounded-lg ${currentRoleData?.color || 'bg-gray-500'}`}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{currentRoleData?.name || 'Buyer'}</p>
                      <p className="text-sm text-gray-600">{currentRoleData?.description}</p>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-600">Your Roles</p>
            <p className="font-semibold text-gray-900">{userRoles.length} active</p>
          </div>
        </div>
      </div>

      {/* Message Display */}
      {message && (
        <div className={`mb-6 p-4 rounded-lg flex items-center space-x-3 ${
          message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle className="w-5 h-5 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
          )}
          <p>{message.text}</p>
        </div>
      )}

      {/* Role Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {availableRoles.map((role) => {
          const Icon = role.icon;
          const isCurrentRole = currentRole === role.id;
          const hasThisRole = hasRole(role.id);
          const isLoading = loading === `switching-${role.id}` || loading === `adding-${role.id}`;

          return (
            <div
              key={role.id}
              className={`relative bg-white rounded-xl border-2 p-6 transition-all ${
                isCurrentRole
                  ? 'border-blue-500 shadow-lg'
                  : hasThisRole
                    ? 'border-green-300 shadow-md'
                    : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              {/* Role Status Badge */}
              {isCurrentRole && (
                <div className="absolute -top-3 left-4 bg-blue-500 text-white px-3 py-1 rounded-full text-xs font-medium">
                  Active Role
                </div>
              )}
              {hasThisRole && !isCurrentRole && (
                <div className="absolute -top-3 left-4 bg-green-500 text-white px-3 py-1 rounded-full text-xs font-medium">
                  Available
                </div>
              )}

              {/* Role Header */}
              <div className="flex items-center space-x-4 mb-4">
                <div className={`p-3 rounded-lg ${role.color}`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{role.name}</h3>
                  <p className="text-sm text-gray-600">{role.description}</p>
                </div>
              </div>

              {/* Benefits */}
              <div className="mb-6">
                <h4 className="text-sm font-medium text-gray-900 mb-2">Benefits:</h4>
                <ul className="space-y-1">
                  {role.benefits.map((benefit, index) => (
                    <li key={index} className="text-sm text-gray-600 flex items-center">
                      <CheckCircle className="w-4 h-4 text-green-500 mr-2 flex-shrink-0" />
                      {benefit}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-2">
                {hasThisRole ? (
                  // Switch to this role
                  <button
                    onClick={() => handleSwitchRole(role.id)}
                    disabled={isCurrentRole || isLoading}
                    className={`flex-1 flex items-center justify-center space-x-2 px-4 py-2 rounded-lg font-medium transition-all ${
                      isCurrentRole
                        ? 'bg-blue-100 text-blue-700 cursor-not-allowed'
                        : 'bg-blue-500 text-white hover:bg-blue-600'
                    }`}
                  >
                    {isLoading ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4" />
                    )}
                    <span>{isCurrentRole ? 'Current Role' : 'Switch to This'}</span>
                  </button>
                ) : (
                  // Add this role
                  <button
                    onClick={() => handleAddRole(role.id)}
                    disabled={isLoading}
                    className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 transition-all"
                  >
                    {isLoading ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <UserPlus className="w-4 h-4" />
                    )}
                    <span>Add Role</span>
                  </button>
                )}
              </div>

              {/* Popular Combinations */}
              {role.id === 'seller' && hasRole('affiliate') && (
                <div className="mt-4 p-3 bg-yellow-50 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    <strong>💡 Popular Combo:</strong> Many affiliates become sellers to promote their own products alongside others!
                  </p>
                </div>
              )}

              {role.id === 'affiliate' && hasRole('seller') && (
                <div className="mt-4 p-3 bg-purple-50 rounded-lg">
                  <p className="text-sm text-purple-800">
                    <strong>💡 Popular Combo:</strong> Sellers often become affiliates to earn extra income promoting complementary products!
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Help Section */}
      <div className="mt-8 bg-gray-50 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">How Role Switching Works</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-medium text-gray-900 mb-2">For Sellers Becoming Affiliates:</h4>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Keep all your seller privileges</li>
              <li>• Earn commissions on other products</li>
              <li>• Access affiliate marketing tools</li>
              <li>• Build your own affiliate storefront</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium text-gray-900 mb-2">For Affiliates Becoming Sellers:</h4>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Keep all your affiliate earnings</li>
              <li>• List and sell your own products</li>
              <li>• Access seller analytics</li>
              <li>• Direct customer relationships</li>
            </ul>
          </div>
        </div>
        <div className="mt-4 p-4 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>🔄 Easy Switching:</strong> You can switch between your roles anytime from your dashboard.
            Your data and earnings are preserved across all roles!
          </p>
        </div>
      </div>
    </div>
  );
};

export default RoleManagement;