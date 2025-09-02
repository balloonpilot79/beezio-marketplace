import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface CustomVendor {
  id: string;
  vendor_name: string;
  vendor_type: 'api' | 'webhook' | 'ftp' | 'email' | 'manual';
  api_endpoint?: string;
  api_key?: string;
  api_secret?: string;
  webhook_url?: string;
  ftp_host?: string;
  ftp_username?: string;
  ftp_password?: string;
  email_address?: string;
  contact_info: any;
  supported_features: {
    order_placement: boolean;
    inventory_sync: boolean;
    shipping_labels: boolean;
    tracking_updates: boolean;
    returns_handling: boolean;
  };
  authentication_method: 'api_key' | 'oauth' | 'basic_auth' | 'bearer_token';
  request_format: 'json' | 'xml' | 'form_data';
  response_format: 'json' | 'xml';
  rate_limits: {
    requests_per_minute: number;
    requests_per_hour: number;
  };
  is_active: boolean;
  test_mode: boolean;
  created_at: string;
}

interface CustomVendorProduct {
  id: string;
  custom_vendor_id: string;
  product_id: string;
  vendor_product_id: string;
  vendor_sku?: string;
  vendor_product_name?: string;
  vendor_price?: number;
  vendor_stock_quantity: number;
  sync_status: 'pending' | 'success' | 'failed' | 'syncing';
  last_synced?: string;
}

