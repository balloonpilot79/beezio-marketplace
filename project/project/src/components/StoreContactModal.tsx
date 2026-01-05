import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContextMultiRole';
import { apiPost } from '../utils/netlifyApi';

interface StoreContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  ownerId: string;
  ownerType: 'seller' | 'affiliate' | 'fundraiser';
  storeName?: string;
}

const StoreContactModal: React.FC<StoreContactModalProps> = ({ isOpen, onClose, ownerId, ownerType, storeName }) => {
  const { user } = useAuth();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState<'idle' | 'starting' | 'sending' | 'error'>('idle');

  const [resolvedOwnerUserId, setResolvedOwnerUserId] = useState<string>('');

  const canMessage = Boolean(user?.id) && Boolean(resolvedOwnerUserId) && resolvedOwnerUserId !== user?.id;

  const headerLabel = useMemo(() => {
    if (ownerType === 'seller') return 'Message Seller';
    if (ownerType === 'affiliate') return 'Message Store Owner';
    if (ownerType === 'fundraiser') return 'Message Fundraiser';
    return 'Message';
  }, [ownerType]);

  const loadMessages = async (id: string) => {
    const { data } = await supabase
      .from('store_messages')
      .select('id, conversation_id, sender_id, body, created_at')
      .eq('conversation_id', id)
      .order('created_at', { ascending: true });
    setMessages(Array.isArray(data) ? data : []);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const apiSession = sessionData?.session ?? null;
      await apiPost('/.netlify/functions/mark-store-conversation-read', apiSession, { conversationId: id });
    } catch {
      // non-fatal
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    setInput('');
    setMessages([]);
    setConversationId(null);
    setStatus('idle');

    const resolveOwner = async () => {
      const raw = String(ownerId || '').trim();
      if (!raw) {
        setResolvedOwnerUserId('');
        return;
      }
      // ownerId might be profiles.id or auth.users.id; resolve to auth.users.id for messaging tables.
      const { data } = await supabase
        .from('profiles')
        .select('user_id')
        .or(`id.eq.${raw},user_id.eq.${raw}`)
        .maybeSingle();
      const uid = String((data as any)?.user_id || raw);
      setResolvedOwnerUserId(uid);
    };

    void resolveOwner();
  }, [isOpen, ownerId]);

  useEffect(() => {
    if (!isOpen) return;
    if (!canMessage) return;

    const start = async () => {
      setStatus('starting');
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const apiSession = sessionData?.session ?? null;
        const data = await apiPost<{ conversation: { id: string } }>(
          '/.netlify/functions/start-store-conversation',
          apiSession,
          { ownerId: resolvedOwnerUserId, ownerType, storeName: storeName || null }
        );
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
  }, [isOpen, canMessage, resolvedOwnerUserId, ownerType, storeName]);

  const send = async () => {
    if (!conversationId) return;
    const body = String(input || '').trim();
    if (!body) return;

    setStatus('sending');
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const apiSession = sessionData?.session ?? null;
      await apiPost('/.netlify/functions/send-store-message', apiSession, { conversationId, body });
      setInput('');
      await loadMessages(conversationId);
    } catch (e) {
      console.error(e);
      setStatus('error');
    } finally {
      setStatus('idle');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 relative">
        <button onClick={onClose} className="absolute top-3 right-3 text-gray-500 hover:text-gray-800 text-2xl">
          &times;
        </button>

        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <div className="bg-green-100 p-2 rounded-lg">
              <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{headerLabel}</h2>
              <p className="text-xs text-green-600 font-semibold flex items-center gap-1">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                Protected platform messaging - logged and auditable
              </p>
            </div>
          </div>
          <p className="text-sm text-gray-600 bg-blue-50 p-3 rounded-lg border border-blue-200">
            Messages stay inside Beezio to protect buyers and sellers. Replies happen in-dashboard, and the full history is retained.
          </p>
        </div>

        {!user?.id ? (
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
            Sign in to message <strong>{storeName || 'this store'}</strong>.
          </div>
        ) : resolvedOwnerUserId === user.id ? (
          <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700">
            This is your store. Reply to customers from your dashboard inbox.
          </div>
        ) : (
          <>
            <div className="border border-gray-200 rounded-xl p-3 h-72 overflow-y-auto bg-gray-50">
              {status === 'starting' ? (
                <div className="text-sm text-gray-600">Starting conversation...</div>
              ) : messages.length === 0 ? (
                <div className="text-sm text-gray-600">No messages yet. Say hello.</div>
              ) : (
                <div className="space-y-2">
                  {messages.map((m) => (
                    <div
                      key={m.id}
                      className={`max-w-[85%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap ${
                        m.sender_id === user.id
                          ? 'ml-auto bg-green-600 text-white'
                          : 'bg-white text-gray-900 border border-gray-200'
                      }`}
                    >
                      {m.body}
                      <div className={`mt-1 text-[11px] ${m.sender_id === user.id ? 'text-green-100' : 'text-gray-500'}`}>
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
                className="px-4 py-2 text-sm rounded-lg bg-gray-900 text-white font-semibold hover:bg-gray-800 disabled:opacity-60"
              >
                {status === 'sending' ? 'Sending...' : 'Send'}
              </button>
            </div>

            {status === 'error' && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-700">Unable to send message right now. Please try again.</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default StoreContactModal;
