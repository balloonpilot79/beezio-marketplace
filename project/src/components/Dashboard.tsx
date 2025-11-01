import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContextMultiRole';
import UnifiedMegaDashboard from './UnifiedMegaDashboard';

const Dashboard: React.FC = () => {
  const { user, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const hasRedirected = useRef(false);
  const [maxWaitReached, setMaxWaitReached] = useState(false);

  console.log('Dashboard render:', { 
    hasUser: !!user, 
    userEmail: user?.email,
    authLoading, 
    hasProfile: !!profile,
    profileRole: profile?.role,
    maxWaitReached
  });

  // Maximum wait time before giving up on loading
  useEffect(() => {
    const timer = setTimeout(() => {
      console.log('Dashboard: Maximum wait time reached (1s)');
      setMaxWaitReached(true);
    }, 1000);
    
    return () => clearTimeout(timer);
  }, []);

  // Redirect if not authenticated - only once
  useEffect(() => {
    console.log('Dashboard useEffect: Auth state -', { user: !!user, authLoading, profile: !!profile });
    
    if (!authLoading && !user && !hasRedirected.current) {
      console.log('Dashboard: No user found, redirecting to home');
      hasRedirected.current = true;
      navigate('/', { replace: true });
      return;
    }
  }, [user, authLoading, navigate, profile]);

  // If we have a user, ALWAYS show the dashboard immediately - ignore loading state
  if (user) {
    console.log('Dashboard: Rendering UnifiedMegaDashboard for user:', user.email);
    return <UnifiedMegaDashboard />;
  }

  // If max wait reached and still no user, redirect to home
  if (maxWaitReached && !user) {
    console.log('Dashboard: Max wait reached with no user, redirecting');
    if (!hasRedirected.current) {
      hasRedirected.current = true;
      navigate('/', { replace: true });
    }
    return null;
  }

  // Only show loading if we're still checking auth AND no user yet
  if (authLoading || !maxWaitReached) {
    console.log('Dashboard: Still loading auth, showing spinner');
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // No user and not loading = redirect
  console.log('Dashboard: Fallback - redirecting to home');
  if (!hasRedirected.current) {
    hasRedirected.current = true;
    navigate('/', { replace: true });
  }
  return null;
};

export default Dashboard;
