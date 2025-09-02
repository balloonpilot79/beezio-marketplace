import React from 'react';
import { useAuth } from '../contexts/AuthContext';

const DashboardTest: React.FC = () => {
  const { user, profile } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow p-6">
          <h1 className="text-2xl font-bold text-center mb-8">🧪 Dashboard System Test</h1>
          
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold text-lg mb-4">Current User Info:</h3>
              <div className="bg-gray-50 p-4 rounded">
                <p><strong>Email:</strong> {user?.email || 'Not logged in'}</p>
                <p><strong>Role:</strong> {profile?.role || 'No profile'}</p>
                <p><strong>Name:</strong> {profile?.full_name || 'Not set'}</p>
                <p><strong>Dashboard:</strong> {getDashboardType(profile?.role)}</p>
              </div>
            </div>
            
            <div>
              <h3 className="font-semibold text-lg mb-4">Dashboard System Logic:</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Buyer Role:</span>
                  <span className="text-blue-600">EnhancedBuyerDashboard</span>
                </div>
                <div className="flex justify-between">
                  <span>Seller Role:</span>
                  <span className="text-green-600">EnhancedSellerDashboard</span>
                </div>
                <div className="flex justify-between">
                  <span>Affiliate Role:</span>
                  <span className="text-purple-600">EnhancedAffiliateDashboard</span>
                </div>
                <div className="flex justify-between">
                  <span>Fundraiser Role:</span>
                  <span className="text-orange-600">EnhancedAffiliateDashboard</span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="mt-8 p-4 bg-blue-50 rounded">
            <h4 className="font-semibold mb-2">System Status:</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className={user ? "text-green-600" : "text-red-600"}>
                  {user ? "✅" : "❌"} Authentication: {user ? "Active" : "Not logged in"}
                </span>
              </div>
              <div>
                <span className={profile ? "text-green-600" : "text-red-600"}>
                  {profile ? "✅" : "❌"} Profile: {profile ? "Loaded" : "Not found"}
                </span>
              </div>
              <div>
                <span className={profile?.role ? "text-green-600" : "text-red-600"}>
                  {profile?.role ? "✅" : "❌"} Role: {profile?.role || "Not set"}
                </span>
              </div>
              <div>
                <span className="text-green-600">
                  ✅ Dashboard: Ready for role-based rendering
                </span>
              </div>
            </div>
          </div>

          {!user && (
            <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded">
              <p className="text-yellow-800">
                <strong>Not logged in:</strong> Please sign up or log in to test the dashboard system.
              </p>
            </div>
          )}

          {user && !profile && (
            <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded">
              <p className="text-red-800">
                <strong>Profile Missing:</strong> User authenticated but no profile found. 
                This may indicate a database setup issue.
              </p>
            </div>
          )}

          {user && profile && (
            <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded">
              <p className="text-green-800">
                <strong>✅ System Working:</strong> User authenticated with profile. 
                Dashboard will show: <strong>{getDashboardType(profile.role)}</strong>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

function getDashboardType(role: string | undefined) {
  switch (role) {
    case 'buyer':
      return 'Buyer Dashboard (Shopping & Orders)';
    case 'seller':
      return 'Seller Dashboard (Product Management)';
    case 'affiliate':
      return 'Affiliate Dashboard (Commission Tracking)';
    case 'fundraiser':
      return 'Fundraiser Dashboard (Cause Management)';
    default:
      return 'Default Dashboard';
  }
}

export default DashboardTest;
