import React from 'react';

function App() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-orange-600 mb-4">Beezio Marketplace</h1>
        <p className="text-lg text-gray-600 mb-8">Testing basic React functionality</p>
        <div className="bg-white p-6 rounded-lg shadow-md">
          <p className="text-green-600 font-semibold">✅ React is working!</p>
          <p className="text-blue-600 mt-2">✅ Tailwind CSS is working!</p>
          <p className="text-purple-600 mt-2">✅ Basic rendering is working!</p>
        </div>
        <button
          className="mt-6 bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
          onClick={() => alert('Button works!')}
        >
          Test Button
        </button>
      </div>
    </div>
  );
}

export default App;
