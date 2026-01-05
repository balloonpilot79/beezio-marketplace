import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Users, TrendingUp, DollarSign, Calendar } from 'lucide-react';

interface ReferredAffiliate {
  id: string;
  referred_id: number;
  referral_code: string;
  status: string;
  total_sales: number;
  total_commission: number;
  created_at: string;
  email?: string;
}

export default function ReferredAffiliatesList() {
  const [referrals, setReferrals] = useState<ReferredAffiliate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchReferredAffiliates();
  }, []);

  const fetchReferredAffiliates = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setError('Please log in to view your referrals');
        return;
      }

      // Get all affiliates referred by this user
      const { data: referrals, error: referralsError } = await supabase
        .from('affiliate_referrals')
        .select(`
          id,
          referred_id,
          referral_code,
          status,
          total_sales,
          total_commission,
          created_at
        `)
        .eq('referrer_id', user.id)
        .order('created_at', { ascending: false });

      if (referralsError) throw referralsError;

      // Get email addresses for referred users (if allowed by RLS)
      if (referrals && referrals.length > 0) {
        const referredIds = referrals.map(r => r.referred_id);
        const { data: users } = await supabase
          .from('users')
          .select('id, email')
          .in('id', referredIds);

        // Merge email data
        const enrichedReferrals = referrals.map(ref => ({
          ...ref,
          email: users?.find(u => u.id === ref.referred_id)?.email || 'Hidden'
        }));

        setReferrals(enrichedReferrals);
      } else {
        setReferrals([]);
      }

    } catch (err: any) {
      console.error('Error fetching referred affiliates:', err);
      setError(err.message || 'Failed to load referrals');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Your Referrals</h2>
          <p className="text-gray-600 mt-1">
            Affiliates you've recruited to the platform
          </p>
        </div>
        <div className="bg-yellow-100 text-yellow-800 px-4 py-2 rounded-lg font-semibold">
          {referrals.length} Total
        </div>
      </div>

      {/* Referrals List */}
      {referrals.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center border border-gray-200">
          <Users className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            No Referrals Yet
          </h3>
          <p className="text-gray-600 mb-6">
            Share your referral link to start earning commissions from other affiliates!
          </p>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 max-w-md mx-auto">
            <p className="text-sm text-gray-700">
              💡 <strong>Tip:</strong> Share your link on social media, forums, or with 
              colleagues who might be interested in affiliate marketing.
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Affiliate
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Sales
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Your Commission
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Joined
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {referrals.map((referral) => (
                  <tr key={referral.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10 bg-yellow-100 rounded-full flex items-center justify-center">
                          <Users className="h-5 w-5 text-yellow-600" />
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {referral.email || 'Affiliate'}
                          </div>
                          <div className="text-sm text-gray-500">
                            Code: {referral.referral_code}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        referral.status === 'active'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {referral.status === 'active' ? (
                          <>
                            <TrendingUp className="h-3 w-3 mr-1" />
                            Active
                          </>
                        ) : (
                          referral.status
                        )}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-sm text-gray-900">
                        <DollarSign className="h-4 w-4 text-gray-400 mr-1" />
                        ${referral.total_sales?.toFixed(2) || '0.00'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-semibold text-green-600">
                        ${referral.total_commission?.toFixed(2) || '0.00'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex items-center">
                        <Calendar className="h-4 w-4 mr-1" />
                        {formatDate(referral.created_at)}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Summary */}
      {referrals.length > 0 && (
        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg shadow p-6 border border-green-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Summary</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-600">Total Referrals</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {referrals.length}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Sales Generated</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                ${referrals.reduce((sum, r) => sum + (r.total_sales || 0), 0).toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Commission Earned</p>
              <p className="text-2xl font-bold text-green-600 mt-1">
                ${referrals.reduce((sum, r) => sum + (r.total_commission || 0), 0).toFixed(2)}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
