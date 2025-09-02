import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const BuyerOrders: React.FC<{ buyerId: string }> = ({ buyerId }) => {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchOrders();
  }, [buyerId]);

  const fetchOrders = async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from('orders')
      .select('*, products(*)')
      .eq('buyer_id', buyerId)
      .order('created_at', { ascending: false });
    if (error) setError(error.message);
    else setOrders(data || []);
    setLoading(false);
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div className="text-red-500">{error}</div>;

  return (
    <div className="space-y-2">
      {orders.length === 0 ? (
        <div className="text-gray-500">No purchases found.</div>
      ) : (
        orders.map(order => (
          <div key={order.id} className="border-b py-2 flex items-center space-x-4">
            <img src={order.products?.images?.[0] || ''} alt={order.products?.title} className="w-10 h-10 object-cover rounded" />
            <span className="font-medium">{order.products?.title}</span>
            <span className="text-gray-600">${order.products?.price}</span>
            <span className="text-xs text-gray-500">{new Date(order.created_at).toLocaleDateString()}</span>
          </div>
        ))
      )}
    </div>
  );
};

export default BuyerOrders;
