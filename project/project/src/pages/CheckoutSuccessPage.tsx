import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { clearReferralData } from '../utils/referralTracking';

export default function CheckoutSuccessPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const providerOrderId = useMemo(() => {
    // PayPal return URLs usually include `token`.
    const token = String(searchParams.get('token') || '').trim();
    if (token) return token;
    // Keep legacy compatibility for older links.
    return String(searchParams.get('session_id') || '').trim();
  }, [searchParams]);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!providerOrderId) {
      setError('Missing checkout reference');
      return;
    }

    let cancelled = false;
    const run = async () => {
      try {
        const sessionData = await supabase.auth.getSession();
        const accessToken = String(sessionData.data.session?.access_token || '').trim();
        const res = await fetch(`/api/order-details?providerOrderId=${encodeURIComponent(providerOrderId)}`, {
          method: 'GET',
          headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
        });
        const payload = await res.json().catch(() => ({}));

        if (cancelled) return;

        if (!res.ok) {
          setError(String((payload as any)?.error || 'Failed to load order'));
          return;
        }

        const orderId = String((payload as any)?.order?.id || '').trim() || null;
        if (orderId) {
          clearReferralData();
          navigate(`/order-confirmation?order=${orderId}`, { replace: true });
          return;
        }

        if (attempt >= 10) {
          setError('Order is still processing. Please refresh this page in a few seconds.');
          return;
        }

        setTimeout(() => {
          if (!cancelled) setAttempt((a) => a + 1);
        }, 1500);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Failed to load order');
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [attempt, navigate, providerOrderId]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <div className="text-2xl font-bold text-gray-900">Processing your order...</div>
        <div className="mt-3 text-gray-600">Hang tight while we confirm payment.</div>
        {error && <div className="mt-4 text-sm text-red-700">{error}</div>}
      </div>
    </div>
  );
}
