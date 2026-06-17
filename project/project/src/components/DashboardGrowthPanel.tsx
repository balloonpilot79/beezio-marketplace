import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Circle, UserPlus, Users, Wallet } from 'lucide-react';
import { useAuth } from '../contexts/AuthContextMultiRole';
import { supabase } from '../lib/supabase';

type RoleKey = 'buyer' | 'seller' | 'affiliate' | 'influencer' | 'admin';

type Props = {
  activeSection: RoleKey;
  visibleRoles: RoleKey[];
  enablingRole: string | null;
  onEnableRole: (role: 'seller' | 'affiliate' | 'influencer') => Promise<void>;
};

type ChecklistItem = {
  id: string;
  label: string;
  done: boolean;
};

type DashboardMetrics = {
  payoutConfigured: boolean;
  sellerProductsCount: number;
  affiliateProductsCount: number;
  affiliateLinksCount: number;
  recruitsCount: number;
  influencerPayoutEvents: number;
  recruitedByInfluencerId: string | null;
  recruitedByName: string | null;
  recruitedByCode: string | null;
  latestInfluencerPayoutAmount: number;
  latestInfluencerPayoutStatus: string | null;
};

const defaultMetrics: DashboardMetrics = {
  payoutConfigured: false,
  sellerProductsCount: 0,
  affiliateProductsCount: 0,
  affiliateLinksCount: 0,
  recruitsCount: 0,
  influencerPayoutEvents: 0,
  recruitedByInfluencerId: null,
  recruitedByName: null,
  recruitedByCode: null,
  latestInfluencerPayoutAmount: 0,
  latestInfluencerPayoutStatus: null,
};

const roleLabels: Record<'seller' | 'affiliate' | 'influencer', string> = {
  seller: 'Seller',
  affiliate: 'Partner',
  influencer: 'Influencer',
};

