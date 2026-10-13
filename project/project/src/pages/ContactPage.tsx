import React, { useState } from 'react';
import PublicLayout from '../components/layout/PublicLayout';

const ContactPage: React.FC = () => {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (sending) return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 20000);
    setSending(true);
    setSent(false);
    setError('');
    try {
      const response = await fetch('/api/contact', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
        body: JSON.stringify({ name: fields.get('name'), email: fields.get('email'), message: fields.get('message'), website: fields.get('website') }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.ok !== true) throw new Error(response.status === 429 ? 'Please wait a minute before sending another message.' : result.error || 'Your message could not be sent. Please try again.');
      setSent(true);
      form.reset();
    } catch (failure) {
      setError(failure instanceof Error && failure.name !== 'AbortError' ? failure.message : 'Your message could not be sent. Please try again or email support@beezio.co.');
    } finally {
      window.clearTimeout(timeout);
      setSending(false);
    }
  };
  return (
    <PublicLayout>
      <div className="max-w-4xl mx-auto space-y-8">
        <header className="text-center space-y-3">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">Contact Us</h1>
          <p className="text-gray-600">Need help with an order or account? Send us a message.</p>
        </header>

        <section className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Support Email</h2>
          <p className="text-gray-700">
            Email us at <a href="mailto:support@beezio.co" className="text-amber-600 font-semibold">support@beezio.co</a>
          </p>
        </section>

        <section className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Support Form</h2>
          <form
            onSubmit={submit}
            className="grid grid-cols-1 gap-4"
          >
            {sent && <p role="status" className="rounded-lg bg-green-50 p-4 text-green-800">Your message has been sent to Beezio support. We’ll reply to the email address you provided.</p>}
            {error && <p role="alert" className="rounded-lg bg-red-50 p-4 text-red-800">{error}</p>}
            <div aria-hidden="true" className="hidden"><label htmlFor="website">Website</label><input id="website" name="website" tabIndex={-1} autoComplete="off" /></div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1" htmlFor="name">
                Name
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                maxLength={120}
                autoComplete="name"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                placeholder="Your name"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                maxLength={254}
                autoComplete="email"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1" htmlFor="message">
                Message
              </label>
              <textarea
                id="message"
                name="message"
                rows={5}
                required
                minLength={10}
                maxLength={4000}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                placeholder="Tell us how we can help."
              />
            </div>
            <button
              type="submit"
              disabled={sending}
              className="inline-flex items-center justify-center px-6 py-2 rounded-full bg-amber-500 text-black font-semibold hover:bg-amber-600 transition-colors"
            >
              {sending ? 'Sending…' : 'Send Message'}
            </button>
          </form>
        </section>
      </div>
    </PublicLayout>
  );
};

export default ContactPage;
