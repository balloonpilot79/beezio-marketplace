import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContextMultiRole';
import UnifiedMegaDashboard from './UnifiedMegaDashboard';

const Dashboard: React.FC = () => {
  const { user, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const hasRedirected = useRef(false);

  // Redirect if not authenticated - only once
  useEffect(() => {
    console.log('Dashboard: Auth state -', { user: !!user, authLoading, profile: !!profile });
    
    if (!authLoading && !user && !hasRedirected.current) {
      console.log('Dashboard: No user found, redirecting to home');
      hasRedirected.current = true;
      navigate('/', { replace: true });
      return;
    }
  }, [user, authLoading, navigate, profile]);

  // If we have a user, ALWAYS show the dashboard - don't wait for loading
  if (user) {
    return <UnifiedMegaDashboard />;
  }

  // Only show loading if we're still checking auth AND no user yet
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

  // No user and not loading = shouldn't reach here but just in case
  return null;
};

export default Dashboard;
