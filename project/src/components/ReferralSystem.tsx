import React, { useState, useEffect } from 'react';
import { Share2, Copy, DollarSign, Users, TrendingUp, ExternalLink } from 'lucide-react';
import { useAuth } from '../contexts/AuthContextMultiRole';
import { supabase } from '../lib/supabase';
import BZOButton from './BZOButton';

interface ReferralStats {
  totalReferrals: number;
  totalCommissions: number;
  pendingCommissions: number;
  thisMonthReferrals: number;
  recentCommissions: any[];
}

const ReferralSystem: React.FC = () => {
  const { user, profile } = useAuth();
  const [stats, setStats] = useState<ReferralStats>({
    totalReferrals: 0,
    totalCommissions: 0,
    pendingCommissions: 0,
    thisMonthReferrals: 0,
    recentCommissions: []
  });
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const referralCode = profile?.referral_code;
  const referralUrl = `${window.location.origin}?ref=${referralCode}`;

  useEffect(() => {
    if (user && referralCode) {
      loadReferralStats();
    }
  }, [user, referralCode]);

  const loadReferralStats = async () => {
    try {
      setLoading(true);

      // Get referral relationships
      const { data: referrals } = await supabase
        .from('referrals')
        .select('*')
        .eq('referrer_id', user?.id);

      // Get commission data
      const { data: commissions } = await supabase
        .from('referral_commissions')
        .select(`
          *,
          referrals!inner(referrer_id)
        `)
        .eq('referrals.referrer_id', user?.id)
        .order('created_at', { ascending: false })
        .limit(10);

      // Calculate stats
      const totalReferrals = referrals?.length || 0;
      const totalCommissions = commissions?.reduce((sum, c) => sum + parseFloat(c.commission_amount || '0'), 0) || 0;
      const pendingCommissions = commissions?.filter(c => c.payment_status === 'pending')
        .reduce((sum, c) => sum + parseFloat(c.commission_amount || '0'), 0) || 0;

      // This month referrals
      const thisMonth = new Date();
      thisMonth.setDate(1);
      const thisMonthReferrals = referrals?.filter(r => new Date(r.signup_date) >= thisMonth).length || 0;

      setStats({
        totalReferrals,
        totalCommissions,
        pendingCommissions,
        thisMonthReferrals,
        recentCommissions: commissions || []
      });

    } catch (error) {
      console.error('Error loading referral stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyReferralUrl = async () => {
    try {
      await navigator.clipboard.writeText(referralUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const shareViaWeb = () => {
    if (navigator.share) {
      navigator.share({
        title: 'Join Beezio with my referral link!',
        text: 'Sign up for Beezio using my referral link and start earning together! 🐝',
        url: referralUrl
      });
    } else {
      // Fallback to copy
      copyReferralUrl();
    }
  };

  if (!referralCode) {
    return (
      <div className="card-bzo p-6 text-center">
        <div className="text-4xl mb-4">🤝</div>
        <h3 className="text-xl font-bold text-bzo-black mb-2">Referral System Loading...</h3>
        <p className="text-gray-600">Setting up your referral code...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-3xl font-bold text-bzo-black mb-2 flex items-center justify-center gap-2">
          <span className="text-3xl">🤝</span>
          Referral Program
        </h2>
        <p className="text-gray-600">Earn 5% commission on every sale your referrals make - for life!</p>
      </div>

      {/* Referral Link Card */}
      <div className="card-bzo p-6 bg-gradient-to-r from-bzo-yellow-light to-bzo-white border-2 border-bzo-yellow-primary/30">
        <h3 className="text-xl font-bold text-bzo-black mb-4 flex items-center gap-2">
          <Share2 className="w-6 h-6 text-bzo-yellow-primary" />
          Your Referral Link
        </h3>
        
        <div className="space-y-4">
          <div className="bg-bzo-white p-4 rounded-xl border border-gray-200">
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-bzo-black mb-1">Your Code: {referralCode}</p>
                <p className="text-xs text-gray-600 truncate">{referralUrl}</p>
              </div>
              <div className="flex gap-2">
                <BZOButton
                  size="sm"
                  variant="outline"
                  onClick={copyReferralUrl}
                >
                  {copied ? '✅ Copied!' : <Copy className="w-4 h-4" />}
                </BZOButton>
                <BZOButton
                  size="sm"
                  variant="primary"
                  onClick={shareViaWeb}
                >
                  <Share2 className="w-4 h-4" />
                </BZOButton>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="bg-bzo-yellow-primary/10 p-3 rounded-lg">
              <div className="text-lg font-bold text-bzo-black">5%</div>
              <div className="text-xs text-gray-600">Commission Rate</div>
            </div>
            <div className="bg-bzo-yellow-primary/10 p-3 rounded-lg">
              <div className="text-lg font-bold text-bzo-black">♾️</div>
              <div className="text-xs text-gray-600">Lifetime Earnings</div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card-bzo p-4 text-center">
          <div className="flex justify-center mb-2">
            <Users className="w-8 h-8 text-bzo-yellow-primary" />
          </div>
          <div className="text-2xl font-bold text-bzo-black">{stats.totalReferrals}</div>
          <div className="text-xs text-gray-600">Total Referrals</div>
        </div>

        <div className="card-bzo p-4 text-center">
          <div className="flex justify-center mb-2">
            <DollarSign className="w-8 h-8 text-green-600" />
          </div>
          <div className="text-2xl font-bold text-bzo-black">${stats.totalCommissions.toFixed(2)}</div>
          <div className="text-xs text-gray-600">Total Earned</div>
        </div>

        <div className="card-bzo p-4 text-center">
          <div className="flex justify-center mb-2">
            <TrendingUp className="w-8 h-8 text-bzo-yellow-secondary" />
          </div>
          <div className="text-2xl font-bold text-bzo-black">${stats.pendingCommissions.toFixed(2)}</div>
          <div className="text-xs text-gray-600">Pending</div>
        </div>

        <div className="card-bzo p-4 text-center">
          <div className="flex justify-center mb-2">
            <Users className="w-8 h-8 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-bzo-black">{stats.thisMonthReferrals}</div>
          <div className="text-xs text-gray-600">This Month</div>
        </div>
      </div>

      {/* How It Works */}
      <div className="card-bzo p-6">
        <h3 className="text-xl font-bold text-bzo-black mb-4">How It Works</h3>
        <div className="grid md:grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-3xl mb-2">1️⃣</div>
            <h4 className="font-semibold text-bzo-black mb-1">Share Your Link</h4>
            <p className="text-sm text-gray-600">Share your unique referral link with friends, family, or on social media</p>
          </div>
          <div className="text-center">
            <div className="text-3xl mb-2">2️⃣</div>
            <h4 className="font-semibold text-bzo-black mb-1">They Sign Up</h4>
            <p className="text-sm text-gray-600">When someone signs up using your link, they become your referral</p>
          </div>
          <div className="text-center">
            <div className="text-3xl mb-2">3️⃣</div>
            <h4 className="font-semibold text-bzo-black mb-1">You Earn 5%</h4>
            <p className="text-sm text-gray-600">Earn 5% commission on every purchase they make - forever!</p>
          </div>
        </div>
      </div>

      {/* Recent Commissions */}
      {stats.recentCommissions.length > 0 && (
        <div className="card-bzo p-6">
          <h3 className="text-xl font-bold text-bzo-black mb-4">Recent Commissions</h3>
          <div className="space-y-3">
            {stats.recentCommissions.slice(0, 5).map((commission, index) => (
              <div key={commission.id} className="flex justify-between items-center p-3 bg-bzo-yellow-light/30 rounded-lg">
                <div>
                  <p className="font-medium text-bzo-black">${commission.commission_amount}</p>
                  <p className="text-sm text-gray-600">
                    From ${commission.sale_amount} sale • {new Date(commission.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                  commission.payment_status === 'paid' 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-bzo-yellow-primary text-bzo-black'
                }`}>
                  {commission.payment_status === 'paid' ? '✅ Paid' : '⏳ Pending'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pro Tips */}
      <div className="card-bzo p-6 bg-gradient-to-r from-bzo-yellow-light/50 to-bzo-white">
        <h3 className="text-xl font-bold text-bzo-black mb-4">💡 Pro Tips for More Referrals</h3>
        <div className="space-y-3 text-sm">
          <div className="flex items-start gap-2">
            <span className="text-bzo-yellow-primary">•</span>
            <span>Share on social media with a personal story about Beezio</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-bzo-yellow-primary">•</span>
            <span>Include your referral link in your email signature</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-bzo-yellow-primary">•</span>
            <span>Tell friends about the products you're selling or promoting</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-bzo-yellow-primary">•</span>
            <span>Join relevant online communities and share when appropriate</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReferralSystem;