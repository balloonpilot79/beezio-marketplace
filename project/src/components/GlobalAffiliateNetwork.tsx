import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Users, 
  MapPin, 
  Star, 
  TrendingUp, 
  DollarSign, 
  Globe,
  Award,
  MessageCircle,
  Eye,
  Share2,
  Package,
  Filter
} from 'lucide-react';

interface LocalAffiliate {
  id: string;
  name: string;
  profileImage: string;
  location: {
    country: string;
    city: string;
    region: string;
  };
  languages: string[];
  specialties: string[];
  metrics: {
    rating: number;
    totalSales: number;
    conversionRate: number;
    followers: number;
    activeMonths: number;
  };
  commissionTier: 'bronze' | 'silver' | 'gold' | 'platinum';
  marketExpertise: string[];
  socialChannels: {
    instagram?: string;
    tiktok?: string;
    youtube?: string;
    facebook?: string;
    website?: string;
  };
  verificationStatus: 'verified' | 'pending' | 'unverified';
  preferredCategories: string[];
}

interface GlobalAffiliateNetworkProps {
  targetCountry?: string;
  productCategory?: string;
}

const GlobalAffiliateNetwork: React.FC<GlobalAffiliateNetworkProps> = ({ 
  targetCountry = 'US', 
  productCategory = 'electronics' 
}) => {
  const { t } = useTranslation();
  const [affiliates, setAffiliates] = useState<LocalAffiliate[]>([]);
  const [filteredAffiliates, setFilteredAffiliates] = useState<LocalAffiliate[]>([]);
  const [selectedCountry, setSelectedCountry] = useState(targetCountry);
  const [selectedCategory, setSelectedCategory] = useState(productCategory);
  const [filterTier, setFilterTier] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('rating');
  const [loading, setLoading] = useState(false);

  // Mock affiliate data - in production this would come from your API
  const mockAffiliates: LocalAffiliate[] = [
    {
      id: 'aff-us-001',
      name: 'Sarah Chen',
      profileImage: '/api/placeholder/64/64',
      location: { country: 'US', city: 'San Francisco', region: 'California' },
      languages: ['English', 'Chinese'],
      specialties: ['Tech Reviews', 'Gadget Unboxing', 'B2B Sales'],
      metrics: {
        rating: 4.9,
        totalSales: 145000,
        conversionRate: 12.5,
        followers: 85000,
        activeMonths: 24
      },
      commissionTier: 'platinum',
      marketExpertise: ['Electronics', 'Smart Home', 'Mobile Accessories'],
      socialChannels: {
        youtube: '@sarahtech',
        instagram: '@sarahchentech',
        website: 'techwithsarah.com'
      },
      verificationStatus: 'verified',
      preferredCategories: ['electronics', 'tech']
    },
    {
      id: 'aff-de-001',
      name: 'Marcus Weber',
      profileImage: '/api/placeholder/64/64',
      location: { country: 'DE', city: 'Berlin', region: 'Berlin' },
      languages: ['German', 'English'],
      specialties: ['Fashion Content', 'Lifestyle Influencer', 'Brand Partnerships'],
      metrics: {
        rating: 4.7,
        totalSales: 98000,
        conversionRate: 8.2,
        followers: 62000,
        activeMonths: 18
      },
      commissionTier: 'gold',
      marketExpertise: ['Fashion', 'Lifestyle', 'Home Decor'],
      socialChannels: {
        instagram: '@marcusstyle',
        tiktok: '@marcusberlin',
        facebook: 'Marcus Weber Official'
      },
      verificationStatus: 'verified',
      preferredCategories: ['fashion', 'lifestyle']
    },
    {
      id: 'aff-jp-001',
      name: 'Yuki Tanaka',
      profileImage: '/api/placeholder/64/64',
      location: { country: 'JP', city: 'Tokyo', region: 'Tokyo' },
      languages: ['Japanese', 'English'],
      specialties: ['Gaming Content', 'Anime Reviews', 'Tech Tutorials'],
      metrics: {
        rating: 4.8,
        totalSales: 78000,
        conversionRate: 15.3,
        followers: 120000,
        activeMonths: 30
      },
      commissionTier: 'gold',
      marketExpertise: ['Gaming', 'Electronics', 'Entertainment'],
      socialChannels: {
        youtube: '@yukitech',
        tiktok: '@yukitokyo',
        instagram: '@yuki_reviews'
      },
      verificationStatus: 'verified',
      preferredCategories: ['electronics', 'gaming']
    },
    {
      id: 'aff-br-001',
      name: 'Carlos Silva',
      profileImage: '/api/placeholder/64/64',
      location: { country: 'BR', city: 'São Paulo', region: 'São Paulo' },
      languages: ['Portuguese', 'Spanish', 'English'],
      specialties: ['Fashion Reviews', 'Lifestyle Content', 'Beauty Tips'],
      metrics: {
        rating: 4.6,
        totalSales: 56000,
        conversionRate: 9.8,
        followers: 45000,
        activeMonths: 15
      },
      commissionTier: 'silver',
      marketExpertise: ['Fashion', 'Beauty', 'Lifestyle'],
      socialChannels: {
        instagram: '@carlosstyle',
        youtube: '@carlossaopaulo',
        tiktok: '@carlossilva'
      },
      verificationStatus: 'verified',
      preferredCategories: ['fashion', 'beauty']
    }
  ];

  // Countries with affiliate networks
  const countries = [
    { code: 'US', name: 'United States', flag: '🇺🇸', affiliateCount: 1250 },
    { code: 'CA', name: 'Canada', flag: '🇨🇦', affiliateCount: 340 },
    { code: 'DE', name: 'Germany', flag: '🇩🇪', affiliateCount: 890 },
    { code: 'FR', name: 'France', flag: '🇫🇷', affiliateCount: 670 },
    { code: 'UK', name: 'United Kingdom', flag: '🇬🇧', affiliateCount: 980 },
    { code: 'JP', name: 'Japan', flag: '🇯🇵', affiliateCount: 450 },
    { code: 'BR', name: 'Brazil', flag: '🇧🇷', affiliateCount: 380 },
    { code: 'AU', name: 'Australia', flag: '🇦🇺', affiliateCount: 280 },
  ];

  const categories = [
    { id: 'electronics', name: 'Electronics & Tech', icon: '📱' },
    { id: 'fashion', name: 'Fashion & Apparel', icon: '👗' },
    { id: 'beauty', name: 'Beauty & Cosmetics', icon: '💄' },
    { id: 'home', name: 'Home & Garden', icon: '🏠' },
    { id: 'sports', name: 'Sports & Fitness', icon: '⚽' },
    { id: 'books', name: 'Books & Education', icon: '📚' },
  ];

  useEffect(() => {
    setLoading(true);
    // Simulate API call
    setTimeout(() => {
      setAffiliates(mockAffiliates);
      setLoading(false);
    }, 1000);
  }, []);

  useEffect(() => {
    // Filter and sort affiliates
    let filtered = affiliates.filter(affiliate => {
      const countryMatch = selectedCountry === 'all' || affiliate.location.country === selectedCountry;
      const categoryMatch = selectedCategory === 'all' || affiliate.preferredCategories.includes(selectedCategory);
      const tierMatch = filterTier === 'all' || affiliate.commissionTier === filterTier;
      
      return countryMatch && categoryMatch && tierMatch;
    });

    // Sort affiliates
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'rating':
          return b.metrics.rating - a.metrics.rating;
        case 'sales':
          return b.metrics.totalSales - a.metrics.totalSales;
        case 'conversion':
          return b.metrics.conversionRate - a.metrics.conversionRate;
        case 'followers':
          return b.metrics.followers - a.metrics.followers;
        default:
          return 0;
      }
    });

    setFilteredAffiliates(filtered);
  }, [affiliates, selectedCountry, selectedCategory, filterTier, sortBy]);

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'platinum': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'gold': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'silver': return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'bronze': return 'bg-orange-100 text-orange-800 border-orange-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getTierIcon = (tier: string) => {
    switch (tier) {
      case 'platinum': return '💎';
      case 'gold': return '🥇';
      case 'silver': return '🥈';
      case 'bronze': return '🥉';
      default: return '⭐';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center mb-4">
            <Users className="h-12 w-12 text-primary-600 mr-3" />
            <h1 className="text-4xl font-bold text-gray-900">Global Affiliate Network</h1>
          </div>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Connect with top-performing local affiliates in target markets to maximize your global reach and sales
          </p>
        </div>

        {/* Filters and Controls */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            
            {/* Country Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Globe className="h-4 w-4 inline mr-1" />
                Target Country
              </label>
              <select 
                value={selectedCountry}
                onChange={(e) => setSelectedCountry(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
              >
                <option value="all">All Countries</option>
                {countries.map(country => (
                  <option key={country.code} value={country.code}>
                    {country.flag} {country.name} ({country.affiliateCount})
                  </option>
                ))}
              </select>
            </div>

            {/* Category Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Package className="h-4 w-4 inline mr-1" />
                Category
              </label>
              <select 
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
              >
                <option value="all">All Categories</option>
                {categories.map(category => (
                  <option key={category.id} value={category.id}>
                    {category.icon} {category.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Tier Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Award className="h-4 w-4 inline mr-1" />
                Commission Tier
              </label>
              <select 
                value={filterTier}
                onChange={(e) => setFilterTier(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
              >
                <option value="all">All Tiers</option>
                <option value="platinum">💎 Platinum</option>
                <option value="gold">🥇 Gold</option>
                <option value="silver">🥈 Silver</option>
                <option value="bronze">🥉 Bronze</option>
              </select>
            </div>

            {/* Sort By */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Filter className="h-4 w-4 inline mr-1" />
                Sort By
              </label>
              <select 
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
              >
                <option value="rating">⭐ Rating</option>
                <option value="sales">💰 Total Sales</option>
                <option value="conversion">📊 Conversion Rate</option>
                <option value="followers">👥 Followers</option>
              </select>
            </div>

            {/* Search Button */}
            <div className="flex items-end">
              <button className="w-full bg-primary-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-primary-700 transition-colors">
                🔍 Search
              </button>
            </div>
          </div>
        </div>

        {/* Results Summary */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Found {filteredAffiliates.length} affiliates
                {selectedCountry !== 'all' && (
                  <span className="text-primary-600"> in {countries.find(c => c.code === selectedCountry)?.name}</span>
                )}
              </h3>
              <p className="text-gray-600">Top-performing local affiliates ready to promote your products</p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-primary-600">
                ${filteredAffiliates.reduce((sum, aff) => sum + aff.metrics.totalSales, 0).toLocaleString()}
              </div>
              <div className="text-sm text-gray-600">Combined Sales Volume</div>
            </div>
          </div>
        </div>

        {/* Affiliate Grid */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
            <p className="text-gray-600 mt-4">Loading global affiliate network...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredAffiliates.map((affiliate) => (
              <div key={affiliate.id} className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                
                {/* Affiliate Header */}
                <div className="p-6 border-b border-gray-100">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center">
                      <img 
                        src={affiliate.profileImage} 
                        alt={affiliate.name}
                        className="w-16 h-16 rounded-full object-cover mr-4"
                      />
                      <div>
                        <h3 className="text-xl font-bold text-gray-900">{affiliate.name}</h3>
                        <div className="flex items-center text-gray-600 mb-1">
                          <MapPin className="h-4 w-4 mr-1" />
                          <span className="text-sm">{affiliate.location.city}, {affiliate.location.country}</span>
                        </div>
                        <div className="flex items-center">
                          <Star className="h-4 w-4 text-yellow-500 mr-1" />
                          <span className="text-sm font-medium">{affiliate.metrics.rating}</span>
                          <span className={`ml-2 px-2 py-1 rounded-full text-xs border ${getTierColor(affiliate.commissionTier)}`}>
                            {getTierIcon(affiliate.commissionTier)} {affiliate.commissionTier}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    {affiliate.verificationStatus === 'verified' && (
                      <div className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium">
                        ✓ Verified
                      </div>
                    )}
                  </div>

                  {/* Languages */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    {affiliate.languages.map((lang, index) => (
                      <span key={index} className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs">
                        {lang}
                      </span>
                    ))}
                  </div>

                  {/* Specialties */}
                  <div className="flex flex-wrap gap-2">
                    {affiliate.specialties.map((specialty, index) => (
                      <span key={index} className="bg-purple-100 text-purple-800 px-2 py-1 rounded-full text-xs">
                        {specialty}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Metrics */}
                <div className="p-6">
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="text-center">
                      <div className="text-lg font-bold text-green-600">
                        ${affiliate.metrics.totalSales.toLocaleString()}
                      </div>
                      <div className="text-xs text-gray-600">Total Sales</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-blue-600">
                        {affiliate.metrics.conversionRate}%
                      </div>
                      <div className="text-xs text-gray-600">Conversion Rate</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-purple-600">
                        {affiliate.metrics.followers.toLocaleString()}
                      </div>
                      <div className="text-xs text-gray-600">Followers</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-orange-600">
                        {affiliate.metrics.activeMonths}mo
                      </div>
                      <div className="text-xs text-gray-600">Experience</div>
                    </div>
                  </div>

                  {/* Social Channels */}
                  <div className="flex justify-center space-x-3 mb-4">
                    {affiliate.socialChannels.youtube && (
                      <span className="text-red-600">📺</span>
                    )}
                    {affiliate.socialChannels.instagram && (
                      <span className="text-pink-600">📷</span>
                    )}
                    {affiliate.socialChannels.tiktok && (
                      <span className="text-black">🎵</span>
                    )}
                    {affiliate.socialChannels.website && (
                      <span className="text-blue-600">🌐</span>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex space-x-2">
                    <button className="flex-1 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors">
                      🤝 Partner
                    </button>
                    <button className="flex-1 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:border-gray-400 transition-colors">
                      👁️ View Profile
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* CTA Section */}
        <div className="mt-12 text-center">
          <div className="bg-gradient-to-r from-primary-600 to-secondary-600 rounded-xl text-white p-8">
            <h2 className="text-3xl font-bold mb-4">Ready to Build Your Global Network?</h2>
            <p className="text-xl opacity-90 mb-6 max-w-2xl mx-auto">
              Connect with thousands of verified affiliates worldwide and expand your reach in every major market
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button className="bg-white text-primary-600 px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors">
                🚀 Launch Global Campaign
              </button>
              <button className="border-2 border-white text-white px-8 py-3 rounded-lg font-semibold hover:bg-white hover:text-primary-600 transition-colors">
                📊 View Network Analytics
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GlobalAffiliateNetwork;
