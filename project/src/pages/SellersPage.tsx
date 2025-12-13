import React, { useMemo, useState } from 'react';
import { DollarSign, Shield, Zap, Globe, Link as LinkIcon } from 'lucide-react';
import { Link } from 'react-router-dom';

const SellersPage: React.FC = () => {
  const storeSamples = useMemo(
    () => [
      {
        id: 'seller',
        label: 'Seller Store',
        title: 'Wild Honey Collective',
        subtitle: 'Premium artisan storefront',
        gradient: 'from-amber-500 via-orange-500 to-amber-600',
        previewImage:
          'https://images.unsplash.com/photo-1470246973918-29a93221c455?auto=format&fit=crop&w=800&q=80',
        slug: 'seller-store',
        guides: [
          {
            title: 'Hero Banner & CTA',
            description:
              'Open Store Customization → Hero, upload a cover photo, and add your brand promise with a primary button.',
          },
          {
            title: 'Story Strip',
            description:
              'Use Custom Blocks to highlight origin story, ingredients list, or maker photos.',
          },
          {
            title: 'Product Grid',
            description:
              'In Product Manager, pin three featured items to appear first on your storefront.',
          },
        ],
      },
      {
        id: 'affiliate',
        label: 'Affiliate Store',
        title: 'Maya Chen Studio',
        subtitle: 'Lifestyle picks + referral rewards',
        gradient: 'from-purple-600 via-indigo-600 to-slate-900',
        previewImage:
          'https://images.unsplash.com/photo-1475180098004-ca77a66827be?auto=format&fit=crop&w=800&q=80',
        slug: 'affiliate-store',
        guides: [
          {
            title: 'Pinned Collections',
            description:
              'From Affiliate Dashboard, add marketplace products to “My Storefront” and group them by vibe.',
          },
          {
            title: 'Referral Promo',
            description:
              'Display the “5% referral rewards for life” badge using the Marketing strip block.',
          },
          {
            title: 'Link Hub CTA',
            description:
              'Add social icons + QR download pack so followers can shop from reels, livestreams, or in-person events.',
          },
        ],
      },
      {
        id: 'fundraiser',
        label: 'Fundraiser Store',
        title: 'River City Robotics',
        subtitle: 'Support a mission with every purchase',
        gradient: 'from-emerald-500 via-teal-500 to-cyan-600',
        previewImage:
          'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=800&q=80',
        slug: 'fundraiser-store',
        guides: [
          {
            title: 'Impact Tracker',
            description:
              'Enable Fundraiser Percent inside Store Settings and add a “Funds raised” counter block.',
          },
          {
            title: 'Sponsor Wall',
            description:
              'Create a Custom Page for partner shout-outs, volunteer photos, and progress updates.',
          },
          {
            title: 'Volunteer CTA',
            description:
              'Use dual buttons to link to donation forms and “Join the cause” signup flows.',
          },
        ],
      },
    ],
    []
  );

  const [activeStoreId, setActiveStoreId] = useState(storeSamples[0].id);
  const activeStore = storeSamples.find((sample) => sample.id === activeStoreId) ?? storeSamples[0];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <section className="bg-gradient-to-r from-amber-400 via-orange-500 to-amber-600 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-6xl font-bold mb-6">For Sellers</h1>
          <p className="text-xl md:text-2xl opacity-90 max-w-3xl mx-auto">
            Turn your products into profit with our transparent marketplace
          </p>
        </div>
      </section>

      {/* Sample Affiliate Store Preview */}
      <section className="py-16 bg-slate-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-5">
              <p className="text-sm uppercase tracking-wide text-amber-300 font-semibold">Sample Affiliate Store</p>
              <h2 className="text-3xl font-bold leading-tight">
                Give affiliates a beautiful storefront that updates itself.
              </h2>
              <p className="text-lg text-white/80">
                Affiliates can pin your products, add their own hero copy, and share a single URL across social channels. Every promoted product syncs automatically—no spreadsheets required.
              </p>
              <ul className="space-y-3 text-white/80 text-sm">
                <li className="flex items-start gap-3"><span className="mt-1">✨</span>Drag-and-drop featured products or auto-pull from the marketplace.</li>
                <li className="flex items-start gap-3"><span className="mt-1">📱</span>Instant previews for reels, stories, QR flyers, and text campaigns.</li>
                <li className="flex items-start gap-3"><span className="mt-1">🔁</span>Lifetime 5% referral rewards are promoted right inside the affiliate dashboard.</li>
              </ul>
            </div>

            <div className="bg-gradient-to-br from-purple-600 via-indigo-600 to-slate-900 rounded-3xl p-8 shadow-2xl border border-white/10">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-white/70">Affiliate Picks</p>
                  <h3 className="text-2xl font-semibold">Maya Chen Studio</h3>
                </div>
                <span className="px-3 py-1 rounded-full bg-white/10 text-xs font-semibold">Live</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  {
                    title: 'Glow Ritual Serum',
                    tag: 'Viral',
                    img: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=500&q=80',
                  },
                  {
                    title: 'Mindful Living Course',
                    tag: 'Digital Drop',
                    img: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=500&q=80',
                  },
                  {
                    title: 'Handmade Aromatherapy Set',
                    tag: 'Cause Partner',
                    img: 'https://images.unsplash.com/photo-1449247709967-d4461a6a6103?auto=format&fit=crop&w=500&q=80',
                  },
                  {
                    title: 'Weekend Reset Bundle',
                    tag: 'Gift Guide',
                    img: 'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=500&q=80',
                  },
                ].map((item) => (
                  <div key={item.title} className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
                    <div className="aspect-square rounded-xl overflow-hidden bg-white/10">
                      <img src={item.img} alt={item.title} className="w-full h-full object-cover" />
                    </div>
                    <span className="inline-flex items-center px-3 py-1 rounded-full bg-white/10 text-xs text-white/70">{item.tag}</span>
                    <p className="font-semibold text-white">{item.title}</p>
                    <button className="w-full py-2 text-sm font-semibold rounded-xl bg-white text-slate-900 hover:bg-amber-100 transition-colors">
                      View Product
                    </button>
                  </div>
                ))}
              </div>
              <p className="text-white/70 text-xs mt-5 text-center">
                Affiliates can clone this layout, embed QR flyers, and keep every call-to-action synced across devices.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Store Explorer & Guides */}
      <section className="py-16 bg-gray-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-10">
            <div>
              <p className="text-sm uppercase tracking-[0.4em] text-amber-300 mb-3">Store Explorer</p>
              <h2 className="text-3xl font-bold">Click through live samples and learn how to build each section.</h2>
            </div>
            <div className="flex flex-wrap gap-3 mt-6 lg:mt-0">
              {storeSamples.map((sample) => (
                <button
                  key={sample.id}
                  onClick={() => setActiveStoreId(sample.id)}
                  className={`px-5 py-2 rounded-full text-sm font-semibold transition-colors ${
                    activeStoreId === sample.id
                      ? 'bg-white text-gray-900'
                      : 'bg-white/10 text-white/70 hover:bg-white/20'
                  }`}
                >
                  {sample.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-10">
            <div
              className={`rounded-3xl p-1 bg-gradient-to-br ${activeStore.gradient} shadow-2xl border border-white/10`}
            >
              <div className="bg-gray-950/80 rounded-[22px] overflow-hidden">
                <div className="flex items-center justify-between px-6 py-5 border-b border-white/10">
                  <div>
                    <p className="text-xs uppercase tracking-[0.4em] text-white/60">{activeStore.label}</p>
                    <h3 className="text-2xl font-semibold">{activeStore.title}</h3>
                    <p className="text-sm text-white/70">{activeStore.subtitle}</p>
                  </div>
                  <Link
                    to={`/${activeStore.slug}`}
                    className="px-4 py-2 rounded-full bg-white text-gray-900 text-xs font-semibold shadow"
                  >
                    Explore sample
                  </Link>
                </div>
                <div className="aspect-video bg-gray-900">
                  <img
                    src={activeStore.previewImage}
                    alt={activeStore.title}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-white/80">
                  <div className="bg-white/5 rounded-2xl p-4">
                    <p className="text-xs uppercase tracking-[0.3em] text-white/60 mb-2">Store blocks</p>
                    <p>Hero banner · Story strip · Featured grid · CTA strip</p>
                  </div>
                  <div className="bg-white/5 rounded-2xl p-4">
                    <p className="text-xs uppercase tracking-[0.3em] text-white/60 mb-2">Ready-made assets</p>
                    <p>Brand palette · Mockup images · QR downloads</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-3xl shadow-xl p-8 text-gray-900">
              <p className="text-sm uppercase tracking-[0.4em] text-amber-500 mb-4">Mini guide</p>
              <h3 className="text-2xl font-semibold mb-6">Build this layout in four steps</h3>
              <div className="space-y-5">
                {activeStore.guides.map((guide, index) => (
                  <div key={guide.title} className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-700 font-bold flex items-center justify-center">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-semibold">{guide.title}</p>
                      <p className="text-sm text-gray-600 leading-relaxed">{guide.description}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-8 bg-gray-50 border border-gray-200 rounded-2xl p-4 text-sm text-gray-600">
                Need help? Open Store Customization → Guided Mode and match the steps above. Every block has tooltips, presets, and preview links so you can move fast.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Sample Seller Store Preview */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-10 items-center">
            <div className="space-y-4">
              <p className="text-sm uppercase tracking-wide text-amber-600 font-semibold">Sample Store</p>
              <h2 className="text-3xl font-bold text-gray-900 leading-tight">
                See what your Beezio storefront looks like on desktop, tablet, and phone.
              </h2>
              <p className="text-lg text-gray-600">
                Your brand stays front-and-center with a clean header, bold hero, and a responsive product grid.
                Everything adapts automatically—no extra work to make it mobile-ready.
              </p>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 shadow-sm">
                  <p className="text-sm font-semibold text-amber-700 mb-1">Desktop & Tablet</p>
                  <p className="text-sm text-gray-700">Two or three-column layouts with large imagery, clear CTAs, and sticky add-to-cart on long pages.</p>
                </div>
                <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 shadow-sm">
                  <p className="text-sm font-semibold text-indigo-700 mb-1">Mobile</p>
                  <p className="text-sm text-gray-700">Single-column cards, touch-friendly buttons, and a fixed bottom checkout bar for quick purchases.</p>
                </div>
              </div>
            </div>

            <div className="relative">
              <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-3xl p-6 shadow-2xl">
                <div className="flex items-center justify-between text-white mb-4">
                  <div className="space-y-1">
                    <p className="text-sm uppercase tracking-wide text-amber-300">Wild Honey Co.</p>
                    <h3 className="text-xl font-semibold">Handcrafted Storefront</h3>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-amber-500 text-black text-xs font-bold">Live Preview</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { title: 'Local Honey Flight', tag: 'Bestseller', img: 'https://images.unsplash.com/photo-1506617420156-8e4536971650?auto=format&fit=crop&w=400&q=80' },
                    { title: 'Citrus Blossom Jar', tag: 'Seasonal', img: 'https://images.unsplash.com/photo-1501004318641-b39e6451bec6?auto=format&fit=crop&w=400&q=80' },
                    { title: 'Bee Balm Kit', tag: 'Limited Drop', img: 'https://images.unsplash.com/photo-1514996937319-344454492b37?auto=format&fit=crop&w=400&q=80' },
                    { title: 'Wooden Honey Dipper', tag: 'Essential', img: 'https://images.unsplash.com/photo-1521917441209-e886f0404a7b?auto=format&fit=crop&w=400&q=80' },
                  ].map((product) => (
                    <div key={product.title} className="bg-white rounded-2xl overflow-hidden shadow-md border border-gray-200 flex flex-col">
                      <div className="aspect-square bg-gray-100">
                        <img src={product.img} alt={product.title} className="w-full h-full object-cover" />
                      </div>
                      <div className="p-3 flex-1 flex flex-col">
                        <p className="font-semibold text-gray-900">{product.title}</p>
                        <p className="text-sm text-amber-600 mt-1 mb-3 font-semibold">{product.tag}</p>
                        <div className="mt-auto flex items-center justify-between">
                          <span className="text-xs uppercase tracking-wide text-gray-500">Ships nationwide</span>
                          <button className="text-white bg-amber-500 hover:bg-amber-600 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors">
                            View
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 text-center text-sm text-amber-100">
                  Built with Beezio blocks — already optimized for phones, tablets, and desktops.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works for Sellers */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Launch in Minutes</h2>
            <p className="text-xl text-gray-600">Upload your products, personalize your storefront, and invite partners</p>
          </div>

          <div className="max-w-4xl mx-auto">
            {/* For Sellers */}
            <div className="bg-white rounded-lg shadow-lg p-8 text-center">
              <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <DollarSign className="h-8 w-8 text-amber-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">How Selling Works</h3>
              <div className="space-y-4 text-left max-w-2xl mx-auto">
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-white text-sm font-bold">1</span>
                  </div>
                  <p className="text-gray-600">Upload products, add descriptions, and showcase your brand story.</p>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-white text-sm font-bold">2</span>
                  </div>
                  <p className="text-gray-600">Invite affiliates and fundraisers or make your store discoverable in the Beezio marketplace.</p>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-white text-sm font-bold">3</span>
                  </div>
                  <p className="text-gray-600">Publish your storefront with one click—desktop, tablet, and mobile layouts are ready out of the box.</p>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-white text-sm font-bold">4</span>
                  </div>
                  <p className="text-gray-600">Track sales, payouts, and affiliate activity from a single dashboard.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Referral Rewards Highlight */}
      <section className="py-16 bg-slate-900 text-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <p className="text-sm uppercase tracking-[0.4em] text-amber-300">Affiliate & Seller Advantage</p>
            <h2 className="text-3xl font-bold mb-4">5% Referral Rewards for Life</h2>
            <p className="text-lg text-white/80 max-w-3xl mx-auto">
              Invite new affiliates to Beezio and earn a lifetime 5% reward on every sale they generate. It stacks on top of your own storefront earnings, so your network works even when you are offline.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                title: 'Share your invite link',
                description: 'Every affiliate has a unique referral URL. Post it on your storefront, social channels, and onboarding emails.',
              },
              {
                title: 'They sell, you earn',
                description: 'When a referred affiliate lands a sale, you automatically receive 5% of the checkout amount—forever.',
              },
              {
                title: 'Stacked passive income',
                description: 'Referral rewards combine with your seller payouts and affiliate commissions so you can grow recurring revenue in the background.',
              },
            ].map((item) => (
              <div key={item.title} className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur">
                <h3 className="text-xl font-semibold text-white mb-2">{item.title}</h3>
                <p className="text-white/80 text-sm leading-relaxed">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Why Sell on Beezio?</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="bg-white rounded-lg shadow-md p-6 text-center">
              <Shield className="h-12 w-12 text-amber-500 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-900 mb-2">Secure & Trusted</h3>
              <p className="text-gray-600">Bank-level security with Stripe payment processing</p>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6 text-center">
              <Globe className="h-12 w-12 text-blue-600 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-900 mb-2">Global Reach</h3>
              <p className="text-gray-600">Sell to customers worldwide with built-in affiliate network</p>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6 text-center">
              <Zap className="h-12 w-12 text-purple-600 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-900 mb-2">Easy Setup</h3>
              <p className="text-gray-600">List products in minutes, start selling immediately</p>
            </div>
          </div>
        </div>
      </section>

      {/* Seller Tools and Features */}
      <section className="py-16 bg-gradient-to-r from-amber-50 to-orange-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">🛠️ Seller Tools & Features</h2>
            <p className="text-xl text-gray-600">Everything you need to succeed, included from day one</p>
          </div>

          <div className="max-w-4xl mx-auto">
            <div className="space-y-4">
              <div className="bg-white rounded-lg p-6 shadow-md border-l-4 border-blue-500">
                <h4 className="font-semibold text-gray-900 mb-2">Custom Storefronts</h4>
                <p className="text-gray-600 text-sm">Professional, mobile-responsive stores with your branding, custom domains, and SEO optimization.</p>
              </div>
              
              <div className="bg-white rounded-lg p-6 shadow-md border-l-4 border-amber-500">
                <h4 className="font-semibold text-gray-900 mb-2">RESTful API Integration</h4>
                <p className="text-gray-600 text-sm">Sync inventory, manage orders, and integrate with your existing systems through our comprehensive API.</p>
              </div>
              
              <div className="bg-white rounded-lg p-6 shadow-md border-l-4 border-purple-500">
                <h4 className="font-semibold text-gray-900 mb-2">Advanced Analytics Dashboard</h4>
                <p className="text-gray-600 text-sm">Real-time sales tracking, customer insights, conversion metrics, and exportable reports.</p>
              </div>
              
              <div className="bg-white rounded-lg p-6 shadow-md border-l-4 border-amber-500">
                <h4 className="font-semibold text-gray-900 mb-2">Integrated Payment Processing</h4>
                <p className="text-gray-600 text-sm">Stripe integration with automatic payouts, subscription billing, and multi-currency support.</p>
              </div>
              
              <div className="bg-white rounded-lg p-6 shadow-md border-l-4 border-red-500">
                <h4 className="font-semibold text-gray-900 mb-2">Product Management</h4>
                <p className="text-gray-600 text-sm">Easy product uploads, image galleries, detailed descriptions, and category organization.</p>
              </div>
              
              <div className="bg-white rounded-lg p-6 shadow-md border-l-4 border-indigo-500">
                <h4 className="font-semibold text-gray-900 mb-2">Affiliate Network Access</h4>
                <p className="text-gray-600 text-sm">Connect with motivated affiliates, set commission rates, and track performance metrics.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Seller Dashboard Preview */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Experience Your Seller Dashboard</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              See exactly what you'll have access to as a Beezio seller. No registration required!
            </p>
          </div>

          <div className="max-w-md mx-auto">
            {/* Seller Dashboard Preview */}
            <div className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow">
              <div className="bg-gradient-to-r from-amber-500 to-orange-600 p-6 text-white">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold">Seller Dashboard</h3>
                  <DollarSign className="h-8 w-8" />
                </div>
                <p className="mt-2 opacity-90">Complete sales management suite</p>
              </div>
              <div className="p-6">
                <div className="space-y-3 mb-6">
                  <div className="flex items-center text-gray-700">
                    <div className="w-2 h-2 bg-amber-500 rounded-full mr-3"></div>
                    Revenue Analytics & Tracking
                  </div>
                  <div className="flex items-center text-gray-700">
                    <div className="w-2 h-2 bg-amber-500 rounded-full mr-3"></div>
                    Product Management Tools
                  </div>
                  <div className="flex items-center text-gray-700">
                    <div className="w-2 h-2 bg-amber-500 rounded-full mr-3"></div>
                    Affiliate Recruitment System
                  </div>
                  <div className="flex items-center text-gray-700">
                    <div className="w-2 h-2 bg-amber-500 rounded-full mr-3"></div>
                    Performance Insights
                  </div>
                  <div className="flex items-center text-gray-700">
                    <div className="w-2 h-2 bg-amber-500 rounded-full mr-3"></div>
                    Order Management
                  </div>
                  <div className="flex items-center text-gray-700">
                    <div className="w-2 h-2 bg-amber-500 rounded-full mr-3"></div>
                    Payout Tracking
                  </div>
                </div>
                <Link 
                  to="/dashboard-preview"
                  className="w-full bg-amber-500 text-black py-3 px-4 rounded-lg font-semibold hover:bg-amber-600 transition-colors flex items-center justify-center"
                >
                  <LinkIcon className="h-4 w-4 mr-2" />
                  Preview Seller Dashboard
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-16 bg-gradient-to-r from-amber-500 to-orange-600">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-white">
          <h2 className="text-3xl font-bold mb-4">Ready to Start Selling?</h2>
          <p className="text-xl mb-8 opacity-90">
            Join thousands of sellers building successful businesses on Beezio
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button className="bg-white text-amber-600 px-8 py-3 rounded-lg text-lg hover:bg-gray-100 transition-colors font-semibold">
              Start Selling Today
            </button>
            <Link 
              to="/dashboard-preview"
              className="bg-transparent border-2 border-white text-white px-8 py-3 rounded-lg text-lg hover:bg-white hover:text-amber-600 transition-colors font-semibold"
            >
              Preview Dashboard
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default SellersPage;
