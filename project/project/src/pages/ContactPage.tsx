import React from 'react';
import PublicLayout from '../components/layout/PublicLayout';

const ContactPage: React.FC = () => {
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
            action="mailto:support@beezio.co"
            method="post"
            encType="text/plain"
            className="grid grid-cols-1 gap-4"
          >
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1" htmlFor="name">
                Name
              </label>
              <input
                id="name"
                name="name"
                type="text"
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
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                placeholder="Tell us how we can help."
              />
            </div>
            <button
              type="submit"
              className="inline-flex items-center justify-center px-6 py-2 rounded-full bg-amber-500 text-black font-semibold hover:bg-amber-600 transition-colors"
            >
              Send Message
            </button>
          </form>
        </section>
      </div>
    </PublicLayout>
  );
};

export default ContactPage;
