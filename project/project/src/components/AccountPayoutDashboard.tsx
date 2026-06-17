import { useEffect, useMemo, useState } from 'react';
import { CreditCard, DollarSign } from 'lucide-react';
import { useAuth } from '../contexts/AuthContextMultiRole';
import { apiPost } from '../utils/netlifyApi';
import PayPalPayoutSettingsCard from './PayPalPayoutSettingsCard';
import PayoutHistoryCard from './PayoutHistoryCard';
import PayoutTimingNotice from './PayoutTimingNotice';
import TaxComplianceCard from './TaxComplianceCard';

type RoleKey = 'seller' | 'affiliate' | 'influencer';

type EarningsSummary = {
  total_earned?: number;
  pending_payout?: number;
  paid_out?: number;
  current_balance?: number;
  held_balance?: number;
  pending_hold_balance?: number;
  dispute_hold_balance?: number;
  next_release_at?: string | null;
};

const money = (value: unknown) =>
  Number(value || 0).toLocaleString(undefined, { style: 'currency', currency: 'USD' });

const getNextBeezioPayoutDate = (from = new Date()) => {
  const year = from.getFullYear();
  const month = from.getMonth();
  const day = from.getDate();
  const lastDay = new Date(year, month + 1, 0).getDate();
  const date = new Date(year, month, day <= 15 ? 15 : lastDay);
  date.setHours(12, 0, 0, 0);
  return date;
};

const getReferencePayoutDate = (readyAmount: number, nextReleaseAt: string | null | undefined) => {
  if (readyAmount > 0) return getNextBeezioPayoutDate(new Date());
  if (nextReleaseAt) {
    const releaseDate = new Date(nextReleaseAt);
    if (!Number.isNaN(releaseDate.getTime())) {
      return getNextBeezioPayoutDate(releaseDate);
    }
  }
  return getNextBeezioPayoutDate(new Date());
};

const formatPayoutDate = (date: Date) =>
  date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

