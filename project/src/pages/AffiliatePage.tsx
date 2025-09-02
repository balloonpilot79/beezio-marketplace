import React from 'react';

const AffiliatePage: React.FC = () => {
  return (
    <div className="max-w-3xl mx-auto py-16 px-4">
      <h1 className="text-4xl font-bold mb-6 text-amber-600">Affiliate Program</h1>
      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-8 shadow">
        <h2 className="text-2xl font-semibold mb-4">How to Earn as an Affiliate</h2>
        <ul className="list-disc pl-6 text-gray-700 mb-4">
          <li>Sign up for a free affiliate account</li>
          <li>Generate unique links for any product or the whole marketplace</li>
          <li>Share your links on social media, blogs, or with friends</li>
          <li>Earn commission for every sale made through your link</li>
          <li>Track your clicks, conversions, and earnings in your dashboard</li>
        </ul>
        <a href="/signup" className="inline-block bg-amber-500 text-white px-6 py-3 rounded-lg font-bold hover:bg-amber-600 transition-colors">Sign Up as Affiliate</a>
      </div>
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-2">Why Beezio?</h2>
        <p className="text-gray-800 mb-2">Beezio offers high commissions, instant payouts, and a thriving marketplace. Join today and start earning!</p>
      </div>
    </div>
  );
};

export default AffiliatePage;
