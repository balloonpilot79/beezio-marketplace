import type { Handler } from '@netlify/functions';
import { createSupabaseAdmin } from './_lib/supabase';
import { assertPost, parseJson } from './_lib/http';
import { requireAdmin } from './_lib/auth';
import { round2, toAmountString } from './_lib/money';
import { resolveRequestedPayoutDate } from './_lib/payoutSchedule';

const responseJson = (statusCode: number, body: unknown) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

const responseCsv = (statusCode: number, csv: string, filename: string) => ({
  statusCode,
  headers: {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="${filename}"`,
  },
  body: csv,
});

type Body = {
  format?: 'paypal' | 'audit' | 'json';
  payout_date?: string;
  include_pending_hold?: boolean;
};

type LedgerRow = {
  id: string;
  order_id: string | null;
  seller_id: string | null;
  partner_id: string | null;
  influencer_id: string | null;
  seller_earnings: number;
  partner_earnings: number;
  influencer_earnings: number;
  status: string;
  hold_release_at: string;
  created_at: string | null;
  paid_at: string | null;
  gross_amount: number | null;
  beezio_profit: number | null;
  order_number: string | null;
  billing_name: string | null;
  billing_email: string | null;
  subtotal_listing: number | null;
  shipping_amount: number | null;
  tax_amount: number | null;
  total_charged: number | null;
};

type PayeeRole = 'SELLER' | 'PARTNER' | 'INFLUENCER';

type MoneyLedgerRow = {
  id: string;
  order_id: string | null;
  payee_type: string | null;
  payee_id: string | null;
  net_amount: number | null;
  status: string | null;
  payout_batch_id: string | null;
};

type PayoutLine = {
  ledger_id: string;
  order_id: string | null;
  payee_role: PayeeRole;
  payee_user_id: string;
  payee_name: string;
  payee_contact_email: string;
  payee_email: string;
  has_paypal_email: boolean;
  buyer_name: string | null;
  buyer_email: string | null;
  amount_usd: number;
  hold_release_at: string;
  ledger_created_at: string | null;
  order_number: string | null;
  order_tax_amount: number;
  order_shipping_amount: number;
  order_subtotal_listing: number;
  order_total_charged: number;
  seller_earnings: number;
  partner_earnings: number;
  influencer_earnings: number;
  gross_amount: number;
  beezio_profit: number;
  product_titles: string[];
  reference: string;
};

const csvEscape = (value: unknown) => {
  const text = String(value ?? '');
  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
};

const toCsv = (rows: Array<Record<string, unknown>>) => {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map((header) => csvEscape(row[header])).join(','));
  }
  return lines.join('\r\n');
};

export const handler: Handler = async (event) => {
  try {
    assertPost(event.httpMethod);
    await requireAdmin(event);

    const body = parseJson<Body>(event.body);
    const format = String(body?.format || 'json').toLowerCase();
    const { payoutDate, cutoffIso } = resolveRequestedPayoutDate(body?.payout_date);
    const includePendingHold = Boolean(body?.include_pending_hold) || format === 'audit';

    const supabaseAdmin = createSupabaseAdmin();
    const eligibleStatuses = includePendingHold ? ['READY_TO_PAY', 'PENDING_HOLD'] : ['READY_TO_PAY'];

    const { data: ledgerRows, error: ledgerError } = await supabaseAdmin
      .from('payout_ledger')
      .select('id, order_id, seller_id, partner_id, influencer_id, seller_earnings, partner_earnings, influencer_earnings, status, hold_release_at, created_at, paid_at, gross_amount, beezio_profit, orders(order_number, billing_name, billing_email, subtotal_listing, shipping_amount, tax_amount, total_charged)')
      .in('status', eligibleStatuses)
      .limit(5000);

    if (ledgerError) {
      return responseJson(500, { error: ledgerError.message });
    }

    const rows = ((ledgerRows as any as LedgerRow[]) || []).filter((row) => {
      const status = String(row.status || '').trim().toUpperCase();
      const holdReleaseAt = row.hold_release_at ? new Date(row.hold_release_at).getTime() : Number.NaN;
      const createdAt = row.created_at ? new Date(row.created_at).getTime() : Number.NaN;
      const cutoffTime = new Date(cutoffIso).getTime();

      if (status === 'READY_TO_PAY') {
        return Number.isFinite(holdReleaseAt) ? holdReleaseAt <= cutoffTime : true;
      }

      if (status === 'PENDING_HOLD' && includePendingHold) {
        return Number.isFinite(createdAt) ? createdAt <= cutoffTime : true;
      }

      return false;
    });

    if (!rows.length) {
      return responseJson(200, {
        ok: true,
        message: includePendingHold
          ? 'No payout rows matched this audit window yet.'
          : 'No payable rows after hold period.',
      });
    }

    const orderIds = Array.from(new Set(rows.map((row) => String(row.order_id || '').trim()).filter(Boolean)));

    const { data: orderRows } = orderIds.length
      ? await supabaseAdmin
          .from('orders')
          .select('id, order_number, billing_name, billing_email, tax_amount, shipping_amount, subtotal_listing, total_charged')
          .in('id', orderIds)
      : { data: [] as any[] };

    const orderMap = new Map<string, any>();
    for (const order of (orderRows as any[]) || []) {
      if (order?.id) orderMap.set(String(order.id), order);
    }

    const { data: snapshotRows } = orderIds.length
      ? await supabaseAdmin
          .from('payout_snapshots')
          .select('ledger_id, payee_user_id, payee_role, snapshot_json')
          .in('order_id', orderIds)
      : { data: [] as any[] };

    const snapshotMap = new Map<string, any>();
    for (const snapshot of (snapshotRows as any[]) || []) {
      const ledgerId = String(snapshot?.ledger_id || '').trim();
      const payeeUserId = String(snapshot?.payee_user_id || '').trim();
      const payeeRole = String(snapshot?.payee_role || '').trim().toUpperCase();
      if (!ledgerId || !payeeUserId || !payeeRole) continue;
      snapshotMap.set(`${ledgerId}::${payeeUserId}::${payeeRole}`, snapshot?.snapshot_json || {});
    }

    const { data: moneyLedgerRows } = orderIds.length
      ? await supabaseAdmin
          .from('order_money_ledger')
          .select('id, order_id, payee_type, payee_id, net_amount, status, payout_batch_id')
          .in('order_id', orderIds)
          .in('payee_type', ['seller', 'affiliate', 'influencer'])
          .eq('status', 'ready')
          .is('payout_batch_id', null)
      : { data: [] as any[] };

    const moneyLedgerEntriesByOrder = new Map<string, Array<{ moneyLedgerId: string; userId: string; role: PayeeRole; amount: number }>>();
    for (const row of ((moneyLedgerRows as any[]) || []) as MoneyLedgerRow[]) {
      const orderId = String(row.order_id || '').trim();
      const userId = String(row.payee_id || '').trim();
      const moneyLedgerId = String(row.id || '').trim();
      const amount = round2(Number(row.net_amount || 0));
      const payeeType = String(row.payee_type || '').trim().toLowerCase();
      const role: PayeeRole | null =
        payeeType === 'seller' ? 'SELLER' :
        payeeType === 'affiliate' ? 'PARTNER' :
        payeeType === 'influencer' ? 'INFLUENCER' :
        null;
      if (!orderId || !userId || !moneyLedgerId || !role || amount <= 0) continue;
      const current = moneyLedgerEntriesByOrder.get(orderId) || [];
      current.push({ moneyLedgerId, userId, role, amount });
      moneyLedgerEntriesByOrder.set(orderId, current);
    }

    const userIds = Array.from(
      new Set([
        ...rows
          .flatMap((row) => [row.seller_id, row.partner_id, row.influencer_id])
          .map((value) => String(value || '').trim())
          .filter(Boolean),
        ...Array.from(moneyLedgerEntriesByOrder.values()).flatMap((entries) => entries.map((entry) => entry.userId)),
      ])
    );

    const { data: accountRows } = userIds.length
      ? await supabaseAdmin
          .from('paypal_accounts')
          .select('user_id, role, paypal_email, is_verified')
          .in('user_id', userIds)
      : { data: [] as any[] };

    const { data: profileRows } = userIds.length
      ? await supabaseAdmin
          .from('profiles')
          .select('id, user_id, full_name, email')
          .or(userIds.map((id) => `id.eq.${id},user_id.eq.${id}`).join(','))
      : { data: [] as any[] };

    const accountMap = new Map<string, string>();
    for (const account of (accountRows as any[]) || []) {
      if (account?.is_verified !== true) continue;
      const userId = String(account?.user_id || '').trim();
      const role = String(account?.role || '').trim().toUpperCase();
      const email = String(account?.paypal_email || '').trim().toLowerCase();
      if (userId && role && email) accountMap.set(`${userId}::${role}`, email);
    }

    const profileMap = new Map<string, { name: string; email: string }>();
    for (const profile of (profileRows as any[]) || []) {
      const entry = {
        name: String(profile?.full_name || profile?.email || profile?.id || '').trim(),
        email: String(profile?.email || '').trim().toLowerCase(),
      };
      const id = String(profile?.id || '').trim();
      const userId = String(profile?.user_id || '').trim();
      if (id) profileMap.set(id, entry);
      if (userId) profileMap.set(userId, entry);
    }

    const payoutLines: PayoutLine[] = [];

    const addLine = (row: LedgerRow, role: PayeeRole, payeeUserId: string | null, amount: number, referenceSuffix?: string) => {
      const userId = String(payeeUserId || '').trim();
      const normalizedAmount = round2(Number(amount || 0));
      if (!userId || normalizedAmount <= 0) return;

      const payeeEmail = accountMap.get(`${userId}::${role}`) || '';
      const payeeProfile = profileMap.get(userId);
      const payeeName = String(payeeProfile?.name || payeeEmail || userId).trim();
      const payeeContactEmail = String(payeeProfile?.email || '').trim().toLowerCase();

      const order = row.order_id ? orderMap.get(String(row.order_id)) : null;
      const ledgerOrder = (row as any)?.orders || null;
      const orderRecord = order || ledgerOrder || null;
      const snapshot = snapshotMap.get(`${row.id}::${userId}::${role}`) || {};
      const snapshotItems = Array.isArray(snapshot?.items) ? snapshot.items : [];
      const productTitles = snapshotItems
        .map((item: any) => String(item?.product_title || '').trim())
        .filter(Boolean);
      const reference = `BZO-${row.id}-${role}-${referenceSuffix || userId}`;

      payoutLines.push({
        ledger_id: row.id,
        order_id: row.order_id,
        payee_role: role,
        payee_user_id: userId,
        payee_name: payeeName,
        payee_contact_email: payeeContactEmail,
        payee_email: payeeEmail,
        has_paypal_email: Boolean(payeeEmail),
        buyer_name: String(orderRecord?.billing_name || '').trim() || null,
        buyer_email: String(orderRecord?.billing_email || '').trim() || null,
        amount_usd: normalizedAmount,
        hold_release_at: row.hold_release_at,
        ledger_created_at: row.created_at,
        order_number: String(orderRecord?.order_number || '').trim() || null,
        order_tax_amount: round2(Number(orderRecord?.tax_amount || 0)),
        order_shipping_amount: round2(Number(orderRecord?.shipping_amount || 0)),
        order_subtotal_listing: round2(Number(orderRecord?.subtotal_listing || 0)),
        order_total_charged: round2(Number(orderRecord?.total_charged || 0)),
        seller_earnings: round2(Number(row.seller_earnings || 0)),
        partner_earnings: round2(Number(row.partner_earnings || 0)),
        influencer_earnings: round2(Number(row.influencer_earnings || 0)),
        gross_amount: round2(Number(row.gross_amount || 0)),
        beezio_profit: round2(Number(row.beezio_profit || 0)),
        product_titles: productTitles,
        reference,
      });
    };

    for (const row of rows) {
      const orderId = String(row.order_id || '').trim();
      const itemizedEntries = orderId ? (moneyLedgerEntriesByOrder.get(orderId) || []) : [];
      if (itemizedEntries.length) {
        for (const entry of itemizedEntries) {
          addLine(row, entry.role, entry.userId, entry.amount, entry.moneyLedgerId);
        }
        continue;
      }
      addLine(row, 'SELLER', row.seller_id, row.seller_earnings);
      addLine(row, 'PARTNER', row.partner_id, row.partner_earnings);
      addLine(row, 'INFLUENCER', row.influencer_id, row.influencer_earnings);
    }

    if (!payoutLines.length) {
      return responseJson(200, { ok: true, message: 'No payout rows matched this export window.' });
    }

    const payableLines = payoutLines.filter((line) => line.has_paypal_email);

    const grouped = new Map<string, { email: string; roles: Set<string>; total: number; line_count: number; references: string[] }>();
    for (const line of payableLines) {
      const key = line.payee_email;
      const current = grouped.get(key) || {
        email: line.payee_email,
        roles: new Set<string>(),
        total: 0,
        line_count: 0,
        references: [],
      };
      current.roles.add(line.payee_role);
      current.total = round2(current.total + line.amount_usd);
      current.line_count += 1;
      if (current.references.length < 5) current.references.push(line.reference);
      grouped.set(key, current);
    }

    const paypalUploadRows = Array.from(grouped.values())
      .sort((a, b) => b.total - a.total)
      .map((row, index) => {
        const roles = Array.from(row.roles).sort();
        return {
          recipient_type: 'EMAIL',
          receiver: row.email,
          amount: toAmountString(row.total),
          currency: 'USD',
          note: `Beezio payday ${payoutDate} ${roles.join('/')} ${row.references.slice(0, 2).join(' ')}`.trim(),
          sender_item_id: `BZO-${payoutDate.replace(/-/g, '')}-${String(index + 1).padStart(4, '0')}`,
          recipient_wallet: 'PAYPAL',
        };
      });

    if (format === 'paypal') {
      if (!paypalUploadRows.length) {
        return responseJson(200, { ok: true, message: 'No payable rows with configured PayPal recipient emails.' });
      }
      const csv = toCsv(paypalUploadRows);
      return responseCsv(200, csv, `beezio-paypal-manual-payout-${payoutDate}.csv`);
    }

    if (format === 'audit') {
      const csv = toCsv(
        payoutLines.map((line) => ({
          reference: line.reference,
          ledger_id: line.ledger_id,
          order_id: line.order_id || '',
          order_number: line.order_number || '',
          payee_role: line.payee_role,
          payee_user_id: line.payee_user_id,
          payee_name: line.payee_name,
          payee_contact_email: line.payee_contact_email,
          payee_email: line.payee_email,
          has_paypal_email: line.has_paypal_email ? 'yes' : 'no',
          buyer_name: line.buyer_name || '',
          buyer_email: line.buyer_email || '',
          amount_usd: toAmountString(line.amount_usd),
          hold_release_at: line.hold_release_at,
          ledger_created_at: line.ledger_created_at || '',
          order_tax_amount: toAmountString(line.order_tax_amount),
          order_shipping_amount: toAmountString(line.order_shipping_amount),
          order_subtotal_listing: toAmountString(line.order_subtotal_listing),
          order_total_charged: toAmountString(line.order_total_charged),
          seller_earnings: toAmountString(line.seller_earnings),
          partner_earnings: toAmountString(line.partner_earnings),
          influencer_earnings: toAmountString(line.influencer_earnings),
          gross_amount: toAmountString(line.gross_amount),
          beezio_profit: toAmountString(line.beezio_profit),
          product_titles: line.product_titles.join(' | '),
        }))
      );
      return responseCsv(200, csv, `beezio-payday-audit-${payoutDate}.csv`);
    }

    return responseJson(200, {
      ok: true,
      generated_at: new Date().toISOString(),
      payout_date: payoutDate,
      cutoff_iso: cutoffIso,
      included_pending_hold: includePendingHold,
      payable_ledger_rows: rows.length,
      payout_line_count: payoutLines.length,
      payout_line_count_ready_for_paypal: payableLines.length,
      payout_line_count_missing_paypal_email: payoutLines.length - payableLines.length,
      payee_count: paypalUploadRows.length,
      total_payout_amount: round2(payoutLines.reduce((acc, line) => acc + line.amount_usd, 0)),
      paypal_upload_rows: paypalUploadRows,
      payout_lines: payoutLines,
    });
  } catch (e: any) {
    const statusCode = Number(e?.statusCode) || 500;
    return responseJson(statusCode, { error: e instanceof Error ? e.message : 'Unexpected error' });
  }
};

export default handler;
