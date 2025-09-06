import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Calendar, Clock, Target, Users, Share2, Heart, MapPin } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContextMultiRole';
import { SAMPLE_FUNDRAISERS, FUNDRAISER_CATEGORIES } from '../lib/sampleFundraisers';
import ProductGrid from '../components/ProductGrid';
import { SAMPLE_PRODUCTS } from '../lib/sampleData';

interface Cause {
  id: string;
  title: string;
  story: string;
  goal_amount: number;
  raised_amount: number;
  image_url: string;
  creator_id: string;
  creator_name: string;
  created_at: string;
  end_date: string;
  category: string;
  is_active: boolean;
}

const FundraiserDetailPage: React.FC = () => {
  const { fundraiserId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [cause, setCause] = useState<Cause | null>(null);
  const [loading, setLoading] = useState(true);
  const [donationAmount, setDonationAmount] = useState('');
  const [showDonationForm, setShowDonationForm] = useState(false);
  const [relatedProducts, setRelatedProducts] = useState(SAMPLE_PRODUCTS.slice(0, 8));

  useEffect(() => {
    fetchCause();
  }, [fundraiserId]);

  const fetchCause = async () => {
    try {
      // First try to find in sample data
      const sampleCause = SAMPLE_FUNDRAISERS.find(c => c.id === fundraiserId);
      if (sampleCause) {
        setCause(sampleCause);
        setLoading(false);
        return;
      }

      // If not in sample data, try database
      const { data, error } = await supabase
        .from('causes')
        .select('*')
        .eq('id', fundraiserId)
        .single();

      if (error) throw error;
      setCause(data);
    } catch (error) {
      console.error('Error fetching cause:', error);
      // If cause not found, navigate back
      navigate('/fundraisers');
    } finally {
      setLoading(false);
    }
  };

  const calculateProgress = (raised: number, goal: number) => {
    return Math.min(100, (raised / goal) * 100);
  };

  const formatTimeRemaining = (endDate: string) => {
    const now = new Date();
    const end = new Date(endDate);
    const diff = end.getTime() - now.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    
    if (days < 0) return 'Campaign ended';
    if (days === 0) return 'Last day to donate';
    if (days === 1) return '1 day remaining';
    return `${days} days remaining`;
  };

  const handleDonate = () => {
    if (!user) {
      navigate('/signup');
      return;
    }
    setShowDonationForm(true);
  };

  const handleShare = async () => {
    if (navigator.share && cause) {
      try {
        await navigator.share({
          title: cause.title,
          text: cause.story.substring(0, 100) + '...',
          url: window.location.href
        });
      } catch (error) {
        // Fallback to copy to clipboard
        navigator.clipboard.writeText(window.location.href);
        alert('Link copied to clipboard!');
      }
    } else {
      // Fallback to copy to clipboard
      navigator.clipboard.writeText(window.location.href);
      alert('Link copied to clipboard!');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-green-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading fundraiser...</p>
        </div>
      </div>
    );
  }

  if (!cause) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Fundraiser Not Found</h1>
          <button
            onClick={() => navigate('/fundraisers')}
            className="bg-green-500 text-white px-6 py-3 rounded-lg hover:bg-green-600"
          >
            Browse All Fundraisers
          </button>
        </div>
      </div>
    );
  }

  const progress = calculateProgress(cause.raised_amount, cause.goal_amount);
  const timeRemaining = formatTimeRemaining(cause.end_date);
  const category = FUNDRAISER_CATEGORIES.find(cat => cat.id === cause.category);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Back Button */}
        <button
          onClick={() => navigate('/fundraisers')}
          className="mb-6 flex items-center text-green-600 hover:text-green-700 font-medium"
        >
          ← Back to Fundraisers
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2">
            {/* Hero Image */}
            <div className="relative mb-6">
              <img
                src={cause.image_url}
                alt={cause.title}
                className="w-full h-96 object-cover rounded-lg shadow-lg"
              />
              {category && (
                <div className="absolute top-4 left-4 bg-white bg-opacity-90 px-3 py-1 rounded-full">
                  <span className="flex items-center text-sm font-medium">
                    {category.icon} {category.name}
                  </span>
                </div>
              )}
            </div>

            {/* Title and Creator */}
            <div className="mb-6">
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                {cause.title}
              </h1>
              <div className="flex items-center text-gray-600 mb-4">
                <Users className="w-5 h-5 mr-2" />
                <span>Organized by <strong>{cause.creator_name}</strong></span>
              </div>
              <div className="flex items-center space-x-6 text-sm text-gray-600">
                <div className="flex items-center">
                  <Calendar className="w-4 h-4 mr-1" />
                  Started {new Date(cause.created_at).toLocaleDateString()}
                </div>
                <div className="flex items-center">
                  <Clock className="w-4 h-4 mr-1" />
                  {timeRemaining}
                </div>
              </div>
            </div>

            {/* Story */}
            <div className="bg-white rounded-lg shadow-md p-6 mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Our Story</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                {cause.story.split('\n').map((paragraph, index) => (
                  <p key={index} className="mb-4">
                    {paragraph}
                  </p>
                ))}
              </div>
            </div>

            {/* Related Products Section */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Support by Shopping</h2>
                <p className="text-gray-600">Every purchase helps this cause</p>
              </div>
              <p className="text-gray-700 mb-6">
                Shop these products and a portion of the proceeds will go directly to support this fundraiser. 
                It's a great way to get something you need while making a difference!
              </p>
              <ProductGrid products={relatedProducts} hideFilters={true} />
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-md p-6 sticky top-8">
              {/* Progress Section */}
              <div className="mb-6">
                <div className="flex justify-between items-baseline mb-2">
                  <span className="text-2xl font-bold text-gray-900">
                    ${cause.raised_amount.toLocaleString()}
                  </span>
                  <span className="text-gray-600 text-sm">
                    {Math.round(progress)}% of goal
                  </span>
                </div>
                
                <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
                  <div 
                    className="bg-green-500 h-3 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div>
                    <div className="text-lg font-bold text-gray-900">
                      ${cause.goal_amount.toLocaleString()}
                    </div>
                    <div className="text-sm text-gray-600">Goal</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-gray-900">
                      {Math.round((cause.raised_amount / cause.goal_amount) * 100) || 0}
                    </div>
                    <div className="text-sm text-gray-600">Supporters</div>
                  </div>
                </div>
              </div>

              {/* Donation Form */}
              {!showDonationForm ? (
                <div className="space-y-4">
                  <button
                    onClick={handleDonate}
                    className="w-full bg-green-500 text-white py-4 rounded-lg hover:bg-green-600 transition-colors font-bold text-lg"
                  >
                    <Heart className="w-5 h-5 inline mr-2" />
                    Donate Now
                  </button>
                  
                  <button
                    onClick={handleShare}
                    className="w-full bg-blue-500 text-white py-3 rounded-lg hover:bg-blue-600 transition-colors font-medium flex items-center justify-center"
                  >
                    <Share2 className="w-4 h-4 mr-2" />
                    Share This Fundraiser
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <h3 className="font-bold text-gray-900">Choose Amount</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {[25, 50, 100, 250].map(amount => (
                      <button
                        key={amount}
                        onClick={() => setDonationAmount(amount.toString())}
                        className={`py-2 px-4 rounded border ${
                          donationAmount === amount.toString()
                            ? 'bg-green-500 text-white border-green-500'
                            : 'bg-white text-gray-700 border-gray-300 hover:border-green-500'
                        }`}
                      >
                        ${amount}
                      </button>
                    ))}
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Custom Amount
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
                      <input
                        type="number"
                        value={donationAmount}
                        onChange={(e) => setDonationAmount(e.target.value)}
                        placeholder="Enter amount"
                        className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                  
                  <button
                    onClick={() => {
                      if (!donationAmount || parseFloat(donationAmount) <= 0) {
                        alert('Please enter a valid donation amount');
                        return;
                      }
                      alert(`Thank you for your ${donationAmount} donation! (Payment processing not implemented yet)`);
                    }}
                    disabled={!donationAmount || parseFloat(donationAmount) <= 0}
                    className="w-full bg-green-500 text-white py-3 rounded-lg hover:bg-green-600 transition-colors font-bold disabled:bg-gray-300"
                  >
                    Donate ${donationAmount || '0'}
                  </button>
                  
                  <button
                    onClick={() => setShowDonationForm(false)}
                    className="w-full text-gray-600 hover:text-gray-800 py-2"
                  >
                    Cancel
                  </button>
                </div>
              )}

              {/* Time Remaining */}
              <div className="mt-6 p-4 bg-amber-50 rounded-lg">
                <div className="flex items-center text-amber-800">
                  <Clock className="w-5 h-5 mr-2" />
                  <span className="font-medium">{timeRemaining}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FundraiserDetailPage;
