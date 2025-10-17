import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContextMultiRole';
import { supabase } from '../lib/supabase';
import { Gift } from 'lucide-react';

const SignUpPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: '',
    phone: '',
    city: '',
    state: '',
    zipCode: '',
    role: 'buyer',
  });
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [referralValid, setReferralValid] = useState<boolean | null>(null);
  const [referrerName, setReferrerName] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const { signUp, signIn } = useAuth();
  const navigate = useNavigate();

  // Check for referral code in URL
  useEffect(() => {
    const refCode = searchParams.get('ref');
    if (refCode) {
      validateReferralCode(refCode);
    }
  }, [searchParams]);

  const validateReferralCode = async (code: string) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('email, referral_code')
        .eq('referral_code', code.toUpperCase())
        .eq('current_role', 'affiliate')
        .single();

      if (error || !data) {
        setReferralValid(false);
        setReferralCode(null);
        return;
      }

      setReferralCode(code.toUpperCase());
      setReferralValid(true);
      setReferrerName(data.email.split('@')[0]);
      
      // Auto-select affiliate role if referred
      setFormData(prev => ({ ...prev, role: 'affiliate' }));
    } catch (err) {
      console.error('Error validating referral code:', err);
      setReferralValid(false);
      setReferralCode(null);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      // Only assign selected role
      const result = await signUp(formData.email, formData.password, { ...formData, role: formData.role });
      if (result.user) {
        // If there's a referral code, store it and create referral relationship
        if (referralCode && referralValid) {
          try {
            // Update user with referred_by_code
            await supabase
              .from('users')
              .update({ referred_by_code: referralCode })
              .eq('id', result.user.id);

            // Get referrer's ID
            const { data: referrer } = await supabase
              .from('users')
              .select('id')
              .eq('referral_code', referralCode)
              .single();

            if (referrer) {
              // Create affiliate_referrals record
              await supabase
                .from('affiliate_referrals')
                .insert({
                  referrer_id: referrer.id,
                  referred_id: result.user.id,
                  referral_code: referralCode,
                  status: 'active'
                });
            }
          } catch (refErr) {
            console.error('Error saving referral relationship:', refErr);
            // Don't fail signup if referral tracking fails
          }
        }

        setSuccess('Account created successfully!');
        if (!result.session) {
          setSuccess('Account created! Please check your email to confirm your account before logging in.');
          setLoading(false);
          return;
        }
        try {
          const signInResult = await signIn(formData.email, formData.password);
          if (signInResult.user) {
            // Route to dashboard by role
            if (formData.role === 'buyer') {
              navigate('/dashboard/buyer');
            } else if (formData.role === 'seller') {
              navigate('/dashboard/seller');
            } else if (formData.role === 'affiliate') {
              navigate('/dashboard/affiliate');
            } else {
              navigate('/dashboard');
            }
          } else {
            setError('Sign in failed after registration. Please try logging in.');
          }
        } catch (signInError: any) {
          setError(signInError.message || 'Sign in failed after registration.');
        }
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during registration');
    } finally {
      setLoading(false);
    }
  };

  // Get role from URL params
  const urlRole = searchParams.get('role');
  useEffect(() => {
    if (urlRole && ['buyer', 'seller', 'affiliate', 'fundraiser'].includes(urlRole)) {
      setFormData(prev => ({ ...prev, role: urlRole }));
    }
  }, [urlRole]);

  // Role benefits data
  const roleBenefits = {
    seller: {
      title: "Why Sell on Beezio?",
      icon: "🏪",
      benefits: [
        "Custom storefront - Your brand, your way",
        "You set your price - Keep exactly what you want",
        "Set your own affiliate commission rates",
        "No listing fees - Only pay when you sell",
        "Access to thousands of affiliates ready to promote your products"
      ]
    },
    affiliate: {
      title: "Why Become an Affiliate?",
      icon: "💰",
      benefits: [
        "Earn custom commission rates set by sellers",
        "Custom affiliate store - Build your brand",
        "Share products via your unique links",
        "Get paid for every sale you generate",
        "Plus: 2% referral bonus on affiliates you recruit"
      ]
    },
    fundraiser: {
      title: "Why Fundraise with Beezio?",
      icon: "🎗️",
      benefits: [
        "Sell products to raise funds for your cause",
        "No upfront costs - Only pay when you sell",
        "Access our entire product marketplace",
        "Custom fundraiser page",
        "Track donations and sales in real-time"
      ]
    },
    buyer: {
      title: "Welcome to Beezio!",
      icon: "🛍️",
      benefits: [
        "Shop from thousands of products",
        "Support independent sellers and fundraisers",
        "Secure checkout with multiple payment options",
        "Track your orders in real-time"
      ]
    }
  };

  const currentBenefits = roleBenefits[formData.role as keyof typeof roleBenefits] || roleBenefits.buyer;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">Create Your Account</h2>
        
        {/* Role Benefits Section */}
        <div className="mb-6 bg-gradient-to-br from-yellow-50 to-amber-50 border-2 border-yellow-200 rounded-lg p-5">
          <div className="text-center mb-3">
            <span className="text-3xl mb-2 inline-block">{currentBenefits.icon}</span>
            <h3 className="text-lg font-bold text-gray-900">{currentBenefits.title}</h3>
          </div>
          <ul className="space-y-2">
            {currentBenefits.benefits.map((benefit, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                <span className="text-yellow-600 font-bold mt-0.5">✓</span>
                <span>{benefit}</span>
              </li>
            ))}
          </ul>
          {formData.role === 'affiliate' && (
            <div className="mt-3 pt-3 border-t border-yellow-300">
              <p className="text-xs text-gray-600 italic">
                <strong>Referral Bonus:</strong> Earn 2% on everything your recruited affiliates sell - passive income for life!
              </p>
            </div>
          )}
        </div>
        
        {/* Referral Banner */}
        {referralValid && referralCode && (
          <div className="mb-6 bg-gradient-to-r from-yellow-50 to-yellow-100 border-2 border-yellow-300 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Gift className="h-6 w-6 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-gray-900">You've been referred!</p>
                <p className="text-sm text-gray-700 mt-1">
                  <strong>{referrerName}</strong> invited you to join Beezio as an affiliate.
                </p>
                <p className="text-xs text-gray-600 mt-2">
                  Code: <span className="font-mono font-bold text-yellow-600">{referralCode}</span>
                </p>
              </div>
            </div>
          </div>
        )}
        
        {referralValid === false && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-600">
              Invalid or expired referral code. You can still sign up normally.
            </p>
          </div>
        )}
        
        {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">{error}</div>}
        {success && <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">{success}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Account Type</label>
            <select
              name="role"
              value={formData.role}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="buyer">Buyer - Shop Products</option>
              <option value="seller">Seller - Sell Products</option>
              <option value="affiliate">Affiliate - Promote & Earn</option>
              <option value="fundraiser">Fundraiser - Raise Funds</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
            <input type="email" name="email" value={formData.email} onChange={handleChange} required className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
            <input type="password" name="password" value={formData.password} onChange={handleChange} required minLength={6} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500" />
            <p className="text-xs text-gray-500 mt-1">Password must be at least 6 characters</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
            <input type="text" name="fullName" value={formData.fullName} onChange={handleChange} required className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Phone (Optional)</label>
            <input type="tel" name="phone" value={formData.phone} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">City (Optional)</label>
              <input type="text" name="city" value={formData.city} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">State (Optional)</label>
              <input type="text" name="state" value={formData.state} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">ZIP Code (Optional)</label>
            <input type="text" name="zipCode" value={formData.zipCode} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500" />
          </div>
          <button type="submit" disabled={loading} className="w-full bg-amber-500 text-white py-3 px-4 rounded-lg hover:bg-amber-600 transition-colors disabled:opacity-50 font-medium">
            {loading ? 'Please wait...' : 'Create Account'}
          </button>
        </form>
        
        {/* Login Link */}
        <div className="mt-6 text-center">
          <p className="text-gray-600">
            Already have an account?{' '}
            <button 
              type="button"
              className="text-amber-600 hover:text-amber-700 font-medium"
              onClick={() => window.dispatchEvent(new CustomEvent('open-auth-modal', { detail: { mode: 'login' } }))}
            >
              Sign in here
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default SignUpPage;
