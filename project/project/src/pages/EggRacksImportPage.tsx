import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, CheckCircle2, ExternalLink, Images, Link2, PackagePlus, RefreshCw, Tag } from 'lucide-react';
import { useAuth } from '../contexts/AuthContextMultiRole';
import { supabase } from '../lib/supabase';
import { ensureSellerProductInOrder } from '../utils/sellerProductOrder';
import { getAdminOnlyLowPriceMessage, isAdminUser } from '../utils/adminPricePolicy';
import { calculateCustomerProductPrice, getAffiliateAmount } from '../utils/pricing';

type CategoryOption = {
  id: string;
  name: string;
};

type ParsedVariant = {
  label: string;
  url: string | null;
  externalVariantId: string | null;
  attributes?: Record<string, string> | null;
  sku: string | null;
};

const splitByCommaOrLine = (value: string) =>
  Array.from(
    new Set(
      value
        .split(/[\r\n,]+/)
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );

const parsePositiveNumber = (value: string, fallback = 0) => {
  const parsed = Number.parseFloat(String(value || '').trim());
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, parsed);
};

const roundToCents = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

const slugify = (value: string) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const EggRacksImportPage: React.FC = () => {
  const { profile, user, userRoles } = useAuth();
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [autoFilling, setAutoFilling] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [importedProductId, setImportedProductId] = useState<string | null>(null);

  const [eggracksUrl, setEggracksUrl] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [imagesRaw, setImagesRaw] = useState('');
  const [supplierSku, setSupplierSku] = useState('');
  const [itemCode, setItemCode] = useState('');
  const [externalProductId, setExternalProductId] = useState('');
  const [variants, setVariants] = useState<ParsedVariant[]>([]);
  const [sellerAskPrice, setSellerAskPrice] = useState('29.99');
  const [affiliateCommissionType, setAffiliateCommissionType] = useState<'percent' | 'flat'>('percent');
  const [affiliateCommissionValue, setAffiliateCommissionValue] = useState('10');
  const [stockQuantity, setStockQuantity] = useState('25');
  const [shippingCost, setShippingCost] = useState('0');
  const [selectedImageUrls, setSelectedImageUrls] = useState<string[]>([]);
  const [primaryImageUrl, setPrimaryImageUrl] = useState<string | null>(null);

  const parsedImages = useMemo(() => splitByCommaOrLine(imagesRaw), [imagesRaw]);
  const selectedImages = useMemo(
    () => parsedImages.filter((url) => selectedImageUrls.includes(url)),
    [parsedImages, selectedImageUrls]
  );
  const normalizedSellerAsk = useMemo(() => parsePositiveNumber(sellerAskPrice, 0), [sellerAskPrice]);
  const normalizedAffiliateValue = useMemo(() => parsePositiveNumber(affiliateCommissionValue, 0), [affiliateCommissionValue]);
  const normalizedShippingCost = useMemo(() => parsePositiveNumber(shippingCost, 0), [shippingCost]);
  const normalizedStockQuantity = useMemo(() => Math.max(0, Math.round(parsePositiveNumber(stockQuantity, 0))), [stockQuantity]);
  const calculatedListingPrice = useMemo(() => {
    if (normalizedSellerAsk <= 0) return 0;
    return roundToCents(calculateCustomerProductPrice(normalizedSellerAsk, affiliateCommissionType, normalizedAffiliateValue));
  }, [affiliateCommissionType, normalizedAffiliateValue, normalizedSellerAsk]);
  const calculatedAffiliatePayout = useMemo(
    () => roundToCents(getAffiliateAmount(normalizedSellerAsk, affiliateCommissionType, normalizedAffiliateValue)),
    [affiliateCommissionType, normalizedAffiliateValue, normalizedSellerAsk]
  );
  const orderedSelectedImages = useMemo(() => {
    const chosen = selectedImages.length ? selectedImages : [];
    if (!chosen.length) return [] as string[];
    const primary = primaryImageUrl && chosen.includes(primaryImageUrl) ? primaryImageUrl : chosen[0];
    return [primary, ...chosen.filter((url) => url !== primary)];
  }, [primaryImageUrl, selectedImages]);

  useEffect(() => {
    const loadCategories = async () => {
      const { data } = await supabase
        .from('categories')
        .select('id,name')
        .order('name', { ascending: true })
        .limit(300);

      const rows = ((data || []) as CategoryOption[]).filter((row) => row.id && row.name);
      setCategories(rows);
      if (!categoryId && rows.length > 0) {
        setCategoryId(rows[0].id);
      }
    };

    void loadCategories();
  }, [categoryId]);

  useEffect(() => {
    if (!parsedImages.length) {
      setSelectedImageUrls([]);
      setPrimaryImageUrl(null);
      return;
    }

    setSelectedImageUrls((current) => {
      const next = current.filter((url) => parsedImages.includes(url));
      return next.length ? next : parsedImages;
    });

    setPrimaryImageUrl((current) => (current && parsedImages.includes(current) ? current : parsedImages[0]));
  }, [parsedImages]);

  const getAuthHeader = async () => {
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    return token ? `Bearer ${token}` : '';
  };

  const handleAutoFill = async () => {
    setStatusMessage(null);
    setErrorMessage(null);
    setImportedProductId(null);

    if (!eggracksUrl.trim()) {
      setErrorMessage('Paste an EggRacks product URL first.');
      return;
    }

    try {
      setAutoFilling(true);
      const authHeader = await getAuthHeader();
      if (!authHeader) {
        throw new Error('Admin session missing. Sign in again, then retry.');
      }

      const response = await fetch('/api/eggracks/autofill', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authHeader,
        },
        body: JSON.stringify({ url: eggracksUrl.trim() }),
      });

      const payload = await response.json().catch(() => ({} as any));
      if (!response.ok || payload?.ok === false) {
        throw new Error(payload?.error || `EggRacks auto-fill failed (${response.status})`);
      }

      const data = payload?.data || {};
      setTitle(String(data?.title || '').trim());
      setDescription(String(data?.description || '').trim());
      setImagesRaw(Array.isArray(data?.images) ? data.images.join('\n') : '');
      setSupplierSku(String(data?.sku || '').trim());
      setItemCode(String(data?.itemCode || '').trim());
      setExternalProductId(String(data?.productId || '').trim());
      setVariants(Array.isArray(data?.variants) ? (data.variants as ParsedVariant[]) : []);
      setStatusMessage('EggRacks product data loaded. Choose images, set your price and affiliate commission, then publish it to the marketplace.');
    } catch (error: any) {
      setErrorMessage(error?.message || 'Failed to fetch EggRacks product data.');
    } finally {
      setAutoFilling(false);
    }
  };

  const toggleImageSelection = (url: string) => {
    setSelectedImageUrls((current) => {
      if (current.includes(url)) {
        const next = current.filter((item) => item !== url);
        setPrimaryImageUrl((active) => (active === url ? next[0] || null : active));
        return next;
      }
      const next = [...current, url];
      return parsedImages.filter((item) => next.includes(item));
    });
  };

  const selectPrimaryImage = (url: string) => {
    setSelectedImageUrls((current) => (current.includes(url) ? current : parsedImages.filter((item) => [...current, url].includes(item))));
    setPrimaryImageUrl(url);
  };

  const buildVariantPayloads = (productId: string, listingPrice: number, inStock: boolean) => {
    const baseSku = supplierSku.trim() || itemCode.trim() || externalProductId.trim() || `eggracks-${slugify(title) || 'product'}`;
    const sourceVariants = variants.length
      ? variants
      : [
          {
            label: 'Default',
            url: eggracksUrl.trim() || null,
            externalVariantId: null,
            attributes: { Option: 'Default' },
            sku: baseSku,
          },
        ];

    return sourceVariants.map((variant, index) => ({
      product_id: productId,
      provider: 'EggRacks',
      source: 'eggracks',
      sku: variant.sku || `${baseSku}-${index + 1}`,
      price: listingPrice,
      currency: 'USD',
      image_url: orderedSelectedImages[index] || orderedSelectedImages[0] || null,
      attributes: variant.attributes || { Option: variant.label },
      inventory: sourceVariants.length === 1 ? normalizedStockQuantity : null,
      is_active: true,
      source_platform: 'eggracks',
      external_product_id: externalProductId.trim() || itemCode.trim() || null,
      external_variant_id: variant.externalVariantId || variant.url || null,
      external_data: {
        source_url: eggracksUrl.trim(),
        supplier_sku: supplierSku.trim() || null,
        item_code: itemCode.trim() || null,
        variant_label: variant.label,
        variant_url: variant.url || null,
      },
      supplier_variant_ref: variant.externalVariantId || variant.url || variant.label,
      variant_display_sku: variant.sku || `${baseSku}-${variant.label}`,
      searchable_codes: [
        supplierSku.trim(),
        itemCode.trim(),
        externalProductId.trim(),
        variant.sku || '',
        variant.label,
      ].filter(Boolean),
      is_orderable: true,
      order_reference_type: 'none' as const,
      raw_variant_payload_json: variant,
      import_status: 'ready' as const,
      option1_name: 'Option',
      option1_value: variant.label,
      inventory_policy: 'deny' as const,
      in_stock: inStock,
      inventory_source: 'manual' as const,
    }));
  };

  const handleCreateProduct = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatusMessage(null);
    setErrorMessage(null);
    setImportedProductId(null);

    if (!profile?.id) {
      setErrorMessage('Admin profile missing. Sign in again, then retry.');
      return;
    }

    if (!eggracksUrl.trim()) {
      setErrorMessage('EggRacks product URL is required.');
      return;
    }

    if (!title.trim()) {
      setErrorMessage('Product title is required.');
      return;
    }

    if (orderedSelectedImages.length === 0) {
      setErrorMessage('Select at least one product image to import.');
      return;
    }

    if (normalizedSellerAsk <= 0) {
      setErrorMessage('Enter the price you want to keep for this product.');
      return;
    }

    const adminOnlyPriceError = getAdminOnlyLowPriceMessage({
      isAdmin: isAdminUser({ profile, user, userRoles }),
      listingPrice: calculatedListingPrice,
      sellerAmount: normalizedSellerAsk,
      shippingAmount: normalizedShippingCost,
    });
    if (adminOnlyPriceError) {
      setErrorMessage(adminOnlyPriceError);
      return;
    }

    const inStock = normalizedStockQuantity > 0;
    const supplierProductRef = itemCode.trim() || supplierSku.trim() || externalProductId.trim() || null;
    const tags = [
      'EggRacks Imported',
      ...(supplierSku.trim() ? [`EggRacks SKU: ${supplierSku.trim()}`] : []),
      ...(itemCode.trim() ? [`EggRacks Item Code: ${itemCode.trim()}`] : []),
      ...(externalProductId.trim() ? [`EggRacks Product ID: ${externalProductId.trim()}`] : []),
    ];

    const productPayload: any = {
      seller_id: profile.id,
      title: title.trim(),
      description: description.trim(),
      category_id: categoryId || null,
      price: calculatedListingPrice,
      calculated_customer_price: calculatedListingPrice,
      seller_ask: normalizedSellerAsk,
      seller_amount: normalizedSellerAsk,
      seller_ask_price: normalizedSellerAsk,
      currency: 'USD',
      images: orderedSelectedImages,
      primary_image_url: orderedSelectedImages[0] || null,
      videos: [],
      stock_quantity: normalizedStockQuantity,
      total_inventory: normalizedStockQuantity,
      in_stock: inStock,
      shipping_cost: normalizedShippingCost,
      shipping_price: normalizedShippingCost,
      requires_shipping: true,
      track_inventory: true,
      commission_rate: affiliateCommissionType === 'percent' ? normalizedAffiliateValue : 0,
      commission_type: affiliateCommissionType === 'flat' ? 'flat_rate' : 'percentage',
      flat_commission_amount: affiliateCommissionType === 'flat' ? normalizedAffiliateValue : 0,
      affiliate_commission_type: affiliateCommissionType,
      affiliate_commission_value: normalizedAffiliateValue,
      affiliate_enabled: true,
      is_promotable: true,
      status: 'active',
      is_active: true,
      source_platform: 'eggracks',
      dropship_provider: 'eggracks',
      lineage: 'BEEZIO_HOUSE',
      is_dropshipped: false,
      supplier_info: {
        supplier_name: 'EggRacks',
        supplier_product_id: supplierProductRef,
        supplier_sku: supplierSku.trim() || null,
        supplier_item_code: itemCode.trim() || null,
        supplier_external_product_id: externalProductId.trim() || null,
        supplier_url: eggracksUrl.trim(),
        stocked_in_house: true,
        is_dropshipped: false,
      },
      tags,
    };

    try {
      setSaving(true);
      const { data: inserted, error } = await supabase
        .from('products')
        .insert([productPayload])
        .select('id,title')
        .single();

      if (error) throw error;

      const productId = String((inserted as any)?.id || '').trim();
      if (!productId) {
        throw new Error('Draft product was created without an id.');
      }

      const variantPayloads = buildVariantPayloads(productId, calculatedListingPrice, inStock);
      if (variantPayloads.length > 0) {
        const { error: variantError } = await supabase.from('product_variants').insert(variantPayloads as any[]);
        if (variantError) throw variantError;
      }

      await ensureSellerProductInOrder({ sellerId: profile.id, productId });
      setImportedProductId(productId);
      setStatusMessage(`EggRacks product "${(inserted as any)?.title || title.trim()}" is now in your product dashboard and live in the marketplace.`);
    } catch (error: any) {
      setErrorMessage(error?.message || 'Failed to import EggRacks product.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-[#101820] text-white py-8">
        <div className="max-w-6xl mx-auto px-4">
          <h1 className="text-3xl font-bold mb-2">EggRacks Import</h1>
          <p className="text-slate-300 max-w-3xl">
            Pull EggRacks product data into Beezio, choose the photos you want, set your selling price and affiliate payout, and publish it straight into your product dashboard and marketplace.
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        {statusMessage && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 mt-0.5 flex-shrink-0" />
            <div className="space-y-2">
              <p>{statusMessage}</p>
              {importedProductId && (
                <div className="flex flex-wrap gap-3">
                  <Link to="/dashboard?section=seller&tab=products" className="font-semibold underline">
                    Open Product Dashboard
                  </Link>
                  <Link to={`/dashboard/products/edit/${importedProductId}`} className="font-semibold underline">
                    Edit Product
                  </Link>
                  <Link to="/admin/products" className="font-semibold underline">
                    Back To Product Hub
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}

        {errorMessage && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-800 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
            <p>{errorMessage}</p>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <form onSubmit={handleCreateProduct} className="bg-white rounded-2xl border shadow-sm p-6 space-y-5">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">1. Fetch Product Data</h2>
              <p className="text-sm text-slate-600 mt-1">
                Paste an EggRacks product URL. The importer reads the public product page, loads the media and options, and lets you publish it as a normal Beezio marketplace product.
              </p>
            </div>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">EggRacks Product URL</span>
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  type="url"
                  value={eggracksUrl}
                  onChange={(event) => setEggracksUrl(event.target.value)}
                  placeholder="https://www.eggracks.com/..."
                  className="flex-1 rounded-xl border border-slate-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
                <button
                  type="button"
                  onClick={handleAutoFill}
                  disabled={autoFilling}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-white font-semibold hover:bg-black disabled:opacity-60"
                >
                  {autoFilling ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                  {autoFilling ? 'Fetching...' : 'Auto-Fill From EggRacks'}
                </button>
              </div>
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-700">Supplier SKU</span>
                <input
                  type="text"
                  value={supplierSku}
                  onChange={(event) => setSupplierSku(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-700">Item Code / Product Code</span>
                <input
                  type="text"
                  value={itemCode}
                  onChange={(event) => setItemCode(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-700">EggRacks Product ID</span>
                <input
                  type="text"
                  value={externalProductId}
                  onChange={(event) => setExternalProductId(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-700">Marketplace Category</span>
                <select
                  value={categoryId}
                  onChange={(event) => setCategoryId(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-slate-900"
                >
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">Title</span>
              <input
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">Description</span>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={8}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">Image URLs</span>
              <textarea
                value={imagesRaw}
                onChange={(event) => setImagesRaw(event.target.value)}
                rows={6}
                placeholder="One image URL per line"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </label>

            {parsedImages.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">Choose Photos To Import</h3>
                    <p className="text-sm text-slate-600">
                      {selectedImages.length} of {parsedImages.length} image{parsedImages.length === 1 ? '' : 's'} selected
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedImageUrls(parsedImages)}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const primary = primaryImageUrl && parsedImages.includes(primaryImageUrl) ? primaryImageUrl : parsedImages[0] || null;
                        setSelectedImageUrls(primary ? [primary] : []);
                        setPrimaryImageUrl(primary);
                      }}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Keep Primary Only
                    </button>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {parsedImages.map((imageUrl, index) => {
                    const isSelected = selectedImageUrls.includes(imageUrl);
                    const isPrimary = primaryImageUrl === imageUrl;
                    return (
                      <div
                        key={`${imageUrl}-${index}`}
                        className={`overflow-hidden rounded-2xl border ${isSelected ? 'border-slate-900 shadow-sm' : 'border-slate-200'} bg-white`}
                      >
                        <div className="aspect-square bg-slate-100">
                          <img src={imageUrl} alt={`EggRacks product ${index + 1}`} className="h-full w-full object-cover" />
                        </div>
                        <div className="space-y-2 p-3">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => toggleImageSelection(imageUrl)}
                              className={`rounded-lg px-3 py-2 text-sm font-medium ${isSelected ? 'bg-slate-900 text-white' : 'border border-slate-300 text-slate-700 hover:bg-slate-50'}`}
                            >
                              {isSelected ? 'Included' : 'Include'}
                            </button>
                            <button
                              type="button"
                              onClick={() => selectPrimaryImage(imageUrl)}
                              className={`rounded-lg px-3 py-2 text-sm font-medium ${isPrimary ? 'bg-[#ffcb05] text-black' : 'border border-slate-300 text-slate-700 hover:bg-slate-50'}`}
                            >
                              {isPrimary ? 'Primary Image' : 'Make Primary'}
                            </button>
                          </div>
                          <div className="truncate text-xs text-slate-500">{imageUrl}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5 space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">2. Set Your Selling Price</h3>
                <p className="text-sm text-slate-600 mt-1">
                  Enter the amount you want to keep, then set the affiliate payout. Beezio calculates the live marketplace price automatically.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-slate-700">Your Price</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={sellerAskPrice}
                    onChange={(event) => setSellerAskPrice(event.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </label>

                <label className="block space-y-2">
                  <span className="text-sm font-medium text-slate-700">Affiliate Commission Type</span>
                  <select
                    value={affiliateCommissionType}
                    onChange={(event) => setAffiliateCommissionType(event.target.value as 'percent' | 'flat')}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-slate-900"
                  >
                    <option value="percent">Percent</option>
                    <option value="flat">Flat Dollar Amount</option>
                  </select>
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-slate-700">
                    {affiliateCommissionType === 'percent' ? 'Affiliate Commission %' : 'Affiliate Commission $'}
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={affiliateCommissionValue}
                    onChange={(event) => setAffiliateCommissionValue(event.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </label>

                <label className="block space-y-2">
                  <span className="text-sm font-medium text-slate-700">Stock Quantity</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={stockQuantity}
                    onChange={(event) => setStockQuantity(event.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </label>

                <label className="block space-y-2">
                  <span className="text-sm font-medium text-slate-700">Shipping Price</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={shippingCost}
                    onChange={(event) => setShippingCost(event.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </label>
              </div>

              <div className="grid gap-3 rounded-2xl bg-white p-4 sm:grid-cols-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">You Keep</div>
                  <div className="mt-1 text-2xl font-bold text-slate-900">${normalizedSellerAsk.toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Affiliate Earns</div>
                  <div className="mt-1 text-2xl font-bold text-slate-900">${calculatedAffiliatePayout.toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Marketplace Price</div>
                  <div className="mt-1 text-2xl font-bold text-slate-900">${calculatedListingPrice.toFixed(2)}</div>
                </div>
              </div>
            </section>

            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
              This saves the EggRacks product straight into your product dashboard and publishes it to the marketplace using the images, price, and affiliate payout you choose here.
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#ffcb05] px-5 py-3 text-black font-semibold hover:bg-[#e0b000] disabled:opacity-60"
              >
                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <PackagePlus className="w-4 h-4" />}
                {saving ? 'Publishing Product...' : 'Save To Product Dashboard + Marketplace'}
              </button>

              <Link to="/dashboard?section=seller&tab=products" className="inline-flex items-center rounded-xl border border-slate-300 px-5 py-3 font-semibold text-slate-900 hover:bg-slate-50">
                Open Product Dashboard
              </Link>

              <Link to="/admin/products" className="inline-flex items-center rounded-xl border border-slate-300 px-5 py-3 font-semibold text-slate-900 hover:bg-slate-50">
                Back To Product Hub
              </Link>
            </div>
          </form>

          <div className="space-y-6">
            <section className="bg-white rounded-2xl border shadow-sm p-6">
              <h2 className="text-xl font-semibold text-slate-900 mb-4">Scraped Summary</h2>
              <div className="space-y-4 text-sm text-slate-700">
                <div className="flex items-start gap-3">
                  <Tag className="w-4 h-4 mt-0.5 text-slate-500" />
                  <div>
                    <div className="font-semibold text-slate-900">Supplier Codes</div>
                    <div>SKU: {supplierSku || 'Not found yet'}</div>
                    <div>Item Code: {itemCode || 'Not found yet'}</div>
                    <div>Product ID: {externalProductId || 'Not found yet'}</div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Images className="w-4 h-4 mt-0.5 text-slate-500" />
                  <div>
                    <div className="font-semibold text-slate-900">Media</div>
                    <div>{selectedImages.length} selected image{selectedImages.length === 1 ? '' : 's'} ready for import</div>
                    <div>Primary: {primaryImageUrl ? 'Chosen' : 'Not selected yet'}</div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <PackagePlus className="w-4 h-4 mt-0.5 text-slate-500" />
                  <div>
                    <div className="font-semibold text-slate-900">Pricing Preview</div>
                    <div>You keep: ${normalizedSellerAsk.toFixed(2)}</div>
                    <div>Affiliate payout: ${calculatedAffiliatePayout.toFixed(2)}</div>
                    <div>Marketplace price: ${calculatedListingPrice.toFixed(2)}</div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <ExternalLink className="w-4 h-4 mt-0.5 text-slate-500" />
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-900">Source Link</div>
                    {eggracksUrl ? (
                      <a href={eggracksUrl} target="_blank" rel="noreferrer" className="break-all text-slate-700 underline">
                        {eggracksUrl}
                      </a>
                    ) : (
                      <div>Paste a product URL to begin.</div>
                    )}
                  </div>
                </div>
              </div>
            </section>

            <section className="bg-white rounded-2xl border shadow-sm p-6">
              <h2 className="text-xl font-semibold text-slate-900 mb-4">Variants</h2>
              {variants.length > 0 ? (
                <div className="space-y-3">
                  {variants.map((variant, index) => (
                    <div key={`${variant.label}-${variant.externalVariantId || index}`} className="rounded-xl border border-slate-200 p-4">
                      <div className="font-semibold text-slate-900">{variant.label}</div>
                      <div className="text-sm text-slate-600 mt-1">Variant SKU: {variant.sku || 'Will be generated'}</div>
                      <div className="text-sm text-slate-600">External Ref: {variant.externalVariantId || 'Not found'}</div>
                      {variant.url && (
                        <a href={variant.url} target="_blank" rel="noreferrer" className="mt-2 inline-flex text-sm font-medium underline text-slate-800">
                          Open Variant Page
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-600">
                  No separate variants were found yet. The importer will create a single default variant using the supplier SKU or item code.
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EggRacksImportPage;
