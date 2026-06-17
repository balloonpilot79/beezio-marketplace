import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, ExternalLink, ShieldCheck, Star, Store, Users } from 'lucide-react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { getBuyerFacingProductPrice } from '../utils/buyerPrice';
import { getFallbackProductImage, normalizeProductImages } from '../utils/imageHelpers';

type PromoProduct = {
  id: string;
  title: string;
  description?: string | null;
  images?: unknown;
  seller_id?: string | null;
  commission_rate?: number | null;
  commission_type?: string | null;
  flat_commission_amount?: number | null;
  affiliate_commission_rate?: number | null;
  affiliate_commission_type?: 'percent' | 'flat' | null;
  affiliate_commission_value?: number | null;
  price?: number | null;
  calculated_customer_price?: number | null;
  seller_ask?: number | null;
  seller_amount?: number | null;
  seller_ask_price?: number | null;
  profiles?: {
    full_name?: string | null;
  } | null;
};

type PromoOwner = {
  full_name?: string | null;
  email?: string | null;
};

const audienceContent: Record<string, { eyebrow: string; angle: string; subhead: string }> = {
  gift: {
    eyebrow: 'Gift-ready product',
    angle: 'A useful pick for thoughtful gifting.',
    subhead: 'A focused product page that keeps the item, the value, and the next step clear.',
  },
  deal: {
    eyebrow: 'Value-focused product',
    angle: 'Straightforward value without extra clutter.',
    subhead: 'A focused product page that keeps the item, the value, and the next step clear.',
  },
  creator: {
    eyebrow: 'Creator-ready product',
    angle: 'A clean product spotlight built to be easy to shop.',
    subhead: 'A focused product page that keeps the item, the value, and the next step clear.',
  },
  professional: {
    eyebrow: 'Professional product',
    angle: 'Clear, direct, and easy to review.',
    subhead: 'A focused product page that keeps the item, the value, and the next step clear.',
  },
  everyday: {
    eyebrow: 'Everyday product',
    angle: 'Simple to understand and easy to buy.',
    subhead: 'A focused product page that keeps the item, the value, and the next step clear.',
  },
};

const sanitizeDescription = (value: string | null | undefined) =>
  String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const normalizeSentence = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return '';
  const withPunctuation = /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
  return withPunctuation.charAt(0).toUpperCase() + withPunctuation.slice(1);
};

const splitDescriptionPoints = (description: string) =>
  description
    .split(/(?<=[.!?])\s+|[\n\r]+|(?:\s+-\s+)/)
    .map((item) => normalizeSentence(item.replace(/^[-*•\s]+/, '')))
    .filter((item) => item.length > 8)
    .slice(0, 6);

const inferProductSignals = (title: string, description: string) => {
  const combined = `${title} ${description}`.toLowerCase();

  if (/\b(engine|repair|tool|stand|bracket|kit|garage|automotive|car|truck)\b/.test(combined)) {
    return {
      hero: 'Built for buyers who want reliable gear that solves the job without wasting time.',
      proofTitle: 'Why this product earns attention',
      proofBody: 'The value here is practical: it helps the buyer get a real task handled with a product that feels purpose-built instead of generic.',
      cards: [
        {
          title: 'Job-focused value',
          body: 'This listing speaks to buyers who care more about function, fit, and getting results than flashy extras.',
        },
        {
          title: 'Confidence before checkout',
          body: 'The page keeps the product, price, and decision clear so serious buyers can move without second-guessing.',
        },
        {
          title: 'Made for real use',
          body: 'It is positioned like a practical purchase for someone who plans to put it to work, not let it sit on a shelf.',
        },
      ],
    };
  }

  if (/\b(sticker|shirt|hoodie|hat|poster|mug|gift|apparel|design|graphic)\b/.test(combined)) {
    return {
      hero: 'A clean product spotlight that helps buyers picture the product, the style, and the payoff right away.',
      proofTitle: 'Why this product earns attention',
      proofBody: 'This page keeps the focus on what makes the product appealing, easy to gift, or worth picking up for yourself.',
      cards: [
        {
          title: 'Style with a purpose',
          body: 'The strongest product pages make the item feel easy to own, share, wear, or gift without adding friction.',
        },
        {
          title: 'Fast buying decision',
          body: 'A shopper can understand the offer quickly and decide whether it fits their taste, budget, or occasion.',
        },
        {
          title: 'Better impulse appeal',
          body: 'When the page stays focused on the product, interest has a much better chance of turning into checkout.',
        },
      ],
    };
  }

  return {
    hero: 'A focused product page built to help buyers understand the offer fast and feel confident about the purchase.',
    proofTitle: 'Why this product earns attention',
    proofBody: 'The goal is simple: show what the buyer gets, why it matters, and why this product deserves the next click.',
    cards: [
      {
        title: 'Clear product value',
        body: 'Everything stays centered on what the buyer gets and why the purchase makes sense right now.',
      },
      {
        title: 'Stronger buyer confidence',
        body: 'A cleaner page makes it easier for interested shoppers to stay focused and move toward checkout.',
      },
      {
        title: 'Built to convert interest',
        body: 'The copy and layout are meant to support a buying decision, not distract from it.',
      },
    ],
  };
};

