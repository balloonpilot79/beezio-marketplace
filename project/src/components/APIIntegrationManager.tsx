import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { ExternalLink, Key, Settings, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';

interface APIConnection {
  id: string;
  provider: 'printful' | 'printify' | 'shopify' | 'custom';
  api_key: string;
  store_id?: string;
  webhook_url?: string;
  status: 'connected' | 'disconnected' | 'error';
  last_sync: string;
  products_synced: number;
}

const APIIntegrationManager: React.FC = () => {
  const { profile } = useAuth();
  const [connections, setConnections] = useState<APIConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddConnection, setShowAddConnection] = useState(false);
  const [newConnection, setNewConnection] = useState({
    provider: 'printful' as 'printful' | 'printify' | 'shopify' | 'custom',
    api_key: '',
    store_id: '',
    webhook_url: ''
  });

  useEffect(() => {
    fetchConnections();
  }, []);

  const fetchConnections = async () => {
    try {
      const { data, error } = await supabase
        .from('api_connections')
        .select('*')
        .eq('seller_id', profile?.id);

      if (error) throw error;
      setConnections(data || []);
    } catch (error) {
      console.error('Error fetching API connections:', error);
    } finally {
      setLoading(false);
    }
  };

  const addConnection = async () => {
    try {
      const { data, error } = await supabase
        .from('api_connections')
        .insert([{
          ...newConnection,
          seller_id: profile?.id,
          status: 'connected',
          last_sync: new Date().toISOString(),
          products_synced: 0
        }])
        .select()
        .single();

      if (error) throw error;

      setConnections([...connections, data]);
      setNewConnection({
        provider: 'printful',
        api_key: '',
        store_id: '',
        webhook_url: ''
      });
      setShowAddConnection(false);

      // Trigger initial sync
      await syncProducts(data.id, data.provider);
    } catch (error) {
      console.error('Error adding connection:', error);
      alert('Failed to add connection. Please check your credentials.');
    }
  };

  const syncProducts = async (connectionId: string, provider: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('sync-external-products', {
        body: { connection_id: connectionId, provider }
      });

      if (error) throw error;

      // Update connection status
      await supabase
        .from('api_connections')
        .update({
          last_sync: new Date().toISOString(),
          products_synced: data.synced_count,
          status: 'connected'
        })
        .eq('id', connectionId);

      fetchConnections();
      alert(`Successfully synced ${data.synced_count} products!`);
    } catch (error) {
      console.error('Error syncing products:', error);
      alert('Failed to sync products. Please check your connection.');
    }
  };

  const deleteConnection = async (connectionId: string) => {
    if (!confirm('Are you sure you want to delete this connection?')) return;

    try {
      const { error } = await supabase
        .from('api_connections')
        .delete()
        .eq('id', connectionId);

      if (error) throw error;

      setConnections(connections.filter(c => c.id !== connectionId));
    } catch (error) {
      console.error('Error deleting connection:', error);
      alert('Failed to delete connection.');
    }
  };

  const getProviderInfo = (provider: string) => {
    const info = {
      printful: {
        name: 'Printful',
        description: 'Print-on-demand products and fulfillment',
        docs: 'https://developers.printful.com/',
        fields: ['API Key']
      },
      printify: {
        name: 'Printify',
        description: 'Print-on-demand marketplace',
        docs: 'https://developers.printify.com/',
        fields: ['API Key', 'Store ID']
      },
      shopify: {
        name: 'Shopify',
        description: 'Import products from your Shopify store',
        docs: 'https://shopify.dev/docs/admin-api/rest/reference',
        fields: ['API Key', 'Store ID']
      },
      custom: {
        name: 'Custom API',
        description: 'Connect to your custom product API',
        docs: '#',
        fields: ['API Key', 'Webhook URL']
      }
    };
    return info[provider as keyof typeof info];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-10 max-w-4xl mx-auto py-10 px-2 sm:px-4">
      <div className="bg-gradient-to-r from-yellow-50 via-orange-50 to-purple-50 rounded-2xl shadow-xl border border-gray-100 p-8 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div>
          <h2 className="text-3xl font-extrabold text-gray-900 mb-2 tracking-tight">API Integrations</h2>
          <p className="text-lg text-gray-600">Connect your external stores and services to sync products automatically</p>
        </div>
        <button
          onClick={() => setShowAddConnection(true)}
          className="bg-gradient-to-r from-orange-500 to-amber-500 text-white px-6 py-3 rounded-xl font-bold hover:from-orange-600 hover:to-amber-600 transition-all shadow"
        >
          Add Integration
        </button>
      </div>

      {/* Existing Connections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {connections.map((connection) => {
          const providerInfo = getProviderInfo(connection.provider);
          return (
            <div key={connection.id} className="bg-white/90 rounded-2xl shadow-xl border border-gray-100 p-6 flex flex-col gap-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center shadow">
                    <ExternalLink className="w-6 h-6 text-orange-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-1">{providerInfo.name}</h3>
                    <p className="text-sm text-gray-600">{providerInfo.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {connection.status === 'connected' ? (
                    <CheckCircle className="w-6 h-6 text-green-600" />
                  ) : (
                    <AlertCircle className="w-6 h-6 text-red-600" />
                  )}
                  <span className={`text-base font-semibold ${
                    connection.status === 'connected' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {connection.status}
                  </span>
                </div>
              </div>

              <div className="space-y-2 text-sm text-gray-600 mb-4">
                <div className="flex justify-between">
                  <span>Products Synced:</span>
                  <span className="font-medium">{connection.products_synced}</span>
                </div>
                <div className="flex justify-between">
                  <span>Last Sync:</span>
                  <span>{new Date(connection.last_sync).toLocaleDateString()}</span>
                </div>
              </div>

              <div className="flex space-x-2">
                <button
                  onClick={() => syncProducts(connection.id, connection.provider)}
                  className="flex-1 bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center space-x-1"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Sync</span>
                </button>
                <button
                  onClick={() => deleteConnection(connection.id)}
                  className="bg-red-600 text-white px-3 py-2 rounded-lg hover:bg-red-700 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {connections.length === 0 && (
        <div className="text-center py-12">
          <ExternalLink className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No integrations yet</h3>
          <p className="text-gray-600 mb-4">
            Connect your external stores to automatically sync products to Beezio
          </p>
          <button
            onClick={() => setShowAddConnection(true)}
            className="bg-orange-600 text-white px-6 py-2 rounded-lg hover:bg-orange-700 transition-colors"
          >
            Add Your First Integration
          </button>
        </div>
      )}

      {/* Add Connection Modal */}
      {showAddConnection && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b">
              <h3 className="text-lg font-semibold">Add API Integration</h3>
              <button
                onClick={() => setShowAddConnection(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Provider
                </label>
                <select
                  value={newConnection.provider}
                  onChange={(e) => setNewConnection({
                    ...newConnection,
                    provider: e.target.value as any
                  })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                >
                  <option value="printful">Printful</option>
                  <option value="printify">Printify</option>
                  <option value="shopify">Shopify</option>
                  <option value="custom">Custom API</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  {getProviderInfo(newConnection.provider).description}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  API Key
                </label>
                <input
                  type="password"
                  value={newConnection.api_key}
                  onChange={(e) => setNewConnection({
                    ...newConnection,
                    api_key: e.target.value
                  })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="Enter your API key"
                />
              </div>

              {(newConnection.provider === 'printify' || newConnection.provider === 'shopify') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Store ID
                  </label>
                  <input
                    type="text"
                    value={newConnection.store_id}
                    onChange={(e) => setNewConnection({
                      ...newConnection,
                      store_id: e.target.value
                    })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    placeholder="Enter your store ID"
                  />
                </div>
              )}

              {newConnection.provider === 'custom' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Webhook URL
                  </label>
                  <input
                    type="url"
                    value={newConnection.webhook_url}
                    onChange={(e) => setNewConnection({
                      ...newConnection,
                      webhook_url: e.target.value
                    })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    placeholder="https://your-api.com/webhook"
                  />
                </div>
              )}

              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="flex items-center space-x-2 mb-2">
                  <Key className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-900">
                    Need help getting your API key?
                  </span>
                </div>
                <a
                  href={getProviderInfo(newConnection.provider).docs}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:text-blue-800 flex items-center space-x-1"
                >
                  <span>View {getProviderInfo(newConnection.provider).name} documentation</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            <div className="flex space-x-3 p-6 border-t">
              <button
                onClick={addConnection}
                disabled={!newConnection.api_key}
                className="flex-1 bg-orange-600 text-white py-2 px-4 rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Connect & Sync Products
              </button>
              <button
                onClick={() => setShowAddConnection(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default APIIntegrationManager;
