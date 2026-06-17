import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';

type AdminUserOverview = {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  role: string;
  primary_role: string;
  username: string;
  store_name: string;
  created_at: string | null;
  recruited_by_influencer_id?: string;
  influencer_relationships?: Array<{
    role: 'profile_default' | 'seller' | 'affiliate';
    influencer_id: string;
    influencer_name: string;
    influencer_email: string;
  }>;
  paypal_accounts: Array<{ role: string; paypal_email: string }>;
  selling_products: Array<{
    id: string;
    title: string;
    price: number;
    created_at: string | null;
    is_active: boolean;
    is_promotable: boolean;
  }>;
};

type AdminUserOverviewResponse = {
  ok: boolean;
  count: number;
  users: AdminUserOverview[];
};

type SalesLedgerRow = {
  order_id: string;
  order_number: string | null;
  created_at: string | null;
  order_status: string;
  payment_status: string;
  fulfillment_status: string;
  buyer_name: string;
  buyer_email: string;
  products: string[];
  seller: { id: string | null; name: string; email: string; paypal_email?: string; amount: number };
  affiliate: { id: string | null; name: string; email: string; paypal_email?: string; amount: number };
  influencer: { id: string | null; name: string; email: string; paypal_email?: string; amount: number };
  influencers?: Array<{ id: string | null; name: string; email: string; paypal_email?: string; amount: number }>;
  gross_sales: number;
  payout_status: string;
  hold_release_at: string | null;
};

type AdminSalesLedgerResponse = {
  ok: boolean;
  rows: SalesLedgerRow[];
};

type AdminModerationRecord = {
  id: string;
  user_id: string;
  action_type: 'warning' | 'suspension' | 'ban' | 'restriction';
  reason: string;
  notes: string;
  duration_days: number | null;
  restrictions: Record<string, unknown> | null;
  is_active: boolean;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  applied_by: string;
  revoked_by: string;
};

type AdminActivityRecord = {
  source: 'moderation_log' | 'audit_log';
  id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  reason: string;
  details: Record<string, unknown> | null;
  actor_user_id: string;
  created_at: string | null;
};

type AdminUserModerationResponse = {
  ok: boolean;
  target_user_id?: string | null;
  moderation: AdminModerationRecord[];
  active_restrictions: AdminModerationRecord[];
  activity: AdminActivityRecord[];
  error?: string;
};

type UserHistoryLine = {
  orderId: string;
  orderNumber: string | null;
  createdAt: string | null;
  role: 'seller' | 'affiliate' | 'influencer';
  amount: number;
  payoutStatus: string;
  scheduledPayDate: string;
  holdReleaseAt: string | null;
  buyerName: string;
  buyerEmail: string;
  products: string[];
  grossSales: number;
  orderStatus: string;
  paymentStatus: string;
  fulfillmentStatus: string;
};

type UserPanel = {
  key: string;
  id: string;
  userId: string;
  displayName: string;
  email: string;
  role: string;
  primaryRole: string;
  username: string;
  storeName: string;
  createdAt: string | null;
  recruitedByInfluencerId: string;
  influencerRelationships: NonNullable<AdminUserOverview['influencer_relationships']>;
  paypalEmails: string[];
  sellingProducts: AdminUserOverview['selling_products'];
  totals: Record<'seller' | 'affiliate' | 'influencer', number>;
  lines: UserHistoryLine[];
};

const csvEscape = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;

const pad2 = (value: number) => String(value).padStart(2, '0');

const getLastDayOfMonth = (year: number, month: number) => new Date(year, month, 0).getDate();

const getScheduledPaydayOnOrAfter = (eligibleAt: string | null | undefined) => {
  const date = eligibleAt ? new Date(eligibleAt) : new Date();
  if (Number.isNaN(date.getTime())) return '-';
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const lastDay = getLastDayOfMonth(year, month);
  if (day <= 15) return `${year}-${pad2(month)}-15`;
  if (day <= lastDay) return `${year}-${pad2(month)}-${pad2(lastDay)}`;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  return `${nextYear}-${pad2(nextMonth)}-15`;
};

const formatCurrency = (value: number | null | undefined) => `$${Number(value || 0).toFixed(2)}`;

const formatDateTime = (value: string | null | undefined) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString();
};

const moderationActionLabel = (value: string | null | undefined) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'ban') return 'Permanent Ban';
  if (normalized === 'suspension') return 'Suspension';
  if (normalized === 'restriction') return 'Restriction';
  if (normalized === 'warning') return 'Warning';
  return normalized || 'unknown';
};

const moderationBadgeClass = (value: string | null | undefined, active = true) => {
  if (!active) return 'border-gray-200 bg-gray-100 text-gray-600';
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'ban') return 'border-red-200 bg-red-100 text-red-800';
  if (normalized === 'suspension') return 'border-amber-200 bg-amber-100 text-amber-900';
  if (normalized === 'restriction') return 'border-violet-200 bg-violet-100 text-violet-800';
  return 'border-blue-200 bg-blue-100 text-blue-800';
};

const isModerationActive = (record: AdminModerationRecord) => {
  if (!record.is_active) return false;
  if (!record.expires_at) return true;
  return new Date(record.expires_at).getTime() > Date.now();
};

const normalizeRole = (value: string | null | undefined) => {
  const role = String(value || '').trim().toLowerCase();
  return role === 'partner' ? 'affiliate' : role || 'unknown';
};

const escapeHtml = (value: unknown) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const slugifyFileSegment = (value: string) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'user';

const roleReceiptTitle = (role: 'seller' | 'affiliate' | 'influencer') => {
  if (role === 'seller') return 'Seller Receipt';
  if (role === 'affiliate') return 'Affiliate Receipt';
  return 'Influencer Receipt';
};

const formatPaydayLabel = (value: string) => {
  if (!value || value === '-') return 'Unscheduled Payday';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
};

const influencerRelationshipLabel = (value: 'profile_default' | 'seller' | 'affiliate') => {
  if (value === 'seller') return 'Seller recruiter';
  if (value === 'affiliate') return 'Affiliate recruiter';
  return 'Default recruiter';
};

const createEmptyPanel = (user: AdminUserOverview): UserPanel => ({
  key: user.id || user.user_id,
  id: user.id || user.user_id,
  userId: user.user_id || user.id,
  displayName: user.full_name || user.store_name || user.username || user.email || user.id,
  email: user.email || '',
  role: normalizeRole(user.role),
  primaryRole: normalizeRole(user.primary_role),
  username: user.username || '',
  storeName: user.store_name || '',
  createdAt: user.created_at,
  recruitedByInfluencerId: String(user.recruited_by_influencer_id || '').trim(),
  influencerRelationships: Array.isArray(user.influencer_relationships) ? user.influencer_relationships : [],
  paypalEmails: user.paypal_accounts.map((entry) => entry.paypal_email),
  sellingProducts: user.selling_products || [],
  totals: { seller: 0, affiliate: 0, influencer: 0 },
  lines: [],
});

