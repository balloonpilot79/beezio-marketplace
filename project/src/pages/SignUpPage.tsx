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
      // Query profiles table to find the referrer by their referral_code
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, email, full_name, referral_code, primary_role')
        .eq('referral_code', code.toUpperCase())
        .or('primary_role.eq.affiliate,primary_role.eq.fundraiser')
        .single();

      if (error || !data) {
        setReferralValid(false);
        setReferralCode(null);
        return;
      }

      setReferralCode(code.toUpperCase());
      setReferralValid(true);
      setReferrerName(data.full_name || data.email.split('@')[0]);
      
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
            // Get referrer's user_id from profiles table
            const { data: referrer } = await supabase
              .from('profiles')
              .select('user_id')
              .eq('referral_code', referralCode)
              .single();

            if (referrer) {
              // Update new user's profile with referred_by info
              await supabase
                .from('profiles')
                .update({ 
                  referred_by: referrer.user_id,
                  referral_code_used: referralCode 
                })
                .eq('user_id', result.user.id);

              // Create affiliate_referrals record
              await supabase
                .from('affiliate_referrals')
                .insert({
                  referrer_affiliate_id: referrer.user_id,
                  referred_affiliate_id: result.user.id,
                  referral_code: referralCode,
                  status: 'active'
                });
              
              console.log('✅ Referral relationship created:', referrer.user_id, '→', result.user.id);
            }
          } catch (refErr) {
            console.error('Error saving referral relationship:', refErr);
            // Don't fail signup if referral tracking fails
          }
        }

        setSuccess('Account created successfully! Signing you in...');
        
        if (!result.session) {
          setSuccess('Account created! Please check your email to confirm your account before logging in.');
          setLoading(false);
          return;
        }
        
        // Wait a moment for profile to be fully set in context
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        try {
          const signInResult = await signIn(formData.email, formData.password);
          if (signInResult.user) {
            // Wait for profile to load
            await new Promise(resolve => setTimeout(resolve, 500));
            
            console.log('✅ Sign up complete! Navigating to dashboard...');
            // Route ALL users to unified dashboard regardless of role
            navigate('/dashboard');
          } else {
            setError('Sign in failed after registration. Please try logging in manually.');
          }
        } catch (signInError: any) {
          setError(signInError.message || 'Sign in failed after registration. Please try logging in manually.');
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
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-6 px-4 sm:py-12">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl p-4 sm:p-6 md:p-8">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2 text-center">Create Your Account</h2>
        
        {/* Role Benefits Section */}
        <div className="mb-4 sm:mb-6 bg-gradient-to-br from-yellow-50 to-amber-50 border-2 border-yellow-200 rounded-lg p-3 sm:p-5">
          <div className="text-center mb-2 sm:mb-3">
            <span className="text-2xl sm:text-3xl mb-1 sm:mb-2 inline-block">{currentBenefits.icon}</span>
            <h3 className="text-base sm:text-lg font-bold text-gray-900">{currentBenefits.title}</h3>
          </div>
          <ul className="space-y-1.5 sm:space-y-2">
            {currentBenefits.benefits.map((benefit, idx) => (
              <li key={idx} className="flex items-start gap-2 text-xs sm:text-sm text-gray-700">
                <span className="text-yellow-600 font-bold mt-0.5 flex-shrink-0">✓</span>
                <span>{benefit}</span>
              </li>
            ))}
          </ul>
          {formData.role === 'affiliate' && (
            <div className="mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-yellow-300">
              <p className="text-xs text-gray-600 italic">
                <strong>Referral Bonus:</strong> Earn 5% on everything your recruited affiliates sell - passive income for life!
              </p>
            </div>
          )}
        </div>
        
        {/* Referral Banner */}
        {referralValid && referralCode && (
          <div className="mb-4 sm:mb-6 bg-gradient-to-r from-yellow-50 to-yellow-100 border-2 border-yellow-300 rounded-lg p-3 sm:p-4">
            <div className="flex items-start gap-2 sm:gap-3">
              <Gift className="h-5 w-5 sm:h-6 sm:w-6 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm sm:text-base font-semibold text-gray-900">You've been referred!</p>
                <p className="text-xs sm:text-sm text-gray-700 mt-1">
                  <strong>{referrerName}</strong> invited you to join Beezio as an affiliate.
                </p>
                <p className="text-xs text-gray-600 mt-1 sm:mt-2">
                  Code: <span className="font-mono font-bold text-yellow-600">{referralCode}</span>
                </p>
              </div>
            </div>
          </div>
        )}
        
        {referralValid === false && (
          <div className="mb-4 sm:mb-6 bg-red-50 border border-red-200 rounded-lg p-3 sm:p-4">
            <p className="text-xs sm:text-sm text-red-600">
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
          
          {/* Referral Code Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Referral Code (Optional)
              <span className="block sm:inline sm:ml-2 text-xs text-gray-500 mt-1 sm:mt-0">Have a friend's code? Enter it here!</span>
            </label>
            <input 
              type="text" 
              value={referralCode || ''} 
              onChange={(e) => {
                const code = e.target.value.toUpperCase();
                if (code) {
                  validateReferralCode(code);
                } else {
                  setReferralCode(null);
                  setReferralValid(null);
                  setReferrerName('');
                }
              }}
              placeholder="Enter code (e.g., JOHN2024)"
              className={`w-full px-3 py-2 text-base border rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                referralValid === true 
                  ? 'border-green-400 bg-green-50' 
                  : referralValid === false 
                  ? 'border-red-400 bg-red-50' 
                  : 'border-gray-300'
              }`}
            />
            {referralValid === true && (
              <p className="text-xs text-green-600 mt-1 flex items-start gap-1">
                <span className="flex-shrink-0">✓</span>
                <span>Valid code! You'll earn 5% on everything {referrerName} sells</span>
              </p>
            )}
            {referralValid === false && (
              <p className="text-xs text-red-600 mt-1">
                Invalid code. Check the spelling or leave blank to skip.
              </p>
            )}
          </div>
          
          <button type="submit" disabled={loading} className="w-full bg-amber-500 text-white py-3 px-4 rounded-lg hover:bg-amber-600 transition-colors disabled:opacity-50 font-medium text-base sm:text-lg">
            {loading ? 'Please wait...' : 'Create Account'}
          </button>
        </form>
        
        {/* Login Link */}
        <div className="mt-4 sm:mt-6 text-center">
          <p className="text-sm sm:text-base text-gray-600">
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
