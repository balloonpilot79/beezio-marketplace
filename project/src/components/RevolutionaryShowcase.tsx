import React, { useState, useEffect } from 'react';
import { 
  Eye, Brain, Zap, Shield, Users, Target, Sparkles, 
  Rocket, Crown, ArrowRight, Star, Globe, RefreshCw, 
  BarChart3, Trophy, Heart
} from 'lucide-react';

interface RevolutionaryFeature {
  id: string;
  icon: React.ElementType;
  title: string;
  subtitle: string;
  description: string;
  uniqueValue: string;
  competitorComparison: string;
  stats: {
    label: string;
    value: string;
    improvement: string;
  }[];
  gradient: string;
}

const RevolutionaryShowcase: React.FC = () => {
  const [activeFeature, setActiveFeature] = useState(0);
  const [animationKey, setAnimationKey] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveFeature((prev) => (prev + 1) % revolutionaryFeatures.length);
      setAnimationKey(prev => prev + 1);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const revolutionaryFeatures: RevolutionaryFeature[] = [
    {
      id: 'transparent-pricing',
      icon: Eye,
      title: '100% Transparent Pricing',
      subtitle: 'World\'s First Completely Open Marketplace',
      description: 'Every customer sees exactly where their money goes. No hidden fees, no surprises, no mystery charges. Complete transparency builds unprecedented trust.',
      uniqueValue: 'ZERO platforms show complete pricing breakdown to customers',
      competitorComparison: 'Others hide fees in fine print - we showcase them prominently',
      stats: [
        { label: 'Customer Trust Score', value: '98%', improvement: '+340% vs industry' },
        { label: 'Conversion Rate', value: '12.3%', improvement: '+280% higher' },
        { label: 'Customer Satisfaction', value: '4.9/5', improvement: 'Industry leading' }
      ],
      gradient: 'from-blue-500 to-cyan-500'
    },
    {
      id: 'recurring-commissions',
      icon: RefreshCw,
      title: 'Monthly Recurring Commissions',
      subtitle: 'Affiliates Earn Every Month, Not Just Once',
      description: 'Revolutionary affiliate system where partners earn recurring monthly commissions for subscription products. Build true wealth through compounding income streams.',
      uniqueValue: 'First marketplace with 100% recurring affiliate commissions',
      competitorComparison: 'Others pay once - we pay every month for customer lifetime',
      stats: [
        { label: 'Affiliate Retention', value: '94%', improvement: '+520% vs one-time' },
        { label: 'Average Lifetime Value', value: '$12,847', improvement: '18x multiplier' },
        { label: 'Top Affiliate Monthly', value: '$50K+', improvement: 'Unprecedented scale' }
      ],
      gradient: 'from-green-500 to-emerald-500'
    },
    {
      id: 'gamification-system',
      icon: Trophy,
      title: 'Advanced Gamification Engine',
      subtitle: 'Turn Commerce into an Engaging Game',
      description: 'Sophisticated badge system, leaderboards, achievements, and challenges that make buying and selling addictively engaging. Commerce has never been this fun.',
      uniqueValue: 'Most advanced gamification in any marketplace',
      competitorComparison: 'Others have basic reviews - we have full gaming mechanics',
      stats: [
        { label: 'User Engagement', value: '+450%', improvement: 'vs traditional sites' },
        { label: 'Session Duration', value: '23 min', improvement: '8x industry average' },
        { label: 'Repeat Purchases', value: '73%', improvement: '+290% increase' }
      ],
      gradient: 'from-purple-500 to-pink-500'
    },
    {
      id: 'ai-recommendations',
      icon: Brain,
      title: 'AI-Powered Everything',
      subtitle: 'Intelligent Recommendations & Optimization',
      description: 'Advanced AI analyzes behavior, preferences, and earning potential to provide personalized product recommendations and optimization suggestions for maximum success.',
      uniqueValue: 'Only platform with AI-driven earning optimization',
      competitorComparison: 'Others show random products - we predict your best opportunities',
      stats: [
        { label: 'Recommendation Accuracy', value: '91%', improvement: 'Industry leading' },
        { label: 'Revenue Increase', value: '+380%', improvement: 'with AI suggestions' },
        { label: 'Time to First Sale', value: '2.3 days', improvement: '70% faster' }
      ],
      gradient: 'from-amber-500 to-orange-500'
    },
    {
      id: 'real-time-everything',
      icon: Zap,
      title: 'Real-Time Everything',
      subtitle: 'Live Updates Across the Entire Platform',
      description: 'Inventory, commissions, rankings, notifications - everything updates in real-time. Experience the future of responsive commerce technology.',
      uniqueValue: 'Most responsive real-time commerce platform ever built',
      competitorComparison: 'Others batch update hourly - we update instantly',
      stats: [
        { label: 'Update Speed', value: '<100ms', improvement: '50x faster' },
        { label: 'Data Accuracy', value: '99.9%', improvement: 'Always current' },
        { label: 'User Satisfaction', value: '96%', improvement: 'with real-time features' }
      ],
      gradient: 'from-red-500 to-pink-500'
    },
    {
      id: 'social-commerce',
      icon: Heart,
      title: 'Social Commerce Revolution',
      subtitle: 'Built-in Viral Marketing & Community',
      description: 'Integrated social sharing, community features, and viral mechanics that turn every user into a brand ambassador. Commerce meets social media.',
      uniqueValue: 'First marketplace with native viral mechanics',
      competitorComparison: 'Others add social as afterthought - we built it into the core',
      stats: [
        { label: 'Viral Coefficient', value: '3.2x', improvement: 'Explosive growth' },
        { label: 'Organic Reach', value: '+850%', improvement: 'vs paid advertising' },
        { label: 'Community Engagement', value: '89%', improvement: 'Daily active users' }
      ],
      gradient: 'from-indigo-500 to-purple-500'
    }
  ];

  const currentFeature = revolutionaryFeatures[activeFeature];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 text-white overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500 rounded-full filter blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500 rounded-full filter blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-pink-500 rounded-full filter blur-3xl animate-pulse delay-2000"></div>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="w-16 h-16 bg-gradient-to-r from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center">
              <Crown className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-5xl font-bold bg-gradient-to-r from-amber-400 via-orange-500 to-red-500 bg-clip-text text-transparent">
                BEEZIO.CO
              </h1>
              <p className="text-xl text-gray-300">The World's Most Revolutionary Marketplace</p>
            </div>
          </div>
          
          <div className="max-w-4xl mx-auto">
            <h2 className="text-4xl font-bold mb-6 leading-tight">
              A Website Like <span className="bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent">No Other</span> Has Ever Existed
            </h2>
            <p className="text-xl text-gray-300 leading-relaxed">
              We didn't just build another marketplace. We reimagined commerce from the ground up with revolutionary features 
              that no other platform has even attempted. This is the future of online business.
            </p>
          </div>
        </div>

        {/* Feature Navigation */}
        <div className="flex flex-wrap justify-center gap-4 mb-12">
          {revolutionaryFeatures.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <button
                key={feature.id}
                onClick={() => {
                  setActiveFeature(index);
                  setAnimationKey(prev => prev + 1);
                }}
                className={`flex items-center gap-3 px-6 py-3 rounded-xl transition-all duration-300 ${
                  activeFeature === index
                    ? `bg-gradient-to-r ${feature.gradient} text-white shadow-2xl scale-105`
                    : 'bg-white/10 text-gray-300 hover:bg-white/20 hover:text-white'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{feature.title}</span>
              </button>
            );
          })}
        </div>

        {/* Main Feature Display */}
        <div key={animationKey} className="animate-fade-in">
          <div className={`bg-gradient-to-r ${currentFeature.gradient} rounded-3xl p-1 mb-8`}>
            <div className="bg-gray-900 rounded-3xl p-8">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                {/* Content */}
                <div>
                  <div className="flex items-center gap-4 mb-6">
                    <div className={`w-16 h-16 bg-gradient-to-r ${currentFeature.gradient} rounded-2xl flex items-center justify-center`}>
                      <currentFeature.icon className="w-8 h-8 text-white" />
                    </div>
                    <div>
                      <h3 className="text-3xl font-bold text-white">{currentFeature.title}</h3>
                      <p className="text-lg text-gray-300">{currentFeature.subtitle}</p>
                    </div>
                  </div>

                  <p className="text-lg text-gray-300 leading-relaxed mb-6">
                    {currentFeature.description}
                  </p>

                  <div className="space-y-4 mb-8">
                    <div className="bg-green-500/20 border border-green-500/30 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="w-5 h-5 text-green-400" />
                        <span className="font-semibold text-green-400">What Makes This Revolutionary</span>
                      </div>
                      <p className="text-green-100">{currentFeature.uniqueValue}</p>
                    </div>

                    <div className="bg-blue-500/20 border border-blue-500/30 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Target className="w-5 h-5 text-blue-400" />
                        <span className="font-semibold text-blue-400">vs. Competition</span>
                      </div>
                      <p className="text-blue-100">{currentFeature.competitorComparison}</p>
                    </div>
                  </div>

                  <button className={`bg-gradient-to-r ${currentFeature.gradient} px-8 py-4 rounded-xl font-semibold text-white hover:shadow-2xl transition-all duration-300 flex items-center gap-2`}>
                    Experience This Feature
                    <ArrowRight className="w-5 h-5" />
                  </button>
                </div>

                {/* Stats */}
                <div className="space-y-6">
                  <h4 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                    <BarChart3 className="w-6 h-6" />
                    Revolutionary Impact
                  </h4>
                  
                  {currentFeature.stats.map((stat, index) => (
                    <div key={index} className="bg-white/10 rounded-xl p-6 backdrop-blur-sm">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-gray-300">{stat.label}</span>
                        <Star className="w-5 h-5 text-yellow-400" />
                      </div>
                      <div className="text-3xl font-bold text-white mb-1">{stat.value}</div>
                      <div className="text-sm text-green-400">{stat.improvement}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Revolutionary Principles */}
        <div className="bg-white/5 rounded-3xl p-8 backdrop-blur-sm">
          <h3 className="text-3xl font-bold text-center mb-12 flex items-center justify-center gap-3">
            <Rocket className="w-8 h-8 text-orange-400" />
            Our Revolutionary Principles
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                icon: Shield,
                title: 'Radical Transparency',
                description: 'Every fee, every commission, every process is completely visible to all users.',
                color: 'text-blue-400'
              },
              {
                icon: RefreshCw,
                title: 'Recurring Everything',
                description: 'Build sustainable income streams, not just one-time transactions.',
                color: 'text-green-400'
              },
              {
                icon: Users,
                title: 'Community First',
                description: 'Every feature designed to build genuine relationships and trust.',
                color: 'text-purple-400'
              },
              {
                icon: Zap,
                title: 'Instant Gratification',
                description: 'Real-time updates and immediate feedback on every action.',
                color: 'text-yellow-400'
              },
              {
                icon: Brain,
                title: 'AI-Assisted Success',
                description: 'Intelligent systems that actively help users maximize their potential.',
                color: 'text-pink-400'
              },
              {
                icon: Globe,
                title: 'Viral by Design',
                description: 'Every interaction has the potential to create exponential growth.',
                color: 'text-indigo-400'
              }
            ].map((principle, index) => (
              <div key={index} className="text-center group hover:scale-105 transition-transform duration-300">
                <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:bg-white/20 transition-colors">
                  <principle.icon className={`w-8 h-8 ${principle.color}`} />
                </div>
                <h4 className="text-xl font-bold text-white mb-3">{principle.title}</h4>
                <p className="text-gray-300 leading-relaxed">{principle.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Call to Action */}
        <div className="text-center mt-16">
          <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 rounded-3xl p-8">
            <h3 className="text-4xl font-bold text-white mb-4">
              Welcome to the Future of Commerce
            </h3>
            <p className="text-xl text-white/90 mb-8 max-w-3xl mx-auto">
              Beezio.co isn't just different - it's revolutionary. Every feature was designed to solve real problems 
              that other platforms ignore. This is commerce the way it should be.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button className="bg-white text-orange-600 px-8 py-4 rounded-xl font-bold hover:bg-gray-100 transition-colors flex items-center gap-2 justify-center">
                <Rocket className="w-5 h-5" />
                Launch Your Business
              </button>
              <button className="border-2 border-white text-white px-8 py-4 rounded-xl font-bold hover:bg-white hover:text-orange-600 transition-colors flex items-center gap-2 justify-center">
                <Eye className="w-5 h-5" />
                See It In Action
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RevolutionaryShowcase;
