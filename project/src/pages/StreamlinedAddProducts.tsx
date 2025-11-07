import React, { useState } from 'react';
import { Plus, X, Upload, Package, Save, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContextMultiRole';
import { supabase } from '../lib/supabase';
import ImageUpload from '../components/ImageUpload';
import BZOButton from '../components/BZOButton';
import BZOInput from '../components/BZOInput';

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
    <div className="min-h-screen bg-bzo-gradient">
      {/* Clean Header Bar */}
      <div className="bg-bzo-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="btn-bzo-outline px-4 py-2 rounded-full flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
            <div>
              <h1 className="text-2xl font-bold text-bzo-black">Add Products</h1>
              <p className="text-sm text-gray-600">Simple product upload</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <button
              onClick={addNewProduct}
              className="btn-bzo-outline px-4 py-2 rounded-full flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Product
            </button>
            <BZOButton
              onClick={saveAllProducts}
              loading={saving}
              size="lg"
              className="flex items-center gap-2"
            >
              <Save className="w-5 h-5" />
              Save All ({products.filter(p => p.name.trim()).length})
            </BZOButton>
          </div>
        </div>
      </div>

      {/* Full Page Single Column Layout */}
      <div className="max-w-4xl mx-auto p-6">
        {/* Product Selector - Horizontal */}
        {products.length > 1 && (
          <div className="mb-6 bg-bzo-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 overflow-x-auto pb-2">
              {products.map((product, index) => (
                <button
                  key={product.id}
                  onClick={() => setCurrentProductIndex(index)}
                  className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    currentProductIndex === index
                      ? 'bg-bzo-yellow-primary text-bzo-black'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {product.name || `Product ${index + 1}`}
                  {products.length > 1 && currentProductIndex === index && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeProduct(index);
                      }}
                      className="ml-2 text-red-600 hover:text-red-800"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Single Clean Product Form */}
        <div className="bg-bzo-white rounded-xl border border-gray-200 p-8">
          <h2 className="text-xl font-bold text-bzo-black mb-6 pb-4 border-b border-gray-100">
            Product {currentProductIndex + 1} Details
          </h2>

          {/* Essential Info - Single Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <BZOInput
              label="Product Name"
              placeholder="Enter product name"
              value={currentProduct.name}
              onChange={(value) => updateProduct(currentProductIndex, 'name', value)}
              required
            />

            <BZOInput
              type="number"
              label="Price ($)"
              placeholder="0.00"
              value={currentProduct.price.toString()}
              onChange={(value) => updateProduct(currentProductIndex, 'price', parseFloat(value) || 0)}
              required
            />

            <BZOInput
              type="number"
              label="Stock"
              placeholder="1"
              value={currentProduct.inventory.toString()}
              onChange={(value) => updateProduct(currentProductIndex, 'inventory', parseInt(value) || 1)}
              required
            />
          </div>

          {/* Optional Fields - Two Column */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <BZOInput
              label="SKU (Optional)"
              placeholder="Product code"
              value={currentProduct.sku}
              onChange={(value) => updateProduct(currentProductIndex, 'sku', value)}
            />

            <div>
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
          </div>

          {/* Description - Full Width */}
          <div className="mb-8">
            <label className="block text-sm font-semibold text-bzo-black mb-2">
              Description
            </label>
            <textarea
              value={currentProduct.description}
              onChange={(e) => updateProduct(currentProductIndex, 'description', e.target.value)}
              placeholder="Describe your product..."
              rows={3}
              className="input-bzo w-full resize-none"
            />
          </div>

          {/* Images Section - Clean Upload */}
          <div className="mb-8">
            <label className="block text-sm font-semibold text-bzo-black mb-4">
              Product Images
            </label>

            {currentProduct.images.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-4">
                {currentProduct.images.map((image, index) => (
                  <div key={index} className="relative group">
                    <img
                      src={image}
                      alt={`Product ${index + 1}`}
                      className="w-full h-20 object-cover rounded-lg border border-gray-200"
                    />
                    <button
                      onClick={() => {
                        const newImages = currentProduct.images.filter((_, i) => i !== index);
                        updateProduct(currentProductIndex, 'images', newImages);
                      }}
                      className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-xs"
                    >
                      <X className="w-3 h-3" />
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

          {/* Simple Affiliate Toggle */}
          <div className="border-t border-gray-100 pt-6">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={currentProduct.affiliate_enabled}
                onChange={(e) => updateProduct(currentProductIndex, 'affiliate_enabled', e.target.checked)}
                className="w-4 h-4 text-bzo-yellow-primary focus:ring-bzo-yellow-primary rounded"
              />
              <div>
                <div className="font-medium text-bzo-black">Enable affiliate marketing</div>
                <div className="text-sm text-gray-500">Let others promote this product for commission</div>
              </div>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StreamlinedAddProducts;