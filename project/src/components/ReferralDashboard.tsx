import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Copy, Check, Users, DollarSign, TrendingUp } from 'lucide-react';

interface ReferralStats {
  referralCode: string;
  totalReferrals: number;
  activeReferrals: number;
  totalEarnings: number;
  pendingEarnings: number;
}

export default function ReferralDashboard() {
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchReferralStats();
  }, []);

  const fetchReferralStats = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setError('Please log in to view referral dashboard');
        return;
      }

      // Get user's referral code
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('referral_code')
        .eq('id', user.id)
        .single();

      if (userError) throw userError;

      if (!userData?.referral_code) {
        setError('Referral code not found. Please contact support.');
        return;
      }

      // Get referral stats
      const { data: referrals, error: referralsError } = await supabase
        .from('affiliate_referrals')
        .select('id, status, total_sales, total_commission')
        .eq('referrer_id', user.id);

      if (referralsError) throw referralsError;

      // Get commission stats
      const { data: commissions, error: commissionsError } = await supabase
        .from('referral_commissions')
        .select('commission_amount, status')
        .eq('referrer_id', user.id);

      if (commissionsError) throw commissionsError;

      const totalReferrals = referrals?.length || 0;
      const activeReferrals = referrals?.filter(r => r.status === 'active').length || 0;
      
      const totalEarnings = commissions
        ?.filter(c => c.status === 'paid')
        .reduce((sum, c) => sum + parseFloat(c.commission_amount.toString()), 0) || 0;
      
      const pendingEarnings = commissions
        ?.filter(c => c.status === 'pending')
        .reduce((sum, c) => sum + parseFloat(c.commission_amount.toString()), 0) || 0;

      setStats({
        referralCode: userData.referral_code,
        totalReferrals,
        activeReferrals,
        totalEarnings,
        pendingEarnings
      });

    } catch (err: any) {
      console.error('Error fetching referral stats:', err);
      setError(err.message || 'Failed to load referral stats');
    } finally {
      setLoading(false);
    }
  };

  const getReferralLink = () => {
    if (!stats?.referralCode) return '';
    return `${window.location.origin}/signup?ref=${stats.referralCode}`;
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(getReferralLink());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Referral Program</h2>
        <p className="text-gray-600 mt-1">
          Earn 2% commission from all sales made by affiliates you refer
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Referrals</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.totalReferrals}</p>
            </div>
            <Users className="h-8 w-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active Referrals</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.activeReferrals}</p>
            </div>
            <TrendingUp className="h-8 w-8 text-green-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Earnings</p>
              <p className="text-2xl font-bold text-green-600 mt-1">
                ${stats.totalEarnings.toFixed(2)}
              </p>
            </div>
            <DollarSign className="h-8 w-8 text-green-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Pending</p>
              <p className="text-2xl font-bold text-yellow-600 mt-1">
                ${stats.pendingEarnings.toFixed(2)}
              </p>
            </div>
            <DollarSign className="h-8 w-8 text-yellow-500" />
          </div>
        </div>
      </div>

      {/* Referral Link Section */}
      <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-lg shadow-lg p-6 border border-yellow-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Your Referral Link</h3>
        <p className="text-sm text-gray-600 mb-4">
          Share this link with other affiliates. You'll earn 2% from their sales!
        </p>
        
        <div className="bg-white rounded-lg p-4 border border-gray-300 mb-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 overflow-hidden">
              <p className="text-xs text-gray-500 mb-1">Your Code:</p>
              <p className="text-2xl font-bold text-yellow-600 tracking-wider">
                {stats.referralCode}
              </p>
            </div>
            <button
              onClick={copyToClipboard}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all ${
                copied
                  ? 'bg-green-500 text-white'
                  : 'bg-yellow-500 text-white hover:bg-yellow-600'
              }`}
            >
              {copied ? (
                <>
                  <Check className="h-5 w-5" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-5 w-5" />
                  Copy Link
                </>
              )}
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg p-3 border border-gray-300">
          <p className="text-xs text-gray-500 mb-1">Full Link:</p>
          <p className="text-sm text-gray-700 font-mono break-all">
            {getReferralLink()}
          </p>
        </div>
      </div>

      {/* How It Works */}
      <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">How It Works</h3>
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-8 h-8 bg-yellow-500 text-white rounded-full flex items-center justify-center font-bold">
              1
            </div>
            <div>
              <p className="font-medium text-gray-900">Share Your Link</p>
              <p className="text-sm text-gray-600">
                Send your referral link to other affiliates who want to join Beezio
              </p>
            </div>
          </div>
          
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-8 h-8 bg-yellow-500 text-white rounded-full flex items-center justify-center font-bold">
              2
            </div>
            <div>
              <p className="font-medium text-gray-900">They Sign Up</p>
              <p className="text-sm text-gray-600">
                When they create an account using your link, they become your referral
              </p>
            </div>
          </div>
          
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-8 h-8 bg-yellow-500 text-white rounded-full flex items-center justify-center font-bold">
              3
            </div>
            <div>
              <p className="font-medium text-gray-900">Earn Commissions</p>
              <p className="text-sm text-gray-600">
                You earn 2% from every sale they make. The more they sell, the more you earn!
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
