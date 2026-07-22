import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, Check, Image as ImageIcon, Link2, Loader2, PackageSearch } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { calculatePricing } from '../lib/pricing';
import { supabase } from '../lib/supabase';

type ImportVariant = {
  name: string;
  sku: string | null;
  wholesalePrice: number | null;
  available: boolean | null;
  inventory: number | null;
  image: string | null;
  options: Record<string, string>;
};

type ImportPreview = {
  sourceUrl: string;
  sourceHost: string;
  sourcePlatform: string;
  title: string;
  description: string;
  brand: string | null;
  sku: string | null;
  wholesalePrice: number | null;
  currency: string;
  images: string[];
  variants: ImportVariant[];
  warnings: string[];
};

type StorefrontOption = { id: string; name: string; slug: string };

const money = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value || 0));

const AdminUrlProductImporter = () => {
  const navigate = useNavigate();
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [storefronts, setStorefronts] = useState<StorefrontOption[]>([]);
  const [storefrontId, setStorefrontId] = useState('');
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [wholesalePrice, setWholesalePrice] = useState(0);
  const [markupType, setMarkupType] = useState<'percent' | 'flat'>('percent');
  const [markupValue, setMarkupValue] = useState(40);
  const [affiliateType, setAffiliateType] = useState<'percentage' | 'flat_rate'>('percentage');
  const [affiliateValue, setAffiliateValue] = useState(20);
  const [variants, setVariants] = useState<ImportVariant[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user;
      if (!user?.id) return;
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id,user_id')
        .or(`id.eq.${user.id},user_id.eq.${user.id}`);
      const ownerIds = Array.from(new Set([user.id, ...((profiles as any[]) || []).flatMap((row) => [row?.id, row?.user_id])].map(String).filter(Boolean)));
      const { data } = await supabase
        .from('storefronts')
        .select('id,name,slug')
        .in('owner_id', ownerIds)
        .eq('is_active', true)
        .order('name', { ascending: true });
      if (cancelled) return;
      const options = ((data as any[]) || []).map((row) => ({ id: String(row.id), name: String(row.name), slug: String(row.slug || '') }));
      setStorefronts(options);
      if (options.length === 1) setStorefrontId(options[0].id);
    })();
    return () => { cancelled = true; };
  }, []);

  const sellerAmount = useMemo(() => {
    const base = Math.max(0, Number(wholesalePrice) || 0);
    const markup = Math.max(0, Number(markupValue) || 0);
    return Math.round((markupType === 'percent' ? base * (1 + markup / 100) : base + markup) * 100) / 100;
  }, [markupType, markupValue, wholesalePrice]);

  const pricing = useMemo(() => calculatePricing({
    sellerDesiredAmount: sellerAmount,
    affiliateRate: Math.max(0, Number(affiliateValue) || 0),
    affiliateType,
  }), [affiliateType, affiliateValue, sellerAmount]);

  const runImport = async () => {
    try {
      setLoading(true);
      setError(null);
      setPreview(null);
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error('Sign in with the Beezio admin account before importing.');
      const response = await fetch('/.netlify/functions/admin-import-product-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ url: url.trim() }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.product) throw new Error(String(payload?.error || 'The supplier page could not be imported.'));
      const next = payload.product as ImportPreview;
      setPreview(next);
      setSelectedImages((next.images || []).slice(0, 10));
      setWholesalePrice(Number(next.wholesalePrice || 0));
      setVariants((next.variants || []).map((variant) => ({ ...variant })));
    } catch (importError: any) {
      setError(importError?.message || 'The supplier page could not be imported.');
    } finally {
      setLoading(false);
    }
  };

  const toggleImage = (image: string) => {
    setSelectedImages((current) => {
      if (current.includes(image)) return current.filter((entry) => entry !== image);
      if (current.length >= 10) {
        setError('Choose no more than 10 final product images.');
        return current;
      }
      setError(null);
      return [...current, image];
    });
  };

  const reviewInProductForm = () => {
    if (!preview) return;
    if (!storefrontId) {
      setError('Choose the brand storefront receiving this product.');
      return;
    }
    if (!selectedImages.length) {
      setError('Choose at least one approved product image.');
      return;
    }
    if (wholesalePrice <= 0 || sellerAmount <= 0) {
      setError('Enter a verified wholesale price and markup.');
      return;
    }
    const selectedStorefront = storefronts.find((storefront) => storefront.id === storefrontId);
    const seed = {
      version: 1,
      importedAt: new Date().toISOString(),
      sourceUrl: preview.sourceUrl,
      sourcePlatform: preview.sourcePlatform,
      title: preview.title,
      description: preview.description,
      brand: preview.brand,
      sku: preview.sku,
      currency: preview.currency,
      images: selectedImages,
      wholesalePrice,
      markupType,
      markupValue,
      sellerAmount,
      affiliateType,
      affiliateValue,
      storefrontId,
      storefrontName: selectedStorefront?.name || '',
      variants,
      warnings: preview.warnings,
    };
    sessionStorage.setItem('beezio-admin-url-import', JSON.stringify(seed));
    navigate('/add-product?source=admin-url-import');
  };

  return (
    <section className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-amber-50 p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-emerald-800">
            <Link2 className="h-3.5 w-3.5" /> Admin only
          </div>
          <h2 className="mt-3 text-2xl font-black text-gray-950">Import from a supplier product URL</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-700">Pull public product metadata into a review screen, choose the destination brand, verify wholesale pricing and variants, then finish in the normal Add Product form. Nothing publishes automatically.</p>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <label className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-gray-300 bg-white px-4 py-3">
          <PackageSearch className="h-5 w-5 flex-none text-gray-500" />
          <input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://supplier.com/products/product-name" className="min-w-0 flex-1 bg-transparent text-sm text-gray-950 outline-none" />
        </label>
        <button type="button" onClick={() => void runImport()} disabled={loading || !url.trim()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#101820] px-5 py-3 text-sm font-black text-[#ffcb05] disabled:opacity-50">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackageSearch className="h-4 w-4" />}
          {loading ? 'Reading product…' : 'Preview product'}
        </button>
      </div>

      {error ? <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div> : null}

      {preview ? (
        <div className="mt-6 space-y-6">
          <div className="grid gap-5 rounded-2xl border border-gray-200 bg-white p-5 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.2em] text-gray-500">Detected from {preview.sourceHost}</div>
              <h3 className="mt-2 text-2xl font-black text-gray-950">{preview.title || 'Untitled supplier product'}</h3>
              <p className="mt-3 whitespace-pre-line text-sm leading-6 text-gray-700">{preview.description || 'No description was detected.'}</p>
              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-gray-100 px-3 py-1.5 text-gray-700">Brand: {preview.brand || 'Not detected'}</span>
                <span className="rounded-full bg-gray-100 px-3 py-1.5 text-gray-700">SKU: {preview.sku || 'Not detected'}</span>
                <span className="rounded-full bg-gray-100 px-3 py-1.5 text-gray-700">Variants: {variants.length}</span>
                <span className="rounded-full bg-gray-100 px-3 py-1.5 text-gray-700">Images: {preview.images.length}</span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-900">Destination brand storefront</label>
              <select value={storefrontId} onChange={(event) => setStorefrontId(event.target.value)} className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-950">
                <option value="">Choose a brand…</option>
                {storefronts.map((storefront) => <option key={storefront.id} value={storefront.id}>{storefront.name} — /store/{storefront.slug}</option>)}
              </select>
              <p className="mt-2 text-xs leading-5 text-gray-600">This required selection controls where the approved product appears. Regular sellers do not see this importer.</p>
            </div>
          </div>

          {preview.warnings.length ? (
            <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4">
              <div className="flex items-center gap-2 font-black text-amber-950"><AlertTriangle className="h-5 w-5" /> Review before publishing</div>
              <ul className="mt-2 space-y-1 text-sm leading-6 text-amber-900">{preview.warnings.map((warning) => <li key={warning}>• {warning}</li>)}</ul>
            </div>
          ) : null}

          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="flex items-end justify-between gap-3">
              <div><h3 className="font-black text-gray-950">Choose approved images</h3><p className="mt-1 text-sm text-gray-600">Select up to 10. Variant images are included when the supplier exposes them.</p></div>
              <div className="text-sm font-bold text-gray-700">{selectedImages.length}/10</div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
              {preview.images.map((image) => {
                const selected = selectedImages.includes(image);
                return (
                  <button key={image} type="button" onClick={() => toggleImage(image)} className={`relative aspect-square overflow-hidden rounded-xl border-2 bg-gray-50 ${selected ? 'border-emerald-500 ring-2 ring-emerald-200' : 'border-gray-200'}`}>
                    <img src={image} alt="Imported supplier option" className="h-full w-full object-contain" />
                    <span className={`absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full ${selected ? 'bg-emerald-600 text-white' : 'bg-white/90 text-gray-500'}`}>{selected ? <Check className="h-4 w-4" /> : <ImageIcon className="h-3.5 w-3.5" />}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(340px,0.85fr)]">
            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <h3 className="font-black text-gray-950">Wholesale, markup, and affiliate terms</h3>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-bold text-gray-800">Wholesale cost
                  <input type="number" min="0" step="0.01" value={wholesalePrice} onChange={(event) => setWholesalePrice(Number(event.target.value))} className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3" />
                </label>
                <label className="text-sm font-bold text-gray-800">Markup method
                  <select value={markupType} onChange={(event) => setMarkupType(event.target.value as 'percent' | 'flat')} className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3"><option value="percent">Percentage</option><option value="flat">Flat dollars</option></select>
                </label>
                <label className="text-sm font-bold text-gray-800">Markup {markupType === 'percent' ? '(%)' : '($)'}
                  <input type="number" min="0" step="0.01" value={markupValue} onChange={(event) => setMarkupValue(Number(event.target.value))} className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3" />
                </label>
                <label className="text-sm font-bold text-gray-800">Affiliate commission
                  <div className="mt-2 grid grid-cols-[1fr_110px] gap-2"><input type="number" min="0" step="0.01" value={affiliateValue} onChange={(event) => setAffiliateValue(Number(event.target.value))} className="w-full rounded-xl border border-gray-300 px-4 py-3" /><select value={affiliateType} onChange={(event) => setAffiliateType(event.target.value as 'percentage' | 'flat_rate')} className="rounded-xl border border-gray-300 px-3"><option value="percentage">%</option><option value="flat_rate">$ flat</option></select></div>
                </label>
              </div>
              <p className="mt-4 text-xs leading-5 text-gray-600">Shipping and sales tax remain separate and are calculated at checkout. Verify supplier permissions, wholesale terms, labels, claims, inventory, and fulfillment details before publishing.</p>
            </div>

            <div className="rounded-2xl bg-[#101820] p-5 text-white">
              <div className="text-xs font-black uppercase tracking-[0.22em] text-[#ffcb05]">Estimated customer price</div>
              <div className="mt-2 text-4xl font-black">{money(pricing.listingPrice)}</div>
              <dl className="mt-5 space-y-2 text-sm">
                <div className="flex justify-between gap-3"><dt className="text-slate-400">Wholesale cost</dt><dd>{money(wholesalePrice)}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-slate-400">Brand amount (cost + markup)</dt><dd>{money(pricing.sellerAmount)}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-slate-400">Affiliate reserve</dt><dd>{money(pricing.affiliateAmount)}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-slate-400">Influencer reserve</dt><dd>{money(pricing.referralAmount)}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-slate-400">Beezio fee</dt><dd>{money(pricing.platformFee)}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-slate-400">PayPal estimate</dt><dd>{money(Math.max(0, pricing.listingPrice - pricing.sellerAmount - pricing.affiliateAmount - pricing.referralAmount - pricing.platformFee))}</dd></div>
              </dl>
              <div className="mt-4 border-t border-white/15 pt-4 text-xs leading-5 text-slate-400">Tax and any separate shipping charge are added at checkout.</div>
            </div>
          </div>

          {variants.length ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <h3 className="font-black text-gray-950">Detected variants ({variants.length})</h3>
              <p className="mt-1 text-sm text-gray-600">All structured variants will carry into the product review. Correct any supplier cost or SKU before continuing.</p>
              <div className="mt-4 max-h-[430px] overflow-auto rounded-xl border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="sticky top-0 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500"><tr><th className="px-3 py-3">Variant</th><th className="px-3 py-3">SKU</th><th className="px-3 py-3">Wholesale</th><th className="px-3 py-3">Stock</th><th className="px-3 py-3">Image</th></tr></thead>
                  <tbody className="divide-y divide-gray-100">
                    {variants.map((variant, index) => (
                      <tr key={`${variant.sku || variant.name}-${index}`}>
                        <td className="px-3 py-3 font-semibold text-gray-900">{variant.name}</td>
                        <td className="px-3 py-3"><input value={variant.sku || ''} onChange={(event) => setVariants((current) => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, sku: event.target.value || null } : entry))} className="w-36 rounded-lg border border-gray-300 px-2 py-1.5" /></td>
                        <td className="px-3 py-3"><input type="number" min="0" step="0.01" value={variant.wholesalePrice ?? ''} onChange={(event) => setVariants((current) => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, wholesalePrice: event.target.value === '' ? null : Number(event.target.value) } : entry))} className="w-28 rounded-lg border border-gray-300 px-2 py-1.5" /></td>
                        <td className="px-3 py-3 text-gray-700">{variant.inventory ?? (variant.available === false ? 'Out' : 'Verify')}</td>
                        <td className="px-3 py-3">{variant.image ? <img src={variant.image} alt="" className="h-12 w-12 rounded-lg border object-contain" /> : <span className="text-gray-500">None detected</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          <div className="flex justify-end">
            <button type="button" onClick={reviewInProductForm} className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-6 py-3.5 text-sm font-black text-white shadow-lg hover:bg-emerald-800">Review in Add Product <ArrowRight className="h-4 w-4" /></button>
          </div>
        </div>
      ) : null}
    </section>
  );
};

export default AdminUrlProductImporter;
