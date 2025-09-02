import React from 'react';

function TestApp() {
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <h1 className="text-4xl font-bold text-center text-blue-600">
        Test App - If you see this, React is working!
      </h1>
      <div className="mt-8 text-center">
        <p className="text-lg text-gray-700">
          This is a minimal test to verify the app is loading.
        </p>
      </div>
    </div>
  );
}

export default TestApp;
