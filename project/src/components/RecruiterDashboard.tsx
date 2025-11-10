import { useState, useEffect } from 'react';
import { Users, DollarSign, Link as LinkIcon, Copy, TrendingUp } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContextMultiRole';

interface Recruit {
  id: string;
  full_name: string;
  username: string;
  recruited_at: string;
  total_passive_earnings: number;
}

interface RecruiterStats {
  totalRecruits: number;
  totalPassiveEarnings: number;
  pendingEarnings: number;
  paidEarnings: number;
}

interface RecruiterEarning {
  id: string;
  amount: number;
  status: string;
  created_at: string;
  recruit_name: string;
  order_id: string;
}

export default function RecruiterDashboard() {
  const { profile } = useAuth();
  const [recruits, setRecruits] = useState<Recruit[]>([]);
  const [earnings, setEarnings] = useState<RecruiterEarning[]>([]);
  const [stats, setStats] = useState<RecruiterStats>({
    totalRecruits: 0,
    totalPassiveEarnings: 0,
    pendingEarnings: 0,
    paidEarnings: 0
  });
  const [recruitmentLink, setRecruitmentLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile) {
      loadRecruiterData();
      generateRecruitmentLink();
    }
  }, [profile]);

  const generateRecruitmentLink = () => {
    if (!profile) return;
    const baseUrl = window.location.origin;
    const link = `${baseUrl}/signup?ref=${profile.username || profile.id}`;
    setRecruitmentLink(link);
  };

  const loadRecruiterData = async () => {
    if (!profile) return;

    try {
      setLoading(true);

      // Get recruits with their profile data
      const { data: recruitsData, error: recruitsError } = await supabase
        .from('affiliate_recruiters')
        .select(`
          recruit_id,
          recruited_at,
          total_passive_earnings,
          profiles!affiliate_recruiters_recruit_id_fkey (
            id,
            full_name,
            username
          )
        `)
        .eq('recruiter_id', profile.id);

      if (recruitsError) throw recruitsError;

      // Transform the data
      const transformedRecruits = recruitsData?.map((r: any) => ({
        id: r.recruit_id,
        full_name: r.profiles?.full_name || 'Unknown',
        username: r.profiles?.username || '',
        recruited_at: r.recruited_at,
        total_passive_earnings: r.total_passive_earnings || 0
      })) || [];

      setRecruits(transformedRecruits);

      // Get earnings data
      const { data: earningsData, error: earningsError } = await supabase
        .from('recruiter_earnings')
        .select(`
          id,
          amount,
          status,
          created_at,
          order_id,
          profiles!recruiter_earnings_recruit_id_fkey (
            full_name
          )
        `)
        .eq('recruiter_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (earningsError) throw earningsError;

      const transformedEarnings = earningsData?.map((e: any) => ({
        id: e.id,
        amount: e.amount,
        status: e.status,
        created_at: e.created_at,
        order_id: e.order_id,
        recruit_name: e.profiles?.full_name || 'Unknown'
      })) || [];

      setEarnings(transformedEarnings);

      // Calculate stats
      const pending = earningsData?.filter(e => e.status === 'pending').reduce((sum, e) => sum + Number(e.amount), 0) || 0;
      const paid = earningsData?.filter(e => e.status === 'paid').reduce((sum, e) => sum + Number(e.amount), 0) || 0;

      setStats({
        totalRecruits: transformedRecruits.length,
        totalPassiveEarnings: pending + paid,
        pendingEarnings: pending,
        paidEarnings: paid
      });

    } catch (error) {
      console.error('Error loading recruiter data:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyRecruitmentLink = async () => {
    await navigator.clipboard.writeText(recruitmentLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading recruitment data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg p-6 text-white">
        <h2 className="text-2xl font-bold mb-2">💰 Build Your Passive Income Empire</h2>
        <p className="text-purple-100">
          Recruit affiliates and earn 5% commission on every sale they make. Forever.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-400 rounded-lg p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-700">Total Recruits</h3>
            <Users className="w-5 h-5 text-blue-600" />
          </div>
          <p className="text-3xl font-bold text-gray-900">{stats.totalRecruits}</p>
          <p className="text-xs text-gray-600 mt-1">Affiliates you recruited</p>
        </div>

        <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 border-2 border-yellow-400 rounded-lg p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-700">Pending Passive Income</h3>
            <DollarSign className="w-5 h-5 text-yellow-600" />
          </div>
          <p className="text-3xl font-bold text-gray-900">${stats.pendingEarnings.toFixed(2)}</p>
          <p className="text-xs text-gray-600 mt-1">From recruit sales</p>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 border-2 border-green-400 rounded-lg p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-700">Total Earned</h3>
            <TrendingUp className="w-5 h-5 text-green-600" />
          </div>
          <p className="text-3xl font-bold text-gray-900">${stats.totalPassiveEarnings.toFixed(2)}</p>
          <p className="text-xs text-gray-600 mt-1">Lifetime passive income</p>
        </div>
      </div>

      {/* Recruitment Link */}
      <div className="bg-gradient-to-r from-purple-50 to-purple-100 border-2 border-purple-400 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <LinkIcon className="w-5 h-5" />
          Your Recruitment Link
        </h3>
        <p className="text-sm text-gray-600 mb-3">
          Share this link to recruit new affiliates. You'll earn 5% passive income on all their sales! 🚀
        </p>
        <div className="flex gap-3 items-center">
          <input
            type="text"
            value={recruitmentLink}
            readOnly
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg bg-white text-sm"
          />
          <button
            onClick={copyRecruitmentLink}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2 transition-colors"
          >
            <Copy className="w-4 h-4" />
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
        <div className="mt-4 bg-white border border-purple-200 rounded-lg p-4">
          <h4 className="font-semibold text-gray-900 mb-2">💡 How It Works:</h4>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• Share your link on social media, email, or anywhere</li>
            <li>• People sign up as affiliates using your link</li>
            <li>• They promote products and earn full commissions (set by sellers)</li>
            <li>• You earn 5% passive income from Beezio's platform fee on their sales</li>
            <li>• Passive income that grows as your team grows!</li>
          </ul>
        </div>
      </div>

      {/* Recruits Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h3 className="text-lg font-semibold text-gray-900">Your Recruits ({stats.totalRecruits})</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Username</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Joined</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Your Earnings</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {recruits.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center">
                    <div className="text-gray-500">
                      <Users className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                      <p className="font-medium">No recruits yet</p>
                      <p className="text-sm mt-1">Share your recruitment link to start earning passive income!</p>
                    </div>
                  </td>
                </tr>
              ) : (
                recruits.map(recruit => (
                  <tr key={recruit.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {recruit.full_name}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      @{recruit.username || 'N/A'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {new Date(recruit.recruited_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold text-green-600">
                      ${recruit.total_passive_earnings?.toFixed(2) || '0.00'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Passive Earnings */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h3 className="text-lg font-semibold text-gray-900">Recent Passive Earnings</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Recruit</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {earnings.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center">
                    <div className="text-gray-500">
                      <DollarSign className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                      <p className="font-medium">No earnings yet</p>
                      <p className="text-sm mt-1">Earnings will appear here when your recruits make sales</p>
                    </div>
                  </td>
                </tr>
              ) : (
                earnings.map(earning => (
                  <tr key={earning.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {new Date(earning.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {earning.recruit_name}
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold text-green-600">
                      ${earning.amount.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        earning.status === 'paid' 
                          ? 'bg-green-100 text-green-800' 
                          : earning.status === 'pending'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {earning.status.charAt(0).toUpperCase() + earning.status.slice(1)}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
