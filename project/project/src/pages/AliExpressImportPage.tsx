import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, CheckCircle2, ExternalLink, Link2, Plus, RefreshCw, ShieldCheck, Wand2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContextMultiRole';
import { supabase } from '../lib/supabase';
import { ensureSellerProductInOrder } from '../utils/sellerProductOrder';
import { getAdminOnlyLowPriceMessage, isAdminUser } from '../utils/adminPricePolicy';
import { calculateCustomerProductPrice } from '../utils/pricing';

type CategoryOption = {
  id: string;
  name: string;
};

type AliExpressIntegrationStatus = {
  connected: boolean;
  platform: string;
  status?: string | null;
  connected_at?: string | null;
  last_sync?: string | null;
  expires_at?: string | null;
  ali_user_id?: string | null;
  access_token?: string | null;
};

const splitByCommaOrLine = (value: string) =>
  value
    .split(/[,\n]+/)
    .map((item) => item.trim())
    .filter(Boolean);

const parsePositiveNumber = (value: string, fallback = 0) => {
  const parsed = Number.parseFloat(String(value || '').trim());
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, parsed);
};

const roundToCents = (value: number) => Math.round(value * 100) / 100;

const computeListingPriceFromSource = (sourcePrice: number) => {
  const platformPercent = 0.1;
  const processingPercent = 0.0399;
  const processingFixed = 0.6;
  const desiredProfit = 5;
  const numerator = sourcePrice + processingFixed + desiredProfit;
  const denominator = 1 - platformPercent - processingPercent;
  if (denominator <= 0) return roundToCents(Math.max(0, sourcePrice + desiredProfit));
  return roundToCents(Math.max(0, numerator / denominator));
};

