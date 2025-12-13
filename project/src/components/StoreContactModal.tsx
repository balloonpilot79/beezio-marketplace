import React, { useState } from 'react';

interface StoreContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  ownerId: string;
  ownerType: 'seller' | 'affiliate' | 'fundraiser';
  storeName?: string;
}

const StoreContactModal: React.FC<StoreContactModalProps> = ({ isOpen, onClose, ownerId, ownerType, storeName }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  const submit = async () => {
    if (!name.trim() || !email.trim() || !message.trim()) {
      alert('Please fill in all fields');
      return;
    }
    setStatus('sending');
    try {
      const resp = await fetch('/.netlify/functions/contact-form', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          message,
          ownerId,
          ownerType,
          storeName: storeName || '',
          pageUrl: window.location.href,
        }),
      });
      if (!resp.ok) throw new Error('Failed to send message');
      setStatus('sent');
      setName('');
      setEmail('');
      setMessage('');
    } catch (e) {
      console.error(e);
      setStatus('error');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 relative">
        <button onClick={onClose} className="absolute top-3 right-3 text-gray-500 hover:text-gray-800 text-2xl">&times;</button>
        
        {/* Secure Messaging Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <div className="bg-green-100 p-2 rounded-lg">
              <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Secure Internal Messaging</h2>
              <p className="text-xs text-green-600 font-semibold flex items-center gap-1">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                Protected Platform Messaging - No Email Exposed
              </p>
            </div>
          </div>
          <p className="text-sm text-gray-600 bg-blue-50 p-3 rounded-lg border border-blue-200">
            💬 Your message is sent securely through Beezio's internal system to <strong>{storeName || 'the store owner'}</strong>. 
            Your email stays private. The owner will respond through their dashboard.
          </p>
        </div>

        <div className="space-y-3">
          <input
            className="w-full border rounded-lg px-3 py-2 text-sm"
            placeholder="Your name"
            value={name}
            onChange={e => setName(e.target.value)}
          />
          <input
            className="w-full border rounded-lg px-3 py-2 text-sm"
            placeholder="Your email"
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
          <textarea
            className="w-full border rounded-lg px-3 py-2 text-sm"
            rows={4}
            placeholder="How can we help?"
            value={message}
            onChange={e => setMessage(e.target.value)}
          />
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Cancel</button>
          <button
            disabled={status === 'sending'}
            onClick={submit}
            className="px-6 py-2.5 text-sm rounded-lg bg-gradient-to-r from-green-500 to-emerald-500 text-white font-semibold hover:from-green-600 hover:to-emerald-600 disabled:opacity-60 shadow-lg flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            {status === 'sending' ? 'Sending Securely...' : 'Send Secure Message'}
          </button>
        </div>
        {status === 'sent' && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-700 font-semibold flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Message delivered securely! The store owner will respond through the platform.
            </p>
          </div>
        )}
        {status === 'error' && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">Unable to send. Please try again or contact support.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default StoreContactModal;
