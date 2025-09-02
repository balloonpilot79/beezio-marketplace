import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Link } from 'react-router-dom';

interface Product {
  id: string;
  title: string;
  price: number;
  images: string[];
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
      .eq('seller_id', sellerId);
    if (error) {
      setError(error.message);
    } else {
      setProducts(data || []);
    }
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this product?')) return;
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) {
      alert('Failed to delete product.');
    } else {
      setProducts(products.filter(p => p.id !== id));
    }
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div className="text-red-500">{error}</div>;

  return (
    <div className="space-y-4">
      {products.length === 0 ? (
        <div className="text-gray-500">No products found.</div>
      ) : (
        products.map(product => (
          <div key={product.id} className="flex items-center justify-between border-b py-2">
            <div className="flex items-center space-x-4">
              <img src={product.images[0] || ''} alt={product.title} className="w-12 h-12 object-cover rounded" />
              <span className="font-medium">{product.title}</span>
              <span className="text-gray-600">${product.price}</span>
              {product.is_subscription && product.subscription_interval && (
                <span className="ml-2 px-2 py-1 bg-amber-100 text-amber-700 rounded text-xs font-semibold">
                  Subscription: {product.subscription_interval.charAt(0).toUpperCase() + product.subscription_interval.slice(1)}
                </span>
              )}
            </div>
            <div className="flex items-center space-x-2">
              <Link to={`/dashboard/products/edit/${product.id}`} className="text-blue-600 hover:underline">Edit</Link>
              <button onClick={() => handleDelete(product.id)} className="text-red-600 hover:underline">Delete</button>
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export default SellerProducts;
