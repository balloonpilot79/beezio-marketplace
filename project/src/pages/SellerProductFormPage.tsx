import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload, X, Save, Image as ImageIcon } from 'lucide-react';
import { useAuth } from '../contexts/AuthContextMultiRole';
import { supabase } from '../lib/supabase';
import ImageUpload from '../components/ImageUpload';

const SellerProductFormPage: React.FC = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [newProduct, setNewProduct] = useState({
    title: '',
    description: '',
    price: 0,
    category_id: '',
    product_type: 'one_time' as 'one_time' | 'subscription',
    subscription_interval: 'monthly' as 'monthly' | 'yearly',
    affiliate_commission_rate: 10,
    affiliate_commission_type: 'percentage' as 'percentage' | 'fixed',
    images: [] as string[],
    video_url: '',
    api_integration: {
      enabled: false,
      provider: '' as '' | 'printful' | 'printify' | 'shopify' | 'custom',
      product_id: '',
      webhook_url: ''
    }
  });

  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase.from('categories').select('id, name').order('sort_order', { ascending: true });
        if (error) {
          console.warn('Could not load categories:', error.message || error);
          return;
        }
        setCategories(data || []);
      } catch (e) {
        console.warn('Category fetch error:', e);
      }
    })();
  }, []);

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

    if (!newProduct.category_id) {
      alert('Please select a category.');
      return;
    }

    if (newProduct.price <= 0) {
      alert('Please enter a valid price.');
      return;
    }

    if (newProduct.affiliate_commission_rate <= 0) {
      alert('Please enter a valid commission rate.');
      return;
    }

    try {
      setLoading(true);

      const productData = {
        ...newProduct,
        category_id: newProduct.category_id || null,
        seller_id: profile.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_active: true,
        sales_count: 0,
        images: newProduct.images || [],
        video_url: newProduct.video_url || '',
        api_integration: newProduct.api_integration || {
          enabled: false,
          provider: '',
          product_id: '',
          webhook_url: ''
        }
      };

      console.log('Creating product:', productData);

      const { data, error } = await supabase
        .from('products')
        .insert([productData])
        .select()
        .single();

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      console.log('Product created successfully:', data);
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
                    Price ($) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={newProduct.price}
                    onChange={(e) => handleInputChange('price', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    required
                    placeholder="0.00"
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

            {/* Images */}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Product Images</h2>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Upload Images (Max 5 images)
                </label>
                <ImageUpload
                  bucket="product-images"
                  maxFiles={5}
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
