import React, { useState, useEffect } from 'react';
import { X, Plus } from 'lucide-react';
import { useAuth } from '../contexts/AuthContextMultiRole';
import { supabase } from '../lib/supabase';
import PricingCalculator from './PricingCalculator';
import ImageUpload from './ImageUpload';
import ImageGallery from './ImageGallery';
import { PricingBreakdown } from '../lib/pricing';
import { useNavigate } from 'react-router-dom';

interface ProductFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
  editMode?: boolean;
  product?: {
    title: string;
    description: string;
    images: string[];
    category_id: string;
    stock_quantity: number;
    is_subscription: boolean;
    subscription_interval: string;
    requires_shipping: boolean;
  };
}

const ProductForm: React.FC<ProductFormProps> = ({ onSuccess, onCancel, editMode, product }) => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pricingBreakdown, setPricingBreakdown] = useState<PricingBreakdown | null>(null);

  const [formData, setFormData] = useState({
    title: product?.title || '',
    description: product?.description || '',
    images: product?.images || [],
    videos: [] as string[],
    tags: [] as string[],
    category_id: product?.category_id || '',
    stock_quantity: product?.stock_quantity || 1,
    is_subscription: product?.is_subscription || false,
    subscription_interval: product?.subscription_interval || '',
    affiliate_enabled: true, // DEFAULT TO TRUE - Business preference
    shipping_options: [
      { name: 'Standard Shipping', cost: 0, estimated_days: '3-5 business days' },
      { name: 'Express Shipping', cost: 0, estimated_days: '1-2 business days' },
      { name: 'Free Shipping', cost: 0, estimated_days: '5-7 business days' }
    ] as Array<{ name: string; cost: number; estimated_days: string }>,
    requires_shipping: product?.requires_shipping !== false,
  });

  const [productImages, setProductImages] = useState<any[]>([]);
  const [currentProductId, setCurrentProductId] = useState<string | null>(null);

  // Load product for editing
  React.useEffect(() => {
    if (editMode) {
      const url = window.location.pathname;
      const match = url.match(/\/edit\/([\w-]+)/);
      const productId = match ? match[1] : null;
      if (productId) {
        setCurrentProductId(productId);
        (async () => {
          try {
            // Load product data
            const { data } = await supabase.from('products').select('*').eq('id', productId).single();
            if (data) {
              setFormData({
                title: data.title,
                description: data.description,
                images: data.images || [],
                videos: data.videos || [],
                tags: data.tags || [],
                category_id: data.category_id || '',
                stock_quantity: data.stock_quantity || 1,
                is_subscription: data.is_subscription || false,
                subscription_interval: data.subscription_interval || '',
                affiliate_enabled: data.affiliate_enabled !== false, // Default to true if not set
                shipping_options: data.shipping_options || [
                  { name: 'Standard Shipping', cost: 0, estimated_days: '3-5 business days' },
                  { name: 'Express Shipping', cost: 0, estimated_days: '1-2 business days' },
                  { name: 'Free Shipping', cost: 0, estimated_days: '5-7 business days' }
                ],
                requires_shipping: data.requires_shipping !== false,
              });
              setPricingBreakdown({
                sellerAmount: data.seller_amount,
                affiliateAmount: data.flat_commission_amount || 0,
                platformFee: data.platform_fee,
                stripeFee: data.stripe_fee,
                listingPrice: data.price,
                affiliateRate: data.commission_rate,
                affiliateType: data.commission_type,
              });
            }
          } catch (error) {
            console.error('Error loading product data:', error);
          }
        })();
      }
    }
  }, [editMode]);

  const [newTag, setNewTag] = useState('');

  // Default categories as fallback
  const defaultCategories = [
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
  ];

  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>(defaultCategories);

  // Debug: Log categories when they change
  useEffect(() => {
    console.log('📦 Categories state updated:', categories.length, 'categories');
    console.log('Categories:', categories);
  }, [categories]);

  useEffect(() => {
    // Try to load from database, but keep defaults if it fails
    (async () => {
      try {
        const { data, error } = await supabase.from('categories').select('id, name').order('sort_order', { ascending: true });
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'stock_quantity' ? parseInt(value) || 0 : value,
    }));
  };

  const addTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, newTag.trim()],
      }));
      setNewTag('');
    }
  };

  const removeTag = (index: number) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter((_, i) => i !== index),
    }));
  };

  const handleImageUploadSuccess = (uploadedImages: string[]) => {
    if (!uploadedImages || uploadedImages.length === 0) {
      return;
    }

    setFormData(prev => {
      const newImages = uploadedImages.filter(url => url && !prev.images.includes(url));
      if (newImages.length === 0) {
        return prev;
      }
      return {
        ...prev,
        images: [...prev.images, ...newImages],
      };
    });

    if (currentProductId) {
      // For editing mode, allow gallery refresh while Supabase metadata catches up
      setProductImages(prev => [...prev, ...uploadedImages]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      setError('You must be logged in to create a product');
      return;
    }

    const sellerProfileId = profile?.id;
    if (!sellerProfileId) {
      setError('We could not find your seller profile. Please refresh or complete your profile.');
      return;
    }

    if (!pricingBreakdown) {
      setError('Please configure your pricing first');
      return;
    }

    // Validate shipping configuration
    if (formData.requires_shipping) {
      if (!formData.shipping_options || formData.shipping_options.length === 0) {
        setError('Please add at least one shipping option');
        return;
      }

      // Check that all shipping options have required fields
      for (const option of formData.shipping_options) {
        if (!option.name.trim()) {
          setError('All shipping options must have a name');
          return;
        }
        if (!option.estimated_days.trim()) {
          setError('All shipping options must have estimated delivery time');
          return;
        }
        if (option.cost < 0) {
          setError('Shipping costs cannot be negative');
          return;
        }
      }
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (editMode) {
        // Update product
        const url = window.location.pathname;
        const match = url.match(/\/edit\/(\w+)/);
        const productId = match ? match[1] : null;
        const { error } = await supabase
          .from('products')
          .update({
            title: formData.title,
            description: formData.description,
            price: pricingBreakdown.listingPrice,
            commission_rate: pricingBreakdown.affiliateRate,
            commission_type: pricingBreakdown.affiliateType,
            flat_commission_amount: pricingBreakdown.affiliateType === 'flat_rate' ? pricingBreakdown.affiliateAmount : 0,
            images: formData.images,
            videos: formData.videos,
            tags: formData.tags,
            category_id: formData.category_id || null,
            stock_quantity: formData.stock_quantity,
            is_subscription: formData.is_subscription,
            subscription_interval: formData.is_subscription ? formData.subscription_interval : null,
            seller_amount: pricingBreakdown.sellerAmount,
            platform_fee: pricingBreakdown.platformFee,
            stripe_fee: pricingBreakdown.stripeFee,
            shipping_options: formData.shipping_options,
            requires_shipping: formData.requires_shipping,
            affiliate_enabled: formData.affiliate_enabled,
            status: formData.affiliate_enabled ? 'active' : 'store_only',
          })
          .eq('id', productId)
          .select()
          .single();
        if (error) throw error;
      } else {
        // Create product
        const { data: newProduct, error } = await supabase
          .from('products')
          .insert([{
            title: formData.title,
            description: formData.description,
            price: pricingBreakdown.listingPrice,
            commission_rate: pricingBreakdown.affiliateRate,
            commission_type: pricingBreakdown.affiliateType,
            flat_commission_amount: pricingBreakdown.affiliateType === 'flat_rate' ? pricingBreakdown.affiliateAmount : 0,
            images: formData.images,
            videos: formData.videos,
            tags: formData.tags,
            category_id: formData.category_id || null,
            stock_quantity: formData.stock_quantity,
            is_subscription: formData.is_subscription,
            subscription_interval: formData.is_subscription ? formData.subscription_interval : null,
            seller_amount: pricingBreakdown.sellerAmount,
            platform_fee: pricingBreakdown.platformFee,
            stripe_fee: pricingBreakdown.stripeFee,
            seller_id: sellerProfileId,
            shipping_options: formData.shipping_options,
            requires_shipping: formData.requires_shipping,
            affiliate_enabled: formData.affiliate_enabled,
            status: formData.affiliate_enabled ? 'active' : 'store_only',  // Business logic: marketplace vs store-only
            is_active: true     // ✅ Always visible in seller's store
          }])
          .select()
          .single();
        
        if (error) throw error;
        
        // Set the product ID for image uploads
        if (newProduct?.id) {
          setCurrentProductId(newProduct.id);
        }
      }

      setSuccess('Product created successfully!');
      
      // Reset form
      setFormData({
        title: '',
        description: '',
        images: [],
        videos: [],
        tags: [],
        category_id: '',
        stock_quantity: 1,
        is_subscription: false,
        subscription_interval: '',
        affiliate_enabled: true, // DEFAULT TO TRUE - Business preference
        shipping_options: [
          { name: 'Standard Shipping', cost: 0, estimated_days: '3-5 business days' },
          { name: 'Express Shipping', cost: 0, estimated_days: '1-2 business days' },
          { name: 'Free Shipping', cost: 0, estimated_days: '5-7 business days' }
        ],
        requires_shipping: true,
      });
      setPricingBreakdown(null);

      setTimeout(() => {
        if (onSuccess) {
          onSuccess();
        } else {
          navigate('/dashboard');
        }
      }, 2000);

    } catch (err: any) {
      console.error('Error creating product:', err);
      setError(err.message || 'Failed to create product');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8 bg-bzo-gradient min-h-screen">
      <div className="text-center">
        <div className="flex justify-center mb-4">
          <div className="bzo-mascot">
            <img src="/bee-mascot.png" alt="BZO Bee" className="w-12 h-12" />
          </div>
        </div>
        <h1 className="text-4xl font-bold text-bzo-black mb-2">Add New Product</h1>
        <p className="text-gray-600">Set your desired profit and we'll calculate the final price with BZO</p>
      </div>

      {error && (
        <div className="bg-error-light border-2 border-error text-error px-6 py-4 rounded-xl card-bzo">
          <div className="flex items-center gap-2">
            <span className="text-xl">⚠️</span>
            <span className="font-medium">{error}</span>
          </div>
        </div>
      )}

      {success && (
        <div className="bg-success-light border-2 border-success text-success px-6 py-4 rounded-xl card-bzo">
          <div className="flex items-center gap-2">
            <span className="text-xl">✅</span>
            <span className="font-medium">{success}</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Product Details Form */}
        <div className="card-bzo p-8">
          <h2 className="text-2xl font-bold text-bzo-black mb-6 flex items-center gap-2">
            <span className="text-2xl">📝</span>
            Product Details
          </h2>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-bzo-black mb-3">
                Product Title *
              </label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                required
                className="input-bzo w-full"
                placeholder="Enter your amazing product title"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-bzo-black mb-3">
                Description
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                rows={4}
                className="input-bzo w-full resize-none"
                placeholder="Tell buyers why they'll love this product"
              />
            </div>

            {/* Product Images - Upload Section */}
            <div>
              <label className="block text-sm font-semibold text-bzo-black mb-4 flex items-center gap-2">
                <span className="text-lg">📸</span>
                Product Images
              </label>

              {/* Image Gallery for existing products */}
              {currentProductId && productImages.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-sm font-medium text-gray-700 mb-3">Current Images</h4>
                  <ImageGallery
                    productId={currentProductId}
                    images={productImages}
                    onImagesChange={setProductImages}
                    canEdit={true}
                  />
                </div>
              )}

              <ImageUpload
                bucket="product-images"
                folder={currentProductId ? `products/${currentProductId}` : 'new-products'}
                productId={currentProductId ?? undefined}
                onUploadComplete={handleImageUploadSuccess}
                maxFiles={10}
                allowedTypes={['image/jpeg', 'image/png', 'image/webp']}
              />
              {!currentProductId && (
                <p className="mt-3 text-xs text-gray-500">
                  Images are immediately stored and will be ready when you save the product.
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-bzo-black mb-3 flex items-center gap-2">
                <span className="text-lg">🏷️</span>
                Category *
              </label>
              <select
                name="category_id"
                value={formData.category_id}
                onChange={handleInputChange}
                required
                className="input-bzo w-full"
              >
                <option value="">Select a category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Affiliate Preference - KEY BUSINESS MODEL CHOICE */}
            <div className="bg-gradient-to-r from-bzo-yellow-light to-bzo-white rounded-xl p-6 border-2 border-bzo-yellow-primary shadow-lg">
              <label className="block text-sm font-semibold text-bzo-black mb-4 flex items-center gap-2">
                <span className="text-2xl">🤝</span>
                Do you want affiliates to promote this product? *
              </label>
              <p className="text-sm text-gray-600 mb-6">
                <strong>Recommended:</strong> Let affiliates help you sell for bigger reach and more sales. You set the commission rate.
              </p>
              
              <div className="space-y-4">
                {/* Affiliate Enabled - PREFERRED/DEFAULT */}
                <label className="flex items-start space-x-4 p-6 bg-gradient-to-r from-bzo-yellow-primary/20 to-bzo-yellow-secondary/20 rounded-xl border-3 border-bzo-yellow-primary cursor-pointer hover:shadow-md transition-all duration-200">
                  <input
                    type="radio"
                    name="affiliate_enabled"
                    value="yes"
                    checked={formData.affiliate_enabled === true}
                    onChange={() => setFormData(prev => ({ ...prev, affiliate_enabled: true }))}
                    className="mt-1 text-bzo-yellow-primary focus:ring-bzo-yellow-primary scale-125"
                  />
                  <div className="flex-1">
                    <div className="font-bold text-bzo-black text-lg flex items-center gap-2">
                      🚀 YES - Enable Affiliates (Recommended)
                      <span className="bg-bzo-yellow-primary text-bzo-black px-3 py-1 rounded-full text-xs font-bold">POPULAR</span>
                    </div>
                    <div className="text-sm text-gray-700 mt-2">
                      • Product appears in <strong>marketplace</strong> for affiliates to discover<br/>
                      • Affiliates can add to their custom stores with one click<br/>
                      • <strong>Bigger reach = more sales</strong> with zero marketing effort<br/>
                      • You set the commission rate (we recommend 20-30%)
                    </div>
                  </div>
                </label>

                {/* No Affiliates - Shopify-like */}
                <label className="flex items-start space-x-4 p-6 bg-white rounded-xl border-2 border-gray-300 cursor-pointer hover:border-gray-400 hover:shadow-md transition-all duration-200">
                  <input
                    type="radio"
                    name="affiliate_enabled"
                    value="no"
                    checked={formData.affiliate_enabled === false}
                    onChange={() => setFormData(prev => ({ ...prev, affiliate_enabled: false }))}
                    className="mt-1 text-gray-400 focus:ring-gray-400 scale-125"
                  />
                  <div className="flex-1">
                    <div className="font-bold text-gray-700 text-lg">
                      🏪 NO - Just My Store (Shopify-style)
                    </div>
                    <div className="text-sm text-gray-600 mt-2">
                      • Product only appears in <strong>your custom store</strong><br/>
                      • You handle all marketing and promotion yourself<br/>
                      • Still uses Beezio secure checkout system<br/>
                      • You can get a custom domain for your store
                    </div>
                  </div>
                </label>
              </div>

              <div className="mt-4 p-4 bg-bzo-yellow-primary/10 rounded-lg border border-bzo-yellow-primary/30">
                <p className="text-xs text-gray-700">
                  <strong>💡 Beezio Tip:</strong> Most successful sellers use affiliates to 3x their sales volume. You can always change this later in your dashboard.
                </p>
              </div>
            </div>

            {/* Sale Type - Clear and Simple */}
            <div className="bg-bzo-yellow-light rounded-xl p-6 border-2 border-bzo-yellow-primary/30">
              <label className="block text-sm font-semibold text-bzo-black mb-4 flex items-center gap-2">
                <span className="text-lg">💡</span>
                How do you want to sell this product? *
              </label>
              
              <div className="space-y-3">
                {/* One-Time Purchase Option */}
                <label className="flex items-start space-x-3 p-4 bg-bzo-white rounded-xl border-2 border-gray-200 cursor-pointer hover:border-bzo-yellow-primary hover:bg-bzo-yellow-light/50 transition-all duration-200">
                  <input
                    type="radio"
                    name="sale_type"
                    value="one-time"
                    checked={!formData.is_subscription}
                    onChange={() => setFormData(prev => ({ 
                      ...prev, 
                      is_subscription: false,
                      subscription_interval: ''
                    }))}
                    className="mt-1 text-bzo-yellow-primary focus:ring-bzo-yellow-primary"
                  />
                  <div>
                    <div className="font-semibold text-bzo-black">
                      💰 One-Time Purchase (Recommended)
                    </div>
                    <div className="text-sm text-gray-600">
                      Customer pays once and owns the product forever. Best for physical items, digital downloads, courses, etc.
                    </div>
                  </div>
                </label>

                {/* Subscription Option */}
                <label className="flex items-start space-x-3 p-3 bg-white rounded-lg border border-gray-200 cursor-pointer hover:bg-green-50 hover:border-green-300 transition-colors">
                  <input
                    type="radio"
                    name="sale_type"
                    value="subscription"
                    checked={formData.is_subscription}
                    onChange={() => setFormData(prev => ({ 
                      ...prev, 
                      is_subscription: true,
                      subscription_interval: 'monthly'
                    }))}
                    className="mt-1 text-green-500 focus:ring-green-500"
                  />
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">
                      🔄 Recurring Subscription (Advanced)
                    </div>
                    <div className="text-sm text-gray-600 mb-2">
                      Customer pays regularly to maintain access. Best for software, memberships, ongoing services.
                    </div>
                    
                    {/* Subscription Interval (only shown when subscription is selected) */}
                    {formData.is_subscription && (
                      <div className="mt-3 pl-2 border-l-2 border-green-200">
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          How often should customers be charged?
                        </label>
                        <select
                          name="subscription_interval"
                          value={formData.subscription_interval}
                          onChange={handleInputChange}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
                        >
                          <option value="monthly">Monthly - Every month</option>
                          <option value="yearly">Yearly - Every year (better value)</option>
                          <option value="weekly">Weekly - Every week</option>
                        </select>
                        <div className="text-xs text-gray-500 mt-1">
                          💡 Tip: Yearly subscriptions typically offer better value for customers
                        </div>
                      </div>
                    )}
                  </div>
                </label>
              </div>

              {/* Help text */}
              <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <div className="text-xs text-blue-800">
                  <strong>🤔 Not sure which to choose?</strong><br/>
                  • <strong>One-Time Purchase:</strong> Best for 90% of products (physical items, digital downloads, courses)<br/>
                  • <strong>Subscription:</strong> Only for ongoing services (software access, monthly boxes, memberships)
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Stock Quantity
              </label>
              <input
                type="number"
                name="stock_quantity"
                value={formData.stock_quantity}
                onChange={handleInputChange}
                min="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            {/* Product Type Selection */}
            <div className="bg-gray-50 p-4 rounded-lg border">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                💳 How will customers pay for this product?
              </label>
              
              <div className="space-y-3">
                {/* One-time purchase option */}
                <label className="flex items-start space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-white transition-colors">
                  <input
                    type="radio"
                    name="payment_type"
                    checked={!formData.is_subscription}
                    onChange={() => setFormData(prev => ({ ...prev, is_subscription: false, subscription_interval: '' }))}
                    className="mt-1 form-radio h-4 w-4 text-amber-600"
                  />
                  <div>
                    <span className="font-medium text-gray-900">🛒 One-time purchase</span>
                    <p className="text-sm text-gray-600 mt-1">Customer pays once and owns the product forever</p>
                    <p className="text-xs text-green-600 mt-1">✓ Most common choice for physical products, digital downloads, courses</p>
                  </div>
                </label>

                {/* Subscription option */}
                <label className="flex items-start space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-white transition-colors">
                  <input
                    type="radio"
                    name="payment_type"
                    checked={formData.is_subscription}
                    onChange={() => setFormData(prev => ({ ...prev, is_subscription: true, subscription_interval: 'monthly' }))}
                    className="mt-1 form-radio h-4 w-4 text-amber-600"
                  />
                  <div className="flex-1">
                    <span className="font-medium text-gray-900">🔄 Recurring subscription</span>
                    <p className="text-sm text-gray-600 mt-1">Customer pays regularly for ongoing access or deliveries</p>
                    <p className="text-xs text-blue-600 mt-1">✓ Great for services, memberships, software, monthly boxes</p>
                    
                    {formData.is_subscription && (
                      <div className="mt-3 ml-4">
                        <label className="block text-xs font-medium text-gray-700 mb-1">How often will customers be charged?</label>
                        <select
                          name="subscription_interval"
                          value={formData.subscription_interval}
                          onChange={e => setFormData(prev => ({ ...prev, subscription_interval: e.target.value }))}
                          className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
                        >
                          <option value="monthly">Monthly ($XX/month)</option>
                          <option value="weekly">Weekly ($XX/week)</option>
                          <option value="yearly">Yearly ($XX/year)</option>
                        </select>
                      </div>
                    )}
                  </div>
                </label>
              </div>
              
              <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                <p className="text-xs text-blue-700">
                  <strong>💡 Not sure which to choose?</strong> Most sellers choose "One-time purchase" for physical products, digital downloads, and courses. Choose "Subscription" only if you want customers to pay monthly/weekly for ongoing access or regular deliveries.
                </p>
              </div>
            </div>

            {/* Shipping Configuration */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Shipping Configuration
              </label>
              
              <div className="mb-4">
                <label className="inline-flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.requires_shipping}
                    onChange={e => setFormData(prev => ({ ...prev, requires_shipping: e.target.checked }))}
                    className="form-checkbox h-5 w-5 text-amber-600"
                  />
                  <span className="ml-2 text-gray-700">This product requires shipping</span>
                </label>
                <p className="text-xs text-gray-500 mt-1">Uncheck for digital products that don't need shipping</p>
              </div>

              {formData.requires_shipping && (
                <div className="border border-gray-200 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-3">Shipping Options</h4>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                    <p className="text-xs text-blue-700 font-medium mb-1">💡 Shipping Setup Guide:</p>
                    <ul className="text-xs text-blue-600 space-y-1">
                      <li>• Set cost to $0.00 for FREE SHIPPING options</li>
                      <li>• These costs are added at checkout - NOT to your product price</li>
                      <li>• Create multiple options (Standard, Express, Free) to give buyers choice</li>
                      <li>• Free shipping can increase conversion rates by 40%+</li>
                    </ul>
                  </div>
                  
                  {formData.shipping_options.map((option, index) => (
                    <div key={index} className="bg-gray-50 p-3 rounded-lg mb-3">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Shipping Method *
                          </label>
                          <input
                            type="text"
                            value={option.name}
                            onChange={(e) => {
                              const newOptions = [...formData.shipping_options];
                              newOptions[index].name = e.target.value;
                              setFormData(prev => ({ ...prev, shipping_options: newOptions }));
                            }}
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-amber-500"
                            placeholder="e.g., Standard Shipping"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Cost ($) * {option.cost === 0 && <span className="text-green-600 font-bold">FREE SHIPPING</span>}
                          </label>
                          <div className="relative">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={option.cost}
                              onChange={(e) => {
                                const newOptions = [...formData.shipping_options];
                                newOptions[index].cost = parseFloat(e.target.value) || 0;
                                setFormData(prev => ({ ...prev, shipping_options: newOptions }));
                              }}
                              className={`w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                                option.cost === 0 
                                  ? 'border-green-300 bg-green-50 text-green-700' 
                                  : 'border-gray-300'
                              }`}
                              placeholder="0.00 for FREE shipping"
                            />
                            {option.cost === 0 && (
                              <div className="absolute right-2 top-1 text-xs text-green-600 font-bold">
                                FREE
                              </div>
                            )}
                          </div>
                          <p className="text-xs text-gray-400 mt-1">
                            {option.cost === 0 ? 'This is FREE shipping!' : 'Added to checkout total'}
                          </p>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Estimated Delivery *
                          </label>
                          <div className="flex">
                            <input
                              type="text"
                              value={option.estimated_days}
                              onChange={(e) => {
                                const newOptions = [...formData.shipping_options];
                                newOptions[index].estimated_days = e.target.value;
                                setFormData(prev => ({ ...prev, shipping_options: newOptions }));
                              }}
                              className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded-l focus:outline-none focus:ring-2 focus:ring-amber-500"
                              placeholder="3-5 business days"
                            />
                            {formData.shipping_options.length > 1 && (
                              <button
                                type="button"
                                onClick={() => {
                                  const newOptions = formData.shipping_options.filter((_, i) => i !== index);
                                  setFormData(prev => ({ ...prev, shipping_options: newOptions }));
                                }}
                                className="px-2 py-1 bg-red-500 text-white rounded-r hover:bg-red-600 transition-colors"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  <div className="flex flex-wrap gap-2 mb-4">
                    <button
                      type="button"
                      onClick={() => {
                        setFormData(prev => ({
                          ...prev,
                          shipping_options: [
                            { name: 'Free Shipping', cost: 0, estimated_days: '5-7 business days' },
                            { name: 'Standard Shipping', cost: 5.99, estimated_days: '3-5 business days' },
                            { name: 'Express Shipping', cost: 12.99, estimated_days: '1-2 business days' }
                          ]
                        }));
                      }}
                      className="px-3 py-1 text-xs bg-green-100 text-green-700 rounded-md hover:bg-green-200 transition-colors border border-green-300"
                    >
                      📦 Quick Setup: Free + Paid Options
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setFormData(prev => ({
                          ...prev,
                          shipping_options: [
                            { name: 'Free Shipping', cost: 0, estimated_days: '5-7 business days' }
                          ]
                        }));
                      }}
                      className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors border border-blue-300"
                    >
                      🚚 Free Shipping Only
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setFormData(prev => ({
                          ...prev,
                          shipping_options: [
                            { name: 'Standard Shipping', cost: 5.99, estimated_days: '3-5 business days' },
                            { name: 'Express Shipping', cost: 12.99, estimated_days: '1-2 business days' }
                          ]
                        }));
                      }}
                      className="px-3 py-1 text-xs bg-amber-100 text-amber-700 rounded-md hover:bg-amber-200 transition-colors border border-amber-300"
                    >
                      ⚡ Paid Shipping Only
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setFormData(prev => ({
                        ...prev,
                        shipping_options: [
                          ...prev.shipping_options,
                          { name: 'New Shipping Option', cost: 0, estimated_days: '3-5 business days' }
                        ]
                      }));
                    }}
                    className="flex items-center text-sm text-amber-600 hover:text-amber-700 transition-colors mb-4"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Another Shipping Option
                  </button>
                </div>
              )}
            </div>

            {/* Tags */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tags
              </label>
              <div className="flex space-x-2 mb-2">
                <input
                  type="text"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  placeholder="Add a tag"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                />
                <button
                  type="button"
                  onClick={addTag}
                  className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              
              <div className="flex flex-wrap gap-2">
                {formData.tags.map((tag, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center space-x-1 bg-amber-100 text-amber-800 px-2 py-1 rounded-full text-sm"
                  >
                    <span>{tag}</span>
                    <button
                      type="button"
                      onClick={() => removeTag(index)}
                      className="text-amber-600 hover:text-amber-800"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>

            <div className="flex space-x-4 pt-6">
              <button
                type="submit"
                disabled={loading || !pricingBreakdown}
                className="flex-1 btn-bzo-primary py-4 px-6 rounded-full text-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-bzo-black/30 border-t-bzo-black rounded-full animate-spin"></div>
                    Creating Product...
                  </>
                ) : (
                  <>
                    🚀 Create Product
                  </>
                )}
              </button>
              
              {onCancel ? (
                <button
                  type="button"
                  onClick={onCancel}
                  className="btn-bzo-secondary px-8 py-4 rounded-full font-semibold"
                >
                  Cancel
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => navigate('/dashboard')}
                  className="btn-bzo-outline px-8 py-4 rounded-full font-semibold"
                >
                  ← Back to Dashboard
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Pricing Calculator */}
        <div>
          <PricingCalculator
            onPricingChange={setPricingBreakdown}
            initialSellerAmount={100}
            initialAffiliateRate={20}
            initialAffiliateType="percentage"
          />
        </div>
      </div>
    </div>
  );
};

export default ProductForm;