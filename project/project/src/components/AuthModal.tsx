import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../contexts/AuthContextMultiRole';
import { supabase } from '../lib/supabase';
import { deriveStoreSlug, isValidStoreSlug } from '../utils/storeSlug';
import { buildDeterministicReferralCode } from '../utils/referralCode';
import { consumePostAuthPath } from '../utils/storefrontScope';
import { PASSWORD_REQUIREMENT_MESSAGE, validatePasswordPolicy } from '../utils/passwordPolicy';
import { sendSignupVerificationEmail } from '../services/signupVerificationClient';

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
  audience?: 'buyer' | 'business';
}

const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, mode: initialMode, audience = 'business' }) => {
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
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState('');
  const { signIn, signUp, resendVerificationEmail, resetPassword, sendMagicLink, currentRole } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: '',
    storeName: '',
    role: 'buyer' as 'buyer' | 'seller' | 'affiliate',
    phone: '',
    streetAddress: '',
    city: '',
    state: '',
    zipCode: '',
    paypalEmail: '',
    paypalConfirmed: false,
  });
  const [storeSlugStatus, setStoreSlugStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid' | 'error'>('idle');
  const [storeSlugMessage, setStoreSlugMessage] = useState('');
  const [storeSlugValue, setStoreSlugValue] = useState('');
  const isBuyerAudience = audience === 'buyer';
  const isBusinessAudience = !isBuyerAudience;
  const storeSlugBlockingState =
    isBusinessAudience &&
    mode === 'register' &&
    (!storeSlugValue ||
      storeSlugStatus === 'checking' ||
      storeSlugStatus === 'taken' ||
      storeSlugStatus === 'invalid' ||
      storeSlugStatus === 'error');
  const storeNameInputClass =
    storeSlugStatus === 'taken' || storeSlugStatus === 'invalid' || storeSlugStatus === 'error'
      ? 'border-red-300 focus:ring-red-500'
      : storeSlugStatus === 'available'
      ? 'border-green-300 focus:ring-green-500'
      : 'border-gray-300 focus:ring-amber-500';
  const availabilityPanelClass =
    storeSlugStatus === 'available'
      ? 'border-green-200 bg-green-50 text-green-800'
      : storeSlugStatus === 'checking'
      ? 'border-amber-200 bg-amber-50 text-amber-800'
      : storeSlugStatus === 'taken' || storeSlugStatus === 'invalid' || storeSlugStatus === 'error'
      ? 'border-red-200 bg-red-50 text-red-800'
      : 'border-gray-200 bg-gray-50 text-gray-700';
  const audienceBenefits = isBuyerAudience
    ? [
        'One buyer account that works across every Beezio storefront.',
        'Your orders, receipts, and support history stay in one place.',
        'Email confirmation keeps the account verified before sign-in.',
      ]
    : [
        'Seller, affiliate, and influencer tools in one business account.',
        'A primary storefront plus affiliate and recruiting access from day one.',
        'One dashboard for products, promotions, referrals, and payouts.',
      ];

  const resolvePostAuthTarget = (fallback: string) => consumePostAuthPath() || fallback;

  // Reset form state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      // Reset states when modal opens
      setLoading(false);
      setError(null);
      setSuccess(null);
      setPendingVerificationEmail('');
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') return;

    const { body } = document;
    const previousOverflow = body.style.overflow;
    const previousTouchAction = body.style.touchAction;

    body.style.overflow = 'hidden';
    body.style.touchAction = 'none';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      body.style.overflow = previousOverflow;
      body.style.touchAction = previousTouchAction;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  const resolveStoreName = () => {
    const trimmed = String(formData.storeName || '').trim();
    if (trimmed) return trimmed;
    const emailBase = String(formData.email || '').trim().split('@')[0] || '';
    return emailBase;
  };

  const checkSlugAvailability = async (slug: string) => {
    if (!slug) return false;
    const isIgnorableLookupError = (err: any) => {
      if (!err) return true;
      const code = String(err?.code || '').trim().toUpperCase();
      if (code === 'PGRST116') return true; // no rows
      const message = String(err?.message || '').toLowerCase();
      return (
        message.includes('schema cache') ||
        message.includes('does not exist') ||
        message.includes('could not find the')
      );
    };

    const [
      { data: sellerMatch, error: sellerCheckError },
      { data: affiliateMatch, error: affiliateCheckError },
      { data: profileMatch, error: profileCheckError }
    ] = await Promise.all([
      supabase.from('store_settings').select('seller_id').eq('subdomain', slug).maybeSingle(),
      supabase.from('affiliate_store_settings').select('affiliate_id').eq('subdomain', slug).maybeSingle(),
      supabase.from('profiles').select('id').eq('subdomain', slug).maybeSingle(),
    ]);

    if (!isIgnorableLookupError(sellerCheckError)) throw sellerCheckError;
    if (!isIgnorableLookupError(affiliateCheckError)) throw affiliateCheckError;
    if (!isIgnorableLookupError(profileCheckError)) throw profileCheckError;

    if (sellerMatch?.seller_id) return false;
    if (affiliateMatch?.affiliate_id) return false;
    if (profileMatch?.id) return false;
    return true;
  };

  React.useEffect(() => {
    if (mode !== 'register') return;
    if (!isBusinessAudience) {
      setStoreSlugStatus('idle');
      setStoreSlugMessage('');
      setStoreSlugValue('');
      return;
    }

    const candidate = resolveStoreName();
    if (!candidate) {
      setStoreSlugStatus('idle');
      setStoreSlugMessage('');
      setStoreSlugValue('');
      return;
    }

    const slug = deriveStoreSlug(candidate);
    setStoreSlugValue(slug);

    if (!isValidStoreSlug(slug)) {
      setStoreSlugStatus('invalid');
      setStoreSlugMessage('Store URL must be 3-32 characters and not reserved.');
      return;
    }

    let alive = true;
    setStoreSlugStatus('checking');
    setStoreSlugMessage('Checking store URL availability...');

    const timer = window.setTimeout(async () => {
      try {
        const available = await checkSlugAvailability(slug);
        if (!alive) return;
        if (available) {
          setStoreSlugStatus('available');
          setStoreSlugMessage('Store URL is available.');
        } else {
          setStoreSlugStatus('taken');
          setStoreSlugMessage('That store URL is already taken.');
        }
      } catch {
        if (!alive) return;
        setStoreSlugStatus('error');
        setStoreSlugMessage('Unable to check store URL right now.');
      }
    }, 400);

    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [formData.email, formData.storeName, isBusinessAudience, mode]);

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

          if (isBuyerAudience) {
            navigate(resolvePostAuthTarget('/dashboard?section=buyer'));
            setLoading(false);
            return;
          }

          navigate(resolvePostAuthTarget('/dashboard'));
        } else {
          console.warn('Sign in returned no user/session:', result);
          setError('Sign in failed. Please check your credentials and try again.');
        }
        setLoading(false);
      } else {
        console.log('AuthModal: Attempting sign up...');
        const isNonBuyer = isBusinessAudience;
        const signupRole = isBuyerAudience ? 'buyer' : 'seller';
        const resolvedStoreName = isNonBuyer ? resolveStoreName() : '';
        if (isNonBuyer && (!resolvedStoreName || resolvedStoreName.length < 2)) {
          setError('Please choose a business or store name (at least 2 characters).');
          setLoading(false);
          return;
        }
        if (isNonBuyer && !String(formData.fullName || '').trim()) {
          setError('Full name is required.');
          setLoading(false);
          return;
        }
        if (isNonBuyer && !String(formData.phone || '').trim()) {
          setError('Phone number is required.');
          setLoading(false);
          return;
        }
        if (isNonBuyer && !String((formData as any).streetAddress || '').trim()) {
          setError('Street address is required.');
          setLoading(false);
          return;
        }
        if (isNonBuyer && !String(formData.city || '').trim()) {
          setError('City is required.');
          setLoading(false);
          return;
        }
        if (isNonBuyer && !String(formData.state || '').trim()) {
          setError('State is required.');
          setLoading(false);
          return;
        }

        const storeSlug = isNonBuyer ? deriveStoreSlug(resolvedStoreName) : '';
        const passwordError = validatePasswordPolicy(formData.password);
        if (passwordError) {
          setError(passwordError);
          setLoading(false);
          return;
        }
        if (isNonBuyer) {
          const payoutEmail = String((formData as any).paypalEmail || '').trim();
          if (!payoutEmail || !payoutEmail.includes('@')) {
            setError('Please enter your PayPal payout email.');
            setLoading(false);
            return;
          }
          if (!(formData as any).paypalConfirmed) {
            setError('Please confirm your PayPal payout email.');
            setLoading(false);
            return;
          }
        }
        if (isNonBuyer) {
          if (!isValidStoreSlug(storeSlug)) {
            setError('Your store URL is not valid. Please choose a different business name.');
            setLoading(false);
            return;
          }
          const available = await checkSlugAvailability(storeSlug);
          if (!available) {
            setError('That store URL is already taken. Please choose a different business name.');
            setLoading(false);
            return;
          }
        }

        const result = await signUp(formData.email, formData.password, {
          ...formData,
          role: signupRole,
          bundleBusinessRoles: isBusinessAudience,
          storeName: isNonBuyer ? resolvedStoreName : '',
          storeSlug: isNonBuyer ? storeSlug : '',
          paypalEmail: isNonBuyer ? String((formData as any).paypalEmail || '').trim() : '',
          paypalConfirmed: isNonBuyer ? Boolean((formData as any).paypalConfirmed) : false,
        });
        
        if (result && result.user) {
          // Supabase: If email confirmation is required, session will be null.
          // Switch the UI immediately instead of waiting on profile setup work.
          if (!result.session) {
            let emailSent = false;
            let sendError = '';
            try {
              await sendSignupVerificationEmail({
                userId: result.user.id,
                email: formData.email,
                fullName: formData.fullName,
              });
              emailSent = true;
            } catch (resendErr: any) {
              console.warn('AuthModal verification send failed after sign up:', resendErr);
              sendError = String(resendErr?.message || 'Failed to send verification email.');
            }
            onClose();
            const verifyParams = new URLSearchParams({
              flow: 'signup',
              email: formData.email,
              email_sent: emailSent ? '1' : '0',
            });
            if (sendError) verifyParams.set('send_error', sendError);
            navigate(`/auth/verify?${verifyParams.toString()}`);
            setLoading(false);
            return;
          }

          // Ensure every account has a stable referral_code immediately.
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

            if (newProfileId) {
              const deterministicReferralCode = buildDeterministicReferralCode(String(newProfileId));
              await supabase
                .from('profiles')
                .update({ referral_code: deterministicReferralCode })
                .eq('id', newProfileId)
                .is('referral_code', null);
            }
          } catch (codeErr) {
            console.warn('Referral code ensure failed (non-blocking):', codeErr);
          }
          
          // Success! Just close and navigate
          console.log('AuthModal: Signup successful, user:', result.user?.email);
          onClose();
          if (isBusinessAudience) {
            const hasPayout = String((formData as any).paypalEmail || '').trim().length > 0 && Boolean((formData as any).paypalConfirmed);
            navigate(hasPayout ? '/dashboard' : '/onboarding');
          } else {
            navigate(resolvePostAuthTarget('/dashboard?section=buyer'));
          }
        }
        setLoading(false);
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      const msg = err?.message || String(err);
      if (msg.includes('already exists')) {
        setError('That email address already has an account. Use a different email or sign in.');
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

  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={mode === 'login' ? 'Sign In' : mode === 'register' ? 'Create Account' : 'Reset Password'}
        className="pointer-events-auto flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-white/80 bg-white shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="relative overflow-hidden border-b border-amber-100 bg-gradient-to-br from-amber-50 via-white to-emerald-50 p-6">
          <div className="absolute -right-10 -top-12 h-32 w-32 rounded-full bg-amber-200/45 blur-2xl" />
          <div className="absolute -left-10 bottom-0 h-28 w-28 rounded-full bg-emerald-200/45 blur-2xl" />
          <div className="relative flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-700">
                {isBuyerAudience ? 'Buyer Account' : 'Business Account'}
              </p>
              <h2 className="mt-2 text-3xl font-semibold leading-tight text-slate-950" style={{ fontFamily: 'Fraunces, serif' }}>
                {mode === 'login'
                  ? isBuyerAudience ? 'Customer sign in' : 'Business sign in'
                  : mode === 'register'
                  ? isBuyerAudience ? 'Create buyer account' : 'Create business account'
                  : 'Reset password'}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {isBuyerAudience
                  ? 'Use one customer account for checkout, orders, and support across Beezio storefronts.'
                  : 'Use one Beezio business account for selling, promotions, recruiting, and payouts.'}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-slate-200 bg-white/85 p-2 text-slate-600 shadow-sm transition-colors hover:bg-white hover:text-slate-900"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
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
            {pendingVerificationEmail && (
              <div className="rounded border border-amber-300 bg-amber-50 px-4 py-3 text-amber-900">
                <p className="text-sm">Email verification is required before sign in.</p>
                <button
                  type="button"
                  onClick={async () => {
                    setLoading(true);
                    setError(null);
                    setSuccess(null);
                    try {
                      await resendVerificationEmail(pendingVerificationEmail);
                      setSuccess(`Verification email sent again to ${pendingVerificationEmail}.`);
                    } catch (err: any) {
                      setError(err?.message || 'Failed to resend verification email.');
                    } finally {
                      setLoading(false);
                    }
                  }}
                  className="mt-2 text-sm font-medium text-amber-700 underline hover:text-amber-800"
                >
                  Resend verification email
                </button>
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
                autoFocus
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
                    minLength={8}
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
                  <p className="text-xs text-gray-500 mt-1">{PASSWORD_REQUIREMENT_MESSAGE}</p>
                )}
              </div>
            )}
            {mode === 'register' && (
              <React.Fragment>
                <div className="rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50 to-emerald-50/70 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-700">What You Get</p>
                  <ul className="mt-2 space-y-1 text-xs text-slate-700">
                    {audienceBenefits.map((item) => (
                      <li key={item} className="flex items-start gap-2">
                        <span className="mt-0.5 text-amber-600">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
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
                {isBusinessAudience && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Business or Store Name
                  </label>
                  <input
                    type="text"
                    name="storeName"
                    value={(formData as any).storeName}
                    onChange={handleChange}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${storeNameInputClass}`}
                    placeholder="e.g., Jason Store"
                  />
                  {!formData.storeName.trim() && formData.email && (
                    <p className="text-xs text-gray-500 mt-1">
                      Defaulting to your username: {formData.email.split('@')[0]}
                    </p>
                  )}
                  {storeSlugValue && isBusinessAudience && (
                    <div className={`mt-2 rounded-lg border px-3 py-2 ${availabilityPanelClass}`}>
                      <p className="text-xs">
                        Store URL: <span className="font-semibold">/store/{storeSlugValue}</span>
                      </p>
                      <p className="mt-1 text-sm font-semibold">
                        {storeSlugStatus === 'available'
                          ? 'Available'
                          : storeSlugStatus === 'taken'
                          ? 'Not available'
                          : storeSlugStatus === 'checking'
                          ? 'Checking availability...'
                          : storeSlugStatus === 'invalid'
                          ? 'Invalid store name'
                          : 'Availability unavailable'}
                      </p>
                      <p className="mt-1 text-xs">
                        {storeSlugStatus === 'available'
                          ? 'This store name can be used.'
                          : storeSlugStatus === 'taken'
                          ? 'This store name is already taken. You cannot create the account until you choose a different one.'
                          : storeSlugMessage || 'Enter a different store name and try again.'}
                      </p>
                    </div>
                  )}
                </div>
                )}
                {isBusinessAudience && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <h4 className="text-sm font-semibold text-gray-900 mb-2">Business account snapshot</h4>
                    <ul className="mb-3 text-xs text-gray-700 space-y-1">
                      <li>Your signup creates seller, affiliate, and influencer access together.</li>
                      <li>You get seller storefront tools, affiliate sharing tools, and influencer recruiting tools in one account.</li>
                      <li>One signup sets up the combined business account instead of asking you to pick one role first.</li>
                    </ul>
                    <h4 className="text-sm font-semibold text-gray-900 mb-2">Payout setup</h4>
                    <p className="text-xs text-gray-600 mb-3">
                      Add the PayPal email where you want Beezio payouts sent.
                    </p>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      PayPal payout email
                    </label>
                    <input
                      type="email"
                      name="paypalEmail"
                      value={(formData as any).paypalEmail}
                      onChange={handleChange}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                      placeholder="you@paypal-email.com"
                    />
                    <label className="mt-3 flex items-start gap-2 text-xs text-gray-600">
                      <input
                        type="checkbox"
                        checked={(formData as any).paypalConfirmed}
                        onChange={(e) => setFormData({ ...formData, paypalConfirmed: e.target.checked })}
                        className="mt-1 h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                      />
                      <span>
                        I confirm this is my PayPal email for receiving payouts (seller, partner, and influencer earnings).
                      </span>
                    </label>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phone
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    required={isBusinessAudience}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Street Address
                  </label>
                  <input
                    type="text"
                    name="streetAddress"
                    value={(formData as any).streetAddress || ''}
                    onChange={handleChange}
                    required={isBusinessAudience}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      City
                    </label>
                    <input
                      type="text"
                      name="city"
                      value={formData.city}
                      onChange={handleChange}
                      required={isBusinessAudience}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      State
                    </label>
                    <input
                      type="text"
                      name="state"
                      value={formData.state}
                      onChange={handleChange}
                      required={isBusinessAudience}
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
          <div className="border-t border-slate-100 bg-slate-50 p-6">
            <button
              type="submit"
              disabled={loading || Boolean(storeSlugBlockingState)}
              className="w-full rounded-full bg-amber-500 px-4 py-3 font-semibold text-black shadow-sm transition-colors hover:bg-amber-600 disabled:opacity-50"
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
    </div>,
    document.body
  );
};

export default AuthModal;
