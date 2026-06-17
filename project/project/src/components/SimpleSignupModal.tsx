import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContextMultiRole';
import { supabase } from '../lib/supabase';
import { deriveStoreSlug, isValidStoreSlug } from '../utils/storeSlug';
import { Link, useNavigate } from 'react-router-dom';
import { PASSWORD_REQUIREMENT_MESSAGE, validatePasswordPolicy } from '../utils/passwordPolicy';
import { sendSignupVerificationEmail } from '../services/signupVerificationClient';

interface SimpleSignupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const showSignupBackButton = import.meta.env.VITE_ENABLE_SIGNUP_BACK_BUTTON === 'true';

const SimpleSignupModal: React.FC<SimpleSignupModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { signUp, signIn, resetPassword, resendVerificationEmail } = useAuth();
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState('');
  const [step, setStep] = useState(2);
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: '',
    storeName: '',
    phone: '',
    streetAddress: '',
    city: '',
    state: '',
    zipCode: '',
    paypalEmail: '',
    paypalConfirmed: false
  });
  const [storeSlugStatus, setStoreSlugStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid' | 'error'>('idle');
  const [storeSlugMessage, setStoreSlugMessage] = useState('');
  const [storeSlugValue, setStoreSlugValue] = useState('');

  useEffect(() => {
    const candidate = String(formData.storeName || '').trim() || String(formData.email || '').trim().split('@')[0] || '';
    if (!candidate || isLogin) {
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
        const [{ data: sellerMatch }, { data: affiliateMatch }, { data: profileMatch }] = await Promise.all([
          supabase.from('store_settings').select('seller_id').eq('subdomain', slug).maybeSingle(),
          supabase.from('affiliate_store_settings').select('affiliate_id').eq('subdomain', slug).maybeSingle(),
          supabase.from('profiles').select('id').eq('subdomain', slug).maybeSingle(),
        ]);

        if (!alive) return;
        if (sellerMatch?.seller_id || affiliateMatch?.affiliate_id || profileMatch?.id) {
          setStoreSlugStatus('taken');
          setStoreSlugMessage('That store URL is already taken.');
        } else {
          setStoreSlugStatus('available');
          setStoreSlugMessage('Store URL is available.');
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
  }, [formData.email, formData.storeName, isLogin]);

  const storeSlugBlockingState =
    !isLogin &&
    (!storeSlugValue ||
      storeSlugStatus === 'checking' ||
      storeSlugStatus === 'taken' ||
      storeSlugStatus === 'invalid' ||
      storeSlugStatus === 'error');
  const storeNameInputClass =
    storeSlugStatus === 'taken' || storeSlugStatus === 'invalid' || storeSlugStatus === 'error'
      ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
      : storeSlugStatus === 'available'
      ? 'border-green-300 focus:ring-green-500 focus:border-green-500'
      : 'border-gray-300 focus:ring-orange-500 focus:border-orange-500';
  const availabilityPanelClass =
    storeSlugStatus === 'available'
      ? 'border-green-200 bg-green-50 text-green-800'
      : storeSlugStatus === 'checking'
      ? 'border-amber-200 bg-amber-50 text-amber-800'
      : storeSlugStatus === 'taken' || storeSlugStatus === 'invalid' || storeSlugStatus === 'error'
      ? 'border-red-200 bg-red-50 text-red-800'
      : 'border-gray-200 bg-gray-50 text-gray-700';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setNotice('');

    try {
      let targetRoute = '/dashboard';
      if (isLogin) {
        await signIn(formData.email, formData.password);
      } else {
        const passwordError = validatePasswordPolicy(formData.password);
        if (passwordError) {
          setError(passwordError);
          setLoading(false);
          return;
        }

        const resolvedStoreName = String(formData.storeName || '').trim() || String(formData.email || '').split('@')[0] || '';
        const storeSlug = deriveStoreSlug(resolvedStoreName);
        if (!String(formData.fullName || '').trim()) {
          setError('Full name is required.');
          setLoading(false);
          return;
        }
        if (!String(formData.phone || '').trim()) {
          setError('Phone number is required.');
          setLoading(false);
          return;
        }
        if (!String(formData.streetAddress || '').trim()) {
          setError('Street address is required.');
          setLoading(false);
          return;
        }
        if (!String(formData.city || '').trim()) {
          setError('City is required.');
          setLoading(false);
          return;
        }
        if (!String(formData.state || '').trim()) {
          setError('State is required.');
          setLoading(false);
          return;
        }

        if (!isValidStoreSlug(storeSlug)) {
          setError('Your store URL is not valid. Please choose a different business name.');
          setLoading(false);
          return;
        }
        const payoutEmail = String(formData.paypalEmail || '').trim();
        if (!payoutEmail || !payoutEmail.includes('@')) {
          setError('Please enter the PayPal email you want to receive payouts to.');
          setLoading(false);
          return;
        }
        if (!formData.paypalConfirmed) {
          setError('Please confirm your PayPal payout email to continue.');
          setLoading(false);
          return;
        }
        const result = await signUp(formData.email, formData.password, {
          ...formData,
          role: 'seller',
          bundleBusinessRoles: true,
          storeName: resolvedStoreName,
          storeSlug,
          paypalEmail: formData.paypalEmail,
          paypalConfirmed: formData.paypalConfirmed,
        });
        if (!result?.session) {
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
            console.warn('SimpleSignupModal verification send failed after sign up:', resendErr);
            sendError = String(resendErr?.message || 'Failed to send verification email.');
          }
          onClose();
          onSuccess();
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
        targetRoute = '/dashboard';
      }

      // Close first so the route transition feels instant.
      onClose();
      onSuccess();

      navigate(targetRoute);
    } catch (err: any) {
      const message = String(err?.message || '');
      if (message.toLowerCase().includes('already') || message.toLowerCase().includes('exists')) {
        setError('That email address already has an account. Use a different email or sign in.');
      } else {
        setError(message || 'An error occurred');
      }
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      email: '',
      password: '',
      fullName: '',
      storeName: '',
      phone: '',
      streetAddress: '',
      city: '',
      state: '',
      zipCode: '',
      paypalEmail: '',
      paypalConfirmed: false
    });
    setError('');
    setNotice('');
    setPendingVerificationEmail('');
    setStep(2);
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
              {isLogin ? 'Sign in to your account' : 'Create one business account with seller, affiliate, and influencer tools included.'}
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
                setStep(2);
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

          {/* Account details */}
          {(isLogin || step === 2) && (
            <form onSubmit={handleSubmit} className="space-y-6">
              {!isLogin && (
                <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-700 mb-2">What You Get</p>
                  <ul className="text-xs text-gray-700 space-y-1 mb-4">
                    <li>One business account with seller, affiliate, and influencer access together.</li>
                    <li>A storefront, affiliate promotion tools, and recruiter links from the same signup.</li>
                    <li>One place to manage products, promotions, referrals, and payouts.</li>
                  </ul>
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">Business account snapshot</h3>
                  <ul className="text-xs text-gray-700 space-y-1">
                    <li>Your signup creates seller, affiliate, and influencer access together.</li>
                    <li>You get seller storefront tools, affiliate sharing tools, and influencer recruiting tools in one account.</li>
                    <li>Seller payouts, affiliate earnings, and influencer payouts all use the PayPal email you provide.</li>
                    <li>
                      Terms:{' '}
                      <Link to="/legal/seller-terms" className="text-orange-600 hover:text-orange-700 underline">Seller terms</Link>
                      {' '}·{' '}
                      <Link to="/legal/partner-terms" className="text-orange-600 hover:text-orange-700 underline">Partner terms</Link>
                      {' '}·{' '}
                      <Link to="/legal/influencer-terms" className="text-orange-600 hover:text-orange-700 underline">Influencer terms</Link>
                    </li>
                  </ul>
                </div>
              )}

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg">
                  {error}
                </div>
              )}

              {notice && (
                <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
                  {notice}
                </div>
              )}

              {pendingVerificationEmail && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  <p>Verification is required before this account can sign in.</p>
                  <button
                    type="button"
                    onClick={async () => {
                      setLoading(true);
                      setError('');
                      setNotice('');
                      try {
                        await resendVerificationEmail(pendingVerificationEmail);
                        setNotice(`Verification email sent again to ${pendingVerificationEmail}.`);
                      } catch (err: any) {
                        setError(err?.message || 'Failed to resend verification email.');
                      } finally {
                        setLoading(false);
                      }
                    }}
                    className="mt-2 font-medium text-orange-700 underline hover:text-orange-800"
                  >
                    Resend verification email
                  </button>
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
                    minLength={8}
                  />
                  <p className="mt-1 text-xs text-gray-500">{PASSWORD_REQUIREMENT_MESSAGE}</p>
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

                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Business or Store Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.storeName}
                        onChange={(e) => setFormData({ ...formData, storeName: e.target.value })}
                        className={`w-full px-4 py-3 border rounded-lg ${storeNameInputClass}`}
                        placeholder="Name your store"
                      />
                      {storeSlugValue && (
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

                    <div className="md:col-span-2 bg-orange-50 border border-orange-200 rounded-lg p-4">
                      <h4 className="text-sm font-semibold text-gray-900 mb-2">Payout setup</h4>
                      <p className="text-xs text-gray-600 mb-3">
                        Add the PayPal email where you want Beezio payouts sent.
                      </p>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        PayPal payout email *
                      </label>
                      <input
                        type="email"
                        required
                        value={formData.paypalEmail}
                        onChange={(e) => setFormData({ ...formData, paypalEmail: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                        placeholder="you@paypal-email.com"
                      />
                      <label className="mt-3 flex items-start gap-2 text-xs text-gray-600">
                        <input
                          type="checkbox"
                          checked={formData.paypalConfirmed}
                          onChange={(e) => setFormData({ ...formData, paypalConfirmed: e.target.checked })}
                          className="mt-1 h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                        />
                        <span>
                          I confirm this is my PayPal email for receiving payouts.
                        </span>
                      </label>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Phone
                      </label>
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        required
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                        placeholder="(555) 123-4567"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Street Address
                      </label>
                      <input
                        type="text"
                        value={formData.streetAddress}
                        onChange={(e) => setFormData({ ...formData, streetAddress: e.target.value })}
                        required
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                        placeholder="123 Main St"
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
                        City
                      </label>
                      <input
                        type="text"
                        value={formData.city}
                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                        required
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                        placeholder="Your city"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        State
                      </label>
                      <input
                        type="text"
                        value={formData.state}
                        onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                        required
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                        placeholder="State"
                      />
                    </div>
                  </>
                )}
              </div>

              <div className="flex items-center justify-between pt-6">
                {showSignupBackButton && !isLogin && step === 2 && (
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
                  disabled={loading || Boolean(storeSlugBlockingState)}
                  className="ml-auto bg-gradient-to-r from-orange-500 to-orange-600 text-white px-8 py-3 rounded-lg hover:from-orange-600 hover:to-orange-700 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Please wait...' : (isLogin ? 'Sign In' : 'Create Account')}
                </button>

                {isLogin && (
                  <button
                    type="button"
                    onClick={async () => {
                      if (!formData.email) {
                        setError('Please enter your email address first.');
                        return;
                      }
                      setLoading(true);
                      setError('');
                      setNotice('');
                      try {
                        await resetPassword(formData.email);
                        setNotice('Password reset email sent. Check your inbox.');
                      } catch (err: any) {
                        setError(err?.message || 'Failed to send reset email.');
                      } finally {
                        setLoading(false);
                      }
                    }}
                    className="ml-auto text-sm text-orange-600 hover:text-orange-700 font-medium"
                  >
                    Forgot your password?
                  </button>
                )}
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
