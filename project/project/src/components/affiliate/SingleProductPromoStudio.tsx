import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Copy, ExternalLink, Mail, MessageSquare, MonitorSmartphone, PackagePlus, PlayCircle, QrCode, Sparkles, Ticket, Video } from 'lucide-react';
import { useAffiliate } from '../../contexts/AffiliateContext';
import { useAuth } from '../../contexts/AuthContextMultiRole';
import { copyTextToClipboard } from '../../utils/clipboard';
import { supabase } from '../../lib/supabase';
import { normalizeProductImages } from '../../utils/imageHelpers';
import { getPromoDisplayPrice, slugifyPromoValue } from '../../utils/promoLinks';
import { apiPost } from '../../utils/netlifyApi';
import { fetchAccountOwnedProducts } from '../../utils/accountOwnedProducts';
import { buildPromoterReferralParams } from '../../utils/promoAttribution';

type PromoProduct = {
  id: string;
  title: string;
  description?: string;
  price: number;
  seller_id?: string;
  commission_rate?: number;
  affiliate_commission_rate?: number;
  commission_type?: string;
  affiliate_commission_type?: 'percent' | 'flat' | null;
  flat_commission_amount?: number;
  affiliate_commission_value?: number;
  image_url?: string;
  seller_name?: string;
  category?: string;
};

type Props = {
  products: PromoProduct[];
  className?: string;
  title?: string;
  promoterRole?: 'affiliate' | 'seller';
  ownerId?: string;
};

type AudiencePreset = {
  id: string;
  label: string;
  angle: string;
  headline: string;
  caption: string;
};

const audiencePresets: AudiencePreset[] = [
  {
    id: 'gift',
    label: 'Gift Buyers',
    angle: 'Great-for-gifting',
    headline: 'A gift pick that feels useful, not random.',
    caption: 'If you need one easy gift idea, this is the one I would send first.',
  },
  {
    id: 'deal',
    label: 'Deal Seekers',
    angle: 'Value-first',
    headline: 'A practical pick that earns its price.',
    caption: 'If you care more about value than hype, this is worth a serious look.',
  },
  {
    id: 'creator',
    label: 'Creators',
    angle: 'Workflow boost',
    headline: 'A solid pick for people building, posting, and shipping fast.',
    caption: 'This is the kind of product I would share with creators who want fewer weak links in the workflow.',
  },
  {
    id: 'professional',
    label: 'Professionals',
    angle: 'Clean and credible',
    headline: 'A cleaner recommendation for people who want the safe choice.',
    caption: 'Simple, useful, and easy to recommend without overselling it.',
  },
  {
    id: 'everyday',
    label: 'Everyday Use',
    angle: 'Daily life',
    headline: 'A useful everyday pick that is easy to understand fast.',
    caption: 'This is an easy everyday recommendation when someone asks what is actually worth buying.',
  },
];

const videoScriptPresets = [
  {
    id: 'hook15',
    label: '15-second Reel',
    text: `Hook: If you only look at one item today, make it this one.
Middle: The main reason I like it is that it solves a real problem without feeling complicated.
Close: I dropped the link here if you want to see the details yourself.`,
  },
  {
    id: 'story',
    label: 'Story Slide Script',
    text: `Slide 1: Quick find I wanted to share.
Slide 2: What stood out to me: price, look, and how easy it is to understand.
Slide 3: If you want the exact item, use my link here.`,
  },
  {
    id: 'live',
    label: 'Live Selling Prompt',
    text: `If anyone wants one specific item instead of browsing a whole store, this is the one I would pull up first. I like it because it is straightforward, it looks strong, and you can check the full details from my link right now.`,
  },
];

const promoAssetPresets = [
  { id: 'square', label: 'Square Post', width: 1080, height: 1080 },
  { id: 'story', label: 'Story', width: 1080, height: 1920 },
  { id: 'flyer', label: 'Flyer', width: 1200, height: 1600 },
];

const promoMethodCards = [
  { label: 'Product page', text: 'Send buyers to one focused product instead of making them search a whole store.' },
  { label: 'Tracked link', text: 'Use the product link that keeps your connection attached when someone clicks through.' },
  { label: 'QR code', text: 'Print the item link on flyers, booth signs, cards, inserts, and posters.' },
  { label: 'Social ads', text: 'Copy captions, hooks, and audience angles for posts, reels, lives, and groups.' },
  { label: 'Email and SMS', text: 'Launch a one-product message with a subject, short text, and direct call to action.' },
  { label: 'Website embed', text: 'Place the item card or full landing page on a website or custom page.' },
];