const AliExpressImportPage: React.FC = () => {
  const { profile, user, userRoles } = useAuth();
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [autoFilling, setAutoFilling] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [integrationStatus, setIntegrationStatus] = useState<AliExpressIntegrationStatus | null>(null);
  const [testProductId, setTestProductId] = useState('');
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<string>('');

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('29.99');
  const [commissionRate, setCommissionRate] = useState('10');
  const [stockQuantity, setStockQuantity] = useState('100');
  const [shippingCost, setShippingCost] = useState('0');
  const [categoryId, setCategoryId] = useState('');
  const [imagesRaw, setImagesRaw] = useState('');
  const [videosRaw, setVideosRaw] = useState('');
  const [aliExpressUrl, setAliExpressUrl] = useState('');
  const [externalProductId, setExternalProductId] = useState('');
  const [supplierSku, setSupplierSku] = useState('');
  const [importedProductId, setImportedProductId] = useState<string | null>(null);

  const getAuthHeader = async () => {
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    return token ? `Bearer ${token}` : '';
  };

  useEffect(() => {
    const loadCategories = async () => {
      const { data } = await supabase
        .from('categories')
        .select('id,name')
        .order('name', { ascending: true })
        .limit(300);

      const rows = (data || []) as CategoryOption[];
      setCategories(rows);
      if (!categoryId && rows.length > 0) {
        setCategoryId(rows[0].id);
      }
    };

    void loadCategories();
  }, [categoryId]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauth = String(params.get('oauth') || '').trim().toLowerCase();
    const message = String(params.get('message') || '').trim();
    if (oauth === 'success') {
      setStatusMessage('AliExpress connected successfully.');
      params.delete('oauth');
      params.delete('message');
      const next = `${window.location.pathname}${params.toString() ? `?${params}` : ''}`;
      window.history.replaceState({}, document.title, next);
    } else if (oauth === 'error') {
      setErrorMessage(message || 'AliExpress OAuth failed.');
      params.delete('oauth');
      params.delete('message');
      const next = `${window.location.pathname}${params.toString() ? `?${params}` : ''}`;
      window.history.replaceState({}, document.title, next);
    }
  }, []);

  const loadIntegrationStatus = async () => {
    if (!profile?.id) return;
    try {
      setStatusLoading(true);
      const authHeader = await getAuthHeader();
      if (!authHeader) return;
      const response = await fetch('/api/aliexpress/status', {
        method: 'GET',
        headers: {
          Authorization: authHeader,
        },
      });
      const payload = await response.json().catch(() => ({} as any));
      if (!response.ok) throw new Error(payload?.error || 'Failed to load AliExpress status');
      setIntegrationStatus(payload?.integration || null);
    } catch (error: any) {
      setErrorMessage(error?.message || 'Failed to load AliExpress status.');
    } finally {
      setStatusLoading(false);
    }
  };

  useEffect(() => {
    void loadIntegrationStatus();
  }, [profile?.id]);

  const parsedImages = useMemo(() => splitByCommaOrLine(imagesRaw), [imagesRaw]);
  const parsedVideos = useMemo(() => splitByCommaOrLine(videosRaw), [videosRaw]);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setPrice('29.99');
    setCommissionRate('10');
    setStockQuantity('100');
    setShippingCost('0');
    setImagesRaw('');
    setVideosRaw('');
    setAliExpressUrl('');
    setExternalProductId('');
    setSupplierSku('');
  };

  const createProduct = async (): Promise<boolean> => {
    setStatusMessage(null);
    setErrorMessage(null);
    setImportedProductId(null);

    if (!profile?.id) {
      setErrorMessage('Admin profile missing. Sign in again, then retry.');
      return false;
    }

    if (!title.trim()) {
      setErrorMessage('Product title is required.');
      return false;
    }

    if (!aliExpressUrl.trim()) {
      setErrorMessage('AliExpress product URL is required.');
      return false;
    }

    if (parsedImages.length === 0) {
      setErrorMessage('Add at least one product image URL.');
      return false;
    }

    const normalizedPrice = parsePositiveNumber(price, 0);
    if (normalizedPrice <= 0) {
      setErrorMessage('Price must be greater than 0.');
      return false;
    }

    const normalizedCommissionRate = parsePositiveNumber(commissionRate, 0);
    const normalizedStock = Math.max(0, Math.round(parsePositiveNumber(stockQuantity, 0)));
    const normalizedShipping = parsePositiveNumber(shippingCost, 0);
    const inStock = normalizedStock > 0;
    const adminOnlyPriceError = getAdminOnlyLowPriceMessage({
      isAdmin: isAdminUser({ profile, user, userRoles }),
      listingPrice: normalizedPrice,
      sellerAmount: normalizedPrice,
      shippingAmount: normalizedShipping,
    });
    if (adminOnlyPriceError) {
      setErrorMessage(adminOnlyPriceError);
      return false;
    }

    const tags = ['AliExpress Imported'];
    const sourceIdTag = externalProductId.trim();
    if (sourceIdTag) {
      tags.push(`AliExpress ID: ${sourceIdTag}`);
    }

    const listingPrice = roundToCents(calculateCustomerProductPrice(normalizedPrice, 'percent', normalizedCommissionRate));

    const productPayload: any = {
      seller_id: profile.id,
      title: title.trim(),
      description: description.trim(),
      category_id: categoryId || null,
      price: listingPrice,
      calculated_customer_price: listingPrice,
      seller_ask: normalizedPrice,
      seller_amount: normalizedPrice,
      seller_ask_price: normalizedPrice,
      currency: 'USD',
      images: parsedImages,
      primary_image_url: parsedImages[0] || null,
      videos: parsedVideos,
      stock_quantity: normalizedStock,
      total_inventory: normalizedStock,
      in_stock: inStock,
      shipping_cost: normalizedShipping,
      shipping_price: normalizedShipping,
      requires_shipping: true,
      track_inventory: true,
      commission_rate: normalizedCommissionRate,
      commission_type: 'percentage',
      flat_commission_amount: 0,
      affiliate_enabled: true,
      is_promotable: true,
      status: 'active',
      is_active: true,
      source_platform: 'aliexpress',
      external_product_id: sourceIdTag || null,
      dropship_provider: 'aliexpress',
      lineage: 'BEEZIO_HOUSE',
      is_dropshipped: true,
      supplier_info: {
        supplier_name: 'AliExpress',
        supplier_product_id: supplierSku.trim() || sourceIdTag || null,
        supplier_url: aliExpressUrl.trim(),
        is_dropshipped: true,
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

      if ((inserted as any)?.id) {
        await ensureSellerProductInOrder({
          sellerId: profile.id,
          productId: (inserted as any).id,
        });
        setImportedProductId((inserted as any).id);
      }

      setStatusMessage(`Product "${(inserted as any)?.title || title.trim()}" added and published.`);
      resetForm();
      return true;
    } catch (error: any) {
      setErrorMessage(error?.message || 'Failed to add product.');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleCreateProduct = async (event: React.FormEvent) => {
    event.preventDefault();
    await createProduct();
  };

  const runAutoFill = async (): Promise<boolean> => {
    setStatusMessage(null);
    setErrorMessage(null);

    if (!aliExpressUrl.trim()) {
      setErrorMessage('Paste an AliExpress URL first.');
      return false;
    }

    try {
      setAutoFilling(true);
      const response = await fetch('/api/aliexpress/autofill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: aliExpressUrl.trim() }),
      });

      const payload = await response.json().catch(() => ({} as any));
      if (!response.ok || payload?.ok === false) {
        throw new Error(payload?.error || `Auto-fill failed (${response.status})`);
      }

      const data = payload?.data || {};
      const sourcePrice = Number(data?.sourcePrice);

      if (String(data?.title || '').trim()) setTitle(String(data.title).trim());
      if (String(data?.description || '').trim()) setDescription(String(data.description).trim());
      if (Array.isArray(data?.images) && data.images.length > 0) {
        setImagesRaw(data.images.join('\n'));
      }
      if (Array.isArray(data?.videos) && data.videos.length > 0) {
        setVideosRaw(data.videos.join('\n'));
      }
      if (String(data?.externalProductId || '').trim()) {
        setExternalProductId(String(data.externalProductId).trim());
      }
      if (String(data?.supplierSku || '').trim()) {
        setSupplierSku(String(data.supplierSku).trim());
      }
      if (Number.isFinite(sourcePrice) && sourcePrice > 0) {
        const finalPrice = computeListingPriceFromSource(sourcePrice);
        setPrice(String(finalPrice));
      }
      if (Number.isFinite(Number(data?.shippingCost)) && Number(data.shippingCost) >= 0) {
        setShippingCost(String(roundToCents(Number(data.shippingCost))));
      }

      setStatusMessage('Auto-fill complete. Review and click Add AliExpress Product.');
      return true;
    } catch (error: any) {
      setErrorMessage(error?.message || 'Auto-fill failed.');
      return false;
    } finally {
      setAutoFilling(false);
    }
  };

  const handleAutoFillOnly = async () => {
    await runAutoFill();
  };

  const handleAutoFillAndUpload = async () => {
    const ok = await runAutoFill();
    if (!ok) return;
    await createProduct();
  };

  const handleStartOAuth = async () => {
    try {
      setOauthLoading(true);
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;
      if (!token) {
        setErrorMessage('Sign in again before connecting AliExpress.');
        return;
      }

      const loginUrl = `/api/aliexpress/login?access_token=${encodeURIComponent(token)}&return_to=${encodeURIComponent(window.location.pathname)}`;
      window.location.assign(loginUrl);
    } finally {
      setOauthLoading(false);
    }
  };

  const handleRunApiTest = async () => {
    try {
      setTestLoading(true);
      setTestResult('');
      setErrorMessage(null);
      const authHeader = await getAuthHeader();
      if (!authHeader) {
        setErrorMessage('Sign in again before testing the AliExpress API.');
        return;
      }

      const response = await fetch('/api/aliexpress/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authHeader,
        },
        body: JSON.stringify({
          productId: testProductId.trim() || undefined,
        }),
      });
      const payload = await response.json().catch(() => ({} as any));
      if (!response.ok) throw new Error(payload?.error || 'AliExpress API test failed');
      setTestResult(JSON.stringify(payload, null, 2));
      setStatusMessage('AliExpress API test completed.');
      await loadIntegrationStatus();
    } catch (error: any) {
      setErrorMessage(error?.message || 'AliExpress API test failed.');
    } finally {
      setTestLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-[#101820] text-white py-6">
        <div className="max-w-5xl mx-auto px-4">
          <h1 className="text-3xl font-bold mb-2">AliExpress Import</h1>
          <p className="text-gray-300">Add AliExpress products directly into marketplace + affiliate/custom store flows.</p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <div className="bg-white rounded-lg shadow-sm border p-6 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">AliExpress OAuth</h2>
              <p className="text-sm text-gray-600 mt-1">
                Connect the Beezio AliExpress app, store the OAuth token in Supabase, and verify the dropshipping API from this page.
              </p>
            </div>
            <button
              type="button"
              onClick={handleStartOAuth}
              disabled={oauthLoading}
              className="inline-flex items-center px-5 py-3 rounded-lg bg-[#101820] text-white font-semibold hover:bg-black transition-colors disabled:opacity-60"
            >
              <Link2 className="w-4 h-4 mr-2" />
              {oauthLoading ? 'Redirecting...' : integrationStatus?.connected ? 'Reconnect AliExpress' : 'Connect AliExpress'}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <div className="text-gray-500">Connection</div>
              <div className="mt-1 font-semibold text-gray-900">
                {statusLoading ? 'Loading...' : integrationStatus?.connected ? 'Connected' : 'Not connected'}
              </div>
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <div className="text-gray-500">Token</div>
              <div className="mt-1 font-semibold text-gray-900">
                {integrationStatus?.access_token || 'Not stored'}
              </div>
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <div className="text-gray-500">Expires</div>
              <div className="mt-1 font-semibold text-gray-900">
                {integrationStatus?.expires_at
                  ? new Date(integrationStatus.expires_at).toLocaleString()
                  : 'Unknown'}
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-dashed border-gray-300 p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
              <ShieldCheck className="w-4 h-4" />
              Dropshipping API test
            </div>
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
              <input
                value={testProductId}
                onChange={(e) => setTestProductId(e.target.value)}
                placeholder="Optional product ID for aliexpress.ds.product.get"
                className="w-full px-3 py-2 border rounded-lg"
              />
              <button
                type="button"
                onClick={handleRunApiTest}
                disabled={testLoading || !integrationStatus?.connected}
                className="inline-flex items-center justify-center px-5 py-3 rounded-lg border border-gray-300 text-gray-900 font-semibold hover:bg-gray-50 transition-colors disabled:opacity-60"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${testLoading ? 'animate-spin' : ''}`} />
                {testLoading ? 'Testing...' : 'Run API Test'}
              </button>
            </div>
            {testResult ? (
              <pre className="overflow-x-auto rounded-lg bg-[#101820] p-4 text-xs text-gray-100">{testResult}</pre>
            ) : null}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-4 text-sm text-gray-700">
          Products created here are saved as active + promotable, so they appear in marketplace and can be added to affiliate and custom stores.
          Default import pricing still starts from a $5 non-affiliate uplift over the source cost before you review the listing.
        </div>

        <form onSubmit={handleCreateProduct} className="bg-white rounded-lg shadow-sm border p-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Product Title</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="AliExpress product title"
                className="w-full px-3 py-2 border rounded-lg"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">AliExpress URL</label>
              <input
                value={aliExpressUrl}
                onChange={(e) => setAliExpressUrl(e.target.value)}
                placeholder="https://www.aliexpress.com/item/..."
                className="w-full px-3 py-2 border rounded-lg"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Product description"
              rows={4}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Listing Price (USD)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Commission %</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={commissionRate}
                onChange={(e) => setCommissionRate(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Stock Quantity</label>
              <input
                type="number"
                min="0"
                step="1"
                value={stockQuantity}
                onChange={(e) => setStockQuantity(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Shipping Cost (USD)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={shippingCost}
                onChange={(e) => setShippingCost(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="">No Category</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">AliExpress Product ID (optional)</label>
              <input
                value={externalProductId}
                onChange={(e) => setExternalProductId(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Supplier SKU (optional)</label>
              <input
                value={supplierSku}
                onChange={(e) => setSupplierSku(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Image URLs (comma or new line)</label>
              <textarea
                value={imagesRaw}
                onChange={(e) => setImagesRaw(e.target.value)}
                placeholder="https://image-1.jpg"
                rows={4}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Video URLs (optional)</label>
              <textarea
                value={videosRaw}
                onChange={(e) => setVideosRaw(e.target.value)}
                placeholder="https://video-1.mp4"
                rows={4}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleAutoFillOnly}
              disabled={autoFilling || saving}
              className="inline-flex items-center px-5 py-3 rounded-lg border border-gray-300 text-gray-900 font-semibold hover:bg-gray-50 transition-colors disabled:opacity-60"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${autoFilling ? 'animate-spin' : ''}`} />
              {autoFilling ? 'Auto Filling...' : 'Auto Fill from Link'}
            </button>
            <button
              type="button"
              onClick={handleAutoFillAndUpload}
              disabled={autoFilling || saving}
              className="inline-flex items-center px-5 py-3 rounded-lg bg-[#101820] text-[#ffcb05] font-semibold hover:bg-black transition-colors disabled:opacity-60"
            >
              <Wand2 className="w-4 h-4 mr-2" />
              Auto Fill + Upload
            </button>
            <button
              type="submit"
              disabled={saving || autoFilling}
              className="inline-flex items-center px-5 py-3 rounded-lg bg-[#ffcb05] text-black font-semibold hover:bg-[#e0b000] transition-colors disabled:opacity-60"
            >
              <Plus className="w-4 h-4 mr-2" />
              {saving ? 'Adding Product...' : 'Add AliExpress Product'}
            </button>
            <Link
              to="/admin/products"
              className="inline-flex items-center px-5 py-3 rounded-lg border border-gray-300 text-gray-900 font-semibold hover:bg-gray-50 transition-colors"
            >
              Back to Product Hub
            </Link>
          </div>
        </form>

        {statusMessage && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-green-800 flex items-start gap-2">
            <CheckCircle2 className="w-5 h-5 mt-0.5" />
            <div>
              <p className="font-medium">{statusMessage}</p>
              {importedProductId && (
                <div className="mt-2">
                  <Link
                    to={`/product/${importedProductId}`}
                    className="inline-flex items-center text-green-900 underline"
                  >
                    View product page <ExternalLink className="w-4 h-4 ml-1" />
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}

        {errorMessage && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 flex items-start gap-2">
            <AlertCircle className="w-5 h-5 mt-0.5" />
            <p>{errorMessage}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AliExpressImportPage;
