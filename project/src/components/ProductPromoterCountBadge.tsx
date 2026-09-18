import React, { useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import { supabase } from '../lib/supabase';

/** Non-critical marketplace metric. If the optional RPC is not installed, show zero. */
const ProductPromoterCountBadge: React.FC<{ productId: string }> = ({ productId }) => {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let active = true;
    if (!productId) return;
    supabase.rpc('get_product_promoter_counts', { p_product_ids: [productId] })
      .then(({ data }) => {
        if (active) setCount(Number(data?.[0]?.promoter_count || 0));
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, [productId]);
  return (
    <div className="inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm border border-slate-200">
      <Users className="h-3.5 w-3.5" />
      {count === 1 ? '1 person selling this' : `${count} people selling this`}
    </div>
  );
};

export default ProductPromoterCountBadge;

