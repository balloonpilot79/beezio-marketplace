import React, { useEffect, useMemo, useState } from 'react';
import { Copy, Link as LinkIcon, Megaphone, QrCode } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '../contexts/AuthContextMultiRole';
import { supabase } from '../lib/supabase';
import { copyTextToClipboard } from '../utils/clipboard';
import InfluencerRecruitPromoStudio from './InfluencerRecruitPromoStudio';
import { getInfluencerPublicCode } from '../utils/promoLinks';
import PayoutHistoryCard from './PayoutHistoryCard';
import ReferralShareActions from './ReferralShareActions';

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
    // Prefer a permanent referral code. The public resolver also accepts the
    // canonical profile UUID, so never publish a truncated/unresolvable fallback.
    return String(stats?.referral_code || (profile as any)?.referral_code || profile?.id ||
      getInfluencerPublicCode({
        username: profile?.username,
        storeSlug,
        storeName,
        referralCode: stats?.referral_code,
        profileId: profile?.id,
      }) || '').trim();
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

  const downloadInviteQr = () => {
    const svg = document.getElementById('beezio-influencer-signup-qr');
    if (!svg || !codeForLink) return;
    const markup = new XMLSerializer().serializeToString(svg);
    const blobUrl = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = 'beezio-influencer-signup-qr.svg';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(blobUrl);
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
        <ReferralShareActions
          referralUrl={signupLink}
          message="Join Beezio through my invite to start selling products or earning as an affiliate."
          className="mt-4"
        />
        <p className="mt-2 text-xs text-gray-500">
          Text invite opens your SMS app. Messenger copies the complete tracked invite before opening Messenger.
        </p>
      </div>

      <div className="mt-4 grid gap-4 rounded-xl border border-amber-200 bg-amber-50 p-4 sm:grid-cols-[180px_1fr] sm:p-6">
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl bg-white p-4">
          {codeForLink ? <QRCodeSVG id="beezio-influencer-signup-qr" value={signupLink} size={144} includeMargin aria-label="Influencer signup QR code" /> : <QrCode className="h-16 w-16 text-slate-300" />}
          <span className="text-center text-xs font-bold text-slate-700">Scan to join through you</span>
          <button type="button" disabled={!codeForLink} onClick={downloadInviteQr}
            className="mt-1 min-h-10 rounded-lg border border-amber-300 bg-amber-50 px-3 text-xs font-bold text-amber-900 disabled:opacity-50">Download QR for flyers</button>
        </div>
        <div className="space-y-3">
          <h3 className="flex items-center gap-2 text-lg font-bold text-slate-900"><Megaphone className="h-5 w-5 text-amber-700" /> Ready-to-share invitation</h3>
          <p className="text-sm leading-6 text-slate-700">
            Start your free Beezio store, list your own products, or earn commission promoting marketplace items. I use Beezio to help people earn from real product sales. Join through my link:
          </p>
          <p className="break-all rounded-lg bg-white px-3 py-2 text-xs font-medium text-slate-800">{signupLink}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void copyTextToClipboard(`Start selling or promoting real products on Beezio. Build your own free store and earn from qualifying product sales. Join through my link: ${signupLink}`)}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white"><Copy className="h-4 w-4" /> Copy invitation</button>
            <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(signupLink)}`} target="_blank" rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center rounded-lg border border-amber-300 bg-white px-4 text-sm font-semibold text-slate-800">Share on Facebook</a>
            <a href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(signupLink)}&text=${encodeURIComponent('Sell your own products or earn promoting marketplace products on Beezio.')}`} target="_blank" rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center rounded-lg border border-amber-300 bg-white px-4 text-sm font-semibold text-slate-800">Share on X</a>
          </div>
          <p className="text-xs text-slate-600">Joining connects a qualifying new business account to your influencer referral. Earnings are recorded only when qualifying product sales occur, subject to Beezio payout rules.</p>
        </div>
      </div>
      <div id="influencer-promo" className="mt-6 scroll-mt-32">
        <InfluencerRecruitPromoStudio
          code={codeForLink}
          influencerName={String((profile as any)?.full_name || (profile as any)?.email || '')}
        />
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
