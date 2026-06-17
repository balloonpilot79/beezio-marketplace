import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContextMultiRole';
import RoleManagement from '../components/RoleManagement';
import { User, Settings, Shield, Bell, CreditCard, HelpCircle, Lock } from 'lucide-react';
import { supabase } from '../lib/supabase';

const UserProfilePage: React.FC = () => {
  const { user, profile } = useAuth();
  const [saleEmailNotifications, setSaleEmailNotifications] = useState(true);
  const [notificationSaving, setNotificationSaving] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');
  const [notificationError, setNotificationError] = useState('');

  useEffect(() => {
    const profileValue = (profile as any)?.sale_email_notifications;
    if (typeof profileValue === 'boolean') {
      setSaleEmailNotifications(profileValue);
      return;
    }

    const profileId = String((profile as any)?.id || '').trim();
    if (!profileId) return;

    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('sale_email_notifications')
        .eq('id', profileId)
        .maybeSingle();

      if (cancelled || error) return;
      const value = (data as any)?.sale_email_notifications;
      setSaleEmailNotifications(value !== false);
    })();

    return () => {
      cancelled = true;
    };
  }, [profile]);

  const updateSaleEmailNotifications = async (enabled: boolean) => {
    const profileId = String((profile as any)?.id || '').trim();
    if (!profileId) return;

    setSaleEmailNotifications(enabled);
    setNotificationSaving(true);
    setNotificationMessage('');
    setNotificationError('');

    const { error } = await supabase
      .from('profiles')
      .update({ sale_email_notifications: enabled } as any)
      .eq('id', profileId);

    setNotificationSaving(false);
    if (error) {
      setSaleEmailNotifications(!enabled);
      setNotificationError(error.message || 'Could not update notification preference.');
      return;
    }

    setNotificationMessage(enabled ? 'Sale email notifications are on.' : 'Sale email notifications are off.');
  };

  if (!user || !profile) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <User className="w-8 h-8 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
                <p className="text-sm text-gray-600">{profile.email}</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                {profile.primary_role || profile.role}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar Navigation */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <nav className="space-y-2">
                <a href="#roles" className="flex items-center space-x-3 px-3 py-2 text-blue-600 bg-blue-50 rounded-lg font-medium">
                  <Shield className="w-5 h-5" />
                  <span>Role Management</span>
                </a>
                <a href="#account" className="flex items-center space-x-3 px-3 py-2 text-gray-700 hover:bg-gray-50 rounded-lg">
                  <Settings className="w-5 h-5" />
                  <span>Account Settings</span>
                </a>
                <a href="#notifications" className="flex items-center space-x-3 px-3 py-2 text-gray-700 hover:bg-gray-50 rounded-lg">
                  <Bell className="w-5 h-5" />
                  <span>Notifications</span>
                </a>
                <a href="#billing" className="flex items-center space-x-3 px-3 py-2 text-gray-700 hover:bg-gray-50 rounded-lg">
                  <CreditCard className="w-5 h-5" />
                  <span>Billing</span>
                </a>
                <a href="#help" className="flex items-center space-x-3 px-3 py-2 text-gray-700 hover:bg-gray-50 rounded-lg">
                  <HelpCircle className="w-5 h-5" />
                  <span>Help & Support</span>
                </a>
                <a href="/change-password" className="flex items-center space-x-3 px-3 py-2 text-gray-700 hover:bg-gray-50 rounded-lg">
                  <Lock className="w-5 h-5" />
                  <span>Change Password</span>
                </a>
              </nav>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3 space-y-8">
            {/* Role Management Section */}
            <div id="roles" className="bg-white rounded-lg shadow-sm p-6">
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-2">Role Management</h2>
                <p className="text-gray-600">
                  Manage your roles in Beezio. You can be a seller, affiliate, or any combination to maximize your earning potential.
                </p>
              </div>
              <RoleManagement />
            </div>

            {/* Account Information Section */}
            <div id="account" className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Account Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
                  <p className="text-gray-900 bg-gray-50 px-3 py-2 rounded-lg">{profile.full_name || 'Not set'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                  <p className="text-gray-900 bg-gray-50 px-3 py-2 rounded-lg">{profile.email}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
                  <p className="text-gray-900 bg-gray-50 px-3 py-2 rounded-lg">{profile.phone || 'Not set'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
                  <p className="text-gray-900 bg-gray-50 px-3 py-2 rounded-lg">{profile.location || 'Not set'}</p>
                </div>
              </div>
              <div className="mt-6">
                <a
                  href="/change-password"
                  className="inline-flex items-center px-4 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50"
                >
                  <Lock className="w-4 h-4 mr-2" />
                  Change password
                </a>
              </div>
            </div>

            {/* Placeholder sections for future features */}
            <div id="notifications" className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Notification Preferences</h2>
              <div className="rounded-lg border border-gray-200 p-4">
                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={saleEmailNotifications}
                    disabled={notificationSaving}
                    onChange={(event) => void updateSaleEmailNotifications(event.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>
                    <span className="block font-medium text-gray-900">Email me when one of my products sells</span>
                    <span className="block text-sm text-gray-600">
                      Buyers still receive receipts. This only controls seller sale notification emails.
                    </span>
                  </span>
                </label>
                {notificationMessage && <p className="mt-3 text-sm text-green-700">{notificationMessage}</p>}
                {notificationError && <p className="mt-3 text-sm text-red-700">{notificationError}</p>}
              </div>
            </div>

            <div id="billing" className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Billing & Payments</h2>
              <p className="text-gray-600">Billing management will be available soon.</p>
            </div>

            <div id="help" className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Help & Support</h2>
              <p className="text-gray-600">Need help? Contact our support team or check our FAQ.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserProfilePage;
