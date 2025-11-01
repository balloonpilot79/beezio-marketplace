import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContextMultiRole';
import UnifiedMegaDashboard from './UnifiedMegaDashboard';

const Dashboard: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  console.log('Dashboard:', { hasUser: !!user, userEmail: user?.email, authLoading });

  // If no user and done loading, redirect home
  useEffect(() => {
    if (!authLoading && !user) {
      console.log('Dashboard: No user, redirecting to home');
      navigate('/', { replace: true });
    }
  }, [user, authLoading, navigate]);

  // Show dashboard if we have a user
  if (user) {
    console.log('Dashboard: Showing dashboard for', user.email);
    return <UnifiedMegaDashboard />;
  }

  // Show loading only if auth is still loading
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return null;
};

export default Dashboard;
