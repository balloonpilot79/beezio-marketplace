import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

interface Product {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  display_order?: number;
  is_featured?: boolean;
}

interface ProductOrderManagerProps {
  sellerId: string;
}

const ProductOrderManager: React.FC<ProductOrderManagerProps> = ({ sellerId }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadProducts();
  }, [sellerId]);

  const loadProducts = async () => {
    try {
      setLoading(true);

      // Get all products for this seller
      const { data: sellerProducts, error: productsError } = await supabase
        .from('products')
        .select('id, name, price, image_url')
        .eq('seller_id', sellerId)
        .order('created_at', { ascending: false });

      if (productsError) throw productsError;

      // Get existing order settings
      const { data: orderSettings, error: orderError } = await supabase
        .from('seller_product_order')
        .select('product_id, display_order, is_featured')
        .eq('seller_id', sellerId);

      if (orderError) throw orderError;

      // Merge products with their order settings
      const productsWithOrder = sellerProducts?.map(product => {
        const orderSetting = orderSettings?.find(o => o.product_id === product.id);
        return {
          ...product,
          display_order: orderSetting?.display_order ?? 999,
          is_featured: orderSetting?.is_featured ?? false
        };
      }) || [];

      // Sort by display_order
      productsWithOrder.sort((a, b) => (a.display_order ?? 999) - (b.display_order ?? 999));

      setProducts(productsWithOrder);
    } catch (error: any) {
      console.error('Error loading products:', error);
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleDragEnd = (result: any) => {
    if (!result.destination) return;

    const items = Array.from(products);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    // Update display_order for all products
    const updatedProducts = items.map((product, index) => ({
      ...product,
      display_order: index
    }));

    setProducts(updatedProducts);
  };

  const toggleFeatured = (productId: string) => {
    setProducts(products.map(p => 
      p.id === productId ? { ...p, is_featured: !p.is_featured } : p
    ));
  };

  const saveOrder = async () => {
    try {
      setSaving(true);
      setMessage(null);

      // Prepare upsert data
      const orderData = products.map((product, index) => ({
        seller_id: sellerId,
        product_id: product.id,
        display_order: index,
        is_featured: product.is_featured ?? false
      }));

      // Upsert all order settings
      const { error } = await supabase
        .from('seller_product_order')
        .upsert(orderData, {
          onConflict: 'seller_id,product_id'
        });

      if (error) throw error;

      setMessage({ type: 'success', text: 'Product order saved successfully!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error: any) {
      console.error('Error saving order:', error);
      setMessage({ type: 'error', text: error.message });
    } finally {
      setSaving(false);
    }
  };

  const resetOrder = () => {
    loadProducts();
    setMessage(null);
  };

  if (loading) {
    return <div className="text-center py-8">Loading products...</div>;
  }

  if (products.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No products found. Create some products first to manage their order.
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">Product Order Manager</h2>
        <p className="text-gray-600">
          Drag and drop to reorder your products. They will appear in this order on your store page.
        </p>
      </div>

      {message && (
        <div className={`mb-4 p-4 rounded ${
          message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        }`}>
          {message.text}
        </div>
      )}

      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="products">
          {(provided, snapshot) => (
            <div
              {...provided.droppableProps}
              ref={provided.innerRef}
              className={`space-y-2 p-4 rounded-lg ${
                snapshot.isDraggingOver ? 'bg-blue-50' : 'bg-gray-50'
              }`}
            >
              {products.map((product, index) => (
                <Draggable key={product.id} draggableId={product.id} index={index}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      {...provided.dragHandleProps}
                      className={`bg-white p-4 rounded-lg shadow flex items-center gap-4 ${
                        snapshot.isDragging ? 'shadow-lg ring-2 ring-blue-500' : ''
                      }`}
                    >
                      {/* Drag Handle */}
                      <div className="text-gray-400 cursor-grab">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                        </svg>
                      </div>

                      {/* Order Number */}
                      <div className="text-lg font-bold text-gray-500 w-8">
                        #{index + 1}
                      </div>

                      {/* Product Image */}
                      <div className="w-16 h-16 bg-gray-200 rounded flex-shrink-0 overflow-hidden">
                        {product.image_url ? (
                          <img 
                            src={product.image_url} 
                            alt={product.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400">
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </div>
                        )}
                      </div>

                      {/* Product Info */}
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900">{product.name}</h3>
                        <p className="text-sm text-gray-600">${product.price.toFixed(2)}</p>
                      </div>

                      {/* Featured Toggle */}
                      <button
                        onClick={() => toggleFeatured(product.id)}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                          product.is_featured
                            ? 'bg-yellow-100 text-yellow-800 border-2 border-yellow-500'
                            : 'bg-gray-100 text-gray-600 border-2 border-transparent hover:bg-gray-200'
                        }`}
                      >
                        {product.is_featured ? '⭐ Featured' : 'Set Featured'}
                      </button>
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      {/* Action Buttons */}
      <div className="mt-6 flex gap-4 justify-end">
        <button
          onClick={resetOrder}
          className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          disabled={saving}
        >
          Reset
        </button>
        <button
          onClick={saveOrder}
          disabled={saving}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-blue-400"
        >
          {saving ? 'Saving...' : 'Save Order'}
        </button>
      </div>
    </div>
  );
};

export default ProductOrderManager;