const sectionCard = 'rounded-2xl border border-gray-200 bg-white p-5 shadow-sm';
const PRODUCT_SELECT_FIELDS =
  'id,title,name,description,price,calculated_customer_price,seller_ask,seller_amount,seller_ask_price,commission_rate,affiliate_commission_rate,commission_type,affiliate_commission_type,flat_commission_amount,affiliate_commission_value,category,image_url,images,seller_id';

const buildPublicPromoBase = (
  productId: string,
  promoterRole: 'affiliate' | 'seller',
  ownerId: string,
  productSellerId?: string | null
) => {
  const params = new URLSearchParams();
  params.set('promoter', promoterRole);
  if (ownerId) {
    params.set('owner', ownerId);
  }
  buildPromoterReferralParams({ promoterRole, ownerId, productSellerId }).forEach((value, key) => {
    params.set(key, value);
  });
  return `${window.location.origin}/promo/product/${encodeURIComponent(productId)}?${params.toString()}`;
};

const escapeHtml = (value: string) =>
  String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const escapeSvg = (value: string) => escapeHtml(value);

const openPopup = (url: string) => {
  window.open(url, '_blank', 'noopener,noreferrer,width=820,height=700');
};

const downloadTextFile = (filename: string, contents: string, mime = 'text/plain;charset=utf-8') => {
  const blob = new Blob([contents], { type: mime });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(href);
};

const buildPosterSvg = (
  product: PromoProduct,
  url: string,
  preset: { width: number; height: number },
  audience: AudiencePreset,
  promoterLabel: string,
  promoterName: string
) => {
  const width = preset.width;
  const height = preset.height;
  const title = escapeSvg(product.title);
  const price = `$${getPromoDisplayPrice(product).toFixed(2)}`;
  const headline = escapeSvg(audience.headline);
  const promoter = escapeSvg(promoterName || promoterLabel);
  const imageUrl = String(product.image_url || '').trim();
  const shortUrl = escapeSvg(url.replace(/^https?:\/\//, ''));

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#fff8e1" />
      <stop offset="55%" stop-color="#f4f0ff" />
      <stop offset="100%" stop-color="#e4f5ff" />
    </linearGradient>
    <linearGradient id="panel" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#111827" />
      <stop offset="100%" stop-color="#27364b" />
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" rx="44" fill="url(#bg)" />
  <circle cx="${width - 130}" cy="120" r="110" fill="#f59e0b" opacity="0.18" />
  <circle cx="120" cy="${height - 140}" r="130" fill="#2563eb" opacity="0.12" />
  <rect x="56" y="56" width="${width - 112}" height="${height - 112}" rx="34" fill="white" opacity="0.93" />
  ${
    imageUrl
      ? `<image href="${escapeHtml(imageUrl)}" x="${Math.round(width * 0.12)}" y="120" width="${Math.round(width * 0.76)}" height="${Math.round(height * 0.36)}" preserveAspectRatio="xMidYMid meet" />`
      : `<rect x="${Math.round(width * 0.12)}" y="120" width="${Math.round(width * 0.76)}" height="${Math.round(height * 0.36)}" rx="30" fill="#e5e7eb" />`
  }
  <rect x="80" y="${Math.round(height * 0.56)}" width="${width - 160}" height="${Math.round(height * 0.33)}" rx="28" fill="url(#panel)" />
  <text x="110" y="${Math.round(height * 0.61)}" font-size="34" font-family="Arial, Helvetica, sans-serif" fill="#fbbf24" font-weight="700">${headline}</text>
  <text x="110" y="${Math.round(height * 0.67)}" font-size="50" font-family="Arial, Helvetica, sans-serif" fill="white" font-weight="800">${title}</text>
  <text x="110" y="${Math.round(height * 0.74)}" font-size="42" font-family="Arial, Helvetica, sans-serif" fill="#cbd5e1">Price paid: ${price}</text>
  <text x="110" y="${Math.round(height * 0.79)}" font-size="26" font-family="Arial, Helvetica, sans-serif" fill="#e5e7eb">Shared by ${promoter}</text>
  <rect x="110" y="${Math.round(height * 0.82)}" width="${Math.round(width * 0.42)}" height="72" rx="18" fill="#fbbf24" />
  <text x="140" y="${Math.round(height * 0.865)}" font-size="30" font-family="Arial, Helvetica, sans-serif" fill="#111827" font-weight="800">Open item page</text>
  <text x="110" y="${Math.round(height * 0.92)}" font-size="22" font-family="Arial, Helvetica, sans-serif" fill="#cbd5e1">${shortUrl}</text>
</svg>`;
};

export default function SingleProductPromoStudio(props: Props) {
  const { profile, user } = useAuth();
  const { generateAffiliateLink } = useAffiliate();
  const [loadedProducts, setLoadedProducts] = useState<PromoProduct[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const products = useMemo(
    () => {
      const allProducts = [...(props.products || []), ...loadedProducts];
      return (
      Array.from(
        new Map(
          allProducts
            .filter((product) => String(product?.id || '').trim())
            .map((product) => [String(product.id), product])
        ).values()
      )
      );
    },
    [loadedProducts, props.products]
  );
  const effectiveProducts = products;
  const promoterRole = props.promoterRole || 'affiliate';
  const ownerId = String(props.ownerId || profile?.id || user?.id || '').trim();
  const promoterLabel = promoterRole === 'seller' ? 'seller' : 'affiliate';
  const promoterName = String(profile?.full_name || profile?.email || promoterLabel).trim();
  const storageKey = ownerId ? `beezio-${promoterRole}-single-product-${ownerId}` : '';
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedAudience, setSelectedAudience] = useState<string>(audiencePresets[0].id);
  const [copiedKey, setCopiedKey] = useState('');
  const [productMenuOpen, setProductMenuOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const normalizeProduct = (product: any): PromoProduct | null => {
      const id = String(product?.id || product?.product_id || '').trim();
      if (!id) return null;
      const images = normalizeProductImages(product?.images || product?.image_url);
      return {
        id,
        title: String(product?.title || product?.name || 'Product'),
        description: String(product?.description || ''),
        price: getPromoDisplayPrice(product || {}),
        seller_id: String(product?.seller_id || ''),
        commission_rate: Number(product?.commission_rate || product?.affiliate_commission_rate || product?.flat_commission_amount || 0),
        affiliate_commission_rate: Number(product?.affiliate_commission_rate || 0),
        commission_type: String(product?.commission_type || ''),
        affiliate_commission_type: (product?.affiliate_commission_type || null) as 'percent' | 'flat' | null,
        flat_commission_amount: Number(product?.flat_commission_amount || 0),
        affiliate_commission_value: Number(product?.affiliate_commission_value || 0),
        image_url: images[0] || String(product?.image_url || ''),
        seller_name: String(product?.seller_name || product?.profiles?.full_name || product?.profiles?.email || 'Marketplace Seller'),
        category: product?.category || undefined,
      };
    };

    const hydrateProductIds = async (ids: string[]) => {
      const productIds = Array.from(new Set(ids.map((id) => String(id || '').trim()).filter(Boolean)));
      if (!productIds.length) return [];
      const { data } = await supabase
        .from('products')
        .select(PRODUCT_SELECT_FIELDS)
        .in('id', productIds);
      const rows = ((data as any[]) || []).filter(Boolean);
      const sellerIds = Array.from(new Set(rows.map((row: any) => String(row?.seller_id || '').trim()).filter(Boolean)));
      const sellerNameById = new Map<string, string>();
      if (sellerIds.length) {
        try {
          const { data: sellerRows } = await supabase
            .from('profiles')
            .select('id,full_name,email')
            .in('id', sellerIds);
          ((sellerRows as any[]) || []).forEach((seller: any) => {
            const id = String(seller?.id || '').trim();
            if (id) sellerNameById.set(id, String(seller?.full_name || seller?.email || 'Marketplace Seller'));
          });
        } catch {
          // Seller names are helpful, not required for the selector.
        }
      }
      return rows
        .map((row: any) => normalizeProduct({ ...row, seller_name: sellerNameById.get(String(row?.seller_id || '').trim()) || row?.seller_name }))
        .filter(Boolean) as PromoProduct[];
    };

    const loadProducts = async () => {
      const ownerAliases = Array.from(
        new Set(
          [ownerId, profile?.id, (profile as any)?.user_id, user?.id]
            .map((value) => String(value || '').trim())
            .filter(Boolean)
        )
      );

      if (!ownerAliases.length) {
        setLoadedProducts([]);
        return;
      }

      setLoadingProducts(true);
      const found: PromoProduct[] = [];

      try {
        const owned = await fetchAccountOwnedProducts();
        found.push(...(((owned.products as any[]) || []).map(normalizeProduct).filter(Boolean) as PromoProduct[]));
      } catch (err) {
        console.warn('[SingleProductPromoStudio] account-owned-products load failed:', err);
      }

      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const payload = await apiPost<any>('/.netlify/functions/affiliate-products-list', sessionData?.session ?? null, {
          affiliate_ids: ownerAliases,
        });
        found.push(
          ...(((payload?.rows as any[]) || [])
            .map((row) => normalizeProduct(Array.isArray(row?.products) ? row.products[0] : row?.products))
            .filter(Boolean) as PromoProduct[])
        );
      } catch (err) {
        console.warn('[SingleProductPromoStudio] affiliate-products-list load failed:', err);
      }

      try {
        const { data: sellerRows } = await supabase
          .from('products')
          .select(PRODUCT_SELECT_FIELDS)
          .in('seller_id', ownerAliases)
          .order('created_at', { ascending: false })
          .limit(300);

        found.push(...(await hydrateProductIds(((sellerRows as any[]) || []).map((row: any) => row?.id))));
      } catch (err) {
        console.warn('[SingleProductPromoStudio] seller product load failed:', err);
      }

      try {
        const { data: affiliateRows } = await supabase
          .from('affiliate_products')
          .select('product_id,display_order')
          .in('affiliate_id', ownerAliases)
          .order('display_order', { ascending: true })
          .limit(300);

        found.push(...(await hydrateProductIds(((affiliateRows as any[]) || []).map((row: any) => row?.product_id))));
      } catch (err) {
        console.warn('[SingleProductPromoStudio] affiliate product load failed:', err);
      }

      try {
        const { data: linkRows } = await supabase
          .from('affiliate_links')
          .select('product_id')
          .in('affiliate_id', ownerAliases)
          .not('product_id', 'is', null)
          .order('created_at', { ascending: false })
          .limit(300);

        found.push(...(await hydrateProductIds(((linkRows as any[]) || []).map((row) => row?.product_id))));
      } catch (err) {
        console.warn('[SingleProductPromoStudio] affiliate link fallback load failed:', err);
      }

      if (typeof window !== 'undefined' && user?.id) {
        try {
          const raw = window.localStorage.getItem(`affiliate_products_${user.id}`);
          const localRows = raw ? JSON.parse(raw) : [];
          if (Array.isArray(localRows)) {
            const localSnapshots = localRows
              .filter((entry: any) => entry?.selected !== false)
              .map((entry: any) => normalizeProduct({ ...(entry?.product || {}), id: entry?.productId || entry?.product?.id }))
              .filter(Boolean) as PromoProduct[];
            found.push(...localSnapshots);
            found.push(...(await hydrateProductIds(localRows.map((entry: any) => entry?.productId))));
          }
        } catch {
          // ignore local storage fallback failures
        }
      }

      if (!cancelled) {
        setLoadedProducts(
          Array.from(new Map(found.map((product) => [product.id, product])).values())
        );
        setLoadingProducts(false);
      }
    };

    void loadProducts();
    return () => {
      cancelled = true;
    };
  }, [ownerId, profile?.id, (profile as any)?.user_id, user?.id]);

  useEffect(() => {
    if (!storageKey) return;
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      setSelectedProductId(saved);
    }
  }, [storageKey]);

  useEffect(() => {
    if (!storageKey || !selectedProductId) return;
    localStorage.setItem(storageKey, selectedProductId);
  }, [selectedProductId, storageKey]);

  useEffect(() => {
    const ids = new Set(effectiveProducts.map((product) => product.id));
    if (selectedProductId && ids.has(selectedProductId)) return;
    if (effectiveProducts[0]?.id) {
      setSelectedProductId(effectiveProducts[0].id);
      return;
    }
    if (selectedProductId) {
      setSelectedProductId('');
    }
  }, [effectiveProducts, selectedProductId]);

  const selectedProduct = useMemo(
    () => effectiveProducts.find((product) => product.id === selectedProductId) || effectiveProducts[0] || null,
    [effectiveProducts, selectedProductId]
  );
  const audience = useMemo(
    () => audiencePresets.find((preset) => preset.id === selectedAudience) || audiencePresets[0],
    [selectedAudience]
  );

  const directLink = useMemo(() => {
    if (!selectedProduct) return '';
    if (promoterRole === 'affiliate') {
      return generateAffiliateLink(selectedProduct.id);
    }

    const params = buildPromoterReferralParams({
      promoterRole,
      ownerId,
      productSellerId: selectedProduct.seller_id,
    });
    const query = params.toString();
    return `${window.location.origin}/product/${encodeURIComponent(selectedProduct.id)}${query ? `?${query}` : ''}`;
  }, [generateAffiliateLink, ownerId, promoterRole, selectedProduct]);

  const landingLink = useMemo(() => {
    if (!selectedProduct || !ownerId) return '';
    return `${buildPublicPromoBase(selectedProduct.id, promoterRole, ownerId, selectedProduct.seller_id)}&mode=landing`;
  }, [ownerId, promoterRole, selectedProduct]);

  const compareLink = useMemo(() => {
    if (!selectedProduct || !ownerId) return '';
    return `${buildPublicPromoBase(selectedProduct.id, promoterRole, ownerId, selectedProduct.seller_id)}&mode=compare`;
  }, [ownerId, promoterRole, selectedProduct]);

  const audienceLinks = useMemo(() => {
    if (!selectedProduct || !ownerId) return [];
    return audiencePresets.map((preset) => ({
      ...preset,
      url: `${buildPublicPromoBase(selectedProduct.id, promoterRole, ownerId, selectedProduct.seller_id)}&mode=landing&audience=${encodeURIComponent(preset.id)}`,
    }));
  }, [ownerId, promoterRole, selectedProduct]);

  const qrImageUrl = useMemo(() => {
    const target = landingLink || directLink;
    if (!target) return '';
    return `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(target)}`;
  }, [directLink, landingLink]);

  const socialCaptions = useMemo(() => {
    if (!selectedProduct) return [];
    return [
      {
        id: 'quick',
        label: 'Quick share',
        text: `${selectedProduct.title} is the single item I would share first tonight. ${landingLink}`,
      },
      {
        id: 'benefit',
        label: 'Benefit-led',
        text: `${audience.caption} ${landingLink}`,
      },
      {
        id: 'trust',
        label: 'Trust-led',
        text: `If you do not want to scroll a whole store, this page opens one item with the details and price all in one place. ${landingLink}`,
      },
    ];
  }, [audience.caption, landingLink, selectedProduct]);

  const outreach = useMemo(() => {
    if (!selectedProduct) return { subject: '', emailBody: '', smsBody: '' };
    const subject = `${selectedProduct.title} - one item worth opening`;
    const emailBody = `${audience.headline}\n\n${audience.caption}\n\nOpen the item here:\n${landingLink}`;
    const smsBody = `${selectedProduct.title}: ${audience.caption} ${landingLink}`;
    return { subject, emailBody, smsBody };
  }, [audience.caption, audience.headline, landingLink, selectedProduct]);

  const embedCode = useMemo(() => {
    if (!selectedProduct) return '';
    const iframeUrl = `${landingLink}&embed=1`;
    return `<iframe src="${iframeUrl}" title="${escapeHtml(selectedProduct.title)}" width="100%" height="920" style="border:0;border-radius:24px;overflow:hidden;" loading="lazy"></iframe>`;
  }, [landingLink, selectedProduct]);

  const compactEmbedCode = useMemo(() => {
    if (!selectedProduct) return '';
    return `<a href="${landingLink}" style="display:block;max-width:360px;padding:18px;border:1px solid #e5e7eb;border-radius:18px;text-decoration:none;color:#111827;font-family:Arial,sans-serif;background:#ffffff;">
  <div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#92400e;font-weight:700;">Product pick</div>
  <div style="margin-top:8px;font-size:20px;font-weight:800;">${escapeHtml(selectedProduct.title)}</div>
  <div style="margin-top:8px;color:#475569;">Open the full product page, details, and checkout path.</div>
  <div style="margin-top:14px;font-size:18px;font-weight:700;">$${getPromoDisplayPrice(selectedProduct).toFixed(2)}</div>
</a>`;
  }, [landingLink, selectedProduct]);

  const promoCode = useMemo(() => {
    if (!selectedProduct || !ownerId) return '';
    return `${slugifyPromoValue(selectedProduct.title).slice(0, 12).toUpperCase()}-${ownerId.slice(0, 6).toUpperCase()}`;
  }, [ownerId, selectedProduct]);

  const handleCopy = async (key: string, value: string) => {
    const ok = await copyTextToClipboard(value);
    if (!ok) return;
    setCopiedKey(key);
    window.setTimeout(() => {
      setCopiedKey((current) => (current === key ? '' : current));
    }, 1400);
  };

  const launchEmail = () => {
    if (!outreach.subject) return;
    window.location.href = `mailto:?subject=${encodeURIComponent(outreach.subject)}&body=${encodeURIComponent(outreach.emailBody)}`;
  };

  const launchSms = () => {
    if (!outreach.smsBody) return;
    window.location.href = `sms:?&body=${encodeURIComponent(outreach.smsBody)}`;
  };

  const downloadAsset = (presetId: string) => {
    if (!selectedProduct) return;
    const preset = promoAssetPresets.find((item) => item.id === presetId);
    if (!preset) return;
    const svg = buildPosterSvg(selectedProduct, landingLink, preset, audience, promoterLabel, promoterName);
    downloadTextFile(`${slugifyPromoValue(selectedProduct.title) || 'product'}-${preset.id}.svg`, svg, 'image/svg+xml;charset=utf-8');
  };

  if (!ownerId) return null;

  return (
    <section className={props.className || ''}>
      <div className={sectionCard}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-800">
              <Sparkles className="h-3.5 w-3.5" />
              Private Product Link Studio
            </div>
            <h3 className="mt-3 text-xl font-semibold text-gray-900">{props.title || 'Promote one item in every useful format'}</h3>
            <p className="mt-1 text-sm text-gray-600">
              Build and manage private product-share assets here. The public page stays product-first, while this dashboard panel keeps your links, QR assets, drafts, and internal copy tools in one place.
            </p>
          </div>
          <div className="min-w-[280px] rounded-2xl border border-gray-200 bg-gray-50 p-4">
            <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Featured product</label>
            <div className="relative mt-2">
              <button
                type="button"
                onClick={() => setProductMenuOpen((open) => !open)}
                disabled={effectiveProducts.length === 0}
                className="flex w-full items-center justify-between gap-3 rounded-xl border border-gray-300 bg-white px-3 py-2 text-left text-sm text-gray-900 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {selectedProduct ? (
                  <span className="flex min-w-0 items-center gap-3">
                    <img
                      src={selectedProduct.image_url || '/api/placeholder/120/120'}
                      alt=""
                      className="h-12 w-12 shrink-0 rounded-lg border border-gray-200 bg-white object-cover"
                    />
                    <span className="min-w-0 truncate font-semibold">{selectedProduct.title}</span>
                  </span>
                ) : (
                  <span className="text-gray-500">
                    {loadingProducts ? 'Loading your products...' : 'No products available'}
                  </span>
                )}
                <ChevronDown className={`h-4 w-4 shrink-0 text-gray-500 transition ${productMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {productMenuOpen && effectiveProducts.length > 0 && (
                <div className="absolute left-0 right-0 top-full z-30 mt-2 max-h-80 overflow-y-auto rounded-xl border border-gray-200 bg-white p-1 shadow-xl">
                  {effectiveProducts.map((product) => (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => {
                        setSelectedProductId(product.id);
                        setProductMenuOpen(false);
                      }}
                      className={`flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm transition ${
                        product.id === selectedProduct?.id ? 'bg-amber-50 text-gray-950' : 'text-gray-800 hover:bg-gray-50'
                      }`}
                    >
                      <img
                        src={product.image_url || '/api/placeholder/120/120'}
                        alt=""
                        className="h-11 w-11 shrink-0 rounded-lg border border-gray-200 bg-white object-cover"
                      />
                      <span className="min-w-0 truncate font-medium">{product.title}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {!loadingProducts && effectiveProducts.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-amber-700">
              <PackagePlus className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-base font-semibold text-gray-900">Add a real product to build a single-item promotion.</h4>
              <p className="mt-1 text-sm leading-6 text-gray-700">
                This page only promotes live seller products or products added to an affiliate store. Once a product is available, the selector, links, QR code, posters, copy, and landing page tools will fill in from that product.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {promoterRole === 'seller' ? (
                  <a href="/dashboard?tab=products" className="rounded-lg bg-gray-900 px-3 py-2 text-sm font-semibold text-white hover:bg-gray-800">
                    Add seller product
                  </a>
                ) : (
                  <a href="/dashboard?tab=products" className="rounded-lg bg-gray-900 px-3 py-2 text-sm font-semibold text-white hover:bg-gray-800">
                    Add affiliate product
                  </a>
                )}
                <a href="/marketplace" className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50">
                  Browse marketplace
                </a>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {selectedProduct && (
        <>
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="text-sm font-semibold text-emerald-900">Quick-share tools</div>
                <div className="mt-1 text-sm text-emerald-800">
                  Use these private controls to copy the real public product page and send it out fast.
                </div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => void handleCopy('landing-fast', landingLink)}
                  className="rounded-lg bg-white px-4 py-3 text-sm font-semibold text-emerald-900 hover:bg-emerald-100"
                >
                  {copiedKey === 'landing-fast' ? 'Landing page copied' : 'Copy landing page'}
                </button>
                <button
                  type="button"
                  onClick={launchSms}
                  className="rounded-lg bg-green-600 px-4 py-3 text-sm font-semibold text-white hover:bg-green-500"
                >
                  Text this product
                </button>
                <button
                  type="button"
                  onClick={launchEmail}
                  className="rounded-lg bg-gray-900 px-4 py-3 text-sm font-semibold text-white hover:bg-gray-800"
                >
                  Email this product
                </button>
              </div>
            </div>
            <div className="mt-3 break-all rounded-xl bg-white px-3 py-3 text-xs text-gray-600">
              {landingLink}
            </div>
          </div>

          <details className="mt-4 rounded-2xl border border-gray-200 bg-white shadow-sm">
            <summary className="cursor-pointer list-none px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-gray-900">Private builder tools</div>
                  <div className="mt-1 text-xs text-gray-500">Open for QR assets, saved copy, embeds, internal drafts, and more.</div>
                </div>
                <div className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
                  More tools
                </div>
              </div>
            </summary>
            <div className="border-t border-gray-200 px-4 py-4">
              <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
                {promoMethodCards.map((card) => (
                  <div key={card.label} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                    <div className="text-sm font-semibold text-gray-900">{card.label}</div>
                    <p className="mt-2 text-xs leading-5 text-gray-600">{card.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </details>

        <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
          <div className={sectionCard}>
            <div className="flex items-center gap-2 text-gray-900">
              <ExternalLink className="h-4 w-4 text-orange-600" />
              <h4 className="font-semibold">Public links and page variants</h4>
            </div>
            <div className="mt-4 space-y-3">
              {[
                { key: 'direct', label: 'Direct item link', url: directLink },
                { key: 'landing', label: 'Focused landing page', url: landingLink },
                { key: 'compare', label: 'Comparison page', url: compareLink },
              ].map((link) => (
                <div key={link.key} className="rounded-xl border border-gray-200 p-3">
                  <div className="text-sm font-semibold text-gray-900">{link.label}</div>
                  <div className="mt-1 break-all text-xs text-gray-500">{link.url}</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void handleCopy(link.key, link.url)}
                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
                    >
                      {copiedKey === link.key ? 'Copied' : 'Copy'}
                    </button>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg bg-gray-900 px-3 py-2 text-sm font-semibold text-white hover:bg-gray-800"
                    >
                      Open
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className={sectionCard}>
            <div className="flex items-center gap-2 text-gray-900">
              <MonitorSmartphone className="h-4 w-4 text-sky-600" />
              <h4 className="font-semibold">Alternate public page variants</h4>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {audiencePresets.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setSelectedAudience(preset.id)}
                  className={`rounded-full px-3 py-2 text-sm font-semibold ${
                    audience.id === preset.id ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">{audience.angle}</div>
              <div className="mt-1 text-lg font-semibold text-gray-900">{audience.headline}</div>
              <div className="mt-2 text-sm text-gray-600">{audience.caption}</div>
            </div>
            <div className="mt-4 space-y-3">
              {audienceLinks.map((link) => (
                <div key={link.id} className="rounded-xl border border-gray-200 p-3">
                  <div className="text-sm font-semibold text-gray-900">{link.label}</div>
                  <div className="mt-1 break-all text-xs text-gray-500">{link.url}</div>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => void handleCopy(`audience-${link.id}`, link.url)}
                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
                    >
                      {copiedKey === `audience-${link.id}` ? 'Copied' : 'Copy link'}
                    </button>
                    <a href={link.url} target="_blank" rel="noreferrer" className="rounded-lg bg-amber-500 px-3 py-2 text-sm font-semibold text-black hover:bg-amber-400">
                      Open
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className={sectionCard}>
            <div className="flex items-center gap-2 text-gray-900">
              <MessageSquare className="h-4 w-4 text-emerald-600" />
              <h4 className="font-semibold">Private message drafts</h4>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={launchEmail} className="rounded-lg bg-gray-900 px-3 py-2 text-sm font-semibold text-white hover:bg-gray-800">
                <Mail className="mr-2 inline h-4 w-4" />
                Email item
              </button>
              <button type="button" onClick={launchSms} className="rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-500">
                <MessageSquare className="mr-2 inline h-4 w-4" />
                Text item
              </button>
              <button
                type="button"
                onClick={() => openPopup(`https://twitter.com/intent/tweet?text=${encodeURIComponent(socialCaptions[0]?.text || '')}`)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
              >
                Open X post
              </button>
              <button
                type="button"
                onClick={() => openPopup(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(landingLink)}&quote=${encodeURIComponent(socialCaptions[1]?.text || '')}`)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
              >
                Open Facebook post
              </button>
            </div>
            <div className="mt-4 space-y-3">
              {socialCaptions.map((item) => (
                <div key={item.id} className="rounded-xl border border-gray-200 p-3">
                  <div className="text-sm font-semibold text-gray-900">{item.label}</div>
                  <div className="mt-2 text-sm text-gray-700">{item.text}</div>
                  <button
                    type="button"
                    onClick={() => void handleCopy(`caption-${item.id}`, item.text)}
                    className="mt-3 rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
                  >
                    {copiedKey === `caption-${item.id}` ? 'Copied' : 'Copy draft'}
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className={sectionCard}>
            <div className="flex items-center gap-2 text-gray-900">
              <QrCode className="h-4 w-4 text-violet-600" />
              <h4 className="font-semibold">QR and campaign label</h4>
            </div>
            <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="rounded-2xl border border-gray-200 bg-white p-3">
                <img src={qrImageUrl} alt="Product QR code" className="h-44 w-44 rounded-xl" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold text-gray-900">QR campaign target</div>
                <div className="mt-1 break-all text-xs text-gray-500">{landingLink}</div>
                <div className="mt-4 text-sm font-semibold text-gray-900">Campaign code</div>
                <div className="mt-1 rounded-xl bg-gray-100 px-3 py-2 font-mono text-sm text-gray-900">{promoCode}</div>
                <div className="mt-2 text-xs text-gray-500">
                  This is an internal campaign label you can use to organize a single-item push across your own assets.
                </div>
                <button
                  type="button"
                  onClick={() => void handleCopy('promo-code', promoCode)}
                  className="mt-3 rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
                >
                  {copiedKey === 'promo-code' ? 'Copied' : 'Copy campaign code'}
                </button>
              </div>
            </div>
          </div>

          <div className={sectionCard}>
            <div className="flex items-center gap-2 text-gray-900">
              <Ticket className="h-4 w-4 text-amber-600" />
              <h4 className="font-semibold">Private poster assets</h4>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {promoAssetPresets.map((preset) => (
                <div key={preset.id} className="rounded-xl border border-gray-200 p-4">
                  <div className="text-sm font-semibold text-gray-900">{preset.label}</div>
                  <div className="mt-1 text-xs text-gray-500">
                    {preset.width} x {preset.height} SVG
                  </div>
                  <button
                    type="button"
                    onClick={() => downloadAsset(preset.id)}
                    className="mt-4 rounded-lg bg-amber-500 px-3 py-2 text-sm font-semibold text-black hover:bg-amber-400"
                  >
                    Download poster
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className={sectionCard}>
            <div className="flex items-center gap-2 text-gray-900">
              <Video className="h-4 w-4 text-rose-600" />
              <h4 className="font-semibold">Private video notes</h4>
            </div>
            <div className="mt-4 space-y-3">
              {videoScriptPresets.map((script) => (
                <div key={script.id} className="rounded-xl border border-gray-200 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                    <PlayCircle className="h-4 w-4 text-rose-500" />
                    {script.label}
                  </div>
                  <pre className="mt-3 whitespace-pre-wrap text-sm text-gray-700">{script.text}</pre>
                  <button
                    type="button"
                    onClick={() => void handleCopy(`script-${script.id}`, script.text)}
                    className="mt-3 rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
                  >
                    {copiedKey === `script-${script.id}` ? 'Copied' : 'Copy notes'}
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className={sectionCard}>
            <div className="flex items-center gap-2 text-gray-900">
              <Copy className="h-4 w-4 text-slate-700" />
              <h4 className="font-semibold">Embed and placement code</h4>
            </div>
            <div className="mt-4 space-y-4">
              <div className="rounded-xl border border-gray-200 p-4">
                <div className="text-sm font-semibold text-gray-900">Full landing embed</div>
                <textarea readOnly value={embedCode} className="mt-2 h-28 w-full rounded-xl border border-gray-300 bg-gray-50 p-3 text-xs text-gray-700" />
                <button
                  type="button"
                  onClick={() => void handleCopy('embed-full', embedCode)}
                  className="mt-3 rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
                >
                  {copiedKey === 'embed-full' ? 'Copied' : 'Copy iframe code'}
                </button>
              </div>
              <div className="rounded-xl border border-gray-200 p-4">
                <div className="text-sm font-semibold text-gray-900">Compact product card embed</div>
                <textarea readOnly value={compactEmbedCode} className="mt-2 h-32 w-full rounded-xl border border-gray-300 bg-gray-50 p-3 text-xs text-gray-700" />
                <button
                  type="button"
                  onClick={() => void handleCopy('embed-compact', compactEmbedCode)}
                  className="mt-3 rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
                >
                  {copiedKey === 'embed-compact' ? 'Copied' : 'Copy card code'}
                </button>
              </div>
            </div>
          </div>
        </div>
        </>
      )}

    </section>
  );
}
