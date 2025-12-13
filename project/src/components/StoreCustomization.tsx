import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import {
  Save,
  Eye,
  Palette,
  Globe,
  Settings,
  Zap,
  FileText,
  ArrowUpDown,
  LayoutTemplate,
  Wand2,
  PackagePlus
} from 'lucide-react';
import CustomDomainManager from './CustomDomainManager';
import UniversalIntegrationsPage from './UniversalIntegrationsPage';
import ImageUploader from './ImageUploader';
import CustomPageBuilder from './CustomPageBuilder';
import ProductOrderManager from './ProductOrderManager';
import ProductBrowserForSellers from './ProductBrowserForSellers';
import StoreTemplateSelector, { type StoreTemplate } from './StoreTemplateSelector';
import StoreContactForm from './StoreContactForm';

interface StoreSettings {
  store_name?: string;
  store_description?: string;
  store_banner?: string;
  store_logo?: string;
  store_theme?: string;
  custom_domain?: string;
  subdomain?: string;
  template_id?: string;
  product_page_template?: string;
  layout_config?: {
    header_style?: string;
    product_grid?: string;
    sidebar?: boolean;
    footer_style?: string;
    grid_layout?: 'compact' | 'standard' | 'comfortable' | 'large';
  };
  color_scheme?: {
    primary?: string;
    secondary?: string;
    accent?: string;
    background?: string;
    text?: string;
  };
  custom_css?: string;
  custom_html_header?: string;
  custom_html_footer?: string;
  contact_page_enabled?: boolean;
  contact_email?: string;
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
    layout_config: {
      grid_layout: 'standard'
    },
    color_scheme: {
      primary: '#f59e0b',
      secondary: '#3b82f6',
      accent: '#ef4444',
      background: '#ffffff',
      text: '#1f2937'
    }
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('general');
  const [activeTemplate, setActiveTemplate] = useState<string>('modern');

  // Simple profanity/abuse blocklist to prevent adult or harmful content
  const bannedWords = [
    'porn','xxx','sex','nude','nsfw','escort','casino','bet','gambling',
    'hate','terror','abuse','violence','extremism','weapon','gun','knife'
  ];

  const templates = [
    { id: 'modern', name: 'Modern Grid', desc: 'Hero banner, featured carousel, grid cards', theme: 'modern' },
    { id: 'boutique', name: 'Boutique', desc: 'Large imagery, two-column story + featured products', theme: 'elegant' },
    { id: 'catalog', name: 'Catalog', desc: 'Category sidebar, clean list for fast browsing', theme: 'minimalist' },
    { id: 'launch', name: 'Launch One-Pager', desc: 'Single-page with hero, highlights, FAQ, CTA', theme: 'vibrant' },
  ];

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

