import React, { useMemo, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Check, Star, ShoppingCart } from 'lucide-react';
import { useCart } from '../contexts/CartContext';
import { useAffiliate } from '../contexts/AffiliateContext';
import { SocialShareButton } from '../components/SocialShareButton';
import {
  fetchProductById,
  getVariantOptions,
  resolveVariant,
  ProductVariant,
  enrichCjProductImagesIfNeeded,
} from '../services/productService';
import type { MarketplaceProduct } from '../services/productService';
import { DEFAULT_AFFILIATE_RATE, normalizeAffiliateRate } from '../utils/pricing';
import { getBuyerFacingProductPrice } from '../utils/buyerPrice';

const ProductDetailPageSimple: React.FC = () => {
  const { productId } = useParams<{ productId: string }>();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { trackClick } = useAffiliate();
  const [product, setProduct] = useState<MarketplaceProduct | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [brokenImageIndexes, setBrokenImageIndexes] = useState<Record<number, true>>({});
  const [variantOptions, setVariantOptions] = useState<ProductVariant[]>([]);
  const [selectedAttributes, setSelectedAttributes] = useState<Record<string, string>>({});
  const [selectedVariantId, setSelectedVariantId] = useState<string>('');
  const [variantSelectionError, setVariantSelectionError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);

  const withTimeout = async <T,>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> => {
    let timeoutHandle: number | undefined;
    const timeoutPromise = new Promise<T>((_, reject) => {
      timeoutHandle = window.setTimeout(() => {
        reject(new Error(`${label} timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      if (timeoutHandle) window.clearTimeout(timeoutHandle);
    }
  };

  // --- Affiliate tools state ---
  const [showAffiliateTools, setShowAffiliateTools] = useState(false);
  const [affiliateProductLink, setAffiliateProductLink] = useState<string>("");
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");

  // Generate affiliate product link and QR code
  React.useEffect(() => {
    if (product && product.id) {
      const baseUrl = window.location.origin;
      const affiliateCode = searchParams.get('ref') || localStorage.getItem('affiliate_ref') || '';
      const link = `${baseUrl}/product/${product.id}${affiliateCode ? `?ref=${affiliateCode}` : ''}`;
      setAffiliateProductLink(link);
      setQrCodeUrl(`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(link)}`);
    }
  }, [product, searchParams]);

  const handleStartSelling = () => {
    setShowAffiliateTools(true);
    // TODO: Add backend logic to actually import product for affiliate
  };

  const attributeKeys = React.useMemo(() => {
    const keys = new Set<string>();
    variantOptions.forEach((variant) => {
      Object.keys(variant.attributes ?? {}).forEach((attrKey) => {
        if (attrKey) keys.add(attrKey);
      });
    });
    return Array.from(keys);
  }, [variantOptions]);

  const isPlaceholderAttributeKey = (key: string) => {
    const normalized = String(key || '').trim().toLowerCase();
    if (!normalized) return true;
    if (normalized === 'variant') return true;
    return /^(option|variant option)\s*\d+$/.test(normalized);
  };

  const meaningfulAttributeKeys = React.useMemo(
    () => attributeKeys.filter((key) => !isPlaceholderAttributeKey(key)),
    [attributeKeys]
  );

  const useAttributeSelectors = meaningfulAttributeKeys.length > 0;

  const attributeOptions = React.useMemo(() => {
    const options: Record<string, string[]> = {};
    variantOptions.forEach((variant) => {
      Object.entries(variant.attributes ?? {}).forEach(([attrKey, attrValue]) => {
        if (!attrKey || !attrValue) return;
        const current = options[attrKey] || [];
        if (!current.includes(attrValue)) {
          current.push(attrValue);
        }
        options[attrKey] = current;
      });
    });
    return options;
  }, [variantOptions]);

  React.useEffect(() => {
    if (variantOptions.length !== 1) {
      setSelectedAttributes({});
      setSelectedVariantId('');
      return;
    }

    // Safe default: if there's only one variant, auto-select it.
    const only = variantOptions[0];
    setSelectedAttributes((only?.attributes ?? {}) as Record<string, string>);
  }, [variantOptions]);

  const formatVariantLabel = (variant: ProductVariant): string => {
    const attrs = (variant.attributes ?? null) as Record<string, string> | null;
    if (attrs && Object.keys(attrs).length > 0) {
      const joined = Object.values(attrs).filter(Boolean).join(' / ');
      if (joined) return joined;
    }
    return (variant as any)?.variantNameEn || variant.sku || variant.cj_variant_id || String(variant.id);
  };

  const sellerAsk = useMemo(
    () => (product ? (product as any).seller_ask ?? (product as any).seller_amount ?? 0 : 0),
    [product]
  );

  const affiliateRateDecimal = useMemo(() => {
    if (product?.commission_type === 'flat_rate') return 0;
    return normalizeAffiliateRate(product?.commission_rate ?? DEFAULT_AFFILIATE_RATE);
  }, [product?.commission_rate, product?.commission_type]);

  const salePrice = useMemo(() => {
    if (!product) return 0;
    return getBuyerFacingProductPrice(product as any);
  }, [product]);

  const selectedVariant = React.useMemo(() => {
    if (!variantOptions.length) return null;
    if (variantOptions.length === 1) return variantOptions[0];

    if (!useAttributeSelectors) {
      if (!selectedVariantId) return null;
      return variantOptions.find((variant) => String(variant.id) === String(selectedVariantId)) ?? null;
    }

    const hasCompleteSelection = meaningfulAttributeKeys.every((key) => Boolean(selectedAttributes[key]));
    if (!hasCompleteSelection) return null;
    return resolveVariant(variantOptions, selectedAttributes);
  }, [variantOptions, selectedAttributes, meaningfulAttributeKeys, selectedVariantId, useAttributeSelectors]);

  const finalDisplayPrice = salePrice;

  const shippingPrice = useMemo(
    () => (product as any)?.shipping_price ?? product?.shipping_cost ?? 0,
    [product]
  );

  const imageGallery = useMemo(() => {
    const images: string[] = [];
    const seen = new Set<string>();

    const isLikelyUrl = (value: string) =>
      value.startsWith('http://') || value.startsWith('https://') || value.startsWith('/') || value.startsWith('data:');

    const addImage = (candidate: unknown, options?: { front?: boolean }) => {
      const normalized = String(candidate ?? '').trim();
      if (!normalized) return;
      if (!isLikelyUrl(normalized)) return;
      if (seen.has(normalized)) return;
      seen.add(normalized);
      if (options?.front) images.unshift(normalized);
      else images.push(normalized);
    };

    const productImages = (product as any)?.images;

    if (Array.isArray(productImages)) {
      productImages.forEach((img) => addImage(img));
    }

    // Variant image is the only one we force to the front (so selecting a variant immediately updates the hero image).
    if (selectedVariant?.image_url) {
      addImage(selectedVariant.image_url, { front: true });
    }

    // `product.image` is sometimes a legacy/bad primary for CJ (while `product.images[0]` is valid),
    // so include it but don't force it to the front unless it's the only image available.
    const legacyPrimary = (product as any)?.image;
    if (legacyPrimary && images.length === 0) addImage(legacyPrimary, { front: true });
    else addImage(legacyPrimary);

    if (images.length === 0) {
      images.push('/api/placeholder/600/600');
    }

    return images.slice(0, 10);
  }, [product, selectedVariant?.image_url]);

  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: (product as any)?.currency || 'USD',
      }),
    [product]
  );
  const formatMoney = (value: number) => currencyFormatter.format(value);

  const backTarget = useMemo(() => {
    const from = (location.state as any)?.from;
    if (typeof from === 'string' && from.trim().length > 0) return from;
    try {
      const last = sessionStorage.getItem('beezio:lastMarketplaceUrl');
      if (last && last.trim().length > 0) return last;
    } catch {
      // ignore
    }
    return '/marketplace';
  }, [location.state]);

  const handleBack = () => {
    const current = `${location.pathname}${location.search}`;
    const safeTarget = backTarget && backTarget !== current ? backTarget : '/marketplace';
    navigate(safeTarget);
  };

  // Handle affiliate tracking
  useEffect(() => {
    const affiliateId = searchParams.get('ref');
    if (affiliateId && productId) {
      localStorage.setItem('affiliate_ref', affiliateId);
      trackClick(productId, affiliateId);
    }
  }, [searchParams, productId, trackClick]);

  useEffect(() => {
    const loadProduct = async () => {
      setLoading(true);
      setError(null);

      if (!productId) {
        setProduct(null);
        setLoading(false);
        return;
      }

      try {
        const realProduct = await withTimeout(fetchProductById(productId), 12000, 'fetchProductById');
        if (realProduct) {
          setProduct(realProduct);

          // Add-only CJ image enrichment: best-effort and non-blocking.
          // Never blocks checkout/cart/etc and only runs when there are <2 images.
          void (async () => {
            const updatedImages = await withTimeout(
              enrichCjProductImagesIfNeeded({
                productId: realProduct.id,
                existingImages: (realProduct as any)?.images,
                fallbackSingleImage: (realProduct as any)?.image,
              }),
              12000,
              'enrichCjProductImagesIfNeeded'
            );

            if (updatedImages?.length) {
              setProduct((prev) => (prev ? ({ ...(prev as any), images: updatedImages } as any) : prev));
            }
          })();
        } else {
          setProduct(null);
          setError('We couldn’t find that product. Double-check the link or add it to your catalog.');
        }
      } catch (err) {
        console.error('ProductDetailPageSimple: failed to load Supabase product', err);
        setProduct(null);
        setError(err instanceof Error ? err.message : 'Unable to load product details from Supabase.');
      } finally {
        setLoading(false);
      }
    };

    loadProduct();
  }, [productId, loadAttempt]);

  // Absolute guardrail: never spin forever if Supabase hangs.
  useEffect(() => {
    if (!loading) return;
    const timer = window.setTimeout(() => {
      setError('Product is taking too long to load. Please try again.');
      setLoading(false);
    }, 15000);
    return () => window.clearTimeout(timer);
  }, [loading]);

  useEffect(() => {
    let aborted = false;
    if (!product?.id) {
      setVariantOptions([]);
      setSelectedAttributes({});
      return;
    }

    const loadVariants = async () => {
      try {
        const variants = await withTimeout(getVariantOptions(product.id), 12000, 'getVariantOptions');
        if (!aborted) {
          setVariantOptions(variants);
        }
      } catch (err) {
        console.error('Failed to load variant data:', err);
        if (!aborted) {
          setVariantOptions([]);
        }
      }
    };

    loadVariants();

    return () => {
      aborted = true;
    };
  }, [product?.id]);

  useEffect(() => {
    setActiveImageIndex(0);
    setBrokenImageIndexes({});
  }, [productId]);

  useEffect(() => {
    if (selectedVariant?.image_url) {
      setActiveImageIndex(0);
      setBrokenImageIndexes({});
    }
  }, [selectedVariant?.image_url]);

  const handleMainImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const placeholder = '/api/placeholder/600/600';

    setBrokenImageIndexes((prev) => {
      const nextBroken: Record<number, true> = { ...prev, [activeImageIndex]: true };

      const findNextIndex = () => {
        for (let idx = activeImageIndex + 1; idx < imageGallery.length; idx += 1) {
          if (!nextBroken[idx]) return idx;
        }
        for (let idx = 0; idx < activeImageIndex; idx += 1) {
          if (!nextBroken[idx]) return idx;
        }
        return -1;
      };

      const nextIndex = findNextIndex();
      if (nextIndex !== -1 && nextIndex !== activeImageIndex) {
        setActiveImageIndex(nextIndex);
      } else {
        e.currentTarget.src = placeholder;
      }

      return nextBroken;
    });
  };

  const handleAttributeChange = (key: string, value: string) => {
    setVariantSelectionError(null);
    setSelectedAttributes((prev) => ({ ...prev, [key]: value }));
  };

  const handleVariantSelect = (variantId: string) => {
    setVariantSelectionError(null);
    setSelectedVariantId(variantId);
    const picked = variantOptions.find((variant) => String(variant.id) === String(variantId));
    setSelectedAttributes(((picked?.attributes ?? {}) as Record<string, string>) || {});
  };

  const optionChipClassName = (selected: boolean) =>
    [
      'relative inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
      'focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2',
      selected
        ? 'border-orange-600 bg-orange-50 text-orange-700'
        : 'border-gray-300 bg-white text-gray-800 hover:border-gray-400 hover:bg-gray-50',
    ].join(' ');

  const handleAddToCart = () => {
    if (product) {
      if (variantOptions.length > 1 && !selectedVariant) {
        setVariantSelectionError('Please choose options (size/color/etc) before adding to cart.');
        return;
      }

      const currentVariant = selectedVariant;
      const variantAttributes = currentVariant?.attributes;
      const variantLabel =
        currentVariant?.variantNameEn || (variantAttributes ? Object.values(variantAttributes).join(' / ') : '');
      const variantId = currentVariant?.id ?? currentVariant?.cj_variant_id;
      if (variantOptions.length > 0 && !variantId) {
        setVariantSelectionError('This product requires a variant selection.');
        return;
      }

      const computedMaxQuantity = (() => {
        const variantStock = (currentVariant as any)?.inventory;
        if (Number.isFinite(variantStock)) return Math.max(0, Math.floor(variantStock as number));
        const productStock = (product as any)?.stock_quantity;
        if (Number.isFinite(productStock)) return Math.max(0, Math.floor(productStock));
        return 99;
      })();

      if (computedMaxQuantity <= 0) {
        setVariantSelectionError(currentVariant ? 'This variant is out of stock.' : 'This product is out of stock.');
        return;
      }

      const variantImage = currentVariant?.image_url || product.image;
      addToCart({
        productId: product.id,
        title: product.name,
        price: finalDisplayPrice,
        sellerAsk,
        currency: (product as any)?.currency || 'USD',
        affiliateRate: affiliateRateDecimal,
        quantity: quantity,
        image: variantImage,
        sellerId: product.sellerId || product.seller || 'unknown-seller',
        sellerName: product.seller,
        commission_rate: product.commission_rate || 25,
        commission_type: product.commission_type,
        flat_commission_amount: product.flat_commission_amount,
        shippingCost: shippingPrice,
        maxQuantity: computedMaxQuantity,
        variantId,
        variantName: variantLabel,
        variantAttributes: variantAttributes ?? undefined,
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading product...</p>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🛒</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Product Not Found</h2>
          <p className="text-gray-600 mb-6">{error || "The product you're looking for doesn't exist."}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              type="button"
              onClick={() => setLoadAttempt((n) => n + 1)}
              className="inline-flex items-center justify-center bg-white border border-gray-300 text-gray-900 px-6 py-3 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Retry
            </button>
            <Link
              to="/marketplace"
              className="inline-flex items-center justify-center bg-orange-600 text-white px-6 py-3 rounded-lg hover:bg-orange-700 transition-colors"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Marketplace
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const displayImage =
    imageGallery[activeImageIndex] ||
    '/api/placeholder/600/600';

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-orange-50 to-yellow-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex items-center justify-between gap-4 mb-8">
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex items-center text-gray-600 hover:text-orange-600 font-medium transition-colors group"
          >
            <ArrowLeft className="w-5 h-5 mr-2 group-hover:-translate-x-1 transition-transform" />
            Back
          </button>
        </div>

        <div className="grid lg:grid-cols-12 gap-10 items-start">
          {/* Left: image + meta */}
          <div className="lg:col-span-6 space-y-6">
            <div className="relative bg-gradient-to-br from-yellow-100 via-orange-100 to-purple-100 rounded-3xl aspect-square flex items-center justify-center shadow-lg overflow-hidden">
              <img
                src={displayImage}
                alt={product.name}
                className="w-full h-full object-cover"
                onError={handleMainImageError}
              />
              <div className="absolute -bottom-8 -right-8 w-32 h-32 bg-orange-200 rounded-full blur-2xl opacity-40 pointer-events-none" />
            </div>

            {imageGallery.length > 1 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                {imageGallery.map((img, idx) => (
                  <button
                    key={`${img}-${idx}`}
                    onClick={() => setActiveImageIndex(idx)}
                    className={`relative rounded-xl overflow-hidden border-2 transition-all ${idx === activeImageIndex ? 'border-orange-500 ring-2 ring-orange-100' : 'border-transparent hover:border-orange-200'}`}
                    aria-label={`View image ${idx + 1}`}
                  >
                    <img
                      src={img}
                      alt={`${product.name} ${idx + 1}`}
                      className="w-full h-20 object-cover"
                      onError={(e) => {
                        e.currentTarget.src = '/api/placeholder/200/200';
                      }}
                    />
                  </button>
                ))}
              </div>
            )}

            <div className="space-y-3">
              <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 leading-tight">
                {product.name}
              </h1>
              <p className="text-gray-700 text-lg leading-relaxed">
                {product.description}
              </p>
              <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                <span className="inline-flex items-center gap-1">
                  <Star className="w-4 h-4 text-yellow-400 fill-current" />
                  <span className="font-semibold text-gray-800">{product.rating}</span>
                  <span className="text-gray-500">({product.reviews} reviews)</span>
                </span>
                <span className="text-gray-400">•</span>
                <span>Sold by <span className="font-semibold text-gray-900">{product.seller}</span></span>
                <span className="text-gray-400">•</span>
                <span>Category: <span className="font-semibold text-gray-900">{product.category}</span></span>
              </div>
            </div>
          </div>

          {/* Right: pricing + actions */}
          <div className="lg:col-span-6">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-xl p-6 md:p-8 space-y-6 sticky top-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-baseline gap-3">
                    <span className="text-5xl font-extrabold text-gray-900">{formatMoney(finalDisplayPrice)}</span>
                    {product.is_subscription && product.subscription_interval && (
                      <span className="text-lg text-gray-500">/ {product.subscription_interval}</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    Taxes and shipping are calculated at checkout. No extra payout or commission details are shown to buyers.
                  </p>
                </div>
              </div>

              {variantOptions.length > 0 && (
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-4">
                  <p className="text-sm font-semibold text-gray-800">Select Options</p>

                  {useAttributeSelectors ? (
                    <div className="grid gap-3 md:grid-cols-2">
                      {meaningfulAttributeKeys.map((key) => (
                        <div key={key}>
                          <label className="text-xs font-semibold text-gray-600 block mb-1">{key}</label>
                          <div role="radiogroup" aria-label={key} className="flex flex-wrap gap-2">
                            {(attributeOptions[key] || []).map((value) => {
                              const selected = (selectedAttributes[key] ?? '') === value;
                              return (
                                <button
                                  key={value}
                                  type="button"
                                  className={optionChipClassName(selected)}
                                  aria-pressed={selected}
                                  onClick={() => handleAttributeChange(key, value)}
                                >
                                  {selected && <Check className="w-4 h-4" />}
                                  <span className="break-words">{value}</span>
                                </button>
                              );
                            })}
                          </div>
                          <select
                            value={selectedAttributes[key] ?? ''}
                            onChange={(e) => handleAttributeChange(key, e.target.value)}
                            className="hidden"
                            aria-hidden="true"
                            tabIndex={-1}
                          >
                            <option value="">Select {key}…</option>
                            {(attributeOptions[key] || []).map((value) => (
                              <option key={value} value={value}>
                                {value}
                              </option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div>
                      <label className="text-xs font-semibold text-gray-600 block mb-1">Choose from</label>
                      <div role="radiogroup" aria-label="Variant options" className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {variantOptions.map((variant) => {
                          const id = String(variant.id);
                          const selected = id === String(selectedVariantId);
                          return (
                            <button
                              key={id}
                              type="button"
                              className={optionChipClassName(selected)}
                              aria-pressed={selected}
                              onClick={() => handleVariantSelect(id)}
                            >
                              {selected && <Check className="w-4 h-4" />}
                              <span className="text-left">{formatVariantLabel(variant)}</span>
                            </button>
                          );
                        })}
                      </div>
                      <select
                        value={selectedVariantId}
                        onChange={(e) => handleVariantSelect(e.target.value)}
                        className="hidden"
                        aria-hidden="true"
                        tabIndex={-1}
                      >
                        <option value="">Select an option…</option>
                        {variantOptions.map((variant) => (
                          <option key={String(variant.id)} value={String(variant.id)}>
                            {formatVariantLabel(variant)}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {selectedVariant && (
                    <p className="text-xs text-gray-500">
                      Selected: <span className="font-medium text-gray-700">{formatVariantLabel(selectedVariant)}</span>
                    </p>
                  )}
                </div>
              )}

              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-700">Quantity</span>
                <div className="flex items-center border rounded-lg overflow-hidden shadow-sm">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="px-3 py-2 text-gray-700 hover:bg-gray-100"
                    aria-label="Decrease quantity"
                  >
                    −
                  </button>
                  <span className="px-4 py-2 text-gray-900 font-semibold min-w-[40px] text-center">{quantity}</span>
                  <button
                    onClick={() => setQuantity(quantity + 1)}
                    className="px-3 py-2 text-gray-700 hover:bg-gray-100"
                    aria-label="Increase quantity"
                  >
                    +
                  </button>
                </div>
              </div>

              <button
                onClick={handleAddToCart}
                className="w-full inline-flex items-center justify-center bg-orange-600 text-white px-6 py-3 rounded-lg hover:bg-orange-700 transition-colors font-semibold shadow-lg"
              >
                <ShoppingCart className="w-5 h-5 mr-2" />
                Add to Cart
              </button>
              {variantSelectionError && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {variantSelectionError}
                </div>
              )}

              {/* Start Selling Button for Affiliates */}
              <button
                onClick={handleStartSelling}
                className="w-full inline-flex items-center justify-center bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors font-semibold shadow-lg mt-4"
              >
                Start Selling (Import to My Store)
              </button>

              {/* Affiliate Tools: QR code, custom link, social share */}
              {showAffiliateTools && (
                <div className="mt-6 border-t pt-4 space-y-4">
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">Your Affiliate Product Link:</p>
                    <input type="text" value={affiliateProductLink} readOnly className="w-full px-3 py-2 border rounded" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">QR Code:</p>
                    <img src={qrCodeUrl} alt="QR Code" className="w-24 h-24" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">Share on Social Media:</p>
                    <SocialShareButton
                      product={{
                        id: product.id,
                        title: product.name,
                        description: product.description,
                        price: salePrice,
                        images: imageGallery,
                        seller_id: product.sellerId || product.seller,
                        profiles: { full_name: product.seller }
                      }}
                      affiliateCode={searchParams.get('ref') || undefined}
                      variant="button"
                      size="md"
                    />
                  </div>
                </div>
              )}

              <div className="text-sm text-gray-500 space-y-1">
                <p>
                  Shipping: {shippingPrice ? formatMoney(shippingPrice) : '$0.00 (seller-defined)'}
                </p>
                <p>Shipping & tax added at checkout. Free returns within 30 days.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Affiliate Tools Section */}
        {showAffiliateTools && (
          <div className="mt-10 p-6 bg-white rounded-2xl shadow-md border border-gray-200">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Affiliate Tools</h2>
            <p className="text-sm text-gray-500 mb-4">
              Use these tools to promote this product and earn commissions on sales.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                to={affiliateProductLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 inline-flex items-center justify-center bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors font-semibold text-center"
              >
                <span>👉 Get Your Affiliate Link</span>
              </Link>
              <a
                href={qrCodeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 inline-flex items-center justify-center bg-gray-100 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors font-semibold text-center"
              >
                <span>📱 Download QR Code</span>
              </a>
            </div>
            <p className="text-xs text-gray-500 mt-4">
              Share your affiliate link or QR code with potential buyers. Commission details are handled automatically.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductDetailPageSimple;
