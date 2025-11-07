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
      <div className="max-w-6xl mx-auto p-6">
        {/* Header */}
        <div className="card-bzo p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/dashboard')}
                className="btn-bzo-outline px-4 py-2 rounded-full flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
              <div>
                <h1 className="text-3xl font-bold text-bzo-black flex items-center gap-2">
                  <Package className="w-8 h-8 text-bzo-yellow-primary" />
                  Add Products
                </h1>
                <p className="text-gray-600">Quick and easy product upload - Amazon style</p>
              </div>
            </div>
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

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Product List Sidebar */}
          <div className="card-bzo p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-bzo-black">Products ({products.length})</h3>
              <button
                onClick={addNewProduct}
                className="btn-bzo-primary px-3 py-2 rounded-full text-sm flex items-center gap-1"
              >
                <Plus className="w-4 h-4" />
                Add
              </button>
            </div>

            <div className="space-y-2">
              {products.map((product, index) => (
                <div
                  key={product.id}
                  onClick={() => setCurrentProductIndex(index)}
                  className={`p-3 rounded-lg cursor-pointer border-2 transition-all ${
                    currentProductIndex === index
                      ? 'border-bzo-yellow-primary bg-bzo-yellow-light'
                      : 'border-gray-200 bg-bzo-white hover:border-bzo-yellow-primary/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-bzo-black truncate">
                        {product.name || `Product ${index + 1}`}
                      </p>
                      <p className="text-sm text-gray-600">
                        {product.sku && `SKU: ${product.sku} • `}
                        ${product.price || '0.00'}
                      </p>
                    </div>
                    {products.length > 1 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeProduct(index);
                        }}
                        className="text-red-500 hover:text-red-700 p-1"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Quick Status Indicators */}
                  <div className="flex gap-1 mt-2">
                    {product.name && <span className="w-2 h-2 bg-green-400 rounded-full"></span>}
                    {product.price > 0 && <span className="w-2 h-2 bg-blue-400 rounded-full"></span>}
                    {product.images.length > 0 && <span className="w-2 h-2 bg-bzo-yellow-primary rounded-full"></span>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Main Product Editor */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Info Card */}
            <div className="card-bzo p-6">
              <h3 className="text-xl font-bold text-bzo-black mb-4">
                Product {currentProductIndex + 1} Details
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <BZOInput
                  label="Product Name"
                  placeholder="e.g. Wireless Bluetooth Headphones"
                  value={currentProduct.name}
                  onChange={(value) => updateProduct(currentProductIndex, 'name', value)}
                  required
                />

                <BZOInput
                  label="SKU (Optional)"
                  placeholder="e.g. WBH-001"
                  value={currentProduct.sku}
                  onChange={(value) => updateProduct(currentProductIndex, 'sku', value)}
                />

                <BZOInput
                  type="number"
                  label="Price"
                  placeholder="0.00"
                  value={currentProduct.price.toString()}
                  onChange={(value) => updateProduct(currentProductIndex, 'price', parseFloat(value) || 0)}
                  required
                />

                <BZOInput
                  type="number"
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