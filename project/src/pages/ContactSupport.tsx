import React from 'react';

const ContactSupport: React.FC = () => (
  <div className="max-w-2xl mx-auto p-8 bg-white rounded-lg shadow mt-10">
    <h1 className="text-3xl font-bold mb-4 text-purple-700">Contact & Support</h1>
    <p className="mb-6 text-gray-700">Have a question, need help, or want to get in touch? Fill out the form below and our team will respond as soon as possible.</p>
    <form className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Your Name</label>
        <input type="text" className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-400" required />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
        <input type="email" className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-400" required />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
        <textarea className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-400" rows={5} required></textarea>
      </div>
      <button type="submit" className="bg-purple-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-purple-700 transition-colors">Send Message</button>
    </form>
    <div className="mt-8 text-gray-500 text-sm">
      Or email us directly at <a href="mailto:support@beezio.co" className="text-purple-600 underline">support@beezio.co</a>
    </div>
  </div>
);

export default ContactSupport;
