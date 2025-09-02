import React, { useState } from 'react';
import { BrowserRouter as Router, Rou// Product data for demonstration
const sampleProducts = [
  {// Individual Product Page Component
const ProductPage = () => {
  const { id } = useParams();
  const product = sampleProducts.find(p => p.id === parseInt(id || '1'));
  const [affiliateLink, setAffiliateLink] = useState('');
  const [showAffiliateForm, setShowAffiliateForm] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!product) {
    return <div className="min-h-screen bg-gray-100 p-8 text-center">Product not found</div>;
  }

  const generateAffiliateLink = (affiliateId: string) => {
    const baseUrl = 'https://beezio.co';
    return `${baseUrl}/product/${product.id}?affiliate=${affiliateId}`;
  };

  const handleGenerateLink = () => {
    if (affiliateLink.trim()) {
      const link = generateAffiliateLink(affiliateLink);
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
            <img 
              src={product.image} 
              alt={product.name}
              className="w-full h-96 object-cover"
            />
          </div>
          <div className="md:w-1/2 p-6">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-yellow-500">★</span>
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
                  value={affiliateLink}
                  onChange={(e) => setAffiliateLink(e.target.value)}
                  className="w-full p-2 border rounded mb-2"
                />
                <button
                  onClick={handleGenerateLink}
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
                Sold by: <span className="font-semibold text-blue-600 cursor-pointer">
                  {product.seller}
                </span>
              </p>
              <a 
                href={`/store/${product.seller_id}`}
                className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1 mt-1"
              >
                View Store <ExternalLink size={14} />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Seller/Affiliate Store Page
const StorePage = () => {
  const { storeId } = useParams();
  const [storeProducts] = useState(sampleProducts.filter(p => p.seller_id === storeId));
  const store = storeProducts[0];
  
  if (!store) {
    return <div className="min-h-screen bg-gray-100 p-8 text-center">Store not found</div>;
  }

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
const FundraisersPage = () => {
  const [showCreateForm, setShowCreateForm] = useState(false);

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-800 mb-2">Community Fundraisers</h1>
              <p className="text-gray-600">Support local causes and make a difference in your community</p>
            </div>
            <button 
              onClick={() => setShowCreateForm(true)}
              className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors"
            >
              Start Fundraiser
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-6">
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
                    <p className="text-sm text-gray-600">
                      By: <span className="font-semibold text-blue-600">{fundraiser.organizer}</span>
                    </p>
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

        {showCreateForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold">Start a Fundraiser</h3>
                <button 
                  onClick={() => setShowCreateForm(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X size={20} />
                </button>
              </div>
              <form className="space-y-4">
                <input 
                  type="text" 
                  placeholder="Fundraiser Title" 
                  className="w-full p-3 border rounded-lg"
                />
                <textarea 
                  placeholder="Describe your cause..." 
                  className="w-full p-3 border rounded-lg h-24"
                ></textarea>
                <input 
                  type="number" 
                  placeholder="Fundraising Goal ($)" 
                  className="w-full p-3 border rounded-lg"
                />
                <input 
                  type="file" 
                  accept="image/*"
                  className="w-full p-3 border rounded-lg"
                />
                <button 
                  type="submit"
                  className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 transition-colors"
                >
                  Create Fundraiser
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Chat Bot Component
const ChatBot = () => {   id: 1,
    name: "Smart Wireless Headphones",
    price: 129.99,
    originalPrice: 159.99,
    affiliate_commission: 15,
    seller: "TechGear Pro",
    seller_id: "techgear123",
    image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400",
    rating: 4.8,
    reviews: 124,
    description: "Premium wireless headphones with noise cancellation"
  },
  {
    id: 2,
    name: "Eco-Friendly Water Bottle",
    price: 24.99,
    originalPrice: 34.99,
    affiliate_commission: 20,
    seller: "GreenLiving Co",
    seller_id: "greenliving456",
    image: "https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=400",
    rating: 4.6,
    reviews: 89,
    description: "Sustainable stainless steel water bottle with temperature control"
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
    description: "Single-origin premium coffee beans, freshly roasted"
  }
];

// Sample fundraisers
const activeFundraisers = [
  {
    id: 1,
    title: "Help Build Community Garden",
    goal: 5000,
    raised: 3200,
    organizer: "Green Community",
    organizer_id: "greencommunity",
    image: "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=400",
    description: "Creating a sustainable community garden for fresh produce"
  },
  {
    id: 2,
    title: "Local Youth Sports Equipment",
    goal: 2500,
    raised: 1800,
    organizer: "Youth Sports Alliance",
    organizer_id: "youthsports",
    image: "https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=400",
    description: "Supporting local youth with quality sports equipment"
  }
];s, Route, useParams } from 'react-router-dom';
import { Search, MessageCircle, X, Heart, Share2, Star, ExternalLink, Copy, CheckCircle } from 'lucide-react';

// Enhanced Header with Search Bar
const Header = ({ onOpenAuthModal }: { onOpenAuthModal: (modal: any) => void }) => {
  const [showSearch, setShowSearch] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <a href="/" className="text-2xl font-bold text-orange-600">🐝 Beezio</a>
          </div>
          
          {/* Enhanced Navigation */}
          <nav className="hidden md:flex space-x-8">
            <a href="/" className="text-gray-700 hover:text-orange-600 font-medium">Home</a>
            <a href="/products" className="text-gray-700 hover:text-orange-600 font-medium">Products</a>
            <a href="/fundraisers" className="text-gray-700 hover:text-orange-600 font-medium">Fundraisers</a>
            <a href="/affiliates" className="text-gray-700 hover:text-orange-600 font-medium">Affiliates</a>
            <a href="/sellers" className="text-gray-700 hover:text-orange-600 font-medium">Sellers</a>
            <a href="/revolutionary" className="text-gray-700 hover:text-orange-600 font-medium">Revolutionary</a>
          </nav>
          
          {/* Search and Auth */}
          <div className="flex items-center space-x-4">
            {/* Search Button */}
            <button 
              onClick={() => setShowSearch(!showSearch)}
              className="text-gray-700 hover:text-orange-600 p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <Search className="w-5 h-5" />
            </button>
            
            <button 
              onClick={() => onOpenAuthModal({ isOpen: true, mode: 'login' })}
              className="text-gray-700 hover:text-orange-600 font-medium"
            >
              Login
            </button>
            <button 
              onClick={() => onOpenAuthModal({ isOpen: true, mode: 'signup' })}
              className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 font-medium"
            >
              Sign Up
            </button>
          </div>
        </div>
        
        {/* Search Bar */}
        {showSearch && (
          <div className="border-t border-gray-200 py-4">
            <div className="relative max-w-2xl mx-auto">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search products, fundraisers, sellers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                autoFocus
              />
              <button 
                onClick={() => setShowSearch(false)}
                className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

// ChatBot Component
const ChatBot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { type: 'bot', text: 'Hi! I\'m here to help you with Beezio. What would you like to know?' }
  ]);
  const [inputMessage, setInputMessage] = useState('');

  const quickQuestions = [
    'How does transparent pricing work?',
    'What are recurring commissions?',
    'How do I become an affiliate?',
    'How do I start selling?',
    'What makes Beezio different?'
  ];

  const handleSendMessage = () => {
    if (!inputMessage.trim()) return;
    
    setMessages(prev => [...prev, { type: 'user', text: inputMessage }]);
    
    // Simple auto-responses
    setTimeout(() => {
      let response = "Thanks for your question! ";
      if (inputMessage.toLowerCase().includes('transparent')) {
        response = "Great question! Beezio shows customers exactly where every dollar goes - seller gets their desired amount, affiliate gets commission, platform gets fair fee. No hidden charges!";
      } else if (inputMessage.toLowerCase().includes('recurring')) {
        response = "Recurring commissions mean you earn EVERY MONTH customers stay subscribed, not just once like other platforms. You can build $50K+ monthly income!";
      } else if (inputMessage.toLowerCase().includes('affiliate')) {
        response = "Becoming an affiliate is free! Just sign up, choose products to promote, and start earning 25-50% recurring commissions every month. Much better than one-time payouts!";
      } else {
        response = "I'd be happy to help! Beezio is the world's first transparent recurring commission marketplace. Would you like to know about our transparent pricing, recurring commissions, or how to get started?";
      }
      
      setMessages(prev => [...prev, { type: 'bot', text: response }]);
    }, 1000);
    
    setInputMessage('');
  };

  return (
    <>
      {/* Chat Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-orange-600 text-white rounded-full shadow-lg hover:bg-orange-700 transition-colors z-50 flex items-center justify-center"
      >
        <MessageCircle className="w-6 h-6" />
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 w-80 h-96 bg-white rounded-lg shadow-xl border border-gray-200 z-50 flex flex-col">
          {/* Header */}
          <div className="bg-orange-600 text-white p-4 rounded-t-lg flex justify-between items-center">
            <h3 className="font-semibold">Beezio Assistant</h3>
            <button onClick={() => setIsOpen(false)}>
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3">
            {messages.map((message, index) => (
              <div key={index} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-xs px-3 py-2 rounded-lg text-sm ${
                  message.type === 'user' 
                    ? 'bg-orange-600 text-white' 
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {message.text}
                </div>
              </div>
            ))}
          </div>

          {/* Quick Questions */}
          <div className="p-2 border-t border-gray-200">
            <div className="text-xs text-gray-500 mb-2">Quick questions:</div>
            <div className="flex flex-wrap gap-1">
              {quickQuestions.slice(0, 3).map((question, index) => (
                <button
                  key={index}
                  onClick={() => setInputMessage(question)}
                  className="text-xs bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded text-gray-700"
                >
                  {question}
                </button>
              ))}
            </div>
          </div>

          {/* Input */}
          <div className="p-4 border-t border-gray-200">
            <div className="flex gap-2">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Ask me anything..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
              <button
                onClick={handleSendMessage}
                className="bg-orange-600 text-white px-3 py-2 rounded-lg hover:bg-orange-700 text-sm font-medium"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

const HomePage = ({ onOpenAuthModal }: { onOpenAuthModal: (modal: any) => void }) => (
  <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
    {/* Hero Section */}
    <div className="relative overflow-hidden bg-gradient-to-r from-amber-600 via-orange-600 to-red-600">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <div className="text-center">
          <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 tracking-tight">
            🐝 BEEZIO
          </h1>
          <p className="text-xl md:text-2xl text-white/90 mb-8 max-w-3xl mx-auto leading-relaxed">
            The World's First <span className="font-bold">Transparent Recurring Commission</span> Marketplace
          </p>
          <p className="text-lg text-white/80 mb-12 max-w-2xl mx-auto">
            Revolutionary pricing model where everyone wins: sellers get 100% of their desired price, 
            affiliates earn generous recurring commissions every month, and customers see exactly where every dollar goes.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <button 
              onClick={() => onOpenAuthModal({ isOpen: true, mode: 'signup' })}
              className="bg-white text-orange-600 px-8 py-4 rounded-xl font-bold text-lg hover:bg-gray-100 transition-colors shadow-lg"
            >
              🚀 Start Selling Now
            </button>
            <button 
              onClick={() => onOpenAuthModal({ isOpen: true, mode: 'signup' })}
              className="border-2 border-white text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-white hover:text-orange-600 transition-colors"
            >
              💰 Become an Affiliate
            </button>
          </div>
        </div>
      </div>
    </div>

    {/* Features Section */}
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
      <div className="text-center mb-16">
        <h2 className="text-4xl font-bold text-gray-900 mb-4">Why Beezio is Revolutionary</h2>
        <p className="text-xl text-gray-600 max-w-3xl mx-auto">
          Three groundbreaking features that make us the most transparent and profitable marketplace ever created
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="bg-white rounded-2xl p-8 shadow-xl border border-gray-100 hover:shadow-2xl transition-shadow">
          <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl flex items-center justify-center mb-6">
            <span className="text-3xl">👁️</span>
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-4">100% Transparent Pricing</h3>
          <p className="text-gray-600 mb-6 leading-relaxed">
            First marketplace to show customers exactly where every dollar goes. No hidden fees, 
            complete transparency builds unprecedented trust and higher conversion rates.
          </p>
          <div className="bg-blue-50 rounded-lg p-4">
            <p className="text-sm font-semibold text-blue-800">Result: 280% higher conversion rates</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-8 shadow-xl border border-gray-100 hover:shadow-2xl transition-shadow">
          <div className="w-16 h-16 bg-gradient-to-r from-green-500 to-green-600 rounded-xl flex items-center justify-center mb-6">
            <span className="text-3xl">💰</span>
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-4">Monthly Recurring Commissions</h3>
          <p className="text-gray-600 mb-6 leading-relaxed">
            Affiliates earn EVERY MONTH customers stay subscribed. Build true wealth through 
            recurring income instead of one-time payments like other platforms.
          </p>
          <div className="bg-green-50 rounded-lg p-4">
            <p className="text-sm font-semibold text-green-800">Income: 1,800% more than competitors</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-8 shadow-xl border border-gray-100 hover:shadow-2xl transition-shadow">
          <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-purple-600 rounded-xl flex items-center justify-center mb-6">
            <span className="text-3xl">⚡</span>
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-4">Trust-First Architecture</h3>
          <p className="text-gray-600 mb-6 leading-relaxed">
            Transparent pricing creates customer confidence, gamified affiliate system drives 
            engagement, and recurring payments ensure long-term relationships.
          </p>
          <div className="bg-purple-50 rounded-lg p-4">
            <p className="text-sm font-semibold text-purple-800">Trust Score: 98% customer satisfaction</p>
          </div>
        </div>
      </div>
    </div>

    {/* Stats Section */}
    <div className="bg-gradient-to-r from-gray-900 to-gray-800 py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          <div>
            <div className="text-4xl font-bold text-white mb-2">100%</div>
            <div className="text-gray-300">Transparent Pricing</div>
          </div>
          <div>
            <div className="text-4xl font-bold text-white mb-2">1,800%</div>
            <div className="text-gray-300">More Affiliate Income</div>
          </div>
          <div>
            <div className="text-4xl font-bold text-white mb-2">280%</div>
            <div className="text-gray-300">Higher Conversions</div>
          </div>
          <div>
            <div className="text-4xl font-bold text-white mb-2">98%</div>
            <div className="text-gray-300">Customer Trust Score</div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

const ProductsPage = () => (
  <div className="min-h-screen bg-gray-50">
    <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h1 className="text-4xl md:text-6xl font-bold mb-4">🛍️ Products</h1>
        <p className="text-xl mb-8">Discover amazing products with transparent pricing and recurring commissions</p>
      </div>
    </div>

    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="bg-white rounded-xl shadow-md hover:shadow-xl transition-shadow border border-gray-200 overflow-hidden">
            <div className="h-48 bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center">
              <span className="text-4xl">📦</span>
            </div>
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Sample Product {i}</h3>
              <p className="text-gray-600 text-sm mb-3">This is a sample product with transparent pricing and recurring commissions.</p>
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold text-gray-900">${97 + i * 10}</span>
                <button className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors font-medium">
                  View Details
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

const AffiliatesPage = () => (
  <div className="min-h-screen bg-gray-50">
    <div className="bg-gradient-to-r from-green-600 to-teal-600 text-white py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h1 className="text-4xl md:text-6xl font-bold mb-4">💰 Affiliates</h1>
        <p className="text-xl mb-8">Earn monthly recurring commissions that build real wealth</p>
      </div>
    </div>

    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 mb-6">Why Beezio Affiliates Earn More</h2>
          <div className="space-y-6">
            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0 w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                <span className="text-green-600 font-bold">1</span>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Monthly Recurring Commissions</h3>
                <p className="text-gray-600">Earn every month customers stay subscribed, not just once like other platforms.</p>
              </div>
            </div>
            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0 w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                <span className="text-green-600 font-bold">2</span>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Higher Conversion Rates</h3>
                <p className="text-gray-600">Transparent pricing builds trust, leading to 280% higher conversion rates.</p>
              </div>
            </div>
            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0 w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                <span className="text-green-600 font-bold">3</span>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Wealth Building Income</h3>
                <p className="text-gray-600">Build a $50K+ monthly recurring income stream that compounds over time.</p>
              </div>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-8 shadow-xl">
          <h3 className="text-2xl font-bold text-gray-900 mb-6 text-center">Affiliate Income Calculator</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center py-3 border-b">
              <span className="text-gray-600">100 subscribers × $50/month</span>
              <span className="text-2xl font-bold text-green-600">$5,000/month</span>
            </div>
            <div className="flex justify-between items-center py-3 border-b">
              <span className="text-gray-600">500 subscribers × $50/month</span>
              <span className="text-2xl font-bold text-green-600">$25,000/month</span>
            </div>
            <div className="flex justify-between items-center py-3">
              <span className="text-gray-600">1,000 subscribers × $50/month</span>
              <span className="text-2xl font-bold text-green-600">$50,000/month</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

const SellersPage = () => (
  <div className="min-h-screen bg-gray-50">
    <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h1 className="text-4xl md:text-6xl font-bold mb-4">🚀 Sellers</h1>
        <p className="text-xl mb-8">Get 100% of your desired price with transparent, fair pricing</p>
      </div>
    </div>

    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="bg-white rounded-xl p-8 shadow-lg text-center">
          <div className="text-4xl mb-4">💰</div>
          <h3 className="text-xl font-bold text-gray-900 mb-4">100% Your Price</h3>
          <p className="text-gray-600">You set your price, you get your price. No hidden deductions or surprise fees.</p>
        </div>
        <div className="bg-white rounded-xl p-8 shadow-lg text-center">
          <div className="text-4xl mb-4">🤝</div>
          <h3 className="text-xl font-bold text-gray-900 mb-4">Powerful Affiliates</h3>
          <p className="text-gray-600">Our affiliates are motivated by recurring commissions, driving more sales for you.</p>
        </div>
        <div className="bg-white rounded-xl p-8 shadow-lg text-center">
          <div className="text-4xl mb-4">📈</div>
          <h3 className="text-xl font-bold text-gray-900 mb-4">Higher Conversions</h3>
          <p className="text-gray-600">Transparent pricing builds customer trust, increasing your conversion rates.</p>
        </div>
      </div>
    </div>
  </div>
);

const RevolutionaryPage = () => (
  <div className="min-h-screen bg-gray-50">
    <div className="bg-gradient-to-r from-orange-600 to-red-600 text-white py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h1 className="text-4xl md:text-6xl font-bold mb-4">🚀 Revolutionary Features</h1>
        <p className="text-xl mb-8">Why Beezio is unlike any marketplace in the world</p>
      </div>
    </div>

    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div className="space-y-16">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-8">Three Revolutionary Breakthroughs</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl flex items-center justify-center mb-6">
              <span className="text-3xl">👁️</span>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-4">100% Transparent Pricing</h3>
            <p className="text-lg text-gray-600 mb-6">
              Beezio is the first marketplace to show customers exactly where every dollar goes. 
              Complete transparency builds unprecedented trust and eliminates the "hidden fee anxiety" 
              that kills conversions on other platforms.
            </p>
            <div className="bg-blue-50 rounded-lg p-6">
              <div className="text-sm font-semibold text-blue-800 mb-2">Industry Impact:</div>
              <div className="text-2xl font-bold text-blue-900">280% Higher Conversion Rates</div>
            </div>
          </div>
          <div className="bg-gradient-to-br from-blue-100 to-blue-200 rounded-2xl p-12 text-center">
            <div className="text-6xl mb-4">🔍</div>
            <div className="text-lg font-semibold text-blue-900">Customer sees:</div>
            <div className="text-sm text-blue-800 mt-2">Product: $100 | Affiliate: $35 | Platform: $10 | Seller Gets: $100</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="bg-gradient-to-br from-green-100 to-green-200 rounded-2xl p-12 text-center order-2 lg:order-1">
            <div className="text-6xl mb-4">📈</div>
            <div className="text-lg font-semibold text-green-900">Monthly Income Growth:</div>
            <div className="text-sm text-green-800 mt-2">Month 1: $2,500 | Month 6: $15,000 | Month 12: $30,000</div>
          </div>
          <div className="order-1 lg:order-2">
            <div className="w-16 h-16 bg-gradient-to-r from-green-500 to-green-600 rounded-xl flex items-center justify-center mb-6">
              <span className="text-3xl">💰</span>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-4">Monthly Recurring Commissions</h3>
            <p className="text-lg text-gray-600 mb-6">
              While other platforms pay affiliates once, Beezio pays them EVERY MONTH customers stay subscribed. 
              This creates a wealth-building income stream that compounds over time, making our affiliates 
              the most motivated in the industry.
            </p>
            <div className="bg-green-50 rounded-lg p-6">
              <div className="text-sm font-semibold text-green-800 mb-2">Affiliate Advantage:</div>
              <div className="text-2xl font-bold text-green-900">1,800% More Lifetime Income</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-purple-600 rounded-xl flex items-center justify-center mb-6">
              <span className="text-3xl">⚡</span>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-4">Trust-First Architecture</h3>
            <p className="text-lg text-gray-600 mb-6">
              By combining transparent pricing with recurring commissions, we've created a marketplace 
              where everyone wins. Customers trust us more, affiliates are more motivated, and sellers 
              get higher conversion rates and more loyal customers.
            </p>
            <div className="bg-purple-50 rounded-lg p-6">
              <div className="text-sm font-semibold text-purple-800 mb-2">Customer Trust:</div>
              <div className="text-2xl font-bold text-purple-900">98% Satisfaction Score</div>
            </div>
          </div>
          <div className="bg-gradient-to-br from-purple-100 to-purple-200 rounded-2xl p-12 text-center">
            <div className="text-6xl mb-4">🤝</div>
            <div className="text-lg font-semibold text-purple-900">The Result:</div>
            <div className="text-sm text-purple-800 mt-2">Win-Win-Win for Everyone</div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

const TestPage = () => (
  <div style={{ 
    backgroundColor: 'red', 
    color: 'white', 
    padding: '50px', 
    fontSize: '24px',
    textAlign: 'center',
    minHeight: '100vh'
  }}>
    <h1 style={{ fontSize: '48px', marginBottom: '20px' }}>🚀 TEST PAGE IS WORKING! 🚀</h1>
    <p>If you can see this red page, React is working!</p>
    <p>Current time: {new Date().toLocaleTimeString()}</p>
    <div style={{ marginTop: '30px' }}>
      <h2>✅ Server Status: RUNNING</h2>
      <h2>✅ React Status: WORKING</h2>
      <h2>✅ Routing Status: WORKING</h2>
    </div>
  </div>
);

// Main App Component
const AppClean: React.FC = () => {
  const [authModal, setAuthModal] = useState({ isOpen: false, mode: 'login' });

  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <Header onOpenAuthModal={setAuthModal} />
        
        <main>
          <Routes>
            <Route path="/" element={<HomePage onOpenAuthModal={setAuthModal} />} />
            <Route path="/products" element={<ProductsPage />} />
            <Route path="/affiliates" element={<AffiliatesPage />} />
            <Route path="/sellers" element={<SellersPage />} />
            <Route path="/revolutionary" element={<RevolutionaryPage />} />
            <Route path="/test" element={<TestPage />} />
          </Routes>
        </main>

        {/* Simple Auth Modal */}
        {authModal.isOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">
                  {authModal.mode === 'login' ? 'Login' : 'Sign Up'}
                </h2>
                <button
                  onClick={() => setAuthModal({ isOpen: false, mode: 'login' })}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>
              <div className="space-y-4">
                <input
                  type="email"
                  placeholder="Email"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
                <input
                  type="password"
                  placeholder="Password"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
                <button className="w-full bg-orange-600 text-white py-3 rounded-lg hover:bg-orange-700 font-medium">
                  {authModal.mode === 'login' ? 'Login' : 'Sign Up'}
                </button>
                <div className="text-center">
                  <button
                    onClick={() => setAuthModal(prev => ({ 
                      ...prev, 
                      mode: prev.mode === 'login' ? 'signup' : 'login' 
                    }))}
                    className="text-orange-600 hover:text-orange-700 font-medium"
                  >
                    {authModal.mode === 'login' 
                      ? "Don't have an account? Sign up" 
                      : "Already have an account? Login"
                    }
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Router>
  );
};

export default AppClean;
