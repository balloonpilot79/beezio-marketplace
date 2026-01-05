import React from 'react';
import { useAuth } from '../contexts/AuthContextMultiRole';

const AuthDebugInfo: React.FC = () => {
  const { user, session, profile } = useAuth();

  if (process.env.NODE_ENV === 'production') {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 bg-black text-white p-4 rounded text-xs max-w-md z-50 opacity-75">
      <h4 className="font-bold mb-2">Auth Debug Info:</h4>
      <div>
        <strong>User:</strong> {user ? user.email : 'null'}
      </div>
      <div>
        <strong>Session:</strong> {session ? 'exists' : 'null'}
      </div>
      <div>
        <strong>Profile:</strong> {profile ? profile.full_name || profile.email : 'null'}
      </div>
      <div>
        <strong>User ID:</strong> {user?.id || 'null'}
      </div>
      <button 
        onClick={() => {
          console.log('Full auth state:', { user, session, profile });
          console.log('Local storage keys:', Object.keys(localStorage));
          console.log('Session storage keys:', Object.keys(sessionStorage));
        }}
        className="mt-2 bg-blue-600 text-white px-2 py-1 rounded text-xs"
      >
        Log Full State
      </button>
    </div>
  );
};

export default AuthDebugInfo;
