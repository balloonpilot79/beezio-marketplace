import React, { useEffect, useMemo, useState } from 'react';
import { Copy, ExternalLink, Link as LinkIcon, Mail, MessageSquare, Megaphone, Store } from 'lucide-react';
import { copyTextToClipboard } from '../utils/clipboard';

type Props = {
  code: string;
  influencerName?: string | null;
};

type LinkKey =
  | 'general'
  | 'seller'
  | 'affiliate'
  | 'influencer'
  | 'directSignup'
  | 'sellerSignup'
  | 'affiliateSignup';

type ShareChannel = 'facebook' | 'x' | 'everywhere';

type StyleFamily = 'aggressive' | 'professional' | 'casual' | 'standard';

const styleSections: Array<{
  style: StyleFamily;
  title: string;
  description: string;
}> = [
  {
    style: 'standard',
    title: 'Standard',
    description: 'Balanced options for general sharing across most platforms.',
  },
  {
    style: 'aggressive',
    title: 'Aggressive',
    description: 'Higher-energy options with more urgency and stronger punch.',
  },
  {
    style: 'professional',
    title: 'Professional',
    description: 'Cleaner options for polished outreach and business-focused posts.',
  },
  {
    style: 'casual',
    title: 'Casual',
    description: 'Looser options that feel natural in groups, chats, and everyday posts.',
  },
];

const captionTemplates: Array<{
  id: string;
  label: string;
  channel: ShareChannel;
  target: 'seller' | 'affiliate';
  linkKey: LinkKey;
  style: StyleFamily;
  text: string;
}> = [
  {
    id: 'fb-seller',
    label: 'Facebook seller post',
    channel: 'facebook',
    target: 'seller',
    linkKey: 'sellerSignup',
    style: 'standard',
    text: 'Have products to sell? Start a Beezio store with checkout, product pages, and a cleaner way to sell online.',
  },
  {
    id: 'fb-affiliate',
    label: 'Facebook affiliate post',
    channel: 'facebook',
    target: 'affiliate',
    linkKey: 'affiliateSignup',
    style: 'standard',
    text: 'No products to manage? Join Beezio, share products people already want, and earn per sale.',
  },
  {
    id: 'x-seller',
    label: 'X seller post',
    channel: 'x',
    target: 'seller',
    linkKey: 'sellerSignup',
    style: 'standard',
    text: 'Turn your products into a real store with Beezio. Clean storefront. Built-in checkout. Faster launch.',
  },
  {
    id: 'x-affiliate',
    label: 'X affiliate post',
    channel: 'x',
    target: 'affiliate',
    linkKey: 'affiliateSignup',
    style: 'standard',
    text: 'No inventory. No shipping. No product creation. Join Beezio and earn by sharing products.',
  },
  {
    id: 'everywhere-seller',
    label: 'Seller anywhere post',
    channel: 'everywhere',
    target: 'seller',
    linkKey: 'sellerSignup',
    style: 'standard',
    text: 'Need a better way to sell online? Beezio gives you a polished store, built-in checkout, and a fast path to launch.',
  },
  {
    id: 'everywhere-affiliate',
    label: 'Affiliate anywhere post',
    channel: 'everywhere',
    target: 'affiliate',
    linkKey: 'affiliateSignup',
    style: 'standard',
    text: 'Want to earn online without managing products? Start with Beezio and earn per sale from a simple setup.',
  },
  {
    id: 'seller-aggressive',
    label: 'Seller high-energy post',
    channel: 'everywhere',
    target: 'seller',
    linkKey: 'sellerSignup',
    style: 'aggressive',
    text: 'Stop waiting to launch. Put your products in a real Beezio store and start selling with checkout already built in.',
  },
  {
    id: 'affiliate-aggressive',
    label: 'Affiliate high-energy post',
    channel: 'everywhere',
    target: 'affiliate',
    linkKey: 'affiliateSignup',
    style: 'aggressive',
    text: 'Want extra income fast? Join Beezio, share winning products, and get paid on the sales you help drive.',
  },
  {
    id: 'seller-professional',
    label: 'Seller professional post',
    channel: 'everywhere',
    target: 'seller',
    linkKey: 'sellerSignup',
    style: 'professional',
    text: 'Beezio gives sellers a professional storefront, built-in checkout, and a simpler way to launch online.',
  },
  {
    id: 'affiliate-professional',
    label: 'Affiliate professional post',
    channel: 'everywhere',
    target: 'affiliate',
    linkKey: 'affiliateSignup',
    style: 'professional',
    text: 'Beezio gives affiliates a straightforward way to share products and earn commission without managing inventory.',
  },
  {
    id: 'seller-casual',
    label: 'Seller casual post',
    channel: 'facebook',
    target: 'seller',
    linkKey: 'sellerSignup',
    style: 'casual',
    text: 'If you already have products, this is a pretty easy way to get them online without building everything yourself.',
  },
  {
    id: 'affiliate-casual',
    label: 'Affiliate casual post',
    channel: 'facebook',
    target: 'affiliate',
    linkKey: 'affiliateSignup',
    style: 'casual',
    text: 'If you want a side-income option without dealing with inventory, Beezio is worth a look.',
  },
];