export default function AccountPayoutDashboard() {
  const { session, profile, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [summaries, setSummaries] = useState<Record<RoleKey, EarningsSummary>>({
    seller: {},
    affiliate: {},
    influencer: {},
  });

  useEffect(() => {
    let alive = true;
    const load = async () => {
      setLoading(true);
      try {
        const [seller, affiliate, influencer] = await Promise.allSettled([
          apiPost<any>('/api/user-earnings', session ?? null, { role: 'seller' }),
          apiPost<any>('/api/user-earnings', session ?? null, { role: 'affiliate' }),
          apiPost<any>('/api/user-earnings', session ?? null, { role: 'influencer' }),
        ]);

        const nextSummaries: Record<RoleKey, EarningsSummary> = {
          seller: seller.status === 'fulfilled' ? seller.value?.earnings || {} : {},
          affiliate: affiliate.status === 'fulfilled' ? affiliate.value?.earnings || {} : {},
          influencer: influencer.status === 'fulfilled' ? influencer.value?.earnings || {} : {},
        };

        if (!alive) return;
        setSummaries(nextSummaries);
      } finally {
        if (alive) setLoading(false);
      }
    };
    void load();
    return () => {
      alive = false;
    };
  }, [session]);

  const totals = useMemo(() => {
    const rows = Object.values(summaries);
    return {
      total: rows.reduce((sum, row) => sum + Number(row.total_earned || 0), 0),
      ready: rows.reduce((sum, row) => sum + Number(row.current_balance || 0), 0),
      paid: rows.reduce((sum, row) => sum + Number(row.paid_out || 0), 0),
      held: rows.reduce((sum, row) => sum + Number(row.held_balance || 0), 0),
      holdPending: rows.reduce((sum, row) => sum + Number(row.pending_hold_balance || 0), 0),
      holdDispute: rows.reduce((sum, row) => sum + Number(row.dispute_hold_balance || 0), 0),
    };
  }, [summaries]);

  const nextReleaseAt = useMemo(() => {
    const candidates = Object.values(summaries)
      .map((row) => String(row.next_release_at || '').trim())
      .filter(Boolean)
      .map((iso) => new Date(iso))
      .filter((date) => !Number.isNaN(date.getTime()))
      .sort((a, b) => a.getTime() - b.getTime());
    return candidates.length ? candidates[0].toISOString() : null;
  }, [summaries]);
  const nextPayoutDate = useMemo(() => getReferencePayoutDate(totals.ready, nextReleaseAt), [nextReleaseAt, totals.ready]);
  const nextExpectedPayment = totals.ready;
  const roleCards = [
    {
      label: 'Seller',
      summary: summaries.seller,
      description: 'Seller payout totals show what is still held, what is cleared for the next Beezio pay run, and what has already been paid.',
    },
    {
      label: 'Affiliate',
      summary: summaries.affiliate,
      description: 'Affiliate payout totals show the same hold, ready, and paid flow for partner commissions that have been logged to your account.',
    },
    {
      label: 'Influencer',
      summary: summaries.influencer,
      description: 'Influencer payout totals show what is logged, what is still inside hold, and what has already cleared into a completed payout.',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Account Payouts</h2>
            <p className="mt-1 text-sm text-gray-600">
              One combined payout view for seller, affiliate, and influencer earnings. This page is for hold timing, release timing, and completed Beezio payouts.
            </p>
          </div>
          <CreditCard className="h-6 w-6 text-amber-600" />
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
            <div className="text-xs font-semibold uppercase text-emerald-700">Next expected payment</div>
            <div className="mt-1 text-lg font-bold text-emerald-950">{loading ? '...' : money(nextExpectedPayment)}</div>
            <div className="mt-1 text-xs text-emerald-800">{formatPayoutDate(nextPayoutDate)}</div>
          </div>
          {[
            ['Ready next payday', totals.ready],
            ['Still on hold', totals.held],
            ['Paid out', totals.paid],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <div className="text-xs font-semibold uppercase text-gray-500">{label}</div>
              <div className="mt-1 text-lg font-bold text-gray-900">{loading ? '...' : money(value)}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-blue-200 bg-blue-50 p-5">
        <h3 className="text-lg font-semibold text-gray-900">How Beezio moves money after a sale</h3>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-white/80 bg-white p-4">
            <div className="text-sm font-semibold text-gray-900">Held</div>
            <div className="mt-1 text-sm text-gray-600">
              Money is logged to the ledger, but it is still inside the hold window or blocked by a dispute review.
            </div>
          </div>
          <div className="rounded-lg border border-white/80 bg-white p-4">
            <div className="text-sm font-semibold text-gray-900">Available</div>
            <div className="mt-1 text-sm text-gray-600">
              The hold cleared and the payout amount is ready for the next Beezio pay run.
            </div>
          </div>
          <div className="rounded-lg border border-white/80 bg-white p-4">
            <div className="text-sm font-semibold text-gray-900">Paid</div>
            <div className="mt-1 text-sm text-gray-600">
              Beezio already included that amount in a completed payout batch and logged the payment back here.
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {roleCards.map(({ label, summary, description }) => (
          <div key={label} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-emerald-600" />
              <h3 className="text-lg font-semibold text-gray-900">{label} Summary</h3>
            </div>
            <p className="mt-2 text-sm text-gray-600">{description}</p>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-gray-500">Total</div>
                <div className="font-semibold text-gray-900">{money(summary.total_earned)}</div>
              </div>
              <div>
                <div className="text-gray-500">Ready next payday</div>
                <div className="font-semibold text-gray-900">{money(summary.current_balance)}</div>
              </div>
              <div>
                <div className="text-gray-500">Still in 14-day hold</div>
                <div className="font-semibold text-gray-900">{money(summary.pending_hold_balance)}</div>
              </div>
              <div>
                <div className="text-gray-500">On dispute hold</div>
                <div className="font-semibold text-gray-900">{money(summary.dispute_hold_balance)}</div>
              </div>
            </div>
            {summary.next_release_at ? (
              <div className="mt-3 text-xs text-gray-500">Next hold release: {new Date(summary.next_release_at).toLocaleString()}</div>
            ) : null}
          </div>
        ))}
      </div>

      <PayoutTimingNotice />

      <div className="space-y-4">
        <PayoutHistoryCard role="SELLER" title="Seller Payout History" />
        <PayoutHistoryCard role="PARTNER" title="Affiliate Payout History" />
        <PayoutHistoryCard role="INFLUENCER" title="Influencer Payout History" />
      </div>

      <div className="space-y-4">
        <PayPalPayoutSettingsCard
          title="PayPal payout settings"
          description="Connect PayPal or save the payout email where Beezio should send your seller, affiliate, and influencer payout batches."
        />

        <TaxComplianceCard
          userId={String((profile as any)?.id || (profile as any)?.user_id || user?.id || '')}
          defaultFullName={String((profile as any)?.full_name || '')}
          defaultEmail={String((profile as any)?.email || user?.email || '')}
          defaultStreetAddress={String((profile as any)?.street_address || '')}
          defaultCity={String((profile as any)?.city || '')}
          defaultState={String((profile as any)?.state || '')}
          defaultPostalCode={String((profile as any)?.zip_code || '')}
          paidThisYearCents={Math.round(Number(totals.paid || 0) * 100)}
        />
      </div>
    </div>
  );
}