export default function AdminUsersPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [userSort, setUserSort] = useState<'earnings' | 'alphabet' | 'email'>('alphabet');
  const [directoryLetter, setDirectoryLetter] = useState<string>('all');
  const [users, setUsers] = useState<AdminUserOverview[]>([]);
  const [salesLedger, setSalesLedger] = useState<SalesLedgerRow[]>([]);
  const [selectedUserKey, setSelectedUserKey] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [moderationLoading, setModerationLoading] = useState(false);
  const [moderationError, setModerationError] = useState<string | null>(null);
  const [moderationStatus, setModerationStatus] = useState<string | null>(null);
  const [moderationRecords, setModerationRecords] = useState<AdminModerationRecord[]>([]);
  const [moderationActivity, setModerationActivity] = useState<AdminActivityRecord[]>([]);
  const [moderationActionType, setModerationActionType] = useState<'warning' | 'suspension' | 'ban' | 'restriction'>('suspension');
  const [moderationReason, setModerationReason] = useState('');
  const [moderationNotes, setModerationNotes] = useState('');
  const [moderationDurationDays, setModerationDurationDays] = useState('14');
  const [moderationActionLoading, setModerationActionLoading] = useState<string | null>(null);

  const getAccessToken = async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) throw new Error('Not authenticated');
    return token;
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const token = await getAccessToken();

        const [usersRes, ledgerRes] = await Promise.all([
          fetch('/api/admin/users-overview', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ limit: 3000 }),
          }),
          fetch('/api/admin/sales-ledger', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ limit: 5000 }),
          }),
        ]);

        const usersPayload = (await usersRes.json().catch(() => ({}))) as AdminUserOverviewResponse & { error?: string };
        const ledgerPayload = (await ledgerRes.json().catch(() => ({}))) as AdminSalesLedgerResponse & { error?: string };

        if (!usersRes.ok) throw new Error(usersPayload.error || 'Failed to load admin users');
        if (!ledgerRes.ok) throw new Error(ledgerPayload.error || 'Failed to load sales ledger');

        setUsers(Array.isArray(usersPayload.users) ? usersPayload.users : []);
        setSalesLedger(Array.isArray(ledgerPayload.rows) ? ledgerPayload.rows : []);
      } catch (err: any) {
        setError(err?.message || 'Failed to load admin users page');
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const userPanels = useMemo(() => {
    const panels = new Map<string, UserPanel>();

    const ensurePanel = (seed: Partial<AdminUserOverview> & { id: string; user_id?: string; full_name?: string; email?: string }) => {
      const key = seed.id || seed.user_id || seed.email || seed.full_name || 'unknown';
      if (!panels.has(key)) {
        panels.set(
          key,
          createEmptyPanel({
            id: seed.id,
            user_id: seed.user_id || seed.id,
            full_name: seed.full_name || '',
            email: seed.email || '',
            role: String(seed.role || ''),
            primary_role: String(seed.primary_role || ''),
            username: String(seed.username || ''),
            store_name: String(seed.store_name || ''),
            created_at: seed.created_at || null,
            recruited_by_influencer_id: String((seed as any).recruited_by_influencer_id || ''),
            influencer_relationships: Array.isArray((seed as any).influencer_relationships) ? (seed as any).influencer_relationships : [],
            paypal_accounts: [],
            selling_products: [],
          })
        );
      }
      return panels.get(key)!;
    };

    users.forEach((user) => {
      panels.set(user.id || user.user_id, createEmptyPanel(user));
    });

    const attachLine = (seed: { id: string | null; name: string; email?: string; paypal_email?: string }, row: SalesLedgerRow, role: 'seller' | 'affiliate' | 'influencer', amount: number) => {
      const key = String(seed.id || '').trim();
      if (!key || amount <= 0) return;
      const panel = ensurePanel({ id: key, user_id: key, full_name: seed.name, email: seed.email || '' });
      if (seed.paypal_email && !panel.paypalEmails.includes(seed.paypal_email)) panel.paypalEmails.push(seed.paypal_email);
      panel.totals[role] += amount;
      panel.lines.push({
        orderId: row.order_id,
        orderNumber: row.order_number,
        createdAt: row.created_at,
        role,
        amount,
        payoutStatus: row.payout_status,
        scheduledPayDate: getScheduledPaydayOnOrAfter(row.hold_release_at || row.created_at),
        holdReleaseAt: row.hold_release_at,
        buyerName: row.buyer_name,
        buyerEmail: row.buyer_email,
        products: row.products,
        grossSales: Number(row.gross_sales || 0),
        orderStatus: row.order_status,
        paymentStatus: row.payment_status,
        fulfillmentStatus: row.fulfillment_status,
      });
    };

    salesLedger.forEach((row) => {
      attachLine(row.seller, row, 'seller', Number(row.seller.amount || 0));
      attachLine(row.affiliate, row, 'affiliate', Number(row.affiliate.amount || 0));
      (row.influencers && row.influencers.length ? row.influencers : [row.influencer])
        .filter((entry) => Number(entry?.amount || 0) > 0)
        .forEach((entry) => attachLine(entry, row, 'influencer', Number(entry.amount || 0)));
    });

    return Array.from(panels.values())
      .map((panel) => ({
        ...panel,
        paypalEmails: Array.from(new Set(panel.paypalEmails.filter(Boolean))),
        lines: [...panel.lines].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()),
      }));
  }, [salesLedger, users]);

  const filteredPanels = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const letterFiltered = userPanels.filter((panel) => {
      if (directoryLetter === 'all') return true;
      const anchor = String(panel.displayName || panel.email || panel.username || '').trim().charAt(0).toUpperCase();
      return anchor === directoryLetter;
    });

    const searchedPanels = !needle ? letterFiltered : letterFiltered.filter((panel) => {
      const haystack = [
        panel.displayName,
        panel.email,
        panel.role,
        panel.primaryRole,
        panel.username,
        panel.storeName,
        panel.recruitedByInfluencerId,
        ...panel.paypalEmails,
        ...panel.influencerRelationships.flatMap((relationship) => [
          relationship.role,
          relationship.influencer_id,
          relationship.influencer_name,
          relationship.influencer_email,
        ]),
        ...panel.sellingProducts.flatMap((product) => [product.title, product.id]),
        ...panel.lines.flatMap((line) => [line.orderId, line.orderNumber, line.buyerName, line.buyerEmail, ...line.products]),
      ]
        .map((value) => String(value || '').toLowerCase())
        .filter(Boolean);
      return haystack.some((value) => value.includes(needle));
    });

    return [...searchedPanels].sort((a, b) => {
      const totalA = a.totals.seller + a.totals.affiliate + a.totals.influencer;
      const totalB = b.totals.seller + b.totals.affiliate + b.totals.influencer;
      if (userSort === 'earnings') {
        if (totalB !== totalA) return totalB - totalA;
        return a.displayName.localeCompare(b.displayName);
      }
      if (userSort === 'email') {
        return String(a.email || a.displayName || '').localeCompare(String(b.email || b.displayName || ''));
      }
      return a.displayName.localeCompare(b.displayName);
    });
  }, [directoryLetter, search, userPanels, userSort]);

  const directoryLetters = useMemo(() => {
    const letters = new Set<string>();
    userPanels.forEach((panel) => {
      const anchor = String(panel.displayName || panel.email || panel.username || '').trim().charAt(0).toUpperCase();
      if (/^[A-Z]$/.test(anchor)) letters.add(anchor);
    });
    return Array.from(letters).sort();
  }, [userPanels]);

  const selectedUser = useMemo(
    () => filteredPanels.find((panel) => panel.key === selectedUserKey) || filteredPanels[0] || null,
    [filteredPanels, selectedUserKey]
  );

  useEffect(() => {
    if (!filteredPanels.length) {
      setSelectedUserKey(null);
      return;
    }
    if (!selectedUserKey || !filteredPanels.some((panel) => panel.key === selectedUserKey)) {
      setSelectedUserKey(filteredPanels[0].key);
    }
  }, [filteredPanels, selectedUserKey]);

  useEffect(() => {
    setCollapsedGroups({});
  }, [selectedUserKey]);

  useEffect(() => {
    const loadModeration = async () => {
      if (!selectedUser?.userId) {
        setModerationRecords([]);
        setModerationActivity([]);
        setModerationError(null);
        return;
      }

      setModerationLoading(true);
      setModerationError(null);

      try {
        const token = await getAccessToken();
        const response = await fetch('/api/admin/user-moderation', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ action: 'list', target_user_id: selectedUser.userId, limit: 24 }),
        });

        const payload = (await response.json().catch(() => ({}))) as AdminUserModerationResponse;
        if (!response.ok) throw new Error(payload.error || 'Failed to load account controls');

        setModerationRecords(Array.isArray(payload.moderation) ? payload.moderation : []);
        setModerationActivity(Array.isArray(payload.activity) ? payload.activity : []);
      } catch (err: any) {
        setModerationError(err?.message || 'Failed to load account controls');
      } finally {
        setModerationLoading(false);
      }
    };

    void loadModeration();
  }, [selectedUser?.userId]);

  const roleSections = useMemo(() => {
    if (!selectedUser) return { seller: [], affiliate: [], influencer: [] } as Record<'seller' | 'affiliate' | 'influencer', UserHistoryLine[]>;
    return {
      seller: selectedUser.lines.filter((line) => line.role === 'seller'),
      affiliate: selectedUser.lines.filter((line) => line.role === 'affiliate'),
      influencer: selectedUser.lines.filter((line) => line.role === 'influencer'),
    };
  }, [selectedUser]);

  const activeRestrictions = useMemo(
    () => moderationRecords.filter((record) => isModerationActive(record) && record.action_type !== 'warning'),
    [moderationRecords]
  );

  const directorySummary = useMemo(() => {
    const totals = filteredPanels.reduce(
      (acc, panel) => {
        const recorded = panel.totals.seller + panel.totals.affiliate + panel.totals.influencer;
        acc.recordedLifetime += recorded;
        if (panel.sellingProducts.length > 0) acc.sellerAccounts += 1;
        if (panel.lines.length > 0) acc.usersWithLedger += 1;
        return acc;
      },
      { recordedLifetime: 0, sellerAccounts: 0, usersWithLedger: 0 }
    );

    return {
      ...totals,
      totalUsers: filteredPanels.length,
    };
  }, [filteredPanels]);

  const submitModerationAction = async () => {
    if (!selectedUser?.userId) return;
    if (!moderationReason.trim()) {
      setModerationError('Reason is required for an account control action.');
      return;
    }

    setModerationActionLoading('apply');
    setModerationError(null);
    setModerationStatus(null);

    try {
      const token = await getAccessToken();
      const response = await fetch('/api/admin/user-moderation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: 'apply',
          target_user_id: selectedUser.userId,
          action_type: moderationActionType,
          reason: moderationReason.trim(),
          notes: moderationNotes.trim(),
          duration_days: moderationActionType === 'suspension' ? Number(moderationDurationDays || 0) : null,
          restrictions:
            moderationActionType === 'restriction'
              ? {
                  cannot_payout: true,
                  cannot_list_products: true,
                  requires_admin_review: true,
                }
              : null,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!response.ok) throw new Error(payload.error || 'Failed to save account control action');

      setModerationReason('');
      setModerationNotes('');
      setModerationDurationDays('14');
      setModerationStatus(`${moderationActionLabel(moderationActionType)} saved for ${selectedUser.displayName}.`);

      const refreshResponse = await fetch('/api/admin/user-moderation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: 'list', target_user_id: selectedUser.userId, limit: 24 }),
      });
      const refreshPayload = (await refreshResponse.json().catch(() => ({}))) as AdminUserModerationResponse;
      if (refreshResponse.ok) {
        setModerationRecords(Array.isArray(refreshPayload.moderation) ? refreshPayload.moderation : []);
        setModerationActivity(Array.isArray(refreshPayload.activity) ? refreshPayload.activity : []);
      }
    } catch (err: any) {
      setModerationError(err?.message || 'Failed to save account control action');
    } finally {
      setModerationActionLoading(null);
    }
  };

  const revokeModerationAction = async (moderationId: string) => {
    if (!selectedUser?.userId || !moderationId) return;
    setModerationActionLoading(`revoke:${moderationId}`);
    setModerationError(null);
    setModerationStatus(null);

    try {
      const token = await getAccessToken();
      const response = await fetch('/api/admin/user-moderation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: 'revoke', moderation_id: moderationId }),
      });
      const payload = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!response.ok) throw new Error(payload.error || 'Failed to revoke account control');

      setModerationStatus(`Removed active restriction from ${selectedUser.displayName}.`);

      const refreshResponse = await fetch('/api/admin/user-moderation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: 'list', target_user_id: selectedUser.userId, limit: 24 }),
      });
      const refreshPayload = (await refreshResponse.json().catch(() => ({}))) as AdminUserModerationResponse;
      if (refreshResponse.ok) {
        setModerationRecords(Array.isArray(refreshPayload.moderation) ? refreshPayload.moderation : []);
        setModerationActivity(Array.isArray(refreshPayload.activity) ? refreshPayload.activity : []);
      }
    } catch (err: any) {
      setModerationError(err?.message || 'Failed to revoke account control');
    } finally {
      setModerationActionLoading(null);
    }
  };

  const togglePaydayGroup = (groupKey: string) => {
    setCollapsedGroups((current) => ({
      ...current,
      [groupKey]: !current[groupKey],
    }));
  };

  const setRoleGroupsCollapsed = (role: 'seller' | 'affiliate' | 'influencer', collapsed: boolean) => {
    if (!selectedUser) return;
    const next = { ...collapsedGroups };
    const groups = new Set(roleSections[role].map((line) => `${selectedUser.key}::${role}::${line.scheduledPayDate || '-'}`));
    groups.forEach((groupKey) => {
      next[groupKey] = collapsed;
    });
    setCollapsedGroups(next);
  };

  const downloadTextFile = (content: string, filename: string, type = 'text/csv;charset=utf-8;') => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const exportSelectedUserCsv = () => {
    if (!selectedUser) return;
    const header = [
      'user_id',
      'name',
      'email',
      'primary_role',
      'username',
      'store_name',
      'recruited_by_influencer_id',
      'influencer_relationships',
      'paypal_emails',
      'seller_total',
      'affiliate_total',
      'influencer_total',
      'listing_count',
      'history_lines',
      'history_role',
      'order_id',
      'order_number',
      'created_at',
      'buyer_name',
      'buyer_email',
      'products',
      'gross_sales',
      'amount',
      'scheduled_payday',
      'hold_release_at',
      'payout_status',
      'order_status',
      'payment_status',
      'fulfillment_status',
    ];

    const baseRow = [
      selectedUser.userId,
      selectedUser.displayName,
      selectedUser.email,
      selectedUser.primaryRole || selectedUser.role,
      selectedUser.username,
      selectedUser.storeName,
      selectedUser.recruitedByInfluencerId,
      selectedUser.influencerRelationships.map((relationship) => `${relationship.role}:${relationship.influencer_name}:${relationship.influencer_email}`).join(' | '),
      selectedUser.paypalEmails.join(' | '),
      selectedUser.totals.seller.toFixed(2),
      selectedUser.totals.affiliate.toFixed(2),
      selectedUser.totals.influencer.toFixed(2),
      String(selectedUser.sellingProducts.length),
      String(selectedUser.lines.length),
    ];

    const rows = selectedUser.lines.length
      ? selectedUser.lines.map((line) => [
          ...baseRow,
          line.role,
          line.orderId,
          line.orderNumber || '',
          line.createdAt || '',
          line.buyerName,
          line.buyerEmail,
          line.products.join(' | '),
          line.grossSales.toFixed(2),
          line.amount.toFixed(2),
          line.scheduledPayDate,
          line.holdReleaseAt || '',
          line.payoutStatus,
          line.orderStatus,
          line.paymentStatus,
          line.fulfillmentStatus,
        ])
      : [
          [
            ...baseRow,
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
          ],
        ];

    const csv = [header.map(csvEscape).join(','), ...rows.map((row) => row.map(csvEscape).join(','))].join('\n');
    downloadTextFile(csv, `beezio-user-history-${slugifyFileSegment(selectedUser.displayName)}.csv`);
  };

  const exportSelectedUserPdf = () => {
    if (!selectedUser) return;
    const reportWindow = window.open('', '_blank', 'noopener,noreferrer,width=1200,height=900');
    if (!reportWindow) {
      setError('Popup blocked. Allow popups for Beezio admin and try again.');
      return;
    }

    const productRows = selectedUser.sellingProducts.length
      ? selectedUser.sellingProducts
          .map(
            (product) => `<tr>
              <td>${escapeHtml(product.title || product.id)}</td>
              <td>${escapeHtml(formatCurrency(product.price))}</td>
              <td>${escapeHtml(formatDateTime(product.created_at))}</td>
              <td>${escapeHtml(`${product.is_active ? 'Active' : 'Inactive'}${product.is_promotable ? ' | Promotable' : ''}`)}</td>
            </tr>`
          )
          .join('')
      : '<tr><td colspan="4" class="empty">No current listings recorded.</td></tr>';

    const receiptSections = (['seller', 'affiliate', 'influencer'] as const)
      .map((role) => {
        const lines = selectedUser.lines.filter((line) => line.role === role);
        const roleTotal = lines.reduce((sum, line) => sum + Number(line.amount || 0), 0);
        const groupedLines = lines.reduce(
          (groups, line) => {
            const key = line.scheduledPayDate || '-';
            const current = groups.get(key) || [];
            current.push(line);
            groups.set(key, current);
            return groups;
          },
          new Map<string, UserHistoryLine[]>()
        );
        const rowHtml = lines.length
          ? Array.from(groupedLines.entries())
              .sort(([left], [right]) => left.localeCompare(right))
              .map(([payday, paydayLines]) => {
                const paydaySubtotal = paydayLines.reduce((sum, line) => sum + Number(line.amount || 0), 0);
                const paydayGross = paydayLines.reduce((sum, line) => sum + Number(line.grossSales || 0), 0);
                const paydayRows = paydayLines
                  .map(
                    (line) => `<tr>
                      <td>${escapeHtml(formatDateTime(line.createdAt))}</td>
                      <td>${escapeHtml(line.orderNumber || line.orderId)}<div class="muted mono">${escapeHtml(line.orderId)}</div></td>
                      <td>${escapeHtml(line.buyerName || '-')}<div class="muted">${escapeHtml(line.buyerEmail || '-')}</div></td>
                      <td>${escapeHtml(line.products.join(', ') || '-')}</td>
                      <td>${escapeHtml(line.scheduledPayDate)}<div class="muted">Hold: ${escapeHtml(line.holdReleaseAt ? new Date(line.holdReleaseAt).toLocaleDateString() : '-')}</div><div class="muted">${escapeHtml(line.payoutStatus)}</div></td>
                      <td class="numeric">${escapeHtml(formatCurrency(line.grossSales))}</td>
                      <td class="numeric">${escapeHtml(formatCurrency(line.amount))}</td>
                    </tr>`
                  )
                  .join('');

                return `<tr class="payday-group-row"><td colspan="7">
                    <div class="payday-group-header">
                      <div>
                        <div class="label">Payday Batch</div>
                        <div class="value-inline">${escapeHtml(formatPaydayLabel(payday))}</div>
                      </div>
                      <div class="payday-subtotal-wrap">
                        <div class="muted">Gross ${escapeHtml(formatCurrency(paydayGross))}</div>
                        <div class="payday-subtotal">Subtotal ${escapeHtml(formatCurrency(paydaySubtotal))}</div>
                      </div>
                    </div>
                  </td></tr>${paydayRows}<tr class="subtotal-row"><td colspan="5">${escapeHtml(formatPaydayLabel(payday))} subtotal</td><td class="numeric">${escapeHtml(formatCurrency(paydayGross))}</td><td class="numeric">${escapeHtml(formatCurrency(paydaySubtotal))}</td></tr>`;
              })
              .join('')
          : '<tr><td colspan="7" class="empty">No recorded payout lines for this section.</td></tr>';

        return `<div class="block receipt-block">
          <div class="section-header">
            <div>
              <h2>${escapeHtml(roleReceiptTitle(role))}</h2>
              <div class="meta">${escapeHtml(selectedUser.displayName)} | ${escapeHtml(selectedUser.email || 'No email')}</div>
            </div>
            <div class="section-total">
              <div class="label">${escapeHtml(roleReceiptTitle(role))} Total</div>
              <div class="value">${escapeHtml(formatCurrency(roleTotal))}</div>
            </div>
          </div>
          <table>
            <thead>
              <tr><th>Created</th><th>Order</th><th>Buyer</th><th>Products</th><th>Payout Trail</th><th>Gross</th><th>Amount</th></tr>
            </thead>
            <tbody>${rowHtml}</tbody>
          </table>
        </div>`;
      })
      .join('');

    reportWindow.document.write(`<!doctype html>
      <html>
        <head>
          <title>${escapeHtml(`Beezio User Report - ${selectedUser.displayName}`)}</title>
          <style>
            body { font-family: Georgia, 'Times New Roman', serif; margin: 24px; color: #111827; background: #f8fafc; }
            h1, h2 { margin: 0; }
            .toolbar { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; margin-bottom: 20px; }
            .meta { color: #475569; font-size: 14px; margin-top: 6px; }
            .button { border: 0; border-radius: 10px; padding: 10px 14px; font-weight: 700; cursor: pointer; background: #111827; color: white; }
            .summary { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-bottom: 20px; }
            .card { background: white; border: 1px solid #e5e7eb; border-radius: 14px; padding: 14px; }
            .label { color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; }
            .value { color: #111827; font-size: 15px; font-weight: 700; margin-top: 6px; }
            .block { background: white; border: 1px solid #e5e7eb; border-radius: 16px; padding: 18px; margin-bottom: 18px; }
            .receipt-block { page-break-inside: avoid; }
            .section-header { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; margin-bottom: 12px; }
            .section-total { min-width: 180px; text-align: right; }
            .payday-group-row td { background: #fff7ed; border-bottom: 0; padding-bottom: 6px; }
            .payday-group-header { display: flex; justify-content: space-between; gap: 16px; align-items: center; }
            .value-inline { color: #111827; font-size: 16px; font-weight: 700; margin-top: 4px; }
            .payday-subtotal-wrap { text-align: right; }
            .payday-subtotal { color: #9a3412; font-size: 14px; font-weight: 700; margin-top: 4px; }
            .subtotal-row td { background: #f8fafc; font-weight: 700; }
            table { width: 100%; border-collapse: collapse; }
            th, td { padding: 10px 12px; border-bottom: 1px solid #e5e7eb; vertical-align: top; text-align: left; font-size: 13px; }
            th { background: #f8fafc; font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; color: #475569; }
            .numeric { text-align: right; font-weight: 700; }
            .muted { color: #64748b; font-size: 12px; margin-top: 2px; }
            .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
            .empty { text-align: center; color: #64748b; padding: 24px; }
            @media print {
              body { background: white; }
              .toolbar { display: none; }
              .block, .card { border-color: #d1d5db; }
            }
          </style>
        </head>
        <body>
          <div class="toolbar">
            <div>
              <h1>${escapeHtml(selectedUser.displayName)}</h1>
              <div class="meta">Beezio admin user report. Use Print and choose Save as PDF for a PDF copy.</div>
            </div>
            <button onclick="window.print()" class="button">Print / Save PDF</button>
          </div>

          <div class="block">
            <h2>User Summary</h2>
            <div class="meta">Email: ${escapeHtml(selectedUser.email || 'No email')} | Username: ${escapeHtml(selectedUser.username || 'No username')} | Store: ${escapeHtml(selectedUser.storeName || 'No store name')}</div>
            <div class="meta">Role: ${escapeHtml(selectedUser.primaryRole || selectedUser.role)} | Created: ${escapeHtml(formatDateTime(selectedUser.createdAt))}</div>
            <div class="meta">PayPal: ${escapeHtml(selectedUser.paypalEmails.join(', ') || 'No PayPal emails')}</div>
            <div class="meta">Influencer ties: ${escapeHtml(selectedUser.influencerRelationships.length ? selectedUser.influencerRelationships.map((relationship) => `${influencerRelationshipLabel(relationship.role)}: ${relationship.influencer_name}${relationship.influencer_email ? ` (${relationship.influencer_email})` : ''}`).join(' | ') : 'No influencer tied to this account')}</div>
          </div>

          <div class="summary">
            <div class="card"><div class="label">Seller Total</div><div class="value">${escapeHtml(formatCurrency(selectedUser.totals.seller))}</div></div>
            <div class="card"><div class="label">Affiliate Total</div><div class="value">${escapeHtml(formatCurrency(selectedUser.totals.affiliate))}</div></div>
            <div class="card"><div class="label">Influencer Total</div><div class="value">${escapeHtml(formatCurrency(selectedUser.totals.influencer))}</div></div>
            <div class="card"><div class="label">History Lines</div><div class="value">${escapeHtml(selectedUser.lines.length)}</div></div>
          </div>

          <div class="block">
            <h2>Listings</h2>
            <table>
              <thead>
                <tr><th>Product</th><th>Price</th><th>Created</th><th>Status</th></tr>
              </thead>
              <tbody>${productRows}</tbody>
            </table>
          </div>

          ${receiptSections}
        </body>
      </html>`);
    reportWindow.document.close();
  };

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Admin Users Panel</h1>
          <p className="mt-1 text-sm text-gray-600">
            Full admin view of everyone in Beezio, what they are selling, promoting, and earning, plus their recorded history in the sales ledger.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/admin/payouts" className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800">
            Open Payouts Queue
          </Link>
          <Link to="/admin/platform" className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800">
            Open Platform Admin
          </Link>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-gray-200 bg-white p-4">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_220px_220px]">
          <label className="text-sm text-gray-700">
            <div className="mb-1 font-medium">Search User, Product, Email, PayPal, Or Order</div>
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Name, username, email, PayPal, product, order"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm text-gray-700">
            <div className="mb-1 font-medium">Directory Sort</div>
            <select
              value={userSort}
              onChange={(event) => setUserSort(event.target.value as 'earnings' | 'alphabet' | 'email')}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="alphabet">Alphabetical</option>
              <option value="email">Email</option>
              <option value="earnings">Recorded earnings</option>
            </select>
          </label>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <div className="text-xs uppercase tracking-wide text-slate-500">Selected Letter</div>
            <div className="mt-1 font-semibold text-slate-900">{directoryLetter === 'all' ? 'All users' : directoryLetter}</div>
            <button
              type="button"
              onClick={() => setDirectoryLetter('all')}
              className="mt-2 text-xs font-semibold text-amber-700 hover:text-amber-800"
            >
              Clear letter filter
            </button>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setDirectoryLetter('all')}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${directoryLetter === 'all' ? 'border-amber-300 bg-amber-50 text-amber-900' : 'border-slate-200 bg-white text-slate-700'}`}
          >
            All
          </button>
          {directoryLetters.map((letter) => (
            <button
              key={letter}
              type="button"
              onClick={() => setDirectoryLetter(letter)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${directoryLetter === letter ? 'border-amber-300 bg-amber-50 text-amber-900' : 'border-slate-200 bg-white text-slate-700'}`}
            >
              {letter}
            </button>
          ))}
        </div>
      </div>

      {error ? <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {loading ? <div className="mt-6 text-sm text-gray-500">Loading admin users...</div> : null}

      {!loading ? (
        <div className="mt-6 grid gap-6 xl:grid-cols-[380px_1fr]">
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <div className="text-sm text-gray-600">Users in directory</div>
                <div className="mt-1 text-2xl font-semibold text-gray-900">{directorySummary.totalUsers}</div>
                <div className="mt-1 text-xs text-gray-500">Includes users with live history and users with listings but no sales yet.</div>
              </div>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <div className="text-sm text-emerald-800">Recorded lifetime payouts</div>
                <div className="mt-1 text-2xl font-semibold text-emerald-900">{formatCurrency(directorySummary.recordedLifetime)}</div>
                <div className="mt-1 text-xs text-emerald-700">Seller, affiliate, and influencer totals from the unified ledger.</div>
              </div>
              <div className="rounded-xl border border-sky-200 bg-sky-50 p-4">
                <div className="text-sm text-sky-800">Users with ledger history</div>
                <div className="mt-1 text-2xl font-semibold text-sky-900">{directorySummary.usersWithLedger}</div>
                <div className="mt-1 text-xs text-sky-700">Users already tied to one or more order payout lines.</div>
              </div>
              <div className="rounded-xl border border-violet-200 bg-violet-50 p-4">
                <div className="text-sm text-violet-800">Users with listings</div>
                <div className="mt-1 text-2xl font-semibold text-violet-900">{directorySummary.sellerAccounts}</div>
                <div className="mt-1 text-xs text-violet-700">Accounts currently carrying at least one product listing.</div>
              </div>
            </div>
            <div className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">
              {filteredPanels.map((panel) => {
                const total = panel.totals.seller + panel.totals.affiliate + panel.totals.influencer;
                const anchor = String(panel.displayName || panel.email || panel.username || '').trim().charAt(0).toUpperCase() || '#';
                return (
                  <button
                    key={panel.key}
                    type="button"
                    onClick={() => setSelectedUserKey(panel.key)}
                    className={`w-full rounded-xl border p-4 text-left transition ${selectedUser?.key === panel.key ? 'border-amber-300 bg-amber-50' : 'border-gray-200 bg-white hover:bg-gray-50'}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">{anchor}</div>
                        <div className="font-semibold text-gray-900">{panel.displayName}</div>
                        <div className="mt-1 text-xs text-gray-500">{panel.email || 'No email'}</div>
                        <div className="text-xs text-gray-500">{panel.paypalEmails[0] || 'No PayPal email'}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs uppercase tracking-wide text-gray-500">Recorded Total</div>
                        <div className="text-sm font-semibold text-emerald-700">{formatCurrency(total)}</div>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700">
                        {panel.primaryRole || panel.role || 'unknown'}
                      </span>
                      {(['seller', 'affiliate', 'influencer'] as const).map((role) => (
                        <span key={`${panel.key}-${role}`} className="rounded-full border border-gray-200 bg-white px-2 py-1 text-xs font-semibold text-gray-700">
                          {normalizeRole(role)} {formatCurrency(panel.totals[role])}
                        </span>
                      ))}
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-gray-600">
                      <div>
                        <div className="uppercase tracking-wide text-gray-500">Products</div>
                        <div className="mt-1 font-semibold text-gray-900">{panel.sellingProducts.length}</div>
                      </div>
                      <div>
                        <div className="uppercase tracking-wide text-gray-500">History Lines</div>
                        <div className="mt-1 font-semibold text-gray-900">{panel.lines.length}</div>
                      </div>
                      <div>
                        <div className="uppercase tracking-wide text-gray-500">Role</div>
                        <div className="mt-1 font-semibold text-gray-900">{panel.primaryRole || panel.role || 'unknown'}</div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {selectedUser ? (
            <div className="space-y-6">
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">{selectedUser.displayName}</h2>
                    <div className="mt-2 space-y-1 text-sm text-gray-600">
                      <div>Email: {selectedUser.email || 'No email'}</div>
                      <div>Username: {selectedUser.username || 'No username'}</div>
                      <div>Store: {selectedUser.storeName || 'No store name'}</div>
                      <div>Created: {formatDateTime(selectedUser.createdAt)}</div>
                      <div>PayPal: {selectedUser.paypalEmails.join(', ') || 'No PayPal emails'}</div>
                    </div>
                    <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
                      <div className="text-xs font-semibold uppercase tracking-wide text-amber-800">Influencer Ties</div>
                      {selectedUser.influencerRelationships.length === 0 ? (
                        <div className="mt-2 text-sm text-amber-900">No influencer is tied to this account.</div>
                      ) : (
                        <div className="mt-2 space-y-2">
                          {selectedUser.influencerRelationships.map((relationship) => (
                            <div key={`${relationship.role}-${relationship.influencer_id}`} className="rounded-lg bg-white/80 px-3 py-2 text-sm text-slate-700">
                              <div className="font-semibold text-slate-900">{influencerRelationshipLabel(relationship.role)}: {relationship.influencer_name}</div>
                              <div>{relationship.influencer_email || 'No influencer email logged'}</div>
                              <div className="text-xs text-slate-500">Influencer ID: {relationship.influencer_id}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="space-y-3 lg:min-w-[420px]">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                        <div className="text-xs uppercase tracking-wide text-gray-500">Seller Total</div>
                        <div className="mt-1 font-semibold text-gray-900">{formatCurrency(selectedUser.totals.seller)}</div>
                      </div>
                      <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                        <div className="text-xs uppercase tracking-wide text-gray-500">Affiliate Total</div>
                        <div className="mt-1 font-semibold text-gray-900">{formatCurrency(selectedUser.totals.affiliate)}</div>
                      </div>
                      <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                        <div className="text-xs uppercase tracking-wide text-gray-500">Influencer Total</div>
                        <div className="mt-1 font-semibold text-gray-900">{formatCurrency(selectedUser.totals.influencer)}</div>
                      </div>
                      <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                        <div className="text-xs uppercase tracking-wide text-gray-500">History Lines</div>
                        <div className="mt-1 font-semibold text-gray-900">{selectedUser.lines.length}</div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={exportSelectedUserCsv}
                        className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black"
                      >
                        Export User CSV
                      </button>
                      <button
                        type="button"
                        onClick={exportSelectedUserPdf}
                        className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                      >
                        Print / Save PDF
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {activeRestrictions.length > 0 ? activeRestrictions.map((record) => (
                        <span
                          key={record.id}
                          className={`rounded-full border px-3 py-1 text-xs font-semibold ${moderationBadgeClass(record.action_type, true)}`}
                        >
                          {moderationActionLabel(record.action_type)}
                          {record.expires_at ? ` until ${new Date(record.expires_at).toLocaleDateString()}` : ''}
                        </span>
                      )) : (
                        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                          No active access restrictions
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
                <div className="rounded-xl border border-slate-200 bg-white p-5">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">Account Controls</h3>
                      <p className="mt-1 text-sm text-gray-600">
                        Issue warnings, suspend payouts and access, place a permanent ban, or set a restricted review state for this user.
                      </p>
                    </div>
                    {moderationLoading ? <div className="text-xs font-medium text-gray-500">Refreshing controls...</div> : null}
                  </div>

                  {moderationError ? <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{moderationError}</div> : null}
                  {moderationStatus ? <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{moderationStatus}</div> : null}

                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <label className="text-sm text-gray-700">
                      <div className="mb-1 font-medium">Action</div>
                      <select
                        value={moderationActionType}
                        onChange={(event) => setModerationActionType(event.target.value as 'warning' | 'suspension' | 'ban' | 'restriction')}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      >
                        <option value="warning">Warning</option>
                        <option value="suspension">Suspend account</option>
                        <option value="restriction">Restrict payouts and listings</option>
                        <option value="ban">Permanent ban / block</option>
                      </select>
                    </label>

                    <label className="text-sm text-gray-700">
                      <div className="mb-1 font-medium">Suspension Days</div>
                      <input
                        type="number"
                        min="1"
                        value={moderationDurationDays}
                        onChange={(event) => setModerationDurationDays(event.target.value)}
                        disabled={moderationActionType !== 'suspension'}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100"
                      />
                    </label>

                    <label className="text-sm text-gray-700 md:col-span-2">
                      <div className="mb-1 font-medium">Reason</div>
                      <input
                        type="text"
                        value={moderationReason}
                        onChange={(event) => setModerationReason(event.target.value)}
                        placeholder="Fraud review, chargeback abuse, payout mismatch, policy violation"
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      />
                    </label>

                    <label className="text-sm text-gray-700 md:col-span-2">
                      <div className="mb-1 font-medium">Internal Notes</div>
                      <textarea
                        value={moderationNotes}
                        onChange={(event) => setModerationNotes(event.target.value)}
                        rows={3}
                        placeholder="Internal notes for finance, compliance, or support handoff"
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      />
                    </label>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void submitModerationAction()}
                      disabled={Boolean(moderationActionLoading)}
                      className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {moderationActionLoading === 'apply' ? 'Saving...' : 'Save Account Control'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setModerationActionType('suspension');
                        setModerationReason('');
                        setModerationNotes('');
                        setModerationDurationDays('14');
                        setModerationError(null);
                        setModerationStatus(null);
                      }}
                      className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Reset Form
                    </button>
                  </div>

                  <div className="mt-5 space-y-3">
                    <div className="text-sm font-semibold text-gray-900">Live Restriction Summary</div>
                    {activeRestrictions.length === 0 ? (
                      <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                        This user currently has no active account blocks, suspensions, or payout restrictions.
                      </div>
                    ) : (
                      activeRestrictions.map((record) => (
                        <div key={record.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <div className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${moderationBadgeClass(record.action_type, true)}`}>
                                {moderationActionLabel(record.action_type)}
                              </div>
                              <div className="mt-2 text-sm font-semibold text-slate-900">{record.reason || 'No reason provided'}</div>
                              <div className="mt-1 text-xs text-slate-600">
                                Issued {formatDateTime(record.created_at)}
                                {record.expires_at ? ` | Ends ${formatDateTime(record.expires_at)}` : ' | Permanent until revoked'}
                              </div>
                              {record.notes ? <div className="mt-2 text-sm text-slate-700">{record.notes}</div> : null}
                            </div>
                            <button
                              type="button"
                              onClick={() => void revokeModerationAction(record.id)}
                              disabled={Boolean(moderationActionLoading)}
                              className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {moderationActionLoading === `revoke:${record.id}` ? 'Removing...' : 'Remove Restriction'}
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-5">
                  <h3 className="text-lg font-semibold text-gray-900">Recent Admin Activity</h3>
                  <p className="mt-1 text-sm text-gray-600">
                    Latest moderation and audit entries tied to this user so support, finance, and admin can review what changed.
                  </p>

                  <div className="mt-4 space-y-3">
                    {moderationLoading ? <div className="text-sm text-gray-500">Loading activity trail...</div> : null}
                    {!moderationLoading && moderationActivity.length === 0 ? (
                      <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
                        No recent admin audit entries were found for this user.
                      </div>
                    ) : null}
                    {moderationActivity.map((entry) => (
                      <div key={`${entry.source}-${entry.id}`} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{entry.source === 'moderation_log' ? 'Moderation Log' : 'Audit Log'}</div>
                            <div className="mt-1 text-sm font-semibold text-slate-900">{entry.action || 'Unknown action'}</div>
                          </div>
                          <div className="text-xs text-slate-500">{formatDateTime(entry.created_at)}</div>
                        </div>
                        {entry.reason ? <div className="mt-2 text-sm text-slate-700">{entry.reason}</div> : null}
                        {entry.details ? (
                          <pre className="mt-3 overflow-x-auto rounded-lg bg-slate-900/95 p-3 text-xs text-slate-100">{JSON.stringify(entry.details, null, 2)}</pre>
                        ) : null}
                      </div>
                    ))}
                  </div>

                  <div className="mt-5 border-t border-slate-200 pt-4">
                    <div className="text-sm font-semibold text-gray-900">Control History</div>
                    <div className="mt-3 space-y-2">
                      {moderationRecords.length === 0 ? (
                        <div className="text-sm text-gray-500">No moderation records have been logged yet.</div>
                      ) : (
                        moderationRecords.slice(0, 6).map((record) => (
                          <div key={record.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm">
                            <div>
                              <div className="font-semibold text-slate-900">{moderationActionLabel(record.action_type)}</div>
                              <div className="text-xs text-slate-500">{record.reason || 'No reason'} | {formatDateTime(record.created_at)}</div>
                            </div>
                            <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${moderationBadgeClass(record.action_type, isModerationActive(record))}`}>
                              {isModerationActive(record) ? 'Active' : 'Closed'}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <h3 className="text-lg font-semibold text-gray-900">What They Are Selling</h3>
                {selectedUser.sellingProducts.length === 0 ? (
                  <div className="mt-3 text-sm text-gray-500">No current seller listings recorded for this user.</div>
                ) : (
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-gray-600">
                        <tr>
                          <th className="text-left px-4 py-3">Product</th>
                          <th className="text-right px-4 py-3">Price</th>
                          <th className="text-left px-4 py-3">Created</th>
                          <th className="text-left px-4 py-3">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedUser.sellingProducts.map((product) => (
                          <tr key={product.id} className="border-t">
                            <td className="px-4 py-3 text-sm text-gray-800">{product.title || product.id}</td>
                            <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatCurrency(product.price)}</td>
                            <td className="px-4 py-3 text-sm text-gray-600">{formatDateTime(product.created_at)}</td>
                            <td className="px-4 py-3 text-sm text-gray-600">{product.is_active ? 'Active' : 'Inactive'}{product.is_promotable ? ' | Promotable' : ''}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {(['seller', 'affiliate', 'influencer'] as const).map((role) => {
                const lines = roleSections[role];
                const groupedLines = lines.reduce((groups, line) => {
                  const key = line.scheduledPayDate || '-';
                  const current = groups.get(key) || [];
                  current.push(line);
                  groups.set(key, current);
                  return groups;
                }, new Map<string, UserHistoryLine[]>());
                return (
                  <div key={role} className="rounded-xl border border-slate-200 bg-white p-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">{role === 'seller' ? 'Seller History' : role === 'affiliate' ? 'Affiliate Promotion History' : 'Influencer History'}</h3>
                        <p className="mt-1 text-sm text-gray-600">
                          {role === 'seller'
                            ? 'Every recorded order where this user was the seller payee.'
                            : role === 'affiliate'
                              ? 'Every recorded order where this user was paid as the affiliate.'
                              : 'Every recorded order where this user was paid as the influencer.'}
                        </p>
                      </div>
                      {lines.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => setRoleGroupsCollapsed(role, false)}
                            className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            Expand all
                          </button>
                          <button
                            type="button"
                            onClick={() => setRoleGroupsCollapsed(role, true)}
                            className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            Collapse all
                          </button>
                        </div>
                      ) : null}
                    </div>
                    {lines.length === 0 ? (
                      <div className="mt-3 text-sm text-gray-500">No recorded {normalizeRole(role)} history yet.</div>
                    ) : (
                      <div className="mt-4 overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50 text-gray-600">
                            <tr>
                              <th className="text-left px-4 py-3">Created</th>
                              <th className="text-left px-4 py-3">Order</th>
                              <th className="text-left px-4 py-3">Buyer</th>
                              <th className="text-left px-4 py-3">Products</th>
                              <th className="text-left px-4 py-3">Payout Trail</th>
                              <th className="text-right px-4 py-3">Gross</th>
                              <th className="text-right px-4 py-3">Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {Array.from(groupedLines.entries())
                              .sort(([left], [right]) => left.localeCompare(right))
                              .map(([payday, paydayLines]) => {
                                const paydayGross = paydayLines.reduce((sum, line) => sum + Number(line.grossSales || 0), 0);
                                const paydaySubtotal = paydayLines.reduce((sum, line) => sum + Number(line.amount || 0), 0);
                                const groupKey = `${selectedUser.key}::${role}::${payday}`;
                                const isCollapsed = Boolean(collapsedGroups[groupKey]);

                                return (
                                  <>
                                    <tr key={`${role}-${payday}-group`} className="border-t bg-amber-50/70">
                                      <td colSpan={7} className="px-4 py-3">
                                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                          <div>
                                            <div className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">Payday Batch</div>
                                            <div className="text-sm font-semibold text-slate-900">{formatPaydayLabel(payday)}</div>
                                          </div>
                                          <div className="flex items-center gap-3">
                                            <div className="text-right text-xs text-slate-600">
                                              <div>Gross {formatCurrency(paydayGross)}</div>
                                              <div className="font-semibold text-amber-700">Subtotal {formatCurrency(paydaySubtotal)}</div>
                                            </div>
                                            <button
                                              type="button"
                                              onClick={() => togglePaydayGroup(groupKey)}
                                              className="rounded-full border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100"
                                            >
                                              {isCollapsed ? 'Expand' : 'Collapse'}
                                            </button>
                                          </div>
                                        </div>
                                      </td>
                                    </tr>
                                    {!isCollapsed ? paydayLines.map((line) => (
                                      <tr key={`${role}-${payday}-${line.orderId}-${line.createdAt || 'na'}`} className="border-t align-top">
                                        <td className="px-4 py-3 text-xs text-gray-700">{formatDateTime(line.createdAt)}</td>
                                        <td className="px-4 py-3 text-xs">
                                          <div className="font-semibold text-gray-900">{line.orderNumber || line.orderId}</div>
                                          <div className="font-mono text-gray-500">{line.orderId}</div>
                                        </td>
                                        <td className="px-4 py-3 text-xs text-gray-700">
                                          <div>{line.buyerName || '-'}</div>
                                          <div className="text-gray-500">{line.buyerEmail || '-'}</div>
                                        </td>
                                        <td className="px-4 py-3 text-xs text-gray-700">{line.products.join(', ') || '-'}</td>
                                        <td className="px-4 py-3 text-xs text-gray-700">
                                          <div>Payday: {line.scheduledPayDate}</div>
                                          <div>Hold: {line.holdReleaseAt ? new Date(line.holdReleaseAt).toLocaleDateString() : '-'}</div>
                                          <div>Status: {line.payoutStatus}</div>
                                          <div>Order: {line.orderStatus} / {line.paymentStatus} / {line.fulfillmentStatus}</div>
                                        </td>
                                        <td className="px-4 py-3 text-right text-xs font-semibold text-gray-900">{formatCurrency(line.grossSales)}</td>
                                        <td className="px-4 py-3 text-right text-xs font-semibold text-emerald-700">{formatCurrency(line.amount)}</td>
                                      </tr>
                                    )) : null}
                                    <tr key={`${role}-${payday}-subtotal`} className="border-t bg-slate-50">
                                      <td colSpan={5} className="px-4 py-3 text-xs font-semibold text-slate-700">{formatPaydayLabel(payday)} subtotal</td>
                                      <td className="px-4 py-3 text-right text-xs font-semibold text-slate-900">{formatCurrency(paydayGross)}</td>
                                      <td className="px-4 py-3 text-right text-xs font-semibold text-emerald-700">{formatCurrency(paydaySubtotal)}</td>
                                    </tr>
                                  </>
                                );
                              })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