const adPreviewTemplates: Array<{
  key: string;
  label: string;
  channel: ShareChannel;
  target: 'seller' | 'affiliate';
  linkKey: LinkKey;
  style: StyleFamily;
  tone: 'dark' | 'light';
  eyebrow: string;
  headline: string;
  subline: string;
  cta: string;
  bg: string;
  accent: string;
  panel: string;
}> = [
  {
    key: 'seller-facebook',
    label: 'Facebook seller card',
    channel: 'facebook',
    target: 'seller',
    linkKey: 'sellerSignup',
    style: 'standard',
    tone: 'dark',
    eyebrow: 'Facebook groups',
    headline: 'Have products to sell?',
    subline: 'Launch a real store with checkout and product pages already built in.',
    cta: 'Open seller store',
    bg: 'from-slate-950 via-slate-900 to-orange-700',
    accent: 'bg-amber-300 text-slate-950',
    panel: 'bg-white/90',
  },
  {
    key: 'affiliate-facebook',
    label: 'Facebook affiliate card',
    channel: 'facebook',
    target: 'affiliate',
    linkKey: 'affiliateSignup',
    style: 'standard',
    tone: 'light',
    eyebrow: 'Facebook groups',
    headline: 'No products to sell?',
    subline: 'Share products people already want and earn per sale.',
    cta: 'Start earning',
    bg: 'from-sky-50 via-blue-100 to-cyan-200',
    accent: 'bg-blue-100 text-blue-950',
    panel: 'bg-white/88',
  },
  {
    key: 'seller-x',
    label: 'X seller card',
    channel: 'x',
    target: 'seller',
    linkKey: 'sellerSignup',
    style: 'standard',
    tone: 'dark',
    eyebrow: 'Post on X',
    headline: 'Turn products into a real store.',
    subline: 'Get a clean storefront, checkout, and a faster launch path.',
    cta: 'Launch your store',
    bg: 'from-zinc-950 via-zinc-900 to-amber-600',
    accent: 'bg-amber-200 text-zinc-950',
    panel: 'bg-white/90',
  },
  {
    key: 'affiliate-x',
    label: 'X affiliate card',
    channel: 'x',
    target: 'affiliate',
    linkKey: 'affiliateSignup',
    style: 'standard',
    tone: 'dark',
    eyebrow: 'Post on X',
    headline: 'No inventory. No shipping. Still get paid.',
    subline: 'Share products. Earn commission on completed sales.',
    cta: 'Become an affiliate',
    bg: 'from-sky-950 via-cyan-800 to-emerald-500',
    accent: 'border border-slate-200 bg-slate-100 text-slate-950',
    panel: 'bg-white/90',
  },
  {
    key: 'seller-everywhere',
    label: 'Seller universal card',
    channel: 'everywhere',
    target: 'seller',
    linkKey: 'sellerSignup',
    style: 'standard',
    tone: 'dark',
    eyebrow: 'Share anywhere',
    headline: 'Sell with a store that looks ready.',
    subline: 'Launch with checkout, product pages, and room to grow.',
    cta: 'Build your store',
    bg: 'from-stone-950 via-stone-900 to-amber-500',
    accent: 'bg-orange-100 text-stone-950',
    panel: 'bg-white/90',
  },
  {
    key: 'affiliate-everywhere',
    label: 'Affiliate universal card',
    channel: 'everywhere',
    target: 'affiliate',
    linkKey: 'affiliateSignup',
    style: 'standard',
    tone: 'light',
    eyebrow: 'Share anywhere',
    headline: 'Want extra income without creating products?',
    subline: 'Join, share offers, and earn per sale from a simple setup.',
    cta: 'Start sharing',
    bg: 'from-emerald-200 via-lime-100 to-yellow-100',
    accent: 'border border-slate-200 bg-slate-100 text-slate-950',
    panel: 'bg-white/85',
  },
  {
    key: 'seller-community',
    label: 'Community seller card',
    channel: 'facebook',
    target: 'seller',
    linkKey: 'sellerSignup',
    style: 'standard',
    tone: 'light',
    eyebrow: 'Community post',
    headline: 'Sell online without building the whole stack.',
    subline: 'Get storefront, checkout, and product pages in one setup.',
    cta: 'Open seller account',
    bg: 'from-amber-50 via-orange-100 to-rose-200',
    accent: 'border border-slate-200 bg-slate-100 text-slate-950',
    panel: 'bg-white/75',
  },
  {
    key: 'affiliate-bright',
    label: 'Bright affiliate card',
    channel: 'everywhere',
    target: 'affiliate',
    linkKey: 'affiliateSignup',
    style: 'standard',
    tone: 'light',
    eyebrow: 'Easy to share',
    headline: 'Extra income without stocking or shipping.',
    subline: 'Share products people already buy and earn commission.',
    cta: 'Start as an affiliate',
    bg: 'from-yellow-100 via-lime-100 to-emerald-200',
    accent: 'border border-slate-200 bg-slate-100 text-slate-950',
    panel: 'bg-white/80',
  },
  {
    key: 'seller-aggressive',
    label: 'Aggressive seller card',
    channel: 'x',
    target: 'seller',
    linkKey: 'sellerSignup',
    style: 'aggressive',
    tone: 'light',
    eyebrow: 'High energy',
    headline: 'Stop waiting. Start selling now.',
    subline: 'Launch your products in a real store with checkout already built in.',
    cta: 'Start selling now',
    bg: 'from-red-200 via-orange-100 to-amber-100',
    accent: 'border border-slate-200 bg-slate-100 text-slate-950',
    panel: 'bg-white/85',
  },
  {
    key: 'affiliate-aggressive',
    label: 'Aggressive affiliate card',
    channel: 'x',
    target: 'affiliate',
    linkKey: 'affiliateSignup',
    style: 'aggressive',
    tone: 'light',
    eyebrow: 'High energy',
    headline: 'Share products. Get paid.',
    subline: 'No inventory. No shipping. Just commission on completed sales.',
    cta: 'Earn per sale',
    bg: 'from-fuchsia-200 via-rose-100 to-amber-100',
    accent: 'border border-slate-200 bg-slate-100 text-slate-950',
    panel: 'bg-white/85',
  },
  {
    key: 'seller-professional',
    label: 'Professional seller card',
    channel: 'everywhere',
    target: 'seller',
    linkKey: 'sellerSignup',
    style: 'professional',
    tone: 'light',
    eyebrow: 'Professional',
    headline: 'A cleaner way to launch your store.',
    subline: 'Get a polished storefront, built-in checkout, and a simpler selling setup.',
    cta: 'Open seller account',
    bg: 'from-slate-100 via-white to-stone-200',
    accent: 'border border-slate-200 bg-slate-100 text-slate-950',
    panel: 'bg-white/85',
  },
  {
    key: 'affiliate-professional',
    label: 'Professional affiliate card',
    channel: 'everywhere',
    target: 'affiliate',
    linkKey: 'affiliateSignup',
    style: 'professional',
    tone: 'light',
    eyebrow: 'Professional',
    headline: 'A simple affiliate setup that is easy to use.',
    subline: 'Share products, track commissions, and earn without managing inventory.',
    cta: 'Open affiliate account',
    bg: 'from-cyan-50 via-white to-sky-100',
    accent: 'border border-slate-200 bg-slate-100 text-slate-950',
    panel: 'bg-white/85',
  },
  {
    key: 'seller-casual',
    label: 'Casual seller card',
    channel: 'facebook',
    target: 'seller',
    linkKey: 'sellerSignup',
    style: 'casual',
    tone: 'light',
    eyebrow: 'Casual share',
    headline: 'If you already have products, this is an easy start.',
    subline: 'Beezio handles the store and checkout part so you can get moving faster.',
    cta: 'Try seller signup',
    bg: 'from-orange-100 via-amber-50 to-lime-100',
    accent: 'border border-slate-200 bg-slate-100 text-slate-950',
    panel: 'bg-white/80',
  },
  {
    key: 'affiliate-casual',
    label: 'Casual affiliate card',
    channel: 'facebook',
    target: 'affiliate',
    linkKey: 'affiliateSignup',
    style: 'casual',
    tone: 'light',
    eyebrow: 'Casual share',
    headline: 'Want a side-income option without inventory?',
    subline: 'Share products people already want and earn when sales come through.',
    cta: 'Try affiliate signup',
    bg: 'from-lime-100 via-emerald-50 to-cyan-100',
    accent: 'border border-slate-200 bg-slate-100 text-slate-950',
    panel: 'bg-white/80',
  },
];

