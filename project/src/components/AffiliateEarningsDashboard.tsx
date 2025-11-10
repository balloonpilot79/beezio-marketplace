import React, { useState, useEffect } from 'react';
import { DollarSign, TrendingUp, Clock, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContextMultiRole';

interface Earnings {
  pending: number;
  paid: number;
  total: number;
}

interface EarningRecord {
  id: string;
  amount: number;
  status: 'pending' | 'paid' | 'cancelled';
  created_at: string;
  paid_at: string | null;
  order_id: string;
}

export default function AffiliateEarningsDashboard() {
  const { profile } = useAuth();
  const [earnings, setEarnings] = useState<Earnings>({ pending: 0, paid: 0, total: 0 });
  const [earningRecords, setEarningRecords] = useState<EarningRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile) {
      loadEarnings();
    }
  }, [profile]);

  const loadEarnings = async () => {
    if (!profile) return;

    try {
      const { data, error } = await supabase
        .from('affiliate_earnings')
        .select('*')
        .eq('affiliate_id', profile.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const records = data || [];
      const pending = records.filter(r => r.status === 'pending').reduce((sum, r) => sum + Number(r.amount), 0);
      const paid = records.filter(r => r.status === 'paid').reduce((sum, r) => sum + Number(r.amount), 0);

      setEarnings({
        pending,
        paid,
        total: pending + paid
      });
      setEarningRecords(records);
      setLoading(false);
    } catch (error) {
      console.error('Error loading earnings:', error);
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading earnings...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Earnings Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 border-2 border-yellow-400 rounded-lg p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-700">Pending Earnings</h3>
            <Clock className="w-5 h-5 text-yellow-600" />
          </div>
          <p className="text-3xl font-bold text-gray-900">${earnings.pending.toFixed(2)}</p>
          <p className="text-xs text-gray-600 mt-1">Awaiting payout</p>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 border-2 border-green-400 rounded-lg p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-700">Paid Out</h3>
            <CheckCircle className="w-5 h-5 text-green-600" />
          </div>
          <p className="text-3xl font-bold text-gray-900">${earnings.paid.toFixed(2)}</p>
          <p className="text-xs text-gray-600 mt-1">All-time earnings</p>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-400 rounded-lg p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-700">Total Earned</h3>
            <TrendingUp className="w-5 h-5 text-blue-600" />
          </div>
          <p className="text-3xl font-bold text-gray-900">${earnings.total.toFixed(2)}</p>
          <p className="text-xs text-gray-600 mt-1">Lifetime commissions</p>
        </div>
      </div>

      {/* Request Payout Button */}
      {earnings.pending > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-gray-900">Ready to withdraw?</h4>
              <p className="text-sm text-gray-600">You have ${earnings.pending.toFixed(2)} available for payout</p>
            </div>
            <button className="px-6 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 font-medium">
              Request Payout
            </button>
          </div>
        </div>
      )}

      {/* Earnings History */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Earnings History</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Paid On</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {earningRecords.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                    No earnings yet. Start promoting your products!
                  </td>
                </tr>
              ) : (
                earningRecords.map(record => (
                  <tr key={record.id}>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {new Date(record.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      ${Number(record.amount).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        record.status === 'paid' 
                          ? 'bg-green-100 text-green-800'
                          : record.status === 'pending'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {record.status.charAt(0).toUpperCase() + record.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {record.paid_at ? new Date(record.paid_at).toLocaleDateString() : '-'}
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
