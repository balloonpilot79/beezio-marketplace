import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContextMultiRole';
import { supabase } from '../lib/supabase';
import { Check, X } from 'lucide-react';
import { deriveStoreSlug, isValidStoreSlug } from '../utils/storeSlug';
import { buildDeterministicReferralCode } from '../utils/referralCode';
import { assignInfluencerReferral } from '../utils/influencerReferrals';
import { validatePasswordPolicy } from '../utils/passwordPolicy';
import { sendSignupVerificationEmail } from '../services/signupVerificationClient';
import {
  clearPendingRecruitAttributionForUser,
  queuePendingRecruitAttribution,
} from '../utils/recruitAttribution';
import { getNormalizedAccountRoles, isBuyerOnlyAccount } from '../utils/accountRoles';

const SIGNUP_DRAFT_KEY = 'beezio_signup_draft_v1';

const SignUpPage: React.FC = () => {
  const [searchParams] = useSearchParams();
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
    role: 'seller',
  });
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedIndependentContractor, setAcceptedIndependentContractor] = useState(false);
  const [acceptedTaxDelivery, setAcceptedTaxDelivery] = useState(false);
  const [loading, setLoading] = useState(false);
  const [skipPayoutSetup, setSkipPayoutSetup] = useState(false);
  const [paypalEmail, setPaypalEmail] = useState('');
  const [paypalConfirmed, setPaypalConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [referralCode, setReferralCode] = useState('');
  const [referralValid, setReferralValid] = useState<boolean | null>(null);
  const [referralValidationLoading, setReferralValidationLoading] = useState(false);
  const [referrerName, setReferrerName] = useState('');
  const [referrerProfileId, setReferrerProfileId] = useState<string | null>(null);
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState('');
  const [storeSlugStatus, setStoreSlugStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid' | 'error'>('idle');
  const [storeSlugMessage, setStoreSlugMessage] = useState('');
  const [storeSlugValue, setStoreSlugValue] = useState('');
  const enableReferralCode = false;
  const {
    signUp,
    signIn,
    signOut,
    resendVerificationEmail,
    user,
    profile,
    userRoles,
    currentRole,
    addRole,
    refreshProfile,
    loading: authLoading,
  } = useAuth();
  const navigate = useNavigate();
  // Compliance hardening: disable recruiter/referrer signup codes.

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

  const urlRole = searchParams.get('role');
  const referralFromLink =
    searchParams.get('recruit') ||
    searchParams.get('influencer') ||
    searchParams.get('ic');
  const urlInfluencer = String(referralFromLink || '').trim();
  const inviteLinkPresent = Boolean(urlInfluencer);

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

  const normalizeRecruitCode = (input: string): string => {
    const raw = String(input || '').trim();
    if (!raw) return '';

    let candidate = raw;
    if (/^https?:\/\//i.test(candidate)) {
      try {
        const parsed = new URL(candidate);
        const fromQuery =
          parsed.searchParams.get('recruit') ||
          parsed.searchParams.get('influencer') ||
          parsed.searchParams.get('ic') ||
          parsed.searchParams.get('code') ||
          '';
        candidate = String(fromQuery || '').trim() || candidate;
      } catch {
        // keep raw input
      }
    }

    try {
      candidate = decodeURIComponent(candidate);
    } catch {
      // keep undecoded value
    }

    return candidate
      .trim()
      .replace(/^['"`]+|['"`]+$/g, '')
      .replace(/\/$/, '');
  };

  const validateReferralCode = useCallback(async (code: string) => {
    const trimmed = normalizeRecruitCode(code);
    if (!trimmed || trimmed.length < 3) {
      setReferralValid(null);
      setReferrerName('');
      setReferrerProfileId(null);
      setReferralValidationLoading(false);
      return;
    }

    try {
      setReferralValidationLoading(true);
      let explicitlyInvalid = false;
      // Prefer server-side resolver (service-role) so invite validation works for anonymous visitors.
      try {
        const response = await fetch(`/api/public/recruit/resolve?code=${encodeURIComponent(trimmed)}`);
        if (response.ok) {
          const payload = await response.json();
          if (payload?.ok && payload?.valid && payload?.referrerProfileId) {
            setReferralValid(true);
            setReferrerProfileId(String(payload.referrerProfileId));
            setReferrerName(String(payload.referrerName || 'this influencer'));
            return;
          }
          if (payload?.ok && payload?.valid === false) {
            explicitlyInvalid = true;
          }
        }
      } catch {
        // fallback below
      }

      // Fallback: direct client lookup for local/dev environments without Netlify function routing.
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(trimmed);
      const profileFilters = [`referral_code.ilike.${trimmed}`, `username.ilike.${trimmed}`];
      if (isUuid) profileFilters.push(`id.eq.${trimmed}`);

      const { data: profileRows, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, username')
        .or(profileFilters.join(','))
        .limit(1);

      const data = Array.isArray(profileRows) ? profileRows[0] : null;
      if (!profileError && data?.id) {
        setReferralValid(true);
        setReferrerProfileId(String(data.id));
        setReferrerName(data.full_name || data.username || 'this influencer');
        return;
      }

      const { data: storeRow } = await supabase
        .from('affiliate_stores')
        .select('profile_id, store_name, store_slug')
        .eq('store_slug', trimmed.toLowerCase())
        .maybeSingle();

      if ((storeRow as any)?.profile_id) {
        setReferralValid(true);
        setReferrerProfileId(String((storeRow as any).profile_id));
        setReferrerName(String((storeRow as any).store_name || (storeRow as any).store_slug || 'this influencer'));
        return;
      }

      setReferralValid(explicitlyInvalid ? false : null);
      setReferrerName('');
      setReferrerProfileId(null);
    } catch {
      setReferralValid(null);
      setReferrerName('');
      setReferrerProfileId(null);
    } finally {
      setReferralValidationLoading(false);
    }
  }, []);

  const resolveStoreName = useCallback(() => {
    const trimmed = String(formData.storeName || '').trim();
    if (trimmed) return trimmed;
    const emailBase = String(formData.email || '').trim().split('@')[0] || '';
    return emailBase;
  }, [formData.email, formData.storeName]);

  const checkSlugAvailability = useCallback(async (slug: string) => {
    if (!slug) return false;
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
  }, []);

  // Restore draft (so refresh doesn’t wipe signup progress)
  useEffect(() => {
    if (user) return;
    try {
      const raw = localStorage.getItem(SIGNUP_DRAFT_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed?.formData) {
        setFormData((prev) => ({ ...prev, ...parsed.formData }));
      }
      if (typeof parsed?.acceptedTerms === 'boolean') {
        setAcceptedTerms(parsed.acceptedTerms);
      }
      if (typeof parsed?.acceptedIndependentContractor === 'boolean') {
        setAcceptedIndependentContractor(parsed.acceptedIndependentContractor);
      }
      if (typeof parsed?.acceptedTaxDelivery === 'boolean') {
        setAcceptedTaxDelivery(parsed.acceptedTaxDelivery);
      }
    } catch {
      // ignore
    }
  }, [user]);

  // Persist draft while editing (avoid losing progress on refresh)
  useEffect(() => {
    if (user) return;
    try {
      localStorage.setItem(
        SIGNUP_DRAFT_KEY,
        JSON.stringify({
          formData: {
            email: formData.email,
            password: formData.password,
            fullName: formData.fullName,
            storeName: formData.storeName,
            phone: formData.phone,
            streetAddress: formData.streetAddress,
            city: formData.city,
            state: formData.state,
            zipCode: formData.zipCode,
            role: formData.role,
          },
          acceptedTerms,
          acceptedIndependentContractor,
          acceptedTaxDelivery,
        })
      );
    } catch {
      // ignore
    }
  }, [acceptedTerms, formData, user]);

  useEffect(() => {
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
      setStoreSlugMessage('Store URL must be 3-32 characters, letters/numbers/hyphens only, and not reserved.');
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
  }, [checkSlugAvailability, formData.email, formData.storeName, resolveStoreName]);

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
    setPendingVerificationEmail('');

    // Validation
    if (!formData.email || !formData.email.includes('@')) {
      setError('Please enter a valid email address');
      setLoading(false);
      return;
    }

    if (!acceptedTerms) {
      setError('You must accept the Terms of Service and Privacy Policy');
      setLoading(false);
      return;
    }

    if (!acceptedIndependentContractor) {
      setError('You must acknowledge that Beezio business users are independent contractors, not employees.');
      setLoading(false);
      return;
    }

    if (!acceptedTaxDelivery) {
      setError('You must agree to receive tax compliance notices in your dashboard and email.');
      setLoading(false);
      return;
    }

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

    const passwordError = validatePasswordPolicy(formData.password);
    if (passwordError) {
      setError(passwordError);
      setLoading(false);
      return;
    }

    const resolvedStoreName = resolveStoreName();
    const storeSlug = deriveStoreSlug(resolvedStoreName);

    if (!resolvedStoreName || resolvedStoreName.trim().length < 2) {
      setError('Please choose a business or store name (at least 2 characters).');
      setLoading(false);
      return;
    }

    if (!skipPayoutSetup) {
      const trimmed = paypalEmail.trim();
      if (!trimmed || !trimmed.includes('@')) {
        setError('Please enter the PayPal email you want to receive payouts to (or skip payout setup for now).');
        setLoading(false);
        return;
      }
      if (!paypalConfirmed) {
        setError('Please confirm your PayPal payout email to continue (or skip payout setup for now).');
        setLoading(false);
        return;
      }
    }

    if (inviteLinkPresent && referralValidationLoading) {
      setError('Invite link validation is still loading. Please try again in a moment.');
      setLoading(false);
      return;
    }

    try {
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

      const result = await signUp(formData.email, formData.password, {
        ...formData,
        role: 'seller',
        bundleBusinessRoles: true,
        storeName: resolvedStoreName,
        storeSlug,
        paypalEmail: paypalEmail.trim(),
        paypalConfirmed,
        referrerProfileId: referrerProfileId || '',
        independentContractorAcknowledged: acceptedIndependentContractor,
        taxDeliveryAcknowledged: acceptedTaxDelivery,
      });
      if (result.user) {
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
            console.warn('Signup verification send failed after sign up:', resendErr);
            sendError = String(resendErr?.message || 'Failed to send verification email.');
          }
          const verifyParams = new URLSearchParams({
            flow: 'signup',
            email: formData.email,
            email_sent: emailSent ? '1' : '0',
          });
          if (sendError) verifyParams.set('send_error', sendError);
          navigate(`/auth/verify?${verifyParams.toString()}`, { replace: true });
          setLoading(false);
          return;
        }

        const getNewProfileId = async (userId: string): Promise<string | null> => {
          // Profile row is sometimes created asynchronously; retry briefly.
          for (let attempt = 0; attempt < 5; attempt++) {
            try {
              const { data } = await supabase
                .from('profiles')
                .select('id')
                .eq('user_id', userId)
                .maybeSingle();

              if (data?.id) return data.id as string;
            } catch {
              // ignore and retry
            }
            await new Promise(resolve => setTimeout(resolve, 250));
          }
          return null;
        };

        const newProfileId = await getNewProfileId(result.user.id);

        // Ensure every account has a permanent referral_code.
        // Deterministic: derived from profile id so it never changes.
        if (newProfileId) {
          try {
            const deterministicReferralCode = buildDeterministicReferralCode(String(newProfileId));
            await supabase
              .from('profiles')
              .update({ referral_code: deterministicReferralCode })
              .eq('id', newProfileId)
              .is('referral_code', null);
          } catch {
            // non-blocking
          }
        }

        if (referrerProfileId && referrerProfileId !== newProfileId) {
          queuePendingRecruitAttribution(result.user.id, referrerProfileId, 'seller');
          queuePendingRecruitAttribution(result.user.id, referrerProfileId, 'affiliate');

          if (newProfileId) {
            try {
              await Promise.all([
                assignInfluencerReferral({
                  recruitedProfileId: newProfileId,
                  recruitedRole: 'seller',
                  influencerProfileId: referrerProfileId,
                }),
                assignInfluencerReferral({
                  recruitedProfileId: newProfileId,
                  recruitedRole: 'affiliate',
                  influencerProfileId: referrerProfileId,
                }),
              ]);
              clearPendingRecruitAttributionForUser(result.user.id);
            } catch {
              // non-blocking: applied on first successful sign-in if needed
            }
          }
        }

        setSuccess('Account created successfully! Signing you in...');
        
        // Wait a moment for profile to be fully set in context
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        try {
          const signInResult = await signIn(formData.email, formData.password);
          if (signInResult.user) {
            // Wait for profile to load
            await new Promise(resolve => setTimeout(resolve, 500));
            
            console.log('✅ Sign up complete! Navigating to dashboard...');
            if (skipPayoutSetup) {
              navigate('/onboarding');
            } else {
              navigate('/dashboard');
            }

            try {
              localStorage.removeItem(SIGNUP_DRAFT_KEY);
            } catch {
              // ignore
            }
          } else {
            setError('Sign in failed after registration. Please try logging in manually.');
          }
        } catch (signInError: any) {
          setError(signInError.message || 'Sign in failed after registration. Please try logging in manually.');
        }
      }
    } catch (err: any) {
      const message = String(err?.message || '');
      if (message.toLowerCase().includes('already') || message.toLowerCase().includes('exists')) {
        setError('That email address already has an account. Use a different email or sign in.');
      } else {
        setError(message || 'An error occurred during registration');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (urlRole === 'buyer') {
      navigate('/account/signup', { replace: true });
    }
  }, [navigate, urlRole]);

  const upgradeCurrentAccountToBusiness = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const fullName =
        String((profile as any)?.full_name || '').trim() ||
        String(user.user_metadata?.full_name || user.user_metadata?.name || '').trim() ||
        user.email ||
        'Beezio Business';

      const { error: profileError } = await supabase
        .from('profiles')
        .upsert(
          {
            user_id: user.id,
            email: user.email,
            full_name: fullName,
            role: 'seller',
            primary_role: 'seller',
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        );

      if (profileError) throw profileError;

      await Promise.all([addRole('seller'), addRole('affiliate'), addRole('influencer')]);
      await refreshProfile();
      navigate('/onboarding', { replace: true });
    } catch (err: any) {
      setError(String(err?.message || 'Could not upgrade this account. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  // Influencer recruiting link support (separate from site-wide partner attribution `?ref=`)
  // Important: this is one-time attribution during signup; we never overwrite it later.
  useEffect(() => {
    if (!urlInfluencer) return;
    const trimmed = normalizeRecruitCode(String(urlInfluencer));
    if (!trimmed) return;
    setReferralCode(trimmed);
    void validateReferralCode(trimmed);
  }, [urlInfluencer, validateReferralCode]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="text-gray-700">Loading…</div>
      </div>
    );
  }

  // If this browser already has a Supabase session, refreshing the signup page can feel like “it logged me in by itself”.
  // Make this explicit and force an intentional sign-out before creating a new test account.
  if (user) {
    const email = user.email || (profile as any)?.email || 'your account';
    const effectiveRole = String((profile as any)?.primary_role || (profile as any)?.role || 'buyer');
    const shouldOnboard = effectiveRole !== 'buyer';
    const normalizedRoles = getNormalizedAccountRoles(userRoles, (profile as any)?.primary_role, (profile as any)?.role, currentRole);
    const buyerOnlyAccount = isBuyerOnlyAccount(normalizedRoles);

    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-xl mx-auto px-4 py-12">
          <h1 className="text-3xl font-bold text-gray-900 mb-3">You’re already signed in</h1>
          <p className="text-gray-700 mb-6">
            {buyerOnlyAccount ? (
              <>
                Signed in as <span className="font-semibold">{email}</span>. This login is currently set up for customer purchases.
              </>
            ) : (
              <>
            Signed in as <span className="font-semibold">{email}</span>. This Beezio account can use seller, affiliate,
            and influencer tools together. If you specifically need a separate test account, sign out first.
              </>
            )}
          </p>

          {buyerOnlyAccount && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              This login is currently customer-only. Use Customer dashboard for purchases, or upgrade this same login to turn on seller,
              affiliate, and influencer tools.
            </div>
          )}

          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {buyerOnlyAccount ? (
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => navigate('/account')}
                className="inline-flex items-center justify-center px-5 py-3 rounded-lg border border-gray-300 bg-white text-gray-900 font-semibold hover:bg-gray-50 transition-colors"
              >
                Customer dashboard
              </button>
              <button
                onClick={upgradeCurrentAccountToBusiness}
                disabled={loading}
                className="inline-flex items-center justify-center px-5 py-3 rounded-lg bg-amber-500 text-black font-semibold hover:bg-amber-600 disabled:opacity-60 transition-colors"
              >
                {loading ? 'Upgrading...' : 'Upgrade this login'}
              </button>
            </div>
          ) : (
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => navigate(shouldOnboard ? '/onboarding' : '/dashboard')}
              className="inline-flex items-center justify-center px-5 py-3 rounded-lg bg-amber-500 text-black font-semibold hover:bg-amber-600 transition-colors"
            >
              {shouldOnboard ? 'Continue onboarding' : 'Go to dashboard'}
            </button>
            {shouldOnboard ? (
              <button
                onClick={() => navigate('/dashboard/store')}
                className="inline-flex items-center justify-center px-5 py-3 rounded-lg border border-amber-300 text-amber-700 font-semibold hover:bg-amber-50 transition-colors"
              >
                Go to store setup
              </button>
            ) : null}
            <button
              onClick={async () => {
                await signOut();
                try {
                  localStorage.removeItem(SIGNUP_DRAFT_KEY);
                } catch {
                  // ignore
                }
                navigate('/signup', { replace: true });
              }}
              className="inline-flex items-center justify-center px-5 py-3 rounded-lg border border-gray-300 bg-white text-gray-900 font-semibold hover:bg-gray-50 transition-colors"
            >
              Sign out & create a new account
            </button>
          </div>
          )}
        </div>
      </div>
    );
  }

  const businessBenefits = [
    'Sell products and offers from one account.',
    'Promote marketplace offers with affiliate tools.',
    'Use your influencer link to recruit sellers and affiliates.',
    'Run seller, affiliate, and influencer activity from one dashboard.',
    'Set up once instead of creating three separate business accounts.',
  ];

  const businessWhatYouGet = [
    'A seller storefront and checkout-ready business profile.',
    'Affiliate tools to share marketplace offers and track earnings.',
    'Influencer recruiting links tied to the same business account.',
    'One dashboard for products, promotions, referrals, and payouts.',
  ];

  const storeSlugBlockingState =
    !storeSlugValue ||
    storeSlugStatus === 'checking' ||
    storeSlugStatus === 'taken' ||
    storeSlugStatus === 'invalid' ||
    storeSlugStatus === 'error';

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

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-6 px-4 sm:py-12 relative">
      <Link
        to="/"
        className="absolute top-4 right-4 inline-flex items-center justify-center w-10 h-10 rounded-full border border-gray-200 text-gray-500 hover:text-gray-900 hover:border-amber-500 bg-white shadow-sm"
        aria-label="Close and go home"
      >
        <span className="text-xl leading-none">×</span>
      </Link>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl p-4 sm:p-6 md:p-8">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2 text-center">Open Your Beezio Business Account</h2>
        <p className="mb-4 text-center text-sm text-gray-600">
          This signup gives you one business account with seller, affiliate, and influencer access already turned on. You will get a primary storefront, affiliate promotion tools, influencer recruit links, and one place to manage payouts.
        </p>

        <div className="mb-4 sm:mb-6 rounded-lg border border-slate-200 bg-slate-50 p-4 sm:p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-700">What You Get</p>
          <ul className="mt-3 space-y-2 text-sm text-slate-700">
            {businessWhatYouGet.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="mt-0.5 text-amber-600">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
        
        {/* Role Benefits Section */}
        <div className="mb-4 sm:mb-6 bg-gradient-to-br from-yellow-50 to-amber-50 border-2 border-yellow-200 rounded-lg p-3 sm:p-5">
          <div className="text-center mb-2 sm:mb-3">
            <span className="text-2xl sm:text-3xl mb-1 sm:mb-2 inline-block">B</span>
            <h3 className="text-base sm:text-lg font-bold text-gray-900">One Business Account</h3>
          </div>
          <ul className="space-y-1.5 sm:space-y-2">
            {businessBenefits.map((benefit, idx) => (
              <li key={idx} className="flex items-start gap-2 text-xs sm:text-sm text-gray-700">
                <span className="text-yellow-600 font-bold mt-0.5 flex-shrink-0">✓</span>
                <span>{benefit}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mb-4 sm:mb-6 bg-white border border-gray-200 rounded-lg p-4 sm:p-5">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">Business account snapshot</h3>
          <ul className="text-sm text-gray-700 space-y-1">
            <li>Your signup creates seller, affiliate, and influencer access together.</li>
            <li>You get a seller storefront plus an affiliate storefront from the same account.</li>
            <li>Seller payouts, affiliate earnings, and influencer payouts all use the same PayPal email you provide.</li>
            <li>Invite links, recruit attribution, storefront tools, and payout history stay in one dashboard.</li>
            <li>
              Terms:{' '}
              <Link to="/legal/seller-terms" className="text-amber-600 hover:text-amber-700 underline">Seller terms</Link>
              {' '}·{' '}
              <Link to="/legal/partner-terms" className="text-amber-600 hover:text-amber-700 underline">Partner terms</Link>
              {' '}·{' '}
              <Link to="/legal/influencer-terms" className="text-amber-600 hover:text-amber-700 underline">Influencer terms</Link>
            </li>
          </ul>
        </div>

        <div className="mb-4 sm:mb-6 bg-white border border-amber-100 rounded-lg p-4 sm:p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center font-semibold">
              $
            </div>
            <div className="space-y-1">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900">Payout setup</h3>
              <p className="text-sm text-gray-700">
                Add the PayPal email where you want payouts sent. You can skip this for now, but payouts will be delayed until it’s completed.
              </p>

              {!skipPayoutSetup && (
                <div className="mt-3 space-y-2">
                  <label className="block text-sm font-medium text-gray-700">PayPal payout email</label>
                  <input
                    type="email"
                    value={paypalEmail}
                    onChange={(e) => setPaypalEmail(e.target.value)}
                    placeholder="you@paypal-email.com"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <label className="flex items-start gap-2 text-xs text-gray-600">
                    <input
                      type="checkbox"
                      checked={paypalConfirmed}
                      onChange={(e) => setPaypalConfirmed(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                    />
                    <span>
                      I confirm this is my PayPal email for receiving payouts.
                    </span>
                  </label>
                </div>
              )}

              <label className="mt-3 flex items-start gap-2 text-xs text-gray-600">
                <input
                  type="checkbox"
                  checked={skipPayoutSetup}
                  onChange={(event) => {
                    const checked = event.target.checked;
                    setSkipPayoutSetup(checked);
                    if (checked) {
                      setPaypalConfirmed(false);
                    }
                  }}
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                />
                <span>
                  Skip payout setup for now. We will track what you earn, but payouts may be delayed until payout details are completed.
                </span>
              </label>
            </div>
          </div>
        </div>
        
        {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">{error}</div>}
        {success && <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">{success}</div>}
        {pendingVerificationEmail && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <p>Email verification is required before this account can sign in.</p>
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
              className="mt-2 font-medium text-amber-700 underline hover:text-amber-800"
            >
              Resend verification email
            </button>
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
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
                  <div className={`text-xs flex items-center gap-1 ${/[^a-zA-Z\d]/.test(formData.password) ? 'text-green-600' : 'text-gray-400'}`}>
                    {/[^a-zA-Z\d]/.test(formData.password) ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                    <span>At least one symbol</span>
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
            <label className="block text-sm font-medium text-gray-700 mb-2">Business or store name</label>
            <input
              type="text"
              name="storeName"
              value={formData.storeName}
              onChange={handleChange}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${storeNameInputClass}`}
              placeholder="e.g., Jason's Shop"
            />
            {!formData.storeName.trim() && formData.email && (
              <p className="text-xs text-gray-500 mt-1">
                Defaulting to your username: {formData.email.split('@')[0]}
              </p>
            )}
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

          {inviteLinkPresent && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
              <p className="text-sm font-medium text-emerald-900">Invite link detected</p>
              <p className="mt-1 text-xs text-emerald-700">
                This recruiter code will be attached to this business account across the combined tools.
              </p>
              {referralValidationLoading && (
                <p className="mt-1 text-xs text-emerald-700">Verifying referrer...</p>
              )}
              {!referralValidationLoading && referralValid === true && (
                <p className="mt-1 text-xs text-emerald-700">Invite link accepted.</p>
              )}
              {!referralValidationLoading && referralValid === false && (
                <p className="mt-1 text-xs text-red-700">Invite link could not be verified. You can still continue.</p>
              )}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
            <input type="tel" name="phone" value={formData.phone} onChange={handleChange} required className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Street Address</label>
            <input type="text" name="streetAddress" value={formData.streetAddress} onChange={handleChange} required className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">City</label>
              <input type="text" name="city" value={formData.city} onChange={handleChange} required className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">State</label>
              <input type="text" name="state" value={formData.state} onChange={handleChange} required className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">ZIP Code (Optional)</label>
            <input type="text" name="zipCode" value={formData.zipCode} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500" />
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
            <p className="font-semibold">Tax and contractor acknowledgement</p>
            <p className="mt-2 text-amber-900">
              Beezio business accounts use independent contractor status. Your dashboard will hold your tax profile, payout reporting, and any year-end 1099 delivery status.
            </p>
            <div className="mt-3 space-y-3">
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={acceptedIndependentContractor}
                  onChange={(e) => setAcceptedIndependentContractor(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                />
                <span>I understand I am joining Beezio as an independent contractor and not as an employee of Beezio.</span>
              </label>
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={acceptedTaxDelivery}
                  onChange={(e) => setAcceptedTaxDelivery(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                />
                <span>I agree that Beezio may place my tax forms, reporting notices, and year-end documents in my dashboard and send alerts to my email.</span>
              </label>
            </div>
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
              <Link to="/legal/terms" className="text-amber-600 hover:text-amber-700 underline" target="_blank">
                Terms of Service
              </Link>
              {' '}and{' '}
              <Link to="/legal/privacy" className="text-amber-600 hover:text-amber-700 underline" target="_blank">
                Privacy Policy
              </Link>
            </label>
          </div>
          
          <button 
            type="submit" 
            disabled={
              loading ||
              !acceptedTerms ||
              !acceptedIndependentContractor ||
              !acceptedTaxDelivery ||
              (inviteLinkPresent && referralValidationLoading) ||
              storeSlugBlockingState
            } 
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

