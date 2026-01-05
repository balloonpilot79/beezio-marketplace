import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import ProductGrid from '../components/ProductGrid';
import { useAuth } from '../contexts/AuthContextMultiRole';

const CausePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [cause, setCause] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { profile } = useAuth();

  useEffect(() => {
    fetchCause();
  }, [id]);

  const fetchCause = async () => {
    setLoading(true);
    // Fetch cause details
    const { data: causeData } = await supabase.from('causes').select('*').eq('id', id).single();
    setCause(causeData);
    // Fetch products linked to this cause
    const { data: productData } = await supabase.from('products').select('*').eq('cause_id', id);
    setProducts(productData || []);
    setLoading(false);
  };

  if (loading) return <div>Loading...</div>;
  if (!cause) return <div>Cause not found.</div>;

  return (
    <div className="max-w-4xl mx-auto py-12">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">{cause.title}</h1>
        <img src={cause.image_url} alt={cause.title} className="w-full h-64 object-cover rounded mb-6" />
        <p className="text-lg text-gray-700 mb-4">{cause.story}</p>
        <div className="mb-4">
          <div className="text-sm text-gray-600">Goal: ${cause.goal_amount.toLocaleString()}</div>
          <div className="text-sm text-gray-600">Raised: ${cause.raised_amount.toLocaleString()}</div>
          <div className="w-full bg-gray-200 rounded-full h-4 mt-2">
            <div
              className="bg-amber-500 h-4 rounded-full"
              style={{ width: `${Math.min(100, (cause.raised_amount / cause.goal_amount) * 100)}%` }}
            ></div>
          </div>
        </div>
        {/* Donate Button */}
        <div className="mt-6">
          <h2 className="text-xl font-bold text-gray-900 mb-2">Want to help directly?</h2>
          <button className="bg-green-500 text-white px-6 py-3 rounded-lg hover:bg-green-600 transition-colors font-bold">
            Donate to this Cause
          </button>
          <div className="text-xs text-gray-500 mt-2">(Secure donation processing via Stripe)</div>
        </div>
      {/* Add Product to Cause Form - Only for authenticated users */}
      <div className="mt-8 mb-8 p-6 bg-gray-50 rounded-lg border border-gray-200">
        <h2 className="text-lg font-bold mb-4">Add a Product to this Cause</h2>
        {profile ? (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const form = e.target as HTMLFormElement;
              const title = (form.elements.namedItem('title') as HTMLInputElement).value.trim();
              const priceStr = (form.elements.namedItem('price') as HTMLInputElement).value;
              const price = parseFloat(priceStr);
              const description = (form.elements.namedItem('description') as HTMLInputElement).value.trim();
              const image_url = (form.elements.namedItem('image_url') as HTMLInputElement).value.trim();
              // Basic validation
              if (!title || isNaN(price) || price <= 0) {
                alert('Please enter a valid product title and price.');
                return;
              }
              if (image_url && !/^https?:\/\/.+\.(jpg|jpeg|png|webp|gif)$/i.test(image_url)) {
                alert('Please enter a valid image URL (jpg, png, webp, gif).');
                return;
              }
              const { error } = await supabase.from('products').insert({
                title,
                price,
                description,
                images: image_url ? [image_url] : [],
                cause_id: id,
                is_active: true,
                seller_id: profile.id,
              });
              if (!error) {
                alert('Product added!');
                fetchCause();
                form.reset();
              } else {
                alert('Error adding product: ' + error.message);
              }
            }}
          >
            <div className="mb-2">
              <input name="title" type="text" placeholder="Product Title" className="border p-2 rounded w-full" required />
            </div>
            <div className="mb-2">
              <input name="price" type="number" step="0.01" placeholder="Price" className="border p-2 rounded w-full" required />
            </div>
            <div className="mb-2">
              <input name="image_url" type="text" placeholder="Image URL" className="border p-2 rounded w-full" />
            </div>
            <div className="mb-2">
              <textarea name="description" placeholder="Description" className="border p-2 rounded w-full" />
            </div>
            <button type="submit" className="bg-amber-500 text-white px-4 py-2 rounded hover:bg-amber-600 font-bold">Add Product</button>
          </form>
        ) : (
          <div className="text-red-500 font-semibold">You must be logged in to add a product to this cause.</div>
        )}
      </div>
      </div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Support this Cause by Buying Products</h2>
        {products.length === 0 ? (
          <div className="text-gray-500">No products linked to this cause yet.</div>
        ) : (
          <ProductGrid products={products} />
        )}
      </div>
      {/* Optional: Add supporter list, social sharing, etc. */}
    </div>
  );
};

export default CausePage;
