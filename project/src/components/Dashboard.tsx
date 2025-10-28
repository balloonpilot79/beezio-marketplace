import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContextMultiRole';
import UnifiedMegaDashboard from './UnifiedMegaDashboard';

const Dashboard: React.FC = () => {
  const { user, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [localLoading, setLocalLoading] = useState(true);

  // Timeout to prevent infinite loading - reduced to 2 seconds
  useEffect(() => {
    const timeout = setTimeout(() => {
      console.log('Dashboard: Loading timeout reached, forcing load');
      setLocalLoading(false);
    }, 2000); // 2 second timeout

    return () => clearTimeout(timeout);
  }, []);

  // Redirect if not authenticated
  useEffect(() => {
    console.log('Dashboard: Auth state -', { user: !!user, authLoading, profile: !!profile });
    
    if (!authLoading && !user) {
      console.log('Dashboard: No user found, redirecting to home');
      navigate('/');
      return;
    }
    
    // If auth is loaded, stop local loading immediately
    if (!authLoading && user) {
      console.log('Dashboard: Auth loaded, showing dashboard');
      setLocalLoading(false);
    }
  }, [user, authLoading, navigate, profile]);

  // Only show loading if both auth is loading AND we haven't timed out
  if ((authLoading || localLoading) && localLoading) {
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
    return null;
  }

  // ALWAYS render unified dashboard - it handles missing profiles gracefully
  return <UnifiedMegaDashboard />;
};

export default Dashboard;
