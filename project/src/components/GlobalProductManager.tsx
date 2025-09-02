import React, { useState, useEffect } from 'react';
import { 
  Globe, 
  Package, 
  Truck, 
  DollarSign, 
  MapPin, 
  Shield, 
  Clock,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  Factory,
  Users,
  Zap
} from 'lucide-react';
import { getSourceWithAutomation, AutomationTrigger } from '../lib/globalSourcing';
import { ZapierIntegration } from './ZapierIntegration';

interface GlobalProductManagerProps {
  productId?: string;
}

const GlobalProductManager: React.FC<GlobalProductManagerProps> = ({ productId }) => {
  const [selectedCountry, setSelectedCountry] = useState('US');
  const [selectedQuality, setSelectedQuality] = useState<'premium' | 'standard' | 'budget'>('standard');
  const [productCategory, setProductCategory] = useState('electronics');
  const [sourcingAnalysis, setSourcingAnalysis] = useState<any>(null);
  const [showZapierIntegration, setShowZapierIntegration] = useState(false);
  const [automationTriggers, setAutomationTriggers] = useState<AutomationTrigger[]>([]);

  // Available markets for global expansion
  const globalMarkets = [
    { code: 'US', name: 'United States', flag: '🇺🇸', region: 'North America' },
    { code: 'CA', name: 'Canada', flag: '🇨🇦', region: 'North America' },
    { code: 'MX', name: 'Mexico', flag: '🇲🇽', region: 'North America' },
    { code: 'DE', name: 'Germany', flag: '🇩🇪', region: 'Europe' },
    { code: 'FR', name: 'France', flag: '🇫🇷', region: 'Europe' },
    { code: 'UK', name: 'United Kingdom', flag: '🇬🇧', region: 'Europe' },
    { code: 'IT', name: 'Italy', flag: '🇮🇹', region: 'Europe' },
    { code: 'ES', name: 'Spain', flag: '🇪🇸', region: 'Europe' },
    { code: 'JP', name: 'Japan', flag: '🇯🇵', region: 'Asia Pacific' },
    { code: 'CN', name: 'China', flag: '🇨🇳', region: 'Asia Pacific' },
    { code: 'KR', name: 'South Korea', flag: '🇰🇷', region: 'Asia Pacific' },
    { code: 'AU', name: 'Australia', flag: '🇦🇺', region: 'Asia Pacific' },
    { code: 'SG', name: 'Singapore', flag: '🇸🇬', region: 'Asia Pacific' },
    { code: 'BR', name: 'Brazil', flag: '🇧🇷', region: 'Latin America' },
    { code: 'AR', name: 'Argentina', flag: '🇦🇷', region: 'Latin America' },
  ];

  // Product categories with sourcing strategies
  const categories = [
    { id: 'electronics', name: 'Electronics & Tech', icon: '📱' },
    { id: 'fashion', name: 'Fashion & Apparel', icon: '👗' },
    { id: 'homeGarden', name: 'Home & Garden', icon: '🏠' },
    { id: 'foodSupplements', name: 'Food & Supplements', icon: '🥗' },
  ];

  useEffect(() => {
    // Analyze optimal sourcing when parameters change
    try {
      const result = getSourceWithAutomation(productCategory, selectedCountry, selectedQuality, true);
      
      setSourcingAnalysis({
        optimalSource: result.optimalSource,
        totalCost: result.estimatedCost,
        savings: {
          totalSavings: result.savings,
          percentage: (result.savings / result.estimatedCost) * 100,
          tariffSavings: result.savings * 0.6, // Approximate breakdown
          shippingSavings: result.savings * 0.4
        },
        riskFactors: analyzeRisks(result.optimalSource, selectedCountry),
        marketPotential: analyzeMarketPotential(selectedCountry),
        competitiveAdvantage: analyzeCompetitiveAdvantage(result.optimalSource),
        zapierIntegration: result.zapierIntegration,
        automationTriggers: result.automationTriggers
      });
      
      setAutomationTriggers(result.automationTriggers);
    } catch (error) {
      console.error('Sourcing analysis failed:', error);
      setSourcingAnalysis(null);
    }
  }, [selectedCountry, selectedQuality, productCategory]);

  const analyzeRisks = (source: any, targetCountry: string) => {
    const risks = [];
    
    if (source.leadTime > 5) {
      risks.push({ type: 'warning', message: 'Extended lead time may affect customer satisfaction' });
    }
    
    if (source.tariffRate > 15) {
      risks.push({ type: 'error', message: 'High tariff rates will increase product costs' });
    }
    
    if (source.sourceCountry === 'CN' && targetCountry === 'US') {
      risks.push({ type: 'warning', message: 'US-China trade tensions may affect supply chain' });
    }
    
    return risks;
  };

  const analyzeMarketPotential = (countryCode: string) => {
    // Simplified market analysis
    const marketData: { [key: string]: any } = {
      'US': { size: 'Very Large', growth: 'Moderate', competition: 'High', potential: 95 },
      'CN': { size: 'Massive', growth: 'High', competition: 'Very High', potential: 88 },
      'DE': { size: 'Large', growth: 'Moderate', competition: 'High', potential: 82 },
      'JP': { size: 'Large', growth: 'Low', competition: 'High', potential: 75 },
      'BR': { size: 'Medium', growth: 'High', competition: 'Medium', potential: 78 },
      'SG': { size: 'Small', growth: 'High', competition: 'Medium', potential: 85 },
    };
    
    return marketData[countryCode] || { size: 'Medium', growth: 'Moderate', competition: 'Medium', potential: 70 };
  };

  const analyzeCompetitiveAdvantage = (source: any) => {
    const advantages = [];
    
    if (source.tariffRate === 0) {
      advantages.push('Tariff-free imports provide cost advantage');
    }
    
    if (source.leadTime <= 3) {
      advantages.push('Fast delivery creates customer satisfaction edge');
    }
    
    if (source.qualityGrade === 'A') {
      advantages.push('Premium quality positioning possible');
    }
    
    if (source.certifications.length > 0) {
      advantages.push('Compliance certifications ensure market access');
    }
    
    return advantages;
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center mb-4">
            <Globe className="h-12 w-12 text-primary-600 mr-3" />
            <h1 className="text-4xl font-bold text-gray-900">Global Product Sourcing</h1>
          </div>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Optimize your product sourcing across multiple countries to minimize costs, avoid tariffs, and maximize affiliate earnings
          </p>
        </div>

        {/* Configuration Panel */}
        <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
            <Factory className="h-6 w-6 mr-2 text-primary-600" />
            Sourcing Configuration
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Target Market Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Target Market
              </label>
              <select 
                value={selectedCountry}
                onChange={(e) => setSelectedCountry(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                {globalMarkets.map(market => (
                  <option key={market.code} value={market.code}>
                    {market.flag} {market.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Product Category */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Product Category
              </label>
              <select 
                value={productCategory}
                onChange={(e) => setProductCategory(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                {categories.map(category => (
                  <option key={category.id} value={category.id}>
                    {category.icon} {category.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Quality Tier */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Quality Tier
              </label>
              <select 
                value={selectedQuality}
                onChange={(e) => setSelectedQuality(e.target.value as any)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="budget">💰 Budget (Cost Optimized)</option>
                <option value="standard">⚖️ Standard (Balanced)</option>
                <option value="premium">💎 Premium (Quality First)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Sourcing Analysis Results */}
        {sourcingAnalysis && (
          <>
            {/* Optimal Source Card */}
            <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
                <CheckCircle className="h-6 w-6 mr-2 text-green-600" />
                Optimal Source Recommendation
              </h2>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div>
                  <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-lg p-6">
                    <div className="flex items-center mb-4">
                      <MapPin className="h-8 w-8 text-green-600 mr-3" />
                      <div>
                        <h3 className="text-xl font-bold text-gray-900">
                          Source: {sourcingAnalysis.optimalSource.sourceCountry}
                        </h3>
                        <p className="text-gray-600">{sourcingAnalysis.optimalSource.supplierName}</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="flex items-center">
                        <Clock className="h-4 w-4 text-blue-600 mr-2" />
                        <span>{sourcingAnalysis.optimalSource.leadTime} days</span>
                      </div>
                      <div className="flex items-center">
                        <DollarSign className="h-4 w-4 text-green-600 mr-2" />
                        <span>{sourcingAnalysis.optimalSource.tariffRate}% tariff</span>
                      </div>
                      <div className="flex items-center">
                        <Truck className="h-4 w-4 text-purple-600 mr-2" />
                        <span>${sourcingAnalysis.optimalSource.shippingCost} shipping</span>
                      </div>
                      <div className="flex items-center">
                        <Shield className="h-4 w-4 text-orange-600 mr-2" />
                        <span>Grade {sourcingAnalysis.optimalSource.qualityGrade}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Savings Analysis */}
                <div>
                  <h4 className="text-lg font-semibold text-gray-900 mb-4">Cost Savings Analysis</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                      <span className="text-gray-700">Tariff Savings</span>
                      <span className="font-semibold text-green-600">
                        ${sourcingAnalysis.savings.tariffSavings.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                      <span className="text-gray-700">Shipping Savings</span>
                      <span className="font-semibold text-blue-600">
                        ${sourcingAnalysis.savings.shippingSavings.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-primary-50 rounded-lg border-2 border-primary-200">
                      <span className="font-semibold text-gray-900">Total Savings</span>
                      <span className="font-bold text-primary-600">
                        ${sourcingAnalysis.savings.totalSavings.toFixed(2)} 
                        ({sourcingAnalysis.savings.percentage.toFixed(1)}%)
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Market Analysis */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
              
              {/* Market Potential */}
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                  <TrendingUp className="h-5 w-5 mr-2 text-primary-600" />
                  Market Potential
                </h3>
                
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Market Size</span>
                    <span className="font-semibold">{sourcingAnalysis.marketPotential.size}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Growth Rate</span>
                    <span className="font-semibold">{sourcingAnalysis.marketPotential.growth}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Competition</span>
                    <span className="font-semibold">{sourcingAnalysis.marketPotential.competition}</span>
                  </div>
                  <div className="mt-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-gray-600">Market Score</span>
                      <span className="font-bold text-primary-600">{sourcingAnalysis.marketPotential.potential}/100</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div 
                        className="bg-primary-600 h-3 rounded-full transition-all duration-500"
                        style={{ width: `${sourcingAnalysis.marketPotential.potential}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Competitive Advantages */}
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                  <Users className="h-5 w-5 mr-2 text-green-600" />
                  Competitive Advantages
                </h3>
                
                <div className="space-y-3">
                  {sourcingAnalysis.competitiveAdvantage.map((advantage: string, index: number) => (
                    <div key={index} className="flex items-start p-3 bg-green-50 rounded-lg">
                      <CheckCircle className="h-5 w-5 text-green-600 mr-3 mt-0.5 flex-shrink-0" />
                      <span className="text-gray-700">{advantage}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Risk Analysis */}
            {sourcingAnalysis.riskFactors.length > 0 && (
              <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
                <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                  <AlertTriangle className="h-5 w-5 mr-2 text-orange-600" />
                  Risk Factors & Mitigation
                </h3>
                
                <div className="space-y-3">
                  {sourcingAnalysis.riskFactors.map((risk: any, index: number) => (
                    <div key={index} className={`flex items-start p-4 rounded-lg ${
                      risk.type === 'error' ? 'bg-red-50 border border-red-200' : 'bg-yellow-50 border border-yellow-200'
                    }`}>
                      <AlertTriangle className={`h-5 w-5 mr-3 mt-0.5 flex-shrink-0 ${
                        risk.type === 'error' ? 'text-red-600' : 'text-yellow-600'
                      }`} />
                      <span className="text-gray-700">{risk.message}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Zapier Automation Integration */}
            <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900 flex items-center">
                  <Zap className="h-5 w-5 mr-2 text-orange-600" />
                  Automation & Zapier Integration
                </h3>
                <button
                  onClick={() => setShowZapierIntegration(!showZapierIntegration)}
                  className="bg-orange-100 text-orange-700 px-4 py-2 rounded-lg hover:bg-orange-200 transition-colors flex items-center"
                >
                  <Zap className="h-4 w-4 mr-2" />
                  {showZapierIntegration ? 'Hide' : 'Setup'} Automation
                </button>
              </div>

              {sourcingAnalysis.zapierIntegration && (
                <div className="bg-gradient-to-r from-orange-50 to-yellow-50 rounded-lg p-4 mb-6">
                  <div className="flex items-start space-x-4">
                    <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Zap className="h-5 w-5 text-orange-600" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900 mb-2">
                        🚀 Keep Products Moving Globally with Zapier
                      </h4>
                      <p className="text-gray-600 text-sm mb-3">
                        Automate your global sourcing workflow to keep products flowing smoothly across all regions. 
                        Connect with 5,000+ apps to streamline inventory, pricing, and supplier management.
                      </p>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                        <div className="flex items-center space-x-2">
                          <div className={`w-3 h-3 rounded-full ${sourcingAnalysis.zapierIntegration.automatedReordering ? 'bg-green-400' : 'bg-gray-300'}`}></div>
                          <span className="text-sm text-gray-700">Auto Reordering</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <div className={`w-3 h-3 rounded-full ${sourcingAnalysis.zapierIntegration.priceMonitoring ? 'bg-green-400' : 'bg-gray-300'}`}></div>
                          <span className="text-sm text-gray-700">Price Monitoring</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <div className={`w-3 h-3 rounded-full ${sourcingAnalysis.zapierIntegration.inventorySync ? 'bg-green-400' : 'bg-gray-300'}`}></div>
                          <span className="text-sm text-gray-700">Inventory Sync</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Active Automation Triggers Summary */}
              {automationTriggers.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  {automationTriggers.slice(0, 4).map((trigger) => (
                    <div key={trigger.id} className="bg-gray-50 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h5 className="font-medium text-gray-900 text-sm">{trigger.name.split(' - ')[0]}</h5>
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          trigger.zapierWorkflow.successRate > 95 ? 'bg-green-100 text-green-800' :
                          trigger.zapierWorkflow.successRate > 90 ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {trigger.zapierWorkflow.successRate}%
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 mb-2">{trigger.description}</p>
                      <div className="text-xs text-gray-500">
                        {trigger.zapierWorkflow.actions.length} action{trigger.zapierWorkflow.actions.length !== 1 ? 's' : ''}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Zapier Integration Component */}
              {showZapierIntegration && (
                <ZapierIntegration
                  productId={productId || `${productCategory}_${selectedCountry}`}
                  targetRegions={[selectedCountry]}
                  onTriggersUpdated={setAutomationTriggers}
                />
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button className="bg-primary-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-primary-700 transition-colors flex items-center justify-center">
                <Package className="h-5 w-5 mr-2" />
                Set Up Global Sourcing
              </button>
              <button className="bg-green-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors flex items-center justify-center">
                <Users className="h-5 w-5 mr-2" />
                Find Local Affiliates
              </button>
              <button 
                onClick={() => setShowZapierIntegration(true)}
                className="bg-orange-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-orange-700 transition-colors flex items-center justify-center"
              >
                <Zap className="h-5 w-5 mr-2" />
                Automate with Zapier
              </button>
              <button className="border-2 border-gray-300 text-gray-700 px-8 py-3 rounded-lg font-semibold hover:border-gray-400 transition-colors flex items-center justify-center">
                <Globe className="h-5 w-5 mr-2" />
                Export Analysis
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default GlobalProductManager;
