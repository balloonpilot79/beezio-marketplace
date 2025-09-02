import React, { useState } from 'react';
import { Settings, DollarSign, Percent, Save, Calculator } from 'lucide-react';
import { PLATFORM_CONFIG, calculateFees } from '../utils/platformConfig';

const PlatformSettings: React.FC = () => {
  const [config, setConfig] = useState({
    platformFeePercentage: PLATFORM_CONFIG.PLATFORM_FEE_PERCENTAGE,
    defaultAffiliateCommission: PLATFORM_CONFIG.DEFAULT_AFFILIATE_COMMISSION,
    minimumPayoutAmount: PLATFORM_CONFIG.MINIMUM_PAYOUT_AMOUNT
  });

  const [testPrice, setTestPrice] = useState(100);
  const [testCommission, setTestCommission] = useState(15);

  const testCalculation = calculateFees(testPrice, testCommission);

  const handleSave = () => {
    // In a real app, you'd save these to your database
    console.log('Platform settings saved:', config);
    alert('Settings saved successfully!');
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center gap-3 mb-6">
          <Settings className="h-6 w-6 text-blue-600" />
          <h2 className="text-2xl font-bold text-gray-900">Platform Fee Settings</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Fee Configuration */}
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Revenue Configuration</h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Platform Fee (Beezio's Revenue)
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={config.platformFeePercentage}
                  onChange={(e) => setConfig({...config, platformFeePercentage: Number(e.target.value)})}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 pr-8 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="0"
                  max="50"
                  step="0.1"
                />
                <Percent className="absolute right-2 top-2.5 h-4 w-4 text-gray-400" />
              </div>
              <p className="text-sm text-gray-500 mt-1">
                Platform fee percentage on all sales (currently {config.platformFeePercentage}%)
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Default Affiliate Commission
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={config.defaultAffiliateCommission}
                  onChange={(e) => setConfig({...config, defaultAffiliateCommission: Number(e.target.value)})}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 pr-8 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="0"
                  max="50"
                  step="0.1"
                />
                <Percent className="absolute right-2 top-2.5 h-4 w-4 text-gray-400" />
              </div>
              <p className="text-sm text-gray-500 mt-1">
                Default commission rate for new affiliate products
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Minimum Payout Amount
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={config.minimumPayoutAmount}
                  onChange={(e) => setConfig({...config, minimumPayoutAmount: Number(e.target.value)})}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 pl-8 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="5"
                  step="5"
                />
                <DollarSign className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
              </div>
              <p className="text-sm text-gray-500 mt-1">
                Minimum amount users can request for payout
              </p>
            </div>

            <button
              onClick={handleSave}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors font-medium flex items-center justify-center gap-2"
            >
              <Save className="h-4 w-4" />
              Save Settings
            </button>
          </div>

          {/* Fee Calculator */}
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Fee Calculator</h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Test Product Price
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={testPrice}
                  onChange={(e) => setTestPrice(Number(e.target.value))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 pl-8 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="1"
                  step="1"
                />
                <DollarSign className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Affiliate Commission %
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={testCommission}
                  onChange={(e) => setTestCommission(Number(e.target.value))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 pr-8 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="0"
                  max="50"
                  step="1"
                />
                <Percent className="absolute right-2 top-2.5 h-4 w-4 text-gray-400" />
              </div>
            </div>

            {/* Calculation Results */}
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2 text-gray-900 font-medium">
                <Calculator className="h-4 w-4" />
                Fee Breakdown
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Customer Pays:</span>
                  <span className="font-medium">${testCalculation.customerPays.toFixed(2)}</span>
                </div>
                
                <div className="flex justify-between text-red-600">
                  <span>Stripe Fee:</span>
                  <span>-${testCalculation.stripeFee}</span>
                </div>
                
                <div className="flex justify-between text-blue-600 font-medium">
                  <span>Platform Fee (Beezio):</span>
                  <span>-${testCalculation.platformFee}</span>
                </div>
                
                {testCommission > 0 && (
                  <div className="flex justify-between text-purple-600">
                    <span>Affiliate Commission:</span>
                    <span>-${testCalculation.affiliateFee}</span>
                  </div>
                )}
                
                <div className="border-t pt-2 flex justify-between text-green-600 font-medium">
                  <span>Seller Gets:</span>
                  <span>${testCalculation.sellerAmount}</span>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-2">Your Revenue Summary</h4>
              <div className="text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-blue-700">Platform Fee per Sale:</span>
                  <span className="font-medium text-blue-900">${testCalculation.platformFee}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-blue-700">Revenue Rate:</span>
                  <span className="font-medium text-blue-900">{config.platformFeePercentage}% of all sales</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlatformSettings;
