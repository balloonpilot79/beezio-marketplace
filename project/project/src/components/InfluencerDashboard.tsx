import React, { useEffect, useMemo, useState } from 'react';
import { Copy, Link as LinkIcon } from 'lucide-react';
import { useAuth } from '../contexts/AuthContextMultiRole';
import { supabase } from '../lib/supabase';
import { copyTextToClipboard } from '../utils/clipboard';
import InfluencerRecruitPromoStudio from './InfluencerRecruitPromoStudio';
import { getInfluencerPublicCode } from '../utils/promoLinks';
import PayoutHistoryCard from './PayoutHistoryCard';

type InfluencerStatsRow = {
  profile_id: string;
  username: string | null;
  referral_code: string | null;
};

type RecruitedAccount = {
  id: string;
  recruited_profile_id: string;
  recruited_role: 'seller' | 'affiliate';
  created_at: string;
};

const InfluencerDashboard: React.FC = () => {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<InfluencerStatsRow | null>(null);
  const [copied, setCopied] = useState(false);
  const [storeSlug, setStoreSlug] = useState<string | null>(null);
  const [storeName, setStoreName] = useState<string | null>(null);
  const [recruitedAccounts, setRecruitedAccounts] = useState<RecruitedAccount[]>([]);

  const slugify = (value: string): string =>
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48);

  useEffect(() => {
    let alive = true;

    const load = async () => {
      setLoading(true);
      setError(null);

      const profileId = String((profile as any)?.id || '').trim();
      if (!profileId) {
        setLoading(false);
        return;
      }

      try {
        const [{ data }, { data: referralRows, error: referralError }] = await Promise.all([
          supabase
            .from('profiles')
            .select('id, username, referral_code')
            .eq('id', profileId)
            .maybeSingle(),
          supabase
            .from('influencer_referrals')
            .select('id,recruited_profile_id,recruited_role,created_at')
            .eq('influencer_profile_id', profileId)
            .order('created_at', { ascending: false }),
        ]);

        if (!alive) return;
        setStats({
          profile_id: String((data as any)?.id || profileId),
          username: (data as any)?.username ?? (profile as any)?.username ?? null,
          referral_code: (data as any)?.referral_code ?? null,
        });
        if (referralError) throw referralError;
        setRecruitedAccounts((referralRows as RecruitedAccount[]) || []);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message || 'Failed to load influencer recruiting tools');
      } finally {
        if (alive) setLoading(false);
      }
    };

    void load();
    return () => {
      alive = false;
    };
  }, [profile?.id]);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      const pid = String((profile as any)?.id || '').trim();
      if (!pid) return;
      try {
        const { data } = await supabase
          .from('affiliate_stores')
          .select('store_slug, store_name')
          .eq('profile_id', pid)
          .maybeSingle();
        if (!mounted) return;
        setStoreSlug((data as any)?.store_slug ? String((data as any).store_slug) : null);
        setStoreName((data as any)?.store_name ? String((data as any).store_name) : null);
      } catch {
        // Store naming is helpful for the invite code, but not required.
      }
    };
    void run();
    return () => {
      mounted = false;
    };
  }, [profile?.id]);

  const codeForLink = useMemo(() => {
    return getInfluencerPublicCode({
      username: profile?.username,
      storeSlug,
      storeName,
      referralCode: stats?.referral_code,
      profileId: profile?.id,
    });
  }, [profile?.id, profile?.username, stats?.referral_code, storeName, storeSlug]);

  const signupLink = useMemo(() => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const encoded = encodeURIComponent(codeForLink);
    return `${origin}/i/${encoded}`;
  }, [codeForLink]);

  const handleCopy = async () => {
    const copiedOk = await copyTextToClipboard(signupLink);
    if (copiedOk) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="text-gray-700">Loading influencer recruiting tools...</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {error ? (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">{error}</div>
      ) : null}

      <div id="influencer-promo" className="scroll-mt-32">
        <InfluencerRecruitPromoStudio
          code={codeForLink}
          influencerName={String((profile as any)?.full_name || (profile as any)?.email || '')}
        />
      </div>

      <div id="invite-link" className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex items-center gap-2 mb-3">
          <LinkIcon className="w-5 h-5 text-gray-600" />
          <h3 className="text-lg font-bold text-gray-900">Direct recruiting signup link</h3>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          Use this direct signup link when you want the recruit to land straight on signup with your influencer attribution attached. Seller and affiliate signup pages both carry the same recruiter code, and only the sale role that generated the sale should earn the influencer fee.
        </p>

        <div className="flex flex-col sm:flex-row gap-2">
          <input
            readOnly
            value={signupLink}
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 bg-gray-50"
          />
          <button
            onClick={handleCopy}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black"
          >
            <Copy className="w-4 h-4" />
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>

        <div className="mt-4 text-xs text-gray-500">
          Your code: <span className="font-semibold">{codeForLink || '-'}</span>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-purple-200 bg-purple-50 p-5">
          <div className="text-sm font-semibold text-purple-900">Recruited business accounts</div>
          <div className="mt-2 text-3xl font-bold text-gray-900">
            {new Set(recruitedAccounts.map((row) => row.recruited_profile_id)).size}
          </div>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
          <div className="text-sm font-semibold text-amber-900">Seller assignments</div>
          <div className="mt-2 text-3xl font-bold text-gray-900">
            {recruitedAccounts.filter((row) => row.recruited_role === 'seller').length}
          </div>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
          <div className="text-sm font-semibold text-emerald-900">Affiliate assignments</div>
          <div className="mt-2 text-3xl font-bold text-gray-900">
            {recruitedAccounts.filter((row) => row.recruited_role === 'affiliate').length}
          </div>
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-5 py-4">
          <h3 className="font-semibold text-gray-900">Lifetime referral assignments</h3>
          <p className="mt-1 text-sm text-gray-600">Each business can have a seller assignment and an affiliate assignment under the influencer who recruited it.</p>
        </div>
        {recruitedAccounts.length ? (
          <div className="divide-y divide-gray-100">
            {recruitedAccounts.slice(0, 20).map((row) => (
              <div key={row.id} className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
                <div>
                  <div className="font-medium capitalize text-gray-900">{row.recruited_role} activity</div>
                  <div className="text-xs text-gray-500">Business …{row.recruited_profile_id.slice(-8)}</div>
                </div>
                <div className="text-right text-xs text-gray-500">
                  Attached {new Date(row.created_at).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-5 py-8 text-center text-sm text-gray-500">No recruited business accounts yet. Share your invite link to begin.</div>
        )}
      </div>

      <div className="mt-6 rounded-xl border border-blue-200 bg-blue-50 p-6">
        <h3 className="text-lg font-semibold text-gray-900">How influencer earnings work</h3>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-white/80 bg-white p-4 text-sm text-gray-700">
            When a tracked recruit sells, Beezio logs the sale and the linked influencer earning.
          </div>
          <div className="rounded-lg border border-white/80 bg-white p-4 text-sm text-gray-700">
            Your earnings are paid from Beezio platform fees, not from seller payouts or affiliate commissions.
          </div>
          <div className="rounded-lg border border-white/80 bg-white p-4 text-sm text-gray-700">
            The payout history below shows what is still held, what is ready, and what has already been paid.
          </div>
        </div>
      </div>

      <div className="mt-6">
        <PayoutHistoryCard
          role="INFLUENCER"
          title="Influencer Earnings History"
          description="See each recorded influencer sale, hold status, and paid payout history."
        />
      </div>
    </div>
  );
};

export default InfluencerDashboard;
