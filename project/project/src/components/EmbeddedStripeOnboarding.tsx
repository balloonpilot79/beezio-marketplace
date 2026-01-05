import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContextMultiRole';
import { FileText, CheckCircle, AlertCircle, ExternalLink, Shield } from 'lucide-react';
import { apiPost } from '../utils/netlifyApi';
import type { Session } from '@supabase/supabase-js';

interface StripeOnboardingProps {
  onComplete: (accountId: string) => void;
  userType: 'seller' | 'affiliate' | 'fundraiser';
}

export const EmbeddedStripeOnboarding: React.FC<StripeOnboardingProps> = ({ onComplete, userType }) => {
  const { user, session, refreshProfile } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState<'agreements' | 'connect' | 'identity' | 'complete'>('agreements');
  const [acceptedAgreements, setAcceptedAgreements] = useState<Set<string>>(new Set());
  const [connectWindowOpened, setConnectWindowOpened] = useState(false);
  const [identityWindowOpened, setIdentityWindowOpened] = useState(false);
  const [onboardingUrl, setOnboardingUrl] = useState<string>('');
  const [errorText, setErrorText] = useState<string>('');
  const [statusDetails, setStatusDetails] = useState<any>(null);
  const [lastStatusCheckedAt, setLastStatusCheckedAt] = useState<string>('');
  const [stripeAccountId, setStripeAccountId] = useState<string>('');

  const getSessionForApi = async (): Promise<Session | null> => {
    if (session?.access_token) return session;
    const { data } = await supabase.auth.getSession();
    return data?.session ?? null;
  };

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if ((event.data as any)?.type !== 'beezio:stripe-return') return;
      void refreshProfile().catch(() => {});
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [refreshProfile]);

  useEffect(() => {
    if (user) {
      fetchExistingAgreements();
    }
  }, [user]);

  const fetchExistingAgreements = async () => {
    setErrorText('');

    const { data, error } = await supabase
      .from('tax_agreements')
      .select('*')
      .eq('user_id', user?.id);

    if (error) {
      setErrorText(error.message || 'Failed to load existing agreements.');
      return;
    }

    const signedTypes = new Set<string>((data || []).map((row: any) => String(row?.agreement_type || '').trim()).filter(Boolean));
    if (signedTypes.size) {
      setAcceptedAgreements(signedTypes);
    }

    if (signedTypes.size === taxAgreements.length) {
      setCurrentStep('connect');
    }
  };

  const taxAgreements = [
    {
      id: '1099',
      title: '1099 Independent Contractor Agreement',
      description: 'You will receive 1099 forms for payments over $600 annually',
      required: true,
      content: `
        <h3>1099 Independent Contractor Agreement</h3>
        <p>This agreement confirms that you are an independent contractor, not an employee of Beezio Marketplace.</p>
        <ul>
          <li>You are responsible for your own taxes</li>
          <li>You will receive 1099-NEC forms for payments over $600</li>
          <li>You must report all earnings on your tax return</li>
          <li>Beezio will automatically generate and send 1099 forms</li>
        </ul>
      `
    },
    {
      id: 'independent_contractor',
      title: 'Independent Contractor Status',
      description: 'Confirm you are operating as an independent business',
      required: true,
      content: `
        <h3>Independent Contractor Status Agreement</h3>
        <p>By signing this agreement, you confirm:</p>
        <ul>
          <li>You are operating as an independent business entity</li>
          <li>You have control over how you perform your services</li>
          <li>You may work for multiple clients simultaneously</li>
          <li>You are responsible for your own business expenses</li>
          <li>You provide your own tools and workspace</li>
        </ul>
      `
    },
    {
      id: 'tax_withholding',
      title: 'Tax Information & W-9',
      description: 'Provide tax identification for 1099 reporting',
      required: true,
      content: `
        <h3>Tax Information & W-9 Equivalent</h3>
        <p>For 1099 reporting purposes, we collect:</p>
        <ul>
          <li>Legal name and business name (if different)</li>
          <li>Tax classification (individual/LLC/Corp)</li>
          <li>Federal Tax ID or Social Security Number</li>
          <li>Business address for tax purposes</li>
          <li>Signature authorizing 1099 issuance</li>
        </ul>
        <p>All information is encrypted and used only for tax reporting.</p>
      `
    }
  ];

  const handleAgreementAccept = (agreementId: string) => {
    const newAccepted = new Set(acceptedAgreements);
    newAccepted.add(agreementId);
    setAcceptedAgreements(newAccepted);
  };

  const handleAgreementSign = async () => {
    if (acceptedAgreements.size !== taxAgreements.length) return;

    if (!user?.id) {
      setErrorText('You must be signed in to sign agreements. Please refresh and try again.');
      return;
    }

    setIsLoading(true);
    setErrorText('');
    try {
      // Sign all required agreements
      const signedAgreements = taxAgreements.map(agreement => ({
        user_id: user.id,
        agreement_type: agreement.id,
        signed_at: new Date().toISOString(),
        ip_address: 'client-ip', // Would get from request
        user_agent: navigator.userAgent,
        document_version: '1.0'
      }));

      const { error } = await supabase
        .from('tax_agreements')
        .upsert(signedAgreements, { onConflict: 'user_id,agreement_type' });

      if (error) throw error;

      setCurrentStep('connect');
    } catch (error) {
      console.error('Error signing agreements:', error);
      setErrorText(error instanceof Error ? error.message : 'Failed to sign agreements.');
    } finally {
      setIsLoading(false);
    }
  };

  const startStripeOnboarding = async () => {
    setIsLoading(true);
    setErrorText('');
    try {
      const apiSession = await getSessionForApi();
      if (!apiSession?.access_token) {
        setErrorText('Session is still loading. Please wait 1–2 seconds and try again.');
        return;
      }

      const data = await apiPost<any>('/api/stripe/create-embedded-account', apiSession, {
        type: userType,
        agreements_signed: true,
        country: 'US',
      });

      // Consider Stripe "connected" as soon as an account exists (so the user can proceed to store setup).
      // Payouts remain held until Stripe requirements are satisfied.
      const accountId = String((data as any)?.account_id || '').trim();
      if (accountId) {
        setStripeAccountId(accountId);
        onComplete(accountId);
      }

      // For embedded onboarding, we'd integrate Stripe's embedded components
      // For now, we'll use the account link but enhance it
      const url = String((data as any)?.onboarding_url || '').trim();
      if (url) {
        setOnboardingUrl(url);
      }

      // Keep AuthContext profile in sync so the dashboard doesn't bounce back to onboarding.
      await refreshProfile().catch(() => {});

      if (url && !connectWindowOpened) {
        // Try to open a popup; if blocked, show a clickable link fallback.
        const popup = window.open(url, 'stripe-onboarding', 'width=900,height=700');
        if (popup) {
          setConnectWindowOpened(true);
        } else {
          setErrorText('Pop-up blocked. Please allow pop-ups or click "Open Stripe verification" below.');
        }
      }

      const checkStatus = async () => {
        let statusData: any = null;
        try {
          const s = await getSessionForApi();
          statusData = await apiPost<any>('/api/stripe/account-status', s ?? null, {});
        } catch (e: any) {
          const httpStatus = Number(e?.status || 0);
          if (httpStatus !== 404) {
            if (httpStatus === 401) {
              setErrorText('Unauthorized (session expired). Please sign out and sign back in.');
            } else {
              setErrorText(e?.message || 'Failed to check Stripe account status.');
            }
          }
          return { done: false, statusData: null as any, statusUnavailable: httpStatus === 404 };
        }

        setStatusDetails(statusData);
        setLastStatusCheckedAt(new Date().toLocaleTimeString());

        const requirements = Array.isArray((statusData as any)?.requirements) ? (statusData as any).requirements : [];
        const detailsSubmitted = Boolean((statusData as any)?.details_submitted);

        // Stripe may keep payouts/charges disabled briefly even after onboarding is "completed".
        // Treat Connect onboarding as complete when details are submitted and nothing is currently due.
        const connectCompleted = detailsSubmitted && requirements.length === 0;

        if (connectCompleted) {
          await refreshProfile().catch(() => {});
          setCurrentStep('complete');
          onComplete(String((statusData as any)?.account_id || ''));
          return { done: true, statusData };
        }

        return { done: false, statusData, statusUnavailable: false };
      };

      // Poll Stripe account readiness (not just "account id exists").
      // First check immediately, then poll.
      const first = await checkStatus();
      if (!first.done && !(first as any).statusUnavailable) {
        const pollInterval = window.setInterval(async () => {
          const res = await checkStatus();
          if ((res as any).done || (res as any).statusUnavailable) window.clearInterval(pollInterval);
        }, 3000);
      }

      // If the status endpoint isn't available, don't trap the user here.
      if ((first as any).statusUnavailable) {
        setCurrentStep('complete');
      }

    } catch (error) {
      console.error('Error starting onboarding:', error);
      const httpStatus = Number((error as any)?.status || 0);
      if (httpStatus === 401) {
        setErrorText('Unauthorized (session expired). Please sign out and sign back in.');
      } else {
        setErrorText(error instanceof Error ? error.message : 'Failed to start Stripe onboarding.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (currentStep === 'agreements') {
    return (
      <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-sm border">
        <div className="text-center mb-8">
          <FileText className="w-16 h-16 text-blue-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900">Complete Your Account Setup</h2>
          <p className="text-gray-600 mt-2">
            Before you can receive payments, please review and sign the required tax agreements.
          </p>
        </div>

        <div className="space-y-6">
          {taxAgreements.map((agreement) => (
            <div key={agreement.id} className="border border-gray-200 rounded-lg p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900">{agreement.title}</h3>
                  <p className="text-gray-600 mt-1">{agreement.description}</p>
                  <div
                    className="mt-4 text-sm text-gray-700 prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: agreement.content }}
                  />
                </div>
                <div className="ml-6">
                  {acceptedAgreements.has(agreement.id) ? (
                    <CheckCircle className="w-6 h-6 text-green-600" />
                  ) : (
                    <button
                      onClick={() => handleAgreementAccept(agreement.id)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Accept
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 text-center">
          <button
            onClick={handleAgreementSign}
            disabled={acceptedAgreements.size !== taxAgreements.length || isLoading}
            className="px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center space-x-2"
          >
            {isLoading ? (
              <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
            ) : (
              <CheckCircle className="w-4 h-4" />
            )}
            <span>Sign Agreements & Continue</span>
          </button>
          {errorText ? (
            <p className="mt-3 text-sm text-red-600">{errorText}</p>
          ) : null}
        </div>
      </div>
    );
  }

  if (currentStep === 'connect') {
    return (
      <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-sm border text-center">
        <div className="mb-6">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <ExternalLink className="w-8 h-8 text-blue-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Connect Your Bank Account</h2>
          <p className="text-gray-600 mt-2">
            Complete the secure Stripe verification process to receive payouts. You can continue setting up your store while verification is pending.
          </p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
            <div className="text-left">
              <h4 className="font-semibold text-blue-900">Secure & Encrypted</h4>
              <p className="text-blue-700 text-sm mt-1">
                Your banking information is handled securely by Stripe and never stored on Beezio servers.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={startStripeOnboarding}
          disabled={isLoading}
          className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 inline-flex items-center justify-center space-x-2"
        >
          {isLoading ? (
            <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
          ) : (
            <CheckCircle className="w-4 h-4" />
          )}
          <span>Start Bank Account Verification</span>
        </button>

        {errorText ? <p className="mt-3 text-sm text-red-600">{errorText}</p> : null}

        {onboardingUrl ? (
          <div className="mt-4">
            <a
              href={onboardingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center space-x-2 text-blue-700 hover:text-blue-800 underline"
              onClick={() => setConnectWindowOpened(true)}
            >
              <ExternalLink className="w-4 h-4" />
              <span>Open Stripe verification</span>
            </a>
          </div>
        ) : null}

        {statusDetails ? (
          <div className="mt-6 text-left border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-gray-900">Stripe status</h4>
              <span className="text-xs text-gray-500">{lastStatusCheckedAt ? `Checked ${lastStatusCheckedAt}` : ''}</span>
            </div>
            <div className="mt-2 text-sm text-gray-700 space-y-1">
              <div>Details submitted: {String(Boolean((statusDetails as any)?.details_submitted))}</div>
              <div>Charges enabled: {String(Boolean((statusDetails as any)?.charges_enabled))}</div>
              <div>Payouts enabled: {String(Boolean((statusDetails as any)?.payouts_enabled))}</div>
            </div>
            {Array.isArray((statusDetails as any)?.requirements) && (statusDetails as any).requirements.length ? (
              <div className="mt-3">
                <div className="text-sm font-semibold text-gray-900">Currently due</div>
                <ul className="mt-1 text-sm text-gray-700 list-disc pl-5">
                  {(statusDetails as any).requirements.map((r: any) => (
                    <li key={String(r)}>{String(r)}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="mt-3 text-sm text-gray-700">No currently-due requirements.</div>
            )}
          </div>
        ) : null}

        {!statusDetails && stripeAccountId ? (
          <div className="mt-6 text-left border border-gray-200 rounded-lg p-4">
            <h4 className="font-semibold text-gray-900">Stripe status</h4>
            <div className="mt-2 text-sm text-gray-700">
              Account created: {stripeAccountId}
              <div className="mt-2 text-xs text-gray-500">
                Live status checks are unavailable here; payouts will remain pending until Stripe verification completes.
              </div>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  if (currentStep === 'identity') {
    // Identity verification is handled inside Stripe Connect onboarding for this release.
    // Keep this step as a non-blocking fallback.
    return (
      <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-sm border text-center">
        <div className="mb-6">
          <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-orange-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Verify Your Identity</h2>
          <p className="text-gray-600 mt-2">
            Identity verification is handled inside Stripe. If you already completed it, you can continue.
          </p>
        </div>

        <button
          onClick={() => {
            setCurrentStep('complete');
            if (stripeAccountId) onComplete(stripeAccountId);
          }}
          className="w-full px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 inline-flex items-center justify-center space-x-2"
        >
          <CheckCircle className="w-4 h-4" />
          <span>Continue</span>
        </button>
      </div>
    );
  }

  if (currentStep === 'complete') {
    return (
      <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-sm border text-center">
        <div className="mb-6">
          <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900">Setup Complete!</h2>
          <p className="text-gray-600 mt-2">
            Your payment account is now connected and ready to receive payments.
          </p>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
          <h4 className="font-semibold text-green-900 mb-2">What's Next?</h4>
          <ul className="text-green-700 text-sm space-y-1 text-left">
            <li>• You'll receive 1099 forms automatically for tax reporting</li>
            <li>• Payments will be deposited directly to your bank account</li>
            <li>• Track all earnings and payouts in your dashboard</li>
            <li>• Contact support if you need to update your tax information</li>
          </ul>
        </div>

        <button
          onClick={() => window.location.reload()}
          className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700"
        >
          Go to Dashboard
        </button>
      </div>
    );
  }

  return null;
};
