import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContextMultiRole';
import { supabase } from '../lib/supabase';
import { resolveProfileIdForUser } from '../utils/resolveProfileId';
import UnifiedMegaDashboard from './UnifiedMegaDashboard';
import { apiPost } from '../utils/netlifyApi';

const Dashboard: React.FC = () => {
  const { user, profile, session, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const hasRedirected = useRef(false);
  const [stripeConnectedOverride, setStripeConnectedOverride] = useState<boolean | null>(null);
  const [stripeStatusUnavailable, setStripeStatusUnavailable] = useState(false);

  console.log('Dashboard:', { hasUser: !!user, userEmail: user?.email, authLoading });

  // Profile reads can time out; use Stripe status Edge Function as a fallback signal.
  useEffect(() => {
    if (!user) return;
    if ((profile as any)?.stripe_account_id) {
      setStripeConnectedOverride(true);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const data = await apiPost<any>('/api/stripe/account-status', session ?? null, {});
        if (cancelled) return;
        if (data?.account_id) setStripeConnectedOverride(true);
      } catch (e: any) {
        const status = Number(e?.status || 0);
        if (status === 404) setStripeStatusUnavailable(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [profile, session, user?.id]);

  // If no user and done loading, redirect home (only once)
  useEffect(() => {
    if (!authLoading && !user && !hasRedirected.current) {
      console.log('Dashboard: No user, redirecting to home');
      hasRedirected.current = true;
      navigate('/', { replace: true });
    }
  }, [user, authLoading, navigate]);

  // Creator roles should complete onboarding (Stripe + setup) before using the dashboard.
  useEffect(() => {
    if (authLoading || !user || hasRedirected.current) return;
    const effectiveRole = String((profile as any)?.primary_role || (profile as any)?.role || 'buyer');
    const stripeConnected =
      stripeStatusUnavailable ||
      stripeConnectedOverride === true ||
      Boolean((profile as any)?.stripe_account_id);
    const profileIsFallback = Boolean((profile as any)?.__is_fallback);
    if (effectiveRole !== 'buyer' && !stripeConnected && !profileIsFallback) {
      hasRedirected.current = true;
      navigate('/onboarding', { replace: true });
    }
  }, [authLoading, navigate, profile, stripeConnectedOverride, stripeStatusUnavailable, user]);

  // After Stripe connects, prompt creators to set up their store/site.
  useEffect(() => {
    if (authLoading || !user || hasRedirected.current) return;

    const effectiveRole = String((profile as any)?.primary_role || (profile as any)?.role || 'buyer');
    if (effectiveRole === 'buyer') return;

    const stripeConnected =
      stripeStatusUnavailable ||
      stripeConnectedOverride === true ||
      Boolean((profile as any)?.stripe_account_id);
    if (!stripeConnected) return;

    const profileIsFallback = Boolean((profile as any)?.__is_fallback);
    if (profileIsFallback) return;

    const flagKey = `bzo_store_setup_prompted:${user.id}:${effectiveRole}`;
    if (localStorage.getItem(flagKey) === '1') return;

    void (async () => {
      try {
        const canonicalProfileId = await resolveProfileIdForUser(user.id);
        const table = effectiveRole === 'affiliate' ? 'affiliate_store_settings' : 'store_settings';
        const idColumn = effectiveRole === 'affiliate' ? 'affiliate_id' : 'seller_id';

        const { data, error } = await supabase
          .from(table)
          .select('store_name')
          .eq(idColumn, canonicalProfileId)
          .maybeSingle();

        if (error && error.code !== 'PGRST116') {
          // If we can't check, don't block the user with redirects.
          localStorage.setItem(flagKey, '1');
          return;
        }

        const storeName = String((data as any)?.store_name || '').trim();
        const configured = storeName.length > 0;

        if (!configured) {
          localStorage.setItem(flagKey, '1');
          hasRedirected.current = true;
          navigate('/dashboard/store-settings', { replace: true });
        } else {
          localStorage.setItem(flagKey, '1');
        }
      } catch {
        localStorage.setItem(flagKey, '1');
      }
    })();
  }, [authLoading, navigate, profile, stripeConnectedOverride, stripeStatusUnavailable, user]);

  // Always show loading while auth is loading, even if user briefly exists
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Show dashboard if we have a user
  if (user) {
    console.log('Dashboard: Showing dashboard for', user.email);
    return <UnifiedMegaDashboard />;
  }

  return null;
};

export default Dashboard;
