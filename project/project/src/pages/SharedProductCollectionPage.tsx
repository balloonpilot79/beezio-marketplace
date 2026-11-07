import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { parseCollectionIds, PROMOTION_FIELDS, PromotionProduct, promotionPriceLabel, shippingLabel } from '../utils/promotionKit';
import { isPublicAffiliateProduct } from '../../shared/publicProductVisibility';

export default function SharedProductCollectionPage() {
  const [params]=useSearchParams(); const [products,setProducts]=useState<PromotionProduct[]>([]); const [loading,setLoading]=useState(true); const [error,setError]=useState('');
  const raw=params.get('items')||'';
  useEffect(()=>{
    let cancelled=false;setLoading(true);setError(''); const ids=parseCollectionIds(raw);
    (async()=>{
      if(!ids.length){if(!cancelled){setProducts([]);setLoading(false);}return;}
      const {data,error}=await supabase.from('products').select(PROMOTION_FIELDS).in('id',ids);
      if(!cancelled){setProducts((data||[]).filter(isPublicAffiliateProduct).sort((a,b)=>ids.indexOf(a.id)-ids.indexOf(b.id)) as PromotionProduct[]);setLoading(false);if(error)setError('Could not load these products. Please refresh to try again.');}
    })();return()=>{cancelled=true;};
  },[raw]);
  const href=(id:string)=>{
    const query=new URLSearchParams();['ref','uid','code','utm_source','utm_medium','utm_campaign'].forEach(k=>{const v=params.get(k);if(v)query.set(k,v);});
    return `/product/${encodeURIComponent(id)}?${query.toString()}`;
  };
  return <main className="min-h-screen bg-[#faf9f5] px-4 py-10"><div className="mx-auto max-w-6xl"><Link to="/marketplace" className="font-bold text-amber-800">Beezio.co</Link><h1 className="mt-4 text-3xl font-extrabold">{(params.get('title')||'Product picks').slice(0,80)}</h1><p className="mt-3 text-sm text-slate-600">A shared selection of products. The person sharing this collection may earn a commission from purchases. Check each product for current options and delivery coverage.</p>{loading&&<p role="status" className="mt-6">Loading products…</p>}{error&&<p role="alert" className="mt-6 text-red-700">{error}</p>}{!loading&&!error&&!products.length&&<p className="mt-6">These products are no longer available. <Link to="/marketplace" className="underline">Browse the marketplace</Link>.</p>}
    <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{products.map(p=><Link key={p.id} to={href(p.id)} className="rounded-2xl border bg-white p-5 shadow-sm hover:border-amber-500">{p.images?.[0]&&<img src={p.images[0]} alt={p.title} className="h-64 w-full object-contain"/>}<h2 className="mt-4 text-lg font-bold">{p.title}</h2><p className="mt-2 text-xl font-extrabold">{promotionPriceLabel(p)}</p><p className="mt-1 text-xs text-slate-600">{shippingLabel(p)}</p><span className="mt-4 block rounded-xl bg-amber-400 p-3 text-center font-bold">View product</span></Link>)}</div>
  </div></main>;
}
