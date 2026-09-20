import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContextMultiRole';
import { canAccessCJImport } from '../utils/cjImportAccess';
import { getBusinessAccountRoles, getNormalizedAccountRoles } from '../utils/accountRoles';

const DashboardRoleSelector: React.FC = () => {
  const { user, userRoles, profile, loading } = useAuth();
  const roles = getNormalizedAccountRoles(userRoles, profile?.primary_role, profile?.role);
  const isAdmin = roles.includes('admin') || canAccessCJImport(user?.email || profile?.email || '');
  const businessRoles = getBusinessAccountRoles(roles);

  if (loading) return <p role="status" className="p-8 text-center text-slate-600">Loading your account…</p>;
  if (!user) {
    return <Navigate to="/auth/login" replace />;
  }

  if (!isAdmin && !businessRoles.length) return <Navigate to="/account" replace />;
  return <Navigate to="/business" replace />;
};

export default DashboardRoleSelector;
