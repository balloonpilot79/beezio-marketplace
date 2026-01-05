import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useParams } from 'react-router-dom';
import { Search, Heart, Share2, Star, ExternalLink, Copy, CheckCircle, MessageCircle } from 'lucide-react';

// Sample data
const sampleProducts = [
  {
    id: 1,
    name: "Smart Wireless Headphones",
    price: 129.99,
    originalPrice: 159.99,
    affiliate_commission: 20,
    seller: "TechGear Pro",
    seller_id: "techgear123",
    image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400",
    rating: 4.8,
    reviews: 124,
    description: "Premium wireless headphones with noise cancellation"
  },
  {
    id: 2,  
    name: "Eco Water Bottle",
    price: 24.99,
    originalPrice: 34.99,
    affiliate_commission: 20,
    seller: "GreenLiving Co",
    seller_id: "greenliving456",
    image: "https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=400",
    rating: 4.6,
    reviews: 89,
    description: "Sustainable stainless steel water bottle"
  },
  {
    id: 3,
    name: "Artisan Coffee Beans",
    price: 18.99,
    originalPrice: 22.99,
    affiliate_commission: 25,
    seller: "Mountain Roasters",
    seller_id: "mountainroast789",
    image: "https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=400",
    rating: 4.9,
    reviews: 256,
    description: "Single-origin premium coffee beans"
  }
];

const activeFundraisers = [
  {
    id: 1,
    title: "Community Garden Project",
    goal: 5000,
    raised: 3200,
    organizer: "Green Community",
    image: "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=400",
    description: "Help us build a sustainable community garden"
  },
  {
    id: 2,
    title: "Youth Sports Equipment",
    goal: 2500,
    raised: 1800,
    organizer: "Youth Sports Alliance", 
    image: "https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=400",
    description: "Supporting local youth with quality sports equipment"
  }
];

// Simple HomePage for testing
const HomePage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="relative overflow-hidden bg-gradient-to-r from-amber-600 via-orange-600 to-red-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="text-center">
            <h1 className="text-6xl font-bold text-white mb-6">
              Welcome to <span className="text-yellow-300">Beezio</span>
            </h1>
            <p className="text-xl text-gray-100 mb-8 max-w-3xl mx-auto">
              The revolutionary marketplace that puts sellers first with transparent pricing and recurring affiliate commissions.
            </p>
            <div className="flex gap-4 justify-center">
              <button className="bg-white text-orange-600 px-8 py-4 rounded-xl font-bold text-lg hover:bg-gray-100 transition-colors shadow-lg">
                🚀 Start Selling Now
              </button>
              <button className="border-2 border-white text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-white hover:text-orange-600 transition-colors">
                💰 Become an Affiliate
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Quick Stats Section */}
      <div className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Why Choose Beezio?</h2>
            <p className="text-xl text-gray-600">The platform that actually cares about your success</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="text-4xl font-bold text-orange-600 mb-2">0%</div>
              <div className="text-gray-700 font-semibold">Platform Fees</div>
              <p className="text-gray-600 mt-2">Keep 100% of your profits</p>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-orange-600 mb-2">∞</div>
              <div className="text-gray-700 font-semibold">Recurring Commissions</div>
              <p className="text-gray-600 mt-2">Earn forever from every referral</p>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-orange-600 mb-2">24/7</div>
              <div className="text-gray-700 font-semibold">Support</div>
              <p className="text-gray-600 mt-2">We're always here to help</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Test Page Component
const TestPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-red-500 flex items-center justify-center">
      <div className="text-center text-white">
        <h1 className="text-4xl font-bold mb-4">🐝 Test Page</h1>
        <p className="text-xl">This is the test page - it works!</p>
      </div>
    </div>
  );
};

