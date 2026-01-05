import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContextMultiRole';
import { Link } from 'react-router-dom';
import QRCode from 'qrcode.react';
import AffiliateMarketingToolkit from './AffiliateMarketingToolkit';
import AffiliateEarningsDashboard from './AffiliateEarningsDashboard';
import RecruiterDashboard from './RecruiterDashboard';
import { sanitizeDescriptionForDisplay } from '../utils/sanitizeDescription';

interface Payout {
  id: string;
  amount: number;
  status: string;
  created_at: string;
  processed_at?: string;
  failure_reason?: string;
}

interface Earnings {
  current_balance: number;
  pending_payout: number;
  paid_out: number;
}

interface PromotedProduct {
  id: string;
  title: string;
  description?: string; // Made optional to avoid errors
  price: number;
  commission_rate: number;
  commission_type: 'percentage' | 'flat_rate';
  flat_commission_amount: number;
  images: string[];
  custom_link?: string;
}

const generateAffiliateLink = (affiliateId: string, productId?: string) => {
  const baseUrl = window.location.origin;
  return productId
    ? `${baseUrl}/product/${productId}?ref=${affiliateId}`
    : `${baseUrl}?ref=${affiliateId}`;
};

const AffiliateLinks: React.FC<{ affiliateId: string; products: PromotedProduct[] }> = ({ affiliateId, products }) => (
  <div className="bg-white p-6 rounded-lg shadow-md">
    <h2 className="text-lg font-bold mb-4">Affiliate Links</h2>

    {/* Global Affiliate Link */}
    <div className="mb-6">
      <h3 className="text-sm font-medium text-gray-700">Global Affiliate Link</h3>
      <p className="text-sm text-gray-600 mb-2">Share this link to earn commissions on all purchases.</p>
      <div className="flex items-center gap-4">
        <input
          type="text"
          value={generateAffiliateLink(affiliateId)}
          readOnly
          className="w-full px-3 py-2 border rounded-lg"
        />
        <button
          onClick={() => navigator.clipboard.writeText(generateAffiliateLink(affiliateId))}
          className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600"
        >
          Copy
        </button>
      </div>
      <div className="mt-4">
        <QRCode value={generateAffiliateLink(affiliateId)} size={128} />
      </div>
    </div>

    {/* Product-Specific Links */}
    <div>
      <h3 className="text-sm font-medium text-gray-700">Product-Specific Links</h3>
      <p className="text-sm text-gray-600 mb-2">Generate links for individual products.</p>
      <ul>
        {products.map((product) => (
          <li key={product.id} className="mb-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium text-gray-900">{product.title}</h4>
                <p className="text-sm text-gray-600">{sanitizeDescriptionForDisplay(product.description, (product as any).lineage)}</p>
              </div>
              <button
                onClick={() => navigator.clipboard.writeText(generateAffiliateLink(affiliateId, product.id))}
                className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600"
              >
                Copy Link
              </button>
            </div>
            <div className="mt-2">
              <QRCode value={generateAffiliateLink(affiliateId, product.id)} size={128} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  </div>
);

const AffiliateDashboard: React.FC = () => {
  const { profile } = useAuth();
  const [products, setProducts] = useState<PromotedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [customLinks, setCustomLinks] = useState<{ [productId: string]: string }>({});
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  // Earnings and payouts
  const [earnings, setEarnings] = useState<Earnings | null>(null);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [payoutLoading, setPayoutLoading] = useState(false);
  const [payoutError, setPayoutError] = useState<string | null>(null);
  const [payoutSuccess, setPayoutSuccess] = useState<string | null>(null);
  const [requestingPayout, setRequestingPayout] = useState(false);

  useEffect(() => {
    fetchPromotedProducts();
    fetchEarningsAndPayouts();
  }, [profile]);

  const fetchPromotedProducts = async () => {
    setLoading(true);
    setError(null);
    if (!profile) return;
    // Get products affiliate has selected/promoted
    const { data, error } = await supabase
      .from('affiliate_selections')
      .select('product_id, products(*)')
      .eq('affiliate_id', profile.id);
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    const products = (data || []).map((row: any) => ({ ...row.products, id: row.product_id }));
    setProducts(products);
    setLoading(false);
  };

  const fetchEarningsAndPayouts = async () => {
    setPayoutLoading(true);
    setPayoutError(null);
    if (!profile) return;
    // Fetch earnings
    const { data: earningsData, error: earningsError } = await supabase
      .from('user_earnings')
      .select('*')
      .eq('user_id', profile.id)
      .eq('role', 'affiliate')
      .single();
    if (earningsError) {
      setPayoutError('Could not fetch earnings.');
      setPayoutLoading(false);
      return;
    }
    setEarnings(earningsData);
    // Fetch payout history
    const { data: payoutsData, error: payoutsError } = await supabase
      .from('payouts')
      .select('*')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false });
    if (payoutsError) {
      setPayoutError('Could not fetch payout history.');
      setPayoutLoading(false);
      return;
    }
    setPayouts(payoutsData || []);
    setPayoutLoading(false);
  };

  const handleCustomLinkChange = (productId: string, value: string) => {
    setCustomLinks({ ...customLinks, [productId]: value });
  };

  const handleSaveCustomLink = async (productId: string) => {
    setSaving(true);
    try {
      await supabase
        .from('affiliate_selections')
        .update({ custom_link: customLinks[productId] })
        .eq('affiliate_id', profile.id)
        .eq('product_id', productId);
      alert('Custom link saved!');
    } catch (err) {
      alert('Failed to save custom link.');
    }
    setSaving(false);
  };

  const handleRequestPayout = async () => {
    setRequestingPayout(true);
    setPayoutError(null);
    setPayoutSuccess(null);
    if (!profile) return;
    // Insert payout request (or trigger payout directly if auto)
    const { error } = await supabase
      .from('payout_requests')
      .insert({ user_id: profile.id, role: 'affiliate', amount: Math.max(earnings?.current_balance || 0, earnings?.pending_payout || 0) });
    if (error) {
      setPayoutError('Failed to request payout. Please try again later.');
    } else {
      setPayoutSuccess('Payout request submitted!');
      fetchEarningsAndPayouts();
    }
    setRequestingPayout(false);
  };

  if (loading || payoutLoading) return <div>Loading...</div>;
  if (error || payoutError) return <div className="text-red-500">{error || payoutError}</div>;

  const tabs = ['overview', 'products', 'marketing', 'earnings', 'recruitment'];

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-6">Affiliate Dashboard</h2>

      {/* Tabs */}
      <div className="mb-6 border-b">
        <nav className="flex gap-8">
          {tabs.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-4 px-2 font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-yellow-500 text-yellow-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <>
          <div className="mb-8 bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-2">Earnings Overview</h3>
        {earnings ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <div className="text-2xl font-bold text-green-700">${earnings.current_balance.toFixed(2)}</div>
              <div className="text-gray-600 text-sm">Available Balance</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-amber-600">${earnings.pending_payout.toFixed(2)}</div>
              <div className="text-gray-600 text-sm">Pending Payout</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-700">${earnings.paid_out.toFixed(2)}</div>
              <div className="text-gray-600 text-sm">Total Paid Out</div>
            </div>
          </div>
        ) : (
          <div>No earnings data found.</div>
        )}
        <button
          className="mt-4 bg-amber-500 text-white py-2 px-6 rounded-lg hover:bg-amber-600 transition-colors font-medium"
          onClick={handleRequestPayout}
          disabled={requestingPayout || Math.max((earnings?.current_balance || 0), (earnings?.pending_payout || 0)) < 25}
        >
          {requestingPayout ? 'Requesting...' : 'Add payout request'}
        </button>
        <div className="text-xs text-gray-500 mt-2">Payouts run bi-monthly (1st & 15th UTC).</div>
        {payoutSuccess && <div className="text-green-600 mt-2">{payoutSuccess}</div>}
        {payoutError && <div className="text-red-600 mt-2">{payoutError}</div>}
      </div>

      {/* Payout History Section */}
      <div className="mb-8 bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-2">Payout History</h3>
        {payouts.length === 0 ? (
          <div className="text-gray-500">No payouts yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="text-left py-2">Date</th>
                <th className="text-left py-2">Amount</th>
                <th className="text-left py-2">Status</th>
                <th className="text-left py-2">Details</th>
              </tr>
            </thead>
            <tbody>
              {payouts.map((payout) => (
                <tr key={payout.id}>
                  <td className="py-2">{new Date(payout.created_at).toLocaleDateString()}</td>
                  <td className="py-2">${payout.amount.toFixed(2)}</td>
                  <td className="py-2">
                    <span className={
                      payout.status === 'completed'
                        ? 'text-green-600'
                        : payout.status === 'failed'
                        ? 'text-red-600'
                        : 'text-amber-600'
                    }>
                      {payout.status.charAt(0).toUpperCase() + payout.status.slice(1)}
                    </span>
                  </td>
                  <td className="py-2">
                    {payout.status === 'failed' && payout.failure_reason ? (
                      <span className="text-red-600">{payout.failure_reason}</span>
                    ) : payout.status === 'completed' && payout.processed_at ? (
                      <span className="text-gray-600">Paid {new Date(payout.processed_at).toLocaleDateString()}</span>
                    ) : (
                      <span className="text-gray-500">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Promoted Products Section */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold mb-4">Promoted Products</h3>
        {products.length === 0 ? (
          <div className="text-gray-500">You haven't promoted any products yet.</div>
        ) : (
          <div className="space-y-6">
            {products.map(product => (
              <div key={product.id} className="bg-gray-50 rounded-lg shadow p-4 flex flex-col md:flex-row md:items-center md:space-x-6">
                <img src={product.images[0] || ''} alt={product.title} className="w-20 h-20 object-cover rounded mb-4 md:mb-0" />
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">{product.title}</h3>
                  <p className="text-gray-600">${product.price}</p>
                  <p className="text-xs text-amber-600">Commission: {product.commission_rate}%</p>
                  <div className="mt-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Custom Affiliate Link</label>
                    <input
                      type="text"
                      value={customLinks[product.id] || product.custom_link || ''}
                      onChange={e => handleCustomLinkChange(product.id, e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                      placeholder="Enter your custom link (e.g. utm params, shortener, etc.)"
                    />
                    <button
                      onClick={() => handleSaveCustomLink(product.id)}
                      disabled={saving}
                      className="mt-2 bg-amber-500 text-white py-2 px-4 rounded-lg hover:bg-amber-600 transition-colors font-medium"
                    >
                      {saving ? 'Saving...' : 'Save Link'}
                    </button>
                  </div>
                </div>
                <Link to={`/product/${product.id}`} className="ml-4 text-blue-600 hover:underline">View Product</Link>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Affiliate Links Section */}
      {profile && products.length > 0 && (
        <AffiliateLinks affiliateId={profile.id} products={products} />
      )}
        </>
      )}

      {/* Products Tab */}
      {activeTab === 'products' && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold mb-4">Promoted Products</h3>
          {products.length === 0 ? (
            <div className="text-gray-500">You haven't promoted any products yet.</div>
          ) : (
            <div className="space-y-6">
              {products.map(product => (
                <div key={product.id} className="bg-gray-50 rounded-lg shadow p-4 flex flex-col md:flex-row md:items-center md:space-x-6">
                  <img src={product.images[0] || ''} alt={product.title} className="w-20 h-20 object-cover rounded mb-4 md:mb-0" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">{product.title}</h3>
                    <p className="text-gray-600">${product.price}</p>
                    <p className="text-xs text-amber-600">Commission: {product.commission_rate}%</p>
                  </div>
                  <Link to={`/product/${product.id}`} className="ml-4 text-blue-600 hover:underline">View Product</Link>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Marketing Tools Tab */}
      {activeTab === 'marketing' && <AffiliateMarketingToolkit />}

      {/* Earnings Tab */}
      {activeTab === 'earnings' && <AffiliateEarningsDashboard />}

      {/* Recruitment Tab */}
      {activeTab === 'recruitment' && <RecruiterDashboard />}
    </div>
  );
};

export default AffiliateDashboard;
