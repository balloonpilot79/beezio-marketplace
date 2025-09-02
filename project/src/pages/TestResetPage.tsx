import React from 'react';
import { useLocation, Link } from 'react-router-dom';

const TestResetPage: React.FC = () => {
  const location = useLocation();
  const urlParams = new URLSearchParams(location.search);
  const hashParams = new URLSearchParams(location.hash.substring(1));
  
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-2xl">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <h1 className="text-2xl font-bold text-center mb-6">🧪 Reset Password Test Page</h1>
          
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold">Current URL:</h3>
              <p className="text-sm bg-gray-100 p-2 rounded">{window.location.href}</p>
            </div>
            
            <div>
              <h3 className="font-semibold">URL Parameters:</h3>
              <div className="text-sm bg-gray-100 p-2 rounded">
                {Array.from(urlParams.entries()).length > 0 ? (
                  Array.from(urlParams.entries()).map(([key, value]) => (
                    <div key={key}>{key}: {value.substring(0, 50)}...</div>
                  ))
                ) : (
                  <div>No URL parameters found</div>
                )}
              </div>
            </div>
            
            <div>
              <h3 className="font-semibold">Hash Parameters:</h3>
              <div className="text-sm bg-gray-100 p-2 rounded">
                {Array.from(hashParams.entries()).length > 0 ? (
                  Array.from(hashParams.entries()).map(([key, value]) => (
                    <div key={key}>{key}: {value.substring(0, 50)}...</div>
                  ))
                ) : (
                  <div>No hash parameters found</div>
                )}
              </div>
            </div>
            
            <div className="pt-4">
              <Link 
                to="/reset-password" 
                className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
              >
                Go to Actual Reset Page
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TestResetPage;
