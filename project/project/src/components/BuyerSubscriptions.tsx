import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface Subscription {
  id: string;
  product_id: string;
  product_title: string;
  interval: 'weekly' | 'monthly';
  status: 'active' | 'canceled';
}

const BuyerSubscriptions: React.FC<{ buyerId: string }> = ({ buyerId }) => {
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [canceling, setCanceling] = useState<string | null>(null);

  useEffect(() => {
    fetchSubscriptions();
  }, [buyerId]);

  const fetchSubscriptions = async () => {
    setLoading(true);
    setError(null);
    // Replace with your actual subscription fetch logic
    const { data, error } = await supabase
      .from('subscriptions')
      .select('id, product_id, interval, status, products:title')
      .eq('buyer_id', buyerId)
      .eq('status', 'active');
    if (error) {
      setError(error.message);
    } else {
      setSubs(
        (data || []).map((s: any) => ({
          id: s.id,
          product_id: s.product_id,
          product_title: s.products?.title || 'Product',
          interval: s.interval,
          status: s.status,
        }))
      );
    }
    setLoading(false);
  };

  const handleCancel = async (subId: string) => {
    if (!window.confirm('Are you sure you want to cancel this subscription?')) return;
    setCanceling(subId);
    // Replace with your actual cancel logic
    const { error } = await supabase
      .from('subscriptions')
      .update({ status: 'canceled' })
      .eq('id', subId);
    if (error) {
      alert('Failed to cancel subscription.');
    } else {
      setSubs(subs => subs.filter(s => s.id !== subId));
    }
    setCanceling(null);
  };

  if (loading) return <div>Loading subscriptions...</div>;
  if (error) return <div className="text-red-500">{error}</div>;
  if (subs.length === 0) return <div className="text-gray-500">No active subscriptions.</div>;

  return (
    <div className="space-y-4">
      {subs.map(sub => (
        <div key={sub.id} className="flex items-center justify-between border-b py-2">
          <div>
            <div className="font-medium">{sub.product_title}</div>
            <div className="text-xs text-gray-500">{sub.interval.charAt(0).toUpperCase() + sub.interval.slice(1)} subscription</div>
          </div>
          <button
            onClick={() => handleCancel(sub.id)}
            disabled={canceling === sub.id}
            className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 disabled:opacity-50"
          >
            {canceling === sub.id ? 'Canceling...' : 'Cancel Subscription'}
          </button>
        </div>
      ))}
    </div>
  );
};

export default BuyerSubscriptions;
