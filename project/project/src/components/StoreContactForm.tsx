import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContextMultiRole';

interface StoreContactFormProps {
  storeOwnerId: string;
  storeName: string;
  storeType: 'seller' | 'affiliate' | 'fundraiser';
}

const StoreContactForm: React.FC<StoreContactFormProps> = ({ storeOwnerId, storeName, storeType }) => {
  const { user } = useAuth();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState<'idle' | 'starting' | 'sending' | 'error'>('idle');
  const [resolvedOwnerUserId, setResolvedOwnerUserId] = useState<string>('');

  const loadMessages = async (id: string) => {
    const { data } = await supabase
      .from('store_messages')
      .select('id, conversation_id, sender_id, body, created_at')
      .eq('conversation_id', id)
      .order('created_at', { ascending: true });
    setMessages(Array.isArray(data) ? data : []);

    try {
      await supabase.functions.invoke('mark-store-conversation-read', { body: { conversationId: id } });
    } catch {
      // non-fatal
    }
  };

  useEffect(() => {
    if (!user?.id) return;
    if (!storeOwnerId) return;

    const resolveOwner = async () => {
      const raw = String(storeOwnerId || '').trim();
      if (!raw) {
        setResolvedOwnerUserId('');
        return;
      }
      const { data } = await supabase
        .from('profiles')
        .select('user_id')
        .or(`id.eq.${raw},user_id.eq.${raw}`)
        .maybeSingle();
      setResolvedOwnerUserId(String((data as any)?.user_id || raw));
    };

    void resolveOwner();
  }, [user?.id, storeOwnerId]);

  useEffect(() => {
    if (!user?.id) return;
    if (!resolvedOwnerUserId) return;
    if (resolvedOwnerUserId === user.id) return;

    const start = async () => {
      setStatus('starting');
      try {
        const { data, error } = await supabase.functions.invoke('start-store-conversation', {
          body: { ownerId: resolvedOwnerUserId, ownerType: storeType, storeName },
        });
        if (error) throw error;
        const id = String((data as any)?.conversation?.id || '');
        if (!id) throw new Error('Failed to start conversation');
        setConversationId(id);
        await loadMessages(id);
      } catch (e) {
        console.error(e);
        setStatus('error');
      } finally {
        setStatus('idle');
      }
    };

    start();
  }, [user?.id, resolvedOwnerUserId, storeType, storeName]);

  const send = async () => {
    if (!conversationId) return;
    const body = String(input || '').trim();
    if (!body) return;

    setStatus('sending');
    try {
      const { error } = await supabase.functions.invoke('send-store-message', {
        body: { conversationId, body },
      });
      if (error) throw error;
      setInput('');
      await loadMessages(conversationId);
    } catch (e) {
      console.error(e);
      setStatus('error');
    } finally {
      setStatus('idle');
    }
  };

  if (!user?.id) {
    return (
      <div className="p-6 bg-white border border-gray-200 rounded-xl">
        <h3 className="text-lg font-semibold text-gray-900">Message {storeName}</h3>
        <p className="text-sm text-gray-600 mt-1">Sign in to message this store. All messages stay inside Beezio.</p>
      </div>
    );
  }

  if (resolvedOwnerUserId === user.id) {
    return (
      <div className="p-6 bg-white border border-gray-200 rounded-xl">
        <h3 className="text-lg font-semibold text-gray-900">Inbox</h3>
        <p className="text-sm text-gray-600 mt-1">This is your store. Reply from your dashboard inbox.</p>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white border border-gray-200 rounded-xl">
      <h3 className="text-lg font-semibold text-gray-900">Message {storeName}</h3>
      <p className="text-sm text-gray-600 mt-1">All communication stays on-platform.</p>

      <div className="mt-4 border border-gray-200 rounded-xl p-3 h-72 overflow-y-auto bg-gray-50">
        {status === 'starting' ? (
          <div className="text-sm text-gray-600">Starting conversation...</div>
        ) : messages.length === 0 ? (
          <div className="text-sm text-gray-600">No messages yet.</div>
        ) : (
          <div className="space-y-2">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`max-w-[85%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap ${
                  m.sender_id === user.id ? 'ml-auto bg-gray-900 text-white' : 'bg-white text-gray-900 border border-gray-200'
                }`}
              >
                {m.body}
                <div className={`mt-1 text-[11px] ${m.sender_id === user.id ? 'text-gray-300' : 'text-gray-500'}`}>
                  {new Date(m.created_at).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-3 flex gap-2">
        <input
          className="flex-1 border rounded-lg px-3 py-2 text-sm"
          placeholder="Write a message..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />
        <button
          disabled={!conversationId || status === 'sending' || status === 'starting'}
          onClick={send}
          className="px-4 py-2 text-sm rounded-lg bg-amber-600 text-white font-semibold hover:bg-amber-700 disabled:opacity-60"
        >
          {status === 'sending' ? 'Sending...' : 'Send'}
        </button>
      </div>

      {status === 'error' && (
        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">Unable to send message right now. Please try again.</p>
        </div>
      )}
    </div>
  );
};

export default StoreContactForm;
