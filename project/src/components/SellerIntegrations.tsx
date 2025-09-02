import React, { useState } from 'react';


const apiOptions = [
  { name: 'Printify', keyName: 'printifyApiKey', docs: 'https://developers.printify.com/' },
  { name: 'Shopify', keyName: 'shopifyApiKey', docs: 'https://shopify.dev/docs/api' },
  { name: 'Etsy', keyName: 'etsyApiKey', docs: 'https://developers.etsy.com/' },
  // Add more APIs as needed
];

const SellerIntegrations: React.FC = () => {
  const [apiKeys, setApiKeys] = useState<{ [key: string]: string }>({});
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>, keyName: string) => {
    setApiKeys({ ...apiKeys, [keyName]: e.target.value });
  };

  const handleSave = async () => {
    setSaving(true);
    setSuccess(null);
    setError(null);
    try {
      // Placeholder: Save API keys to your backend or Supabase
      // await supabase.from('seller_integrations').upsert({ seller_id: sellerId, ...apiKeys });
      setSuccess('API keys saved!');
    } catch (err) {
      setError('Failed to save API keys.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mt-8">
      <h2 className="text-xl font-bold text-gray-900 mb-4">Store Integrations</h2>
      <div className="space-y-4">
        {apiOptions.map(api => (
          <div key={api.keyName} className="flex flex-col md:flex-row md:items-center md:space-x-4">
            <label className="font-medium text-gray-700 md:w-32">{api.name} API Key</label>
            <input
              type="text"
              value={apiKeys[api.keyName] || ''}
              onChange={e => handleChange(e, api.keyName)}
              className="w-full md:w-2/3 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
              placeholder={`Enter your ${api.name} API key`}
            />
            <a href={api.docs} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 ml-2 hover:underline">Docs</a>
          </div>
        ))}
      </div>
      <button
        onClick={handleSave}
        disabled={saving}
        className="mt-6 w-full bg-amber-500 text-white py-2 px-4 rounded-lg hover:bg-amber-600 transition-colors font-medium"
      >
        {saving ? 'Saving...' : 'Save Integrations'}
      </button>
      {success && <div className="mt-2 text-green-600 text-sm">{success}</div>}
      {error && <div className="mt-2 text-red-600 text-sm">{error}</div>}
    </div>
  );
};

export default SellerIntegrations;
