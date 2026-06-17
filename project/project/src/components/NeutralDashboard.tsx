import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContextMultiRole';

type DashboardSection = 'overview' | 'products' | 'orders' | 'store' | 'messages' | 'payments' | 'analytics' | 'cj-import';

const sectionLabels: Record<DashboardSection, string> = {
  overview: 'Overview',
  products: 'Products',
  orders: 'Orders',
  store: 'Store',
  messages: 'Messages',
  payments: 'Payments',
  analytics: 'Analytics',
  'cj-import': 'Import'
};

const orderedSections: DashboardSection[] = ['overview', 'products', 'orders', 'store', 'messages', 'payments', 'analytics'];

const NeutralDashboard: React.FC<{ activeSection: string; onSectionChange: (section: string) => void }> = ({
  activeSection,
  onSectionChange
}) => {
  const { user, profile, signOut } = useAuth();

  if (!user) return null;

  const normalized = String(activeSection || 'overview').toLowerCase();
  const current: DashboardSection = (orderedSections.includes(normalized as DashboardSection)
    ? (normalized as DashboardSection)
    : 'overview');

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-600 mt-1">
            Signed in as {user.email || 'user'}
            {profile?.primary_role || profile?.role ? ` • Role: ${profile?.primary_role || profile?.role}` : ''}
          </p>
        </div>
        <button
          onClick={() => void signOut()}
          className="px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-800 transition"
        >
          Sign out
        </button>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {orderedSections.map((s) => (
          <button
            key={s}
            onClick={() => onSectionChange(s)}
            className={
              s === current
                ? 'px-3 py-2 rounded-lg bg-orange-600 text-white'
                : 'px-3 py-2 rounded-lg bg-white border text-gray-800 hover:bg-gray-50'
            }
          >
            {sectionLabels[s]}
          </button>
        ))}
      </div>

      <div className="mt-6 bg-white border rounded-xl p-5">
        {current === 'overview' && (
          <div className="space-y-3">
            <p className="text-gray-800">
              This dashboard is payment-processor neutral.
            </p>
            <p className="text-gray-600 text-sm">
              Next steps: set up your checkout store, add products, and finish your public storefront for launch.
            </p>
            <div className="flex flex-wrap gap-2">
              <Link className="px-3 py-2 rounded-lg bg-orange-600 text-white" to="/dashboard/store">
                Go to Store
              </Link>
              <Link className="px-3 py-2 rounded-lg bg-gray-900 text-white" to="/add-product">
                Add Product
              </Link>
            </div>
          </div>
        )}

        {current !== 'overview' && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{sectionLabels[current]}</h2>
            <p className="text-sm text-gray-600 mt-1">
              This section is being refactored to the new supplier + store model.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default NeutralDashboard;
