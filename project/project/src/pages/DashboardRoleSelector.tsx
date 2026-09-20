import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContextMultiRole';
import { canAccessCJImport } from '../utils/cjImportAccess';
import { getBusinessAccountRoles, getNormalizedAccountRoles } from '../utils/accountRoles';

const DashboardRoleSelector: React.FC = () => {
  const { user, userRoles, profile } = useAuth();
  const roles = getNormalizedAccountRoles(userRoles, profile?.role);
  const isAdmin = roles.includes('admin') || canAccessCJImport(user);
  const businessRoles = getBusinessAccountRoles(roles);

  if (!user) {
    return <Navigate to="/auth/login" replace />;
  }

  if (!isAdmin && !businessRoles.length) return <Navigate to="/account" replace />;
  return <Navigate to="/business" replace />;
};

export default DashboardRoleSelector;
