import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContextMultiRole';
import UnifiedMegaDashboard from './UnifiedMegaDashboard';

const Dashboard: React.FC = () => {
  const { user, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  // Redirect if not authenticated
  useEffect(() => {
    console.log('Dashboard: Auth state -', { user: !!user, authLoading, profile: !!profile });
    
    if (!authLoading && !user) {
      console.log('Dashboard: No user found, redirecting to home');
      navigate('/');
      return;
    }
  }, [user, authLoading, navigate, profile]);

  // Show loading only while auth is loading AND we don't have a user yet
  if (authLoading && !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // If we have a user, show the dashboard even if auth is still loading
  if (!user) {
    return null;
  }

  // ALWAYS render unified dashboard - it handles missing profiles gracefully
  return <UnifiedMegaDashboard />;
};

export default Dashboard;
