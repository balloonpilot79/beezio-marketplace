import React, { useState } from 'react';
import { Copy, Download, Share2, TrendingUp, DollarSign, Calendar, Users, Target, Lightbulb, FileText, Video, Instagram, Twitter, Mail, MessageSquare } from 'lucide-react';

interface MarketingMaterial {
  id: string;
  type: 'social' | 'email' | 'video' | 'landing' | 'infographic';
  title: string;
  description: string;
  content: string;
  platform?: string;
  estimatedReach?: number;
  conversionRate?: number;
}

const RecurringIncomeMarketing: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [copiedItem, setCopiedItem] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const marketingMaterials: MarketingMaterial[] = [
    {
      id: 'linkedin-post-1',
      type: 'social',
      platform: 'LinkedIn',
      title: 'Recurring vs One-Time Commissions',
      description: 'Professional post highlighting the income difference',
      estimatedReach: 2500,
      conversionRate: 3.2,
      content: `🚀 AFFILIATE MARKETERS: Stop leaving money on the table!

Traditional affiliate programs pay you ONCE per sale.
Beezio pays you EVERY MONTH for the same customer.

Real example:
• Customer buys $150/month software
• You earn 35% = $52.50 EVERY MONTH
• Customer stays 18 months = $945 total earnings
• vs. $52.50 one-time with traditional programs

100 subscribers = $5,250 MONTHLY RECURRING INCOME

Ready to build real wealth? 
Link in comments 👇

#AffiliateMarketing #RecurringIncome #PassiveIncome`
    },
    {
      id: 'twitter-thread-1',
      type: 'social',
      platform: 'Twitter/X',
      title: 'Why Recurring Commissions Win',
      description: 'Viral thread format explaining the advantage',
      estimatedReach: 5000,
      conversionRate: 2.8,
      content: `🧵 Thread: Why I switched to recurring commission affiliate programs

1/ Traditional affiliate marketing pays you once per sale
You make $100, customer pays monthly, you never see another penny

2/ Recurring commission programs pay you EVERY month
Same $100 commission becomes $1,800 over 18 months

3/ The math is incredible:
• 10 subscribers = $1,000/month recurring
• 50 subscribers = $5,000/month recurring  
• 100 subscribers = $10,000/month recurring

4/ This isn't just income - it's wealth building
Each new referral adds to your monthly total
Your income compounds and grows predictably

5/ Best part? Transparent pricing means customers trust you more
They see exactly where their money goes
Higher conversion rates = more subscribers for you

6/ Ready to build recurring income? Check out @BeezioHQ
Link in bio 👇`
    },
    {
      id: 'email-sequence-1',
      type: 'email',
      title: 'Wake-Up Call Email',
      description: 'First email in conversion sequence',
      estimatedReach: 1000,
      conversionRate: 8.5,
      content: `Subject: "You're earning 95% less than you could be"

Hey [Name],

Quick question: Would you rather earn $100 once, or $100 every month for 18 months straight?

Obvious answer, right? Yet 95% of affiliates are stuck earning one-time commissions while leaving thousands on the table.

Here's what I mean:

**Traditional Affiliate Program:**
• Customer buys $150/month software
• You earn $50 commission... once
• Customer pays $2,700 over 18 months
• You earned $50 total (1.85% of customer value)

**Recurring Commission Program:**
• Same customer, same software
• You earn $50 EVERY MONTH they stay subscribed  
• Customer pays $2,700 over 18 months
• You earned $900 total (33% of customer value)

That's 1,800% more income from the SAME customer.

Tomorrow I'll show you exactly how top affiliates are building $50K+ monthly recurring income streams.

Talk soon,
[Your Name]`
    },
    {
      id: 'instagram-story-1',
      type: 'social',
      platform: 'Instagram',
      title: 'Story Series: Recurring Income',
      description: '6-part story series for high engagement',
      estimatedReach: 3000,
      conversionRate: 4.1,
      content: `Story 1: "💰 Would you rather earn $100 once or $100 every month?"

Story 2: "🤔 Most affiliates choose the wrong answer..."

Story 3: "📈 Recurring commissions mean:
• $100 once = $100 total
• $100/month = $1,800 over 18 months"

Story 4: "🚀 I built $15K/month recurring income with subscription products"

Story 5: "💡 The secret? Promoting products people pay for monthly"

Story 6: "🔗 Link in bio to see how you can do the same"`
    },
    {
      id: 'video-script-1',
      type: 'video',
      title: '60-Second Explainer',
      description: 'Short comparison video for social media',
      estimatedReach: 8000,
      conversionRate: 5.2,
      content: `[Screen: Split comparison graphic]

**Narrator:** "Two affiliates promote the same $150/month software..."

[Left side: Traditional Affiliate]
"Traditional affiliate earns $50... once."

[Right side: Beezio Affiliate]  
"Beezio affiliate earns $50... every month."

[Animation: Money counting up]
"After 18 months:
• Traditional affiliate: $50 total
• Beezio affiliate: $900 total"

[Screen: Calculator showing scaling]
"With 100 subscribers:
• Traditional: $5,000 once
• Beezio: $5,000 EVERY MONTH"

[Screen: Beezio logo and tagline]
"Beezio: Where everyone wins with transparent recurring commissions."

[CTA: Join Beezio]`
    },
    {
      id: 'landing-page-1',
      type: 'landing',
      title: 'Affiliate Landing Page Copy',
      description: 'High-converting landing page template',
      estimatedReach: 10000,
      conversionRate: 12.3,
      content: `**Headline:** 
"Build $50,000+ Monthly Recurring Income as a Beezio Affiliate"

**Subheadline:**
"Stop earning commissions once. Start earning them every month with subscription products that pay recurring commissions for years."

**Bullet Points:**
• ✅ Earn 25-50% commissions EVERY MONTH
• ✅ Average customer lifetime: 18+ months  
• ✅ Transparent pricing builds trust = higher conversions
• ✅ Portfolio of $99-299/month subscription products
• ✅ Real affiliates earning $25K-50K+ monthly recurring
• ✅ Free to join, no monthly fees, weekly payouts

**Social Proof:**
"Over 1,200 affiliates building recurring income streams"
"$2.3M+ in monthly recurring commissions paid"
"Average affiliate earns $4,847/month recurring"

**CTA Button:** "Start Building Recurring Income Today"`
    }
  ];

  const categories = [
    { id: 'all', name: 'All Materials', icon: FileText },
    { id: 'social', name: 'Social Media', icon: Share2 },
    { id: 'email', name: 'Email Marketing', icon: Mail },
    { id: 'video', name: 'Video Scripts', icon: Video },
    { id: 'landing', name: 'Landing Pages', icon: Target }
  ];

  const filteredMaterials = marketingMaterials.filter(material => {
    const matchesCategory = selectedCategory === 'all' || material.type === selectedCategory;
    const matchesSearch = material.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         material.description.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const copyToClipboard = async (content: string, id: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedItem(id);
      setTimeout(() => setCopiedItem(null), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const getPlatformIcon = (platform?: string) => {
    switch (platform) {
      case 'LinkedIn': return <Users className="w-4 h-4" />;
      case 'Twitter/X': return <Twitter className="w-4 h-4" />;
      case 'Instagram': return <Instagram className="w-4 h-4" />;
      default: return <MessageSquare className="w-4 h-4" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'social': return 'bg-blue-100 text-blue-800';
      case 'email': return 'bg-green-100 text-green-800';
      case 'video': return 'bg-purple-100 text-purple-800';
      case 'landing': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6 bg-white">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-gradient-to-r from-amber-500 to-orange-600 rounded-lg flex items-center justify-center">
            <TrendingUp className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Recurring Income Marketing Materials</h1>
            <p className="text-gray-600">Ready-to-use content that emphasizes the power of monthly recurring commissions</p>
          </div>
        </div>

        {/* Key Message */}
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl p-6 border border-amber-200">
          <div className="flex items-start gap-4">
            <Lightbulb className="w-8 h-8 text-amber-600 mt-1" />
            <div>
              <h3 className="text-lg font-semibold text-amber-900 mb-2">Core Marketing Message</h3>
              <p className="text-amber-800 text-lg leading-relaxed">
                <strong>"Build Real Wealth with Monthly Recurring Commissions"</strong> - Unlike traditional affiliate programs that pay once, 
                Beezio pays you <strong>EVERY MONTH</strong> for as long as customers stay subscribed. This isn't just affiliate marketing - 
                it's wealth building through recurring income.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
          <div className="flex items-center gap-3">
            <DollarSign className="w-8 h-8 text-blue-600" />
            <div>
              <p className="text-sm text-blue-700">Avg Commission Rate</p>
              <p className="text-2xl font-bold text-blue-900">35%</p>
            </div>
          </div>
        </div>
        <div className="bg-green-50 rounded-lg p-4 border border-green-200">
          <div className="flex items-center gap-3">
            <Calendar className="w-8 h-8 text-green-600" />
            <div>
              <p className="text-sm text-green-700">Avg Customer Lifetime</p>
              <p className="text-2xl font-bold text-green-900">18+ Months</p>
            </div>
          </div>
        </div>
        <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
          <div className="flex items-center gap-3">
            <TrendingUp className="w-8 h-8 text-purple-600" />
            <div>
              <p className="text-sm text-purple-700">Income Multiplier</p>
              <p className="text-2xl font-bold text-purple-900">18x More</p>
            </div>
          </div>
        </div>
        <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
          <div className="flex items-center gap-3">
            <Users className="w-8 h-8 text-orange-600" />
            <div>
              <p className="text-sm text-orange-700">Top Affiliate Earns</p>
              <p className="text-2xl font-bold text-orange-900">$50K+/mo</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => {
              const Icon = category.icon;
              return (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                    selectedCategory === category.id
                      ? 'bg-amber-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {category.name}
                </button>
              );
            })}
          </div>
          <input
            type="text"
            placeholder="Search materials..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Materials Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredMaterials.map((material) => (
          <div key={material.id} className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-lg transition-shadow">
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                {material.platform && getPlatformIcon(material.platform)}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{material.title}</h3>
                  <p className="text-sm text-gray-600">{material.description}</p>
                </div>
              </div>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTypeColor(material.type)}`}>
                {material.type}
              </span>
            </div>

            {/* Stats */}
            {(material.estimatedReach || material.conversionRate) && (
              <div className="flex gap-4 mb-4 text-sm">
                {material.estimatedReach && (
                  <div className="flex items-center gap-1 text-gray-600">
                    <Users className="w-4 h-4" />
                    <span>{material.estimatedReach.toLocaleString()} reach</span>
                  </div>
                )}
                {material.conversionRate && (
                  <div className="flex items-center gap-1 text-gray-600">
                    <TrendingUp className="w-4 h-4" />
                    <span>{material.conversionRate}% conversion</span>
                  </div>
                )}
              </div>
            )}

            {/* Content Preview */}
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono leading-relaxed">
                {material.content.length > 300 
                  ? `${material.content.substring(0, 300)}...` 
                  : material.content}
              </pre>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={() => copyToClipboard(material.content, material.id)}
                className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
              >
                <Copy className="w-4 h-4" />
                {copiedItem === material.id ? 'Copied!' : 'Copy'}
              </button>
              <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
                <Download className="w-4 h-4" />
                Download
              </button>
              <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
                <Share2 className="w-4 h-4" />
                Share
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Tips */}
      <div className="mt-8 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200">
        <h3 className="text-lg font-semibold text-blue-900 mb-4 flex items-center gap-2">
          <Lightbulb className="w-5 h-5" />
          Marketing Tips for Maximum Impact
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-blue-800">
          <div>
            <h4 className="font-medium mb-2">🎯 Focus on the Numbers</h4>
            <p>Always compare recurring vs one-time commissions with specific dollar amounts. "$50/month vs $50 once" is more powerful than percentages.</p>
          </div>
          <div>
            <h4 className="font-medium mb-2">📊 Show Compound Growth</h4>
            <p>Demonstrate how income builds over time. "Month 1: $1K, Month 6: $6K, Month 12: $12K" shows the wealth-building aspect.</p>
          </div>
          <div>
            <h4 className="font-medium mb-2">💡 Emphasize Transparency</h4>
            <p>Highlight how transparent pricing builds trust and increases conversion rates compared to hidden fee structures.</p>
          </div>
          <div>
            <h4 className="font-medium mb-2">🚀 Use Social Proof</h4>
            <p>Include real affiliate success stories and specific income numbers to make the opportunity tangible and believable.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RecurringIncomeMarketing;
