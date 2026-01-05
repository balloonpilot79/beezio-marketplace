import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Sparkles, Store } from 'lucide-react';
import PublicLayout from '../components/layout/PublicLayout';
import { Card } from '../components/ui/Card';

const FEATURED_STORES = [
  {
    name: 'Luma Labs Co.',
    tagline: 'Productivity dashboards and templates for creators.',
    category: 'Digital products',
    storePath: '/store/luma-labs',
    image:
      'https://images.unsplash.com/photo-1553877522-43269d4ea984?auto=format&fit=crop&w=800&q=80',
  },
  {
    name: 'Harbor Coffee Roasters',
    tagline: 'Small-batch single origin beans with affiliate-ready bundles.',
    category: 'Physical goods',
    storePath: '/store/harbor-coffee',
    image:
      'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=800&q=80',
  },
  {
    name: 'Cause Collective',
    tagline: 'Affiliate-friendly merch drops for community fundraisers.',
    category: 'Fundraiser merch',
    storePath: '/store/cause-collective',
    image:
      'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=800&q=80',
  },
];

const beezioStore = {
  name: 'Beezio Store',
  tagline: 'Beezio-run collections you can promote or shop directly.',
  storePath: '/store/beezio-store',
  image: '/bzobee.png',
};

const StoresPage: React.FC = () => {
  return (
    <PublicLayout>
      <section className="space-y-3">
        <p className="text-sm text-amber-700 font-semibold uppercase tracking-[0.2em]">Stores</p>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold text-gray-900">Featured seller & affiliate stores</h1>
          <p className="text-gray-700">We spotlight different stores and Beezio-run collections.</p>
        </div>
      </section>

      <section className="mt-8 space-y-4">
        {beezioStore && (
          <Card className="overflow-hidden bg-gradient-to-r from-amber-50 via-white to-amber-100 border-amber-100">
            <div className="grid md:grid-cols-2 gap-0 items-center">
              <div className="bg-amber-50/60 flex items-center justify-center py-6 md:py-10">
                <img
                  src={beezioStore.image}
                  alt={beezioStore.name}
                  className="w-full max-w-md h-auto object-contain drop-shadow-xl"
                />
              </div>
              <div className="p-6 md:p-10 space-y-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-200 text-amber-800 text-sm font-semibold shadow-sm">
                  <Sparkles className="w-4 h-4" />
                  Beezio Store
                </div>
                <div className="space-y-2">
                  <h2 className="text-3xl font-semibold text-gray-900">{beezioStore.name}</h2>
                  <p className="text-gray-700 text-lg leading-relaxed max-w-xl">
                    Curated Beezio-run collections you can promote or shop directly. Optimized margins,
                    clean presentation, and ready-made affiliate links for your campaigns.
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <Link
                    to={beezioStore.storePath}
                    className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-amber-500 text-black font-semibold hover:bg-amber-600 transition-colors shadow-md"
                  >
                    View store
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                  <div className="text-sm text-gray-600">
                    Updated weekly • Featured picks first • Affiliate-ready
                  </div>
                </div>
              </div>
            </div>
          </Card>
        )}
      </section>

      <section className="mt-8 space-y-3">
        <h3 className="text-xl font-semibold text-gray-900">Spotlighted sellers & affiliates</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {FEATURED_STORES.map((store) => (
            <Card
              key={store.name}
              className="overflow-hidden h-full flex flex-col bg-gradient-to-b from-amber-50 via-white to-amber-100 border border-amber-100 shadow-lg"
            >
              <div className="aspect-video w-full bg-amber-50">
                <img src={store.image} alt={store.name} className="w-full h-full object-cover" />
              </div>
              <div className="p-5 space-y-3 flex-1 flex flex-col">
                <div className="inline-flex items-center gap-2 text-sm text-amber-800 font-semibold px-3 py-1 bg-amber-200 rounded-full w-fit">
                  <Store className="w-4 h-4" />
                  {store.category}
                </div>
                <h4 className="text-xl font-semibold text-gray-900">{store.name}</h4>
                <p className="text-sm text-gray-700 flex-1 leading-relaxed">{store.tagline}</p>
                <Link
                  to={store.storePath}
                  className="inline-flex items-center gap-2 text-amber-800 font-semibold hover:text-amber-900"
                >
                  Visit store
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </Card>
          ))}
        </div>
      </section>
    </PublicLayout>
  );
};

export default StoresPage;
