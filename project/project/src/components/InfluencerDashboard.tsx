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

const InfluencerDashboard: React.FC = () => {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<InfluencerStatsRow | null>(null);
  const [copied, setCopied] = useState(false);
  const [storeSlug, setStoreSlug] = useState<string | null>(null);
  const [storeName, setStoreName] = useState<string | null>(null);

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
        const { data } = await supabase
          .from('profiles')
          .select('id, username, referral_code')
          .eq('id', profileId)
          .maybeSingle();

        if (!alive) return;
        setStats({
          profile_id: String((data as any)?.id || profileId),
          username: (data as any)?.username ?? (profile as any)?.username ?? null,
          referral_code: (data as any)?.referral_code ?? null,
        });
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
