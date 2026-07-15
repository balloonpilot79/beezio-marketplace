import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ExternalLink, Globe2, HelpCircle, Plus, Save, Share2, Store } from 'lucide-react';
import { supabase } from '../lib/supabase';

type BrandStorefront = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  custom_domain: string | null;
  logo_url: string | null;
  banner_url: string | null;
  store_theme: string | null;
  color_scheme: Record<string, string> | null;
  social_links: Record<string, string> | null;
  is_active: boolean;
};

const slugify = (value: string) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);

const defaultColors = {
  primary: '#0f172a',
  secondary: '#e2e8f0',
  accent: '#f59e0b',
  background: '#f8fafc',
  text: '#0f172a',
};

const cleanDomain = (value: string) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/^www\./, '');

const cleanSocialUrl = (value: string) => {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
};

const socialFields = [
  ['website', 'Website'],
  ['facebook', 'Facebook'],
  ['instagram', 'Instagram'],
  ['twitter', 'X / Twitter'],
  ['linkedin', 'LinkedIn'],
  ['tiktok', 'TikTok'],
  ['youtube', 'YouTube'],
] as const;

const BrandStorefrontManager: React.FC<{ ownerId: string }> = ({ ownerId }) => {
  const [stores, setStores] = useState<BrandStorefront[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [draft, setDraft] = useState<BrandStorefront | null>(null);
  const [newName, setNewName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [canManageMultiple, setCanManageMultiple] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async (preferredId?: string) => {
    if (!ownerId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('storefronts')
      .select('id,name,slug,description,custom_domain,logo_url,banner_url,store_theme,color_scheme,social_links,is_active')
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: true });
    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }
    const rows = ((data as BrandStorefront[]) || []).map((row) => ({ ...row, color_scheme: row.color_scheme || defaultColors }));
    setStores(rows);
    const requestedId = preferredId || selectedId;
    const nextId = requestedId && rows.some((row) => row.id === requestedId) ? requestedId : rows[0]?.id || '';
    setSelectedId(nextId);
    setDraft(rows.find((row) => row.id === nextId) || null);
    setLoading(false);
  }, [ownerId, selectedId]);

  useEffect(() => {
    void load();
  }, [ownerId]);

  useEffect(() => {
    let active = true;
    void supabase.rpc('is_beezio_admin').then(({ data }) => {
      if (active) setCanManageMultiple(Boolean(data));
    });
    return () => { active = false; };
  }, [ownerId]);

  const selected = useMemo(() => stores.find((storefront) => storefront.id === selectedId) || null, [selectedId, stores]);

  const choose = (id: string) => {
    setSelectedId(id);
    setDraft(stores.find((storefront) => storefront.id === id) || null);
    setMessage(null);
  };

  const createStore = async () => {
    if (stores.length > 0 && !canManageMultiple) {
      setMessage('Each standard Beezio account includes one brand storefront. Contact support if ownership needs to be transferred later.');
      return;
    }
    const name = newName.trim();
    const slug = slugify(name);
    if (!name || !slug || saving) return;
    setSaving(true);
    setMessage(null);
    const { data, error } = await supabase
      .from('storefronts')
      .insert({
        owner_id: ownerId,
        type: 'seller',
        name,
        slug,
        description: `Welcome to ${name}.`,
        store_theme: 'modern',
        layout_config: { header_style: 'banner', product_grid: '3-col', show_about: true },
        color_scheme: defaultColors,
        social_links: {},
        is_active: true,
      })
      .select('id')
      .single();
    setSaving(false);
    if (error) {
      setMessage(error.code === '23505' ? 'That storefront slug is already in use.' : error.message);
      return;
    }
    setNewName('');
    const createdId = String((data as any)?.id || '');
    setSelectedId(createdId);
    await load(createdId);
    setMessage(`${name} was created. Add branding, then choose it on the product form.`);
  };

  const save = async () => {
    if (!draft || saving) return;
    const cleanSlug = slugify(draft.slug || draft.name);
    if (!cleanSlug) {
      setMessage('Add a valid storefront slug.');
      return;
    }
    setSaving(true);
    setMessage(null);
    const nextDomain = cleanDomain(draft.custom_domain || '') || null;
    const previousDomain = cleanDomain(selected?.custom_domain || '') || null;
    const { error } = await supabase
      .from('storefronts')
      .update({
        name: draft.name.trim(),
        slug: cleanSlug,
        description: draft.description?.trim() || null,
        logo_url: draft.logo_url?.trim() || null,
        banner_url: draft.banner_url?.trim() || null,
        store_theme: draft.store_theme || 'modern',
        color_scheme: { ...defaultColors, ...(draft.color_scheme || {}) },
        social_links: Object.fromEntries(
          Object.entries(draft.social_links || {})
            .map(([key, value]) => [key, cleanSocialUrl(value)])
            .filter(([, value]) => Boolean(value))
        ),
        is_active: draft.is_active,
        updated_at: new Date().toISOString(),
      })
      .eq('id', draft.id)
      .eq('owner_id', ownerId);
    if (error) {
      setSaving(false);
      setMessage(error.code === '23505' ? 'That storefront slug or custom domain is already in use.' : error.message);
      return;
    }
    if (nextDomain !== previousDomain) {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        setSaving(false);
        setMessage('Your brand details were saved, but you must sign in again before changing a custom domain.');
        return;
      }
      const response = await fetch('/.netlify/functions/storefront-domain-manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ storefront_id: draft.id, domain: nextDomain }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setSaving(false);
        setMessage(result?.error || 'Your brand details were saved, but the custom domain could not be connected.');
        return;
      }
    }
    setSaving(false);
    await load(draft.id);
    setMessage(nextDomain !== previousDomain ? 'Brand storefront saved. The custom domain is registered; finish the DNS steps to activate HTTPS.' : 'Brand storefront saved.');
  };

  if (loading) return <div className="rounded-2xl border border-slate-200 bg-white p-6">Loading brand storefronts...</div>;

  return (
    <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold text-slate-950"><Store className="h-5 w-5" /> Brand storefronts</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">Standard accounts receive one complete brand storefront. Beezio administrators can switch between approved brands such as MareBelle and RedTail while each keeps separate products, design, messages, and orders.</p>
        </div>
        {selected && (
          <div className="flex flex-wrap gap-2">
            <a href="/faq/storefronts" className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"><HelpCircle className="h-4 w-4" /> Storefront guide</a>
            <a href={`/store/${selected.slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50">
              View {selected.name} <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        )}
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[220px_1fr]">
        <div className="space-y-2">
          {stores.map((storefront) => (
            <button key={storefront.id} type="button" onClick={() => choose(storefront.id)} className={`w-full rounded-xl border px-4 py-3 text-left ${selectedId === storefront.id ? 'border-amber-500 bg-amber-50' : 'border-slate-200 hover:bg-slate-50'}`}>
              <span className="block font-semibold text-slate-950">{storefront.name}</span>
              <span className="block truncate text-xs text-slate-500">/store/{storefront.slug}</span>
            </button>
          ))}
          {(stores.length === 0 || canManageMultiple) ? (
            <div className="rounded-xl border border-dashed border-slate-300 p-3">
              <input value={newName} onChange={(event) => setNewName(event.target.value)} placeholder={canManageMultiple ? 'Another brand name' : 'Brand name'} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <button type="button" onClick={() => void createStore()} disabled={!newName.trim() || saving} className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-950 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
                <Plus className="h-4 w-4" /> Create storefront
              </button>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-600">Standard accounts include one brand storefront. Your existing store can still use its slug, domain, social links, and all selling tools.</div>
          )}
        </div>

        {draft ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-semibold text-slate-800">Brand name<input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" /></label>
            <label className="text-sm font-semibold text-slate-800">Slug<input value={draft.slug} onChange={(event) => setDraft({ ...draft, slug: slugify(event.target.value) })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" /></label>
            <label className="sm:col-span-2 text-sm font-semibold text-slate-800">Brand story<textarea value={draft.description || ''} onChange={(event) => setDraft({ ...draft, description: event.target.value })} rows={3} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" /></label>
            <label className="text-sm font-semibold text-slate-800">Logo image URL<input value={draft.logo_url || ''} onChange={(event) => setDraft({ ...draft, logo_url: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" /></label>
            <label className="text-sm font-semibold text-slate-800">Banner image URL<input value={draft.banner_url || ''} onChange={(event) => setDraft({ ...draft, banner_url: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" /></label>
            <label className="text-sm font-semibold text-slate-800">Custom domain<input value={draft.custom_domain || ''} onChange={(event) => setDraft({ ...draft, custom_domain: event.target.value })} onBlur={(event) => setDraft({ ...draft, custom_domain: cleanDomain(event.target.value) })} placeholder="shop.yourbrand.com" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" /><span className="mt-1 flex items-center gap-1 text-xs font-normal text-slate-500"><Globe2 className="h-3 w-3" /> Optional. Your Beezio slug keeps working too.</span></label>
            <label className="text-sm font-semibold text-slate-800">Store style<select value={draft.store_theme || 'modern'} onChange={(event) => setDraft({ ...draft, store_theme: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal"><option value="modern">Modern</option><option value="elegant">Elegant</option><option value="minimal">Minimal</option><option value="classic">Classic / Western</option><option value="vibrant">Bold</option><option value="nature">Nature</option><option value="dark">Dark</option></select></label>
            <div className="sm:col-span-2 grid grid-cols-2 gap-3 sm:grid-cols-5">
              {(['primary', 'secondary', 'accent', 'background', 'text'] as const).map((key) => (
                <label key={key} className="text-xs font-semibold capitalize text-slate-600">{key}<input type="color" value={draft.color_scheme?.[key] || defaultColors[key]} onChange={(event) => setDraft({ ...draft, color_scheme: { ...(draft.color_scheme || defaultColors), [key]: event.target.value } })} className="mt-1 h-10 w-full rounded border border-slate-300" /></label>
              ))}
            </div>
            <div className="sm:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900"><Share2 className="h-4 w-4" /> Social media and website</div>
              <p className="mt-1 text-xs text-slate-500">These links belong only to {draft.name || 'this brand'} and appear on its public storefront.</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {socialFields.map(([key, label]) => (
                  <label key={key} className="text-xs font-semibold text-slate-700">{label}<input value={draft.social_links?.[key] || ''} onChange={(event) => setDraft({ ...draft, social_links: { ...(draft.social_links || {}), [key]: event.target.value } })} placeholder={`https://${key === 'website' ? 'yourbrand.com' : `${key}.com/yourbrand`}`} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal" /></label>
                ))}
              </div>
            </div>
            <label className="sm:col-span-2 flex items-center gap-2 text-sm font-semibold text-slate-800"><input type="checkbox" checked={draft.is_active} onChange={(event) => setDraft({ ...draft, is_active: event.target.checked })} /> Storefront is public</label>
            <button type="button" onClick={() => void save()} disabled={saving || !draft.name.trim()} className="sm:col-span-2 inline-flex items-center justify-center gap-2 rounded-lg bg-amber-400 px-4 py-3 font-bold text-slate-950 hover:bg-amber-300 disabled:opacity-50"><Save className="h-4 w-4" /> {saving ? 'Saving...' : 'Save brand storefront'}</button>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">Create your first brand storefront.</div>
        )}
      </div>
      {message && <p className="mt-4 rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700">{message}</p>}
    </section>
  );
};

export default BrandStorefrontManager;