function Checklist({
  title,
  items,
  dismissedItems,
  onDismissItem,
}: {
  title: string;
  items: ChecklistItem[];
  dismissedItems: Record<string, boolean>;
  onDismissItem: (itemId: string) => void;
}) {
  const visibleItems = items.filter((item) => !item.done && !dismissedItems[item.id]);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      <div className="mt-3 space-y-2">
        {visibleItems.length === 0 && (
          <div className="flex items-center gap-2 text-sm text-emerald-700">
            <CheckCircle2 className="h-4 w-4" />
            <span>Checklist complete</span>
          </div>
        )}
        {visibleItems.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onDismissItem(item.id)}
            className="flex w-full items-center gap-2 text-left text-sm transition-colors hover:text-gray-900"
            aria-label={`Mark "${item.label}" complete`}
          >
            <Circle className="h-4 w-4 text-gray-400" />
            <span className="text-gray-600">{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

const DashboardGrowthPanel: React.FC<Props> = ({ activeSection, visibleRoles, enablingRole, onEnableRole }) => {
  const { profile } = useAuth();
  const [metrics, setMetrics] = useState<DashboardMetrics>(defaultMetrics);
  const [loading, setLoading] = useState(true);
  const [dismissedItems, setDismissedItems] = useState<Record<string, boolean>>({});

  const profileId = useMemo(() => String((profile as any)?.id || '').trim(), [profile]);
  const dismissedItemsKey = useMemo(
    () => (profileId ? `beezio_dashboard_checklist_state_${profileId}` : ''),
    [profileId]
  );

  useEffect(() => {
    if (!dismissedItemsKey) return;
    try {
      const raw = localStorage.getItem(dismissedItemsKey);
      if (!raw) {
        setDismissedItems({});
        return;
      }
      const parsed = JSON.parse(raw) as Record<string, boolean>;
      setDismissedItems(parsed && typeof parsed === 'object' ? parsed : {});
    } catch {
      setDismissedItems({});
    }
  }, [dismissedItemsKey]);

  useEffect(() => {
    let alive = true;

    const load = async () => {
      if (!profileId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const [
          payoutResult,
          sellerProductsResult,
          affiliateProductsResult,
          affiliateLinksResult,
          recruitsResult,
          influencerReferralResult,
          payoutLedgerResult,
        ] = await Promise.all([
          supabase.from('paypal_accounts').select('user_id', { head: true, count: 'exact' }).eq('user_id', profileId),
          supabase.from('products').select('id', { head: true, count: 'exact' }).eq('seller_id', profileId),
          supabase.from('affiliate_products').select('id', { head: true, count: 'exact' }).eq('affiliate_id', profileId),
          supabase.from('affiliate_links').select('id', { head: true, count: 'exact' }).eq('affiliate_id', profileId),
          supabase.from('influencer_referrals').select('id', { head: true, count: 'exact' }).eq('influencer_profile_id', profileId),
          supabase.from('influencer_referrals').select('influencer_profile_id,recruited_role').eq('recruited_profile_id', profileId).limit(2),
          supabase
            .from('payout_ledger')
            .select('status,influencer_earnings,created_at')
            .eq('influencer_id', profileId)
            .order('created_at', { ascending: false })
            .limit(1),
        ]);

        let recruitedByName: string | null = null;
        let recruitedByCode: string | null = null;
        const referralRows = Array.isArray(influencerReferralResult.data) ? influencerReferralResult.data : [];
        const recruitedByInfluencerId = String((referralRows[0] as any)?.influencer_profile_id || '').trim() || null;
        if (recruitedByInfluencerId) {
          const { data: referrerRow } = await supabase
            .from('profiles')
            .select('full_name,username,referral_code')
            .eq('id', recruitedByInfluencerId)
            .maybeSingle();
          recruitedByName = String((referrerRow as any)?.full_name || (referrerRow as any)?.username || '').trim() || null;
          recruitedByCode = String((referrerRow as any)?.referral_code || (referrerRow as any)?.username || '').trim() || null;
        }

        if (!alive) return;
        const latestPayout = Array.isArray(payoutLedgerResult.data) ? payoutLedgerResult.data[0] : null;
        setMetrics({
          payoutConfigured: Number(payoutResult.count || 0) > 0,
          sellerProductsCount: Number(sellerProductsResult.count || 0),
          affiliateProductsCount: Number(affiliateProductsResult.count || 0),
          affiliateLinksCount: Number(affiliateLinksResult.count || 0),
          recruitsCount: Number(recruitsResult.count || 0),
          influencerPayoutEvents: Array.isArray(payoutLedgerResult.data) ? payoutLedgerResult.data.length : 0,
          recruitedByInfluencerId,
          recruitedByName,
          recruitedByCode,
          latestInfluencerPayoutAmount: Number((latestPayout as any)?.influencer_earnings || 0),
          latestInfluencerPayoutStatus: String((latestPayout as any)?.status || '').trim() || null,
        });
      } catch {
        if (!alive) return;
        setMetrics(defaultMetrics);
      } finally {
        if (alive) setLoading(false);
      }
    };

    void load();
    return () => {
      alive = false;
    };
  }, [profileId]);

  const missingRoles = useMemo(() => {
    return (['seller', 'affiliate', 'influencer'] as const).filter((role) => !visibleRoles.includes(role));
  }, [visibleRoles]);

  const sellerChecklist = useMemo<ChecklistItem[]>(
    () => [
      { id: 'seller-payout', label: 'Set your payout email', done: metrics.payoutConfigured },
      { id: 'seller-product', label: 'Add your first product', done: metrics.sellerProductsCount > 0 },
      { id: 'seller-live', label: 'Publish your store listing', done: metrics.sellerProductsCount > 0 },
    ],
    [metrics.payoutConfigured, metrics.sellerProductsCount]
  );

  const affiliateChecklist = useMemo<ChecklistItem[]>(
    () => [
      { id: 'affiliate-payout', label: 'Set your payout email', done: metrics.payoutConfigured },
      { id: 'affiliate-product', label: 'Add your first marketplace product', done: metrics.affiliateProductsCount > 0 },
      { id: 'affiliate-share', label: 'Generate your first share link', done: metrics.affiliateLinksCount > 0 },
    ],
    [metrics.affiliateLinksCount, metrics.affiliateProductsCount, metrics.payoutConfigured]
  );

  const influencerChecklist = useMemo<ChecklistItem[]>(
    () => [
      { id: 'influencer-link', label: 'Share your recruiter link', done: metrics.recruitsCount > 0 },
      { id: 'influencer-recruit', label: 'Get your first direct recruit', done: metrics.recruitsCount > 0 },
      { id: 'influencer-earn', label: 'Receive your first payout event', done: metrics.influencerPayoutEvents > 0 },
    ],
    [metrics.influencerPayoutEvents, metrics.recruitsCount]
  );

  useEffect(() => {
    if (!dismissedItemsKey) return;
    const completedIds = [...sellerChecklist, ...affiliateChecklist, ...influencerChecklist]
      .filter((item) => item.done)
      .map((item) => item.id);
    if (completedIds.length === 0) return;

    setDismissedItems((prev) => {
      let changed = false;
      const next = { ...prev };
      completedIds.forEach((id) => {
        if (!next[id]) {
          next[id] = true;
          changed = true;
        }
      });
      if (!changed) return prev;
      try {
        localStorage.setItem(dismissedItemsKey, JSON.stringify(next));
      } catch {
        // ignore persistence issues
      }
      return next;
    });
  }, [affiliateChecklist, dismissedItemsKey, influencerChecklist, sellerChecklist]);

  const dismissChecklistItem = (itemId: string) => {
    setDismissedItems((prev) => {
      if (prev[itemId]) return prev;
      const next = { ...prev, [itemId]: true };
      if (dismissedItemsKey) {
        try {
          localStorage.setItem(dismissedItemsKey, JSON.stringify(next));
        } catch {
          // ignore persistence issues
        }
      }
      return next;
    });
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-600">Loading onboarding progress...</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-gray-600" />
            <h3 className="text-sm font-semibold text-gray-900">Enable Additional Roles</h3>
          </div>
          <p className="mt-2 text-xs text-gray-600">
            Your account can run multiple roles. Primary role controls your default dashboard, and extra roles can be enabled anytime.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {missingRoles.length === 0 ? (
              <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
                All roles enabled
              </span>
            ) : (
              missingRoles.map((role) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => onEnableRole(role)}
                  disabled={enablingRole === role}
                  className="inline-flex items-center rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                >
                  {enablingRole === role ? 'Enabling...' : `Enable ${roleLabels[role]}`}
                </button>
              ))
            )}
          </div>
        </div>

        <Checklist
          title="Seller First-Sale Checklist"
          items={sellerChecklist}
          dismissedItems={dismissedItems}
          onDismissItem={dismissChecklistItem}
        />
        {(activeSection === 'affiliate' || activeSection === 'influencer' || visibleRoles.includes('affiliate')) && (
          <Checklist
            title="Partner First-Sale Checklist"
            items={affiliateChecklist}
            dismissedItems={dismissedItems}
            onDismissItem={dismissChecklistItem}
          />
        )}
      </div>

      {(activeSection === 'influencer' || visibleRoles.includes('influencer')) && (
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Checklist
            title="Influencer First-Sale Checklist"
            items={influencerChecklist}
            dismissedItems={dismissedItems}
            onDismissItem={dismissChecklistItem}
          />
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-gray-600" />
              <h3 className="text-sm font-semibold text-gray-900">Referral Attribution</h3>
            </div>
            <div className="mt-3 space-y-2 text-sm">
              <p className="text-gray-700">
                You were referred by:{' '}
                <span className="font-semibold text-gray-900">
                  {metrics.recruitedByInfluencerId
                    ? `${metrics.recruitedByName || 'Unknown'}${metrics.recruitedByCode ? ` (${metrics.recruitedByCode})` : ''}`
                    : 'No influencer referrer'}
                </span>
              </p>
              <p className="text-gray-700">
                Direct recruits: <span className="font-semibold text-gray-900">{metrics.recruitsCount}</span>
              </p>
              <p className="text-gray-700">
                Rule: <span className="font-semibold text-gray-900">5% recurring on direct recruits only.</span>
              </p>
              <div className="inline-flex items-center gap-2 rounded-md bg-gray-50 px-2 py-1 text-xs text-gray-700">
                <Wallet className="h-3.5 w-3.5" />
                Last payout event:{' '}
                <span className="font-semibold">
                  {metrics.influencerPayoutEvents > 0
                    ? `$${metrics.latestInfluencerPayoutAmount.toFixed(2)} (${metrics.latestInfluencerPayoutStatus || 'recorded'})`
                    : 'None yet'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardGrowthPanel;
