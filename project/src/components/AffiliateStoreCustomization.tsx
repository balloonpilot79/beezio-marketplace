import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Save, Eye, Palette, Settings, Heart } from 'lucide-react';

interface AffiliateStoreSettings {
  store_name?: string;
  store_description?: string;
  store_banner?: string;
  store_logo?: string;
  store_theme?: string;
  personal_message?: string;
  social_links?: {
    facebook?: string;
    instagram?: string;
    twitter?: string;
    youtube?: string;
    website?: string;
  };
  favorite_categories?: string[];
  commission_goal?: number;
  bio?: string;
}

const AffiliateStoreCustomization: React.FC<{ affiliateId: string }> = ({ affiliateId }) => {
  const [storeSettings, setStoreSettings] = useState<AffiliateStoreSettings>({
    store_theme: 'vibrant',
    social_links: {},
    favorite_categories: []
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('general');

  useEffect(() => {
    fetchAffiliateSettings();
  }, [affiliateId]);

  const fetchAffiliateSettings = async () => {
    // Try to get affiliate store settings
    const { data } = await supabase
      .from('affiliate_store_settings')
      .select('*')
      .eq('affiliate_id', affiliateId)
      .single();
    
    if (data) {
      setStoreSettings(data);
    }
    
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('affiliate_store_settings')
        .upsert({
          affiliate_id: affiliateId,
          ...storeSettings,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;
      alert('Settings saved successfully!');
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Error saving settings. Please try again.');
    }
    setSaving(false);
  };

  const handleInputChange = (field: string, value: any) => {
    setStoreSettings(prev => ({ ...prev, [field]: value }));
  };

  const handleSocialLinkChange = (platform: string, url: string) => {
    setStoreSettings(prev => ({
      ...prev,
      social_links: { ...prev.social_links, [platform]: url }
    }));
  };

  const handleCategoryToggle = (category: string) => {
    setStoreSettings(prev => ({
      ...prev,
      favorite_categories: prev.favorite_categories?.includes(category)
        ? prev.favorite_categories.filter(c => c !== category)
        : [...(prev.favorite_categories || []), category]
    }));
  };

  if (loading) {
    return <div className="flex items-center justify-center p-8">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
    </div>;
  }

  const storeUrl = `${window.location.origin}/affiliate/${affiliateId}`;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl p-8 text-white">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-3xl font-extrabold mb-2 tracking-tight">Affiliate Store Customization</h2>
            <p className="text-lg text-purple-100">Personalize your affiliate store to attract more customers</p>
          </div>
          <div className="flex items-center gap-4">
            <a
              href={storeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-5 py-3 border border-purple-200 rounded-xl bg-white/20 hover:bg-white/30 text-white font-semibold shadow transition-all"
            >
              <Eye className="w-5 h-5" />
              <span>Preview Store</span>
            </a>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-3 bg-white text-purple-600 rounded-xl font-bold hover:bg-purple-50 transition-all shadow disabled:opacity-60"
            >
              <Save className="w-5 h-5" />
              <span>{saving ? 'Saving...' : 'Save Changes'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100">
        <div className="border-b">
          <nav className="flex gap-8 px-8">
            {[
              { id: 'general', name: 'General', icon: Settings },
              { id: 'appearance', name: 'Appearance', icon: Palette },
              { id: 'categories', name: 'Categories', icon: Heart }
            ].map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 py-5 border-b-4 font-bold text-base transition-all ${
                    activeTab === tab.id
                      ? 'border-purple-500 text-purple-700 bg-purple-50'
                      : 'border-transparent text-gray-500 hover:text-purple-700 hover:bg-purple-50'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{tab.name}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-8">
          {/* General Tab */}
          {activeTab === 'general' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Store Name
                  </label>
                  <input
                    type="text"
                    value={storeSettings.store_name || ''}
                    onChange={(e) => handleInputChange('store_name', e.target.value)}
                    placeholder="Your Affiliate Store Name"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Monthly Commission Goal
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-gray-500">$</span>
                    <input
                      type="number"
                      value={storeSettings.commission_goal || ''}
                      onChange={(e) => handleInputChange('commission_goal', parseFloat(e.target.value) || 0)}
                      placeholder="1000"
                      className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Store Description
                </label>
                <textarea
                  value={storeSettings.store_description || ''}
                  onChange={(e) => handleInputChange('store_description', e.target.value)}
                  placeholder="Tell customers about your affiliate store and why they should shop with you..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Personal Message
                </label>
                <textarea
                  value={storeSettings.personal_message || ''}
                  onChange={(e) => handleInputChange('personal_message', e.target.value)}
                  placeholder="Add a personal message to connect with your customers..."
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Bio/About You
                </label>
                <textarea
                  value={storeSettings.bio || ''}
                  onChange={(e) => handleInputChange('bio', e.target.value)}
                  placeholder="Tell your story - why do you love these products?"
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              {/* Social Links */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-4">
                  Social Media Links
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { key: 'facebook', label: 'Facebook', placeholder: 'https://facebook.com/yourprofile' },
                    { key: 'instagram', label: 'Instagram', placeholder: 'https://instagram.com/yourprofile' },
                    { key: 'twitter', label: 'Twitter', placeholder: 'https://twitter.com/yourprofile' },
                    { key: 'youtube', label: 'YouTube', placeholder: 'https://youtube.com/yourchannel' },
                    { key: 'website', label: 'Website', placeholder: 'https://yourwebsite.com' }
                  ].map(social => (
                    <div key={social.key}>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        {social.label}
                      </label>
                      <input
                        type="url"
                        value={storeSettings.social_links?.[social.key as keyof typeof storeSettings.social_links] || ''}
                        onChange={(e) => handleSocialLinkChange(social.key, e.target.value)}
                        placeholder={social.placeholder}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
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
                  Store Theme
                </label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {[
                    { id: 'vibrant', name: 'Vibrant', color: 'bg-gradient-to-r from-pink-500 to-purple-500' },
                    { id: 'energetic', name: 'Energetic', color: 'bg-gradient-to-r from-orange-500 to-red-500' },
                    { id: 'nature', name: 'Nature', color: 'bg-gradient-to-r from-green-400 to-blue-500' },
                    { id: 'elegant', name: 'Elegant', color: 'bg-gradient-to-r from-purple-600 to-blue-600' },
                    { id: 'minimal', name: 'Minimal', color: 'bg-gradient-to-r from-gray-400 to-gray-600' },
                    { id: 'sunset', name: 'Sunset', color: 'bg-gradient-to-r from-yellow-400 to-pink-500' }
                  ].map(theme => (
                    <button
                      key={theme.id}
                      onClick={() => handleInputChange('store_theme', theme.id)}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        storeSettings.store_theme === theme.id
                          ? 'border-purple-500 shadow-md ring-2 ring-purple-200'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className={`w-full h-8 ${theme.color} rounded mb-2`}></div>
                      <div className="text-sm font-medium">{theme.name}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Store Banner Image
                  </label>
                  <input
                    type="url"
                    value={storeSettings.store_banner || ''}
                    onChange={(e) => handleInputChange('store_banner', e.target.value)}
                    placeholder="https://example.com/banner.jpg"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Profile Picture
                  </label>
                  <input
                    type="url"
                    value={storeSettings.store_logo || ''}
                    onChange={(e) => handleInputChange('store_logo', e.target.value)}
                    placeholder="https://example.com/profile.jpg"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Categories Tab */}
          {activeTab === 'categories' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-4">
                  <Heart className="w-4 h-4 inline mr-2" />
                  Favorite Product Categories
                </label>
                <p className="text-gray-600 mb-4">Select categories you're passionate about. These will be highlighted in your store.</p>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {[
                    'Electronics', 'Fashion', 'Home & Garden', 'Health & Beauty',
                    'Sports & Fitness', 'Books & Media', 'Food & Beverages', 'Toys & Games',
                    'Pet Supplies', 'Automotive', 'Art & Crafts', 'Music & Instruments',
                    'Travel & Experiences', 'Business & Industrial', 'Baby & Kids', 'Jewelry'
                  ].map(category => (
                    <button
                      key={category}
                      onClick={() => handleCategoryToggle(category)}
                      className={`p-3 rounded-lg border-2 text-sm font-medium transition-all ${
                        storeSettings.favorite_categories?.includes(category)
                          ? 'border-purple-500 bg-purple-50 text-purple-700'
                          : 'border-gray-200 text-gray-700 hover:border-purple-300 hover:bg-purple-50'
                      }`}
                    >
                      {storeSettings.favorite_categories?.includes(category) && (
                        <Heart className="w-4 h-4 inline mr-1 fill-current" />
                      )}
                      {category}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AffiliateStoreCustomization;
