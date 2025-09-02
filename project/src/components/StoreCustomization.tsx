import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Save, Upload, Eye, Palette, Globe, Settings } from 'lucide-react';

interface StoreSettings {
  store_name?: string;
  store_description?: string;
  store_banner?: string;
  store_logo?: string;
  store_theme?: string;
  custom_domain?: string;
  social_links?: {
    facebook?: string;
    instagram?: string;
    twitter?: string;
    website?: string;
  };
  business_hours?: string;
  shipping_policy?: string;
  return_policy?: string;
}

const StoreCustomization: React.FC<{ sellerId: string }> = ({ sellerId }) => {
  const [storeSettings, setStoreSettings] = useState<StoreSettings>({
    store_theme: 'modern',
    social_links: {}
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('general');

  useEffect(() => {
    fetchStoreSettings();
  }, [sellerId]);

  const fetchStoreSettings = async () => {
    const { data } = await supabase
      .from('store_settings')
      .select('*')
      .eq('seller_id', sellerId)
      .single();
    
    if (data) {
      setStoreSettings(data);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from('store_settings')
      .upsert({
        seller_id: sellerId,
        ...storeSettings,
        updated_at: new Date().toISOString()
      });

    if (error) {
      alert('Failed to save store settings');
    } else {
      alert('Store settings saved successfully!');
    }
    setSaving(false);
  };

  const handleInputChange = (field: string, value: any) => {
    setStoreSettings(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSocialLinkChange = (platform: string, value: string) => {
    setStoreSettings(prev => ({
      ...prev,
      social_links: {
        ...prev.social_links,
        [platform]: value
      }
    }));
  };

  const storeUrl = `${window.location.origin}/store/${sellerId}`;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-10 px-2 sm:px-4">
      {/* Header */}
      <div className="bg-gradient-to-r from-yellow-50 via-orange-50 to-purple-50 rounded-2xl shadow-xl border border-gray-100 mb-8 p-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <h2 className="text-3xl font-extrabold text-gray-900 mb-2 tracking-tight">Store Customization</h2>
            <p className="text-lg text-gray-600">Customize your store appearance and settings</p>
          </div>
          <div className="flex items-center gap-4">
            <a
              href={storeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-5 py-3 border border-orange-200 rounded-xl bg-white/80 hover:bg-orange-50 text-orange-700 font-semibold shadow transition-all"
            >
              <Eye className="w-5 h-5" />
              <span>Preview Store</span>
            </a>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-bold hover:from-orange-600 hover:to-amber-600 transition-all shadow disabled:opacity-60"
            >
              <Save className="w-5 h-5" />
              <span>{saving ? 'Saving...' : 'Save Changes'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white/90 rounded-2xl shadow-xl border border-gray-100">
        <div className="border-b">
          <nav className="flex gap-8 px-8">
            {[
              { id: 'general', name: 'General', icon: Settings },
              { id: 'appearance', name: 'Appearance', icon: Palette },
              { id: 'domain', name: 'Domain', icon: Globe }
            ].map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 py-5 border-b-4 font-bold text-base transition-all ${
                    activeTab === tab.id
                      ? 'border-orange-500 text-orange-700 bg-orange-50'
                      : 'border-transparent text-gray-500 hover:text-orange-700 hover:bg-orange-50'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{tab.name}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-8">
          {/* General Tab */}
          {activeTab === 'general' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Store Name
                </label>
                <input
                  type="text"
                  value={storeSettings.store_name || ''}
                  onChange={(e) => handleInputChange('store_name', e.target.value)}
                  placeholder="Enter your store name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Store Description
                </label>
                <textarea
                  value={storeSettings.store_description || ''}
                  onChange={(e) => handleInputChange('store_description', e.target.value)}
                  placeholder="Describe your store and what you sell"
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Business Hours
                </label>
                <input
                  type="text"
                  value={storeSettings.business_hours || ''}
                  onChange={(e) => handleInputChange('business_hours', e.target.value)}
                  placeholder="e.g., Mon-Fri 9AM-5PM, Sat 10AM-2PM"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Shipping Policy
                  </label>
                  <textarea
                    value={storeSettings.shipping_policy || ''}
                    onChange={(e) => handleInputChange('shipping_policy', e.target.value)}
                    placeholder="Describe your shipping policy"
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Return Policy
                  </label>
                  <textarea
                    value={storeSettings.return_policy || ''}
                    onChange={(e) => handleInputChange('return_policy', e.target.value)}
                    placeholder="Describe your return policy"
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Social Links */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-4">
                  Social Media Links
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { key: 'facebook', label: 'Facebook', placeholder: 'https://facebook.com/yourstore' },
                    { key: 'instagram', label: 'Instagram', placeholder: 'https://instagram.com/yourstore' },
                    { key: 'twitter', label: 'Twitter', placeholder: 'https://twitter.com/yourstore' },
                    { key: 'website', label: 'Website', placeholder: 'https://yourwebsite.com' }
                  ].map(social => (
                    <div key={social.key}>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        {social.label}
                      </label>
                      <input
                        type="url"
                        value={storeSettings.social_links?.[social.key] || ''}
                        onChange={(e) => handleSocialLinkChange(social.key, e.target.value)}
                        placeholder={social.placeholder}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent text-sm"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Appearance Tab */}
          {activeTab === 'appearance' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Store Banner Image URL
                </label>
                <input
                  type="url"
                  value={storeSettings.store_banner || ''}
                  onChange={(e) => handleInputChange('store_banner', e.target.value)}
                  placeholder="https://example.com/banner-image.jpg"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                />
                {storeSettings.store_banner && (
                  <div className="mt-2">
                    <img
                      src={storeSettings.store_banner}
                      alt="Store banner preview"
                      className="h-32 w-full object-cover rounded-lg"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Store Logo URL
                </label>
                <input
                  type="url"
                  value={storeSettings.store_logo || ''}
                  onChange={(e) => handleInputChange('store_logo', e.target.value)}
                  placeholder="https://example.com/logo.png"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                />
                {storeSettings.store_logo && (
                  <div className="mt-2">
                    <img
                      src={storeSettings.store_logo}
                      alt="Store logo preview"
                      className="h-16 w-16 object-contain rounded-lg border"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Store Theme
                </label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {[
                    { id: 'modern', name: 'Modern', color: 'bg-blue-500' },
                    { id: 'classic', name: 'Classic', color: 'bg-gray-700' },
                    { id: 'vibrant', name: 'Vibrant', color: 'bg-pink-500' },
                    { id: 'nature', name: 'Nature', color: 'bg-green-500' },
                    { id: 'elegant', name: 'Elegant', color: 'bg-purple-500' },
                    { id: 'minimal', name: 'Minimal', color: 'bg-gray-300' }
                  ].map(theme => (
                    <button
                      key={theme.id}
                      onClick={() => handleInputChange('store_theme', theme.id)}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        storeSettings.store_theme === theme.id
                          ? 'border-amber-500 shadow-md'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className={`w-full h-8 ${theme.color} rounded mb-2`}></div>
                      <div className="text-sm font-medium">{theme.name}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Domain Tab */}
          {activeTab === 'domain' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Custom Domain
                </label>
                <input
                  type="text"
                  value={storeSettings.custom_domain || ''}
                  onChange={(e) => handleInputChange('custom_domain', e.target.value)}
                  placeholder="yourdomain.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Connect your own domain for a professional look. Contact support for setup assistance.
                </p>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-semibold text-gray-900 mb-2">Current Store URL</h4>
                <div className="flex items-center space-x-2">
                  <code className="bg-white px-3 py-2 rounded border text-sm flex-1">
                    {storeUrl}
                  </code>
                  <button
                    onClick={() => navigator.clipboard.writeText(storeUrl)}
                    className="px-3 py-2 text-sm border border-gray-300 rounded hover:bg-white transition-colors"
                  >
                    Copy
                  </button>
                </div>
              </div>

              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-semibold text-blue-900 mb-2">Domain Setup Instructions</h4>
                <ol className="text-sm text-blue-800 space-y-1">
                  <li>1. Purchase your domain from any domain registrar</li>
                  <li>2. Add your domain in the field above</li>
                  <li>3. Contact our support team for DNS configuration</li>
                  <li>4. We'll help you set up SSL certificates and redirects</li>
                </ol>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StoreCustomization;
