import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContextMultiRole';
import UnifiedMegaDashboard from './UnifiedMegaDashboard';

const Dashboard: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const hasRedirected = useRef(false);

  console.log('Dashboard:', { hasUser: !!user, userEmail: user?.email, authLoading });

  // If no user and done loading, redirect home (only once)
  useEffect(() => {
    if (!authLoading && !user && !hasRedirected.current) {
      console.log('Dashboard: No user, redirecting to home');
      hasRedirected.current = true;
      navigate('/', { replace: true });
    }
  }, [user, authLoading, navigate]);

  // Always show loading while auth is loading, even if user briefly exists
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

  // Show dashboard if we have a user
  if (user) {
    console.log('Dashboard: Showing dashboard for', user.email);
    return <UnifiedMegaDashboard />;
  }

  return null;
};

export default Dashboard;
