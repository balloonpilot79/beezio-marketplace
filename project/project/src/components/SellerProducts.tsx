import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Link } from 'react-router-dom';
import { normalizeProductImages } from '../utils/imageHelpers';
import { archiveProductById } from '../utils/archiveProduct';
import { getProductReferenceLine } from '../utils/productIdentifiers';

interface Product {
  id: string;
  title: string;
  price: number;
  images?: unknown;
  is_subscription?: boolean;
  subscription_interval?: 'weekly' | 'monthly';
}

const SellerProducts: React.FC<{ sellerId: string }> = ({ sellerId }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchProducts();
  }, [sellerId]);

  const fetchProducts = async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('seller_id', sellerId)
      .neq('status', 'archived');
    if (error) {
      setError(error.message);
    } else {
      setProducts(data || []);
    }
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Remove this product from your active dashboard and marketplace listings? Promoter links and payout history will be kept.')) return;
    try {
      await archiveProductById({ productId: id, sellerId });
      setProducts(products.filter(p => p.id !== id));
    } catch {
      alert('Failed to remove product.');
    }
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div className="text-red-500">{error}</div>;

  return (
    <div className="space-y-4">
      {products.length === 0 ? (
        <div className="text-gray-500">No products found.</div>
      ) : (
        products.map(product => {
          const imageUrl = normalizeProductImages(product.images)[0] || '';
          const productReferenceLine = getProductReferenceLine(product);
          return (
          <div key={product.id} className="flex items-center justify-between border-b py-2">
            <div className="flex items-center space-x-4">
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt={product.title}
                  className="w-12 h-12 object-cover rounded"
                  onError={(event) => {
                    event.currentTarget.style.display = 'none';
                  }}
                />
              ) : (
                <div className="w-12 h-12 rounded bg-gray-100 flex items-center justify-center text-xs text-gray-500">
                  No image
                </div>
              )}
              <div>
                <div className="font-medium">{product.title}</div>
                {productReferenceLine && (
                  <div className="text-xs font-medium text-amber-700">{productReferenceLine}</div>
                )}
              </div>
              <span className="text-gray-600">${product.price}</span>
              {product.is_subscription && product.subscription_interval && (
                <span className="ml-2 px-2 py-1 bg-amber-100 text-amber-700 rounded text-xs font-semibold">
                  Subscription: {product.subscription_interval.charAt(0).toUpperCase() + product.subscription_interval.slice(1)}
                </span>
              )}
            </div>
            <div className="flex items-center space-x-2">
              <Link to={`/dashboard/products/edit/${product.id}`} className="text-blue-600 hover:underline">Edit</Link>
              <button onClick={() => handleDelete(product.id)} className="text-red-600 hover:underline">Remove</button>
            </div>
          </div>
          );
        })
      )}
    </div>
  );
};

export default SellerProducts;
