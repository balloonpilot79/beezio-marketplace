import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Target, DollarSign, Calendar, Eye, Image as ImageIcon, Palette } from 'lucide-react';
import CustomDomainManager from './CustomDomainManager';
import ImageUploader from './ImageUploader';
import CustomPageBuilder from './CustomPageBuilder';
import { useAuth } from '../contexts/AuthContextMultiRole';

interface FundraiserStoreCustomizationProps {
  fundraiserId: string;
}

interface FundraiserSettings {
  store_name: string;
  store_description: string;
  logo_url: string;
  banner_url: string;
  custom_domain?: string;
  subdomain?: string;
  fundraiser_goal: number;
  current_raised: number;
  goal_description: string;
  goal_deadline: string;
  show_goal_on_store: boolean;
  primary_color: string;
  secondary_color: string;
  text_color: string;
  facebook_url: string;
  instagram_url: string;
  twitter_url: string;
}

const FundraiserStoreCustomization: React.FC<FundraiserStoreCustomizationProps> = ({ fundraiserId }) => {
  const { user } = useAuth();
  const [settings, setSettings] = useState<FundraiserSettings>({
    store_name: '',
    store_description: '',
    logo_url: '',
    banner_url: '',
    fundraiser_goal: 0,
    current_raised: 0,
    goal_description: '',
    goal_deadline: '',
    show_goal_on_store: true,
    primary_color: '#10b981',
    secondary_color: '#3b82f6',
    text_color: '#1f2937',
    facebook_url: '',
    instagram_url: '',
    twitter_url: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    loadSettings();
  }, [fundraiserId]);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('fundraiser_store_settings')
        .select('*')
        .eq('user_id', fundraiserId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setSettings({
          store_name: data.store_name || '',
          store_description: data.store_description || '',
          logo_url: data.logo_url || '',
          banner_url: data.banner_url || '',
          custom_domain: data.custom_domain,
          subdomain: data.subdomain,
          fundraiser_goal: data.fundraiser_goal || 0,
          current_raised: data.current_raised || 0,
          goal_description: data.goal_description || '',
          goal_deadline: data.goal_deadline ? new Date(data.goal_deadline).toISOString().split('T')[0] : '',
          show_goal_on_store: data.show_goal_on_store ?? true,
          primary_color: data.primary_color || '#10b981',
          secondary_color: data.secondary_color || '#3b82f6',
          text_color: data.text_color || '#1f2937',
          facebook_url: data.facebook_url || '',
          instagram_url: data.instagram_url || '',
          twitter_url: data.twitter_url || ''
        });
      }

      setLoading(false);
    } catch (error) {
      console.error('Error loading settings:', error);
      setMessage({ type: 'error', text: 'Failed to load settings' });
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setMessage({ type: '', text: '' });

      const { error } = await supabase
        .from('fundraiser_store_settings')
        .upsert({
          user_id: fundraiserId,
          store_name: settings.store_name,
          store_description: settings.store_description,
          logo_url: settings.logo_url,
          banner_url: settings.banner_url,
          fundraiser_goal: settings.fundraiser_goal,
          goal_description: settings.goal_description,
          goal_deadline: settings.goal_deadline ? new Date(settings.goal_deadline).toISOString() : null,
          show_goal_on_store: settings.show_goal_on_store,
          primary_color: settings.primary_color,
          secondary_color: settings.secondary_color,
          text_color: settings.text_color,
          facebook_url: settings.facebook_url,
          instagram_url: settings.instagram_url,
          twitter_url: settings.twitter_url
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;

      setMessage({ type: 'success', text: 'Settings saved successfully!' });
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    } catch (error) {
      console.error('Error saving settings:', error);
      setMessage({ type: 'error', text: 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
      </div>
    );
  }

  const goalPercentage = settings.fundraiser_goal > 0
    ? Math.min((settings.current_raised / settings.fundraiser_goal) * 100, 100)
    : 0;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
        <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
          <Target className="w-7 h-7 text-green-600" />
          Fundraiser Settings
        </h2>

        {message.text && (
          <div className={`p-4 rounded-lg mb-6 ${message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
            {message.text}
          </div>
        )}

        {/* Store Info */}
        <div className="space-y-4 mb-8">
          <h3 className="text-lg font-semibold text-gray-900">Basic Information</h3>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Store Name</label>
            <input
              type="text"
              value={settings.store_name}
              onChange={(e) => setSettings({ ...settings, store_name: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              placeholder="My Amazing Fundraiser"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
            <textarea
              value={settings.store_description}
              onChange={(e) => setSettings({ ...settings, store_description: e.target.value })}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              placeholder="Tell visitors about your fundraiser..."
            />
          </div>
        </div>

        {/* Branding */}
        <div className="space-y-4 mb-8">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-green-600" />
            Branding
          </h3>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Logo URL</label>
            <ImageUploader
              currentImageUrl={settings.logo_url}
              onImageUpload={(url: string) => setSettings({ ...settings, logo_url: url })}
              bucketName="profile-avatars"
              folderPath={`${user?.id || fundraiserId}/fundraiser/logo`}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Banner Image URL</label>
            <ImageUploader
              currentImageUrl={settings.banner_url}
              onImageUpload={(url: string) => setSettings({ ...settings, banner_url: url })}
              bucketName="store-banners"
              folderPath={`${user?.id || fundraiserId}/fundraiser/banner`}
            />
          </div>
        </div>

        {/* Goal Settings */}
        <div className="space-y-4 mb-8 p-4 bg-green-50 rounded-lg border border-green-200">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-green-600" />
            Fundraising Goal
          </h3>

          {/* Current Progress */}
          <div className="bg-white p-4 rounded-lg">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-gray-600">Current Progress</span>
              <span className="text-lg font-bold text-green-600">
                ${settings.current_raised.toLocaleString()} / ${settings.fundraiser_goal.toLocaleString()}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
              <div 
                className="bg-gradient-to-r from-green-500 to-blue-500 h-3 rounded-full transition-all duration-500"
                style={{ width: `${goalPercentage}%` }}
              />
            </div>
            <p className="text-xs text-gray-600 mt-1">{Math.round(goalPercentage)}% of goal reached</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Goal Amount ($)</label>
            <input
              type="number"
              value={settings.fundraiser_goal}
              onChange={(e) => setSettings({ ...settings, fundraiser_goal: parseFloat(e.target.value) || 0 })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              placeholder="5000"
              min="0"
              step="100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Goal Description</label>
            <textarea
              value={settings.goal_description}
              onChange={(e) => setSettings({ ...settings, goal_description: e.target.value })}
              rows={2}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              placeholder="What will the funds be used for?"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Goal Deadline (Optional)
            </label>
            <input
              type="date"
              value={settings.goal_deadline}
              onChange={(e) => setSettings({ ...settings, goal_deadline: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="show_goal"
              checked={settings.show_goal_on_store}
              onChange={(e) => setSettings({ ...settings, show_goal_on_store: e.target.checked })}
              className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
            />
            <label htmlFor="show_goal" className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <Eye className="w-4 h-4" />
              Show goal progress on store page
            </label>
          </div>
        </div>

        {/* Colors */}
        <div className="space-y-4 mb-8">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Palette className="w-5 h-5 text-green-600" />
            Colors
          </h3>
          
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Primary Color</label>
              <input
                type="color"
                value={settings.primary_color}
                onChange={(e) => setSettings({ ...settings, primary_color: e.target.value })}
                className="w-full h-10 rounded-lg border border-gray-300 cursor-pointer"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Secondary Color</label>
              <input
                type="color"
                value={settings.secondary_color}
                onChange={(e) => setSettings({ ...settings, secondary_color: e.target.value })}
                className="w-full h-10 rounded-lg border border-gray-300 cursor-pointer"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Text Color</label>
              <input
                type="color"
                value={settings.text_color}
                onChange={(e) => setSettings({ ...settings, text_color: e.target.value })}
                className="w-full h-10 rounded-lg border border-gray-300 cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Social Links */}
        <div className="space-y-4 mb-8">
          <h3 className="text-lg font-semibold text-gray-900">Social Media</h3>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Facebook URL</label>
            <input
              type="url"
              value={settings.facebook_url}
              onChange={(e) => setSettings({ ...settings, facebook_url: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              placeholder="https://facebook.com/..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Instagram URL</label>
            <input
              type="url"
              value={settings.instagram_url}
              onChange={(e) => setSettings({ ...settings, instagram_url: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              placeholder="https://instagram.com/..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Twitter URL</label>
            <input
              type="url"
              value={settings.twitter_url}
              onChange={(e) => setSettings({ ...settings, twitter_url: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              placeholder="https://twitter.com/..."
            />
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-400 font-medium"
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      {/* Custom Domain Section */}
      <CustomDomainManager
        userId={fundraiserId}
        role="seller"
        currentDomain={settings.custom_domain}
        subdomain={settings.subdomain}
        onUpdated={(next) => {
          setSettings((prev) => ({
            ...prev,
            ...(next.customDomain !== undefined ? { custom_domain: next.customDomain || '' } : {}),
            ...(next.subdomain !== undefined ? { subdomain: next.subdomain || '' } : {}),
          }));
        }}
      />

      <div className="mt-6 bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-xl font-bold text-gray-900 mb-2">Custom Pages</h3>
        <p className="text-sm text-gray-600 mb-4">
          Add pages like About, FAQ, Sponsors, or updates. Pages live at
          <span className="font-mono"> /fundraiser/&lt;your-username&gt;/&lt;page&gt;</span> and still use Beezio checkout for purchases.
        </p>
        <CustomPageBuilder ownerType="fundraiser" />
      </div>
    </div>
  );
};

export default FundraiserStoreCustomization;
