import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContextMultiRole';

const DashboardRoleSelector: React.FC = () => {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/auth/login" replace />;
  }

  return <Navigate to="/dashboard" replace />;
};

export default DashboardRoleSelector;
