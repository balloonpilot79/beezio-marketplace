import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Settings, Plus, ExternalLink, Check, AlertCircle, Download, Upload, Sync, Store, Package, Link as LinkIcon, Eye } from 'lucide-react';

interface Integration {
  id: string;
  name: string;
  description: string;
  logo: string;
  isConnected: boolean;
  status: 'active' | 'inactive' | 'error' | 'syncing';
  apiKey?: string;
  storeUrl?: string;
  lastSync?: string;
  productCount?: number;
  supportedRoles: ('seller' | 'affiliate')[];
  features: string[];
}

interface ImportedProduct {
  external_id: string;
  title: string;
  description: string;
  price: number;
  images: string[];
  category: string;
  tags: string[];
  inventory_count: number;
  source_platform: string;
  source_url: string;
}

const UniversalIntegrationsPage: React.FC = () => {
  const { profile } = useAuth();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);
  const [showConnectionModal, setShowConnectionModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [connectionData, setConnectionData] = useState({
    apiKey: '',
    storeUrl: '',
    webhookUrl: ''
  });
  const [importSettings, setImportSettings] = useState({
    importAll: true,
    selectedCategories: [] as string[],
    setCommissionRate: 25,
    markAsAffiliate: false,
    autoSync: false
  });
  const [loading, setLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string>('');

  useEffect(() => {
    initializeIntegrations();
    loadUserIntegrations();
  }, [profile]);

  const initializeIntegrations = () => {
    const availableIntegrations: Integration[] = [
      {
        id: 'shopify',
        name: 'Shopify',
        description: 'Import products from your Shopify store',
        logo: '🛍️',
        isConnected: false,
        status: 'inactive',
        supportedRoles: ['seller', 'affiliate'],
        features: ['Product Import', 'Inventory Sync', 'Order Management', 'Auto Updates']
      },
      {
        id: 'printify',
        name: 'Printify',
        description: 'Connect your Print-on-Demand products',
        logo: '🖨️',
        isConnected: false,
        status: 'inactive',
        supportedRoles: ['seller', 'affiliate'],
        features: ['Product Import', 'Design Sync', 'Order Fulfillment', 'Shipping Integration']
      },
      {
        id: 'printful',
        name: 'Printful',
        description: 'Sync your Printful products and fulfillment',
        logo: '📦',
        isConnected: false,
        status: 'inactive',
        supportedRoles: ['seller', 'affiliate'],
        features: ['Product Catalog', 'Mockup Generation', 'Order Processing', 'Quality Control']
      },
      {
        id: 'etsy',
        name: 'Etsy',
        description: 'Import your handmade and vintage items',
        logo: '🎨',
        isConnected: false,
        status: 'inactive',
        supportedRoles: ['seller', 'affiliate'],
        features: ['Listing Import', 'Shop Sync', 'Review Integration', 'SEO Data']
      },
      {
        id: 'amazon',
        name: 'Amazon Seller',
        description: 'Connect your Amazon Seller Central account',
        logo: '📱',
        isConnected: false,
        status: 'inactive',
        supportedRoles: ['seller'],
        features: ['Product Catalog', 'FBA Integration', 'Analytics', 'Inventory Management']
      },
      {
        id: 'ebay',
        name: 'eBay',
        description: 'Import your eBay listings and auctions',
        logo: '🏷️',
        isConnected: false,
        status: 'inactive',
        supportedRoles: ['seller', 'affiliate'],
        features: ['Listing Import', 'Auction Sync', 'Feedback Integration', 'Category Mapping']
      },
      {
        id: 'woocommerce',
        name: 'WooCommerce',
        description: 'Connect your WordPress WooCommerce store',
        logo: '🌐',
        isConnected: false,
        status: 'inactive',
        supportedRoles: ['seller', 'affiliate'],
        features: ['Product Import', 'Order Sync', 'Customer Data', 'Plugin Integration']
      },
      {
        id: 'square',
        name: 'Square',
        description: 'Import from your Square online store',
        logo: '⬜',
        isConnected: false,
        status: 'inactive',
        supportedRoles: ['seller'],
        features: ['Product Catalog', 'POS Integration', 'Payment Processing', 'Analytics']
      },
      {
        id: 'bigcommerce',
        name: 'BigCommerce',
        description: 'Connect your BigCommerce storefront',
        logo: '🏪',
        isConnected: false,
        status: 'inactive',
        supportedRoles: ['seller', 'affiliate'],
        features: ['Store Sync', 'Multi-channel', 'API Integration', 'Analytics']
      },
      {
        id: 'csv',
        name: 'CSV Import',
        description: 'Upload products via CSV file',
        logo: '📊',
        isConnected: false,
        status: 'inactive',
        supportedRoles: ['seller', 'affiliate'],
        features: ['Bulk Import', 'Custom Mapping', 'Data Validation', 'Template Download']
      }
    ];

    // Filter by user role
    const roleSpecificIntegrations = availableIntegrations.filter(integration =>
      integration.supportedRoles.includes(profile?.role as 'seller' | 'affiliate')
    );

    setIntegrations(roleSpecificIntegrations);
  };

  const loadUserIntegrations = async () => {
    if (!profile?.id) return;

    const { data } = await supabase
      .from('user_integrations')
      .select('*')
      .eq('user_id', profile.id);

    if (data) {
      setIntegrations(prev => prev.map(integration => {
        const userIntegration = data.find(ui => ui.platform === integration.id);
        return userIntegration ? {
          ...integration,
          isConnected: userIntegration.is_active,
          status: userIntegration.status,
          apiKey: userIntegration.api_key,
          storeUrl: userIntegration.store_url,
          lastSync: userIntegration.last_sync,
          productCount: userIntegration.product_count || 0
        } : integration;
      }));
    }
  };

  const handleConnect = async () => {
    if (!selectedIntegration || !profile?.id) return;

    setLoading(true);
    try {
      // Test the connection first
      if (selectedIntegration.id !== 'csv') {
        const isValid = await testApiConnection(selectedIntegration.id, connectionData.apiKey, connectionData.storeUrl);
        if (!isValid) {
          alert('Connection failed. Please check your credentials.');
          setLoading(false);
          return;
        }
      }

      // Save integration
      const { error } = await supabase
        .from('user_integrations')
        .upsert({
          user_id: profile.id,
          platform: selectedIntegration.id,
          api_key: connectionData.apiKey,
          store_url: connectionData.storeUrl,
          webhook_url: connectionData.webhookUrl,
          is_active: true,
          status: 'active',
          connected_at: new Date().toISOString()
        });

      if (error) throw error;

      // Update local state
      setIntegrations(prev => prev.map(integration =>
        integration.id === selectedIntegration.id
          ? { ...integration, isConnected: true, status: 'active' as const }
          : integration
      ));

      setShowConnectionModal(false);
      setConnectionData({ apiKey: '', storeUrl: '', webhookUrl: '' });
      alert('Integration connected successfully!');
    } catch (error) {
      console.error('Connection error:', error);
      alert('Failed to connect integration.');
    }
    setLoading(false);
  };

  const handleImportProducts = async () => {
    if (!selectedIntegration || !profile?.id) return;

    setLoading(true);
    setSyncStatus('Fetching products...');

    try {
      let importedProducts: ImportedProduct[] = [];

      // Different import strategies based on platform
      switch (selectedIntegration.id) {
        case 'shopify':
          importedProducts = await importFromShopify(selectedIntegration.apiKey!, selectedIntegration.storeUrl!);
          break;
        case 'printify':
          importedProducts = await importFromPrintify(selectedIntegration.apiKey!);
          break;
        case 'printful':
          importedProducts = await importFromPrintful(selectedIntegration.apiKey!);
          break;
        case 'etsy':
          importedProducts = await importFromEtsy(selectedIntegration.apiKey!);
          break;
        case 'csv':
          // Handle CSV import separately
          break;
        default:
          importedProducts = await importFromGenericAPI(selectedIntegration);
      }

      setSyncStatus(`Processing ${importedProducts.length} products...`);

      // Process and save products
      const processedProducts = await processImportedProducts(importedProducts);
      await saveImportedProducts(processedProducts);

      // Update integration stats
      await supabase
        .from('user_integrations')
        .update({
          last_sync: new Date().toISOString(),
          product_count: importedProducts.length,
          status: 'active'
        })
        .eq('user_id', profile.id)
        .eq('platform', selectedIntegration.id);

      setShowImportModal(false);
      setSyncStatus('');
      alert(`Successfully imported ${importedProducts.length} products!`);
      
    } catch (error) {
      console.error('Import error:', error);
      alert('Failed to import products. Please check your connection and try again.');
    }
    setLoading(false);
  };

  const testApiConnection = async (platform: string, apiKey: string, storeUrl?: string): Promise<boolean> => {
    // Mock API connection test - replace with actual API calls
    await new Promise(resolve => setTimeout(resolve, 1000));
    return apiKey.length > 10; // Simple validation
  };

  const importFromShopify = async (apiKey: string, storeUrl: string): Promise<ImportedProduct[]> => {
    // Mock Shopify import - replace with actual Shopify API integration
    await new Promise(resolve => setTimeout(resolve, 2000));
    return [
      {
        external_id: 'shopify_123',
        title: 'Premium T-Shirt',
        description: 'High-quality cotton t-shirt',
        price: 24.99,
        images: ['https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=500'],
        category: 'Clothing',
        tags: ['apparel', 'cotton', 'casual'],
        inventory_count: 50,
        source_platform: 'shopify',
        source_url: `${storeUrl}/products/premium-t-shirt`
      }
      // Add more mock products...
    ];
  };

  const importFromPrintify = async (apiKey: string): Promise<ImportedProduct[]> => {
    // Mock Printify import
    await new Promise(resolve => setTimeout(resolve, 1500));
    return [
      {
        external_id: 'printify_456',
        title: 'Custom Mug Design',
        description: 'Personalized ceramic mug',
        price: 15.99,
        images: ['https://images.unsplash.com/photo-1514228742587-6b1558fcf400?w=500'],
        category: 'Home & Kitchen',
        tags: ['mug', 'custom', 'ceramic'],
        inventory_count: 999,
        source_platform: 'printify',
        source_url: 'https://printify.com/product/456'
      }
    ];
  };

  const importFromPrintful = async (apiKey: string): Promise<ImportedProduct[]> => {
    // Mock Printful import
    await new Promise(resolve => setTimeout(resolve, 1500));
    return [
      {
        external_id: 'printful_789',
        title: 'Eco-Friendly Tote Bag',
        description: 'Sustainable canvas tote bag',
        price: 18.50,
        images: ['https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=500'],
        category: 'Accessories',
        tags: ['tote', 'eco-friendly', 'canvas'],
        inventory_count: 999,
        source_platform: 'printful',
        source_url: 'https://printful.com/product/789'
      }
    ];
  };

  const importFromEtsy = async (apiKey: string): Promise<ImportedProduct[]> => {
    // Mock Etsy import
    await new Promise(resolve => setTimeout(resolve, 2000));
    return [
      {
        external_id: 'etsy_101',
        title: 'Handmade Jewelry Set',
        description: 'Artisan crafted silver jewelry',
        price: 45.00,
        images: ['https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=500'],
        category: 'Jewelry',
        tags: ['handmade', 'silver', 'artisan'],
        inventory_count: 5,
        source_platform: 'etsy',
        source_url: 'https://etsy.com/listing/101'
      }
    ];
  };

  const importFromGenericAPI = async (integration: Integration): Promise<ImportedProduct[]> => {
    // Generic API import handler
    await new Promise(resolve => setTimeout(resolve, 1000));
    return [];
  };

  const processImportedProducts = async (products: ImportedProduct[]): Promise<any[]> => {
    return products.map(product => ({
      title: product.title,
      description: product.description,
      price: product.price,
      images: product.images,
      category: product.category,
      tags: product.tags,
      quantity: product.inventory_count,
      seller_id: profile?.id,
      is_active: true,
      commission_rate: importSettings.setCommissionRate,
      commission_type: 'percentage',
      external_id: product.external_id,
      source_platform: product.source_platform,
      source_url: product.source_url,
      is_affiliate_product: importSettings.markAsAffiliate && profile?.role === 'affiliate'
    }));
  };

  const saveImportedProducts = async (products: any[]) => {
    const { error } = await supabase
      .from('products')
      .insert(products);
    
    if (error) throw error;
  };

  const handleDisconnect = async (integrationId: string) => {
    if (!profile?.id) return;

    const { error } = await supabase
      .from('user_integrations')
      .update({ is_active: false, status: 'inactive' })
      .eq('user_id', profile.id)
      .eq('platform', integrationId);

    if (!error) {
      setIntegrations(prev => prev.map(integration =>
        integration.id === integrationId
          ? { ...integration, isConnected: false, status: 'inactive' as const }
          : integration
      ));
    }
  };

  const roleTitle = profile?.role === 'seller' ? 'Seller' : 'Affiliate';
  const filteredIntegrations = integrations.filter(integration =>
    integration.supportedRoles.includes(profile?.role as 'seller' | 'affiliate')
  );

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          {roleTitle} Integrations
        </h1>
        <p className="text-gray-600">
          Connect your existing stores and platforms to import products automatically
        </p>
      </div>

      {/* Integration Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredIntegrations.map((integration) => (
          <div key={integration.id} className="bg-white rounded-lg shadow-sm border p-6 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="text-3xl">{integration.logo}</div>
                <div>
                  <h3 className="font-semibold text-gray-900">{integration.name}</h3>
                  <p className="text-sm text-gray-600 mt-1">{integration.description}</p>
                </div>
              </div>
              
              {integration.isConnected && (
                <div className="flex items-center space-x-1">
                  <Check className="w-4 h-4 text-green-500" />
                  <span className="text-sm text-green-600">Connected</span>
                </div>
              )}
            </div>

            {/* Features */}
            <div className="mb-4">
              <div className="flex flex-wrap gap-1">
                {integration.features.slice(0, 2).map(feature => (
                  <span key={feature} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                    {feature}
                  </span>
                ))}
                {integration.features.length > 2 && (
                  <span className="text-xs text-gray-500">+{integration.features.length - 2} more</span>
                )}
              </div>
            </div>

            {/* Stats */}
            {integration.isConnected && (
              <div className="mb-4 p-3 bg-gray-50 rounded">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-gray-600">Products</div>
                    <div className="font-semibold">{integration.productCount || 0}</div>
                  </div>
                  <div>
                    <div className="text-gray-600">Last Sync</div>
                    <div className="font-semibold">
                      {integration.lastSync ? new Date(integration.lastSync).toLocaleDateString() : 'Never'}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex space-x-2">
              {!integration.isConnected ? (
                <button
                  onClick={() => {
                    setSelectedIntegration(integration);
                    setShowConnectionModal(true);
                  }}
                  className="flex-1 bg-amber-500 text-white px-4 py-2 rounded-lg hover:bg-amber-600 transition-colors text-sm font-medium"
                >
                  Connect
                </button>
              ) : (
                <>
                  <button
                    onClick={() => {
                      setSelectedIntegration(integration);
                      setShowImportModal(true);
                    }}
                    className="flex-1 bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium"
                  >
                    Import
                  </button>
                  <button
                    onClick={() => handleDisconnect(integration.id)}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
                  >
                    Disconnect
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Connection Modal */}
      {showConnectionModal && selectedIntegration && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="p-6 border-b">
              <h3 className="text-lg font-semibold">Connect {selectedIntegration.name}</h3>
            </div>
            <div className="p-6 space-y-4">
              {selectedIntegration.id !== 'csv' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      API Key
                    </label>
                    <input
                      type="password"
                      value={connectionData.apiKey}
                      onChange={(e) => setConnectionData(prev => ({ ...prev, apiKey: e.target.value }))}
                      placeholder="Enter your API key"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    />
                  </div>
                  
                  {(selectedIntegration.id === 'shopify' || selectedIntegration.id === 'woocommerce') && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Store URL
                      </label>
                      <input
                        type="url"
                        value={connectionData.storeUrl}
                        onChange={(e) => setConnectionData(prev => ({ ...prev, storeUrl: e.target.value }))}
                        placeholder="https://your-store.myshopify.com"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                      />
                    </div>
                  )}
                </>
              )}
              
              <div className="bg-blue-50 p-3 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>Setup Instructions:</strong><br />
                  1. Log into your {selectedIntegration.name} account<br />
                  2. Navigate to API settings or developer section<br />
                  3. Generate a new API key with read permissions<br />
                  4. Copy and paste the key above
                </p>
              </div>
            </div>
            <div className="p-6 border-t flex space-x-3">
              <button
                onClick={() => setShowConnectionModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConnect}
                disabled={loading || (!connectionData.apiKey && selectedIntegration.id !== 'csv')}
                className="flex-1 bg-amber-500 text-white px-4 py-2 rounded-lg hover:bg-amber-600 transition-colors disabled:opacity-50"
              >
                {loading ? 'Connecting...' : 'Connect'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && selectedIntegration && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl">
            <div className="p-6 border-b">
              <h3 className="text-lg font-semibold">Import from {selectedIntegration.name}</h3>
            </div>
            <div className="p-6 space-y-6">
              <div>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={importSettings.importAll}
                    onChange={(e) => setImportSettings(prev => ({ ...prev, importAll: e.target.checked }))}
                    className="rounded border-gray-300 text-amber-500 focus:ring-amber-500"
                  />
                  <span className="font-medium">Import all products</span>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Commission Rate (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={importSettings.setCommissionRate}
                  onChange={(e) => setImportSettings(prev => ({ ...prev, setCommissionRate: parseInt(e.target.value) }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                />
              </div>

              {profile?.role === 'affiliate' && (
                <div>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={importSettings.markAsAffiliate}
                      onChange={(e) => setImportSettings(prev => ({ ...prev, markAsAffiliate: e.target.checked }))}
                      className="rounded border-gray-300 text-amber-500 focus:ring-amber-500"
                    />
                    <span className="font-medium">Mark as affiliate products</span>
                  </label>
                </div>
              )}

              <div>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={importSettings.autoSync}
                    onChange={(e) => setImportSettings(prev => ({ ...prev, autoSync: e.target.checked }))}
                    className="rounded border-gray-300 text-amber-500 focus:ring-amber-500"
                  />
                  <span className="font-medium">Enable automatic sync</span>
                </label>
                <p className="text-sm text-gray-600 mt-1">
                  Automatically sync new products and inventory changes
                </p>
              </div>

              {syncStatus && (
                <div className="bg-blue-50 p-3 rounded-lg">
                  <p className="text-sm text-blue-800">{syncStatus}</p>
                </div>
              )}
            </div>
            <div className="p-6 border-t flex space-x-3">
              <button
                onClick={() => setShowImportModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleImportProducts}
                disabled={loading}
                className="flex-1 bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
              >
                {loading ? 'Importing...' : 'Import Products'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UniversalIntegrationsPage;
