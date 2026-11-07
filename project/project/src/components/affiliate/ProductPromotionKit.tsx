import React, { useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, Download, Share2, Video } from 'lucide-react';
import { cardEmbed, collectionLink, promotionCaption, PromotionProduct, promotionPriceLabel } from '../../utils/promotionKit';
import { canvasBlob, drawPromo, loadPromoImage, PROMO_FORMATS, recordPromo, savePromoFile } from '../../utils/promotionCanvas';
import { copyTextToClipboard } from '../../utils/clipboard';

const button = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-900 disabled:opacity-40';
export default function ProductPromotionKit({ product, link, products }: { product: PromotionProduct; link: string; products: PromotionProduct[] }) {
  const [formatId,setFormatId] = useState('square');
  const [imageIndex,setImageIndex] = useState(0);
  const [caption,setCaption] = useState(() => promotionCaption(product,link));
  const [busy,setBusy] = useState(''); const [message,setMessage] = useState(''); const [error,setError] = useState('');
  const [ready,setReady] = useState(false);
  const [collectionTitle,setCollectionTitle] = useState('My product picks');
  const [collectionIds,setCollectionIds] = useState([product.id]);
  const canvas = useRef<HTMLCanvasElement>(null); const qr = useRef<HTMLDivElement>(null);
  const assets = useRef<{ image: HTMLImageElement; qr: HTMLImageElement } | null>(null);
  const format = PROMO_FORMATS.find(f=>f.id===formatId)!;
  const pickedLink = collectionLink(link,collectionIds,collectionTitle);
  const embed = cardEmbed(product,link);
  useEffect(() => {
    let cancelled = false; setReady(false); setError(''); assets.current=null;
    (async () => {
      try {
        const svg = qr.current?.querySelector('svg'); if(!svg || !product.images?.[imageIndex]) throw new Error('A product image is required for downloads. Links and captions are still available.');
        const qrUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(svg))}`;
        const [image,qrImage] = await Promise.all([loadPromoImage(product.images[imageIndex]),loadPromoImage(qrUrl)]);
        if(cancelled || !canvas.current) return;
        assets.current={ image,qr:qrImage }; drawPromo(canvas.current,product,image,qrImage,format);
        await canvasBlob(canvas.current); // Detect export/CORS failures before offering downloads.
        if(!cancelled) setReady(true);
      } catch(e) { if(!cancelled) setError(e instanceof Error ? e.message : 'Could not load artwork.'); }
    })();
    return () => { cancelled=true; };
  },[product,link,imageIndex,format]);
  async function copy(value:string) { setMessage(await copyTextToClipboard(value) ? 'Copied — ready to paste.' : 'Could not copy automatically. Select and copy the text below.'); }
  async function download(video=false) {
    if(!assets.current || !canvas.current) return;
    setBusy(video?'video':'image'); setError(''); setMessage('');
    try {
      const target = document.createElement('canvas'); const {image,qr:qrImage}=assets.current;
      const f = video ? PROMO_FORMATS.find(f=>f.id==='story')! : format;
      drawPromo(target,product,image,qrImage,f);
      const blob = video ? await recordPromo(target,p=>drawPromo(target,product,image,qrImage,f,p)) : await canvasBlob(target);
      savePromoFile(blob,`beezio-${product.id}-${video?'video':f.id}.${video?(blob.type.startsWith('video/mp4')?'mp4':'webm'):'png'}`);
      setMessage(video?'Video downloaded. Upload it with your caption and tracked link.':'Image downloaded. Post it with your caption and tracked link.');
    } catch(e) {setError(e instanceof Error?e.message:'Export failed.');} finally {setBusy('');}
  }
  async function share() {
    setError('');
    try { if(navigator.share) await navigator.share({title:product.title,text:caption,url:link}); else await copy(caption); }
    catch(e) {if((e as Error).name!=='AbortError') setError('Sharing did not open. Use Copy caption or Copy link.');}
  }
  return <div className="grid gap-6 lg:grid-cols-2">
    <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3"><h2 className="text-xl font-extrabold">Create your promotion</h2><span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold">Your tracked QR included</span></div>
      <div className="mb-4 flex flex-wrap gap-2">{PROMO_FORMATS.map(f=><button key={f.id} disabled={!!busy} aria-pressed={f.id===formatId} onClick={()=>setFormatId(f.id)} className={`${button} ${f.id===formatId?'!border-amber-500 !bg-amber-100':''}`}>{f.name}</button>)}</div>
      {(product.images?.length||0)>1 && <label className="mb-4 block text-sm font-bold">Product photo<select value={imageIndex} disabled={!!busy} onChange={e=>setImageIndex(Number(e.target.value))} className="ml-3 rounded-lg border p-2">{product.images?.map((_,i)=><option key={i} value={i}>Photo {i+1}</option>)}</select></label>}
      <div className="flex min-h-64 justify-center rounded-2xl bg-slate-100 p-4"><canvas ref={canvas} aria-label={`Promotion preview for ${product.title}`} className="h-auto max-h-[520px] max-w-full object-contain shadow-lg" /></div>
      <div ref={qr} className="hidden"><QRCodeSVG value={link} size={220} level="M" marginSize={4}/></div>
      <div className="mt-4 flex flex-wrap gap-2"><button className={`${button} !bg-amber-400 !border-amber-400`} disabled={!ready||!!busy} onClick={()=>void download()}><Download size={18}/>Download PNG</button><button className={button} disabled={!ready||!!busy} onClick={()=>void download(true)}><Video size={18}/>{busy==='video'?'Making 8-second video…':'Download short video'}</button></div>
      <p className="mt-3 text-xs leading-5 text-slate-600">Use square posts for feeds, tall images for Stories and Pins, and flyers for print. Videos export as MP4 or WebM depending on your browser. Keep this page open while exporting.</p>
    </section>
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6"><h2 className="text-xl font-extrabold">Post wherever your buyers are</h2><p className="mt-2 text-sm text-slate-600">Download your image, edit the caption, and share. The QR and link identify your promotion. Posting is always your choice.</p>
        <label className="mt-4 block text-sm font-bold">Your tracked product link<input readOnly value={link} className="mt-2 w-full rounded-xl border p-3 text-xs font-normal" onFocus={e=>e.target.select()}/></label>
        <button className={`${button} mt-2`} onClick={()=>void copy(link)}><Copy size={16}/>Copy link</button>
        <label className="mt-4 block text-sm font-bold">Editable caption<textarea value={caption} onChange={e=>setCaption(e.target.value)} rows={7} className="mt-2 w-full rounded-xl border p-3 text-sm font-normal"/></label>
        <div className="mt-3 flex flex-wrap gap-2"><button className={button} onClick={()=>void copy(caption)}><Copy size={16}/>Copy caption</button><button className={`${button} !bg-slate-900 !text-white`} onClick={()=>void share()}><Share2 size={16}/>Share…</button><a className={button} target="_blank" rel="noopener noreferrer" href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`}>Facebook</a><a className={button} target="_blank" rel="noopener noreferrer" href={`https://www.pinterest.com/pin/create/button/?url=${encodeURIComponent(link)}&media=${encodeURIComponent(product.images?.[imageIndex]||'')}&description=${encodeURIComponent(caption)}`}>Pinterest</a></div>
        <p className="mt-3 text-xs text-slate-600">For Instagram, TikTok and Stories: upload the downloaded file, paste your caption, and put your tracked link in an available link field or your bio. Images alone are not clickable.</p>
      </section>
      <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6"><h2 className="text-xl font-extrabold">Put this product on your website</h2><p className="mt-2 text-sm text-slate-600">Paste this card into an HTML block on your blog or website. Purchases open on Beezio using your tracked link.</p><textarea aria-label="Product card HTML" readOnly value={embed} rows={4} className="mt-3 w-full rounded-xl border bg-slate-50 p-3 font-mono text-xs"/><button className={`${button} mt-3`} onClick={()=>void copy(embed)}>Copy website card</button></section>
    </div>
    <section className="rounded-3xl border border-slate-200 bg-white p-5 lg:col-span-2 sm:p-6"><h2 className="text-xl font-extrabold">Share a collection</h2><p className="mt-2 text-sm text-slate-600">Pick up to 12 items from the search results above. One link opens your collection and keeps your referral attached.</p><label className="mt-4 block text-sm font-bold">Collection name<input value={collectionTitle} maxLength={80} onChange={e=>setCollectionTitle(e.target.value)} className="mt-2 block w-full max-w-lg rounded-xl border p-3"/></label>
      <div className="mt-4 grid max-h-64 gap-2 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">{Array.from(new Map([product,...products].map(p=>[p.id,p])).values()).map(p=><label key={p.id} className="flex items-center gap-3 rounded-xl border p-3 text-sm"><input type="checkbox" checked={collectionIds.includes(p.id)} disabled={!collectionIds.includes(p.id)&&collectionIds.length>=12} onChange={e=>setCollectionIds(ids=>e.target.checked?[...ids,p.id]:ids.filter(id=>id!==p.id))}/><span>{p.title}<span className="block text-xs text-slate-500">{promotionPriceLabel(p)}</span></span></label>)}</div>
      <input aria-label="Collection link" readOnly value={pickedLink} className="mt-4 w-full rounded-xl border p-3 text-xs"/><div className="mt-3 flex flex-wrap gap-2"><button className={button} disabled={!collectionIds.length} onClick={()=>void copy(`${collectionTitle}\n${pickedLink}\nI may earn a commission from purchases.`)}>Copy collection post ({collectionIds.length}/12)</button>{collectionIds.length>0&&<a href={pickedLink} target="_blank" rel="noopener noreferrer" className={button}>Preview collection</a>}</div>
    </section>
    <div className="lg:col-span-2" aria-live="polite">{message&&<p className="rounded-xl bg-emerald-50 p-4 text-emerald-900">{message}</p>}{error&&<p role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">{error}</p>}</div>
  </div>;
}
