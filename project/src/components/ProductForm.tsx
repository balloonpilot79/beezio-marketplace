import React, { useState } from 'react';
import { X, Plus } from 'lucide-react';
import { useAuth } from '../contexts/AuthContextMultiRole';
import { supabase } from '../lib/supabase';
import PricingCalculator from './PricingCalculator';
import ImageUpload from './ImageUpload';
import ImageGallery from './ImageGallery';
import { PricingBreakdown } from '../lib/pricing';

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
  const { profile } = useAuth();
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
      const match = url.match(/\/edit\/(\w+)/);
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
  const [imageUrl, setImageUrl] = useState('');
  const [videoUrl, setVideoUrl] = useState('');

  // Product categories
  const categories = [
    'Electronics', 'Fashion', 'Home & Garden', 'Health & Beauty',
    'Sports & Outdoors', 'Books & Media', 'Toys & Games', 'Food & Beverages',
    'Travel & Experiences', 'Art & Crafts', 'Business & Industrial', 'Automotive', 'Other'
  ];

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'stock_quantity' ? parseInt(value) || 0 : value,
    }));
  };

  const addImage = () => {
    if (imageUrl.trim() && !formData.images.includes(imageUrl.trim())) {
      setFormData(prev => ({
        ...prev,
        images: [...prev.images, imageUrl.trim()],
      }));
      setImageUrl('');
    }
  };

  const addVideo = () => {
    if (videoUrl.trim() && !formData.videos.includes(videoUrl.trim())) {
      setFormData(prev => ({
        ...prev,
        videos: [...prev.videos, videoUrl.trim()],
      }));
      setVideoUrl('');
    }
  };

  const removeImage = (index: number) => {
    setFormData(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
    }));
  };

  const removeVideo = (index: number) => {
    setFormData(prev => ({
      ...prev,
      videos: prev.videos.filter((_, i) => i !== index),
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

  const handleImageUploadSuccess = (uploadedImages: any[]) => {
    if (currentProductId) {
      // For editing mode, we'll refresh the images from the database
      // This will be handled by the ImageGallery component
      setProductImages(prev => [...prev, ...uploadedImages]);
    } else {
      // For new products, we'll handle this after product creation
      console.log('Images uploaded for new product:', uploadedImages);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!profile) {
      setError('You must be logged in to create a product');
      return;
    }

    if (!pricingBreakdown) {
      setError('Please configure your pricing first');
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
            seller_id: profile.id,
            shipping_options: formData.shipping_options,
            requires_shipping: formData.requires_shipping,
          }])
          .select()
          .single();
        
        if (error) throw error;
        
        // Set the product ID for image uploads
        setCurrentProductId(newProduct.id);
        if (error) throw error;
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
        shipping_options: [
          { name: 'Standard Shipping', cost: 0, estimated_days: '3-5 business days' },
          { name: 'Express Shipping', cost: 0, estimated_days: '1-2 business days' },
          { name: 'Free Shipping', cost: 0, estimated_days: '5-7 business days' }
        ],
        requires_shipping: true,
      });
      setPricingBreakdown(null);

      setTimeout(() => {
        onSuccess?.();
      }, 2000);

    } catch (err: any) {
      console.error('Error creating product:', err);
      setError(err.message || 'Failed to create product');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Add New Product</h1>
        <p className="text-gray-600">Set your desired profit and we'll calculate the final price</p>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
          {success}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Product Details Form */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Product Details</h2>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Product Title *
              </label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                placeholder="Enter product title"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                placeholder="Describe your product"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Category *
              </label>
              <select
                name="category_id"
                value={formData.category_id}
                onChange={handleInputChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                <option value="">Select a category</option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
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

            {/* Subscription Option */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Subscription Product
              </label>
              <div className="flex items-center space-x-4">
                <label className="inline-flex items-center">
                  <input
                    type="checkbox"
                    name="is_subscription"
                    checked={formData.is_subscription}
                    onChange={e => setFormData(prev => ({ ...prev, is_subscription: e.target.checked, subscription_interval: e.target.checked ? 'monthly' : '' }))}
                    className="form-checkbox h-5 w-5 text-amber-600"
                  />
                  <span className="ml-2 text-gray-700">Enable subscription</span>
                </label>
                {formData.is_subscription && (
                  <select
                    name="subscription_interval"
                    value={formData.subscription_interval}
                    onChange={e => setFormData(prev => ({ ...prev, subscription_interval: e.target.value as 'weekly' | 'monthly' }))}
                    className="ml-4 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="weekly">Weekly</option>
                  </select>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1">If enabled, buyers will be charged automatically on a recurring basis and affiliates will earn recurring commissions.</p>
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

            {/* Product Images - Advanced System */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-4">
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

              {/* Image Upload Component */}
              {currentProductId && (
                <div className="mb-6">
                  <h4 className="text-sm font-medium text-gray-700 mb-3">
                    {productImages.length === 0 ? 'Upload Images' : 'Add More Images'}
                  </h4>
                  <ImageUpload
                    bucket="product-images"
                    productId={currentProductId}
                    onUploadSuccess={handleImageUploadSuccess}
                    maxFiles={10}
                    acceptedTypes={['image/jpeg', 'image/png', 'image/webp']}
                  />
                </div>
              )}

              {/* Legacy URL input for backward compatibility */}
              <div className="border-t pt-4">
                <h4 className="text-sm font-medium text-gray-700 mb-3">Add by URL (Legacy)</h4>
                <div className="flex space-x-2 mb-2">
                  <input
                    type="url"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="Enter image URL"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  <button
                    type="button"
                    onClick={addImage}
                    className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                
                {formData.images.length > 0 && (
                  <div className="grid grid-cols-2 gap-2 mt-3">
                    {formData.images.map((image, index) => (
                      <div key={index} className="relative">
                        <img
                          src={image}
                          alt={`Product ${index + 1}`}
                          className="w-full h-24 object-cover rounded-lg"
                        />
                        <button
                          type="button"
                          onClick={() => removeImage(index)}
                          className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {!currentProductId && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-sm text-yellow-800">
                    <strong>Note:</strong> Advanced image upload will be available after you create the product. 
                    You can add images using URLs for now, then use the powerful image management system when editing.
                  </p>
                </div>
              )}
            </div>

            {/* Video URLs */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Product Videos
              </label>
              <div className="flex space-x-2 mb-2">
                <input
                  type="url"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  placeholder="Enter video URL (YouTube, Vimeo, etc.)"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <button
                  type="button"
                  onClick={addVideo}
                  className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              
              <div className="space-y-2">
                {formData.videos.map((video, index) => (
                  <div key={index} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-8 bg-gray-200 rounded flex items-center justify-center">
                        <span className="text-xs text-gray-500">VIDEO</span>
                      </div>
                      <span className="text-sm text-gray-700 truncate max-w-xs">{video}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeVideo(index)}
                      className="text-red-500 hover:text-red-700 p-1"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
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

            <div className="flex space-x-4 pt-4">
              <button
                type="submit"
                disabled={loading || !pricingBreakdown}
                className="flex-1 bg-amber-500 text-white py-3 px-4 rounded-lg hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {loading ? 'Creating Product...' : 'Create Product'}
              </button>
              
              {onCancel && (
                <button
                  type="button"
                  onClick={onCancel}
                  className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
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