import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContextMultiRole';
import { Package, Plus, Check, Search, Filter, Star } from 'lucide-react';

interface Product {
  id: string;
  title: string;
  description: string;
  price: number;
  images: string[];
  category?: string;
  category_id?: string;
  categories?: { name?: string } | null;
  seller_id: string;
  seller_name?: string;
  stock_quantity: number;
}

interface AffiliateProduct {
  product_id: string;
  is_featured: boolean;
  display_order: number;
}

const ProductBrowserForAffiliates: React.FC = () => {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [featuredProducts, setFeaturedProducts] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [categories, setCategories] = useState<string[]>([]);

  useEffect(() => {
    if (user) {
      loadProducts();
      loadSelectedProducts();
    }
  }, [user]);

  const loadProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          profiles!products_seller_id_fkey (full_name),
          categories:category_id (name)
        `)
        .eq('is_active', true)
        .eq('is_promotable', true)
        .gt('stock_quantity', 0)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const productsWithSeller = data?.map((p: any) => ({
        ...p,
        seller_name: p.profiles?.full_name || 'Unknown Seller',
        category: p.categories?.name || p.category || '',
      })) || [];

      setProducts(productsWithSeller);

      // Extract unique categories
      const uniqueCategories = [...new Set(productsWithSeller.map((p: Product) => p.category).filter(Boolean))];
      setCategories(uniqueCategories as string[]);

      setLoading(false);
    } catch (error) {
      console.error('Error loading products:', error);
      setLoading(false);
    }
  };

  const loadSelectedProducts = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('affiliate_store_products')
        .select('product_id, is_featured, display_order')
        .eq('affiliate_id', user.id);

      if (error) throw error;

      const selected = new Set(data?.map((p: AffiliateProduct) => p.product_id) || []);
      const featured = new Set(
        data?.filter((p: AffiliateProduct) => p.is_featured).map((p: AffiliateProduct) => p.product_id) || []
      );

      setSelectedProducts(selected);
      setFeaturedProducts(featured);
    } catch (error) {
      console.error('Error loading selected products:', error);
    }
  };

  const handleAddProduct = async (productId: string) => {
    if (!user) return;

    setAdding(productId);
    try {
      const product = products.find(p => p.id === productId);
      if (!product) return;

      const { error } = await supabase
        .from('affiliate_store_products')
        .insert({
          affiliate_id: user.id,
          product_id: productId,
          title: product.title,
          description: product.description,
          price: product.price,
          images: product.images,
          category_id: product.category_id || null,
          stock_quantity: product.stock_quantity,
          seller_name: product.seller_name,
          is_active: true
        });

      if (error) throw error;

      setSelectedProducts(prev => new Set([...prev, productId]));
    } catch (error) {
      console.error('Error adding product:', error);
      alert('Failed to add product to your store');
    } finally {
      setAdding(null);
    }
  };

  const handleRemoveProduct = async (productId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('affiliate_store_products')
        .delete()
        .eq('affiliate_id', user.id)
        .eq('product_id', productId);

      if (error) throw error;

      setSelectedProducts(prev => {
        const newSet = new Set(prev);
        newSet.delete(productId);
        return newSet;
      });
      setFeaturedProducts(prev => {
        const newSet = new Set(prev);
        newSet.delete(productId);
        return newSet;
      });
    } catch (error) {
      console.error('Error removing product:', error);
      alert('Failed to remove product from your store');
    }
  };

  const handleToggleFeatured = async (productId: string) => {
    if (!user) return;

    const isFeatured = featuredProducts.has(productId);

    try {
      const { error } = await supabase
        .from('affiliate_store_products')
        .update({ is_featured: !isFeatured })
        .eq('affiliate_id', user.id)
        .eq('product_id', productId);

      if (error) throw error;

      setFeaturedProducts(prev => {
        const newSet = new Set(prev);
        if (isFeatured) {
          newSet.delete(productId);
        } else {
          newSet.add(productId);
        }
        return newSet;
      });
    } catch (error) {
      console.error('Error toggling featured:', error);
    }
  };

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || product.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl p-6 text-white">
        <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
          <Package className="w-7 h-7" />
          Browse Marketplace Products
        </h2>
        <p className="text-purple-100">
          Add products to your affiliate store. You earn commission on every sale!
        </p>
        <div className="mt-4 flex items-center gap-4 text-sm">
          <span className="bg-white/20 px-3 py-1 rounded-full">
            {selectedProducts.size} products in your store
          </span>
          <span className="bg-white/20 px-3 py-1 rounded-full">
            {featuredProducts.size} featured
          </span>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search products..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent appearance-none bg-white"
          >
            <option value="all">All Categories</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Products Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredProducts.map(product => {
          const isSelected = selectedProducts.has(product.id);
          const isFeatured = featuredProducts.has(product.id);
          const isAdding = adding === product.id;

          return (
            <div
              key={product.id}
              className={`bg-white rounded-xl shadow-sm border-2 transition-all ${
                isSelected ? 'border-purple-500 shadow-purple-100' : 'border-gray-100 hover:border-purple-200'
              }`}
            >
              {/* Product Image */}
              <div className="relative h-48 bg-gray-100 rounded-t-xl overflow-hidden">
                {product.images && product.images[0] ? (
                  <img
                    src={product.images[0]}
                    alt={product.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Package className="w-16 h-16 text-gray-300" />
                  </div>
                )}
                {isSelected && (
                  <div className="absolute top-2 right-2 bg-purple-500 text-white px-2 py-1 rounded-full text-xs font-semibold flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    In Store
                  </div>
                )}
              </div>

              {/* Product Info */}
              <div className="p-4">
                <h3 className="font-bold text-gray-900 mb-1 line-clamp-1">{product.title}</h3>
                <p className="text-sm text-gray-600 mb-2 line-clamp-2">{product.description}</p>
                
                <div className="flex items-center justify-between mb-3">
                  <span className="text-lg font-bold text-purple-600">${product.price}</span>
                  <span className="text-xs text-gray-500">{product.seller_name}</span>
                </div>

                {/* Actions */}
                {!isSelected ? (
                  <button
                    onClick={() => handleAddProduct(product.id)}
                    disabled={isAdding}
                    className="w-full bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700 transition-colors disabled:bg-gray-400 font-medium flex items-center justify-center gap-2"
                  >
                    {isAdding ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                        Adding...
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4" />
                        Add to My Store
                      </>
                    )}
                  </button>
                ) : (
                  <div className="space-y-2">
                    <button
                      onClick={() => handleToggleFeatured(product.id)}
                      className={`w-full py-2 rounded-lg transition-colors font-medium flex items-center justify-center gap-2 ${
                        isFeatured
                          ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      <Star className={`w-4 h-4 ${isFeatured ? 'fill-yellow-500' : ''}`} />
                      {isFeatured ? 'Featured' : 'Mark Featured'}
                    </button>
                    <button
                      onClick={() => handleRemoveProduct(product.id)}
                      className="w-full bg-red-50 text-red-600 py-2 rounded-lg hover:bg-red-100 transition-colors font-medium"
                    >
                      Remove from Store
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {filteredProducts.length === 0 && (
        <div className="text-center py-12">
          <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Products Found</h3>
          <p className="text-gray-600">Try adjusting your search or filter</p>
        </div>
      )}
    </div>
  );
};

export default ProductBrowserForAffiliates;
