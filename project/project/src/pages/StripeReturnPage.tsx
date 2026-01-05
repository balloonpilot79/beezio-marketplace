import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContextMultiRole';
import { supabase } from '../lib/supabase';
import { apiPost } from '../utils/netlifyApi';

const StripeReturnPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile, session, loading } = useAuth();
  const [statusText, setStatusText] = useState('Finishing Stripe setup…');
  const [canClose, setCanClose] = useState(false);

  const destination = useMemo(() => {
    const role = String((profile as any)?.primary_role || (profile as any)?.role || 'buyer').toLowerCase();
    // Fundraisers have seller + affiliate tools; default them to store settings.
    if (role === 'seller' || role === 'fundraiser') return '/dashboard/store-settings';
    if (role === 'affiliate') return '/dashboard/store-settings';
    return '/dashboard';
  }, [profile]);

  useEffect(() => {
    let cancelled = false;

    // Let the opener know Stripe returned, so it can refresh/poll status.
    try {
      if (window.opener && window.opener !== window) {
        window.opener.postMessage({ type: 'beezio:stripe-return' }, window.location.origin);
      }
    } catch {
      // ignore
    }

    void (async () => {
      // Wait a bit for auth context to hydrate in this window.
      const startedAt = Date.now();
      while (!cancelled && Date.now() - startedAt < 12_000) {
        if (!loading) break;
        await new Promise((r) => setTimeout(r, 250));
      }

      // Best-effort: nudge Stripe status refresh (non-blocking).
      try {
        await apiPost('/api/stripe/account-status', session ?? null, {});
      } catch {
        // ignore
      }

      if (cancelled) return;

      if (user) {
        setStatusText('Stripe setup complete. Returning to Beezio…');
        setCanClose(true);
        // If this was opened as a popup, try to close it after a moment.
        setTimeout(() => {
          try {
            window.close();
          } catch {
            // ignore
          }
        }, 800);
        // Also navigate in case this is not a popup.
        setTimeout(() => {
          if (!cancelled) navigate(destination, { replace: true });
        }, 400);
        return;
      }

      // If the user isn't signed in in this window, don't show a confusing "please sign in".
      // Give them a clear path back to the main app.
      setStatusText('Stripe returned. You can close this window and continue in the main Beezio tab.');
      setCanClose(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [destination, loading, navigate, session, user]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="w-full max-w-lg bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-gray-900">Stripe setup</h1>
        <p className="mt-2 text-gray-700">{statusText}</p>

        <div className="mt-5 flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={() => navigate(destination, { replace: true })}
            className="inline-flex items-center justify-center px-5 py-3 rounded-lg bg-[#ffcb05] text-[#101820] font-semibold"
          >
            Continue
          </button>
          <button
            type="button"
            onClick={() => {
              try {
                window.close();
              } catch {
                // ignore
              }
            }}
            disabled={!canClose}
            className="inline-flex items-center justify-center px-5 py-3 rounded-lg border border-gray-300 bg-white text-gray-900 font-semibold disabled:opacity-50"
          >
            Close window
          </button>
        </div>
      </div>
    </div>
  );
};

export default StripeReturnPage;