const buildSalesPoints = (description: string, title: string) => {
  const sentences = splitDescriptionPoints(description).slice(0, 3);

  if (sentences.length >= 3) return sentences;

  const fallback = [
    normalizeSentence(`${title} gives buyers a straightforward reason to act when they want a product that does its job well`),
    'The page keeps the offer clear so shoppers can decide quickly whether it fits what they need.',
    'Everything is positioned around practical value, confidence, and an easier path to checkout.',
  ];

  return [...sentences, ...fallback].slice(0, 3);
};

export default function AffiliateSingleProductPromoPage() {
  const { productId } = useParams<{ productId: string }>();
  const [searchParams] = useSearchParams();
  const [product, setProduct] = useState<PromoProduct | null>(null);
  const [ownerProfile, setOwnerProfile] = useState<PromoOwner | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const audienceId = String(searchParams.get('audience') || 'everyday').toLowerCase();
  const embed = searchParams.get('embed') === '1';
  const audience = audienceContent[audienceId] || audienceContent.everyday;
  const ref = String(searchParams.get('ref') || '').trim();
  const uid = String(searchParams.get('uid') || '').trim();
  const owner = String(searchParams.get('owner') || uid || ref || '').trim();

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!productId) {
        setError('Missing product');
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const response = await fetch(`/.netlify/functions/public-product-get?id=${encodeURIComponent(productId)}`);
        const payload = await response.json().catch(() => ({}));

        if (!active) return;
        if (!response.ok) {
          setError(String(payload?.error || `Failed to load product (${response.status})`));
          setProduct(null);
        } else if (!payload?.product) {
          setError('Product not found');
          setProduct(null);
        } else {
          setProduct(payload.product as PromoProduct);
          setError('');
        }
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Failed to load product');
        setProduct(null);
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [productId]);

  useEffect(() => {
    let active = true;
    const loadOwner = async () => {
      if (!owner) {
        setOwnerProfile(null);
        return;
      }

      try {
        const { data } = await supabase
          .from('profiles')
          .select('full_name,email')
          .eq('id', owner)
          .maybeSingle();

        if (active) setOwnerProfile((data as PromoOwner) || null);
      } catch {
        if (active) setOwnerProfile(null);
      }
    };

    void loadOwner();
    return () => {
      active = false;
    };
  }, [owner]);

  const displayPrice = useMemo(() => {
    if (!product) return 0;
    return getBuyerFacingProductPrice(product);
  }, [product]);

  const productImages = useMemo(() => {
    const images = normalizeProductImages(product?.images);
    return images.length ? images : [getFallbackProductImage(product?.title || product?.id)];
  }, [product]);

  const productImage = productImages[Math.min(selectedImageIndex, Math.max(productImages.length - 1, 0))];

  const productPath = useMemo(() => {
    if (!product?.id) return '/marketplace';
    const params = new URLSearchParams();
    if (ref) params.set('ref', ref);
    if (uid) params.set('uid', uid);
    const qs = params.toString();
    return `/product/${product.id}${qs ? `?${qs}` : ''}`;
  }, [product?.id, ref, uid]);

  const cleanedDescription = sanitizeDescription(product?.description);
  const salesPoints = buildSalesPoints(cleanedDescription, product?.title || 'this product');
  const productSignals = inferProductSignals(product?.title || '', cleanedDescription);
  const promoterName = String(ownerProfile?.full_name || ownerProfile?.email || '').trim();
  const sharedByLabel = promoterName || 'Your Beezio connection';
  const sellerName = String(product?.profiles?.full_name || '').trim() || 'Beezio seller';

  useEffect(() => {
    setSelectedImageIndex(0);
  }, [product?.id]);

  if (loading) {
    return <div className="min-h-screen bg-slate-50 px-4 py-20 text-center text-gray-600">Loading promo page...</div>;
  }

  if (!product || error) {
    return <div className="min-h-screen bg-slate-50 px-4 py-20 text-center text-red-600">{error || 'Product not found'}</div>;
  }

  return (
    <div className={`${embed ? 'min-h-full' : 'min-h-screen'} bg-white`}>
      <div className={`mx-auto max-w-7xl ${embed ? 'px-3 py-3 sm:px-4 sm:py-4' : 'px-4 py-8 sm:px-6 lg:px-8'}`}>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 pb-4">
          <Link to="/marketplace" className="inline-flex items-center gap-2 text-sm font-semibold text-gray-700 hover:text-gray-900">
            <ArrowLeft className="h-4 w-4" />
            Back to marketplace
          </Link>
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
            <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-800">{audience.eyebrow}</span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">Shared by {sharedByLabel}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <div className="overflow-hidden rounded-3xl border border-gray-200 bg-gray-50">
              <img src={productImage} alt={product.title} className="h-full min-h-[420px] w-full object-cover" />
            </div>
            {productImages.length > 1 ? (
              <div className="mt-4 grid grid-cols-5 gap-3 sm:grid-cols-6">
                {productImages.map((image, index) => (
                  <button
                    key={`${image}-${index}`}
                    type="button"
                    onClick={() => setSelectedImageIndex(index)}
                    className={`overflow-hidden rounded-2xl border ${selectedImageIndex === index ? 'border-slate-900' : 'border-gray-200'} bg-white`}
                  >
                    <img src={image} alt={`${product.title} ${index + 1}`} className="h-20 w-full object-cover" />
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div>
            <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
              <div className="text-sm font-semibold uppercase tracking-[0.16em] text-gray-500">{audience.eyebrow}</div>
              <h1 className="mt-3 text-3xl font-bold tracking-tight text-gray-950 sm:text-4xl">{product.title}</h1>
              <p className="mt-4 text-base leading-7 text-gray-700">{productSignals.hero}</p>

              <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-gray-600">
                <div className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1.5 font-semibold text-gray-800">
                  <Store className="h-4 w-4" />
                  {sellerName}
                </div>
                <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1.5 font-semibold text-amber-900">
                  <Users className="h-4 w-4" />
                  Shared by {sharedByLabel}
                </div>
              </div>

              <div className="mt-6 rounded-2xl bg-slate-950 px-5 py-5 text-white">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-300">Price</div>
                <div className="mt-2 text-4xl font-black">${displayPrice.toFixed(2)}</div>
                <div className="mt-2 text-sm text-slate-300">{audience.angle}</div>
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  to={productPath}
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white hover:bg-black"
                >
                  Shop this product
                  <ExternalLink className="h-4 w-4" />
                </Link>
                <Link
                  to={`${productPath}${productPath.includes('?') ? '&' : '?'}view=details`}
                  className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-5 py-3 text-sm font-bold text-gray-900 hover:bg-gray-50"
                >
                  View full details
                </Link>
              </div>

              <div className="mt-8 space-y-4">
                <div>
                  <h2 className="text-lg font-semibold text-gray-950">{productSignals.proofTitle}</h2>
                  <p className="mt-3 text-base leading-7 text-gray-700">{cleanedDescription || productSignals.proofBody}</p>
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-950">Reasons to buy now</h2>
                  <ul className="mt-3 space-y-3">
                    {salesPoints.map((point) => (
                      <li key={point} className="flex gap-3 text-sm leading-6 text-gray-700">
                        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {productSignals.cards.map((card, index) => (
                <div key={card.title} className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                    {index === 0 ? (
                      <ShieldCheck className="h-4 w-4 text-emerald-600" />
                    ) : index === 1 ? (
                      <Users className="h-4 w-4 text-blue-600" />
                    ) : (
                      <Star className="h-4 w-4 text-amber-500" />
                    )}
                    {card.title}
                  </div>
                  <p className="mt-2 text-sm text-gray-600">{card.body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
