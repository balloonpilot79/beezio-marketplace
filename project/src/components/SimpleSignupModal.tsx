import React, { useState } from 'react';
import { X, ShoppingCart, Store, Target, Heart, ArrowRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContextMultiRole';

interface SimpleSignupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const SimpleSignupModal: React.FC<SimpleSignupModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { signUp, signIn } = useAuth();
  const [isLogin, setIsLogin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState(1); // 1: Choose role, 2: Fill details
  const [selectedRole, setSelectedRole] = useState('buyer');
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: '',
    phone: '',
    city: '',
    state: '',
    zipCode: ''
  });

  const roles = [
    {
      id: 'buyer',
      name: 'Buyer',
      icon: ShoppingCart,
      description: 'Shop and purchase products',
      gradient: 'from-blue-500 to-blue-600',
      features: ['Browse products', 'Make purchases', 'Track orders', 'Earn rewards']
    },
    {
      id: 'seller',
      name: 'Seller',
      icon: Store,
      description: 'Sell your products',
      gradient: 'from-orange-500 to-orange-600',
      features: ['Connect APIs (Printify, Shopify)', 'Automated product sync', 'Affiliate program built-in', 'Multiple revenue streams']
    },
    {
      id: 'affiliate',
      name: 'Affiliate',
      icon: Target,
      description: 'Promote and earn commissions',
      gradient: 'from-purple-500 to-purple-600',
      features: ['Promote products', 'Generate links', 'Earn commissions', 'Track performance']
    },
    {
      id: 'fundraiser',
      name: 'Fundraiser',
      icon: Heart,
      description: 'Raise funds for causes',
      gradient: 'from-pink-500 to-pink-600',
      features: ['Create campaigns', 'Sell products', 'Promote as affiliate', 'All proceeds to cause']
    }
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isLogin) {
        await signIn(formData.email, formData.password);
      } else {
        await signUp(formData.email, formData.password, {
          ...formData,
          role: selectedRole
        });
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      email: '',
      password: '',
      fullName: '',
      phone: '',
      city: '',
      state: '',
      zipCode: ''
    });
    setError('');
    setStep(1);
    setSelectedRole('buyer');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {isLogin ? 'Welcome Back!' : 'Join Beezio'}
            </h2>
            <p className="text-gray-600 mt-1">
              {isLogin ? 'Sign in to your account' : 'Get started in seconds - you can always add more roles later!'}
            </p>
          </div>
          <button
            onClick={() => {
              onClose();
              resetForm();
            }}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6">
          {/* Toggle Login/Signup */}
          <div className="flex bg-gray-100 p-1 rounded-lg mb-6">
            <button
              onClick={() => {
                setIsLogin(false);
                setStep(1);
                setError('');
              }}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                !isLogin 
                  ? 'bg-white text-gray-900 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Sign Up
            </button>
            <button
              onClick={() => {
                setIsLogin(true);
                setStep(2);
                setError('');
              }}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                isLogin 
                  ? 'bg-white text-gray-900 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Sign In
            </button>
          </div>

          {/* Step 1: Role Selection (Signup only) */}
          {!isLogin && step === 1 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">What would you like to start with?</h3>
              <p className="text-gray-600 mb-6">Choose your primary role - you can easily add others later!</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                {roles.map((role) => {
                  const Icon = role.icon;
                  return (
                    <button
                      key={role.id}
                      onClick={() => setSelectedRole(role.id)}
                      className={`p-6 rounded-xl border-2 text-left transition-all hover:shadow-lg ${
                        selectedRole === role.id
                          ? 'border-orange-500 bg-orange-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center space-x-4 mb-4">
                        <div className={`p-3 rounded-lg bg-gradient-to-r ${role.gradient}`}>
                          <Icon className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-900">{role.name}</h4>
                          <p className="text-sm text-gray-600">{role.description}</p>
                          {role.id === 'fundraiser' && (
                            <p className="text-xs text-orange-600 font-medium mt-1">
                              ⭐ Includes seller + affiliate access!
                            </p>
                          )}
                        </div>
                      </div>
                      <ul className="space-y-1">
                        {role.features.map((feature, index) => (
                          <li key={index} className="text-sm text-gray-600 flex items-center">
                            <div className="w-1.5 h-1.5 bg-gray-400 rounded-full mr-2"></div>
                            {feature}
                          </li>
                        ))}
                      </ul>
                    </button>
                  );
                })}
              </div>
              
              {selectedRole === 'fundraiser' && (
                <div className="mb-6 p-4 bg-pink-50 border border-pink-200 rounded-lg">
                  <div className="flex items-center space-x-2 mb-2">
                    <Heart className="w-5 h-5 text-pink-600" />
                    <h4 className="font-semibold text-pink-800">Fundraiser Super Powers!</h4>
                  </div>
                  <p className="text-pink-700 text-sm">
                    As a fundraiser, you automatically get <strong>seller</strong> and <strong>affiliate</strong> access too! 
                    You can sell products, promote other products, and switch between all three roles. 
                    All proceeds go toward your cause! 💝
                  </p>
                </div>
              )}

              <div className="flex justify-end">
                <button
                  onClick={() => setStep(2)}
                  className="flex items-center space-x-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white px-6 py-3 rounded-lg hover:from-orange-600 hover:to-orange-700 transition-all font-medium"
                >
                  <span>Continue</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Account Details */}
          {(isLogin || step === 2) && (
            <form onSubmit={handleSubmit} className="space-y-6">
              {!isLogin && (
                <div className="bg-gray-50 p-4 rounded-lg mb-6">
                  <div className="flex items-center space-x-3">
                    {(() => {
                      const selectedRoleConfig = roles.find(r => r.id === selectedRole);
                      const Icon = selectedRoleConfig?.icon || ShoppingCart;
                      return (
                        <div className={`p-2 rounded-lg bg-gradient-to-r ${selectedRoleConfig?.gradient}`}>
                          <Icon className="w-5 h-5 text-white" />
                        </div>
                      );
                    })()}
                    <div>
                      <p className="font-medium text-gray-900">
                        Starting as: {roles.find(r => r.id === selectedRole)?.name}
                      </p>
                      <p className="text-sm text-gray-600">You can add more roles after signing up</p>
                    </div>
                  </div>
                </div>
              )}

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    placeholder="your@email.com"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Password *
                  </label>
                  <input
                    type="password"
                    required
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    placeholder="Create a secure password"
                    minLength={6}
                  />
                </div>

                {!isLogin && (
                  <>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Full Name
                      </label>
                      <input
                        type="text"
                        value={formData.fullName}
                        onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                        placeholder="Your full name"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Phone (Optional)
                      </label>
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                        placeholder="(555) 123-4567"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        ZIP Code (Optional)
                      </label>
                      <input
                        type="text"
                        value={formData.zipCode}
                        onChange={(e) => setFormData({ ...formData, zipCode: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                        placeholder="12345"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        City (Optional)
                      </label>
                      <input
                        type="text"
                        value={formData.city}
                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                        placeholder="Your city"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        State (Optional)
                      </label>
                      <input
                        type="text"
                        value={formData.state}
                        onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                        placeholder="State"
                      />
                    </div>
                  </>
                )}
              </div>

              <div className="flex items-center justify-between pt-6">
                {!isLogin && step === 2 && (
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="text-gray-600 hover:text-gray-800 font-medium"
                  >
                    ← Back
                  </button>
                )}
                
                <button
                  type="submit"
                  disabled={loading}
                  className="ml-auto bg-gradient-to-r from-orange-500 to-orange-600 text-white px-8 py-3 rounded-lg hover:from-orange-600 hover:to-orange-700 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Please wait...' : (isLogin ? 'Sign In' : 'Create Account')}
                </button>
              </div>
            </form>
          )}

          {(isLogin || step === 2) && (
            <div className="mt-6 pt-6 border-t border-gray-200 text-center">
              <p className="text-gray-600">
                {isLogin ? "Don't have an account? " : "Already have an account? "}
                <button
                  onClick={() => {
                    setIsLogin(!isLogin);
                    setError('');
                    resetForm();
                  }}
                  className="text-orange-600 hover:text-orange-700 font-medium"
                >
                  {isLogin ? 'Sign up' : 'Sign in'}
                </button>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SimpleSignupModal;
