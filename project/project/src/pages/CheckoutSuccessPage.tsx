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
        const captureRes = await fetch('/api/paypal/capture-order', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderID: providerOrderId }),
        });
        const capture = await captureRes.json().catch(() => ({}));
        if (!captureRes.ok || capture?.ok !== true || !capture?.order_id) {
          throw new Error('We could not confirm payment yet. Do not place another order. Check this payment again or contact support with the reference below.');
        }
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
        if (orderId && String(payload?.order?.payment_status || '').toLowerCase() === 'paid') {
          try { localStorage.removeItem('beezio-pending-paypal-payment'); } catch { /* non-fatal */ }
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
        {providerOrderId && <p className="mt-4 break-all text-sm">Checkout reference: {providerOrderId}</p>}
        {error && <div className="mt-4 text-sm text-red-700">{error}</div>}
        {error && providerOrderId && <button type="button" onClick={() => { setError(null); setAttempt(a => a + 1); }} className="mt-4 rounded-lg bg-amber-600 px-4 py-2 text-white">Check existing payment</button>}
        <a href={`mailto:support@beezio.co?subject=${encodeURIComponent(`Payment verification: ${providerOrderId}`)}`} className="mt-4 block text-sm underline">Contact support</a>
      </div>
    </div>
  );
}
