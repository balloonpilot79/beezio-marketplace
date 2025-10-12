import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContextMultiRole';
import { FileText, CheckCircle, AlertCircle, ExternalLink } from 'lucide-react';

interface StripeOnboardingProps {
  onComplete: (accountId: string) => void;
  userType: 'seller' | 'affiliate';
}

export const EmbeddedStripeOnboarding: React.FC<StripeOnboardingProps> = ({ onComplete, userType }) => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState<'agreements' | 'onboarding' | 'complete'>('agreements');
  const [acceptedAgreements, setAcceptedAgreements] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (user) {
      fetchExistingAgreements();
    }
  }, [user]);

  const fetchExistingAgreements = async () => {
    await supabase
      .from('tax_agreements')
      .select('*')
      .eq('user_id', user?.id);

    // Agreements fetched successfully
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

    setIsLoading(true);
    try {
      // Sign all required agreements
      const signedAgreements = taxAgreements.map(agreement => ({
        user_id: user?.id,
        agreement_type: agreement.id,
        signed_at: new Date().toISOString(),
        ip_address: 'client-ip', // Would get from request
        user_agent: navigator.userAgent,
        document_version: '1.0'
      }));

      const { error } = await supabase
        .from('tax_agreements')
        .insert(signedAgreements);

      if (error) throw error;

      setCurrentStep('onboarding');
    } catch (error) {
      console.error('Error signing agreements:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const startStripeOnboarding = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-embedded-stripe-account', {
        body: {
          email: user?.email,
          type: userType,
          agreements_signed: true
        }
      });

      if (error) throw error;

      // For embedded onboarding, we'd integrate Stripe's embedded components
      // For now, we'll use the account link but enhance it
      if (data.onboarding_url) {
        // Open in a modal or embedded iframe instead of new tab
        window.open(data.onboarding_url, 'stripe-onboarding', 'width=800,height=600');
      }

      // Poll for completion
      const pollInterval = setInterval(async () => {
        const { data: profile } = await supabase
          .from('profiles')
          .select('stripe_account_id')
          .eq('id', user?.id)
          .single();

        if (profile?.stripe_account_id) {
          clearInterval(pollInterval);
          setCurrentStep('complete');
          onComplete(profile.stripe_account_id);
        }
      }, 2000);

    } catch (error) {
      console.error('Error starting onboarding:', error);
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
        </div>
      </div>
    );
  }

  if (currentStep === 'onboarding') {
    return (
      <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-sm border text-center">
        <div className="mb-6">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <ExternalLink className="w-8 h-8 text-blue-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Connect Your Bank Account</h2>
          <p className="text-gray-600 mt-2">
            Complete the secure Stripe verification process to start receiving payments.
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