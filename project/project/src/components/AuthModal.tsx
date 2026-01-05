import React, { useState } from 'react';
import { X, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../contexts/AuthContextMultiRole';
import { supabase } from '../lib/supabase';

// Runtime check for Vite env vars (will be inlined at build time)
const RUNTIME_SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const RUNTIME_SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const isSupabaseConfigured = (): boolean => {
  if (!RUNTIME_SUPABASE_URL || !RUNTIME_SUPABASE_ANON) return false;
  if (RUNTIME_SUPABASE_URL.includes('placeholder') || RUNTIME_SUPABASE_ANON.includes('placeholder')) return false;
  return true;
};
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
  const { signIn, signUp, resetPassword, sendMagicLink, currentRole } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: '',
    storeName: '',
    role: 'buyer' as 'buyer' | 'seller' | 'affiliate' | 'fundraiser',
    phone: '',
    city: '',
    state: '',
    zipCode: '',
  });
  const [referralCode, setReferralCode] = useState<string>('');
  const [referralValid, setReferralValid] = useState<boolean | null>(null);
  const [referrerName, setReferrerName] = useState<string>('');
  const [referrerAffiliateId, setReferrerAffiliateId] = useState<string | null>(null);

  // Reset form state when modal opens/closes
  React.useEffect(() => {
    if (isOpen) {
      // Reset states when modal opens
      setLoading(false);
      setError(null);
      setSuccess(null);
      // Prefill referral code from URL if present
      const params = new URLSearchParams(window.location.search);
      const ref = params.get('recruit') || params.get('ref');
      if (ref) {
        setReferralCode(ref);
        validateReferralCode(ref);
      }
    }
  }, [isOpen]);

  const validateReferralCode = async (code: string) => {
    try {
      const cleaned = code.trim();
      if (!cleaned) {
        setReferralValid(null);
        setReferrerName('');
        setReferrerAffiliateId(null);
        return null;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, referral_code, primary_role, role')
        // Preferred: profiles.referral_code. Backward-compatible: username or id.
        .or(`referral_code.ilike.${cleaned},username.ilike.${cleaned},id.eq.${cleaned}`)
        .maybeSingle();

      if (error && (error as any).code !== 'PGRST116') {
        console.warn('Referral lookup warning:', error);
      }

      if (data) {
        setReferralValid(true);
        setReferrerName((data as any).full_name || (data as any).referral_code || 'A referrer');
        setReferrerAffiliateId((data as any).id);
        return (data as any).id;
      }

      setReferralValid(false);
      setReferrerName('');
      setReferrerAffiliateId(null);
      return null;
    } catch (err) {
      console.error('Referral validation error:', err);
      setReferralValid(false);
      setReferrerName('');
      setReferrerAffiliateId(null);
      return null;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('AuthModal: Form submitted, mode:', mode, 'email:', formData.email);
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Quick guard: if Supabase isn't configured in the deployed environment, surface an instructive error
      if (!isSupabaseConfigured()) {
        console.error('Supabase environment variables missing at runtime. Ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in Netlify.');
        setError('Site not configured: authentication is currently unavailable. If you are the site owner, configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Netlify.');
        setLoading(false);
        return;
      }
      if (mode === 'forgot') {
        console.log('AuthModal: Attempting password reset...');

        // Wrap reset in a timeout promise so the UI doesn't spin forever
        const resetPromise = resetPassword(formData.email);
        const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 10000));

        await Promise.race([resetPromise, timeout])
          .then(() => {
            setSuccess('Password reset email sent! Check your inbox for instructions.');
            setTimeout(() => {
              setMode('login');
              setSuccess(null);
            }, 3000);
          })
          .catch((err: any) => {
            console.error('Password reset error or timeout:', err);
            if (err && err.message === 'timeout') {
              setError('Password reset is taking too long. Please try again or contact support.');
            } else {
              setError(err?.message || 'Failed to send password reset email.');
            }
          })
          .finally(() => {
            setLoading(false);
          });
        return;

      } else if (mode === 'login') {
        console.log('AuthModal: Attempting sign in...');
        const result = await signIn(formData.email, formData.password);
        console.log('AuthModal: Sign in result:', result);
        
        if (result && (result.user || result.session)) {
          console.log('AuthModal: Login successful, user:', result.user?.email);
          
          // Success! Just close and navigate
          onClose();

          try {
            const userId = (result.user || result.session?.user)?.id;
            if (userId) {
              const { data: profileRow } = await supabase
                .from('profiles')
                .select('role, primary_role, stripe_account_id')
                .or(`id.eq.${userId},user_id.eq.${userId}`)
                .maybeSingle();

              const effectiveRole = String((profileRow as any)?.primary_role || (profileRow as any)?.role || 'buyer');
              const stripeConnected = Boolean((profileRow as any)?.stripe_account_id);
              navigate(effectiveRole !== 'buyer' && !stripeConnected ? '/onboarding' : '/dashboard');
            } else {
              navigate('/dashboard');
            }
          } catch {
            navigate('/dashboard');
          }
        } else {
          console.warn('Sign in returned no user/session:', result);
          setError('Sign in failed. Please check your credentials and try again.');
        }
        setLoading(false);
      } else {
        console.log('AuthModal: Attempting sign up...');
        const result = await signUp(formData.email, formData.password, { ...formData, referralCode });
        
        if (result && result.user) {
          // For affiliate accounts, ensure a stable referral_code exists immediately.
          // Deterministic: derived from profile UUID so it never changes.
          let newProfileId: string | null = null;
          try {
            for (let attempt = 0; attempt < 5; attempt++) {
              const { data: newProfile } = await supabase
                .from('profiles')
                .select('id')
                .or(`id.eq.${result.user.id},user_id.eq.${result.user.id}`)
                .maybeSingle();
              if (newProfile?.id) {
                newProfileId = newProfile.id as string;
                break;
              }
              await new Promise(resolve => setTimeout(resolve, 250));
            }

            if (formData.role === 'affiliate' && newProfileId) {
              const compact = String(newProfileId).replace(/-/g, '').toUpperCase();
              const deterministicReferralCode = `BZO${compact.slice(0, 12)}`;
              await supabase
                .from('profiles')
                .update({ referral_code: deterministicReferralCode })
                .eq('id', newProfileId)
                .is('referral_code', null);
            }
          } catch (codeErr) {
            console.warn('Referral code ensure failed (non-blocking):', codeErr);
          }

          // If recruiter referral code is present and valid, attach it to the new profile.
          // Applies to ANY role; the referrer earns 5% on the recruit's sales.
          if (referralCode && referralValid && referrerAffiliateId) {
            try {
              const targetProfileId = newProfileId || (await (async () => {
                const { data } = await supabase
                  .from('profiles')
                  .select('id')
                  .eq('user_id', result.user.id)
                  .maybeSingle();
                return (data?.id as string | undefined) || null;
              })());

              if (targetProfileId) {
                const { error: attachErr } = await supabase
                  .from('profiles')
                  .update({
                    referred_by_affiliate_id: referrerAffiliateId,
                    // Optional column (if present in your schema) for audit/debug
                    referral_code_used: referralCode,
                  })
                  .eq('id', targetProfileId);

                // If referral_code_used column doesn't exist, retry without it.
                if (attachErr) {
                  await supabase
                    .from('profiles')
                    .update({ referred_by_affiliate_id: referrerAffiliateId })
                    .eq('id', targetProfileId);
                }
              }
            } catch (refErr) {
              console.warn('Referral attach failed (non-blocking):', refErr);
            }
          }
          // Supabase: If email confirmation is required, session will be null
          if (!result.session) {
            setSuccess('Account created! Please check your email to confirm your account before logging in.');
            setLoading(false);
            return;
          }
          
          // Success! Just close and navigate
          console.log('AuthModal: Signup successful, user:', result.user?.email);
          onClose();
          if (formData.role && formData.role !== 'buyer') {
            navigate('/onboarding');
          } else {
            navigate('/dashboard');
          }
        }
        setLoading(false);
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      const msg = err?.message || String(err);
      if (msg.includes('already exists')) {
        setError('An account with this email already exists. Please sign in instead.');
        setTimeout(() => {
          setMode('login');
          setError(null);
        }, 3000);
      } else if (msg.includes('Invalid login credentials') || msg.includes('Invalid login')) {
        setError('Invalid email or password. Please check your credentials and try again.');
      } else if (msg.includes('Email not confirmed') || msg.includes('email_not_confirmed')) {
        setError('Please check your email and click the confirmation link before signing in.');
      } else if (msg.includes('Too many requests')) {
        setError('Too many login attempts. Please wait a few minutes before trying again.');
      } else {
        setError(msg || 'An error occurred during authentication');
      }
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
                autoComplete="email"
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
                    autoComplete="current-password"
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
                    Store Name
                  </label>
                  <input
                    type="text"
                    name="storeName"
                    value={(formData as any).storeName}
                    onChange={handleChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                    placeholder="e.g., Beezio Deals"
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
                    Referral Code (Optional)
                    <span className="block text-xs text-gray-500 mt-1">If someone invited you, paste their code here.</span>
                  </label>
                  <input
                    type="text"
                    value={referralCode}
                    onChange={(e) => {
                      const code = e.target.value.trim();
                      setReferralCode(code);
                      if (code.length >= 3) {
                        validateReferralCode(code);
                      } else {
                        setReferralValid(null);
                        setReferrerName('');
                      }
                    }}
                    placeholder="Enter inviter's code"
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                      referralValid === true
                        ? 'border-green-500 bg-green-50'
                        : referralValid === false
                        ? 'border-red-500 bg-red-50'
                        : 'border-gray-300'
                    }`}
                  />
                  {referralValid === true && (
                    <p className="text-xs text-green-700 mt-1">
                      Valid code from {referrerName}. You keep your full share; they earn 5% from Beezio's fee.
                    </p>
                  )}
                  {referralValid === false && (
                    <p className="text-xs text-red-600 mt-1">Code not found. Double-check or leave blank.</p>
                  )}
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
