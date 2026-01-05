import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Heart, Megaphone, ShoppingBag, Store } from 'lucide-react';
import PublicLayout from '../components/layout/PublicLayout';
import ProductCard from '../components/product/ProductCard';
import { Card } from '../components/ui/Card';
import { fetchMarketplaceProducts } from '../services/productService';
import type { MarketplaceProduct } from '../services/productService';

type HomeProduct = MarketplaceProduct & { sale_price?: number; seller_ask?: number };

interface HomePageProps {
  onOpenSimpleSignup?: () => void;
}

const audience = [
  {
    title: 'Buyers',
    icon: ShoppingBag,
    description:
      'Browse physical products, digital downloads, and fundraiser merch in one place. Prices are final and transparent—no surprise “platform” add-ons at checkout.',
  },
  {
    title: 'Sellers',
    icon: Store,
    description:
      "List products for free, connect your own supplier or inventory, and keep 100% of your ask price. Beezio adds its fees and affiliate rewards on top so you don't lose margin.",
  },
  {
    title: 'Affiliates',
    icon: Megaphone,
    description:
      "Share products and stores with your audience and earn a built-in commission on every sale. On top of that, you earn a lifetime 5% share of Beezio's cut on every affiliate you refer.",
  },
  {
    title: 'Fundraisers',
    icon: Heart,
    description:
      "Launch a campaign with products instead of just donation buttons. Affiliates and supporters help promote your cause, and Beezio's referral share helps you reach your goals faster.",
  },
];

const HomePageBZO: React.FC<HomePageProps> = ({ onOpenSimpleSignup }) => {
  const [products, setProducts] = useState<HomeProduct[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);

  useEffect(() => {
    const loadProducts = async () => {
      try {
        const live = await fetchMarketplaceProducts(8);
        if (live.length) {
          setProducts(live);
          setLoadingProducts(false);
          return;
        }
      } catch (error) {
        console.warn('HomePageBZO: failed to load marketplace products', error);
      }

      setProducts([]);
      setLoadingProducts(false);
    };

    loadProducts();
  }, []);

  const previewProducts = useMemo(() => products.slice(0, 8), [products]);

  return (
    <PublicLayout>
      <section className="space-y-6 relative">
        <p className="text-sm font-semibold text-amber-700 uppercase tracking-[0.2em]">
          Marketplace • Sellers • Affiliates • Fundraisers
        </p>
        <div className="space-y-4">
          <h1 className="text-4xl md:text-5xl font-semibold leading-tight text-gray-900 max-w-3xl">
            Discover products, fundraisers, and opportunities on Beezio.
          </h1>
          <p className="text-lg text-gray-700 max-w-3xl leading-relaxed">
            Beezio is a marketplace where sellers list products, affiliates promote them, and buyers shop with everything baked into the price.
            Every price already includes platform, Stripe, affiliate, and referral rewards. Sellers keep their full ask, supporters earn fairly,
            and buyers see the truth up front.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            to="/marketplace"
            className="inline-flex items-center justify-center px-6 py-3 rounded-full bg-amber-500 text-black font-semibold shadow hover:bg-amber-600 transition-colors"
          >
            Browse marketplace
          </Link>
          <Link
            to="/auth/signup?role=seller"
            onClick={(event) => {
              if (onOpenSimpleSignup) {
                event.preventDefault();
                onOpenSimpleSignup();
              }
            }}
            className="inline-flex items-center justify-center px-6 py-3 rounded-full border border-gray-300 text-gray-900 font-semibold hover:border-amber-500 hover:text-amber-700 transition-colors"
          >
            Start selling
          </Link>
        </div>
        <div className="flex flex-wrap gap-4 text-sm text-gray-700">
          <Link to="/about#affiliates" className="inline-flex items-center gap-2 hover:text-amber-700">
            Want to earn by sharing links? <span className="font-semibold">Become an affiliate</span>
          </Link>
          <span className="hidden sm:block text-gray-300">•</span>
          <Link to="/how-it-works" className="inline-flex items-center gap-2 hover:text-amber-700">
            How Beezio is different
          </Link>
        </div>
        <img
          src="/bzobee.png"
          alt="Beezio mascot"
          className="hidden lg:block absolute right-0 top-1/2 -translate-y-1/2 w-52 h-auto pointer-events-none drop-shadow-xl"
        />
      </section>

      <section className="mt-12 space-y-6">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold text-gray-900">Who Beezio is for</h2>
          <p className="text-gray-600">Four paths, one transparent marketplace.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {audience.map((item) => (
            <Card
              key={item.title}
              className="h-full bg-gradient-to-r from-amber-50 via-white to-amber-100 border border-amber-100 shadow-lg"
            >
              <div className="flex gap-4 items-start p-5">
                <div className="p-3 rounded-full bg-amber-200 text-amber-800 shadow-sm">
                  <item.icon className="w-5 h-5" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold text-gray-900">{item.title}</h3>
                  <p className="text-sm text-gray-700 leading-relaxed">{item.description}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section className="mt-12 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-sm text-gray-600">Marketplace preview</p>
            <h2 className="text-2xl font-semibold text-gray-900">Products ready to shop</h2>
          </div>
          <Link
            to="/marketplace"
            className="inline-flex items-center gap-2 text-amber-700 font-semibold hover:text-amber-800"
          >
            View all products
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        {loadingProducts ? (
          <div className="text-gray-600">Loading products…</div>
        ) : previewProducts.length === 0 ? (
          <div className="text-gray-700">No products yet. Add items from the seller dashboard to populate the marketplace.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {previewProducts.map((product) => (
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

      <section className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-gray-200 pt-8">
        <Link
          to="/stores"
          className="block rounded-2xl bg-gray-50 border border-gray-200 p-6 hover:border-amber-500 hover:bg-amber-50 transition-colors"
        >
          <p className="text-sm text-gray-600">Featured stores</p>
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold text-gray-900">See featured stores</h3>
            <ArrowRight className="w-5 h-5 text-amber-600" />
          </div>
          <p className="text-sm text-gray-700 mt-2">Browse Beezio-run collections and spotlighted sellers.</p>
        </Link>
        <Link
          to="/fundraisers"
          className="block rounded-2xl bg-gray-50 border border-gray-200 p-6 hover:border-amber-500 hover:bg-amber-50 transition-colors"
        >
          <p className="text-sm text-gray-600">Causes</p>
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold text-gray-900">See active fundraisers</h3>
            <ArrowRight className="w-5 h-5 text-amber-600" />
          </div>
          <p className="text-sm text-gray-700 mt-2">Shop campaigns using built-in affiliate + referral rewards.</p>
        </Link>
      </section>
    </PublicLayout>
  );
};

export default HomePageBZO;
