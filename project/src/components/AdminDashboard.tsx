import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import ChatSupportDashboard from './ChatSupportDashboard';

const AdminDashboard: React.FC = () => {
  const [apiKey, setApiKey] = useState('');
  const [apiKeyStatus, setApiKeyStatus] = useState<string | null>(null);
  const [quickEditUserId, setQuickEditUserId] = useState('');
  const [quickEditField, setQuickEditField] = useState('');
  const [quickEditValue, setQuickEditValue] = useState('');
  const [quickEditStatus, setQuickEditStatus] = useState<string | null>(null);

  // Save API key (example: store in a secure table)
  const handleSaveApiKey = async () => {
    // Replace with your secure storage logic
    const { error } = await supabase.from('admin_settings').upsert({ key: 'api_key', value: apiKey });
    if (error) {
      setApiKeyStatus('Failed to save API key.');
    } else {
      setApiKeyStatus('API key saved successfully!');
    }
  };

  // Quick edit user (example: update user field)
  const handleQuickEdit = async () => {
    if (!quickEditUserId || !quickEditField) return;
    const { error } = await supabase
      .from('profiles')
      .update({ [quickEditField]: quickEditValue })
      .eq('id', quickEditUserId);
    if (error) {
      setQuickEditStatus('Failed to update user.');
    } else {
      setQuickEditStatus('User updated successfully!');
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6 sm:p-10 space-y-12 bg-gradient-to-br from-yellow-50 via-orange-50 to-yellow-50 min-h-screen">
      <h1 className="text-4xl font-extrabold text-gray-900 mb-8 tracking-tight text-center drop-shadow-sm">Admin Dashboard</h1>
      {/* API Key Management */}
      <section className="bg-white/90 rounded-2xl shadow-xl p-8 mb-10 border border-gray-100">
        <h2 className="text-2xl font-bold mb-5 text-orange-700 flex items-center gap-2"><span>🔑</span>API Key Management</h2>
        <input
          type="text"
          value={apiKey}
          onChange={e => setApiKey(e.target.value)}
          placeholder="Enter API key..."
          className="w-full px-4 py-3 border border-gray-200 rounded-lg mb-3 text-lg focus:ring-2 focus:ring-orange-400 focus:border-orange-300 transition-all"
        />
        <button
          onClick={handleSaveApiKey}
          className="bg-gradient-to-r from-orange-500 to-amber-500 text-white px-6 py-3 rounded-lg font-semibold hover:from-orange-600 hover:to-amber-600 transition-all shadow-md"
        >
          Save API Key
        </button>
        {apiKeyStatus && <div className="mt-3 text-base text-gray-600">{apiKeyStatus}</div>}
      </section>
      {/* Quick User Edit */}
      <section className="bg-white/90 rounded-2xl shadow-xl p-8 mb-10 border border-gray-100">
        <h2 className="text-2xl font-bold mb-5 text-blue-700 flex items-center gap-2"><span>⚡</span>Quick User Edit</h2>
        <div className="flex flex-col gap-3 mb-3">
          <input
            type="text"
            value={quickEditUserId}
            onChange={e => setQuickEditUserId(e.target.value)}
            placeholder="User ID"
            className="px-4 py-3 border border-gray-200 rounded-lg text-lg focus:ring-2 focus:ring-blue-400 focus:border-blue-300 transition-all"
          />
          <input
            type="text"
            value={quickEditField}
            onChange={e => setQuickEditField(e.target.value)}
            placeholder="Field to edit (e.g. full_name, email)"
            className="px-4 py-3 border border-gray-200 rounded-lg text-lg focus:ring-2 focus:ring-blue-400 focus:border-blue-300 transition-all"
          />
          <input
            type="text"
            value={quickEditValue}
            onChange={e => setQuickEditValue(e.target.value)}
            placeholder="New value"
            className="px-4 py-3 border border-gray-200 rounded-lg text-lg focus:ring-2 focus:ring-blue-400 focus:border-blue-300 transition-all"
          />
        </div>
        <button
          onClick={handleQuickEdit}
          className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:from-blue-600 hover:to-blue-700 transition-all shadow-md"
        >
          Update User
        </button>
        {quickEditStatus && <div className="mt-3 text-base text-gray-600">{quickEditStatus}</div>}
      </section>
      {/* Add more admin tools as needed */}
      <section className="bg-white/90 rounded-2xl shadow-xl p-8 border border-gray-100">
        <h2 className="text-2xl font-bold mb-5 text-yellow-700 flex items-center gap-2"><span>🛠️</span>Other Admin Tools</h2>
        <div className="text-gray-500">[Add sales issue management, logs, etc. here]</div>
      </section>

      {/* Chat Support Dashboard */}
      <section className="mt-12">
        <h2 className="text-2xl font-bold mb-5 text-indigo-700 flex items-center gap-2"><span>💬</span>Chat Support Dashboard</h2>
        <div className="bg-white/90 rounded-2xl shadow p-6 border border-gray-100">
          <ChatSupportDashboard />
        </div>
      </section>
    </div>
  );
};

export default AdminDashboard;
