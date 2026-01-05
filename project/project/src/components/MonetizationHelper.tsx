import React, { useState } from 'react';
import { HelpCircle, ExternalLink, DollarSign, Zap, TrendingUp, Users } from 'lucide-react';

const MonetizationHelper: React.FC = () => {
  const [activeStrategy, setActiveStrategy] = useState<string | null>(null);

  const strategies = [
    {
      id: 'print-on-demand',
      title: '🎨 Print-on-Demand Empire',
      subtitle: 'Design once, profit forever',
      description: 'Create t-shirts on Printify, connect via API, let affiliates sell your designs',
      potential: '$1,000+ passive monthly income',
      difficulty: 'Easy',
      timeToProfit: '2-4 weeks',
      steps: [
        'Design 10 t-shirts on Printify',
        'Connect Printify API in Integrations tab',
        'Set retail price: $25, affiliate commission: $7',
        'Recruit affiliates to promote your designs',
        'You earn $5.50 per affiliate sale + $13 per direct sale'
      ]
    },
    {
      id: 'digital-products',
      title: '📚 Digital Product Multiplication',
      subtitle: 'Sell unlimited copies of digital goods',
      description: 'Create e-books, courses, templates - sell infinite copies through affiliates',
      potential: '$500-5,000 monthly',
      difficulty: 'Medium',
      timeToProfit: '1-3 weeks',
      steps: [
        'Create valuable digital product (e-book, course, etc.)',
        'Set up custom API integration for automated delivery',
        'Price at $50-200 with 40% affiliate commission',
        'One sale per day = $1,500+ monthly profit',
        'Scale by creating product bundles'
      ]
    },
    {
      id: 'dropshipping',
      title: '📦 Dropshipping 2.0',
      subtitle: 'No inventory, maximum profits',
      description: 'Connect supplier APIs, set your margins, let affiliates drive sales',
      potential: '$2,000+ monthly',
      difficulty: 'Medium',
      timeToProfit: '2-6 weeks',
      steps: [
        'Find suppliers with API access (AliExpress, Spocket, etc.)',
        'Connect via Custom API integration',
        'Markup products 100-200%',
        'Offer 30% affiliate commissions',
        'Automate order fulfillment with webhooks'
      ]
    },
    {
      id: 'service-marketplace',
      title: '🔧 Service Marketplace',
      subtitle: 'Sell your skills, scale with affiliates',
      description: 'Offer consulting, design, or virtual services through Beezio',
      potential: '$100-300 per hour',
      difficulty: 'Easy',
      timeToProfit: '1-2 weeks',
      steps: [
        'Package your expertise into service offerings',
        'Set up booking system with calendar API',
        'Offer referral commissions to affiliates',
        'Deliver high value, get testimonials',
        'Scale by training others to deliver similar services'
      ]
    }
  ];

  const apiConnections = [
    { name: 'Printify', description: 'Print-on-demand products', difficulty: 'Easy', setup: '5 minutes' },
    { name: 'Printful', description: 'Premium print-on-demand', difficulty: 'Easy', setup: '5 minutes' },
    { name: 'Shopify', description: 'Import existing store', difficulty: 'Medium', setup: '15 minutes' },
    { name: 'Custom API', description: 'Any REST API', difficulty: 'Advanced', setup: '30+ minutes' }
  ];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center space-x-3 mb-6">
        <div className="p-2 bg-green-100 rounded-lg">
          <DollarSign className="w-5 h-5 text-green-600" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">💰 Monetization Strategies</h3>
          <p className="text-gray-600 text-sm">Turn your API connections into profit machines</p>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-green-50 p-4 rounded-lg border border-green-200">
          <div className="flex items-center space-x-2">
            <TrendingUp className="w-4 h-4 text-green-600" />
            <span className="text-sm font-medium text-green-800">Potential Revenue</span>
          </div>
          <p className="text-2xl font-bold text-green-900">$500-5K/mo</p>
        </div>
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
          <div className="flex items-center space-x-2">
            <Zap className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-medium text-blue-800">Time to Profit</span>
          </div>
          <p className="text-2xl font-bold text-blue-900">1-4 weeks</p>
        </div>
        <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
          <div className="flex items-center space-x-2">
            <Users className="w-4 h-4 text-purple-600" />
            <span className="text-sm font-medium text-purple-800">Affiliate Power</span>
          </div>
          <p className="text-2xl font-bold text-purple-900">Multiply Sales</p>
        </div>
      </div>

      {/* Strategy Cards */}
      <div className="space-y-4 mb-8">
        <h4 className="font-semibold text-gray-900">Choose Your Strategy:</h4>
        {strategies.map((strategy) => (
          <div
            key={strategy.id}
            className="border border-gray-200 rounded-lg overflow-hidden"
          >
            <button
              onClick={() => setActiveStrategy(activeStrategy === strategy.id ? null : strategy.id)}
              className="w-full p-4 text-left hover:bg-gray-50 transition-colors"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h5 className="font-semibold text-gray-900">{strategy.title}</h5>
                  <p className="text-sm text-gray-600 mt-1">{strategy.subtitle}</p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
                      {strategy.potential}
                    </span>
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                      {strategy.difficulty}
                    </span>
                    <span className="px-2 py-1 bg-orange-100 text-orange-800 text-xs rounded">
                      {strategy.timeToProfit}
                    </span>
                  </div>
                </div>
                <HelpCircle className="w-5 h-5 text-gray-400 ml-4 flex-shrink-0" />
              </div>
            </button>
            
            {activeStrategy === strategy.id && (
              <div className="px-4 pb-4 border-t border-gray-100 bg-gray-50">
                <div className="pt-4">
                  <p className="text-gray-700 mb-4">{strategy.description}</p>
                  <div>
                    <h6 className="font-medium text-gray-900 mb-2">Step-by-Step:</h6>
                    <ol className="space-y-2">
                      {strategy.steps.map((step, index) => (
                        <li key={index} className="flex items-start space-x-2">
                          <span className="flex-shrink-0 w-5 h-5 bg-orange-500 text-white text-xs rounded-full flex items-center justify-center font-medium">
                            {index + 1}
                          </span>
                          <span className="text-sm text-gray-700">{step}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* API Connection Guide */}
      <div className="border-t border-gray-200 pt-6">
        <h4 className="font-semibold text-gray-900 mb-4">🔌 Available API Connections:</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {apiConnections.map((api) => (
            <div key={api.name} className="p-3 border border-gray-200 rounded-lg">
              <div className="flex justify-between items-start mb-2">
                <h5 className="font-medium text-gray-900">{api.name}</h5>
                <span className="text-xs text-gray-500">{api.setup}</span>
              </div>
              <p className="text-sm text-gray-600 mb-2">{api.description}</p>
              <span className={`inline-block px-2 py-1 text-xs rounded ${
                api.difficulty === 'Easy' ? 'bg-green-100 text-green-800' :
                api.difficulty === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                'bg-red-100 text-red-800'
              }`}>
                {api.difficulty}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Start CTA */}
      <div className="mt-6 p-4 bg-gradient-to-r from-orange-50 to-yellow-50 border border-orange-200 rounded-lg">
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0">
            <Zap className="w-6 h-6 text-orange-600" />
          </div>
          <div>
            <h5 className="font-semibold text-gray-900">Ready to Start Making Money?</h5>
            <p className="text-sm text-gray-700 mt-1">
              The fastest way is the Print-on-Demand strategy. Create 5 t-shirt designs and connect Printify today!
            </p>
            <div className="mt-3 space-x-3">
              <a
                href="https://printify.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center text-sm text-orange-600 hover:text-orange-700 font-medium"
              >
                Go to Printify <ExternalLink className="w-3 h-3 ml-1" />
              </a>
              <button className="text-sm text-gray-600 hover:text-gray-800 font-medium">
                Watch Tutorial
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MonetizationHelper;
