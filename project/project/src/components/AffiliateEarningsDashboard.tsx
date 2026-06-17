import { useEffect, useState } from 'react';
import { DollarSign, Clock, CheckCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContextMultiRole';
import { apiPost } from '../utils/netlifyApi';
import PayoutHistoryCard from './PayoutHistoryCard';

type AffiliateEarningsSummary = {
  total_earned?: number;
  pending_payout?: number;
  paid_out?: number;
  current_balance?: number;
  held_balance?: number;
  pending_hold_balance?: number;
  dispute_hold_balance?: number;
  next_release_at?: string | null;
};

const formatMoney = (value: unknown) =>
  Number(value || 0).toLocaleString(undefined, { style: 'currency', currency: 'USD' });

export default function AffiliateEarningsDashboard() {
  const { session } = useAuth();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<AffiliateEarningsSummary>({});

  useEffect(() => {
    let alive = true;

    const load = async () => {
      setLoading(true);
      try {
        const payload = await apiPost<any>('/api/user-earnings', session ?? null, { role: 'affiliate' });
        if (!alive) return;
        setSummary((payload as any)?.earnings || {});
      } catch {
        if (!alive) return;
        setSummary({});
      } finally {
        if (alive) setLoading(false);
      }
    };

    void load();
    return () => {
      alive = false;
    };
  }, [session]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="rounded-lg border-2 border-yellow-400 bg-gradient-to-br from-yellow-50 to-yellow-100 p-6">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-700">Held / Pending</h3>
            <Clock className="h-5 w-5 text-yellow-600" />
          </div>
          <p className="text-3xl font-bold text-gray-900">
            {loading ? '...' : formatMoney(summary.held_balance ?? summary.pending_payout)}
          </p>
          <p className="mt-1 text-xs text-gray-600">Still inside hold or dispute review</p>
        </div>

        <div className="rounded-lg border-2 border-green-400 bg-gradient-to-br from-green-50 to-green-100 p-6">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-700">Paid Out</h3>
            <CheckCircle className="h-5 w-5 text-green-600" />
          </div>
          <p className="text-3xl font-bold text-gray-900">{loading ? '...' : formatMoney(summary.paid_out)}</p>
          <p className="mt-1 text-xs text-gray-600">Completed PayPal payouts</p>
        </div>

        <div className="rounded-lg border-2 border-blue-400 bg-gradient-to-br from-blue-50 to-blue-100 p-6">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-700">Total Earned</h3>
            <DollarSign className="h-5 w-5 text-blue-600" />
          </div>
          <p className="text-3xl font-bold text-gray-900">{loading ? '...' : formatMoney(summary.total_earned)}</p>
          <p className="mt-1 text-xs text-gray-600">Lifetime logged affiliate earnings</p>
        </div>
      </div>

      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
        <h4 className="font-medium text-gray-900">Affiliate payout flow</h4>
        <p className="mt-1 text-sm text-gray-600">
          Affiliate commissions are logged after payment capture, held until the release window clears, then included in Beezio&apos;s PayPal payout runs.
        </p>
        {summary.next_release_at ? (
          <p className="mt-2 text-xs text-gray-500">Next hold release: {new Date(summary.next_release_at).toLocaleString()}</p>
        ) : null}
      </div>

      <PayoutHistoryCard
        role="PARTNER"
        title="Affiliate Payout History"
        description="Track pending hold rows, ready-to-pay affiliate commissions, and completed PayPal transfers."
      />
    </div>
  );
}