const CustomVendorManager: React.FC = () => {
  const [vendors, setVendors] = useState<CustomVendor[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [vendorProducts, setVendorProducts] = useState<CustomVendorProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<CustomVendor | null>(null);
  const [testResults, setTestResults] = useState<any>(null);

  // Form state for new vendor
  const [newVendor, setNewVendor] = useState<Partial<CustomVendor>>({
    vendor_type: 'api',
    authentication_method: 'api_key',
    request_format: 'json',
    response_format: 'json',
    supported_features: {
      order_placement: false,
      inventory_sync: false,
      shipping_labels: false,
      tracking_updates: false,
      returns_handling: false
    },
    rate_limits: {
      requests_per_minute: 60,
      requests_per_hour: 1000
    },
    is_active: true,
    test_mode: true
  });

  useEffect(() => {
    loadVendors();
    loadProducts();
  }, []);

  const loadVendors = async () => {
    try {
      const { data, error } = await supabase
        .from('custom_vendors')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setVendors(data || []);
    } catch (error) {
      console.error('Error loading vendors:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, title, price')
        .order('title');

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error loading products:', error);
    }
  };

  const loadVendorProducts = async (vendorId: string) => {
    try {
      const { data, error } = await supabase
        .from('custom_vendor_products')
        .select('*')
        .eq('custom_vendor_id', vendorId);

      if (error) throw error;
      setVendorProducts(data || []);
    } catch (error) {
      console.error('Error loading vendor products:', error);
    }
  };

  const handleAddVendor = async () => {
    try {
      const { data, error } = await supabase
        .from('custom_vendors')
        .insert([newVendor])
        .select()
        .single();

      if (error) throw error;

      setVendors([data, ...vendors]);
      setShowAddForm(false);
      setNewVendor({
        vendor_type: 'api',
        authentication_method: 'api_key',
        request_format: 'json',
        response_format: 'json',
        supported_features: {
          order_placement: false,
          inventory_sync: false,
          shipping_labels: false,
          tracking_updates: false,
          returns_handling: false
        },
        rate_limits: {
          requests_per_minute: 60,
          requests_per_hour: 1000
        },
        is_active: true,
        test_mode: true
      });
    } catch (error) {
      console.error('Error adding vendor:', error);
      alert('Error adding vendor. Please try again.');
    }
  };

  const handleTestConnection = async (vendor: CustomVendor) => {
    try {
      setTestResults(null);
      const { data, error } = await supabase.rpc('test_custom_vendor_connection', {
        p_vendor_id: vendor.id
      });

      if (error) throw error;
      setTestResults(data);
    } catch (error) {
      console.error('Error testing connection:', error);
      setTestResults({ success: false, error: error.message });
    }
  };

  const handleSyncProducts = async (vendorId: string) => {
    try {
      const { data, error } = await supabase.rpc('sync_custom_vendor_products', {
        p_vendor_id: vendorId
      });

      if (error) throw error;
      alert(`Successfully synced ${data} products!`);
      loadVendorProducts(vendorId);
    } catch (error) {
      console.error('Error syncing products:', error);
      alert('Error syncing products. Please try again.');
    }
  };

  const handleAddProductMapping = async (vendorId: string, productId: string, vendorProductId: string) => {
    try {
      const { error } = await supabase
        .from('custom_vendor_products')
        .insert([{
          custom_vendor_id: vendorId,
          product_id: productId,
          vendor_product_id: vendorProductId
        }]);

      if (error) throw error;
      loadVendorProducts(vendorId);
    } catch (error) {
      console.error('Error adding product mapping:', error);
      alert('Error adding product mapping. Please try again.');
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading...</div>;
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Custom Vendor Integrations</h1>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
        >
          {showAddForm ? 'Cancel' : '+ Add Custom Vendor'}
        </button>
      </div>

      {/* Add Vendor Form */}
      {showAddForm && (
        <div className="bg-white p-6 rounded-lg shadow-md mb-6">
          <h2 className="text-xl font-semibold mb-4">Add New Custom Vendor</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Vendor Name *
              </label>
              <input
                type="text"
                value={newVendor.vendor_name || ''}
                onChange={(e) => setNewVendor({...newVendor, vendor_name: e.target.value})}
                className="w-full p-2 border border-gray-300 rounded-md"
                placeholder="e.g., Custom Dropship Supplier"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Vendor Type *
              </label>
              <select
                value={newVendor.vendor_type}
                onChange={(e) => setNewVendor({...newVendor, vendor_type: e.target.value as any})}
                className="w-full p-2 border border-gray-300 rounded-md"
              >
                <option value="api">API Integration</option>
                <option value="webhook">Webhook</option>
                <option value="ftp">FTP/SFTP</option>
                <option value="email">Email Orders</option>
                <option value="manual">Manual Processing</option>
              </select>
            </div>

            {(newVendor.vendor_type === 'api' || newVendor.vendor_type === 'webhook') && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    API Endpoint
                  </label>
                  <input
                    type="url"
                    value={newVendor.api_endpoint || ''}
                    onChange={(e) => setNewVendor({...newVendor, api_endpoint: e.target.value})}
                    className="w-full p-2 border border-gray-300 rounded-md"
                    placeholder="https://api.vendor.com/v1"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Authentication Method
                  </label>
                  <select
                    value={newVendor.authentication_method}
                    onChange={(e) => setNewVendor({...newVendor, authentication_method: e.target.value as any})}
                    className="w-full p-2 border border-gray-300 rounded-md"
                  >
                    <option value="api_key">API Key</option>
                    <option value="oauth">OAuth</option>
                    <option value="basic_auth">Basic Auth</option>
                    <option value="bearer_token">Bearer Token</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    API Key
                  </label>
                  <input
                    type="password"
                    value={newVendor.api_key || ''}
                    onChange={(e) => setNewVendor({...newVendor, api_key: e.target.value})}
                    className="w-full p-2 border border-gray-300 rounded-md"
                    placeholder="Enter API key"
                  />
                </div>
              </>
            )}

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Supported Features
              </label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {Object.entries(newVendor.supported_features || {}).map(([feature, enabled]) => (
                  <label key={feature} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={enabled}
                      onChange={(e) => setNewVendor({
                        ...newVendor,
                        supported_features: {
                          ...newVendor.supported_features,
                          [feature]: e.target.checked
                        }
                      })}
                      className="mr-2"
                    />
                    {feature.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end mt-4">
            <button
              onClick={handleAddVendor}
              className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg"
            >
              Add Vendor
            </button>
          </div>
        </div>
      )}

      {/* Vendors List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {vendors.map((vendor) => (
          <div key={vendor.id} className="bg-white p-6 rounded-lg shadow-md">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{vendor.vendor_name}</h3>
                <span className={`inline-block px-2 py-1 text-xs rounded-full ${
                  vendor.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  {vendor.is_active ? 'Active' : 'Inactive'}
                </span>
                {vendor.test_mode && (
                  <span className="inline-block px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-800 ml-2">
                    Test Mode
                  </span>
                )}
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => handleTestConnection(vendor)}
                  className="text-blue-600 hover:text-blue-800 text-sm"
                >
                  Test
                </button>
                <button
                  onClick={() => {
                    setSelectedVendor(vendor);
                    loadVendorProducts(vendor.id);
                  }}
                  className="text-green-600 hover:text-green-800 text-sm"
                >
                  Manage
                </button>
              </div>
            </div>

            <div className="text-sm text-gray-600 mb-4">
              <p><strong>Type:</strong> {vendor.vendor_type}</p>
              {vendor.api_endpoint && <p><strong>Endpoint:</strong> {vendor.api_endpoint}</p>}
              <p><strong>Auth:</strong> {vendor.authentication_method}</p>
            </div>

            <div className="flex flex-wrap gap-1">
              {Object.entries(vendor.supported_features).map(([feature, enabled]) => (
                enabled && (
                  <span key={feature} className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                    {feature.replace('_', ' ')}
                  </span>
                )
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Test Results Modal */}
      {testResults && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Connection Test Results</h3>
            <div className={`p-4 rounded-lg mb-4 ${
              testResults.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
              <p><strong>Status:</strong> {testResults.success ? 'Success' : 'Failed'}</p>
              {testResults.message && <p><strong>Message:</strong> {testResults.message}</p>}
              {testResults.error && <p><strong>Error:</strong> {testResults.error}</p>}
            </div>
            <button
              onClick={() => setTestResults(null)}
              className="w-full bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Vendor Management Modal */}
      {selectedVendor && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold">Manage {selectedVendor.vendor_name}</h3>
              <button
                onClick={() => setSelectedVendor(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Product Mappings */}
              <div>
                <h4 className="text-lg font-medium mb-4">Product Mappings</h4>
                <div className="space-y-2">
                  {vendorProducts.map((vp) => (
                    <div key={vp.id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                      <div>
                        <p className="font-medium">{vp.vendor_product_name || vp.vendor_product_id}</p>
                        <p className="text-sm text-gray-600">SKU: {vp.vendor_sku}</p>
                      </div>
                      <span className={`px-2 py-1 text-xs rounded ${
                        vp.sync_status === 'success' ? 'bg-green-100 text-green-800' :
                        vp.sync_status === 'failed' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {vp.sync_status}
                      </span>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => handleSyncProducts(selectedVendor.id)}
                  className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm"
                >
                  Sync Products
                </button>
              </div>

              {/* API Logs */}
              <div>
                <h4 className="text-lg font-medium mb-4">Recent API Activity</h4>
                <div className="text-sm text-gray-600">
                  <p>API logs will appear here after the vendor processes orders.</p>
                  <p className="mt-2">Features to implement:</p>
                  <ul className="list-disc list-inside mt-2">
                    <li>View API request/response logs</li>
                    <li>Monitor success/failure rates</li>
                    <li>Debug failed requests</li>
                    <li>View rate limit usage</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomVendorManager;
