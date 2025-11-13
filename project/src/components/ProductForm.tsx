import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContextMultiRole';
import { supabase } from '../lib/supabase';
import PricingCalculator from './PricingCalculator';
import EasyImageUpload from './EasyImageUpload';
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
    <div className="min-h-screen bg-gray-50">
      {/* Clean Header */}
      <div className="bg-[#ffcc00] border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-black">Add New Product</h1>
              <p className="text-sm text-gray-700">Fill out the information below</p>
            </div>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="bg-black hover:bg-gray-800 disabled:bg-gray-400 text-white px-6 py-2.5 rounded-lg font-semibold shadow-md hover:shadow-lg transition-all duration-200"
            >
              {loading ? 'Saving...' : editMode ? 'Update Product' : 'Save Product'}
            </button>
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

            <SimpleImageUpload
              bucket="product-images"
              onUploadComplete={handleImageUploadSuccess}
              maxFiles={10}
              maxFileSizeMB={10}
            />
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

        </form>
      </div>
    </div>
  );
};

export default ProductForm;
