import React, { useState } from 'react';
import { ArrowLeft, Save, Upload, Plus, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContextMultiRole';
import { supabase } from '../lib/supabase';
import ImageUpload from '../components/ImageUpload';

interface ProductItem {
  id: string;
  name: string;
  sku: string;
  description: string;
  price: number;
  inventory: number;
  images: string[];
  category_id: string;
  affiliate_enabled: boolean;
}

const StreamlinedAddProducts: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [products, setProducts] = useState<ProductItem[]>([
    {
      id: '1',
      name: '',
      sku: '',
      description: '',
      price: 0,
      inventory: 1,
      images: [],
      category_id: '',
      affiliate_enabled: true
    }
  ]);
  const [currentProductIndex, setCurrentProductIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);

  // Load categories
  React.useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    const { data } = await supabase.from('categories').select('*').order('name');
    setCategories(data || []);
  };

  const addNewProduct = () => {
    const newProduct: ProductItem = {
      id: Date.now().toString(),
      name: '',
      sku: '',
      description: '',
      price: 0,
      inventory: 1,
      images: [],
      category_id: '',
      affiliate_enabled: true
    };
    setProducts([...products, newProduct]);
    setCurrentProductIndex(products.length);
  };

  const removeProduct = (index: number) => {
    if (products.length > 1) {
      const newProducts = products.filter((_, i) => i !== index);
      setProducts(newProducts);
      if (currentProductIndex >= newProducts.length) {
        setCurrentProductIndex(newProducts.length - 1);
      }
    }
  };

  const updateProduct = (index: number, field: keyof ProductItem, value: any) => {
    const newProducts = [...products];
    newProducts[index] = { ...newProducts[index], [field]: value };
    setProducts(newProducts);
  };
  };

  const handleImageUpload = (urls: string[]) => {
    updateProduct(currentProductIndex, 'images', [...products[currentProductIndex].images, ...urls]);
  };

  const saveAllProducts = async () => {
    if (!profile?.id) {
      alert('Please complete your profile first');
      return;
    }

    setSaving(true);
    try {
      const validProducts = products.filter(p => p.name.trim() && p.price > 0);
      
      if (validProducts.length === 0) {
        throw new Error('Please add at least one valid product with name and price');
      }

      for (const product of validProducts) {
        const { error } = await supabase.from('products').insert({
          title: product.name,
          description: product.description,
          sku: product.sku || null,
          price: product.price,
          stock_quantity: product.inventory,
          images: product.images,
          category_id: product.category_id || null,
          seller_id: profile.id,
          affiliate_enabled: product.affiliate_enabled,
          status: product.affiliate_enabled ? 'active' : 'store_only',
          is_active: true,
          commission_rate: 20, // Default 20%
          commission_type: 'percentage',
          seller_amount: product.price * 0.70, // Rough calculation
          platform_fee: product.price * 0.10,
          requires_shipping: true
        });

        if (error) throw error;
      }

      alert(`Successfully added ${validProducts.length} products!`);
      navigate('/dashboard');

    } catch (error: any) {
      console.error('Error saving products:', error);
      alert('Error saving products: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const currentProduct = products[currentProductIndex];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Clean Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/dashboard')}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
                <span className="font-medium">Back</span>
              </button>
              <div className="border-l border-gray-300 pl-4">
                <h1 className="text-2xl font-bold text-gray-900">Add Product</h1>
                <p className="text-sm text-gray-500">Fill in the details below</p>
              </div>
            </div>
            <button
              onClick={saveAllProducts}
              disabled={saving}
              className="bg-[#FFD700] hover:bg-[#FFC700] disabled:bg-gray-300 text-gray-900 px-8 py-3 rounded-lg font-bold shadow-md hover:shadow-lg transition-all duration-200 flex items-center gap-2"
            >
              <Save className="w-5 h-5" />
              {saving ? 'Saving...' : `Save ${products.filter(p => p.name.trim()).length > 1 ? 'All' : 'Product'}`}
            </button>
          </div>
        </div>
      </div>

      {/* Product Tabs (if multiple products) */}
      {products.length > 1 && (
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-5xl mx-auto px-6">
            <div className="flex gap-2 overflow-x-auto py-3">
              {products.map((product, index) => (
                <button
                  key={product.id}
                  onClick={() => setCurrentProductIndex(index)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-colors ${
                    currentProductIndex === index
                      ? 'bg-[#FFD700] text-gray-900'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {product.name || `Product ${index + 1}`}
                  {products.length > 1 && (
                    <X
                      className="w-4 h-4 hover:text-red-600"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeProduct(index);
                      }}
                    />
                  )}
                </button>
              ))}
              <button
                onClick={addNewProduct}
                className="flex items-center gap-1 px-4 py-2 rounded-lg font-medium text-sm bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Another
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Form - Full Width, Clean */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          {/* Product Name & Price - Most Important */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div>
              <label className="block text-sm font-bold text-gray-900 mb-2">
                Product Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g., Wireless Headphones"
                value={currentProduct.name}
                onChange={(e) => updateProduct(currentProductIndex, 'name', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-[#FFD700] focus:ring-2 focus:ring-[#FFD700]/20 transition-all"
              />
            </div>
            
            <div>
              <label className="block text-sm font-bold text-gray-900 mb-2">
                Price <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-medium">$</span>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={currentProduct.price || ''}
                  onChange={(e) => updateProduct(currentProductIndex, 'price', parseFloat(e.target.value) || 0)}
                  className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-[#FFD700] focus:ring-2 focus:ring-[#FFD700]/20 transition-all"
                />
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="mb-8">
            <label className="block text-sm font-bold text-gray-900 mb-2">
              Description
            </label>
            <textarea
              placeholder="Describe your product..."
              value={currentProduct.description}
              onChange={(e) => updateProduct(currentProductIndex, 'description', e.target.value)}
              rows={4}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-[#FFD700] focus:ring-2 focus:ring-[#FFD700]/20 transition-all resize-none"
            />
          </div>

          {/* Secondary Details */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div>
              <label className="block text-sm font-bold text-gray-900 mb-2">
                SKU (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g., WH-001"
                value={currentProduct.sku}
                onChange={(e) => updateProduct(currentProductIndex, 'sku', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-[#FFD700] focus:ring-2 focus:ring-[#FFD700]/20 transition-all"
              />
            </div>
            
            <div>
              <label className="block text-sm font-bold text-gray-900 mb-2">
                Stock
              </label>
              <input
                type="number"
                min="0"
                placeholder="1"
                value={currentProduct.inventory || ''}
                onChange={(e) => updateProduct(currentProductIndex, 'inventory', parseInt(e.target.value) || 1)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-[#FFD700] focus:ring-2 focus:ring-[#FFD700]/20 transition-all"
              />
            </div>
            
            <div>
              <label className="block text-sm font-bold text-gray-900 mb-2">
                Category
              </label>
              <select
                value={currentProduct.category_id}
                onChange={(e) => updateProduct(currentProductIndex, 'category_id', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-[#FFD700] focus:ring-2 focus:ring-[#FFD700]/20 transition-all"
              >
                <option value="">Select...</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Images */}
          <div className="mb-8">
            <label className="block text-sm font-bold text-gray-900 mb-4">
              Product Images
            </label>
            
            {currentProduct.images.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {currentProduct.images.map((image, index) => (
                  <div key={index} className="relative group">
                    <img
                      src={image}
                      alt={`Product ${index + 1}`}
                      className="w-full h-32 object-cover rounded-lg border border-gray-200"
                    />
                    <button
                      onClick={() => {
                        const newImages = currentProduct.images.filter((_, i) => i !== index);
                        updateProduct(currentProductIndex, 'images', newImages);
                      }}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            
            <ImageUpload
              bucket="product-images"
              folder="new-products"
              onUploadComplete={handleImageUpload}
              maxFiles={10}
              allowedTypes={['image/jpeg', 'image/png', 'image/webp']}
            />
          </div>

          {/* Affiliate Settings */}
          <div className="border-t border-gray-200 pt-6">
            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={currentProduct.affiliate_enabled}
                onChange={(e) => updateProduct(currentProductIndex, 'affiliate_enabled', e.target.checked)}
                className="mt-1 w-5 h-5 text-[#FFD700] border-gray-300 rounded focus:ring-[#FFD700]"
              />
              <div>
                <div className="font-bold text-gray-900 group-hover:text-[#FFD700] transition-colors">
                  Enable affiliate marketing
                </div>
                <div className="text-sm text-gray-600">
                  Allow others to promote this product and earn commissions
                </div>
              </div>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StreamlinedAddProducts;
                  label="Inventory"
                  placeholder="1"
                  value={currentProduct.inventory.toString()}
                  onChange={(value) => updateProduct(currentProductIndex, 'inventory', parseInt(value) || 1)}
                  required
                />
              </div>

              <div className="mt-4">
                <label className="block text-sm font-semibold text-bzo-black mb-2">
                  Category
                </label>
                <select
                  value={currentProduct.category_id}
                  onChange={(e) => updateProduct(currentProductIndex, 'category_id', e.target.value)}
                  className="input-bzo w-full"
                >
                  <option value="">Select category</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>

              <div className="mt-4">
                <label className="block text-sm font-semibold text-bzo-black mb-2">
                  Description
                </label>
                <textarea
                  value={currentProduct.description}
                  onChange={(e) => updateProduct(currentProductIndex, 'description', e.target.value)}
                  placeholder="Describe your product features, benefits, and specifications..."
                  rows={4}
                  className="input-bzo w-full resize-none"
                />
              </div>
            </div>

            {/* Images Card */}
            <div className="card-bzo p-6">
              <h3 className="text-xl font-bold text-bzo-black mb-4 flex items-center gap-2">
                <Upload className="w-6 h-6 text-bzo-yellow-primary" />
                Product Images
              </h3>

              {currentProduct.images.length > 0 && (
                <div className="grid grid-cols-3 md:grid-cols-4 gap-3 mb-4">
                  {currentProduct.images.map((image, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={image}
                        alt={`Product ${index + 1}`}
                        className="w-full h-24 object-cover rounded-lg border border-gray-200"
                      />
                      <button
                        onClick={() => {
                          const newImages = currentProduct.images.filter((_, i) => i !== index);
                          updateProduct(currentProductIndex, 'images', newImages);
                        }}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <ImageUpload
                bucket="product-images"
                folder="new-products"
                onUploadComplete={handleImageUpload}
                maxFiles={5}
                allowedTypes={['image/jpeg', 'image/png', 'image/webp']}
              />
            </div>

            {/* Affiliate Settings Card */}
            <div className="card-bzo p-6">
              <h3 className="text-xl font-bold text-bzo-black mb-4">Sales Settings</h3>
              
              <div className="space-y-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={currentProduct.affiliate_enabled}
                    onChange={(e) => updateProduct(currentProductIndex, 'affiliate_enabled', e.target.checked)}
                    className="w-5 h-5 text-bzo-yellow-primary focus:ring-bzo-yellow-primary rounded"
                  />
                  <div>
                    <div className="font-semibold text-bzo-black">Enable Affiliate Marketing</div>
                    <div className="text-sm text-gray-600">
                      Allow others to promote this product and earn commissions
                    </div>
                  </div>
                </label>

                {!currentProduct.affiliate_enabled && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <p className="text-sm text-yellow-800">
                      <strong>Store-Only Mode:</strong> This product will only appear in your custom store and won't be available for affiliates to promote.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StreamlinedAddProducts;