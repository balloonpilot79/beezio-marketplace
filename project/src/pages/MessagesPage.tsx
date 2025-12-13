import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContextMultiRole';

type ContactMessage = {
  id: string;
  owner_id: string;
  owner_type: 'seller' | 'affiliate' | 'fundraiser';
  name: string;
  email: string;
  message: string;
  store_name?: string;
  page_url?: string;
  status?: 'new' | 'read';
  created_at: string;
};

const MessagesPage: React.FC = () => {
  const { profile, user } = useAuth();
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const ownerId = profile?.id || user?.id || '';

  const loadMessages = async () => {
    if (!ownerId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: dbError } = await supabase
        .from('contact_messages')
        .select('*')
        .eq('owner_id', ownerId)
        .order('created_at', { ascending: false });

      if (dbError) throw dbError;
      setMessages(data || []);
    } catch (e: any) {
      console.error('loadMessages error', e);
      setError('Unable to load messages. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMessages();
  }, [ownerId]);

  const markRead = async (id: string) => {
    const optimistic = messages.map(m => (m.id === id ? { ...m, status: 'read' } : m));
    setMessages(optimistic);
    try {
      const { error: dbError } = await supabase
        .from('contact_messages')
        .update({ status: 'read' })
        .eq('id', id);
      if (dbError) throw dbError;
    } catch (e) {
      console.error('markRead error', e);
      loadMessages();
    }
  };

  if (!ownerId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="bg-white p-8 rounded-xl shadow text-center max-w-md w-full">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Sign in to view messages</h1>
          <p className="text-gray-600">You need an account to view and reply to store messages.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold text-gray-900">Inbox</h1>
          <p className="text-gray-600">Messages sent from your store contact forms stay on Beezio. No external email needed.</p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {loading ? (
          <div className="text-center py-12">Loading messages...</div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-lg">{error}</div>
        ) : messages.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl shadow-sm border border-gray-100">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">No messages yet</h2>
            <p className="text-gray-600">When buyers use your Contact button, messages will appear here.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg) => (
              <div key={msg.id} className="bg-white border border-gray-200 rounded-xl shadow-sm p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">{msg.name}</span>
                      {msg.status !== 'read' && (
                        <span className="px-2 py-1 text-xs rounded-full bg-amber-100 text-amber-800">New</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500">
                      {new Date(msg.created_at).toLocaleString()} • {msg.owner_type}
                      {msg.store_name ? ` • ${msg.store_name}` : ''}
                    </div>
                    <div className="mt-1 text-xs text-gray-600">
                      Reply email stored privately.
                      {msg.email && (
                        <button
                          onClick={() => navigator.clipboard.writeText(msg.email)}
                          className="ml-2 text-amber-600 hover:text-amber-700 underline"
                        >
                          Copy reply email
                        </button>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => markRead(msg.id)}
                    className="text-sm text-amber-600 hover:text-amber-700"
                  >
                    Mark read
                  </button>
                </div>
                <div className="mt-3 text-gray-800 whitespace-pre-line">{msg.message}</div>
                {msg.page_url && (
                  <div className="mt-2 text-xs text-gray-500">Sent from: {msg.page_url}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MessagesPage;
