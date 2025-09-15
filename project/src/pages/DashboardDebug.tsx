import React from 'react';
import { useAuth } from '../contexts/AuthContextMultiRole';

const DashboardDebug: React.FC = () => {
  const { user, session, profile, signOut } = useAuth();

  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold mb-4">Dashboard Debug (dev-only)</h2>
      <div className="mb-4">
        <strong>User:</strong>
        <pre className="bg-gray-100 p-4 rounded mt-2">{JSON.stringify(user, null, 2)}</pre>
      </div>
      <div className="mb-4">
        <strong>Session:</strong>
        <pre className="bg-gray-100 p-4 rounded mt-2">{JSON.stringify(session, null, 2)}</pre>
      </div>
      <div className="mb-4">
        <strong>Profile:</strong>
        <pre className="bg-gray-100 p-4 rounded mt-2">{JSON.stringify(profile, null, 2)}</pre>
      </div>
      <div className="flex gap-4">
        <button onClick={() => window.location.reload()} className="px-4 py-2 bg-blue-600 text-white rounded">Refresh</button>
        <button onClick={() => signOut()} className="px-4 py-2 bg-red-600 text-white rounded">Sign out</button>
      </div>
    </div>
  );
};

export default DashboardDebug;
