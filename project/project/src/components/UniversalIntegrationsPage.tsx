import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContextMultiRole';
import { supabase } from '../lib/supabase';
import INTEGRATIONS_CONFIG from '../config/integrationsConfig';
import { Settings, Plus, ExternalLink, Check, AlertCircle, Download, Upload, Sync, Store, Package, Link as LinkIcon, Eye } from 'lucide-react';

interface Integration {
  id: string;
  name: string;
  description: string;
  logo: string;
  isConnected: boolean;
  status: 'active' | 'inactive' | 'error' | 'syncing';
  isAvailable: boolean;
  isVisible: boolean;
  availabilityLabel?: string;
  apiKey?: string;
  storeUrl?: string;
  lastSync?: string;
  productCount?: number;
  supportedRoles: ('seller' | 'affiliate')[];
  features: string[];
}

const UniversalIntegrationsPage: React.FC = () => {
  const { profile, currentRole } = useAuth();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);
  const [showConnectionModal, setShowConnectionModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importPreview, setImportPreview] = useState<Array<{
    product_id?: string | null;
    external_id: string;
    title: string;
    image?: string | null;
    status: 'created' | 'updated' | 'skipped';
    platform: 'printful';
  }>>([]);
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

  const getAuthHeader = async () => {
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    return token ? `Bearer ${token}` : '';
  };

  const normalizedRole = String(profile?.primary_role || profile?.role || currentRole || '').toLowerCase();
  const effectiveRole: 'seller' | 'affiliate' =
    normalizedRole === 'affiliate' || normalizedRole === 'partner' ? 'affiliate' : 'seller';

  useEffect(() => {
    initializeIntegrations();
    loadUserIntegrations();
  }, [effectiveRole, profile?.id]);

  const initializeIntegrations = () => {
    const printfulEnabled = INTEGRATIONS_CONFIG.ENABLE_PRINTFUL;

    const availableIntegrations: Integration[] = [

      {
        id: 'printful',
        name: 'Printful',
        description: 'Sync your Printful products and fulfillment',
        logo: 'PFL',
        isConnected: false,
        status: 'inactive',
        isAvailable: printfulEnabled,
        isVisible: printfulEnabled,
        availabilityLabel: printfulEnabled ? undefined : 'Hidden',
        supportedRoles: ['seller', 'affiliate'],
        features: ['Product Catalog', 'Mockup Generation', 'Order Processing', 'Quality Control']
      }
    ];

    // Filter by user role
    const roleSpecificIntegrations = availableIntegrations.filter(integration =>
      integration.supportedRoles.includes(effectiveRole)
    );

    setIntegrations(roleSpecificIntegrations);
  };

  const loadUserIntegrations = async () => {
    if (!profile?.id) return;

    const authHeader = await getAuthHeader();
    if (!authHeader) return;

    const response = await fetch('/api/integrations/list', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: authHeader },
      body: JSON.stringify({}),
    });
    const payload = await response.json().catch(() => ({}));
    const data = Array.isArray(payload?.integrations) ? payload.integrations : [];

    if (data.length) {
      setIntegrations(prev => prev.map(integration => {
        const userIntegration = data.find((ui: any) => ui.platform === integration.id);
        return userIntegration ? {
          ...integration,
          isConnected: Boolean(userIntegration.is_active),
          status: userIntegration.status,
          apiKey: userIntegration.api_key,
          storeUrl: userIntegration.store_url,
          lastSync: userIntegration.last_sync,
          productCount: userIntegration.product_count || 0,
        } : integration;
      }));
    }
  };

  const handleConnect = async () => {
    if (!selectedIntegration || !profile?.id) return;

    setLoading(true);
    try {
      const authHeader = await getAuthHeader();
      if (!authHeader) {
        alert('Please sign in to connect integrations.');
        setLoading(false);
        return;
      }

      const response = await fetch('/api/integrations/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: authHeader },
        body: JSON.stringify({
          platform: selectedIntegration.id,
          apiKey: connectionData.apiKey,
          storeUrl: connectionData.storeUrl,
          autoSync: importSettings.autoSync,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const detail = payload?.error || payload?.details || 'Failed to connect integration.';
        throw new Error(detail);
      }

      setIntegrations(prev => prev.map(integration =>
        integration.id === selectedIntegration.id
          ? { ...integration, isConnected: true, status: 'active' as const }
          : integration
      ));

      setShowConnectionModal(false);
      setConnectionData({ apiKey: '', storeUrl: '', webhookUrl: '' });
      alert('Integration connected successfully!');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to connect integration.';
      console.error('Connection error:', error);
      alert(message);
    }
    setLoading(false);
  };

  const handleImportProducts = async () => {
    if (!selectedIntegration || !profile?.id) return;

    setLoading(true);
    setSyncStatus('Fetching products...');

    try {
      const authHeader = await getAuthHeader();
      if (!authHeader) {
        alert('Please sign in to import products.');
        setLoading(false);
        return;
      }

      const response = await fetch('/api/integrations/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: authHeader },
        body: JSON.stringify({
          platform: selectedIntegration.id,
          commissionRate: importSettings.setCommissionRate,
          markAsAffiliate: importSettings.markAsAffiliate,
          autoSync: importSettings.autoSync,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to import products.');
      }

      const created = payload?.results?.created ?? 0;
      const updated = payload?.results?.updated ?? 0;
      const skipped = payload?.results?.skipped ?? 0;
      const preview = Array.isArray(payload?.results?.preview) ? payload.results.preview : [];
      setImportPreview(preview);
      setSyncStatus(`Imported ${created} new, updated ${updated}, skipped ${skipped}.`);

      alert(`Import complete. Created ${created}, updated ${updated}, skipped ${skipped}.`);
      
    } catch (error) {
      console.error('Import error:', error);
      alert('Failed to import products. Please check your connection and try again.');
    }
    setLoading(false);
  };

  const handleDisconnect = async (integrationId: string) => {
    if (!profile?.id) return;

    const authHeader = await getAuthHeader();
    if (!authHeader) return;

    const response = await fetch('/api/integrations/disconnect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: authHeader },
      body: JSON.stringify({ platform: integrationId }),
    });
    if (response.ok) {
      setIntegrations(prev => prev.map(integration =>
        integration.id === integrationId
          ? { ...integration, isConnected: false, status: 'inactive' as const }
          : integration
      ));
    }
  };

  const isSeller = effectiveRole === 'seller';
  const roleTitle = isSeller ? 'Seller' : 'Affiliate';
  const filteredIntegrations = integrations.filter(integration =>
    integration.supportedRoles.includes(effectiveRole)
  );

  // Hide integrations unless explicitly enabled, but always show if already connected.
  const visibleIntegrations = filteredIntegrations.filter(integration =>
    integration.isVisible || integration.isConnected
  );

  const otherIntegrations = visibleIntegrations;

  return (
    <div className="max-w-6xl mx-auto px-2 py-4">
      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 text-white shadow-lg">
          <div className="text-3xl font-bold">{visibleIntegrations.filter(i => i.isConnected).length}</div>
          <div className="text-sm text-blue-100">Connected Platforms</div>
        </div>
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-4 text-white shadow-lg">
          <div className="text-3xl font-bold">
            {visibleIntegrations.reduce((sum, i) => sum + (i.productCount || 0), 0)}
          </div>
          <div className="text-sm text-green-100">Imported Products</div>
        </div>
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-4 text-white shadow-lg">
          <div className="text-3xl font-bold">{visibleIntegrations.length}</div>
          <div className="text-sm text-purple-100">Available Integrations</div>
        </div>
      </div>

      {/* Integration Grid */}
      {otherIntegrations.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {otherIntegrations.map((integration) => (
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
              {!integration.isAvailable && !integration.isConnected && (
                <div className="flex items-center space-x-1">
                  <AlertCircle className="w-4 h-4 text-gray-400" />
                  <span className="text-xs text-gray-500">{integration.availabilityLabel || 'Coming soon'}</span>
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
                    if (!integration.isAvailable) return;
                    setSelectedIntegration(integration);
                    setShowConnectionModal(true);
                  }}
                  disabled={!integration.isAvailable}
                  className="flex-1 bg-amber-500 text-white px-4 py-2 rounded-lg hover:bg-amber-600 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {integration.isAvailable ? 'Connect' : (integration.availabilityLabel || 'Coming soon')}
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
      )}

      {/* Empty / Coming Soon */}
      {otherIntegrations.length === 0 && (
        <div className="mt-2 rounded-xl border border-dashed border-gray-300 bg-white p-6 text-center">
          <h3 className="text-base font-semibold text-gray-900">More integrations are coming</h3>
          <p className="mt-1 text-sm text-gray-600">Approved supplier and storefront connections will appear here when enabled.</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {['Shopify', 'Etsy', 'WooCommerce', 'CSV import'].map((name) => (
              <span key={name} className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                {name}
              </span>
            ))}
          </div>
        </div>
      )}

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
              
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-900 font-semibold mb-2">📖 Setup Instructions for {selectedIntegration.name}:</p>
                <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                  {selectedIntegration.id === 'printful' && (
                    <>
                      <li>Visit <a href="https://www.printful.com/dashboard/store" target="_blank" rel="noopener noreferrer" className="underline font-medium">Printful Store Settings</a></li>
                      <li>Go to "Store Settings" → "API"</li>
                      <li>Enable API access and copy your API key</li>
                      <li>Paste it above to connect</li>
                      <li>We connect the first Printful store on this token (disconnect + reconnect to change).</li>
                    </>
                  )}
                  {selectedIntegration.id === 'shopify' && (
                    <>
                      <li>Go to your Shopify Admin → Apps</li>
                      <li>Click "Develop apps" → "Create an app"</li>
                      <li>Configure Admin API scopes (read_products, read_inventory)</li>
                      <li>Install app and copy the Admin API access token</li>
                    </>
                  )}
                  {selectedIntegration.id === 'etsy' && (
                    <>
                      <li>Visit <a href="https://www.etsy.com/developers/your-apps" target="_blank" rel="noopener noreferrer" className="underline font-medium">Etsy Developer Portal</a></li>
                      <li>Create a new app or select existing</li>
                      <li>Copy your API Key (also called Keystring)</li>
                      <li>Paste it above</li>
                    </>
                  )}
                  {!['printful', 'shopify', 'etsy'].includes(selectedIntegration.id) && (
                    <>
                      <li>Log into your {selectedIntegration.name} account</li>
                      <li>Navigate to API settings or developer section</li>
                      <li>Generate a new API key with read permissions</li>
                      <li>Copy and paste the key above</li>
                    </>
                  )}
                </ol>
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

              {isSeller && (
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
              )}

              {effectiveRole === 'affiliate' && (
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
                <p className="text-xs text-gray-500 mt-1">
                  POD imports default to $0 shipping in Beezio. You can edit shipping on each product after import.
                </p>
              </div>

              {syncStatus && (
                <div className="bg-blue-50 p-3 rounded-lg">
                  <p className="text-sm text-blue-800">{syncStatus}</p>
                </div>
              )}

              {importPreview.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="text-sm font-semibold text-gray-900 mb-3">Imported items (latest)</div>
                  <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                    {importPreview.map((item, index) => (
                      <div key={`${item.external_id}-${index}`} className="flex items-center gap-3">
                        {item.image ? (
                          <img
                            src={item.image}
                            alt={item.title}
                            className="h-10 w-10 rounded border object-cover"
                            onError={(event) => {
                              const target = event.currentTarget;
                              target.onerror = null;
                              target.style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="h-10 w-10 rounded border bg-gray-100 flex items-center justify-center text-xs text-gray-500">
                            No img
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-900 truncate">{item.title}</div>
                          <div className="text-xs text-gray-500">
                            {item.status.toUpperCase()} - {item.platform}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">Showing up to the latest 25 items.</p>
                </div>
              )}
            </div>
            <div className="p-6 border-t flex space-x-3">
              <button
                onClick={() => { setShowImportModal(false); setImportPreview([]); setSyncStatus(''); }}
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