  const validateContent = () => {
    const textFields = [
      storeSettings.store_name,
      storeSettings.store_description,
      storeSettings.business_hours,
      storeSettings.shipping_policy,
      storeSettings.return_policy,
    ].filter(Boolean) as string[];

    const joined = textFields.join(' ').toLowerCase();
    const found = bannedWords.find(w => joined.includes(w));
    if (found) {
      alert(`Please remove disallowed content (“${found}”) before saving.`);
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!validateContent()) return;

    setSaving(true);
    const table = role === 'seller' ? 'store_settings' : 'affiliate_store_settings';
    const { error } = await supabase
      .from(table)
      .upsert({
        [`${role}_id`]: userId,
        ...storeSettings,
        store_theme: storeSettings.store_theme || activeTemplate,
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

  const handleLayoutChange = (field: string, value: any) => {
    setStoreSettings(prev => ({
      ...prev,
      layout_config: {
        ...prev.layout_config,
        [field]: value
      }
    }));
  };

  const handleColorSchemeChange = (field: string, value: string) => {
    setStoreSettings(prev => ({
      ...prev,
      color_scheme: {
        ...prev.color_scheme,
        [field]: value
      }
    }));
  };

  const themeOptions = ['modern', 'vibrant', 'minimalist', 'dark', 'classic', 'elegant'];

  const tabItems = [
    { id: 'general', name: 'General', icon: Settings },
    { id: 'appearance', name: 'Appearance', icon: Palette },
    { id: 'templates', name: 'Templates', icon: LayoutTemplate },
    { id: 'custom-pages', name: 'Custom Pages', icon: FileText },
    { id: 'product-order', name: 'Product Order', icon: ArrowUpDown },
    { id: 'integrations', name: 'API Integrations', icon: Zap },
    { id: 'domain', name: 'Domain', icon: Globe }
  ];

  if (role === 'seller') {
    tabItems.splice(4, 0, { id: 'product-library', name: 'Product Library', icon: PackagePlus });
  }

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
            <div className="mt-3 text-sm text-gray-700 space-y-1 bg-white/60 border border-amber-100 rounded-xl p-3">
              <div className="font-semibold text-gray-900">Quick start</div>
              <div>1) Set your name/logo/banner on General.</div>
              <div>2) Add a Contact page and info pages under Pages (buyers stay in Beezio checkout).</div>
              <div>3) Connect a custom domain if you have one.</div>
              <div>4) Share your store link after previewing.</div>
              <div>5) Check your store inbox at <a className="text-amber-700 underline" href="/messages">/messages</a>.</div>
            </div>
            <div className="mt-3 text-sm text-gray-700 space-y-1">
              <div className="flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
                <span>
                  Public URL: <strong>{storeSettings.custom_domain || storeSettings.subdomain || userId}</strong> (try <code className="bg-white px-1 rounded">{storeSettings.custom_domain || `beezio.co/store/${storeSettings.subdomain || userId}`}</code>)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-orange-500" />
                <span>Use templates + Custom Pages to drag/drop banners, feature strips, and info pages.</span>
              </div>
            </div>
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
            {tabItems.map(tab => {
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
              <ImageUploader
                label="Store Banner"
                currentImageUrl={storeSettings.store_banner}
                onImageUpload={(url) => handleInputChange('store_banner', url)}
                bucketName="store-banners"
                folderPath="banners"
                aspectRatio="banner"
              />

              <ImageUploader
                label="Store Logo"
                currentImageUrl={storeSettings.store_logo}
                onImageUpload={(url) => handleInputChange('store_logo', url)}
                bucketName="store-banners"
                folderPath="logos"
                aspectRatio="logo"
              />

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

              {/* Grid Layout Options */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border-2 border-blue-200">
                <div className="flex items-center gap-3 mb-4">
                  <LayoutTemplate className="w-6 h-6 text-blue-600" />
                  <h3 className="text-xl font-bold text-gray-900">Product Grid Layout</h3>
                </div>
                <p className="text-gray-600 mb-4">Choose how your products are displayed on your store</p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { 
                      value: 'compact', 
                      label: 'Compact', 
                      desc: 'More products, smaller cards',
                      cols: '6 columns',
                      icon: '📱'
                    },
                    { 
                      value: 'standard', 
                      label: 'Standard', 
                      desc: 'Balanced view (recommended)',
                      cols: '4 columns',
                      icon: '💼'
                    },
                    { 
                      value: 'comfortable', 
                      label: 'Comfortable', 
                      desc: 'Spacious with details',
                      cols: '3 columns',
                      icon: '🛋️'
                    },
                    { 
                      value: 'large', 
                      label: 'Large', 
                      desc: 'Big cards, fewer per row',
                      cols: '2-3 columns',
                      icon: '🖼️'
                    }
                  ].map(layout => (
                    <button
                      key={layout.value}
                      onClick={() => handleLayoutChange('grid_layout', layout.value)}
                      className={`p-4 rounded-lg border-2 transition-all hover:shadow-lg ${
                        storeSettings.layout_config?.grid_layout === layout.value
                          ? 'border-blue-500 bg-blue-100 shadow-md'
                          : 'border-gray-300 bg-white hover:border-blue-300'
                      }`}
                    >
                      <div className="text-3xl mb-2">{layout.icon}</div>
                      <div className="font-bold text-gray-900">{layout.label}</div>
                      <div className="text-xs text-gray-600 mt-1">{layout.desc}</div>
                      <div className="text-xs text-blue-600 font-semibold mt-2">{layout.cols}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Color Scheme Options */}
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-6 border-2 border-purple-200">
                <div className="flex items-center gap-3 mb-4">
                  <Palette className="w-6 h-6 text-purple-600" />
                  <h3 className="text-xl font-bold text-gray-900">Color Scheme</h3>
                </div>
                <p className="text-gray-600 mb-6">Customize your store's color palette to match your brand</p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {[
                    { key: 'primary', label: 'Primary Color', desc: 'Main brand color (buttons, links)', default: '#f59e0b' },
                    { key: 'secondary', label: 'Secondary Color', desc: 'Supporting color (borders, accents)', default: '#3b82f6' },
                    { key: 'accent', label: 'Accent Color', desc: 'Highlights and badges', default: '#ef4444' },
                    { key: 'background', label: 'Background', desc: 'Main background color', default: '#ffffff' },
                    { key: 'text', label: 'Text Color', desc: 'Primary text color', default: '#1f2937' }
                  ].map(color => (
                    <div key={color.key} className="space-y-2">
                      <label className="block text-sm font-bold text-gray-800">
                        {color.label}
                      </label>
                      <p className="text-xs text-gray-600 mb-2">{color.desc}</p>
                      <div className="flex gap-3 items-center">
                        <input
                          type="color"
                          value={storeSettings.color_scheme?.[color.key as keyof typeof storeSettings.color_scheme] || color.default}
                          onChange={(e) => handleColorSchemeChange(color.key, e.target.value)}
                          className="w-16 h-12 rounded-lg border-2 border-gray-300 cursor-pointer"
                        />
                        <input
                          type="text"
                          value={storeSettings.color_scheme?.[color.key as keyof typeof storeSettings.color_scheme] || color.default}
                          onChange={(e) => handleColorSchemeChange(color.key, e.target.value)}
                          placeholder={color.default}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono text-sm"
                        />
                        <button
                          onClick={() => handleColorSchemeChange(color.key, color.default)}
                          className="px-3 py-2 text-xs bg-gray-200 hover:bg-gray-300 rounded-lg transition-colors"
                        >
                          Reset
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Color Preset Buttons */}
                <div className="mt-6 pt-6 border-t border-purple-200">
                  <label className="block text-sm font-bold text-gray-800 mb-3">
                    Quick Presets
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { name: 'Default', primary: '#f59e0b', secondary: '#3b82f6', accent: '#ef4444' },
                      { name: 'Ocean', primary: '#0ea5e9', secondary: '#06b6d4', accent: '#8b5cf6' },
                      { name: 'Forest', primary: '#10b981', secondary: '#059669', accent: '#f59e0b' },
                      { name: 'Sunset', primary: '#f97316', secondary: '#fb923c', accent: '#dc2626' },
                      { name: 'Royal', primary: '#8b5cf6', secondary: '#a78bfa', accent: '#ec4899' },
                      { name: 'Mono', primary: '#1f2937', secondary: '#6b7280', accent: '#374151' },
                      { name: 'Mint', primary: '#14b8a6', secondary: '#2dd4bf', accent: '#f43f5e' },
                      { name: 'Berry', primary: '#ec4899', secondary: '#f472b6', accent: '#8b5cf6' }
                    ].map(preset => (
                      <button
                        key={preset.name}
                        onClick={() => {
                          handleColorSchemeChange('primary', preset.primary);
                          handleColorSchemeChange('secondary', preset.secondary);
                          handleColorSchemeChange('accent', preset.accent);
                        }}
                        className="flex items-center gap-2 px-3 py-2 bg-white border-2 border-gray-300 rounded-lg hover:border-purple-400 hover:shadow transition-all"
                      >
                        <div className="flex gap-1">
                          <div className="w-4 h-4 rounded" style={{ backgroundColor: preset.primary }} />
                          <div className="w-4 h-4 rounded" style={{ backgroundColor: preset.secondary }} />
                          <div className="w-4 h-4 rounded" style={{ backgroundColor: preset.accent }} />
                        </div>
                        <span className="text-xs font-medium text-gray-700">{preset.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Templates Tab */}
          {activeTab === 'templates' && (
            <div className="space-y-6">
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-6 mb-6">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">🎨 Choose Your Store Template</h3>
                <p className="text-gray-700 mb-4">
                  Select from professionally designed templates for your storefront and product pages. 
                  Each template is fully customizable with your branding, colors, and content.
                </p>
                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex items-center px-3 py-1 bg-white rounded-full text-sm font-medium text-gray-700 shadow-sm">
                    ✅ 12+ Templates
                  </span>
                  <span className="inline-flex items-center px-3 py-1 bg-white rounded-full text-sm font-medium text-gray-700 shadow-sm">
                    ✅ Fully Responsive
                  </span>
                  <span className="inline-flex items-center px-3 py-1 bg-white rounded-full text-sm font-medium text-gray-700 shadow-sm">
                    ✅ Easy Customization
                  </span>
                  <span className="inline-flex items-center px-3 py-1 bg-white rounded-full text-sm font-medium text-gray-700 shadow-sm">
                    ✅ HTML/CSS Access
                  </span>
                </div>
              </div>

              <div className="mb-6">
                <h4 className="font-semibold text-gray-900 mb-3">Storefront Template</h4>
                <p className="text-sm text-gray-600 mb-4">
                  This controls the overall layout and design of your store homepage and product listings.
                </p>
                <StoreTemplateSelector
                  category="storefront"
                  currentTemplateId={storeSettings.template_id || activeTemplate}
                  onSelectTemplate={(template: StoreTemplate) => {
                    setActiveTemplate(template.id);
                    handleInputChange('template_id', template.id);
                    handleInputChange('store_theme', template.theme);
                    handleInputChange('layout_config', template.layout);
                  }}
                />
              </div>

              <div className="mb-6 border-t pt-6">
                <h4 className="font-semibold text-gray-900 mb-3">Product Page Template</h4>
                <p className="text-sm text-gray-600 mb-4">
                  Choose how individual product pages are displayed to your customers.
                </p>
                <StoreTemplateSelector
                  category="product"
                  currentTemplateId={storeSettings.product_page_template}
                  onSelectTemplate={(template: StoreTemplate) => {
                    handleInputChange('product_page_template', template.id);
                  }}
                />
              </div>

              <div className="flex items-center gap-3 text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-xl p-4">
                <Wand2 className="w-4 h-4 text-purple-500" />
                <span>
                  After selecting a template, use the <strong>Custom Pages</strong> tab to add HTML/CSS, 
                  create About/FAQ pages, and fully customize your store design.
                </span>
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

          {/* Custom Pages Tab */}
          {activeTab === 'custom-pages' && (
            <div className="space-y-6">
              <h3 className="text-xl font-bold text-gray-900 mb-2">Custom Pages & Drag-and-Drop Builder</h3>
              <p className="text-gray-600">
                Add About, FAQ, Contact, or promo pages. Drag and drop sections (hero banners, product strips, testimonials, text blocks). All pages use the shared Beezio checkout.
              </p>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="rounded-xl border border-gray-200 p-4 bg-white shadow-sm">
                  <h4 className="font-semibold text-gray-900 mb-2">Suggested sections</h4>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• Hero banner with CTA</li>
                    <li>• Featured products carousel</li>
                    <li>• About/mission block</li>
                    <li>• Testimonials or social proof</li>
                    <li>• FAQ + contact info</li>
                  </ul>
                </div>
                <div className="rounded-xl border border-gray-200 p-4 bg-white shadow-sm">
                  <h4 className="font-semibold text-gray-900 mb-2">Good to know</h4>
                  <p className="text-sm text-gray-600">
                    Custom pages inherit your store theme and checkout. Keep copy clean (no adult or abusive content). You can create multiple pages and link them in your store navigation.
                  </p>
                </div>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <CustomPageBuilder ownerType={role} />
              </div>
            </div>
          )}

          {/* Seller Marketplace Tab */}
          {activeTab === 'product-library' && role === 'seller' && (
            <div>
              <ProductBrowserForSellers sellerId={userId} />
            </div>
          )}

          {/* Product Order Tab */}
          {activeTab === 'product-order' && (
            <div>
              <ProductOrderManager sellerId={userId} />
            </div>
          )}

          {/* Domain Tab */}
          {activeTab === 'domain' && (
            <CustomDomainManager 
              userId={userId} 
              role={role} 
              currentDomain={storeSettings.custom_domain}
              subdomain={storeSettings.subdomain}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default StoreCustomization;
