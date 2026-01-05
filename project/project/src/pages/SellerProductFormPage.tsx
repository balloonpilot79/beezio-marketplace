import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import { useAuth } from '../contexts/AuthContextMultiRole';
import { supabase } from '../lib/supabase';
import { calculateSalePriceFromSellerAsk, DEFAULT_AFFILIATE_RATE, normalizeAffiliateRate } from '../utils/pricing';
import ImageUpload from '../components/ImageUpload';
import { resolveProfileIdForUser } from '../utils/resolveProfileId';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const looksLikeUuid = (value: unknown): value is string => {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  return UUID_REGEX.test(trimmed);
};

const extractMissingColumnName = (message: string): string | null => {
  const match = message.match(/Could not find the ['"]([^'"]+)['"] column/i);
  if (match?.[1]) return match[1];
  const match2 = message.match(/column ['"]?([a-zA-Z0-9_]+)['"]? does not exist/i);
  if (match2?.[1]) return match2[1];
  return null;
};

const SellerProductFormPage: React.FC = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [newProduct, setNewProduct] = useState({
    title: '',
    description: '',
    price: 0,
    sellerAsk: 0,
    stock_quantity: 0,
    category_id: '',
    product_type: 'one_time' as 'one_time' | 'subscription',
    subscription_interval: 'monthly' as 'monthly' | 'yearly',
    affiliate_commission_rate: 10,
    affiliate_commission_type: 'percentage' as 'percentage' | 'fixed',
    sku: '',
    is_digital: false,
    requires_shipping: true,
    shipping_cost: 0,
    is_promotable: true,
    images: [] as string[],
    video_url: '',
    api_integration: {
      enabled: false,
      provider: '' as '' | 'printful' | 'printify' | 'shopify' | 'custom',
      product_id: '',
      webhook_url: ''
    }
  });

  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([
    { id: 'electronics', name: 'Electronics' },
    { id: 'fashion', name: 'Fashion & Apparel' },
    { id: 'home-garden', name: 'Home & Garden' },
    { id: 'books-media', name: 'Books & Media' },
    { id: 'sports-outdoors', name: 'Sports & Outdoors' },
    { id: 'beauty-personal-care', name: 'Beauty & Personal Care' },
    { id: 'health-wellness', name: 'Health & Wellness' },
    { id: 'technology', name: 'Technology' },
    { id: 'arts-crafts', name: 'Arts & Crafts' },
    { id: 'automotive', name: 'Automotive' },
    { id: 'pet-supplies', name: 'Pet Supplies' },
    { id: 'toys-games', name: 'Toys & Games' },
    { id: 'education', name: 'Education & Courses' },
    { id: 'services', name: 'Services' },
    { id: 'digital-products', name: 'Digital Products' },
    { id: 'food-beverages', name: 'Food & Beverages' }
  ]);

  const affiliateRateDecimal = newProduct.affiliate_commission_type === 'percentage'
    ? normalizeAffiliateRate(newProduct.affiliate_commission_rate)
    : DEFAULT_AFFILIATE_RATE;

  const previewPrice = (() => {
    try {
      return calculateSalePriceFromSellerAsk(newProduct.sellerAsk || 0, affiliateRateDecimal);
    } catch {
      return 0;
    }
  })();

  useEffect(() => {
    (async () => {
      try {
        // Prefer sort_order when present, but fall back to name ordering for older schemas.
        let { data, error } = await supabase.from('categories').select('id, name').order('sort_order', { ascending: true });
        const msg = String((error as any)?.message || '');
        if (error && /sort_order/i.test(msg)) {
          ({ data, error } = await supabase.from('categories').select('id, name').order('name', { ascending: true }));
        }
        if (!error && data && data.length > 0) {
          console.log('Categories loaded from database:', data.length);
          setCategories(data);
        } else {
          console.log('Using fallback categories');
        }
      } catch (e) {
        console.log('Category fetch error, keeping defaults:', e);
      }
    })();
  }, []);

  useEffect(() => {
    try {
      const nextPrice = calculateSalePriceFromSellerAsk(newProduct.sellerAsk || 0, affiliateRateDecimal);
      if (Math.abs((newProduct.price || 0) - nextPrice) > 0.009) {
        setNewProduct(prev => ({ ...prev, price: nextPrice }));
      }
    } catch {
      // Ignore invalid pricing config while user is typing
    }
  }, [newProduct.sellerAsk, newProduct.affiliate_commission_rate, newProduct.affiliate_commission_type, affiliateRateDecimal]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!profile?.id) {
      alert('Profile not found. Please complete your profile setup.');
      return;
    }

    // Validate required fields
    if (!newProduct.title.trim()) {
      alert('Please enter a product title.');
      return;
    }

    if (!newProduct.description.trim()) {
      alert('Please enter a product description.');
      return;
    }

    const categorySelection = String(newProduct.category_id || '').trim();
    const selectedCategoryName =
      categories.find((c) => String(c.id) === categorySelection)?.name || categorySelection;

    if (!selectedCategoryName) {
      alert('Please select a category.');
      return;
    }

    if (newProduct.sellerAsk <= 0) {
      alert('Please enter a valid seller ask.');
      return;
    }

    if (newProduct.stock_quantity < 0) {
      alert('Inventory cannot be negative.');
      return;
    }

    if (newProduct.affiliate_commission_rate <= 0) {
      alert('Please enter a valid commission rate.');
      return;
    }

    try {
      setLoading(true);

      const { sellerAsk, ...rest } = newProduct;

      const normalizedCategoryId = looksLikeUuid(newProduct.category_id) ? newProduct.category_id : null;
      const normalizedCategoryName =
        categories.find((c) => String(c.id) === String(newProduct.category_id))?.name ||
        String(newProduct.category_id || '').trim() ||
        null;

      // Ensure we use the canonical profiles.id for products.seller_id FK.
      const canonicalSellerId = await resolveProfileIdForUser(String((profile as any)?.user_id || (profile as any)?.id || ''));

      const productData = {
        ...rest,
        price: previewPrice,
        seller_ask: sellerAsk,
        currency: 'USD',
        category: normalizedCategoryName,
        category_id: normalizedCategoryId,
        seller_id: canonicalSellerId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_active: true,
        is_promotable: newProduct.is_promotable ?? true,
        dropship_provider: null,
        sales_count: 0,
        images: newProduct.images || [],
        video_url: newProduct.video_url || '',
        api_integration: newProduct.api_integration || {
          enabled: false,
          provider: '',
          product_id: '',
          webhook_url: ''
        },
        // Marketplace eligibility + canonical commission fields
        affiliate_enabled: true,
        commission_rate: newProduct.affiliate_commission_type === 'percentage' ? newProduct.affiliate_commission_rate : 0,
        commission_type: newProduct.affiliate_commission_type === 'percentage' ? 'percentage' : 'flat_rate',
        flat_commission_amount: newProduct.affiliate_commission_type === 'fixed' ? newProduct.affiliate_commission_rate : 0,
      };

      console.log('Creating product:', productData);

      // Schema-tolerant insert: during staged rollouts, some DBs may not yet have optional columns
      // like api_integration/video_url/currency/sales_count. Drop missing keys and retry.
      const insertPayload: any = { ...productData };
      let data: any = null;
      let error: any = null;
      for (let attempt = 0; attempt < 8; attempt++) {
        const res = await supabase.from('products').insert([insertPayload]).select().single();
        data = res.data;
        error = res.error;
        if (!error) break;

        const message = String((error as any)?.message || '');
        const missing = extractMissingColumnName(message);
        if (missing && Object.prototype.hasOwnProperty.call(insertPayload, missing)) {
          delete insertPayload[missing];
          continue;
        }
        break;
      }

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      console.log('Product created successfully:', data);

      // Best-effort: ensure the seller has a default store row even if they haven't customized it yet.
      // This makes the "generic store" behavior consistent (products can exist immediately).
      try {
        await supabase
          .from('store_settings')
          .upsert(
            {
              seller_id: profile.id,
              store_name: profile.full_name ? `${profile.full_name}'s Store` : 'My Store',
            },
            { onConflict: 'seller_id' }
          );
      } catch (storeErr) {
        console.warn('[SellerProductFormPage] store_settings upsert failed (non-fatal):', storeErr);
      }

      // Best-effort: add the product to the seller's storefront ordering table so it shows up immediately.
      try {
        const { count } = await supabase
          .from('seller_product_order')
          .select('*', { count: 'exact', head: true })
          .eq('seller_id', profile.id);

        const displayOrder = typeof count === 'number' ? count : 0;

        await supabase
          .from('seller_product_order')
          .upsert(
            {
              seller_id: profile.id,
              product_id: data.id,
              display_order: displayOrder,
              is_featured: false,
            },
            { onConflict: 'seller_id,product_id' }
          );
      } catch (orderErr) {
        console.warn('[SellerProductFormPage] seller_product_order upsert failed (non-fatal):', orderErr);
      }

      alert('Product created successfully!');
      navigate('/seller/products');
    } catch (error) {
      console.error('Error creating product:', error);
      alert(`Failed to create product: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setNewProduct(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleApiIntegrationChange = (field: string, value: any) => {
    setNewProduct(prev => ({
      ...prev,
      api_integration: {
        ...prev.api_integration,
        [field]: value
      }
    }));
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/seller/products')}
            className="flex items-center text-orange-600 hover:text-orange-700 mb-4"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Back to Products
          </button>
          <h1 className="text-3xl font-bold text-gray-900">Add New Product</h1>
          <p className="text-gray-600 mt-2">Create a new product for your store</p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-lg shadow-sm border">
          <form onSubmit={handleSubmit} className="p-8 space-y-8">
            {/* Basic Information */}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Basic Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Product Title *
                  </label>
                  <input
                    type="text"
                    value={newProduct.title}
                    onChange={(e) => handleInputChange('title', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    required
                    placeholder="Enter product title"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description *
                  </label>
                  <textarea
                    value={newProduct.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    required
                    placeholder="Describe your product"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Category *
                  </label>
                  <select
                      value={newProduct.category_id}
                      onChange={(e) => handleInputChange('category_id', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    required
                  >
                    <option value="">Select a category</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Seller Ask ($) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={newProduct.sellerAsk}
                    onChange={(e) => handleInputChange('sellerAsk', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    required
                    placeholder="0.00"
                  />
                  <p className="text-sm text-gray-700 mt-2">
                    Customer price (before tax & shipping): <span className="font-semibold">${previewPrice.toFixed(2)}</span>
                  </p>
                  <p className="text-xs text-gray-500">
                    Beezio automatically adds fees, affiliate commissions, and platform costs into the price so you always receive your full ask on each sale. Tax and shipping are added at checkout.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Inventory (Units) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={newProduct.stock_quantity}
                    onChange={(e) => {
                      const value = parseInt(e.target.value, 10);
                      handleInputChange('stock_quantity', Number.isNaN(value) ? 0 : Math.max(0, value));
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    required
                    placeholder="0"
                  />
                </div>
              </div>
            </div>

            {/* Product Type */}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Product Type</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Product Type *
                  </label>
                  <select
                    value={newProduct.product_type}
                    onChange={(e) => handleInputChange('product_type', e.target.value as 'one_time' | 'subscription')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    required
                  >
                    <option value="one_time">One-Time Purchase</option>
                    <option value="subscription">Subscription</option>
                  </select>
                </div>

                {newProduct.product_type === 'subscription' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Billing Interval *
                    </label>
                    <select
                      value={newProduct.subscription_interval}
                      onChange={(e) => handleInputChange('subscription_interval', e.target.value as 'monthly' | 'yearly')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      required
                    >
                      <option value="monthly">Monthly</option>
                      <option value="yearly">Yearly</option>
                    </select>
                  </div>
                )}
              </div>
            </div>

            {/* Commission Settings */}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Affiliate Commission</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Commission Type *
                  </label>
                  <select
                    value={newProduct.affiliate_commission_type}
                    onChange={(e) => handleInputChange('affiliate_commission_type', e.target.value as 'percentage' | 'fixed')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    required
                  >
                    <option value="percentage">Percentage</option>
                    <option value="fixed">Fixed Amount</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Commission Rate *
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max={newProduct.affiliate_commission_type === 'percentage' ? 100 : undefined}
                      step={newProduct.affiliate_commission_type === 'percentage' ? 1 : 0.01}
                      value={newProduct.affiliate_commission_rate}
                      onChange={(e) => handleInputChange('affiliate_commission_rate', parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      required
                    />
                    <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                      {newProduct.affiliate_commission_type === 'percentage' ? '%' : '$'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Shipping & Fulfillment */}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Shipping & Fulfillment</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    SKU (optional)
                  </label>
                  <input
                    type="text"
                    value={newProduct.sku}
                    onChange={(e) => handleInputChange('sku', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="Internal SKU or code"
                  />
                </div>

                <div className="flex items-center space-x-3 mt-6 md:mt-0">
                  <input
                    id="is-digital"
                    type="checkbox"
                    checked={newProduct.is_digital}
                    onChange={(e) => {
                      const isDigital = e.target.checked;
                      handleInputChange('is_digital', isDigital);
                      handleInputChange('requires_shipping', !isDigital);
                    }}
                    className="rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                  />
                  <label htmlFor="is-digital" className="text-sm font-medium text-gray-700">
                    This is a digital product (no shipping)
                  </label>
                </div>
              </div>

              {!newProduct.is_digital && (
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Requires Shipping
                    </label>
                    <select
                      value={newProduct.requires_shipping ? 'yes' : 'no'}
                      onChange={(e) => handleInputChange('requires_shipping', e.target.value === 'yes')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    >
                      <option value="yes">Yes</option>
                      <option value="no">No</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Flat Shipping Cost ($)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={newProduct.shipping_cost}
                      onChange={(e) => handleInputChange('shipping_cost', parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      placeholder="0.00"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Optional flat shipping amount added at checkout. Leave at 0 for free shipping.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Images */}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Product Images</h2>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Upload Images (Max 10 images)
                </label>
                <ImageUpload
                  bucket="product-images"
                  maxFiles={10}
                  onUploadComplete={(urls: string[]) => handleInputChange('images', urls)}
                  onUploadError={(err: string) => alert('Image upload error: ' + err)}
                />
                {newProduct.images && newProduct.images.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-4">
                    {newProduct.images.map((img, idx) => (
                      <div key={idx} className="relative">
                        <img
                          src={img}
                          alt={`Product ${idx + 1}`}
                          className="w-20 h-20 object-cover rounded border"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const newImages = newProduct.images.filter((_, i) => i !== idx);
                            handleInputChange('images', newImages);
                          }}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Video */}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Product Video</h2>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Video URL (YouTube, Vimeo, or direct video link)
                </label>
                <input
                  type="url"
                  value={newProduct.video_url}
                  onChange={(e) => handleInputChange('video_url', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="https://youtube.com/... or direct video link"
                />
                {newProduct.video_url && (
                  <div className="mt-4">
                    <video
                      src={newProduct.video_url}
                      controls
                      className="w-full max-w-md rounded border"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* API Integration */}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-6">API Integration (Optional)</h2>
              <div className="space-y-4">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="api-integration"
                    checked={newProduct.api_integration.enabled}
                    onChange={(e) => handleApiIntegrationChange('enabled', e.target.checked)}
                    className="mr-2"
                  />
                  <label htmlFor="api-integration" className="text-sm font-medium text-gray-700">
                    Enable API Integration (Printful, Printify, Shopify)
                  </label>
                </div>

                {newProduct.api_integration.enabled && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Provider
                      </label>
                      <select
                        value={newProduct.api_integration.provider}
                        onChange={(e) => handleApiIntegrationChange('provider', e.target.value as any)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      >
                        <option value="">Select provider</option>
                        <option value="printful">Printful</option>
                        <option value="printify">Printify</option>
                        <option value="shopify">Shopify</option>
                        <option value="custom">Custom API</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Product ID
                      </label>
                      <input
                        type="text"
                        value={newProduct.api_integration.product_id}
                        onChange={(e) => handleApiIntegrationChange('product_id', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                        placeholder="External product ID"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex justify-end space-x-4 pt-6 border-t">
              <button
                type="button"
                onClick={() => navigate('/seller/products')}
                className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-lg hover:from-orange-600 hover:to-red-600 transition-all duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Creating...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    <span>Create Product</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default SellerProductFormPage;
