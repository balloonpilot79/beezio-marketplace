import React, { useState } from 'react';
import { ArrowLeft, Save, Upload, Plus, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContextMultiRole';
import { supabase } from '../lib/supabase';
import { ensureSellerProductInOrder } from '../utils/sellerProductOrder';
import ImageUpload from '../components/ImageUpload';
import { apiPost } from '../utils/netlifyApi';

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
    setProducts(prev => {
      const next = [...prev];
      const current = next[currentProductIndex] || blankProduct();
      next[currentProductIndex] = {
        ...current,
        images: [...(current.images || []), ...urls],
      };
      return next;
    });
  };

  const blankProduct = (): ProductItem => ({
    id: Date.now().toString(),
    name: '',
    sku: '',
    description: '',
    price: 0,
    inventory: 1,
    images: [],
    category_id: '',
    affiliate_enabled: true
  });

  const saveAllProducts = async (redirectAfterSave: boolean = true) => {
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

      const { data: sessionData } = await supabase.auth.getSession();
      const apiSession = sessionData?.session ?? null;

      for (const product of validProducts) {
        const created = await apiPost<{ id: string }>(
          '/.netlify/functions/product-create',
          apiSession,
          {
            title: product.name,
            description: product.description,
            sku: product.sku || null,
            price: product.price,
            stock_quantity: product.inventory,
            images: product.images,
            category_id: product.category_id || null,
            affiliate_enabled: Boolean(product.affiliate_enabled),
          }
        );

        if (!created?.id) throw new Error('Product create failed');

        // Ensure it shows in seller storefront + seller ordering dashboard.
        await ensureSellerProductInOrder({ sellerId: profile.id, productId: String(created.id) });
      }

      alert(`Successfully added ${validProducts.length} products!`);
      if (redirectAfterSave) {
        navigate('/dashboard');
      } else {
        // Reset form for another entry
        setProducts([blankProduct()]);
        setCurrentProductIndex(0);
      }

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
      <div className="bg-[#ffcc00] border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-black">Add New Product</h1>
              <p className="text-sm text-gray-700">Fill out the information below</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => saveAllProducts(false)}
                disabled={saving}
                className="bg-white border border-black text-black hover:bg-gray-100 disabled:bg-gray-200 px-4 py-2.5 rounded-lg font-semibold shadow-sm transition-all duration-200"
              >
                {saving ? 'Saving...' : 'Save & Add Another'}
              </button>
              <button
                onClick={() => saveAllProducts(true)}
                disabled={saving}
                className="bg-black hover:bg-gray-800 disabled:bg-gray-400 text-white px-6 py-2.5 rounded-lg font-semibold shadow-md hover:shadow-lg transition-all duration-200"
              >
                {saving ? 'Saving...' : 'Save Product'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Form - Single Column */}
      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 space-y-6">
          
          {/* Product Name */}
          <div>
            <label className="block text-sm font-bold text-gray-900 mb-2">
              Product Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g., Wireless Headphones"
              value={currentProduct.name}
              onChange={(e) => updateProduct(currentProductIndex, 'name', e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-[#ffcc00] focus:ring-2 focus:ring-[#ffcc00]/20"
            />
          </div>

          {/* Price */}
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
                className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-[#ffcc00] focus:ring-2 focus:ring-[#ffcc00]/20"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-bold text-gray-900 mb-2">
              Description
            </label>
            <textarea
              placeholder="Describe your product features and benefits..."
              value={currentProduct.description}
              onChange={(e) => updateProduct(currentProductIndex, 'description', e.target.value)}
              rows={4}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-[#ffcc00] focus:ring-2 focus:ring-[#ffcc00]/20 resize-none"
            />
          </div>

          {/* SKU */}
          <div>
            <label className="block text-sm font-bold text-gray-900 mb-2">
              SKU (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g., WH-001"
              value={currentProduct.sku}
              onChange={(e) => updateProduct(currentProductIndex, 'sku', e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-[#ffcc00] focus:ring-2 focus:ring-[#ffcc00]/20"
            />
          </div>

          {/* Stock Quantity */}
          <div>
            <label className="block text-sm font-bold text-gray-900 mb-2">
              Stock Quantity
            </label>
            <input
              type="number"
              min="0"
              placeholder="1"
              value={currentProduct.inventory || ''}
              onChange={(e) => updateProduct(currentProductIndex, 'inventory', parseInt(e.target.value) || 1)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-[#ffcc00] focus:ring-2 focus:ring-[#ffcc00]/20"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-bold text-gray-900 mb-2">
              Category
            </label>
            <select
              value={currentProduct.category_id}
              onChange={(e) => updateProduct(currentProductIndex, 'category_id', e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-[#ffcc00] focus:ring-2 focus:ring-[#ffcc00]/20"
            >
              <option value="">Select a category...</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>

          {/* Images */}
          <div>
            <label className="block text-sm font-bold text-gray-900 mb-3">
              Product Images
            </label>
            
            {currentProduct.images.length > 0 && (
              <div className="grid grid-cols-3 gap-3 mb-4">
                {currentProduct.images.map((image, index) => (
                  <div key={index} className="relative group">
                    <img
                      src={image}
                      alt={`Product ${index + 1}`}
                      className="w-full h-32 object-cover rounded-lg border-2 border-gray-200"
                    />
                    <button
                      onClick={() => {
                        const newImages = currentProduct.images.filter((_, i) => i !== index);
                        updateProduct(currentProductIndex, 'images', newImages);
                      }}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity shadow-md hover:bg-red-600"
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

          {/* Affiliate Marketing Toggle */}
          <div className="border-t border-gray-200 pt-6">
            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={currentProduct.affiliate_enabled}
                onChange={(e) => updateProduct(currentProductIndex, 'affiliate_enabled', e.target.checked)}
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

        </div>
        {/* Bottom action bar */}
        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            onClick={() => saveAllProducts(false)}
            disabled={saving}
            className="bg-white border border-black text-black hover:bg-gray-100 disabled:bg-gray-200 px-4 py-2.5 rounded-lg font-semibold shadow-sm transition-all duration-200"
          >
            {saving ? 'Saving...' : 'Save & Add Another'}
          </button>
          <button
            onClick={() => saveAllProducts(true)}
            disabled={saving}
            className="bg-black hover:bg-gray-800 disabled:bg-gray-400 text-white px-6 py-2.5 rounded-lg font-semibold shadow-md hover:shadow-lg transition-all duration-200"
          >
            {saving ? 'Saving...' : 'Save Product'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default StreamlinedAddProducts;
