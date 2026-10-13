import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Search, Store } from 'lucide-react';
import PublicLayout from '../components/layout/PublicLayout';

type PublicStore = { slug: string; name: string; image: string | null; productCount: number };

const StoresPage: React.FC = () => {
  const [stores, setStores] = useState<PublicStore[]>([]);
  const [query, setQuery] = useState('');
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
        const response = await fetch('/api/public/marketplace/products?include_stores=1', { signal: controller.signal });
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
  const visibleStores = useMemo(() => stores.filter(store => store.name.toLowerCase().includes(query.trim().toLowerCase())), [stores, query]);
  return (
    <PublicLayout>
      <header className="max-w-2xl">
        <p className="bz-eyebrow">Discover stores</p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-5xl">Independent stores. Ready to explore.</h1>
        <p className="mt-5 leading-7 text-slate-600">Browse Beezio storefronts with live products. Explore each collection and shop directly from the store.</p>
      </header>
      <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex w-full max-w-md items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
          <Search className="h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />
          <input aria-label="Search stores" placeholder="Search stores" value={query} onChange={event => setQuery(event.target.value)} className="min-w-0 w-full bg-transparent outline-none" />
        </label>
        <Link to="/signup" className="bz-text-link">Create your free store <ArrowRight className="h-4 w-4" /></Link>
      </div>
      {loading ? <p className="mt-8 text-slate-600" role="status">Loading stores…</p> : error ? (
        <div className="bz-panel mt-8 p-6" role="alert"><p>We couldn’t load the stores right now.</p><button className="bz-button bz-button-gold mt-4" onClick={() => setAttempt(value => value + 1)}>Try again</button></div>
      ) : (
        <>
          <p className="mt-6 text-sm text-slate-500">{visibleStores.length} {visibleStores.length === 1 ? 'store' : 'stores'}</p>
          <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {visibleStores.map(store => (
              <Link key={store.slug} to={`/store/${encodeURIComponent(store.slug)}`} className="bz-panel overflow-hidden transition-shadow hover:shadow-lg">
                <div className="flex h-56 items-center justify-center bg-[#faf9f5] p-5">{store.image ? <img src={store.image} alt={`${store.name} collection`} loading="lazy" className="h-full w-full object-contain" /> : <Store className="h-16 w-16 text-slate-400" aria-hidden="true" />}</div>
                <div className="p-6"><h2 className="text-xl font-semibold">{store.name}</h2><p className="mt-2 text-sm text-slate-600">{store.productCount} {store.productCount === 1 ? 'live product' : 'live products'}</p><span className="bz-text-link mt-5">Visit store <ArrowRight className="h-4 w-4" /></span></div>
              </Link>
            ))}
          </div>
          {!visibleStores.length && <p className="mt-8 text-slate-600">{query.trim() ? 'No stores match your search. Try another name.' : 'New stores are coming. Browse the marketplace to see available products.'}</p>}
        </>
      )}
    </PublicLayout>
  );
};
export default StoresPage;
