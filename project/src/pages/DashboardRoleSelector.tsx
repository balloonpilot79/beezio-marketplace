import React, { useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PublicLayout from '../components/layout/PublicLayout';
import { useAuth } from '../contexts/AuthContextMultiRole';

const ROLE_OPTIONS = [
  { key: 'buyer', title: 'Buyer dashboard', description: 'Orders, account, and saved items.', path: '/dashboard/buyer' },
  { key: 'seller', title: 'Seller dashboard', description: 'Overview, products, orders, store settings.', path: '/dashboard/seller' },
  { key: 'affiliate', title: 'Affiliate dashboard', description: 'Links, earnings, referrals.', path: '/dashboard/affiliate' },
  { key: 'fundraiser', title: 'Fundraiser dashboard', description: 'Campaigns, earnings, supporter links.', path: '/dashboard/fundraiser' },
];

const DashboardRoleSelector: React.FC = () => {
  const navigate = useNavigate();
  const { user, userRoles = [], profile } = useAuth();

  const availableRoles = useMemo(() => {
    const rolesFromProfile = profile?.role ? [profile.role] : [];
    const merged = new Set([...userRoles, ...rolesFromProfile]);
    const normalized = Array.from(merged).map((role) => role?.toLowerCase());
    const validRoles = ROLE_OPTIONS.filter((option) => normalized.includes(option.key));
    return validRoles.length > 0 ? validRoles : ROLE_OPTIONS;
  }, [profile?.role, userRoles]);

  useEffect(() => {
    if (availableRoles.length === 1) {
      navigate(availableRoles[0].path, { replace: true });
    }
  }, [availableRoles, navigate]);

  if (!user) {
    return (
      <PublicLayout>
        <div className="space-y-3 max-w-xl">
          <h1 className="text-3xl font-semibold text-gray-900">Log in to choose your dashboard</h1>
          <p className="text-gray-700">Access buyer, seller, affiliate, or fundraiser tools after signing in.</p>
          <Link
            to="/auth/login"
            className="inline-flex items-center px-5 py-3 rounded-full bg-amber-500 text-black font-semibold hover:bg-amber-600 transition-colors"
          >
            Go to login
          </Link>
        </div>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      <div className="space-y-4">
        <p className="text-sm font-semibold text-amber-700 uppercase tracking-[0.2em]">Dashboard</p>
        <h1 className="text-3xl font-semibold text-gray-900">Choose where to work</h1>
        <p className="text-gray-700">Pick the dashboard that matches the roles on your account.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
        {availableRoles.map((role) => (
          <Link
            key={role.key}
            to={role.path}
            className="block border border-amber-100 bg-amber-50 rounded-2xl p-6 hover:border-amber-400 hover:shadow-md transition-shadow transition-colors text-gray-900"
          >
            <h2 className="text-xl font-semibold text-gray-900">{role.title}</h2>
            <p className="text-sm text-gray-700 mt-2">{role.description}</p>
          </Link>
        ))}
      </div>
    </PublicLayout>
  );
};

export default DashboardRoleSelector;
