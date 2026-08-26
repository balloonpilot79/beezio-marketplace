import React, { useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import { supabase } from '../lib/supabase';

const cache = new Map<string, { count: number; expiresAt: number }>();
const pending = new Set<string>();
const listeners = new Map<string, Set<(count: number) => void>>();
let flushScheduled = false;

function notify(productId: string, count: number) {
  cache.set(productId, { count, expiresAt: Date.now() + 30_000 });
  listeners.get(productId)?.forEach((listener) => listener(count));
  listeners.delete(productId);
}

async function flush() {
  flushScheduled = false;
  const ids = Array.from(pending);
  pending.clear();
  if (!ids.length) return;

  const { data, error } = await supabase.rpc('get_product_promoter_counts', {
    p_product_ids: ids,
  });

  if (error) {
    // Keep the UI quiet on a non-critical metric failure.
    ids.forEach((id) => notify(id, cache.get(id)?.count || 0));
    return;
  }

  const counts = new Map<string, number>();
  (data || []).forEach((row: any) => {
    counts.set(String(row.product_id), Number(row.promoter_count || 0));
  });
  ids.forEach((id) => notify(id, counts.get(id) || 0));
}

function schedule(productId: string) {
  const cached = cache.get(productId);
  if (cached && cached.expiresAt > Date.now()) return;
  pending.add(productId);
  if (!flushScheduled) {
    flushScheduled = true;
    queueMicrotask(() => void flush());
  }
}

export function useProductPromoterCount(productId: string) {
  const [count, setCount] = useState(() => cache.get(productId)?.count || 0);

  useEffect(() => {
    const id = String(productId || '').trim();
    if (!id) return;
    const cached = cache.get(id);
    if (cached && cached.expiresAt > Date.now()) {
      setCount(cached.count);
      return;
    }
    const set = listeners.get(id) || new Set<(value: number) => void>();
    set.add(setCount);
    listeners.set(id, set);
    schedule(id);
    return () => {
      const current = listeners.get(id);
      current?.delete(setCount);
      if (current && current.size === 0) listeners.delete(id);
    };
  }, [productId]);

  return count;
}

export const ProductPromoterCountBadge: React.FC<{ productId: string; className?: string }> = ({ productId, className = '' }) => {
  const count = useProductPromoterCount(productId);
  return (
    <div className={`inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm border border-slate-200 ${className}`}>
      <Users className="h-3.5 w-3.5" />
      {count === 1 ? '1 person selling this' : `${count} people selling this`}
    </div>
  );
};

export default ProductPromoterCountBadge;
