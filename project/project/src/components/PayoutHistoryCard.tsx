import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContextMultiRole';
import { ensureProfileIdForUser } from '../utils/resolveProfileId';

type PayeeRole = 'SELLER' | 'PARTNER' | 'INFLUENCER';

type LedgerRow = {
  id: string;
  order_id: string | null;
  ledger_id?: string | null;
  status: string;
  hold_release_at: string | null;
  paid_at: string | null;
  amount: number | null;
  gross_amount: number | null;
  created_at?: string | null;
  snapshot_json?: {
    order_number?: string | null;
    total_charged?: number | null;
    items?: Array<{ product_title?: string | null }>;
  } | null;
};

type PayoutItemRow = {
  id: string;
  ledger_id: string | null;
  recipient: string;
  amount: number;
  status: string;
  payee_role: PayeeRole | null;
  provider_item_id: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

function formatMoney(amount: number) {
  return amount.toLocaleString(undefined, { style: 'currency', currency: 'USD' });
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString();
}

function formatReference(row: LedgerRow) {
  const orderNumber = String(row.snapshot_json?.order_number || '').trim();
  if (orderNumber) return orderNumber;
  if (row.order_id) return row.order_id;
  return '-';
}

function formatProducts(row: LedgerRow) {
  const items = Array.isArray(row.snapshot_json?.items) ? row.snapshot_json?.items : [];
  const titles = items
    .map((item) => String(item?.product_title || '').trim())
    .filter(Boolean);
  if (!titles.length) return '-';
  return titles.slice(0, 2).join(', ');
}

export default function PayoutHistoryCard({
  role,
  title = 'Payout History',
  description = 'Track holds, ready-to-pay amounts, and completed transfers.',
}: {
  role: PayeeRole;
  title?: string;
  description?: string;
}) {
  const { user, profile } = useAuth();
  const [profileId, setProfileId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [items, setItems] = useState<PayoutItemRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const u = user || undefined;
      const pid = String((profile as any)?.id || '').trim();
      if (pid) {
        if (!cancelled) setProfileId(pid);
        return;
      }
      if (!u) return;
      const resolved = await ensureProfileIdForUser(u as any);
      if (!cancelled) setProfileId(String(resolved || u.id));
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, (profile as any)?.id]);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      if (!profileId) return;
      setLoading(true);
      setError(null);

      try {
        const { data: ledgerRows, error: ledgerError } = await supabase
          .from('payout_snapshots')
          .select('id, order_id, ledger_id, status, hold_release_at, paid_at, amount, created_at, snapshot_json')
          .eq('payee_user_id', profileId)
          .eq('payee_role', role)
          .order('created_at', { ascending: false })
          .limit(50);

        if (ledgerError) throw ledgerError;

        const { data: payoutItems, error: itemsError } = await supabase
          .from('payout_items')
          .select('id, ledger_id, recipient, amount, status, payee_role, provider_item_id, error_message, created_at, updated_at')
          .eq('payee_user_id', profileId)
          .eq('payee_role', role)
          .order('created_at', { ascending: false })
          .limit(50);

        if (itemsError) throw itemsError;

        if (!alive) return;
        setLedger((ledgerRows as any[]) as LedgerRow[]);
        setItems((payoutItems as any[]) as PayoutItemRow[]);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message || 'Failed to load payout history');
      } finally {
        if (alive) setLoading(false);
      }
    };

    void load();
    return () => {
      alive = false;
    };
  }, [profileId, role]);

  const ledgerAmountForRole = (row: LedgerRow) => Number(row.amount || 0);

  const upcoming = useMemo(() => ledger.filter((r) => String(r.status) !== 'PAID'), [ledger]);
  const paidLedgers = useMemo(() => ledger.filter((r) => String(r.status) === 'PAID'), [ledger]);
  const readyToPay = useMemo(
    () => ledger.filter((r) => String(r.status).toUpperCase() === 'READY_TO_PAY'),
    [ledger]
  );
  const pendingHold = useMemo(
    () => ledger.filter((r) => String(r.status).toUpperCase() === 'PENDING_HOLD'),
    [ledger]
  );
  const onHoldDispute = useMemo(
    () => ledger.filter((r) => String(r.status).toUpperCase() === 'ON_HOLD_DISPUTE'),
    [ledger]
  );

  const nextPayoutDate = useMemo(() => {
    const candidates = upcoming
      .map((r) => r.hold_release_at)
      .filter(Boolean)
      .map((iso) => new Date(String(iso)))
      .filter((d) => !Number.isNaN(d.getTime()))
      .sort((a, b) => a.getTime() - b.getTime());
    return candidates.length ? candidates[0].toISOString() : null;
  }, [upcoming]);

  const realTimeStatus = useMemo(() => {
    const readyAmount = readyToPay.reduce((sum, row) => sum + ledgerAmountForRole(row), 0);
    const pendingAmount = pendingHold.reduce((sum, row) => sum + ledgerAmountForRole(row), 0);
    const onHoldAmount = onHoldDispute.reduce((sum, row) => sum + ledgerAmountForRole(row), 0);
    const paidAmount = paidLedgers.reduce((sum, row) => sum + ledgerAmountForRole(row), 0);
    return { readyAmount, pendingAmount, onHoldAmount, paidAmount };
  }, [onHoldDispute, paidLedgers, pendingHold, readyToPay]);

  const handleDownloadStatement = () => {
    const rows: string[] = [];
    rows.push('type,id,status,amount,hold_release_at,paid_at,recipient,updated_at');

    ledger.forEach((row) => {
      rows.push(
        [
          'ledger',
          row.id,
          row.status,
          ledgerAmountForRole(row).toFixed(2),
          row.hold_release_at || '',
          row.paid_at || '',
          '',
          row.created_at || '',
        ]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(',')
      );
    });

    items.forEach((row) => {
      rows.push(
        [
          'transfer',
          row.id,
          row.status,
          Number(row.amount || 0).toFixed(2),
          '',
          '',
          row.recipient || '',
          row.updated_at || '',
        ]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(',')
      );
    });

    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `beezio-${role.toLowerCase()}-earnings-statement.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };

  return (
    <div className="bg-white border rounded-xl p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-lg font-semibold text-gray-900">{title}</div>
          <div className="text-sm text-gray-600 mt-1">{description}</div>
        </div>
        <button
          type="button"
          onClick={handleDownloadStatement}
          className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
        >
          Download Statement
        </button>
      </div>

      {loading ? <div className="mt-4 text-sm text-gray-600">Loading...</div> : null}
      {error ? <div className="mt-4 text-sm text-red-700">{error}</div> : null}

      {!loading && !error ? (
        <div className="mt-5 space-y-6">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
              <div className="text-xs uppercase text-gray-500">Pending</div>
              <div className="mt-1 text-sm font-semibold text-gray-900">{formatMoney(realTimeStatus.pendingAmount)}</div>
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
              <div className="text-xs uppercase text-gray-500">On Hold</div>
              <div className="mt-1 text-sm font-semibold text-gray-900">{formatMoney(realTimeStatus.onHoldAmount)}</div>
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
              <div className="text-xs uppercase text-gray-500">Available</div>
              <div className="mt-1 text-sm font-semibold text-gray-900">{formatMoney(realTimeStatus.readyAmount)}</div>
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
              <div className="text-xs uppercase text-gray-500">Paid</div>
              <div className="mt-1 text-sm font-semibold text-gray-900">{formatMoney(realTimeStatus.paidAmount)}</div>
              <div className="mt-1 text-xs text-gray-500">Next release {formatDate(nextPayoutDate)}</div>
            </div>
          </div>

          <div>
            <div className="text-sm font-semibold text-gray-800">Upcoming / On Hold</div>
            <div className="mt-2 overflow-x-auto border rounded-lg">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="px-3 py-2 text-left">Reference</th>
                    <th className="px-3 py-2 text-left">Ledger</th>
                    <th className="px-3 py-2 text-left">Status</th>
                    <th className="px-3 py-2 text-right">Amount</th>
                    <th className="px-3 py-2 text-right">Gross</th>
                    <th className="px-3 py-2 text-left">Hold Release</th>
                  </tr>
                </thead>
                <tbody>
                  {upcoming.length === 0 ? (
                    <tr>
                      <td className="px-3 py-4 text-gray-500" colSpan={6}>
                        No upcoming payouts.
                      </td>
                    </tr>
                  ) : (
                    upcoming.map((r) => (
                      <tr key={r.id} className="border-t">
                        <td className="px-3 py-2">
                          <div className="font-mono text-xs">{formatReference(r)}</div>
                          <div className="text-xs text-gray-500">{formatProducts(r)}</div>
                        </td>
                        <td className="px-3 py-2 font-mono text-xs">{r.ledger_id || r.id}</td>
                        <td className="px-3 py-2">{r.status}</td>
                        <td className="px-3 py-2 text-right">{formatMoney(ledgerAmountForRole(r))}</td>
                        <td className="px-3 py-2 text-right">{formatMoney(Number(r.snapshot_json?.total_charged || 0))}</td>
                        <td className="px-3 py-2 text-gray-700">{formatDate(r.hold_release_at)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <div className="text-sm font-semibold text-gray-800">Paid Orders</div>
            <div className="mt-2 overflow-x-auto border rounded-lg">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="px-3 py-2 text-left">Reference</th>
                    <th className="px-3 py-2 text-left">Ledger</th>
                    <th className="px-3 py-2 text-right">Amount</th>
                    <th className="px-3 py-2 text-right">Gross</th>
                    <th className="px-3 py-2 text-left">Paid At</th>
                  </tr>
                </thead>
                <tbody>
                  {paidLedgers.length === 0 ? (
                    <tr>
                      <td className="px-3 py-4 text-gray-500" colSpan={5}>
                        No paid ledger rows yet.
                      </td>
                    </tr>
                  ) : (
                    paidLedgers.map((r) => (
                      <tr key={r.id} className="border-t">
                        <td className="px-3 py-2">
                          <div className="font-mono text-xs">{formatReference(r)}</div>
                          <div className="text-xs text-gray-500">{formatProducts(r)}</div>
                        </td>
                        <td className="px-3 py-2 font-mono text-xs">{r.ledger_id || r.id}</td>
                        <td className="px-3 py-2 text-right">{formatMoney(ledgerAmountForRole(r))}</td>
                        <td className="px-3 py-2 text-right">{formatMoney(Number(r.snapshot_json?.total_charged || 0))}</td>
                        <td className="px-3 py-2 text-gray-700">{formatDate(r.paid_at)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <div className="text-sm font-semibold text-gray-800">Transfers</div>
            <div className="mt-2 overflow-x-auto border rounded-lg">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="px-3 py-2 text-left">Payout Item</th>
                    <th className="px-3 py-2 text-left">Status</th>
                    <th className="px-3 py-2 text-right">Amount</th>
                    <th className="px-3 py-2 text-left">Recipient</th>
                    <th className="px-3 py-2 text-left">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr>
                      <td className="px-3 py-4 text-gray-500" colSpan={5}>
                        No transfers yet.
                      </td>
                    </tr>
                  ) : (
                    items.map((it) => (
                      <tr key={it.id} className="border-t">
                        <td className="px-3 py-2">
                          <div className="font-mono text-xs">{it.id}</div>
                          {it.error_message ? <div className="text-xs text-red-700">{it.error_message}</div> : null}
                        </td>
                        <td className="px-3 py-2">{it.status}</td>
                        <td className="px-3 py-2 text-right">{formatMoney(Number(it.amount || 0))}</td>
                        <td className="px-3 py-2">{it.recipient}</td>
                        <td className="px-3 py-2 text-gray-700">{formatDate(it.updated_at)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {paidLedgers.length ? (
              <div className="mt-2 text-xs text-gray-500">
                Note: ledger rows show order or insurance-lead payout status; transfers show completed payout transfers.
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
