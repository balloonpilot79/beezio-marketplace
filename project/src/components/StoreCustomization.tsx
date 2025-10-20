import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Save, Eye, Palette, Globe, Settings, Zap } from 'lucide-react';
import CustomDomainManager from './CustomDomainManager';
import UniversalIntegrationsPage from './UniversalIntegrationsPage';

interface StoreSettings {
  store_name?: string;
  store_description?: string;
  store_banner?: string;
  store_logo?: string;
  store_theme?: string;
  custom_domain?: string;
  social_links?: {
    [key: string]: string | undefined;
    facebook?: string;
    instagram?: string;
    twitter?: string;
    website?: string;
  };
  business_hours?: string;
  shipping_policy?: string;
  return_policy?: string;
}

const StoreCustomization: React.FC<{ userId: string; role: 'seller' | 'affiliate' }> = ({ userId, role }) => {
  const [storeSettings, setStoreSettings] = useState<StoreSettings>({
    store_theme: 'modern',
    social_links: {},
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('general');

  useEffect(() => {
    fetchStoreSettings();
  }, [userId, role]);

  const fetchStoreSettings = async () => {
    const table = role === 'seller' ? 'store_settings' : 'affiliate_store_settings';
    const { data } = await supabase
      .from(table)
      .select('*')
      .eq(`${role}_id`, userId)
      .single();

    if (data) {
      setStoreSettings(data);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    const table = role === 'seller' ? 'store_settings' : 'affiliate_store_settings';
    const { error } = await supabase
      .from(table)
      .upsert({
        [`${role}_id`]: userId,
        ...storeSettings,
        updated_at: new Date().toISOString(),
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

  const storeUrl = `${window.location.origin}/store/${userId}`;
  const themeOptions = ['modern', 'vibrant', 'minimalist', 'dark', 'classic', 'elegant'];

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
              href={`/store/${userId}`}
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
              { id: 'integrations', name: 'API Integrations', icon: Zap },
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

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Theme
                </label>
                <select
                  value={storeSettings.store_theme}
                  onChange={(e) => handleInputChange('store_theme', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                >
                  {themeOptions.map((theme) => (
                    <option key={theme} value={theme}>{theme.charAt(0).toUpperCase() + theme.slice(1)}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* API Integrations Tab */}
          {activeTab === 'integrations' && (
            <div className="space-y-6">
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-6 mb-6">
                <h3 className="text-xl font-bold text-gray-900 mb-2">🚀 Import Products from Other Platforms</h3>
                <p className="text-gray-700 mb-4">
                  Connect your existing stores and platforms to automatically import products. 
                  Save time by syncing inventory from Printify, Shopify, Etsy, and more!
                </p>
                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex items-center px-3 py-1 bg-white rounded-full text-sm font-medium text-gray-700 shadow-sm">
                    ✅ One-Click Import
                  </span>
                  <span className="inline-flex items-center px-3 py-1 bg-white rounded-full text-sm font-medium text-gray-700 shadow-sm">
                    ✅ Auto-Sync Products
                  </span>
                  <span className="inline-flex items-center px-3 py-1 bg-white rounded-full text-sm font-medium text-gray-700 shadow-sm">
                    ✅ Bulk Upload
                  </span>
                  <span className="inline-flex items-center px-3 py-1 bg-white rounded-full text-sm font-medium text-gray-700 shadow-sm">
                    ✅ 10+ Platforms
                  </span>
                </div>
              </div>
              
              <UniversalIntegrationsPage />
            </div>
          )}

          {/* Domain Tab */}
          {activeTab === 'domain' && (
            <CustomDomainManager 
              userId={userId} 
              role={role} 
              currentDomain={storeSettings.custom_domain}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default StoreCustomization;
