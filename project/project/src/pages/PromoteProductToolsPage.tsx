import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Search, Share2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContextMultiRole';
import { supabase } from '../lib/supabase';
import { isPublicAffiliateProduct } from '../../shared/publicProductVisibility';
import { PROMOTION_FIELDS, PromotionProduct, promotionPriceLabel } from '../utils/promotionKit';
import ProductPromotionKit from '../components/affiliate/ProductPromotionKit';

export default function PromoteProductToolsPage() {
  const { user } = useAuth(); const [params,setParams] = useSearchParams();
  const id = params.get('product') || '';
  const [query,setQuery] = useState(''); const [search,setSearch] = useState('');
  const [products,setProducts] = useState<PromotionProduct[]>([]);
  const [product,setProduct] = useState<PromotionProduct|null>(null);
  const [link,setLink] = useState(''); const [error,setError] = useState(''); const [loading,setLoading] = useState(false);
  const [searchError,setSearchError] = useState(''); const [searching,setSearching] = useState(false);
  useEffect(()=>{
    let cancelled=false; setSearching(true); setSearchError('');
    (async()=>{
      let request = supabase.from('products').select(PROMOTION_FIELDS).eq('is_active',true).order('title').limit(60);
      if(search.trim()) request=request.ilike('title',`%${search.trim().replace(/[%_]/g,'')}%`);
      const {data,error}=await request;
      if(!cancelled) {setProducts((data||[]).filter(isPublicAffiliateProduct) as PromotionProduct[]); setSearching(false); if(error)setSearchError('Could not load products. Please retry your search.');}
    })(); return()=>{cancelled=true;};
  },[search]);
  useEffect(()=>{
    let cancelled=false; setProduct(null); setLink(''); setError('');
    if(!id || !user) return;
    setLoading(true);
    (async()=>{
      try {
        const {data,error}=await supabase.from('products').select(PROMOTION_FIELDS).eq('id',id).maybeSingle();
        if(error || !data || !isPublicAffiliateProduct(data)) throw new Error('This product is unavailable for promotion. Choose another product.');
        const {data:session}=await supabase.auth.getSession();
        if(!session.session?.access_token) throw new Error('Sign in again to create your tracked promotion.');
        const response=await fetch('/api/affiliate/link',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.session.access_token}`},body:JSON.stringify({target_type:'product',target_id:id,source:'copy',title:data.title})});
        const result=await response.json();
        if(!response.ok || !result.trackedUrl) throw new Error(result.error||'Could not create a tracked link.');
        const tracked=new URL(result.trackedUrl); tracked.searchParams.set('uid',user.id);
        if(!cancelled) {setProduct(data as PromotionProduct);setLink(tracked.toString());}
      } catch(e) {if(!cancelled)setError(e instanceof Error?e.message:'Could not load promotion.');}
      finally{if(!cancelled)setLoading(false);}
    })(); return()=>{cancelled=true;};
  },[id,user?.id]);
  return <main className="min-h-screen bg-[#faf9f5] px-3 pb-16 pt-6 text-slate-900 sm:px-6"><div className="mx-auto max-w-6xl">
    <Link to="/business?tab=products" className="inline-flex min-h-11 items-center gap-2 text-sm font-bold"><ArrowLeft size={16}/>Business Center</Link>
    <header className="my-4 rounded-3xl bg-[#101820] p-6 text-white sm:p-8"><div className="mb-3 text-sm font-bold uppercase tracking-widest text-[#ffcb05]">Beezio promotion kit</div><h1 className="text-3xl font-extrabold sm:text-4xl">Take your products everywhere.</h1><p className="mt-3 max-w-2xl text-base leading-7 text-slate-200">Social posts, short videos, QR flyers, website cards and collections — ready to share with your earning link. No storefront setup required.</p></header>
    <section className="mb-6 rounded-2xl border bg-white p-4 sm:p-6"><h2 className="font-bold"><Share2 className="mr-2 inline" size={18}/>Choose a product to promote</h2><form onSubmit={e=>{e.preventDefault();setSearch(query);}} className="mt-3 flex gap-2"><input aria-label="Search products to promote" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Try horse, storm, shirt…" className="min-w-0 flex-1 rounded-xl border p-3"/><button className="rounded-xl bg-amber-400 px-4 font-bold"><Search size={20}/><span className="sr-only">Search</span></button></form>
      <label className="mt-3 block text-sm font-semibold">Product<select aria-label="Product to promote" value={products.some(p=>p.id===id)?id:''} onChange={e=>setParams({product:e.target.value})} className="mt-2 w-full rounded-xl border p-3"><option value="">{searching?'Loading products…':product?product.title:'Select a product'}</option>{products.map(p=><option key={p.id} value={p.id}>{p.title} — {promotionPriceLabel(p)}</option>)}</select></label><p className="mt-2 text-xs text-slate-500">Showing up to 60 matching products. Search to find more.</p>{searchError&&<p role="alert" className="mt-2 text-red-700">{searchError}</p>}{!searching&&!products.length&&!searchError&&<p className="mt-2 text-sm">No matching products. Try another search.</p>}
    </section>
    {loading&&<p role="status" className="p-6">Preparing your tracked promotion…</p>}{error&&<p role="alert" className="rounded-xl bg-red-50 p-5 text-red-800">{error}</p>}
    {product&&link&&<ProductPromotionKit key={product.id} product={product} link={link} products={products}/>}
  </div></main>;
}