// Header with search and login
const SimpleHeader: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  
  return (
    <header className="bg-white shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <a href="/" className="text-2xl font-bold text-orange-600">
              🐝 Beezio
            </a>
          </div>
          
          <div className="hidden md:flex items-center flex-1 max-w-md mx-8">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Search products, sellers, fundraisers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>
          </div>
          
          <nav className="flex items-center space-x-6">
            <a href="/" className="text-gray-600 hover:text-gray-900">Home</a>
            <a href="/marketplace" className="text-gray-600 hover:text-gray-900">Marketplace</a>
            <a href="/sellers" className="text-gray-600 hover:text-gray-900">Sellers</a>
            <a href="/affiliates" className="text-gray-600 hover:text-gray-900">Affiliates</a>
            <a href="/fundraisers" className="text-gray-600 hover:text-gray-900">Fundraisers</a>
            <button className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700">
              Sign In
            </button>
          </nav>
        </div>
      </div>
    </header>
  );
};

// Enhanced Marketplace Page
const MarketplacePage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Marketplace</h1>
          <button className="bg-orange-600 text-white px-6 py-2 rounded-lg hover:bg-orange-700">
            + List Product
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {sampleProducts.map(product => (
            <div key={product.id} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
              <img src={product.image} alt={product.name} className="w-full h-48 object-cover" />
              <div className="p-6">
                <h3 className="text-lg font-semibold mb-2">{product.name}</h3>
                <p className="text-gray-600 mb-4 text-sm">{product.description}</p>
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex items-center">
                    <Star size={16} className="text-yellow-500 fill-current" />
                    <span className="text-sm text-gray-600 ml-1">{product.rating} ({product.reviews})</span>
                  </div>
                  <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs">
                    {product.affiliate_commission}% Commission
                  </span>
                </div>
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-2xl font-bold text-green-600">${product.price}</span>
                  <span className="text-sm text-gray-500 line-through">${product.originalPrice}</span>
                </div>
                <div className="flex gap-2">
                  <a 
                    href={`/product/${product.id}`}
                    className="flex-1 bg-orange-600 text-white py-2 px-4 rounded text-center hover:bg-orange-700 transition-colors"
                  >
                    View Product
                  </a>
                  <button className="p-2 border border-gray-300 rounded hover:bg-gray-50">
                    <Heart size={16} />
                  </button>
                  <button className="p-2 border border-gray-300 rounded hover:bg-gray-50">
                    <Share2 size={16} />
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  by <a href={`/store/${product.seller_id}`} className="text-blue-600 hover:underline">{product.seller}</a>
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Product Detail Page
const ProductPage: React.FC = () => {
  const { id } = useParams();
  const product = sampleProducts.find(p => p.id === parseInt(id || '1'));
  const [affiliateId, setAffiliateId] = useState('');
  const [showAffiliateForm, setShowAffiliateForm] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!product) return <div className="min-h-screen bg-gray-100 p-8 text-center"><h1>Product not found</h1></div>;

  const generateAffiliateLink = () => {
    if (affiliateId.trim()) {
      const link = `https://beezio.co/product/${product.id}?affiliate=${affiliateId}`;
      navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const potentialEarnings = (product.price * (product.affiliate_commission / 100)).toFixed(2);

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-6xl mx-auto bg-white rounded-lg shadow-lg overflow-hidden">
        <div className="md:flex">
          <div className="md:w-1/2">
            <img src={product.image} alt={product.name} className="w-full h-96 object-cover" />
          </div>
          <div className="md:w-1/2 p-6">
            <div className="flex items-center gap-2 mb-2">
              <Star size={16} className="text-yellow-500 fill-current" />
              <span className="text-sm text-gray-600">{product.rating} ({product.reviews} reviews)</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-800 mb-4">{product.name}</h1>
            <p className="text-gray-600 mb-4">{product.description}</p>
            
            <div className="flex items-center gap-3 mb-4">
              <span className="text-3xl font-bold text-green-600">${product.price}</span>
              <span className="text-lg text-gray-500 line-through">${product.originalPrice}</span>
              <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-sm">
                Save ${(product.originalPrice - product.price).toFixed(2)}
              </span>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg mb-4">
              <h3 className="font-semibold text-blue-800 mb-2">💰 Affiliate Opportunity</h3>
              <p className="text-blue-700 text-sm mb-2">
                Earn {product.affiliate_commission}% commission (${potentialEarnings}) on every sale!
              </p>
              <button 
                onClick={() => setShowAffiliateForm(!showAffiliateForm)}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors text-sm"
              >
                Generate Affiliate Link
              </button>
            </div>

            {showAffiliateForm && (
              <div className="bg-gray-50 p-4 rounded-lg mb-4">
                <input
                  type="text"
                  placeholder="Enter your affiliate ID"
                  value={affiliateId}
                  onChange={(e) => setAffiliateId(e.target.value)}
                  className="w-full p-2 border rounded mb-2"
                />
                <button
                  onClick={generateAffiliateLink}
                  className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                >
                  {copied ? <CheckCircle size={16} /> : <Copy size={16} />}
                  {copied ? 'Link Copied!' : 'Generate & Copy Link'}
                </button>
              </div>
            )}

            <div className="flex gap-3 mb-4">
              <button className="flex-1 bg-orange-600 text-white py-3 rounded-lg font-semibold hover:bg-orange-700 transition-colors">
                Buy Now
              </button>
              <button className="p-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                <Heart size={20} />
              </button>
              <button className="p-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                <Share2 size={20} />
              </button>
            </div>

            <div className="border-t pt-4">
              <p className="text-sm text-gray-600">
                Sold by: <a href={`/store/${product.seller_id}`} className="font-semibold text-blue-600 hover:underline">
                  {product.seller}
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Store Page
const StorePage: React.FC = () => {
  const { storeId } = useParams();
  const storeProducts = sampleProducts.filter(p => p.seller_id === storeId);
  const store = storeProducts[0];
  
  if (!store) return <div className="min-h-screen bg-gray-100 p-8 text-center"><h1>Store not found</h1></div>;

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-xl">
              {store.seller.charAt(0)}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">{store.seller} Store</h1>
              <p className="text-gray-600">Premium quality products with affiliate opportunities</p>
            </div>
          </div>
          <div className="bg-gradient-to-r from-green-50 to-blue-50 p-4 rounded-lg">
            <p className="text-sm text-gray-700">
              🔗 <strong>Share this store:</strong> https://beezio.co/store/{storeId}
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {storeProducts.map(product => (
            <div key={product.id} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
              <img src={product.image} alt={product.name} className="w-full h-48 object-cover" />
              <div className="p-4">
                <h3 className="font-semibold text-gray-800 mb-2">{product.name}</h3>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg font-bold text-green-600">${product.price}</span>
                  <span className="text-sm text-gray-500 line-through">${product.originalPrice}</span>
                </div>
                <div className="flex items-center gap-1 mb-3">
                  <Star size={16} className="text-yellow-500 fill-current" />
                  <span className="text-sm text-gray-600">{product.rating}</span>
                </div>
                <div className="flex gap-2">
                  <a 
                    href={`/product/${product.id}`}
                    className="flex-1 bg-blue-600 text-white py-2 px-4 rounded text-center text-sm hover:bg-blue-700 transition-colors"
                  >
                    View Product
                  </a>
                  <button className="px-3 py-2 border border-gray-300 rounded hover:bg-gray-50 transition-colors">
                    <Share2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Fundraisers Page
const FundraisersPage: React.FC = () => {
  const [showCreateForm, setShowCreateForm] = useState(false);

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-800 mb-2">Community Fundraisers</h1>
              <p className="text-gray-600">Support local causes and make a difference</p>
            </div>
            <button 
              onClick={() => setShowCreateForm(true)}
              className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors"
            >
              Start Fundraiser
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {activeFundraisers.map(fundraiser => {
            const progressPercent = (fundraiser.raised / fundraiser.goal) * 100;
            
            return (
              <div key={fundraiser.id} className="bg-white rounded-lg shadow-md overflow-hidden">
                <img src={fundraiser.image} alt={fundraiser.title} className="w-full h-48 object-cover" />
                <div className="p-6">
                  <h3 className="text-xl font-semibold text-gray-800 mb-2">{fundraiser.title}</h3>
                  <p className="text-gray-600 mb-4">{fundraiser.description}</p>
                  
                  <div className="mb-4">
                    <div className="flex justify-between text-sm text-gray-600 mb-1">
                      <span>${fundraiser.raised.toLocaleString()} raised</span>
                      <span>${fundraiser.goal.toLocaleString()} goal</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-green-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(progressPercent, 100)}%` }}
                      ></div>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{progressPercent.toFixed(1)}% of goal reached</p>
                  </div>

                  <div className="flex justify-between items-center">
                    <p className="text-sm text-gray-600">By: <span className="font-semibold text-blue-600">{fundraiser.organizer}</span></p>
                    <div className="flex gap-2">
                      <button className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors">
                        Donate
                      </button>
                      <button className="p-2 border border-gray-300 rounded hover:bg-gray-50 transition-colors">
                        <Share2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// Sellers Page
const SellersPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Start Selling on Beezio</h1>
          <p className="text-xl text-gray-600">Join the marketplace that puts sellers first</p>
        </div>
        
        <div className="grid md:grid-cols-3 gap-8 mb-12">
          <div className="bg-white p-6 rounded-lg shadow-md text-center">
            <div className="text-4xl font-bold text-orange-600 mb-2">0%</div>
            <h3 className="text-lg font-semibold mb-2">Platform Fees</h3>
            <p className="text-gray-600">Keep 100% of your profits. No hidden fees, no commissions.</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-md text-center">
            <div className="text-4xl font-bold text-orange-600 mb-2">∞</div>
            <h3 className="text-lg font-semibold mb-2">Recurring Income</h3>
            <p className="text-gray-600">Your affiliates earn forever, so you sell forever.</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-md text-center">
            <div className="text-4xl font-bold text-orange-600 mb-2">24/7</div>
            <h3 className="text-lg font-semibold mb-2">Support</h3>
            <p className="text-gray-600">We're here to help you succeed every step of the way.</p>
          </div>
        </div>
        
        <div className="text-center">
          <button className="bg-orange-600 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-orange-700 transition-colors">
            🚀 Start Selling Now
          </button>
        </div>
      </div>
    </div>
  );
};

// Affiliates Page
const AffiliatesPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Become a Beezio Affiliate</h1>
          <p className="text-xl text-gray-600">Earn recurring commissions on every sale, forever</p>
        </div>
        
        <div className="grid md:grid-cols-2 gap-8 mb-12">
          <div className="bg-white p-8 rounded-lg shadow-md">
            <h3 className="text-2xl font-bold mb-4">How It Works</h3>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-orange-600 text-white rounded-full flex items-center justify-center font-bold">1</div>
                <p>Sign up as an affiliate for free</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-orange-600 text-white rounded-full flex items-center justify-center font-bold">2</div>
                <p>Get your unique affiliate links</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-orange-600 text-white rounded-full flex items-center justify-center font-bold">3</div>
                <p>Share products and earn commissions</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-orange-600 text-white rounded-full flex items-center justify-center font-bold">4</div>
                <p>Earn recurring income forever!</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-8 rounded-lg shadow-md">
            <h3 className="text-2xl font-bold mb-4">Why Choose Beezio?</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle className="text-green-600" size={20} />
                <span>Up to 25% commission rates</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="text-green-600" size={20} />
                <span>Recurring commissions for life</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="text-green-600" size={20} />
                <span>Weekly payouts</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="text-green-600" size={20} />
                <span>Real-time tracking dashboard</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="text-green-600" size={20} />
                <span>Marketing materials provided</span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="text-center">
          <button className="bg-green-600 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-green-700 transition-colors">
            💰 Become an Affiliate
          </button>
        </div>
      </div>
    </div>
  );
};

const AppWorkingSimple: React.FC = () => {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <SimpleHeader />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/marketplace" element={<MarketplacePage />} />
          <Route path="/product/:id" element={<ProductPage />} />
          <Route path="/store/:storeId" element={<StorePage />} />
          <Route path="/sellers" element={<SellersPage />} />
          <Route path="/affiliates" element={<AffiliatesPage />} />
          <Route path="/fundraisers" element={<FundraisersPage />} />
        </Routes>
        
        {/* Chat Bot */}
        <div className="fixed bottom-4 right-4 z-50">
          <button className="bg-orange-600 text-white p-3 rounded-full shadow-lg hover:bg-orange-700 transition-colors">
            <MessageCircle size={24} />
          </button>
        </div>
      </div>
    </Router>
  );
};

export default AppWorkingSimple;