export default function InfluencerRecruitPromoStudio({ code, influencerName }: Props) {
  const [copiedKey, setCopiedKey] = useState('');
  const [activeStyleFilter, setActiveStyleFilter] = useState<'all' | StyleFamily>('all');
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const name = String(influencerName || 'me').trim();
  const filterStorageKey = useMemo(
    () => `beezio-invite-style-filter-${String(code || '').trim() || 'default'}`,
    [code]
  );

  const links = useMemo(() => {
    const encoded = encodeURIComponent(String(code || '').trim());
    return {
      general: `${origin}/promo/join/${encoded}?audience=both`,
      seller: `${origin}/promo/join/${encoded}?audience=seller`,
      affiliate: `${origin}/promo/join/${encoded}?audience=affiliate`,
      influencer: `${origin}/promo/join/${encoded}?audience=influencer`,
      directSignup: `${origin}/i/${encoded}`,
      sellerSignup: `${origin}/signup?role=seller&recruit=${encoded}`,
      affiliateSignup: `${origin}/signup?role=affiliate&recruit=${encoded}`,
    };
  }, [code, origin]);

  const copy = async (key: string, value: string) => {
    if (!value) return;
    const ok = await copyTextToClipboard(value);
    if (ok) {
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey(''), 1400);
    }
  };

  const openShare = (url: string, text: string, channel: ShareChannel = 'facebook') => {
    const shareUrl =
      channel === 'x'
        ? `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`
        : `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(text)}`;
    window.open(shareUrl, '_blank', 'noopener,noreferrer,width=720,height=640');
  };

  const getPreviewText = (tone: 'dark' | 'light') =>
    tone === 'dark'
      ? {
          eyebrow: 'border-white/25 bg-slate-950/42 text-white',
          headline: 'text-white',
          subline: 'text-slate-50',
          metaLabel: 'text-slate-300',
          metaTitle: 'text-slate-950',
          metaText: 'text-slate-700',
          glowOne: 'bg-white/18',
          glowTwo: 'bg-amber-200/22',
        }
      : {
          eyebrow: 'border-slate-200 bg-slate-100/95 text-slate-700',
          headline: 'text-slate-950',
          subline: 'text-slate-800',
          metaLabel: 'text-slate-500',
          metaTitle: 'text-slate-950',
          metaText: 'text-slate-700',
          glowOne: 'bg-white/72',
          glowTwo: 'bg-amber-300/16',
        };

  const getStyleBadgeClasses = (style: StyleFamily) => {
    switch (style) {
      case 'aggressive':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'professional':
        return 'bg-slate-100 text-slate-800 border-slate-200';
      case 'casual':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      default:
        return 'bg-amber-100 text-amber-800 border-amber-200';
    }
  };

  const getStyleLabel = (style: StyleFamily) => {
    switch (style) {
      case 'aggressive':
        return 'Aggressive';
      case 'professional':
        return 'Professional';
      case 'casual':
        return 'Casual';
      default:
        return 'Standard';
    }
  };

  const groupedPreviewTemplates = styleSections
    .map((section) => ({
      ...section,
      items: adPreviewTemplates.filter((preview) => preview.style === section.style),
    }))
    .filter((section) => section.items.length > 0);

  const groupedCaptionTemplates = styleSections
    .map((section) => ({
      ...section,
      items: captionTemplates.filter((template) => template.style === section.style),
    }))
    .filter((section) => section.items.length > 0);

  const visiblePreviewSections = groupedPreviewTemplates.filter(
    (section) => activeStyleFilter === 'all' || section.style === activeStyleFilter
  );

  const visibleCaptionSections = groupedCaptionTemplates.filter(
    (section) => activeStyleFilter === 'all' || section.style === activeStyleFilter
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = window.localStorage.getItem(filterStorageKey);
    if (!saved) return;
    if (saved === 'all' || styleSections.some((section) => section.style === saved)) {
      setActiveStyleFilter(saved as 'all' | StyleFamily);
    }
  }, [filterStorageKey]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(filterStorageKey, activeStyleFilter);
  }, [activeStyleFilter, filterStorageKey]);

  if (!code) return null;

  return (
    <div id="recruit-promos" className="mb-8 rounded-xl border border-gray-200 bg-white p-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-gray-900">
            <Megaphone className="w-5 h-5 text-gray-600" />
            <h3 className="text-lg font-bold">Private Invite Link Studio</h3>
          </div>
          <p className="mt-2 max-w-3xl text-sm text-gray-600">
            Manage your real signup links here. The shared public page stays signup-focused, while this private panel keeps your invite variants, preview cards, and internal copy notes together.
          </p>
        </div>
        <a
          href={links.general}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-900 hover:border-gray-500"
        >
          Open public page
          <ExternalLink className="w-4 h-4" />
        </a>
      </div>

      <div className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-emerald-950">
          <LinkIcon className="w-4 h-4 text-emerald-800" />
          Primary influencer invite link
        </div>
        <p className="mt-1 text-sm text-emerald-900">
          This is the main public invite link. It keeps your influencer attribution attached.
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            readOnly
            value={links.directSignup}
            className="w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm text-gray-900"
          />
          <button
            type="button"
            onClick={() => copy('direct-signup', links.directSignup)}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-300 bg-emerald-100 px-4 py-2 text-sm font-semibold text-emerald-950 hover:bg-emerald-200"
          >
            <Copy className="w-4 h-4" />
            {copiedKey === 'direct-signup' ? 'Copied' : 'Copy link'}
          </button>
        </div>
      </div>

      <div className="mt-5 rounded-lg border border-gray-200 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
          <Megaphone className="w-4 h-4 text-gray-600" />
          Private preview cards
        </div>
        <p className="mt-1 text-xs text-gray-500">
          These are internal preview mockups for your own planning and asset prep. They are not the public signup page itself.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveStyleFilter('all')}
            className={`rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] ${
              activeStyleFilter === 'all'
                ? 'border-amber-300 bg-amber-100 text-amber-950'
                : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
            }`}
          >
            All styles
          </button>
          {styleSections.map((section) => (
            <button
              key={section.style}
              type="button"
              onClick={() => setActiveStyleFilter(section.style)}
              className={`rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] ${
                activeStyleFilter === section.style
                  ? getStyleBadgeClasses(section.style)
                  : `${getStyleBadgeClasses(section.style)} hover:opacity-85`
              }`}
            >
              {section.title}
            </button>
          ))}
        </div>
        <div className="mt-4 space-y-6">
          {visiblePreviewSections.map((section) => (
            <div key={section.style}>
              <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <div className="text-sm font-semibold text-gray-900">{section.title}</div>
                  <div className="text-xs text-gray-500">{section.description}</div>
                </div>
                <div className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${getStyleBadgeClasses(section.style)}`}>
                  {getStyleLabel(section.style)}
                </div>
              </div>
                <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                {section.items.map((preview) => {
                  const previewText = getPreviewText(preview.tone);
                  return (
                  <div key={preview.key} className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                    <div className={`relative min-h-[360px] bg-gradient-to-br ${preview.bg} p-4`}>
                      <div className={`absolute right-4 top-4 h-16 w-16 rounded-full blur-sm ${previewText.glowOne}`} />
                      <div className={`absolute bottom-20 left-5 h-24 w-24 rounded-full blur-xl ${previewText.glowTwo}`} />
                      <div className="relative flex h-full min-h-[328px] flex-col">
                        <div>
                          <div className="flex flex-wrap gap-2">
                            <div className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${previewText.eyebrow}`}>
                              {preview.eyebrow}
                            </div>
                            <div className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${getStyleBadgeClasses(preview.style)}`}>
                              {getStyleLabel(preview.style)}
                            </div>
                          </div>
                          <div className={`mt-5 max-w-[13rem] text-[1.72rem] font-black leading-[1.04] tracking-tight ${previewText.headline}`}>
                            {preview.headline}
                          </div>
                          <div className={`mt-3 max-w-[14rem] text-sm leading-snug ${previewText.subline}`}>
                            {preview.subline}
                          </div>
                        </div>
                        <div className="mt-auto pt-5">
                          <div className={`rounded-2xl border border-white/20 ${preview.panel} p-3 shadow-[0_14px_36px_rgba(0,0,0,0.20)] backdrop-blur-sm`}>
                            <div className={`text-[10px] uppercase tracking-[0.16em] ${previewText.metaLabel}`}>
                              {preview.target === 'seller' ? 'Seller signup' : 'Affiliate signup'}
                            </div>
                            <div className={`mt-1 text-sm font-bold ${previewText.metaTitle}`}>{name} shared this invite</div>
                            <div className={`mt-1 text-xs leading-5 ${previewText.metaText}`}>
                              {preview.channel === 'facebook'
                                ? 'Built for Facebook groups and community posts.'
                                : preview.channel === 'x'
                                ? 'Built for short-form posts on X.'
                                : 'Built for texts, DMs, comments, and general sharing.'}
                            </div>
                          </div>
                          <div className="mt-3 flex items-center justify-between gap-2">
                            <div className={`inline-flex rounded-full px-4 py-2 text-xs font-black ${preview.accent}`}>
                              {preview.cta}
                            </div>
                            <button
                              type="button"
                              onClick={() => copy(`ad-${preview.key}`, `${preview.headline}\n\n${links[preview.linkKey]}`)}
                              className="inline-flex items-center gap-1 rounded-lg border border-black/10 bg-white/80 px-2.5 py-1.5 text-xs font-semibold text-slate-900 hover:bg-white"
                            >
                              <Copy className="h-3.5 w-3.5" />
                              {copiedKey === `ad-${preview.key}` ? 'Copied' : 'Copy'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex min-h-[64px] items-center justify-between gap-2 p-3">
                      <div className="text-sm font-semibold text-gray-900">{preview.label}</div>
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                        {preview.channel === 'everywhere' ? 'Universal' : preview.channel}
                      </div>
                    </div>
                  </div>
                )})}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4">
        <div className="text-sm font-semibold text-amber-950">Audience-focused business signup links</div>
        <p className="mt-1 text-sm text-amber-900">
          Both links create the same unified seller, affiliate, and influencer account. The wording only matches the audience you are inviting, and your lifetime recruiter code stays attached.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          {[
            { key: 'seller-signup', label: 'Seller-focused signup', value: links.sellerSignup },
            { key: 'affiliate-signup', label: 'Affiliate-focused signup', value: links.affiliateSignup },
          ].map((item) => (
            <div key={item.key} className="rounded-lg border border-amber-100 bg-white p-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-amber-700">{item.label}</div>
              <input
                readOnly
                value={item.value}
                className="mt-2 w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-xs text-gray-900"
              />
              <button
                type="button"
                onClick={() => copy(item.key, item.value)}
                className="mt-3 inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-gray-100 px-3 py-2 text-xs font-semibold text-gray-900 hover:bg-gray-200"
              >
                <Copy className="w-4 h-4" />
                {copiedKey === item.key ? 'Copied' : 'Copy signup link'}
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 lg:grid-cols-4 gap-4">
        {[
          { key: 'general', label: 'General invite page', icon: Megaphone, value: links.general },
          { key: 'seller', label: 'Seller invite page', icon: Store, value: links.seller },
          { key: 'affiliate', label: 'Affiliate invite page', icon: MessageSquare, value: links.affiliate },
          { key: 'influencer', label: 'Influencer invite page', icon: Megaphone, value: links.influencer },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.key} className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                <Icon className="w-4 h-4 text-gray-600" />
                {item.label}
              </div>
              <input
                readOnly
                value={item.value}
                className="mt-3 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs text-gray-900"
              />
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => copy(item.key, item.value)}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-gray-100 px-3 py-2 text-xs font-semibold text-gray-900 hover:bg-gray-200"
                >
                  <Copy className="w-4 h-4" />
                  {copiedKey === item.key ? 'Copied' : 'Copy'}
                </button>
                <button
                  type="button"
                  onClick={() => openShare(item.value, `Join Beezio through ${name}`, 'facebook')}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-900 hover:border-gray-500"
                >
                  Share
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-5 rounded-lg border border-gray-200 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
          <Mail className="w-4 h-4 text-gray-600" />
          Private copy notes
        </div>
        <div className="mt-4 space-y-6">
          {visibleCaptionSections.map((section) => (
            <div key={section.style}>
              <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <div className="text-sm font-semibold text-gray-900">{section.title}</div>
                  <div className="text-xs text-gray-500">{section.description}</div>
                </div>
                <div className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${getStyleBadgeClasses(section.style)}`}>
                  {getStyleLabel(section.style)}
                </div>
              </div>
              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
                {section.items.map((template) => (
                  <div key={template.id} className="rounded-lg bg-gray-50 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">{template.label}</div>
                      <span className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] ${getStyleBadgeClasses(template.style)}`}>
                        {getStyleLabel(template.style)}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-gray-700">{template.text}</p>
                    <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-wide">
                      <span className="rounded-full bg-gray-200 px-2 py-1 text-gray-700">{template.channel}</span>
                      <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-800">{template.target}</span>
                    </div>
                    <div className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                      Attached link: {template.linkKey === 'sellerSignup' ? 'Seller-focused business signup' : template.linkKey === 'affiliateSignup' ? 'Affiliate-focused business signup' : 'Unified business invite'}
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() => copy(`caption-${template.id}`, `${template.text}\n\n${links[template.linkKey]}`)}
                        className="inline-flex items-center gap-2 text-xs font-semibold text-gray-900 hover:text-black"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        {copiedKey === `caption-${template.id}` ? 'Copied' : 'Copy notes'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (template.channel === 'everywhere') {
                            copy(`share-${template.id}`, `${template.text}\n\n${links[template.linkKey]}`);
                            return;
                          }
                          openShare(links[template.linkKey], template.text, template.channel);
                        }}
                        className="inline-flex items-center gap-2 text-xs font-semibold text-gray-900 hover:text-black"
                      >
                        {template.channel === 'everywhere' ? 'Copy ready-to-share' : 'Share'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
