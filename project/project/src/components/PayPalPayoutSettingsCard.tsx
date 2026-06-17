import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContextMultiRole';

type PayPalAccountRole = 'SELLER' | 'PARTNER' | 'INFLUENCER';

type PayPalAccountRow = {
  user_id: string;
  role: PayPalAccountRole;
  paypal_email: string;
};

interface PayPalPayoutSettingsCardProps {
  title?: string;
  description?: string;
  className?: string;
}

const DEFAULT_TITLE = 'PayPal payout email';
const DEFAULT_DESCRIPTION =
  'This email is used to send seller payouts and partner/influencer commissions. You can update it anytime.';

export default function PayPalPayoutSettingsCard({
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
  className = '',
}: PayPalPayoutSettingsCardProps) {
  const { profile, refreshProfile } = useAuth();

  const profileId = useMemo(() => {
    const id = (profile as any)?.id ? String((profile as any).id) : '';
    return id.trim();
  }, [profile]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [statusLabel, setStatusLabel] = useState<'Not set' | 'Saved'>('Not set');
  const NONCE_KEY = 'beezio_paypal_connect_nonce';
  const withTimeout = async <T,>(promise: Promise<T>, ms: number, label: string): Promise<T> => {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => window.setTimeout(() => reject(new Error(`${label} timed out. Please try again.`)), ms)),
    ]);
  };

  useEffect(() => {
    let alive = true;

    const load = async () => {
      if (!profileId) {
        if (!alive) return;
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const { data, error: loadError } = await withTimeout(
          supabase
            .from('paypal_accounts')
            .select('user_id, role, paypal_email')
            .eq('user_id', profileId),
          15000,
          'Loading payout settings'
        );

        if (loadError) throw loadError;
        const rows = (data || []) as PayPalAccountRow[];

        const firstEmail = String(rows.find((r) => r.paypal_email)?.paypal_email || '').trim();
        if (firstEmail) setEmail(firstEmail);

        if (!rows.length || !firstEmail) {
          setStatusLabel('Not set');
        } else {
          setStatusLabel('Saved');
        }
      } catch (e: any) {
        setError(e?.message || 'Unable to load payout settings.');
      } finally {
        if (alive) setLoading(false);
      }
    };

    void load();
    return () => {
      alive = false;
    };
  }, [profileId]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      if (!profileId) throw new Error('Missing profile. Please sign in again.');
      const trimmed = email.trim();
      if (!trimmed || !trimmed.includes('@')) throw new Error('Enter a valid PayPal email.');
      if (!confirmed) throw new Error('Please confirm your PayPal payout email.');

      const { error: upsertError } = await withTimeout(
        supabase
          .from('paypal_accounts')
          .upsert(
            [
              { user_id: profileId, role: 'SELLER', paypal_email: trimmed, is_verified: false },
              { user_id: profileId, role: 'PARTNER', paypal_email: trimmed, is_verified: false },
              { user_id: profileId, role: 'INFLUENCER', paypal_email: trimmed, is_verified: false },
            ] as any,
            { onConflict: 'user_id,role' }
          ),
        20000,
        'Saving payout settings'
      );
      if (upsertError) throw upsertError;

      setStatusLabel('Saved');
      setSuccess('Saved.');
      setConfirmed(false);
      await withTimeout(refreshProfile(), 15000, 'Refreshing profile');
    } catch (e: any) {
      setError(e?.message || 'Unable to save payout settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleConnectPayPal = async () => {
    setConnecting(true);
    setError(null);
    setSuccess(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = String(sessionData?.session?.access_token || '').trim();
      if (!accessToken) throw new Error('Please sign in again, then connect PayPal.');

      const returnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      const abort = new AbortController();
      const timeout = window.setTimeout(() => abort.abort(), 20000);
      let res: Response;
      try {
        res = await fetch('/api/paypal/connect-start', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ return_to: returnTo || '/dashboard' }),
          signal: abort.signal,
        });
      } finally {
        window.clearTimeout(timeout);
      }

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String(payload?.error || 'Unable to start PayPal connect.'));

      const authUrl = String(payload?.authUrl || '').trim();
      const nonce = String(payload?.nonce || '').trim();
      if (!authUrl || !nonce) throw new Error('PayPal connect URL is missing.');

      localStorage.setItem(NONCE_KEY, nonce);
      window.location.assign(authUrl);
    } catch (e: any) {
      setError(e?.message || 'Unable to start PayPal connect.');
    } finally {
      setConnecting(false);
    }
  };

  const badge = useMemo(() => {
    const common = 'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold';
    if (statusLabel === 'Saved') return <span className={`${common} bg-green-100 text-green-800`}>Saved</span>;
    return <span className={`${common} bg-gray-100 text-gray-700`}>Not set</span>;
  }, [statusLabel]);

  return (
    <div className={`rounded-xl border border-gray-200 bg-white p-6 shadow-sm ${className}`.trim()}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
            {badge}
          </div>
          <p className="mt-1 text-sm text-gray-600">{description}</p>
        </div>
      </div>

      {loading ? (
        <div className="mt-4 text-sm text-gray-600">Loading payout settings…</div>
      ) : (
        <div className="mt-4">
          <div className="mb-4 rounded-md border border-green-200 bg-green-50 p-3">
            <div className="text-sm font-semibold text-green-900">Recommended: Connect with PayPal</div>
            <div className="mt-1 text-xs text-green-800">
              Verifies ownership and keeps your payout email in sync.
            </div>
            <button
              type="button"
              onClick={handleConnectPayPal}
              disabled={connecting}
              className="mt-3 inline-flex items-center justify-center rounded-lg bg-[#0070ba] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {connecting ? 'Redirecting…' : 'Connect PayPal'}
            </button>
          </div>

          <label className="block text-sm font-medium text-gray-700 mb-2">PayPal email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@paypal-email.com"
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-amber-500 focus:ring-amber-500"
          />

          <label className="mt-3 flex items-start gap-2 text-xs text-gray-600">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
            />
            <span>I confirm this is my PayPal email for receiving Beezio payouts.</span>
          </label>

          {error && <div className="mt-3 text-sm text-red-600">{error}</div>}
          {success && <div className="mt-3 text-sm text-green-700">{success}</div>}

          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center justify-center rounded-lg bg-[#ffcb05] px-4 py-2 text-sm font-semibold text-[#101820] disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <div className="text-xs text-gray-500">Applies to Seller, Partner, and Influencer payouts.</div>
          </div>
        </div>
      )}
    </div>
  );
}
