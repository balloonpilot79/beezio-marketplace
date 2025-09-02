import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Code, 
  Palette, 
  Megaphone, 
  Camera, 
  BookOpen, 
  Calculator,
  Heart,
  Briefcase,
  Star,
  Clock,
  DollarSign,
  ArrowRight,
  Search,
  Filter
} from 'lucide-react';

interface ServiceCategory {
  id: string;
  title: string;
  icon: React.ComponentType<any>;
  color: string;
  description: string;
  serviceCount: number;
}

interface Service {
  id: string;
  title: string;
  provider: string;
  rating: number;
  reviewCount: number;
  price: {
    type: 'fixed' | 'hourly' | 'package';
    amount: number;
    packages?: { name: string; price: number; features: string[] }[];
  };
  category: string;
  image: string;
  description: string;
  deliveryTime: string;
  affiliateCommission: number;
  featured: boolean;
}

const ServicesPage: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'rating' | 'price' | 'newest'>('rating');

  const categories: ServiceCategory[] = [
    { 
      id: 'web-development', 
      title: 'Web Development', 
      icon: Code, 
      color: 'blue',
      description: 'Custom websites, apps, and e-commerce solutions',
      serviceCount: 156
    },
    { 
      id: 'design', 
      title: 'Design & Graphics', 
      icon: Palette, 
      color: 'purple',
      description: 'Logo design, branding, and visual content',
      serviceCount: 234
    },
    { 
      id: 'marketing', 
      title: 'Digital Marketing', 
      icon: Megaphone, 
      color: 'green',
      description: 'SEO, social media, and advertising campaigns',
      serviceCount: 189
    },
    { 
      id: 'photography', 
      title: 'Photography', 
      icon: Camera, 
      color: 'yellow',
      description: 'Product photos, portraits, and event coverage',
      serviceCount: 78
    },
    { 
      id: 'writing', 
      title: 'Content Writing', 
      icon: BookOpen, 
      color: 'red',
      description: 'Blog posts, copywriting, and content strategy',
      serviceCount: 145
    },
    { 
      id: 'business', 
      title: 'Business Consulting', 
      icon: Briefcase, 
      color: 'indigo',
      description: 'Strategy, operations, and growth consulting',
      serviceCount: 92
    },
    { 
      id: 'finance', 
      title: 'Finance & Accounting', 
      icon: Calculator, 
      color: 'emerald',
      description: 'Bookkeeping, tax prep, and financial planning',
      serviceCount: 67
    },
    { 
      id: 'health', 
      title: 'Health & Wellness', 
      icon: Heart, 
      color: 'pink',
      description: 'Coaching, fitness plans, and wellness services',
      serviceCount: 134
    }
  ];

  const featuredServices: Service[] = [
    {
      id: '1',
      title: 'Complete E-commerce Website Development',
      provider: 'TechCraft Solutions',
      rating: 4.9,
      reviewCount: 127,
      price: { 
        type: 'package', 
        amount: 2999, 
        packages: [
          { name: 'Basic', price: 1499, features: ['5 Pages', 'Basic SEO', 'Mobile Responsive', '30 Days Support'] },
          { name: 'Pro', price: 2999, features: ['15 Pages', 'Advanced SEO', 'E-commerce', 'Payment Integration', '90 Days Support'] },
          { name: 'Enterprise', price: 5999, features: ['Unlimited Pages', 'Custom Features', 'Advanced Analytics', '1 Year Support'] }
        ]
      },
      category: 'web-development',
      image: '/api/placeholder/400/250',
      description: 'Professional e-commerce websites with payment processing, inventory management, and affiliate tracking.',
      deliveryTime: '14-21 days',
      affiliateCommission: 25,
      featured: true
    },
    {
      id: '2',
      title: 'Complete Brand Identity Package',
      provider: 'Design Studio Pro',
      rating: 4.8,
      reviewCount: 89,
      price: { 
        type: 'fixed', 
        amount: 899,
        packages: [
          { name: 'Logo Only', price: 299, features: ['3 Logo Concepts', '5 Revisions', 'High-res Files'] },
          { name: 'Complete Brand', price: 899, features: ['Logo', 'Business Cards', 'Letterhead', 'Brand Guidelines'] },
          { name: 'Brand + Marketing', price: 1499, features: ['Everything Above', 'Social Media Kit', 'Website Mockup'] }
        ]
      },
      category: 'design',
      image: '/api/placeholder/400/250',
      description: 'Complete brand identity including logo, business cards, letterhead, and brand guidelines.',
      deliveryTime: '7-10 days',
      affiliateCommission: 30,
      featured: true
    },
    {
      id: '3',
      title: 'SEO & Digital Marketing Campaign',
      provider: 'Growth Marketing Experts',
      rating: 4.7,
      reviewCount: 156,
      price: { 
        type: 'hourly', 
        amount: 75,
        packages: [
          { name: 'SEO Audit', price: 299, features: ['Website Analysis', 'Keyword Research', 'Action Plan'] },
          { name: 'Monthly SEO', price: 1200, features: ['SEO Optimization', 'Content Creation', 'Monthly Reports'] },
          { name: 'Full Marketing', price: 2500, features: ['SEO + PPC', 'Social Media', 'Email Marketing', 'Analytics'] }
        ]
      },
      category: 'marketing',
      image: '/api/placeholder/400/250',
      description: 'Comprehensive SEO and digital marketing to grow your online presence and drive sales.',
      deliveryTime: 'Ongoing',
      affiliateCommission: 20,
      featured: true
    },
    {
      id: '4',
      title: 'Professional Product Photography',
      provider: 'Visual Impact Studios',
      rating: 4.9,
      reviewCount: 93,
      price: { 
        type: 'fixed', 
        amount: 199,
        packages: [
          { name: '5 Products', price: 199, features: ['5 Products', '3 Angles Each', 'Basic Editing', '24hr Delivery'] },
          { name: '15 Products', price: 499, features: ['15 Products', '5 Angles Each', 'Advanced Editing', 'Lifestyle Shots'] },
          { name: '50 Products', price: 1299, features: ['50 Products', 'Unlimited Angles', 'Premium Editing', 'Video Clips'] }
        ]
      },
      category: 'photography',
      image: '/api/placeholder/400/250',
      description: 'High-quality product photography that showcases your items and increases conversion rates.',
      deliveryTime: '2-3 days',
      affiliateCommission: 35,
      featured: true
    }
  ];

  const getColorClasses = (color: string) => {
    const colorMap: Record<string, string> = {
      blue: 'bg-blue-50 text-blue-700 border-blue-200',
      purple: 'bg-purple-50 text-purple-700 border-purple-200',
      green: 'bg-green-50 text-green-700 border-green-200',
      yellow: 'bg-yellow-50 text-yellow-700 border-yellow-200',
      red: 'bg-red-50 text-red-700 border-red-200',
      indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      pink: 'bg-pink-50 text-pink-700 border-pink-200'
    };
    return colorMap[color] || 'bg-gray-50 text-gray-700 border-gray-200';
  };

  const formatPrice = (price: Service['price']) => {
    if (price.type === 'hourly') {
      return `$${price.amount}/hr`;
    } else if (price.type === 'fixed') {
      return `Starting at $${price.amount}`;
    } else {
      return `Starting at $${price.packages?.[0].price || price.amount}`;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Professional Services Marketplace
            </h1>
            <p className="text-xl mb-8 text-orange-100">
              Connect with skilled professionals and grow your business with our affiliate network
            </p>
            
            {/* Search Bar */}
            <div className="max-w-2xl mx-auto relative">
              <div className="flex bg-white rounded-lg shadow-lg">
                <div className="flex-1 flex items-center">
                  <Search className="w-5 h-5 text-gray-400 ml-4" />
                  <input
                    type="text"
                    placeholder="Search for services..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full px-4 py-4 text-gray-900 bg-transparent border-0 focus:outline-none"
                  />
                </div>
                <button className="bg-orange-600 hover:bg-orange-700 px-8 py-4 rounded-r-lg font-medium transition-colors">
                  Search
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Categories Grid */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Service Categories</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {categories.map((category) => {
              const IconComponent = category.icon;
              return (
                <div
                  key={category.id}
                  className={`p-6 rounded-xl border-2 cursor-pointer transition-all hover:shadow-lg ${
                    selectedCategory === category.id 
                      ? getColorClasses(category.color) 
                      : 'bg-white border-gray-200 hover:border-orange-300'
                  }`}
                  onClick={() => setSelectedCategory(category.id)}
                >
                  <div className="flex items-center mb-3">
                    <IconComponent className="w-8 h-8 mr-3" />
                    <h3 className="font-semibold">{category.title}</h3>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">{category.description}</p>
                  <p className="text-xs font-medium">{category.serviceCount} services</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Filters */}
        <div className="flex flex-wrap items-center justify-between mb-8 bg-white p-4 rounded-lg shadow-sm">
          <div className="flex items-center space-x-4 mb-4 lg:mb-0">
            <Filter className="w-5 h-5 text-gray-500" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            >
              <option value="all">All Categories</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.title}</option>
              ))}
            </select>
          </div>
          
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-600">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'rating' | 'price' | 'newest')}
              className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            >
              <option value="rating">Highest Rated</option>
              <option value="price">Price: Low to High</option>
              <option value="newest">Newest First</option>
            </select>
          </div>
        </div>

        {/* Featured Services */}
        <section className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Featured Services</h2>
            <span className="text-sm text-gray-600 bg-orange-100 px-3 py-1 rounded-full">
              High Commission 20-35%
            </span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-8">
            {featuredServices.map((service) => (
              <div key={service.id} className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow">
                {/* Service Image */}
                <div className="h-48 bg-gray-200 relative">
                  <div className="absolute top-4 left-4">
                    <span className="bg-orange-600 text-white px-2 py-1 rounded-full text-xs font-medium">
                      Featured
                    </span>
                  </div>
                  <div className="absolute top-4 right-4">
                    <span className="bg-green-600 text-white px-2 py-1 rounded-full text-xs font-medium">
                      {service.affiliateCommission}% Commission
                    </span>
                  </div>
                </div>
                
                {/* Service Info */}
                <div className="p-6">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-bold text-lg text-gray-900 leading-tight">
                      {service.title}
                    </h3>
                    <div className="flex items-center text-yellow-500 ml-2">
                      <Star className="w-4 h-4 fill-current" />
                      <span className="text-sm font-medium ml-1">{service.rating}</span>
                      <span className="text-xs text-gray-500 ml-1">({service.reviewCount})</span>
                    </div>
                  </div>
                  
                  <p className="text-gray-600 text-sm mb-3">{service.description}</p>
                  
                  <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                    <div className="flex items-center">
                      <Clock className="w-4 h-4 mr-1" />
                      {service.deliveryTime}
                    </div>
                    <div className="flex items-center">
                      <DollarSign className="w-4 h-4 mr-1" />
                      {formatPrice(service.price)}
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">by {service.provider}</span>
                    <button className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center">
                      View Details
                      <ArrowRight className="w-4 h-4 ml-1" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Benefits Section */}
        <section className="bg-white rounded-xl p-8 shadow-sm">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">Why Choose Beezio Services?</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <DollarSign className="w-8 h-8 text-orange-600" />
              </div>
              <h3 className="font-semibold mb-2">Earn High Commissions</h3>
              <p className="text-gray-600">Promote services and earn 20-35% commission on every sale you refer.</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Star className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="font-semibold mb-2">Vetted Professionals</h3>
              <p className="text-gray-600">All service providers are verified and rated by real customers.</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Briefcase className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="font-semibold mb-2">End-to-End Support</h3>
              <p className="text-gray-600">From project start to completion, we ensure quality delivery.</p>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="mt-12 bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl p-8 text-white text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Start?</h2>
          <p className="text-xl mb-6 text-orange-100">Join thousands of affiliates earning from our services marketplace</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link 
              to="/dashboard" 
              className="bg-white text-orange-600 px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
            >
              Start Promoting Services
            </Link>
            <Link 
              to="/how-it-works" 
              className="border-2 border-white text-white px-8 py-3 rounded-lg font-semibold hover:bg-white hover:text-orange-600 transition-colors"
            >
              Learn How It Works
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
};

export default ServicesPage;
