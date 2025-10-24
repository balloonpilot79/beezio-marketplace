import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContextMultiRole';
import UnifiedMegaDashboard from './UnifiedMegaDashboard';

const Dashboard: React.FC = () => {
  const { user, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [localLoading, setLocalLoading] = useState(true);

  // Timeout to prevent infinite loading
  useEffect(() => {
    const timeout = setTimeout(() => {
      console.log('Dashboard: Loading timeout reached, forcing load');
      setLocalLoading(false);
    }, 5000); // 5 second timeout

    return () => clearTimeout(timeout);
  }, []);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      console.log('Dashboard: No user found, redirecting to home');
      navigate('/');
      return;
    }
    
    // If auth is loaded, stop local loading
    if (!authLoading) {
      setLocalLoading(false);
    }
  }, [user, authLoading, navigate]);

  if (authLoading || localLoading) {
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
