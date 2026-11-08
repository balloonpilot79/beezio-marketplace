import { useEffect, useState } from 'react';

type PublicStore = { slug: string; name: string; image: string | null; productCount: number };

export function usePublicStores() {
  const [stores, setStores] = useState<PublicStore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    setLoading(true);
    setError(false);
    (async () => {
      try {
        const response = await fetch('/api/public/marketplace/products?stores_only=1', { signal: controller.signal });
        if (!response.ok) throw new Error('Stores unavailable');
        const payload = await response.json();
        if (!Array.isArray(payload.stores)) throw new Error('Invalid directory');
        if (active) setStores(payload.stores.filter((store: PublicStore) => store.productCount > 0).sort((a: PublicStore, b: PublicStore) => a.name.localeCompare(b.name)));
      } catch {
        if (active) setError(true);
      } finally {
        window.clearTimeout(timeout);
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; controller.abort(); window.clearTimeout(timeout); };
  }, [attempt]);
  return { stores, loading, error, retry: () => setAttempt(value => value + 1) };
}
