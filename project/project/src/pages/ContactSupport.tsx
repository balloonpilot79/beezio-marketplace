import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContextMultiRole';

const ContactSupport: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;

    const body = String(message || '').trim();
    if (!body) {
      setError('Please write your message.');
      return;
    }

    setStatus('sending');
    setError(null);
    try {
      const { error: fnError } = await supabase.functions.invoke('create-support-thread', {
        body: { subject: subject ? subject.trim() : null, message: body },
      });
      if (fnError) throw fnError;
      setStatus('sent');
      setSubject('');
      setMessage('');
      // Send them to inbox so they can see the thread + replies
      navigate('/messages');
    } catch (e2) {
      console.error(e2);
      setStatus('error');
      setError('Unable to send your message right now. Please try again.');
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-8 bg-white rounded-lg shadow mt-10">
      <h1 className="text-3xl font-bold mb-4 text-purple-700">Contact & Support</h1>
      <p className="mb-6 text-gray-700">
        Support messages stay inside Beezio so the full history is retained and can be used to resolve disputes.
      </p>

      {!user?.id ? (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
          Please sign in to contact support (in-house messaging only).
          <div className="mt-2 text-xs text-yellow-700">
            Emergency fallback: <a href="mailto:support@beezio.co" className="underline">support@beezio.co</a>
          </div>
        </div>
      ) : (
        <form className="space-y-4" onSubmit={submit}>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Subject (optional)</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-400"
              placeholder="What do you need help with?"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-400"
              rows={6}
              required
            ></textarea>
          </div>

          {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}

          <button
            type="submit"
            disabled={status === 'sending'}
            className="bg-purple-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-purple-700 transition-colors disabled:opacity-60"
          >
            {status === 'sending' ? 'Sending…' : 'Send Message'}
          </button>
        </form>
      )}
    </div>
  );
};

export default ContactSupport;
