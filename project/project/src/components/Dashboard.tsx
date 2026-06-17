import React, { useEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContextMultiRole';
import UnifiedDashboard from './UnifiedDashboard';
import type { SellerDashboardTab } from './EnhancedSellerDashboard';

const Dashboard: React.FC = () => {
  const { user, loading: authLoading, userRoles } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { section } = useParams<{ section?: string }>();
  const hasRedirected = useRef(false);

  const initialSellerTab = useMemo<SellerDashboardTab | undefined>(() => {
    const raw = String(section || '').toLowerCase();
    const map: Record<string, SellerDashboardTab> = {
      overview: 'overview',
      products: 'products',
      'single-product': 'single-product',
      'single-product-promo': 'single-product',
      'influencer-promo': 'influencer-promo',
      'bulk-upload': 'bulk-upload',
      orders: 'shipping',
      fulfillment: 'shipping',
      shipping: 'shipping',
      inventory: 'inventory',
      analytics: 'analytics',
      customers: 'customers',
      financials: 'financials',
      integrations: 'integrations',
      'partner-tool': 'integrations',
      'partner-tools': 'integrations',
      store: 'store-customization',
      'store-customization': 'store-customization',
      templates: 'store-customization',
      'custom-store': 'store-customization',
      'custom-pages': 'store-customization',
      messages: 'messages',
      inbox: 'messages',
      'affiliate-tools': 'affiliate-tools',
      support: 'support',
    };
    return map[raw];
  }, [section]);
  const initialSection = useMemo<'buyer' | 'seller' | 'affiliate' | 'influencer' | 'admin' | undefined>(() => {
    const params = new URLSearchParams(location.search);
    const rawParam = String(params.get('section') || '').toLowerCase();
    const rawPath = String(section || '').toLowerCase();
    const normalized = rawParam || rawPath;
    if (normalized === 'buyer' || normalized === 'admin') return normalized;
    if (normalized === 'partner' || normalized === 'seller' || normalized === 'affiliate' || normalized === 'influencer') return 'seller';
    return undefined;
  }, [location.search, section]);

  // If no user and done loading, redirect home (only once)
  useEffect(() => {
    if (!authLoading && !user && !hasRedirected.current) {
      hasRedirected.current = true;
      navigate('/', { replace: true });
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (authLoading || !user) return;

    const raw = String(section || '').toLowerCase();
    const roleAliases = new Set(['buyer', 'seller', 'affiliate', 'influencer', 'admin']);

    if (raw && !roleAliases.has(raw) && !initialSellerTab) {
      navigate('/dashboard', { replace: true });
    }
  }, [authLoading, initialSellerTab, navigate, section, user, userRoles]);

  useEffect(() => {
    if (authLoading || !user) return;
    const frame = window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [authLoading, location.pathname, location.search, user]);


  // Always show loading while auth is loading, even if user briefly exists
  if (authLoading && !user) {
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
    return <UnifiedDashboard initialSellerTab={initialSellerTab} initialSection={initialSection} />;
  }

  return null;
};

export default Dashboard;
