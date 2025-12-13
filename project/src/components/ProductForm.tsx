import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContextMultiRole';
import { supabase } from '../lib/supabase';
import PricingCalculator from './PricingCalculator';
import ImageUpload from './ImageUpload';
import ImageGallery from './ImageGallery';
import { PricingBreakdown } from '../lib/pricing';
import { callGPT } from '../lib/gptClient';
import { Wand2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { normalizeMoneyInput } from '../utils/pricing';

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
  const MAX_IMAGES = 6;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pricingBreakdown, setPricingBreakdown] = useState<PricingBreakdown | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

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
    shipping_price: product?.shipping_price ?? (product as any)?.shipping_cost ?? 0,
  });
  const resetForm = () => {
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
      affiliate_enabled: true,
      shipping_options: [
        { name: 'Standard Shipping', cost: 0, estimated_days: '3-5 business days' },
        { name: 'Express Shipping', cost: 0, estimated_days: '1-2 business days' },
        { name: 'Free Shipping', cost: 0, estimated_days: '5-7 business days' }
      ],
      requires_shipping: true,
      shipping_price: 0,
    });
    setPricingBreakdown(null);
    setProductImages([]);
  };

  const generateCopyWithAI = async () => {
    setAiLoading(true);
    try {
      const prompt = `Write a concise product title, 3 short bullet features, and 8-12 tags for an ecommerce listing. Return as JSON with keys title, bullets (array), tags (array). Use the details:\nTitle: ${formData.title}\nDescription: ${formData.description}\nCategory: ${formData.category_id || 'Uncategorized'}`;
      const reply = await callGPT({
        mode: 'product_copy',
        messages: [{ role: 'user', content: prompt }],
      });
      const parsed = JSON.parse(reply);
      if (parsed.title) handleInputChange('title', parsed.title);
      if (Array.isArray(parsed.bullets)) {
        handleInputChange('description', parsed.bullets.join(' • ') + (formData.description ? `\n\n${formData.description}` : ''));
      }
      if (Array.isArray(parsed.tags)) {
        setFormData(prev => ({ ...prev, tags: parsed.tags.map((t: any) => String(t)) }));
      }
    } catch (err: any) {
      alert(`AI copy generation failed: ${err.message || err}`);
    } finally {
      setAiLoading(false);
    }
  };

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
                shipping_price: data.shipping_price ?? data.shipping_cost ?? 0,
              });
              setPricingBreakdown({
                sellerAmount: data.seller_amount ?? data.seller_ask ?? data.seller_ask_price ?? 0,
                affiliateAmount: data.commission_type === 'flat_rate'
                  ? data.flat_commission_amount || data.affiliate_commission_value || 0
                  : (data.seller_amount ?? data.seller_ask ?? data.seller_ask_price ?? 0) * ((data.commission_rate || data.affiliate_commission_value || 0) / 100),
                platformFee: data.platform_fee,
                stripeFee: data.stripe_fee,
                listingPrice: data.price,
                affiliateRate: data.commission_type === 'flat_rate'
                  ? data.flat_commission_amount || data.affiliate_commission_value || 0
                  : data.commission_rate || data.affiliate_commission_value || 0,
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
      [name]:
        name === 'stock_quantity'
          ? parseInt(value) || 0
          : name === 'shipping_price'
            ? parseFloat(value) || 0
            : value,
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

    // Clear any prior image validation error when uploads succeed
    setError(null);

    setFormData(prev => {
      const newImages = uploadedImages.filter(url => url && !prev.images.includes(url));
      if (newImages.length === 0) {
        return prev;
      }

      const merged = [...prev.images, ...newImages];
      if (merged.length > MAX_IMAGES) {
        setError(`You can upload up to ${MAX_IMAGES} images per product`);
      }

      return {
        ...prev,
        images: merged.slice(0, MAX_IMAGES),
      };
    });

    if (currentProductId) {
      // For editing mode, allow gallery refresh while Supabase metadata catches up
      setProductImages(prev => {
        const merged = [...prev, ...uploadedImages];
        return merged.slice(0, MAX_IMAGES);
      });
    }
  };

  const removeImage = (index: number) => {
    setFormData(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
    }));
  };

  const ensureSellerProfileId = async (): Promise<string | null> => {
    if (profile?.id) {
      return profile.id;
    }
    if (!user) {
      return null;
    }

    try {
      const fullName =
        profile?.full_name ||
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        user.email ||
        'Seller';

      const { data, error } = await supabase
        .from('profiles')
        .upsert(
          {
            user_id: user.id,
            email: user.email,
            full_name: fullName,
            role: 'seller',
            primary_role: 'seller',
          },
          { onConflict: 'user_id', returning: 'representation' }
        );

      if (error) {
        console.error('Unable to create seller profile for user:', error);
        return null;
      }

      return data?.[0]?.id || null;
    } catch (error) {
      console.error('Unexpected error while ensuring seller profile:', error);
      return null;
    }
  };

  async function handleSubmit(e?: React.FormEvent, addAnother: boolean = false) {
    if (e) e.preventDefault();
    
    if (!user) {
      setError('You must be logged in to create a product');
      return;
    }

    let sellerProfileId = profile?.id;
    if (!sellerProfileId) {
      sellerProfileId = await ensureSellerProfileId();
      if (!sellerProfileId) {
        setError('We could not find your seller profile. Please refresh or complete your profile.');
        return;
      }
    }

    if (!pricingBreakdown) {
      setError('Please configure your pricing first');
      return;
    }
    if (!formData.title.trim()) {
      setError('Please add a product title');
      return;
    }
    if (!formData.description.trim()) {
      setError('Please add a product description');
      return;
    }
    if (!formData.category_id) {
      setError('Please select a category');
      return;
    }
    if (!formData.images || formData.images.length === 0) {
      setError('Please upload at least one product image');
      return;
    }
    if (formData.images.length > MAX_IMAGES) {
      setError(`Please keep product images to ${MAX_IMAGES} or fewer`);
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

    if (formData.shipping_price < 0) {
      setError('Shipping price cannot be negative');
      return;
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
            commission_rate: pricingBreakdown.affiliateType === 'percentage' ? pricingBreakdown.affiliateRate : 0,
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
            seller_ask: pricingBreakdown.sellerAmount,
            seller_ask_price: pricingBreakdown.sellerAmount,
            platform_fee: pricingBreakdown.platformFee,
            stripe_fee: pricingBreakdown.stripeFee,
            shipping_options: formData.shipping_options,
            requires_shipping: formData.requires_shipping,
            shipping_price: formData.shipping_price ?? 0,
            shipping_cost: formData.shipping_price ?? 0,
            affiliate_enabled: formData.affiliate_enabled,
            affiliate_commission_type: pricingBreakdown.affiliateType === 'flat_rate' ? 'flat' : 'percent',
            affiliate_commission_value: pricingBreakdown.affiliateRate,
            calculated_customer_price: pricingBreakdown.listingPrice,
            status: formData.affiliate_enabled ? 'active' : 'store_only',
            is_promotable: formData.affiliate_enabled,
            is_active: true,
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
            commission_rate: pricingBreakdown.affiliateType === 'percentage' ? pricingBreakdown.affiliateRate : 0,
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
            seller_ask: pricingBreakdown.sellerAmount,
            seller_ask_price: pricingBreakdown.sellerAmount,
            platform_fee: pricingBreakdown.platformFee,
            stripe_fee: pricingBreakdown.stripeFee,
            seller_id: sellerProfileId,
            shipping_options: formData.shipping_options,
            requires_shipping: formData.requires_shipping,
            shipping_price: formData.shipping_price ?? 0,
            shipping_cost: formData.shipping_price ?? 0,
            affiliate_enabled: formData.affiliate_enabled,
            affiliate_commission_type: pricingBreakdown.affiliateType === 'flat_rate' ? 'flat' : 'percent',
            affiliate_commission_value: pricingBreakdown.affiliateRate,
            calculated_customer_price: pricingBreakdown.listingPrice,
            status: formData.affiliate_enabled ? 'active' : 'store_only',  // Business logic: marketplace vs store-only
            is_promotable: formData.affiliate_enabled,
            is_active: true     // Always visible in seller's store
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
      setError(null);

      setTimeout(() => {
        if (addAnother) {
          resetForm();
        } else if (onSuccess) {
          onSuccess();
        } else {
          navigate('/dashboard');
        }
      }, 1200);

    } catch (err: any) {
      console.error('Error creating product:', err);
      setError(err.message || 'Failed to create product');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Clean Header */}
      <div className="bg-[#ffcc00] border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <h1 className="text-2xl font-bold text-black">Add New Product</h1>
                <p className="text-sm text-gray-700">Fill out the information below</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleSubmit(undefined, true)}
                  disabled={loading}
                  className="bg-white border border-gray-300 text-gray-900 px-5 py-2.5 rounded-lg font-semibold hover:bg-gray-50 disabled:bg-gray-200 transition-all"
                >
                  {loading ? 'Saving...' : 'Save & Add Another'}
                </button>
                <button
                  onClick={() => handleSubmit()}
                  disabled={loading}
                  className="bg-black hover:bg-gray-800 disabled:bg-gray-400 text-white px-6 py-2.5 rounded-lg font-semibold shadow-md hover:shadow-lg transition-all duration-200"
                >
                  {loading ? 'Saving...' : editMode ? 'Update Product' : 'Save Product'}
                </button>
              </div>
            </div>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="max-w-3xl mx-auto px-6 pt-6">
          <div className="bg-red-50 border-2 border-red-500 text-red-700 px-6 py-4 rounded-lg">
            ⚠️ {error}
          </div>
        </div>
      )}

      {success && (
        <div className="max-w-3xl mx-auto px-6 pt-6">
          <div className="bg-green-50 border-2 border-green-500 text-green-700 px-6 py-4 rounded-lg">
            ✅ {success}
          </div>
        </div>
      )}

      {/* Main Form - Single Column */}
      <div className="max-w-3xl mx-auto px-6 py-8">
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 space-y-6">
          
          {/* Product Title */}
          <div>
            <label className="block text-sm font-bold text-gray-900 mb-2">
              Product Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              required
              placeholder="e.g., Wireless Headphones"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-[#ffcc00] focus:ring-2 focus:ring-[#ffcc00]/20"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-bold text-gray-900 mb-2">
              Description
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              rows={4}
              placeholder="Describe your product features and benefits..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-[#ffcc00] focus:ring-2 focus:ring-[#ffcc00]/20 resize-none"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-bold text-gray-900 mb-2">
              Category <span className="text-red-500">*</span>
            </label>
            <select
              name="category_id"
              value={formData.category_id}
              onChange={handleInputChange}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-[#ffcc00] focus:ring-2 focus:ring-[#ffcc00]/20"
            >
              <option value="">Select a category...</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Stock Quantity */}
          <div>
            <label className="block text-sm font-bold text-gray-900 mb-2">
              Stock Quantity
            </label>
            <input
              type="number"
              name="stock_quantity"
              value={formData.stock_quantity}
              onChange={handleInputChange}
              min="0"
              placeholder="1"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-[#ffcc00] focus:ring-2 focus:ring-[#ffcc00]/20"
            />
          </div>

          {/* Product Images */}
          <div>
            <label className="block text-sm font-bold text-gray-900 mb-3">
              Product Images
            </label>
            
            {currentProductId && productImages.length > 0 && (
              <div className="mb-4">
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
              folder="product-form"
              onUploadComplete={handleImageUploadSuccess}
              onUploadError={(message) => setError(message || 'Image upload failed')}
              maxFiles={MAX_IMAGES}
              maxFileSize={10}
            />

            {formData.images.length > 0 && (
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
                {formData.images.map((img, idx) => (
                  <div key={`${img}-${idx}`} className="relative group">
                    <img
                      src={img}
                      alt={`Product ${idx + 1}`}
                      className="w-full h-32 object-cover rounded-lg border border-gray-200"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(idx)}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm opacity-0 group-hover:opacity-100 transition-opacity"
                      aria-label={`Remove image ${idx + 1}`}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pricing Calculator */}
          <div className="border-t border-gray-200 pt-6">
            <label className="block text-sm font-bold text-gray-900 mb-3">
              Pricing <span className="text-red-500">*</span>
            </label>
            <PricingCalculator
              onPricingChange={(breakdown) => setPricingBreakdown(breakdown)}
            />
          </div>

          {/* Shipping Price */}
          <div className="border-t border-gray-200 pt-6">
            <label className="block text-sm font-bold text-gray-900 mb-2">
              Shipping Price
            </label>
            <input
              type="number"
              name="shipping_price"
              min="0"
              step="0.01"
              value={formData.shipping_price}
              onChange={handleInputChange}
              onBlur={(e) =>
                setFormData(prev => ({
                  ...prev,
                  shipping_price: parseFloat(normalizeMoneyInput(e.target.value)) || 0
                }))
              }
              placeholder="4.99"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-[#ffcc00] focus:ring-2 focus:ring-[#ffcc00]/20"
            />
            <p className="text-xs text-gray-600 mt-2">
              This is the shipping cost the customer pays. It is not used to calculate affiliate or Beezio fees.
            </p>
          </div>

          {/* Affiliate Marketing Toggle */}
          <div className="border-t border-gray-200 pt-6">
            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={formData.affiliate_enabled}
                onChange={(e) => setFormData(prev => ({ ...prev, affiliate_enabled: e.target.checked }))}
                className="mt-1 w-5 h-5 text-[#ffcc00] border-gray-300 rounded focus:ring-[#ffcc00]"
              />
              <div>
                <div className="font-bold text-gray-900 group-hover:text-[#ffcc00] transition-colors">
                  Enable affiliate marketing for this product
                </div>
                <div className="text-sm text-gray-600 mt-1">
                  Allow affiliates to promote this product and earn commissions on sales
                </div>
              </div>
            </label>
          </div>

          {/* Bottom submit action */}
          <div className="pt-4">
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-black text-white rounded-lg py-3 font-semibold shadow-md hover:shadow-lg hover:bg-gray-800 disabled:bg-gray-400 transition-all"
            >
              {loading ? 'Saving...' : editMode ? 'Update Product' : 'Add Product'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};

export default ProductForm;
