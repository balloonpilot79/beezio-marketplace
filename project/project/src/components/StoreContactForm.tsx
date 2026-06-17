import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContextMultiRole';

interface StoreContactFormProps {
  storeOwnerId: string;
  storeName: string;
  storeType: 'seller' | 'affiliate';
}

const StoreContactForm: React.FC<StoreContactFormProps> = ({ storeOwnerId, storeName, storeType }) => {
  const { user, profile } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  useEffect(() => {
    const defaultName = String((profile as any)?.full_name || (profile as any)?.name || '').trim();
    const defaultEmail = String((user as any)?.email || '').trim();
    setName(defaultName);
    setEmail(defaultEmail);
  }, [user?.id, (user as any)?.email, (profile as any)?.full_name]);

  const send = async () => {
    const senderName = String(name || '').trim();
    const senderEmail = String(email || '').trim();
    const body = String(message || '').trim();
    if (!senderName || !senderEmail || !body) return;

    setStatus('sending');
    try {
      const res = await fetch('/.netlify/functions/contact-form', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: senderName,
          email: senderEmail,
          message: body,
          ownerId: storeOwnerId,
          ownerType: storeType,
          storeName,
          pageUrl: typeof window !== 'undefined' ? window.location.href : null,
          buyerUserId: user?.id || null,
        }),
      });
      if (!res.ok) {
        setStatus('error');
        return;
      }
      setMessage('');
      setStatus('sent');
    } catch (e) {
      console.error(e);
      setStatus('error');
    }
  };

  const isSelfStore = Boolean(user?.id) && String(storeOwnerId || '').trim() === String((profile as any)?.id || user?.id || '');
  if (isSelfStore) {
    return (
      <div className="p-6 bg-white border border-gray-200 rounded-xl">
        <h3 className="text-lg font-semibold text-gray-900">Contact Requests</h3>
        <p className="text-sm text-gray-600 mt-1">This is your store. Reply to customers from your dashboard.</p>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white border border-gray-200 rounded-xl">
      <h3 className="text-lg font-semibold text-gray-900">Contact {storeName}</h3>
      <p className="text-sm text-gray-600 mt-1">Replies are delivered in-app to protect privacy.</p>

      {status === 'sent' ? (
        <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
          Message sent. The store owner will reply from their dashboard.
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Your name</label>
            <input className="w-full border rounded-lg px-3 py-2 text-sm" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Your email</label>
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Message</label>
            <textarea
              className="w-full border rounded-lg px-3 py-2 text-sm min-h-[120px]"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="How can we help?"
            />
          </div>

          <div className="flex items-center justify-between gap-3">
            {status === 'error' ? <div className="text-sm text-red-600">Unable to send. Please try again.</div> : <div />}
            <button
              disabled={status === 'sending' || !name.trim() || !email.trim() || !message.trim()}
              onClick={send}
              className="px-4 py-2 text-sm rounded-lg bg-amber-600 text-white font-semibold hover:bg-amber-700 disabled:opacity-60"
            >
              {status === 'sending' ? 'Sending...' : 'Send'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default StoreContactForm;
