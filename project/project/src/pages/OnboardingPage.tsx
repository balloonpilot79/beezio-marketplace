import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowRight, Store, Package, LayoutDashboard, ShieldCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContextMultiRole';
import { supabase } from '../lib/supabase';

const OnboardingPage: React.FC = () => {
  const { user, profile, currentRole, refreshProfile } = useAuth();
  const navigate = useNavigate();

  const [paypalEmail, setPaypalEmail] = useState('');
  const [paypalConfirmed, setPaypalConfirmed] = useState(false);
  const [payoutSaving, setPayoutSaving] = useState(false);
  const [payoutError, setPayoutError] = useState<string | null>(null);
  const [payoutSaved, setPayoutSaved] = useState<string | null>(null);
  const [connectLoading, setConnectLoading] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  const effectiveRole = useMemo(() => {
    return (profile?.primary_role || profile?.role || currentRole || 'buyer') as string;
  }, [profile?.primary_role, profile?.role, currentRole]);

  const isBuyer = effectiveRole === 'buyer';
  const isSeller = effectiveRole === 'seller';
  const isAffiliate = effectiveRole === 'affiliate';

  useEffect(() => {
    const loadExisting = async () => {
      const profileId = (profile as any)?.id ? String((profile as any).id) : null;
      if (!profileId) return;
      try {
        const { data } = await supabase
          .from('paypal_accounts')
          .select('paypal_email')
          .eq('user_id', profileId)
          .limit(1);
        const email = String((data as any)?.[0]?.paypal_email || '').trim();
        if (email) setPaypalEmail(email);
      } catch {
        // ignore
      }
    };
    void loadExisting();
  }, [profile]);

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

  if (isBuyer) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-3xl mx-auto px-4 py-12">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">You're ready to go</h1>
          <p className="text-gray-600 mb-6">Your buyer account is set up. View your orders and support in Shopper Account anytime.</p>
          <button
            onClick={() => navigate('/account')}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-[#ffcb05] text-[#101820] font-semibold"
          >
            Open Shopper Account <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  const savePayoutEmail = async () => {
    setPayoutSaving(true);
    setPayoutError(null);
    setPayoutSaved(null);
    try {
      const profileId = (profile as any)?.id ? String((profile as any).id) : null;
      if (!profileId) throw new Error('Missing profile id');

      const email = paypalEmail.trim();
      if (!email || !email.includes('@')) {
        throw new Error('Please enter a valid PayPal email.');
      }
      if (!paypalConfirmed) {
        throw new Error('Please confirm your PayPal payout email.');
      }

      const { error: saveError } = await supabase
        .from('paypal_accounts')
        .upsert(
          [
            { user_id: profileId, role: 'SELLER', paypal_email: email, is_verified: false },
            { user_id: profileId, role: 'PARTNER', paypal_email: email, is_verified: false },
            { user_id: profileId, role: 'INFLUENCER', paypal_email: email, is_verified: false },
          ] as any,
          { onConflict: 'user_id,role' }
        );

      if (saveError) throw saveError;
      setPayoutSaved('PayPal payout email saved. Connect with PayPal to verify ownership before payouts.');
      await refreshProfile();
    } catch (err: any) {
      setPayoutError(err?.message || 'Unable to save PayPal payout email.');
    } finally {
      setPayoutSaving(false);
    }
  };

  const connectPayPal = async () => {
    setConnectLoading(true);
    setConnectError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = String(sessionData?.session?.access_token || '').trim();
      if (!accessToken) throw new Error('Please sign in again, then connect PayPal.');

      const res = await fetch('/api/paypal/connect-start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ return_to: '/onboarding' }),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String(payload?.error || 'Unable to start PayPal connect.'));

      const authUrl = String(payload?.authUrl || '').trim();
      const nonce = String(payload?.nonce || '').trim();
      if (!authUrl || !nonce) throw new Error('PayPal connect URL is missing.');

      localStorage.setItem('beezio_paypal_connect_nonce', nonce);
      window.location.assign(authUrl);
    } catch (err: any) {
      setConnectError(err?.message || 'Unable to start PayPal connect.');
      setConnectLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Account setup</h1>
          <p className="text-gray-600 mt-2">
            Build your store or start sharing first. You can finish payout setup later, before receiving payouts.
          </p>
        </div>

        <section className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-5 sm:p-6" aria-labelledby="start-now-title">
          <h2 id="start-now-title" className="text-xl font-semibold text-gray-900">What would you like to do first?</h2>
          <p className="mt-2 text-sm text-gray-700">One account includes seller, affiliate, and influencer tools. Choose a starting point.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <Link to="/business/products/add" className="rounded-lg border border-amber-200 bg-white p-4 text-gray-900 hover:border-amber-500"><strong className="block">Sell my products</strong><span className="mt-2 block text-sm">Add your first product and set your payout.</span></Link>
            <Link to="/marketplace" className="rounded-lg border border-amber-200 bg-white p-4 text-gray-900 hover:border-amber-500"><strong className="block">Choose products to promote</strong><span className="mt-2 block text-sm">See earnings and add products to your free store.</span></Link>
            <Link to="/business?section=influencer" className="rounded-lg border border-amber-200 bg-white p-4 text-gray-900 hover:border-amber-500"><strong className="block">Refer sellers and affiliates</strong><span className="mt-2 block text-sm">Open your influencer tools and get your referral link.</span></Link>
          </div>
          <Link to="/business?tab=store-customization" className="mt-4 inline-flex min-h-11 items-center gap-2 font-semibold text-gray-900 underline underline-offset-4">Customize my store <ArrowRight className="h-4 w-4" /></Link>
        </section>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900">Payout setup — finish when you’re ready</h2>
            <p className="text-sm text-gray-600 mt-1">
              You can explore products and build your store now. Complete payout verification before receiving your earnings.
            </p>

            <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
              <div className="mb-3 rounded-md border border-green-200 bg-green-50 p-3">
                <div className="text-sm font-semibold text-green-900">Recommended: Connect with PayPal</div>
                <div className="mt-1 text-xs text-green-800">
                  This verifies ownership and auto-fills your payout email.
                </div>
                <button
                  type="button"
                  onClick={connectPayPal}
                  disabled={connectLoading}
                  className="mt-3 inline-flex items-center justify-center rounded-lg bg-[#0070ba] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {connectLoading ? 'Redirecting…' : 'Connect PayPal'}
                </button>
                {connectError && <div className="mt-2 text-xs text-red-700">{connectError}</div>}
              </div>

              <div className="text-sm font-semibold text-gray-900">PayPal payout email</div>
              <div className="mt-1 text-xs text-gray-600">
                Used for seller payouts plus affiliate and influencer earnings.
              </div>

              <div className="mt-3">
                <input
                  type="email"
                  value={paypalEmail}
                  onChange={(e) => setPaypalEmail(e.target.value)}
                  placeholder="you@paypal-email.com"
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-amber-500 focus:ring-amber-500"
                />
              </div>

              <label className="mt-2 flex items-start gap-2 text-xs text-gray-600">
                <input
                  type="checkbox"
                  checked={paypalConfirmed}
                  onChange={(e) => setPaypalConfirmed(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                />
                <span>I confirm this is my PayPal email for receiving payouts.</span>
              </label>

              {payoutError && <div className="mt-2 text-xs text-red-600">{payoutError}</div>}
              {payoutSaved && <div className="mt-2 text-xs text-green-700">{payoutSaved}</div>}

              <button
                type="button"
                onClick={savePayoutEmail}
                disabled={payoutSaving}
                className="mt-3 inline-flex items-center justify-center rounded-lg bg-[#ffcb05] px-4 py-2 text-sm font-semibold text-[#101820] disabled:opacity-50"
              >
                {payoutSaving ? 'Saving…' : 'Save PayPal Email'}
              </button>
            </div>

            <div className="mt-4 flex items-center gap-2 text-sm text-gray-700">
              <LayoutDashboard className="w-4 h-4" />
              <span>Go to Business Center {'->'} Payments when you are ready.</span>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Store tools</h2>
            <div className="space-y-3">
              <button
                onClick={() => navigate('/business?tab=store-customization')}
                className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex items-center gap-3">
                  <Store className="w-5 h-5 text-gray-800" />
                  <div className="text-left">
                    <div className="font-semibold text-gray-900">{isAffiliate ? 'Build your affiliate store' : 'Customize your store'}</div>
                    <div className="text-sm text-gray-600">{isAffiliate ? 'Brand your share page and organize the offers you want to promote' : 'Logo, colors, pages, and storefront settings'}</div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-500" />
              </button>

              <button
                onClick={() => navigate(isAffiliate ? '/marketplace' : '/business/products/add')}
                className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex items-center gap-3">
                  <Package className="w-5 h-5 text-gray-800" />
                  <div className="text-left">
                    <div className="font-semibold text-gray-900">{isAffiliate ? 'Choose offers to promote' : 'Add products'}</div>
                    <div className="text-sm text-gray-600">{isAffiliate ? 'Choose marketplace products and add them to your store' : 'List products to sell through your storefront'}</div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-500" />
              </button>

              <button
                onClick={() => navigate('/business')}
                className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex items-center gap-3">
                  <LayoutDashboard className="w-5 h-5 text-gray-800" />
                  <div className="text-left">
                    <div className="font-semibold text-gray-900">Open Business Center</div>
                    <div className="text-sm text-gray-600">{isAffiliate ? 'Track links, earnings, and the offers you are promoting' : 'Run your store, manage activity, and track earnings'}</div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-500" />
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Role snapshot</h2>
            {isSeller ? (
              <ul className="text-sm text-gray-700 space-y-1">
                <li>You are setting up a seller account to launch offers on Beezio.</li>
                <li>Seller payouts are issued to the PayPal email you provide.</li>
                <li>Refunds and chargebacks follow Beezio policies and provider rules.</li>
                <li>
                  Read the full terms:{' '}
                  <Link to="/terms#seller-payouts" className="text-amber-600 hover:text-amber-700 underline">Seller payouts</Link>
                </li>
              </ul>
            ) : (
              <ul className="text-sm text-gray-700 space-y-1">
                <li>You are setting up an affiliate account that can promote mixed offer types.</li>
                <li>Attribution is tracked by links and system logs.</li>
                <li>Affiliate earnings are tracked in Business Center and paid to the payout method you set.</li>
                <li>
                  Read the full terms:{' '}
                  <Link to="/terms#partner-commissions" className="text-amber-600 hover:text-amber-700 underline">Partner commissions</Link>
                  {' '}and{' '}
                  <Link to="/terms#influencer-terms" className="text-amber-600 hover:text-amber-700 underline">Influencer terms</Link>
                </li>
              </ul>
            )}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-2">
              <ShieldCheck className="w-5 h-5 text-amber-600" />
              <h2 className="text-lg font-semibold text-gray-900">Compliance checklist</h2>
            </div>
            {isSeller ? (
              <ul className="text-sm text-gray-700 space-y-1">
                <li>Verify your PayPal account for payouts.</li>
                <li>List only products you are authorized to sell.</li>
                <li>Ship on time and honor the 14-day refund / 30-day exchange policy.</li>
                <li>Respond to disputes with tracking and evidence when requested.</li>
              </ul>
            ) : (
              <ul className="text-sm text-gray-700 space-y-1">
                <li>Disclose paid promotions and follow FTC guidelines.</li>
                <li>Use approved links and avoid misleading claims.</li>
                <li>Do not purchase through your own links.</li>
                <li>Promote real offers honestly, including warm inbound insurance pages only.</li>
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OnboardingPage;
