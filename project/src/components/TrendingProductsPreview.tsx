import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingBag } from 'lucide-react';
import { fetchMarketplaceProducts } from '../services/productService';
import { SAMPLE_PRODUCTS } from '../data/sampleProducts';
import { isProductSampleDataEnabled } from '../config/sampleDataConfig';
import {
  calculateSalePriceFromSellerAsk,
  DEFAULT_AFFILIATE_RATE,
  deriveSellerAskFromSalePrice,
  normalizeAffiliateRate,
} from '../utils/pricing';
import ProductCard from './product/ProductCard';
import { Card } from './ui/Card';

type PreviewProduct = {
  id: string;
  name: string;
  image: string;
  seller_ask?: number;
  commission_rate?: number;
  price?: number;
  currency?: string;
};

const TrendingProductsPreview: React.FC = () => {
  const enableSampleData = isProductSampleDataEnabled();
  const [rawProducts, setRawProducts] = useState<PreviewProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const live = await fetchMarketplaceProducts(4);
        if (live.length > 0) {
          setRawProducts(live);
          setLoading(false);
          return;
        }
      } catch (error) {
        console.warn('[TrendingProductsPreview] Falling back to sample data', error);
      }

      if (enableSampleData) {
        setRawProducts(SAMPLE_PRODUCTS.slice(0, 4));
      }
      setLoading(false);
    };

    load();
  }, [enableSampleData]);

  const products = useMemo(() => {
    return rawProducts.slice(0, 4).map((product) => {
      const affiliateRate = normalizeAffiliateRate(product.commission_rate ?? DEFAULT_AFFILIATE_RATE);
      const sellerAsk = (product as any).seller_ask ?? deriveSellerAskFromSalePrice(product.price ?? 0, affiliateRate);
      const salePrice = calculateSalePriceFromSellerAsk(sellerAsk, affiliateRate);

      return {
        ...product,
        sellerAsk,
        salePrice,
        currency: product.currency ?? 'USD',
      };
    });
  }, [rawProducts]);

  const header = (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-xs uppercase text-bz-muted tracking-[0.2em]">Trending</p>
        <h3 className="text-2xl font-bold text-bz-text">Hot picks from the marketplace</h3>
      </div>
      <Link
        to="/marketplace"
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-bz-primary text-black font-semibold shadow hover:-translate-y-0.5 transition-transform"
      >
        <ShoppingBag className="w-4 h-4" />
        View full marketplace
      </Link>
    </div>
  );

  if (loading) {
    return (
      <Card className="bg-bz-surfaceAlt">
        <div className="space-y-4">
          {header}
          <p className="text-sm text-bz-muted">Loading trending products...</p>
        </div>
      </Card>
    );
  }

  if (products.length === 0) {
    return null;
  }

  return (
    <Card className="bg-bz-surfaceAlt">
      <div className="space-y-4">
        {header}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {products.map((product) => (
            <ProductCard
              key={product.id}
              id={product.id}
              title={product.name}
              price={product.salePrice}
              imageUrl={product.image}
            />
          ))}
        </div>
      </div>
    </Card>
  );
};

export default TrendingProductsPreview;
