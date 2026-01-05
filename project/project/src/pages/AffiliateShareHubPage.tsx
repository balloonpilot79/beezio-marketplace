import React, { useEffect, useMemo, useState } from 'react';
import { Copy, Search, Star } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContextMultiRole';
import { useAffiliate } from '../contexts/AffiliateContext';
import AffiliateShareWidget from '../components/AffiliateShareWidget';
import { SHARE_TEMPLATES, ShareChannel, ShareTargetType } from '../lib/shareTemplates';
import { Link } from 'react-router-dom';

type ProductRow = {
  id: string;
  title: string;
  price: number;
  images?: string[] | null;
  seller_id?: string | null;
  commission_rate?: number | null;
  is_active?: boolean | null;
};

const channels: Array<{ id: ShareChannel; label: string }> = [
  { id: 'copy', label: 'Copy' },
  { id: 'facebook', label: 'Facebook' },
  { id: 'sms', label: 'SMS' },
  { id: 'email', label: 'Email' },
  { id: 'x', label: 'X' },
  { id: 'whatsapp', label: 'WhatsApp' },
];

export default function AffiliateShareHubPage() {
  const { user, profile, hasRole } = useAuth();
  const { selectedProducts, addProduct, removeProduct, isProductSelected } = useAffiliate();

  const isAffiliate = Boolean(user && (hasRole('affiliate') || hasRole('admin') || profile?.primary_role === 'affiliate'));
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [featured, setFeatured] = useState<ProductRow[]>([]);
  const [results, setResults] = useState<ProductRow[]>([]);
  const [savedDetails, setSavedDetails] = useState<ProductRow[]>([]);

  const [templateType, setTemplateType] = useState<ShareTargetType>('product');
  const [templateChannel, setTemplateChannel] = useState<ShareChannel>('copy');
  const [copiedTemplateId, setCopiedTemplateId] = useState<string | null>(null);

  const myAffiliateStorePath = useMemo(() => {
    if (!profile?.id) return null;
    return `/affiliate/${profile.id}`;
  }, [profile?.id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data } = await supabase
          .from('products')
          .select('id, title, price, images, seller_id, commission_rate, is_active')
          .eq('is_active', true)
          .limit(12);
        if (!cancelled && Array.isArray(data)) setFeatured(data as any);
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const ids = selectedProducts.map((p) => p.productId).filter(Boolean);
    if (!ids.length) {
      setSavedDetails([]);
      return;
    }
    (async () => {
      try {
        const { data } = await supabase
          .from('products')
          .select('id, title, price, images, seller_id, commission_rate, is_active')
          .in('id', ids);
        if (!cancelled && Array.isArray(data)) setSavedDetails(data as any);
      } catch {
        if (!cancelled) setSavedDetails([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedProducts]);

  const runSearch = async () => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const { data } = await supabase
        .from('products')
        .select('id, title, price, images, seller_id, commission_rate, is_active')
        .eq('is_active', true)
        .ilike('title', `%${trimmed}%`)
        .limit(20);
      setResults(Array.isArray(data) ? (data as any) : []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const templates = useMemo(() => {
    const list = SHARE_TEMPLATES[templateType]?.[templateChannel] || SHARE_TEMPLATES[templateType]?.copy || [];
    return list;
  }, [templateChannel, templateType]);

  const copyTemplate = async (templateId: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedTemplateId(templateId);
    window.setTimeout(() => setCopiedTemplateId(null), 1200);
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 px-4 py-10">
        <div className="max-w-3xl mx-auto bg-white border border-gray-200 rounded-xl p-6">
          <h1 className="text-2xl font-bold text-gray-900">Affiliate Share Hub</h1>
          <p className="mt-2 text-gray-600">Sign in to access share tools, templates, and saved products.</p>
          <div className="mt-4">
            <Link to="/auth/login" className="inline-flex px-4 py-2 rounded-lg bg-amber-500 text-white font-semibold hover:bg-amber-600">
              Sign In
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Affiliate Share Hub</h1>
            <p className="mt-1 text-gray-600">Grab a link, pick a template, and post in under 10 seconds.</p>
          </div>
          <div className="text-right">
            {!isAffiliate && (
              <Link
                to="/affiliate-signup?role=affiliate"
                className="inline-flex px-4 py-2 rounded-lg bg-gray-900 text-white font-semibold hover:bg-gray-800"
              >
                Become an Affiliate
              </Link>
            )}
          </div>
        </div>

        {/* My Store Link */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">My Store Link</h2>
              <p className="text-sm text-gray-600">Share your storefront so buyers can browse everything you recommend.</p>
            </div>
          </div>
          {myAffiliateStorePath && (
            <div className="mt-4">
              <AffiliateShareWidget type="store" targetId={profile?.id || ''} targetPath={myAffiliateStorePath} title="My Beezio storefront" />
            </div>
          )}
        </div>

        {/* Search */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search products to share…"
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              />
            </div>
            <button
              onClick={runSearch}
              className="px-4 py-2 rounded-lg bg-amber-500 text-white font-semibold hover:bg-amber-600"
            >
              Search
            </button>
          </div>

          {loading && <div className="mt-3 text-sm text-gray-500">Loading…</div>}
          {!loading && results.length > 0 && (
            <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              {results.map((p) => (
                <div key={p.id} className="border border-gray-200 rounded-xl p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-gray-900">{p.title}</div>
                      <div className="text-sm text-gray-600">${Number(p.price || 0).toFixed(2)}</div>
                    </div>
                    <button
                      onClick={() => (isProductSelected(p.id) ? removeProduct(p.id) : addProduct(p.id))}
                      className={`px-3 py-1.5 rounded-lg text-sm font-semibold border ${
                        isProductSelected(p.id)
                          ? 'bg-gray-900 text-white border-gray-900'
                          : 'bg-white text-gray-800 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {isProductSelected(p.id) ? 'Saved' : 'Save'}
                    </button>
                  </div>
                  <div className="mt-3">
                    <AffiliateShareWidget
                      type="product"
                      targetId={p.id}
                      targetPath={`/product/${p.id}`}
                      sellerId={p.seller_id || undefined}
                      title={p.title}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Featured */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center gap-2">
            <Star className="w-5 h-5 text-amber-500" />
            <h2 className="text-lg font-semibold text-gray-900">Featured</h2>
          </div>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            {featured.map((p) => (
              <div key={p.id} className="border border-gray-200 rounded-xl p-4">
                <div className="font-semibold text-gray-900">{p.title}</div>
                <div className="text-sm text-gray-600">${Number(p.price || 0).toFixed(2)}</div>
                <div className="mt-3">
                  <AffiliateShareWidget
                    type="product"
                    targetId={p.id}
                    targetPath={`/product/${p.id}`}
                    sellerId={p.seller_id || undefined}
                    title={p.title}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Saved */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-gray-900">My Saved Products</h2>
          <p className="text-sm text-gray-600">These are the products you’ve saved to share again later.</p>

          {savedDetails.length === 0 ? (
            <div className="mt-4 text-sm text-gray-500">No saved products yet. Use Search to save a few.</div>
          ) : (
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              {savedDetails.map((p) => (
                <div key={p.id} className="border border-gray-200 rounded-xl p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-gray-900">{p.title}</div>
                      <div className="text-sm text-gray-600">${Number(p.price || 0).toFixed(2)}</div>
                    </div>
                    <button
                      onClick={() => removeProduct(p.id)}
                      className="px-3 py-1.5 rounded-lg text-sm font-semibold border border-gray-300 hover:bg-gray-50"
                    >
                      Remove
                    </button>
                  </div>
                  <div className="mt-3">
                    <AffiliateShareWidget
                      type="product"
                      targetId={p.id}
                      targetPath={`/product/${p.id}`}
                      sellerId={p.seller_id || undefined}
                      title={p.title}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Templates */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-gray-900">Post Templates</h2>
          <p className="text-sm text-gray-600">One-click copy. Replace `{`{link}`}` with your link (or copy a tracked link first).</p>

          <div className="mt-4 flex flex-wrap gap-3">
            <select
              value={templateType}
              onChange={(e) => setTemplateType(e.target.value as ShareTargetType)}
              className="px-3 py-2 border border-gray-300 rounded-lg bg-white"
            >
              <option value="product">Product</option>
              <option value="store">Store</option>
              <option value="collection">Collection</option>
              <option value="fundraiser">Fundraiser</option>
            </select>

            <select
              value={templateChannel}
              onChange={(e) => setTemplateChannel(e.target.value as ShareChannel)}
              className="px-3 py-2 border border-gray-300 rounded-lg bg-white"
            >
              {channels.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-4 space-y-3">
            {templates.map((t) => (
              <div key={t.id} className="border border-gray-200 rounded-xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">{t.label}</div>
                    <div className="mt-1 text-sm text-gray-700">{t.text}</div>
                  </div>
                  <button
                    onClick={() => copyTemplate(t.id, t.text)}
                    className="px-3 py-2 rounded-lg bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 flex items-center gap-2"
                  >
                    <Copy className="w-4 h-4" />
                    {copiedTemplateId === t.id ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

