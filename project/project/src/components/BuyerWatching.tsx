import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const BuyerWatching: React.FC<{ buyerId: string }> = ({ buyerId }) => {
  const [watching, setWatching] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchWatching();
  }, [buyerId]);

  const fetchWatching = async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from('watching_items')
      .select('*, products(*)')
      .eq('buyer_id', buyerId)
      .order('added_at', { ascending: false });
    if (error) setError(error.message);
    else setWatching(data || []);
    setLoading(false);
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div className="text-red-500">{error}</div>;

  return (
    <div className="space-y-2">
      {watching.length === 0 ? (
        <div className="text-gray-500">No items being watched.</div>
      ) : (
        watching.map(item => (
          <div key={item.id} className="border-b py-2 flex items-center space-x-4">
            <img src={item.products?.images?.[0] || ''} alt={item.products?.title} className="w-10 h-10 object-cover rounded" />
            <span className="font-medium">{item.products?.title}</span>
            <span className="text-gray-600">${item.products?.price}</span>
            <span className="text-xs text-gray-500">{new Date(item.added_at).toLocaleDateString()}</span>
          </div>
        ))
      )}
    </div>
  );
};

export default BuyerWatching;
