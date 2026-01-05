import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import PublicLayout from '../components/layout/PublicLayout';
import ProductCard from '../components/product/ProductCard';
import { SAMPLE_PRODUCTS, SampleProduct } from '../data/sampleProducts';
import { fetchMarketplaceProducts } from '../services/productService';
import { buildPricedProduct } from '../utils/pricing';

type MarketplaceProduct = SampleProduct & { sale_price?: number; seller_ask?: number };

const tabs: { key: 'all' | 'physical' | 'digital'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'physical', label: 'Physical products' },
  { key: 'digital', label: 'Digital downloads' },
];

const MarketplacePage: React.FC = () => {
  const [products, setProducts] = useState<MarketplaceProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'physical' | 'digital'>('all');

  useEffect(() => {
    const loadProducts = async () => {
      try {
        const live = await fetchMarketplaceProducts();
        if (live.length) {
          setProducts(live);
          setLoading(false);
          return;
        }
      } catch (error) {
        console.warn('MarketplacePage: using sample data', error);
      }

      setProducts(SAMPLE_PRODUCTS.slice(0, 20).map((item) => buildPricedProduct(item)));
      setLoading(false);
    };

    loadProducts();
  }, []);

  const isDigital = (product: MarketplaceProduct) => {
    const category = (product.category || '').toLowerCase();
    return category.includes('digital') || category.includes('download') || category.includes('software');
  };

  const filteredProducts = useMemo(() => {
    if (activeTab === 'digital') {
      return products.filter(isDigital);
    }
    if (activeTab === 'physical') {
      return products.filter((product) => !isDigital(product));
    }
    return products;
  }, [activeTab, products]);

  return (
    <PublicLayout>
      <section className="space-y-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold text-gray-900">Marketplace</h1>
          <p className="text-gray-700">Shop physical products and digital downloads with transparent pricing.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
                activeTab === tab.key
                  ? 'bg-amber-500 text-black'
                  : 'border border-gray-300 text-gray-800 hover:border-amber-500 hover:text-amber-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      <section className="mt-6">
        {loading ? (
          <p className="text-gray-700">Loading products…</p>
        ) : filteredProducts.length === 0 ? (
          <div className="space-y-3 text-gray-700">
            <p>No products found for this view.</p>
            <Link to="/add-product" className="text-amber-700 font-semibold hover:text-amber-800">
              Add a product to the marketplace
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProducts.map((product) => (
              <ProductCard
                key={product.id}
                id={product.id}
                title={product.name}
                price={product.sale_price ?? product.price}
                imageUrl={product.image}
                sellerName={product.seller}
              />
            ))}
          </div>
        )}
      </section>
    </PublicLayout>
  );
};

export default MarketplacePage;
