import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContextMultiRole';
import { supabase } from '../lib/supabase';
import { Gift, Check, X } from 'lucide-react';

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
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const { signUp, signIn } = useAuth();
  const navigate = useNavigate();

  // Password strength calculation
  const getPasswordStrength = (password: string) => {
    if (!password) return { strength: 0, label: '', color: '' };
    
    let strength = 0;
    if (password.length >= 8) strength++;
    if (password.length >= 12) strength++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
    if (/\d/.test(password)) strength++;
    if (/[^a-zA-Z\d]/.test(password)) strength++;
    
    if (strength <= 2) return { strength, label: 'Weak', color: 'bg-red-500' };
    if (strength <= 3) return { strength, label: 'Fair', color: 'bg-yellow-500' };
    if (strength <= 4) return { strength, label: 'Good', color: 'bg-blue-500' };
    return { strength, label: 'Strong', color: 'bg-green-500' };
  };

  const passwordStrength = getPasswordStrength(formData.password);

  // Check for referral code in URL
  useEffect(() => {
    const refCode = searchParams.get('ref');
    if (refCode) {
      validateReferralCode(refCode);
    }
  }, [searchParams]);

  const validateReferralCode = async (code: string) => {
    try {
      // Look up profile by username (recruitment links use username)
      const { data, error } = await supabase
        .from('profiles')
        .select('id, user_id, full_name, username, primary_role')
        .eq('username', code)
        .single();

      // If not found by username, try by ID
      if (error || !data) {
        const { data: dataById, error: errorById } = await supabase
          .from('profiles')
          .select('id, user_id, full_name, username, primary_role')
          .eq('id', code)
          .single();

        if (errorById || !dataById) {
          setReferralValid(false);
          setReferralCode(null);
          return;
        }

        setReferralCode(dataById.id);
        setReferralValid(true);
        setReferrerName(dataById.full_name || dataById.username || 'Someone');
        setFormData(prev => ({ ...prev, role: 'affiliate' }));
        return;
      }

      setReferralCode(data.id); // Store profile ID for referred_by
      setReferralValid(true);
      setReferrerName(data.full_name || data.username || 'Someone');
      
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

    // Validation
    if (!acceptedTerms) {
      setError('You must accept the Terms of Service and Privacy Policy');
      setLoading(false);
      return;
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters long');
      setLoading(false);
      return;
    }

    try {
      // Only assign selected role
      const result = await signUp(formData.email, formData.password, { ...formData, role: formData.role });
      if (result.user) {
        // If there's a referral code, store it and create referral relationship
        if (referralCode && referralValid) {
          try {
            // Get the new user's profile ID
            const { data: newUserProfile } = await supabase
              .from('profiles')
              .select('id')
              .eq('user_id', result.user.id)
              .single();

            if (newUserProfile) {
              // Update new user's profile with referred_by (recruiter's profile ID)
              await supabase
                .from('profiles')
                .update({ 
                  referred_by: referralCode // This is the recruiter's profile ID
                })
                .eq('id', newUserProfile.id);

              console.log('✅ Referral relationship created: Recruiter', referralCode, '→ Recruit', newUserProfile.id);
              
              // The database trigger will automatically create the affiliate_recruiters record
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
          <div className="mb-4 sm:mb-6 bg-gradient-to-r from-purple-50 to-purple-100 border-2 border-purple-300 rounded-lg p-3 sm:p-4">
            <div className="flex items-start gap-2 sm:gap-3">
              <Gift className="h-5 w-5 sm:h-6 sm:w-6 text-purple-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm sm:text-base font-semibold text-gray-900">🎉 You've been recruited!</p>
                <p className="text-xs sm:text-sm text-gray-700 mt-1">
                  <strong>{referrerName}</strong> invited you to join Beezio as an affiliate.
                </p>
                <p className="text-xs text-gray-600 mt-1 sm:mt-2">
                  <strong>You'll earn:</strong> Full commission on your sales (set by sellers)<br />
                  <strong>They'll earn:</strong> 5% passive income from platform fee on your sales
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
            <input 
              type="password" 
              name="password" 
              value={formData.password} 
              onChange={handleChange} 
              required 
              minLength={8} 
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500" 
            />
            {formData.password && (
              <div className="mt-2">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-gray-600">Password Strength:</span>
                  <span className={`font-medium ${passwordStrength.strength >= 4 ? 'text-green-600' : passwordStrength.strength >= 3 ? 'text-blue-600' : passwordStrength.strength >= 2 ? 'text-yellow-600' : 'text-red-600'}`}>
                    {passwordStrength.label}
                  </span>
                </div>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map(level => (
                    <div 
                      key={level}
                      className={`h-1 flex-1 rounded ${level <= passwordStrength.strength ? passwordStrength.color : 'bg-gray-200'}`}
                    />
                  ))}
                </div>
                <div className="mt-2 space-y-1">
                  <div className={`text-xs flex items-center gap-1 ${formData.password.length >= 8 ? 'text-green-600' : 'text-gray-400'}`}>
                    {formData.password.length >= 8 ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                    <span>At least 8 characters</span>
                  </div>
                  <div className={`text-xs flex items-center gap-1 ${/[a-z]/.test(formData.password) && /[A-Z]/.test(formData.password) ? 'text-green-600' : 'text-gray-400'}`}>
                    {/[a-z]/.test(formData.password) && /[A-Z]/.test(formData.password) ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                    <span>Uppercase & lowercase letters</span>
                  </div>
                  <div className={`text-xs flex items-center gap-1 ${/\d/.test(formData.password) ? 'text-green-600' : 'text-gray-400'}`}>
                    {/\d/.test(formData.password) ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                    <span>At least one number</span>
                  </div>
                </div>
              </div>
            )}
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

          {/* Terms and Privacy Checkbox */}
          <div className="flex items-start gap-2">
            <input
              type="checkbox"
              id="terms"
              checked={acceptedTerms}
              onChange={(e) => setAcceptedTerms(e.target.checked)}
              className="mt-1 w-4 h-4 text-amber-600 border-gray-300 rounded focus:ring-amber-500"
              required
            />
            <label htmlFor="terms" className="text-sm text-gray-600">
              I agree to the{' '}
              <Link to="/terms" className="text-amber-600 hover:text-amber-700 underline" target="_blank">
                Terms of Service
              </Link>
              {' '}and{' '}
              <Link to="/privacy" className="text-amber-600 hover:text-amber-700 underline" target="_blank">
                Privacy Policy
              </Link>
            </label>
          </div>
          
          <button 
            type="submit" 
            disabled={loading || !acceptedTerms} 
            className="w-full bg-amber-500 text-white py-3 px-4 rounded-lg hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium text-base sm:text-lg"
          >
            {loading ? 'Creating Account...' : 'Create Account'}
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
