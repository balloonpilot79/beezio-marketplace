import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContextMultiRole';
import EnhancedSellerDashboard from './EnhancedSellerDashboard';
import EnhancedAffiliateDashboard from './EnhancedAffiliateDashboard';
import EnhancedBuyerDashboard from './EnhancedBuyerDashboard';

const Dashboard: React.FC = () => {
  const { user, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/');
      return;
    }
  }, [user, authLoading, navigate]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    navigate('/');
    return null;
  }

  // If no profile exists, show a simple dashboard with profile completion
  if (!profile) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto pt-8 px-4">
          <div className="bg-white rounded-lg shadow-sm border p-8 text-center">
            <div className="mb-6">
              <div className="w-16 h-16 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🎉</span>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome to Beezio!</h2>
              <p className="text-gray-600 mb-6">
                You're signed in as <strong>{user.email}</strong>
              </p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-4 mb-8">
              <div className="p-6 border border-gray-200 rounded-lg hover:shadow-md transition-shadow">
                <div className="text-3xl mb-2">🛍️</div>
                <h3 className="font-semibold text-gray-900 mb-2">Shop & Buy</h3>
                <p className="text-sm text-gray-600 mb-4">Browse and purchase products from our marketplace</p>
                <button 
                  onClick={() => navigate('/marketplace')}
                  className="w-full bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors"
                >
                  Browse Marketplace
                </button>
              </div>
              
              <div className="p-6 border border-gray-200 rounded-lg hover:shadow-md transition-shadow">
                <div className="text-3xl mb-2">💰</div>
                <h3 className="font-semibold text-gray-900 mb-2">Earn as Affiliate</h3>
                <p className="text-sm text-gray-600 mb-4">Promote products and earn commissions</p>
                <button 
                  onClick={() => navigate('/affiliate-dashboard-preview')}
                  className="w-full bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition-colors"
                >
                  View Affiliate Options
                </button>
              </div>
              
              <div className="p-6 border border-gray-200 rounded-lg hover:shadow-md transition-shadow">
                <div className="text-3xl mb-2">🏪</div>
                <h3 className="font-semibold text-gray-900 mb-2">Sell Products</h3>
                <p className="text-sm text-gray-600 mb-4">List and sell your own products</p>
                <button 
                  onClick={() => navigate('/dashboard-preview')}
                  className="w-full bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600 transition-colors"
                >
                  View Seller Options
                </button>
              </div>
            </div>

            <div className="bg-gray-50 p-6 rounded-lg">
              <h4 className="font-semibold text-gray-900 mb-2">Complete Your Profile</h4>
              <p className="text-gray-600 mb-4">Set up your profile to unlock all features and personalized dashboards</p>
              <button 
                onClick={() => navigate('/profile-setup')}
                className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white px-6 py-2 rounded-lg hover:from-yellow-600 hover:to-orange-600 transition-all font-medium"
              >
                Complete Profile Setup
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Render appropriate dashboard based on user role
  switch (profile.role) {
    case 'seller':
      return <EnhancedSellerDashboard />;
    case 'affiliate':
      return <EnhancedAffiliateDashboard />;
    case 'fundraiser':
      return <EnhancedAffiliateDashboard />; // Use affiliate dashboard for fundraisers with modified UI
    case 'buyer':
      return <EnhancedBuyerDashboard />;
    default:
      return <EnhancedBuyerDashboard />; // Default to buyer dashboard
  }
};

export default Dashboard;
