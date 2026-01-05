import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { CheckCircle, ArrowRight, Store, Link2, Package, LayoutDashboard } from 'lucide-react';
import { useAuth } from '../contexts/AuthContextMultiRole';
import { supabase } from '../lib/supabase';
import { EmbeddedStripeOnboarding } from '../components/EmbeddedStripeOnboarding';
import { apiPost } from '../utils/netlifyApi';

const OnboardingPage: React.FC = () => {
  const { user, profile, session, currentRole, switchRole } = useAuth();
  const navigate = useNavigate();
  const [stripeAccountId, setStripeAccountId] = useState<string | null>(null);
  const [loadingStripe, setLoadingStripe] = useState(true);

  const effectiveRole = useMemo(() => {
    return (profile?.primary_role || profile?.role || currentRole || 'buyer') as string;
  }, [profile?.primary_role, profile?.role, currentRole]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    (async () => {
      setLoadingStripe(true);
      try {
        // Prefer Edge Function status (avoids slow profile selects / timeouts on large schemas).
        let statusData: any = null;
        let statusError: any = null;
        if (session?.access_token) {
          try {
            statusData = await apiPost<any>('/api/stripe/account-status', session ?? null, {});
          } catch (e: any) {
            statusError = e;
          }
        } else {
          statusError = { status: 401, message: 'Session not ready' };
        }

        if (!cancelled) {
          if (!statusError && statusData?.account_id) {
            setStripeAccountId(String(statusData.account_id));
          } else {
            const httpStatus = Number((statusError as any)?.status || 0);
            if (httpStatus === 404) {
              // The status function isn't deployed for this Supabase project.
              // Don't hard-block the user; they can still set up their store while this is fixed.
              setStripeAccountId('unavailable');
              return;
            }
            // Fallback: direct profile read
            const { data } = await supabase
              .from('profiles')
              .select('stripe_account_id')
              .or(`id.eq.${user.id},user_id.eq.${user.id}`)
              .not('stripe_account_id', 'is', null)
              .neq('stripe_account_id', '')
              .limit(1)
              .maybeSingle();
            setStripeAccountId((data as any)?.stripe_account_id ?? null);
          }
        }
      } finally {
        if (!cancelled) setLoadingStripe(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session, user?.id]);

  const needsStripe = effectiveRole !== 'buyer';
  const stripeConnected = stripeAccountId === 'unavailable' || Boolean(stripeAccountId || (profile as any)?.stripe_account_id);

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-3xl mx-auto px-4 py-12">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Finish setting up your account</h1>
          <p className="text-gray-600 mb-6">Sign in to continue onboarding.</p>
          <Link to="/auth/login" className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-[#ffcb05] text-[#101820] font-semibold">
            Go to sign in <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  if (!needsStripe) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-3xl mx-auto px-4 py-12">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">You're ready to go</h1>
          <p className="text-gray-600 mb-6">Your buyer account is set up. Head to the dashboard anytime.</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-[#ffcb05] text-[#101820] font-semibold"
          >
            Go to dashboard <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  const stripeUserType = effectiveRole === 'seller' ? 'seller' : 'affiliate';

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Creator setup</h1>
          <p className="text-gray-600 mt-2">
            Sellers, affiliates, and fundraisers get paid through Stripe. Complete the steps below and you’ll land in your dashboard ready to earn.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">1) Tax & payment setup</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Confirm independent-contractor/1099 terms and connect Stripe so Stripe can handle payouts.
                </p>
              </div>
              {stripeConnected && (
                <div className="inline-flex items-center gap-1.5 text-green-700 bg-green-50 border border-green-200 px-3 py-1.5 rounded-full text-sm font-semibold">
                  <CheckCircle className="w-4 h-4" />
                  Connected
                </div>
              )}
            </div>

            {!stripeConnected && (
              <div className="mt-5">
                {loadingStripe ? (
                  <div className="text-sm text-gray-500">Loading…</div>
                ) : (
                  <EmbeddedStripeOnboarding
                    userType={stripeUserType as any}
                    onComplete={(accountId) => {
                      setStripeAccountId(accountId);
                    }}
                  />
                )}
              </div>
            )}

            {stripeConnected && (
              <div className="mt-5 text-sm text-gray-600">
                Stripe is connected. Continue to set up your storefront and start promoting.
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">2) Next steps</h2>
            <div className="space-y-3">
              <button
                disabled={!stripeConnected}
                onClick={async () => {
                  // Fundraisers have seller+affiliate access; default them to seller for store setup.
                  if (effectiveRole === 'fundraiser') {
                    await switchRole('seller');
                  }
                  navigate('/dashboard/store-settings');
                }}
                className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex items-center gap-3">
                  <Store className="w-5 h-5 text-gray-800" />
                  <div className="text-left">
                    <div className="font-semibold text-gray-900">Customize your store</div>
                    <div className="text-sm text-gray-600">Logo, colors, pages, and storefront settings</div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-500" />
              </button>

              <button
                disabled={!stripeConnected}
                onClick={() => navigate('/add-product')}
                className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex items-center gap-3">
                  <Package className="w-5 h-5 text-gray-800" />
                  <div className="text-left">
                    <div className="font-semibold text-gray-900">Add products</div>
                    <div className="text-sm text-gray-600">List products so affiliates can promote them</div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-500" />
              </button>

              <button
                disabled={!stripeConnected}
                onClick={async () => {
                  if (effectiveRole === 'fundraiser') {
                    await switchRole('affiliate');
                  }
                  navigate('/dashboard');
                }}
                className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex items-center gap-3">
                  <LayoutDashboard className="w-5 h-5 text-gray-800" />
                  <div className="text-left">
                    <div className="font-semibold text-gray-900">Open your dashboard</div>
                    <div className="text-sm text-gray-600">Learn how to run your store and track earnings</div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-500" />
              </button>

              <Link
                to="/affiliate-guide"
                className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-lg border border-gray-200 hover:bg-gray-50 ${!stripeConnected ? 'pointer-events-none opacity-50' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <Link2 className="w-5 h-5 text-gray-800" />
                  <div className="text-left">
                    <div className="font-semibold text-gray-900">Learn promotion basics</div>
                    <div className="text-sm text-gray-600">How to share links, recruit affiliates, and promote products</div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-500" />
              </Link>
            </div>

            {!stripeConnected && (
              <div className="mt-4 text-xs text-gray-500">
                Complete Stripe setup to unlock store setup, product listing, and promotion tools.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OnboardingPage;
