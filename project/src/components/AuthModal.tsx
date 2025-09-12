import React, { useState } from 'react';
import { X, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../contexts/AuthContextMultiRole';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'login' | 'register';
}

const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, mode: initialMode }) => {
  if (process.env.NODE_ENV !== 'production') {
    console.debug('AuthModal: Component rendering, isOpen prop:', isOpen, 'mode:', initialMode);
  }
  
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>(initialMode);
  
  // Update internal mode when prop changes
  React.useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);
  
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const { signIn, signUp, resetPassword, sendMagicLink } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: '',
    role: 'buyer' as 'buyer' | 'seller' | 'affiliate' | 'fundraiser',
    phone: '',
    city: '',
    state: '',
    zipCode: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (process.env.NODE_ENV !== 'production') {
      console.debug('AuthModal: Form submitted, mode:', mode, 'email:', formData.email);
    }
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (mode === 'forgot') {
  if (process.env.NODE_ENV !== 'production') console.debug('AuthModal: Attempting password reset...');
        await resetPassword(formData.email);
        setSuccess('Password reset email sent! Check your inbox for instructions.');
        setTimeout(() => {
          setMode('login');
          setSuccess(null);
        }, 3000);
      } else if (mode === 'login') {
  if (process.env.NODE_ENV !== 'production') console.debug('AuthModal: Attempting sign in...');
        const result = await signIn(formData.email, formData.password);
  if (process.env.NODE_ENV !== 'production') console.debug('AuthModal: Sign in result:', result);
        if (result.user) {
          setSuccess('Successfully signed in!');
          onClose();
          
          // Always redirect to /dashboard - the Dashboard component will handle role-based rendering
          setTimeout(() => {
            navigate('/dashboard');
          }, 100);
        }
      } else {
  if (process.env.NODE_ENV !== 'production') console.debug('AuthModal: Attempting sign up...');
        const result = await signUp(formData.email, formData.password, formData);
        if (result.user) {
          setSuccess('Account created successfully!');
          // Supabase: If email confirmation is required, session will be null
          if (!result.session) {
            setSuccess('Account created! Please check your email to confirm your account before logging in.');
            return;
          }
          // If session exists, sign in and redirect
          try {
            const signInResult = await signIn(formData.email, formData.password);
            if (signInResult.user) {
              onClose();
              // Always redirect to /dashboard - the Dashboard component will handle role-based rendering
              setTimeout(() => {
                navigate('/dashboard');
              }, 100);
            } else {
              setError('Sign in failed after registration. Please try logging in.');
            }
          } catch (signInError: any) {
            setError(signInError.message || 'Sign in failed after registration.');
          }
        }
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      if (err.message && err.message.includes('already exists')) {
        setError('An account with this email already exists. Please sign in instead.');
        setTimeout(() => {
          setMode('login');
          setError(null);
        }, 3000);
      } else if (err.message && err.message.includes('Invalid login credentials')) {
        setError('Invalid email or password. Please check your credentials and try again.');
      } else {
        setError(err.message || 'An error occurred during authentication');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-2xl font-bold text-gray-900">
            {mode === 'login' ? 'Sign In' : mode === 'register' ? 'Create Account' : 'Reset Password'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <form className="flex-1 overflow-y-auto" onSubmit={handleSubmit}>
          <div className="p-6 space-y-4">
            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}
            {success && (
              <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
                {success}
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
            {mode !== 'forgot' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    required
                    minLength={6}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                {mode === 'register' && (
                  <p className="text-xs text-gray-500 mt-1">Password must be at least 6 characters</p>
                )}
              </div>
            )}
            {mode === 'register' && (
              <React.Fragment>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Full Name
                  </label>
                  <input
                    type="text"
                    name="fullName"
                    value={formData.fullName}
                    onChange={handleChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Account Type
                  </label>
                  <select
                    name="role"
                    value={formData.role}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="buyer">Buyer</option>
                    <option value="seller">Seller</option>
                    <option value="affiliate">Affiliate</option>
                    <option value="fundraiser">Fundraiser</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phone (Optional)
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      City (Optional)
                    </label>
                    <input
                      type="text"
                      name="city"
                      value={formData.city}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      State (Optional)
                    </label>
                    <input
                      type="text"
                      name="state"
                      value={formData.state}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    ZIP Code (Optional)
                  </label>
                  <input
                    type="text"
                    name="zipCode"
                    value={formData.zipCode}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </React.Fragment>
            )}
          </div>
          <div className="p-6 border-t bg-gray-50">
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-amber-500 text-white py-3 px-4 rounded-lg hover:bg-amber-600 transition-colors disabled:opacity-50 font-medium"
            >
              {loading ? 'Please wait...' : 
               mode === 'login' ? 'Sign In' : 
               mode === 'register' ? 'Create Account' : 
               'Send Reset Email'}
            </button>
            
            {mode === 'login' && (
              <div className="mt-3 text-center space-y-2">
                <button
                  type="button"
                  onClick={() => setMode('forgot')}
                  className="text-sm text-amber-600 hover:text-amber-700 font-medium block mx-auto"
                >
                  Forgot your password?
                </button>
                <div className="text-gray-400 text-sm">or</div>
                <button
                  type="button"
                  onClick={async () => {
                    if (!formData.email) {
                      setError('Please enter your email address first');
                      return;
                    }
                    setLoading(true);
                    try {
                      await sendMagicLink(formData.email);
                      setSuccess('Magic link sent! Check your email to sign in.');
                    } catch (err: any) {
                      setError(err.message || 'Failed to send magic link');
                    }
                    setLoading(false);
                  }}
                  className="text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  Send Magic Link Instead
                </button>
              </div>
            )}
            
            <div className="mt-4 text-center">
              <p className="text-gray-600 text-sm">
                {mode === 'login' ? "Don't have an account?" : 
                 mode === 'register' ? 'Already have an account?' : 
                 'Remember your password?'}
                <button
                  type="button"
                  onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
                  className="ml-1 text-amber-600 hover:text-amber-700 font-medium"
                >
                  {mode === 'login' ? 'Sign Up' : 'Sign In'}
                </button>
              </p>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AuthModal;