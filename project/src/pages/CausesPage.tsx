import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const CausesPage: React.FC = () => {
  const [causes, setCauses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCauses();
  }, []);

  const fetchCauses = async () => {
    setLoading(true);
    const { data } = await supabase.from('causes').select('*');
    setCauses(data || []);
    setLoading(false);
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="max-w-5xl mx-auto py-12">
      <h1 className="text-4xl font-bold text-gray-900 mb-4">Current Fundraisers</h1>
      <p className="text-lg text-gray-700 mb-8">Support a fundraiser by purchasing through their unique link. Each fundraiser receives affiliate credit for purchases made from their page.</p>
      {causes.length === 0 ? (
        <div className="text-gray-500">No fundraisers found.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {causes.map(cause => (
            <Link key={cause.id} to={`/cause/${cause.id}`} className="block bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition">
              <img src={cause.image_url} alt={cause.title} className="w-full h-40 object-cover rounded mb-4" />
              <h2 className="text-2xl font-bold text-gray-900 mb-2">{cause.title}</h2>
              <p className="text-gray-700 mb-2 line-clamp-3">{cause.story}</p>
              <div className="text-sm text-gray-600 mb-2">Goal: ${cause.goal_amount.toLocaleString()}</div>
              <div className="text-sm text-gray-600 mb-2">Raised: ${cause.raised_amount.toLocaleString()}</div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-amber-500 h-3 rounded-full"
                  style={{ width: `${Math.min(100, (cause.raised_amount / cause.goal_amount) * 100)}%` }}
                ></div>
              </div>
              <div className="mt-4 text-green-700 text-sm font-semibold">Purchases made from this page help this fundraiser earn affiliate rewards!</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default CausesPage;
