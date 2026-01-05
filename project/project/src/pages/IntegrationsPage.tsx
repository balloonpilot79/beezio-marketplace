import React, { useState } from 'react';
import { Settings, Plus, ExternalLink, Check, AlertCircle } from 'lucide-react';

interface Integration {
  id: string;
  name: string;
  description: string;
  logo: string;
  isConnected: boolean;
  status: 'active' | 'inactive' | 'error';
}

const IntegrationsPage: React.FC = () => {
  const [integrations, setIntegrations] = useState<Integration[]>([
    {
      id: 'printify',
      name: 'Printify',
      description: 'Connect your Printify store to import products automatically',
      logo: '🖨️',
      isConnected: false,
      status: 'inactive'
    },
    {
      id: 'printful',
      name: 'Printful',
      description: 'Sync your Printful products and orders seamlessly',
      logo: '📦',
      isConnected: false,
      status: 'inactive'
    },
    {
      id: 'shopify',
      name: 'Shopify',
      description: 'Import your existing Shopify store and products',
      logo: '🛍️',
      isConnected: false,
      status: 'inactive'
    },
    {
      id: 'etsy',
      name: 'Etsy',
      description: 'Connect your Etsy shop to expand your reach',
      logo: '🎨',
      isConnected: false,
      status: 'inactive'
    },
    {
      id: 'amazon',
      name: 'Amazon',
      description: 'Sync products and inventory with Amazon Seller Central',
      logo: '📋',
      isConnected: false,
      status: 'inactive'
    },
    {
      id: 'ebay',
      name: 'eBay',
      description: 'Import and sync your eBay listings automatically',
      logo: '🏪',
      isConnected: false,
      status: 'inactive'
    }
  ]);

  const [showApiForm, setShowApiForm] = useState<string | null>(null);
  const [apiCredentials, setApiCredentials] = useState({
    apiKey: '',
    secretKey: '',
    shopId: ''
  });

  const handleConnect = (integrationId: string) => {
    setShowApiForm(integrationId);
  };

  const handleSubmitCredentials = (integrationId: string) => {
    // Here you would typically validate and save the API credentials
    setIntegrations(prev => 
      prev.map(integration => 
        integration.id === integrationId 
          ? { ...integration, isConnected: true, status: 'active' as const }
          : integration
      )
    );
    setShowApiForm(null);
    setApiCredentials({ apiKey: '', secretKey: '', shopId: '' });
  };

  const handleDisconnect = (integrationId: string) => {
    setIntegrations(prev => 
      prev.map(integration => 
        integration.id === integrationId 
          ? { ...integration, isConnected: false, status: 'inactive' as const }
          : integration
      )
    );
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">API Integrations</h1>
        <p className="text-gray-600">
          Connect your existing stores and platforms to import products automatically
        </p>
      </div>

      {/* Integration Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {integrations.map((integration) => (
          <div key={integration.id} className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="text-3xl">{integration.logo}</div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{integration.name}</h3>
                  <div className="flex items-center space-x-2">
                    {integration.isConnected ? (
                      <span className="inline-flex items-center space-x-1 text-green-600 text-sm">
                        <Check className="h-4 w-4" />
                        <span>Connected</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center space-x-1 text-gray-500 text-sm">
                        <AlertCircle className="h-4 w-4" />
                        <span>Not Connected</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <p className="text-gray-600 text-sm mb-4">{integration.description}</p>

            <div className="space-y-2">
              {integration.isConnected ? (
                <div className="space-y-2">
                  <button
                    onClick={() => handleDisconnect(integration.id)}
                    className="w-full bg-red-500 text-white py-2 px-4 rounded-lg hover:bg-red-600 transition-colors text-sm"
                  >
                    Disconnect
                  </button>
                  <button className="w-full bg-gray-100 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-200 transition-colors text-sm flex items-center justify-center space-x-2">
                    <Settings className="h-4 w-4" />
                    <span>Manage Settings</span>
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => handleConnect(integration.id)}
                  disabled={integration.id === 'amazon' || integration.id === 'ebay'}
                  className="w-full bg-amber-500 text-white py-2 px-4 rounded-lg hover:bg-amber-600 transition-colors text-sm disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                >
                  <Plus className="h-4 w-4" />
                  <span>
                    {integration.id === 'amazon' || integration.id === 'ebay' ? 'Setup' : 'Connect'}
                  </span>
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* API Credentials Modal */}
      {showApiForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Connect {integrations.find(i => i.id === showApiForm)?.name}
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    API Key
                  </label>
                  <input
                    type="text"
                    value={apiCredentials.apiKey}
                    onChange={(e) => setApiCredentials(prev => ({ ...prev, apiKey: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                    placeholder="Enter your API key"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Secret Key
                  </label>
                  <input
                    type="password"
                    value={apiCredentials.secretKey}
                    onChange={(e) => setApiCredentials(prev => ({ ...prev, secretKey: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                    placeholder="Enter your secret key"
                  />
                </div>

                {showApiForm === 'shopify' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Shop ID
                    </label>
                    <input
                      type="text"
                      value={apiCredentials.shopId}
                      onChange={(e) => setApiCredentials(prev => ({ ...prev, shopId: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                      placeholder="your-shop-name.myshopify.com"
                    />
                  </div>
                )}

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-blue-800 text-sm">
                    <strong>How to find your API credentials:</strong>
                  </p>
                  <ul className="text-blue-700 text-sm mt-1 space-y-1">
                    <li>• Go to your {integrations.find(i => i.id === showApiForm)?.name} dashboard</li>
                    <li>• Navigate to API settings or developer section</li>
                    <li>• Generate or copy your API credentials</li>
                  </ul>
                </div>
              </div>

              <div className="flex space-x-3 mt-6">
                <button
                  onClick={() => handleSubmitCredentials(showApiForm)}
                  className="flex-1 bg-amber-500 text-white py-2 px-4 rounded-lg hover:bg-amber-600 transition-colors"
                >
                  Connect
                </button>
                <button
                  onClick={() => setShowApiForm(null)}
                  className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Help Section */}
      <div className="mt-12 bg-gray-50 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Need Help?</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="font-medium text-gray-900 mb-2">Documentation</h3>
            <p className="text-gray-600 text-sm mb-3">
              Learn how to set up integrations with step-by-step guides
            </p>
            <button className="text-amber-600 hover:text-amber-700 text-sm flex items-center space-x-1">
              <ExternalLink className="h-4 w-4" />
              <span>View Documentation</span>
            </button>
          </div>
          <div>
            <h3 className="font-medium text-gray-900 mb-2">Support</h3>
            <p className="text-gray-600 text-sm mb-3">
              Get help from our support team if you're having trouble
            </p>
            <button className="text-amber-600 hover:text-amber-700 text-sm flex items-center space-x-1">
              <ExternalLink className="h-4 w-4" />
              <span>Contact Support</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IntegrationsPage;