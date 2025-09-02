import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const DEMO_SHELTER_ID = 'demo-shelter-001';

const HomelessShelterQRPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [personName, setPersonName] = useState('');
  const [amount, setAmount] = useState(10);
  const [productId, setProductId] = useState('');
  const [qrUrl, setQrUrl] = useState('');
  const [showQr, setShowQr] = useState(false);
  const [qrType, setQrType] = useState<'donation' | 'product'>('donation');

  // Generate a QR code for either donation or product sale
  const handleGenerateQR = () => {
    let url = '';
    if (qrType === 'donation') {
      url = `${window.location.origin}/shelter-donate?name=${encodeURIComponent(personName)}&amount=${amount}&shelter=${DEMO_SHELTER_ID}`;
    } else if (qrType === 'product' && productId) {
      url = `${window.location.origin}/product/${productId}?shelter=${DEMO_SHELTER_ID}&person=${encodeURIComponent(personName)}`;
    }
    setQrUrl(url);
    setShowQr(true);
  };

  return (
    <div className="max-w-2xl mx-auto py-16 px-4">
      <h1 className="text-3xl font-bold mb-6 text-gray-900">Homeless Shelter QR Code Program (Concept)</h1>
      <div className="mb-8 flex justify-end">
        <button
          className="bg-amber-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-amber-700 transition-colors"
          onClick={() => {
            if (user) {
              navigate('/dashboard');
            } else {
              navigate('/signup');
            }
          }}
        >
          Create Fundraiser
        </button>
      </div>
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-8">
        <p className="text-gray-800 mb-4">
          Generate a QR code for a homeless individual to accept donations. Donors scan the code and are sent to a payment page.
        </p>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">QR Code Type:</label>
          <div className="flex space-x-4 mb-4">
            <button
              className={`px-4 py-2 rounded ${qrType === 'donation' ? 'bg-amber-500 text-white' : 'bg-gray-200 text-gray-700'}`}
              onClick={() => setQrType('donation')}
            >
              Donation
            </button>
            <button
              className={`px-4 py-2 rounded ${qrType === 'product' ? 'bg-amber-500 text-white' : 'bg-gray-200 text-gray-700'}`}
              onClick={() => setQrType('product')}
            >
              Product Sale
            </button>
          </div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Person's Name (for tracking):</label>
          <input
            type="text"
            value={personName}
            onChange={e => setPersonName(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 mb-2"
            placeholder="John Doe"
          />
          {qrType === 'donation' && (
            <>
              <label className="block text-sm font-medium text-gray-700 mb-1">Suggested Donation Amount (USD):</label>
              <input
                type="number"
                min={1}
                value={amount}
                onChange={e => setAmount(Number(e.target.value))}
                className="w-full border border-gray-300 rounded px-3 py-2"
              />
            </>
          )}
          {qrType === 'product' && (
            <>
              <label className="block text-sm font-medium text-gray-700 mb-1">Product ID (from Beezio):</label>
              <input
                type="text"
                value={productId}
                onChange={e => setProductId(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2"
                placeholder="Enter product ID"
              />
            </>
          )}
          <button
            onClick={handleGenerateQR}
            className="mt-4 w-full bg-amber-500 text-white py-2 px-4 rounded hover:bg-amber-600 font-semibold"
            disabled={!personName || (qrType === 'donation' && amount < 1) || (qrType === 'product' && !productId)}
          >
            Generate QR Code
          </button>
        </div>
        {showQr && qrUrl && (
          <div className="mt-8 flex flex-col items-center">
            <div className="border p-4 bg-gray-100 text-center">QR Code functionality temporarily disabled</div>
            <div className="mt-4 text-xs text-gray-600 break-all">{qrUrl}</div>
            <div className="mt-2 text-green-700 font-semibold">
              {qrType === 'donation' ? 'Share this QR code for donations!' : 'Share this QR code to sell products and raise money!'}
            </div>
          </div>
        )}
      </div>
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Next Steps</h2>
        <ul className="list-disc pl-6 text-gray-700">
          <li>Integrate Stripe Checkout for real payments</li>
          <li>Track donations and distribute funds to shelters</li>
          <li>Onboard shelters and ensure compliance</li>
        </ul>
      </div>
    </div>
  );
};

export default HomelessShelterQRPage;
